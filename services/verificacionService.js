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

        // Obtener señales activas que no han sido verificadas y no han expirado con error
        const [senales] = await db.query(`
            SELECT s.* 
            FROM senales s
            LEFT JOIN resultado_senales r ON s.id = r.senal_id
            WHERE s.estado = 'activa' 
            AND r.id IS NULL
            AND s.fecha_expiracion > NOW()
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
 * Verificar una señal individual con salida parcial escalonada
 */
async function verificarSenal(senal, precioActual) {
    try {
        let resultado = 'pendiente';
        let tipoCierre = null;
        let precioAlcanzado = null;
        let porcentajeCerrado = 0;
        let gananciaParcial = 0;

        // Sistema de salida parcial escalonada (más realista)
        if (senal.tipo === 'LONG') {
            // TP3 - Cerrar 100% (objetivo completo)
            if (precioActual >= senal.take_profit_3) {
                resultado = 'ganancia';
                tipoCierre = 'take_profit';
                precioAlcanzado = senal.take_profit_3;
                porcentajeCerrado = 100;
                gananciaParcial = ((senal.take_profit_3 - senal.precio_entrada) / senal.precio_entrada * 100);
            }
            // TP2 - Cerrar 60% adicional (90% total)
            else if (precioActual >= senal.take_profit_2) {
                resultado = 'ganancia';
                tipoCierre = 'take_profit';
                precioAlcanzado = senal.take_profit_2;
                porcentajeCerrado = 90;
                gananciaParcial = ((senal.take_profit_2 - senal.precio_entrada) / senal.precio_entrada * 100) * 0.9;
            }
            // TP1 - Cerrar 30% (asegurar ganancias)
            else if (precioActual >= senal.take_profit_1) {
                resultado = 'ganancia';
                tipoCierre = 'take_profit';
                precioAlcanzado = senal.take_profit_1;
                porcentajeCerrado = 30;
                gananciaParcial = ((senal.take_profit_1 - senal.precio_entrada) / senal.precio_entrada * 100) * 0.3;
            }
            // Stop Loss
            else if (precioActual <= senal.stop_loss) {
                resultado = 'perdida';
                tipoCierre = 'stop_loss';
                precioAlcanzado = senal.stop_loss;
                porcentajeCerrado = 100;
                gananciaParcial = ((senal.stop_loss - senal.precio_entrada) / senal.precio_entrada * 100);
            }
        } else { // SHORT
            // TP3 - Cerrar 100%
            if (precioActual <= senal.take_profit_3) {
                resultado = 'ganancia';
                tipoCierre = 'take_profit';
                precioAlcanzado = senal.take_profit_3;
                porcentajeCerrado = 100;
                gananciaParcial = ((senal.precio_entrada - senal.take_profit_3) / senal.precio_entrada * 100);
            }
            // TP2 - Cerrar 60% adicional
            else if (precioActual <= senal.take_profit_2) {
                resultado = 'ganancia';
                tipoCierre = 'take_profit';
                precioAlcanzado = senal.take_profit_2;
                porcentajeCerrado = 90;
                gananciaParcial = ((senal.precio_entrada - senal.take_profit_2) / senal.precio_entrada * 100) * 0.9;
            }
            // TP1 - Cerrar 30%
            else if (precioActual <= senal.take_profit_1) {
                resultado = 'ganancia';
                tipoCierre = 'take_profit';
                precioAlcanzado = senal.take_profit_1;
                porcentajeCerrado = 30;
                gananciaParcial = ((senal.precio_entrada - senal.take_profit_1) / senal.precio_entrada * 100) * 0.3;
            }
            // Stop Loss
            else if (precioActual >= senal.stop_loss) {
                resultado = 'perdida';
                tipoCierre = 'stop_loss';
                precioAlcanzado = senal.stop_loss;
                porcentajeCerrado = 100;
                gananciaParcial = ((senal.precio_entrada - senal.stop_loss) / senal.precio_entrada * 100);
            }
        }

        // Verificar si expiró
        if (resultado === 'pendiente' && new Date() > new Date(senal.fecha_expiracion)) {
            resultado = 'perdida';
            tipoCierre = 'expiracion';
            precioAlcanzado = precioActual;
            porcentajeCerrado = 100;
            gananciaParcial = senal.tipo === 'LONG' ?
                ((precioActual - senal.precio_entrada) / senal.precio_entrada * 100) :
                ((senal.precio_entrada - precioActual) / senal.precio_entrada * 100);
        }

        // Si hay resultado, guardarlo
        if (resultado !== 'pendiente') {
            try {
                // Convertir valores para tabla resultado_senales (usa 'ganadora'/'perdedora')
                const resultadoParaTabla = resultado === 'ganancia' ? 'ganadora' :
                    resultado === 'perdida' ? 'perdedora' :
                        'pendiente';

                await db.query(`
                    INSERT INTO resultado_senales (senal_id, resultado, precio_alcanzado, tipo_cierre)
                    VALUES (?, ?, ?, ?)
                `, [senal.id, resultadoParaTabla, precioAlcanzado, tipoCierre]);

                // Actualizar estado de la señal (tabla senales usa 'ganancia'/'perdida')
                await db.query(`
                    UPDATE senales 
                    SET estado = 'cerrada', resultado = ?, precio_cierre = ?
                    WHERE id = ?
                `, [resultado, precioAlcanzado, senal.id]);

                const emoji = resultado === 'ganancia' ? '✅' : '❌';
                const signo = gananciaParcial >= 0 ? '+' : '';
                console.log(`${emoji} Señal #${senal.id} ${senal.tipo} - ${resultado.toUpperCase()}`);
                console.log(`   ${tipoCierre} | Cerrado: ${porcentajeCerrado}% | Ganancia: ${signo}${gananciaParcial.toFixed(2)}%`);
            } catch (insertError) {
                // Si falla el INSERT (señal ya procesada o error de ENUM), cerrar la señal silenciosamente
                console.log(`⚠️ Señal #${senal.id} ya procesada o con error, cerrando...`);
                await db.query(`
                    UPDATE senales 
                    SET estado = 'cerrada'
                    WHERE id = ?
                `, [senal.id]);
            }
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

/**
 * Calcular tamaño de posición basado en gestión de riesgo
 * @param {number} capitalTotal - Capital total disponible
 * @param {number} riesgoPorOperacion - % de capital a arriesgar (default 1-2%)
 * @param {number} precioEntrada - Precio de entrada
 * @param {number} stopLoss - Precio de stop loss
 * @returns {object} - Tamaño de posición y datos relacionados
 */
function calcularPositionSize(capitalTotal, riesgoPorOperacion, precioEntrada, stopLoss) {
    // Calcular cuánto dinero estamos dispuestos a perder
    const dineroEnRiesgo = capitalTotal * (riesgoPorOperacion / 100);

    // Calcular cuánto perdemos por unidad
    const perdidaPorUnidad = Math.abs(precioEntrada - stopLoss);

    // Calcular cuántas unidades comprar
    const unidades = dineroEnRiesgo / perdidaPorUnidad;

    // Calcular inversión total
    const inversionTotal = unidades * precioEntrada;

    // Validar que no excedamos el capital
    const porcentajeCapital = (inversionTotal / capitalTotal) * 100;

    return {
        unidades: parseFloat(unidades.toFixed(8)),
        inversionTotal: parseFloat(inversionTotal.toFixed(2)),
        dineroEnRiesgo: parseFloat(dineroEnRiesgo.toFixed(2)),
        porcentajeCapital: parseFloat(porcentajeCapital.toFixed(2)),
        perdidaPorUnidad: parseFloat(perdidaPorUnidad.toFixed(2)),
        valido: inversionTotal <= capitalTotal
    };
}

module.exports = {
    verificarSenales,
    verificarSenal,
    actualizarEstadisticas,
    calcularPositionSize
};
