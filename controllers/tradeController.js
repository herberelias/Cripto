const db = require('../config/database');

// Obtener trades del usuario
async function getTrades(req, res) {
    try {
        const usuarioId = req.usuarioId;
        const { estado } = req.query;

        let query = `
      SELECT t.*, s.tipo as senal_tipo, s.razon
      FROM trades_simulados t
      LEFT JOIN senales s ON t.senal_id = s.id
      WHERE t.usuario_id = ?
    `;
        const params = [usuarioId];

        if (estado) {
            query += ' AND t.estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY t.fecha_apertura DESC';

        const [trades] = await db.query(query, params);

        res.json({
            success: true,
            data: trades
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener trades'
        });
    }
}

// Abrir trade
async function abrirTrade(req, res) {
    try {
        const usuarioId = req.usuarioId;
        const { senalId, tipo, precioEntrada, cantidadBtc, stopLoss, takeProfit, notas } = req.body;

        if (!tipo || !precioEntrada || !cantidadBtc || !stopLoss || !takeProfit) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos requeridos'
            });
        }

        const [result] = await db.query(
            `INSERT INTO trades_simulados
       (usuario_id, senal_id, tipo, precio_entrada, cantidad_btc, stop_loss, take_profit, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [usuarioId, senalId, tipo, precioEntrada, cantidadBtc, stopLoss, takeProfit, notas]
        );

        res.status(201).json({
            success: true,
            message: 'Trade abierto exitosamente',
            tradeId: result.insertId
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al abrir trade'
        });
    }
}

// Cerrar trade
async function cerrarTrade(req, res) {
    try {
        const usuarioId = req.usuarioId;
        const { id } = req.params;
        const { precioSalida, motivoCierre } = req.body;

        if (!precioSalida || !motivoCierre) {
            return res.status(400).json({
                success: false,
                message: 'Precio de salida y motivo son requeridos'
            });
        }

        // Obtener el trade
        const [trades] = await db.query(
            'SELECT * FROM trades_simulados WHERE id = ? AND usuario_id = ?',
            [id, usuarioId]
        );

        if (trades.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Trade no encontrado'
            });
        }

        const trade = trades[0];

        // Calcular ganancia
        let gananciaUsd, gananciaPorcentaje;
        if (trade.tipo === 'LONG') {
            gananciaUsd = (precioSalida - trade.precio_entrada) * trade.cantidad_btc;
            gananciaPorcentaje = ((precioSalida - trade.precio_entrada) / trade.precio_entrada) * 100;
        } else {
            gananciaUsd = (trade.precio_entrada - precioSalida) * trade.cantidad_btc;
            gananciaPorcentaje = ((trade.precio_entrada - precioSalida) / trade.precio_entrada) * 100;
        }

        // Actualizar trade
        await db.query(
            `UPDATE trades_simulados
       SET precio_salida = ?, ganancia_usd = ?, ganancia_porcentaje = ?,
           estado = 'cerrado', fecha_cierre = NOW(), motivo_cierre = ?
       WHERE id = ?`,
            [precioSalida, gananciaUsd, gananciaPorcentaje, motivoCierre, id]
        );

        // Actualizar balance virtual
        await actualizarBalance(usuarioId, gananciaUsd);

        res.json({
            success: true,
            message: 'Trade cerrado exitosamente',
            ganancia: {
                usd: gananciaUsd.toFixed(2),
                porcentaje: gananciaPorcentaje.toFixed(2)
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cerrar trade'
        });
    }
}

// Obtener estadísticas
async function getEstadisticas(req, res) {
    try {
        const usuarioId = req.usuarioId;

        const [balance] = await db.query(
            'SELECT * FROM balance_virtual WHERE usuario_id = ?',
            [usuarioId]
        );

        if (balance.length === 0) {
            return res.json({
                success: true,
                data: {
                    balanceInicial: 10000,
                    balanceActual: 10000,
                    tradesTotal: 0,
                    tradesGanadores: 0,
                    tasaAciertos: 0
                }
            });
        }

        res.json({
            success: true,
            data: balance[0]
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas'
        });
    }
}

// Función auxiliar para actualizar balance
async function actualizarBalance(usuarioId, gananciaUsd) {
    try {
        const [balance] = await db.query(
            'SELECT * FROM balance_virtual WHERE usuario_id = ?',
            [usuarioId]
        );

        if (balance.length === 0) return;

        const balanceActual = parseFloat(balance[0].balance_actual) + gananciaUsd;
        const esGanador = gananciaUsd > 0;

        await db.query(
            `UPDATE balance_virtual
       SET balance_actual = ?,
           ganancia_total = ganancia_total + IF(? > 0, ?, 0),
           perdida_total = perdida_total + IF(? < 0, ABS(?), 0),
           trades_totales = trades_totales + 1,
           trades_ganadores = trades_ganadores + IF(? > 0, 1, 0),
           trades_perdedores = trades_perdedores + IF(? < 0, 1, 0),
           tasa_aciertos = (trades_ganadores + IF(? > 0, 1, 0)) / (trades_totales + 1) * 100,
           mejor_trade = IF(? > mejor_trade, ?, mejor_trade),
           peor_trade = IF(? < peor_trade, ?, peor_trade)
       WHERE usuario_id = ?`,
            [balanceActual, gananciaUsd, gananciaUsd, gananciaUsd, gananciaUsd,
                gananciaUsd, gananciaUsd, gananciaUsd, gananciaUsd, gananciaUsd,
                gananciaUsd, gananciaUsd, usuarioId]
        );

    } catch (error) {
        console.error('Error actualizando balance:', error);
    }
}

module.exports = {
    getTrades,
    abrirTrade,
    cerrarTrade,
    getEstadisticas
};
