const db = require('../config/database');
const precioService = require('../services/precioService');

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
    getSenalesActivas,
    getHistorial,
    getSenal,
    getPrecioActual,
    getHistorico
};
