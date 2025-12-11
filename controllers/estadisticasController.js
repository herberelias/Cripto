const db = require('../config/database');

/**
 * Obtener estadísticas globales
 */
async function getEstadisticasGlobales(req, res) {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total_senales,
                SUM(CASE WHEN resultado = 'ganadora' THEN 1 ELSE 0 END) as ganadoras,
                SUM(CASE WHEN resultado = 'perdedora' THEN 1 ELSE 0 END) as perdedoras,
                SUM(CASE WHEN resultado = 'pendiente' THEN 1 ELSE 0 END) as pendientes
            FROM resultado_senales
        `);

        const tasaAcierto = stats[0].total_senales > 0
            ? (stats[0].ganadoras / (stats[0].ganadoras + stats[0].perdedoras)) * 100
            : 0;

        res.json({
            success: true,
            data: {
                total_senales: stats[0].total_senales,
                ganadoras: stats[0].ganadoras,
                perdedoras: stats[0].perdedoras,
                pendientes: stats[0].pendientes,
                tasa_acierto: parseFloat(tasaAcierto.toFixed(2))
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas globales'
        });
    }
}

/**
 * Obtener estadísticas por rango de puntuación
 */
async function getEstadisticasPorPuntuacion(req, res) {
    try {
        const [stats] = await db.query(`
            SELECT * FROM estadisticas_senales
            ORDER BY puntuacion_min ASC
        `);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas por puntuación'
        });
    }
}

/**
 * Obtener estadísticas por tipo (LONG/SHORT)
 */
async function getEstadisticasPorTipo(req, res) {
    try {
        const [stats] = await db.query(`
            SELECT 
                s.tipo,
                COUNT(*) as total,
                SUM(CASE WHEN r.resultado = 'ganadora' THEN 1 ELSE 0 END) as ganadoras,
                SUM(CASE WHEN r.resultado = 'perdedora' THEN 1 ELSE 0 END) as perdedoras
            FROM senales s
            INNER JOIN resultado_senales r ON s.id = r.senal_id
            WHERE r.resultado != 'pendiente'
            GROUP BY s.tipo
        `);

        const resultado = stats.map(stat => ({
            tipo: stat.tipo,
            total: stat.total,
            ganadoras: stat.ganadoras,
            perdedoras: stat.perdedoras,
            tasa_acierto: stat.total > 0
                ? parseFloat(((stat.ganadoras / stat.total) * 100).toFixed(2))
                : 0
        }));

        res.json({
            success: true,
            data: resultado
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas por tipo'
        });
    }
}

/**
 * Obtener rendimiento histórico
 */
async function getRendimientoHistorico(req, res) {
    try {
        const { dias = 30 } = req.query;

        const [rendimiento] = await db.query(`
            SELECT * FROM rendimiento_diario
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY fecha DESC
        `, [parseInt(dias)]);

        res.json({
            success: true,
            data: rendimiento
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener rendimiento histórico'
        });
    }
}

/**
 * Obtener detalles de resultados de señales
 */
async function getResultadosSenales(req, res) {
    try {
        const { limite = 50, resultado } = req.query;

        let query = `
            SELECT 
                s.id,
                s.tipo,
                s.precio_entrada,
                s.probabilidad,
                r.resultado,
                r.precio_alcanzado,
                r.tipo_cierre,
                r.fecha_verificacion,
                i.puntuacion_total
            FROM senales s
            INNER JOIN resultado_senales r ON s.id = r.senal_id
            LEFT JOIN indicadores_senal i ON s.id = i.senal_id
            WHERE 1=1
        `;
        const params = [];

        if (resultado) {
            query += ' AND r.resultado = ?';
            params.push(resultado);
        }

        query += ' ORDER BY r.fecha_verificacion DESC LIMIT ?';
        params.push(parseInt(limite));

        const [resultados] = await db.query(query, params);

        res.json({
            success: true,
            data: resultados
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener resultados de señales'
        });
    }
}

module.exports = {
    getEstadisticasGlobales,
    getEstadisticasPorPuntuacion,
    getEstadisticasPorTipo,
    getRendimientoHistorico,
    getResultadosSenales
};
