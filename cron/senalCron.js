const cron = require('node-cron');
const { generarSenal, guardarSenal, validarSenalesActivas } = require('../services/generadorSenales');
const { activarTrailingStop } = require('../services/trailingStopService');
const logger = require('../utils/logger');

/**
 * Sistema Híbrido Avanzado de Generación de Señales:
 * 
 * 1. GENERACIÓN (cada 1 hora al cierre de vela):
 *    - Analiza velas completas (datos fiables)
 *    - Indicadores calculados correctamente
 *    - Genera señales de calidad profesional
 * 
 * 2. MONITOREO (cada 5 minutos):
 *    - Verifica precios en tiempo real
 *    - Valida si señales activas siguen siendo válidas
 *    - Activa trailing stop loss para proteger ganancias
 *    - Puede invalidar señales si contexto cambia drásticamente
 */
function iniciarCronSenales() {
    logger.section('🚀 SISTEMA DE SEÑALES INICIADO');
    logger.info('📊 Generación: cada 1 hora (minuto 0)');
    logger.info('👁️  Monitoreo: cada 5 minutos');
    logger.info('🔄 Trailing Stop: automático en ganancias');

    // GENERACIÓN: Cada hora al cierre de vela
    cron.schedule('0 * * * *', async () => {
        try {
            logger.section('GENERACIÓN DE SEÑALES (cierre de vela 1h)');

            const senal = await generarSenal('1h');

            if (senal) {
                const senalId = await guardarSenal(senal);
                logger.senal(senal.tipo, `Nueva señal guardada con ID: ${senalId}`);
                logger.info(`Probabilidad: ${senal.probabilidad}% | R:B: ${senal.ratioRB}`);
                logger.info(`Entrada: $${senal.precioEntrada} | SL: $${senal.stopLoss} | TP3: $${senal.takeProfit3}`);
            } else {
                logger.info('No se generó señal (criterios no cumplidos)');
            }

        } catch (error) {
            logger.error('Error en generación de señales:', error);
        }
    });

    // MONITOREO: Cada 5 minutos (validación + trailing stop)
    cron.schedule('*/5 * * * *', async () => {
        try {
            logger.debug('Monitoreo: validando señales activas y trailing stop...');
            
            // Validar que las señales activas sigan siendo válidas
            await validarSenalesActivas();
            
            // Activar trailing stop para señales en ganancia
            await activarTrailingStop();

        } catch (error) {
            logger.error('Error en monitoreo de señales:', error);
        }
    });
}

module.exports = { iniciarCronSenales };
