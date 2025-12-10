const cron = require('node-cron');
const { calibrarProbabilidades } = require('../services/calibracionService');
const logger = require('../utils/logger');

/**
 * Cron job para calibrar probabilidades cada semana
 * Ejecuta los domingos a las 00:00
 */
function iniciarCalibracionCron() {
    // Ejecutar cada domingo a medianoche
    cron.schedule('0 0 * * 0', async () => {
        logger.section('CALIBRACIÓN SEMANAL DE PROBABILIDADES');
        try {
            await calibrarProbabilidades();
        } catch (error) {
            logger.error('Error en calibración:', error);
        }
    });

    logger.info('✅ Calibración iniciada (domingos a las 00:00)');
}

module.exports = { iniciarCalibracionCron };
