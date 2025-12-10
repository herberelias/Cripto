const db = require('../config/database');
const { generarSenal, guardarSenal } = require('../services/generadorSenales');
const precioService = require('../services/precioService');

// Generar señal de prueba (solo para testing)
const generarSenalPrueba = async (req, res) => {
    try {
        const precioActual = await precioService.getPrecioActual();

        const senalPrueba = {
            tipo: 'LONG',
            precioEntrada: precioActual.precio,
            stopLoss: parseFloat((precioActual.precio * 0.98).toFixed(2)),
            takeProfit1: parseFloat((precioActual.precio * 1.02).toFixed(2)),
            takeProfit2: parseFloat((precioActual.precio * 1.035).toFixed(2)),
            takeProfit3: parseFloat((precioActual.precio * 1.05).toFixed(2)),
            probabilidad: 65,
            ratioRB: 2.5,
            razon: 'Señal de prueba generada manualmente; RSI favorable; Tendencia alcista',
            timeframe: '1h',
            indicadores: {
                rsi: 45.5,
                macd: 0.0012,
                macdSignal: 0.0008,
                ema20: parseFloat((precioActual.precio * 0.99).toFixed(2)),
                ema50: parseFloat((precioActual.precio * 0.98).toFixed(2)),
                ema200: parseFloat((precioActual.precio * 0.95).toFixed(2)),
                bollingerSuperior: parseFloat((precioActual.precio * 1.02).toFixed(2)),
                bollingerInferior: parseFloat((precioActual.precio * 0.98).toFixed(2)),
                volumenActual: 1500000,
                volumenPromedio: 1200000,
                puntuacionTotal: 65
            }
        };

        const senalId = await guardarSenal(senalPrueba);

        res.json({
            success: true,
            message: 'Señal de prueba generada exitosamente',
            senalId,
            senal: senalPrueba
        });
    } catch (error) {
        console.error('Error generando señal de prueba:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar señal de prueba',
            error: error.message
        });
    }
};

// Obtener señales activas
async function getSenalesActivas(req, res) {
    try {
        const usuarioId = req.usuarioId;

        // Obtener configuración del usuario
        const [config] = await db.query(
            'SELECT * FROM configuracion_usuario WHERE usuario_id = ?',
            [usuarioId]
        );

        const probabilidadMinima = config[0]?.probabilidad_minima || 70;
        const ratioMinimo = config[0]?.ratio_riesgo_beneficio_minimo || 2.0;

        // Obtener señales activas que cumplan los filtros
        const [senales] = await db.query(
            `SELECT s.*, i.rsi, i.macd, i.ema_20, i.ema_50, i.ema_200, i.puntuacion_total
       FROM senales s
       LEFT JOIN indicadores_senal i ON s.id = i.senal_id
       WHERE s.estado = 'activa' 
         AND s.probabilidad >= ?
         AND s.ratio_riesgo_beneficio >= ?
         AND s.fecha_expiracion > NOW()
       ORDER BY s.fecha_creacion DESC
       LIMIT 10`,
            [probabilidadMinima, ratioMinimo]
        );

        res.json({
            success: true,
            data: senales
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener señales'
        });
    }
}

// Obtener historial de señales
async function getHistorial(req, res) {
    try {
        const { limite = 20, estado } = req.query;

        let query = `
      SELECT s.*, i.puntuacion_total
      FROM senales s
      LEFT JOIN indicadores_senal i ON s.id = i.senal_id
      WHERE 1=1
    `;
        const params = [];

        if (estado) {
            query += ' AND s.estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY s.fecha_creacion DESC LIMIT ?';
        params.push(parseInt(limite));

        const [senales] = await db.query(query, params);

        res.json({
            success: true,
            data: senales
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial'
        });
    }
}

// Obtener detalle de señal
async function getSenal(req, res) {
    try {
        const { id } = req.params;

        const [senales] = await db.query(
            `SELECT s.*, i.*
       FROM senales s
       LEFT JOIN indicadores_senal i ON s.id = i.senal_id
       WHERE s.id = ?`,
            [id]
        );

        if (senales.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Señal no encontrada'
            });
        }

        res.json({
            success: true,
            data: senales[0]
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener señal'
        });
    }
}

// Obtener precio actual de BTC
async function getPrecioActual(req, res) {
    try {
        const precio = await precioService.getPrecioActual();
        res.json({
            success: true,
            data: precio
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener precio'
        });
    }
}

// Obtener histórico de precios
async function getHistorico(req, res) {
    try {
        const historico = await precioService.getHistorico24h();
        res.json({
            success: true,
            data: historico
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener histórico'
        });
    }
}

module.exports = {
    generarSenalPrueba,
    getSenalesActivas,
    getHistorial,
    getSenal,
    getPrecioActual,
    getHistorico
};
