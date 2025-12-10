const cron = require('node-cron');
const { verificarSenales } = require('../services/verificacionService');

/**
 * Cron job para verificar señales cada hora
 * Ejecuta a los minutos 5, 15, 25, 35, 45, 55 de cada hora
 */
function iniciarVerificacionCron() {
    // Ejecutar cada 10 minutos
    cron.schedule('*/10 * * * *', async () => {
        console.log('⏰ Ejecutando verificación de señales...');
        try {
            await verificarSenales();
        } catch (error) {
            console.error('Error en cron de verificación:', error);
        }
    });

    console.log('✅ Cron de verificación de señales iniciado (cada 10 minutos)');
}

module.exports = { iniciarVerificacionCron };
