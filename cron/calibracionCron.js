const cron = require('node-cron');
const { calibrarProbabilidades } = require('../services/calibracionService');

/**
 * Cron job para calibrar probabilidades cada semana
 * Ejecuta los domingos a las 00:00
 */
function iniciarCalibracionCron() {
    // Ejecutar cada domingo a medianoche
    cron.schedule('0 0 * * 0', async () => {
        console.log('⏰ Ejecutando calibración semanal de probabilidades...');
        try {
            await calibrarProbabilidades();
        } catch (error) {
            console.error('Error en cron de calibración:', error);
        }
    });

    console.log('✅ Cron de calibración iniciado (domingos a las 00:00)');
}

module.exports = { iniciarCalibracionCron };
