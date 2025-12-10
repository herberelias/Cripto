const db = require('../config/database');
const precioService = require('../services/precioService');

/**
 * Verificar señales activas y marcar resultados
 */
async function verificarSenales() {
    try {
        console.log('🔍 Iniciando verificación de señales...');

        // Obtener precio actual
        const precioActual = await precioService.getPrecioActual();
        const precio = precioActual.precio;

        // Obtener señales activas que no han sido verificadas
        const [senales] = await db.query(`
            SELECT s.* 
            FROM senales s
            LEFT JOIN resultado_senales r ON s.id = r.senal_id
            WHERE s.estado = 'activa' 
            AND r.id IS NULL
            ORDER BY s.fecha_creacion ASC
        `);

        console.log(`📊 Señales a verificar: ${senales.length}`);

        for (const senal of senales) {
            await verificarSenal(senal, precio);
        }

        // Actualizar estadísticas
        await actualizarEstadisticas();

        console.log('✅ Verificación completada');
    } catch (error) {
        console.error('❌ Error en verificarSenales:', error);
    }
}

/**
 * Verificar una señal individual
 */
async function verificarSenal(senal, precioActual) {
    try {
        let resultado = 'pendiente';
        let tipoCierre = null;
        let precioAlcanzado = null;

        // Verificar si alcanzó take profit
        if (senal.tipo === 'LONG' && precioActual >= senal.take_profit_3) {
            resultado = 'ganadora';
            tipoCierre = 'take_profit';
            precioAlcanzado = senal.take_profit_3;
        } else if (senal.tipo === 'SHORT' && precioActual <= senal.take_profit_3) {
            resultado = 'ganadora';
            tipoCierre = 'take_profit';
            precioAlcanzado = senal.take_profit_3;
        }
        // Verificar si alcanzó stop loss
        else if (senal.tipo === 'LONG' && precioActual <= senal.stop_loss) {
            resultado = 'perdedora';
            tipoCierre = 'stop_loss';
            precioAlcanzado = senal.stop_loss;
        } else if (senal.tipo === 'SHORT' && precioActual >= senal.stop_loss) {
            resultado = 'perdedora';
            tipoCierre = 'stop_loss';
            precioAlcanzado = senal.stop_loss;
        }
        // Verificar si expiró
        else if (new Date() > new Date(senal.fecha_expiracion)) {
            resultado = 'perdedora';
            tipoCierre = 'expiracion';
            precioAlcanzado = precioActual;
        }

        // Si hay resultado, guardarlo
        if (resultado !== 'pendiente') {
            await db.query(`
                INSERT INTO resultado_senales (senal_id, resultado, precio_alcanzado, tipo_cierre)
                VALUES (?, ?, ?, ?)
            `, [senal.id, resultado, precioAlcanzado, tipoCierre]);

            // Actualizar estado de la señal
            await db.query(`
                UPDATE senales 
                SET estado = 'cerrada', resultado = ?, precio_cierre = ?
                WHERE id = ?
            `, [resultado, precioAlcanzado, senal.id]);

            console.log(`${resultado === 'ganadora' ? '✅' : '❌'} Señal #${senal.id} - ${resultado.toUpperCase()} (${tipoCierre})`);
        }
    } catch (error) {
        console.error(`Error verificando señal #${senal.id}:`, error);
    }
}

/**
 * Actualizar estadísticas agregadas
 */
async function actualizarEstadisticas() {
    try {
        console.log('📊 Actualizando estadísticas...');

        // Actualizar por rango de puntuación
        const [rangos] = await db.query('SELECT * FROM estadisticas_senales');

        for (const rango of rangos) {
            const [stats] = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN r.resultado = 'ganadora' THEN 1 ELSE 0 END) as ganadoras,
                    SUM(CASE WHEN r.resultado = 'perdedora' THEN 1 ELSE 0 END) as perdedoras,
                    AVG(CASE WHEN r.resultado = 'ganadora' THEN 
                        ABS(s.precio_entrada - r.precio_alcanzado) ELSE 0 END) as ganancia_prom,
                    AVG(CASE WHEN r.resultado = 'perdedora' THEN 
                        ABS(s.precio_entrada - r.precio_alcanzado) ELSE 0 END) as perdida_prom
                FROM senales s
                INNER JOIN indicadores_senal i ON s.id = i.senal_id
                INNER JOIN resultado_senales r ON s.id = r.senal_id
                WHERE i.puntuacion_total >= ? AND i.puntuacion_total < ?
                AND r.resultado != 'pendiente'
            `, [rango.puntuacion_min, rango.puntuacion_max]);

            if (stats[0].total > 0) {
                const tasaAcierto = (stats[0].ganadoras / stats[0].total) * 100;
                const ratioRB = stats[0].perdida_prom > 0
                    ? stats[0].ganancia_prom / stats[0].perdida_prom
                    : 0;

                await db.query(`
                    UPDATE estadisticas_senales
                    SET total_senales = ?,
                        senales_ganadoras = ?,
                        senales_perdedoras = ?,
                        tasa_acierto = ?,
                        probabilidad_ajustada = ?,
                        ganancia_promedio = ?,
                        perdida_promedio = ?,
                        ratio_riesgo_beneficio = ?
                    WHERE id = ?
                `, [
                    stats[0].total,
                    stats[0].ganadoras,
                    stats[0].perdedoras,
                    tasaAcierto,
                    tasaAcierto, // Probabilidad ajustada = tasa de acierto real
                    stats[0].ganancia_prom || 0,
                    stats[0].perdida_prom || 0,
                    ratioRB,
                    rango.id
                ]);

                console.log(`  ${rango.rango_puntuacion}: ${tasaAcierto.toFixed(1)}% (${stats[0].ganadoras}/${stats[0].total})`);
            }
        }

        // Actualizar rendimiento diario
        await actualizarRendimientoDiario();

        console.log('✅ Estadísticas actualizadas');
    } catch (error) {
        console.error('Error actualizando estadísticas:', error);
    }
}

/**
 * Actualizar rendimiento diario
 */
async function actualizarRendimientoDiario() {
    const hoy = new Date().toISOString().split('T')[0];

    const [stats] = await db.query(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN r.resultado = 'ganadora' THEN 1 ELSE 0 END) as ganadoras,
            SUM(CASE WHEN r.resultado = 'perdedora' THEN 1 ELSE 0 END) as perdedoras
        FROM resultado_senales r
        WHERE DATE(r.fecha_verificacion) = ?
    `, [hoy]);

    if (stats[0].total > 0) {
        const tasaAcierto = (stats[0].ganadoras / stats[0].total) * 100;

        await db.query(`
            INSERT INTO rendimiento_diario (fecha, total_senales, senales_ganadoras, senales_perdedoras, tasa_acierto)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                total_senales = VALUES(total_senales),
                senales_ganadoras = VALUES(senales_ganadoras),
                senales_perdedoras = VALUES(senales_perdedoras),
                tasa_acierto = VALUES(tasa_acierto)
        `, [hoy, stats[0].total, stats[0].ganadoras, stats[0].perdedoras, tasaAcierto]);
    }
}

module.exports = {
    verificarSenales,
    verificarSenal,
    actualizarEstadisticas
};
