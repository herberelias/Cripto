const cron = require('node-cron');
const { verificarSenales } = require('../services/verificacionService');
const logger = require('../utils/logger');

/**
 * Cron job para verificar señales cada 10 minutos
 * Verifica si alcanzaron TP1, TP2, TP3 o Stop Loss
 */
function iniciarVerificacionCron() {
    // Ejecutar cada 10 minutos
    cron.schedule('*/10 * * * *', async () => {
        logger.debug('Verificando resultados de señales activas...');
        try {
            await verificarSenales();
        } catch (error) {
            logger.error('Error en verificación de señales:', error);
        }
    });

    logger.info('✅ Verificación de señales iniciada (cada 10 minutos)');
}

module.exports = { iniciarVerificacionCron };
