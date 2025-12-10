const db = require('../config/database');

/**
 * Sistema de Calibración Automática de Probabilidades
 * Ajusta las probabilidades basándose en resultados reales
 */

async function calibrarProbabilidades() {
    try {
        console.log('🎯 Iniciando calibración de probabilidades...\n');

        // Obtener estadísticas por rango
        const [rangos] = await db.query('SELECT * FROM estadisticas_senales WHERE total_senales >= 10');

        console.log('📊 Calibrando probabilidades por rango:\n');

        for (const rango of rangos) {
            const tasaAcierto = rango.tasa_acierto;
            const probabilidadActual = rango.probabilidad_ajustada;

            // Calcular nueva probabilidad basada en tasa de acierto real
            const nuevaProbabilidad = Math.round(tasaAcierto);

            // Solo actualizar si hay diferencia significativa (>5%)
            if (Math.abs(nuevaProbabilidad - probabilidadActual) > 5) {
                await db.query(
                    'UPDATE estadisticas_senales SET probabilidad_ajustada = ? WHERE id = ?',
                    [nuevaProbabilidad, rango.id]
                );

                console.log(`  ${rango.rango_puntuacion}:`);
                console.log(`    Tasa real: ${tasaAcierto.toFixed(1)}%`);
                console.log(`    Probabilidad anterior: ${probabilidadActual}%`);
                console.log(`    Probabilidad nueva: ${nuevaProbabilidad}%`);
                console.log(`    ✅ Actualizado\n`);
            } else {
                console.log(`  ${rango.rango_puntuacion}: ${tasaAcierto.toFixed(1)}% (sin cambios)\n`);
            }
        }

        console.log('✅ Calibración completada');
    } catch (error) {
        console.error('❌ Error en calibración:', error);
    }
}

/**
 * Obtener probabilidad calibrada para una puntuación
 */
async function getProbabilidadCalibrada(puntuacion) {
    try {
        const [rangos] = await db.query(`
            SELECT probabilidad_ajustada, tasa_acierto
            FROM estadisticas_senales
            WHERE puntuacion_min <= ? AND puntuacion_max > ?
            AND total_senales >= 10
        `, [puntuacion, puntuacion]);

        if (rangos.length > 0 && rangos[0].probabilidad_ajustada > 0) {
            return rangos[0].probabilidad_ajustada;
        }

        // Si no hay datos suficientes, usar puntuación como estimación
        return Math.min(95, puntuacion);
    } catch (error) {
        console.error('Error obteniendo probabilidad calibrada:', error);
        return Math.min(95, puntuacion);
    }
}

module.exports = {
    calibrarProbabilidades,
    getProbabilidadCalibrada
};
