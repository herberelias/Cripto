const db = require('../config/database');
const precioService = require('./precioService');
const logger = require('../utils/logger');

/**
 * Sistema de Trailing Stop Loss Dinámico
 * Mueve el stop loss a medida que el precio se mueve a favor
 */

/**
 * Activar trailing stop para señales en ganancia
 */
async function activarTrailingStop() {
    try {
        const precioActual = await precioService.getPrecioActual();
        const precio = precioActual.precio;

        // Obtener señales activas que han alcanzado al menos TP1
        const [senales] = await db.query(`
            SELECT s.* 
            FROM senales s
            WHERE s.estado = 'activa'
            AND (
                (s.tipo = 'LONG' AND ? >= s.take_profit_1) OR
                (s.tipo = 'SHORT' AND ? <= s.take_profit_1)
            )
        `, [precio, precio]);

        for (const senal of senales) {
            await ajustarTrailingStop(senal, precio);
        }

        if (senales.length > 0) {
            logger.debug(`Trailing stop revisado para ${senales.length} señales`);
        }

    } catch (error) {
        logger.error('Error en trailing stop:', error);
    }
}

/**
 * Ajustar trailing stop de una señal individual
 */
async function ajustarTrailingStop(senal, precioActual) {
    try {
        // Calcular ATR aproximado basado en distancia entre entrada y TP
        const distanciaTP1 = Math.abs(senal.take_profit_1 - senal.precio_entrada);
        const atrEstimado = distanciaTP1 / 2; // TP1 suele ser ATR * 2

        let nuevoStopLoss = senal.stop_loss;
        let debeActualizar = false;

        if (senal.tipo === 'LONG') {
            // Trailing stop para LONG: mover SL hacia arriba
            // Nuevo SL = Precio actual - (ATR * 1.5)
            const stopPropuesto = precioActual - (atrEstimado * 1.5);
            
            // Solo mover si es mejor que el actual (más alto)
            if (stopPropuesto > senal.stop_loss && stopPropuesto < precioActual) {
                nuevoStopLoss = stopPropuesto;
                debeActualizar = true;
            }
        } else {
            // Trailing stop para SHORT: mover SL hacia abajo
            // Nuevo SL = Precio actual + (ATR * 1.5)
            const stopPropuesto = precioActual + (atrEstimado * 1.5);
            
            // Solo mover si es mejor que el actual (más bajo)
            if (stopPropuesto < senal.stop_loss && stopPropuesto > precioActual) {
                nuevoStopLoss = stopPropuesto;
                debeActualizar = true;
            }
        }

        if (debeActualizar) {
            await db.query(`
                UPDATE senales 
                SET stop_loss = ?,
                    notas = CONCAT(COALESCE(notas, ''), ' | Trailing SL: ${parseFloat(nuevoStopLoss.toFixed(2))}')
                WHERE id = ?
            `, [parseFloat(nuevoStopLoss.toFixed(2)), senal.id]);

            logger.info(`🔄 Trailing Stop actualizado - Señal #${senal.id} ${senal.tipo}`);
            logger.debug(`   SL anterior: $${senal.stop_loss} → Nuevo SL: $${nuevoStopLoss.toFixed(2)}`);
        }

    } catch (error) {
        logger.error(`Error ajustando trailing stop para señal #${senal.id}:`, error);
    }
}

/**
 * Calcular nivel de breakeven (punto de equilibrio)
 * Mover SL a precio de entrada cuando alcanza cierto profit
 */
async function moverABreakeven(senal, precioActual) {
    try {
        // Solo aplicar si ya alcanzó cierto profit (ej: 50% del camino a TP1)
        const distanciaATP1 = senal.tipo === 'LONG' 
            ? senal.take_profit_1 - senal.precio_entrada
            : senal.precio_entrada - senal.take_profit_1;
        
        const progresoActual = senal.tipo === 'LONG'
            ? precioActual - senal.precio_entrada
            : senal.precio_entrada - precioActual;
        
        const porcentajeProgreso = (progresoActual / distanciaATP1) * 100;

        // Si alcanzó 50% del camino a TP1, mover SL a breakeven
        if (porcentajeProgreso >= 50) {
            const breakeven = senal.precio_entrada;
            
            // Verificar que sea una mejora del SL actual
            const esMejora = senal.tipo === 'LONG' 
                ? breakeven > senal.stop_loss
                : breakeven < senal.stop_loss;
            
            if (esMejora) {
                await db.query(`
                    UPDATE senales 
                    SET stop_loss = ?,
                        notas = CONCAT(COALESCE(notas, ''), ' | Movido a Breakeven')
                    WHERE id = ?
                `, [breakeven, senal.id]);

                logger.success(`🎯 Breakeven activado - Señal #${senal.id} ${senal.tipo}`);
                logger.debug(`   Riesgo eliminado: SL en precio de entrada ($${breakeven})`);
            }
        }

    } catch (error) {
        logger.error(`Error moviendo a breakeven señal #${senal.id}:`, error);
    }
}

module.exports = {
    activarTrailingStop,
    ajustarTrailingStop,
    moverABreakeven
};
