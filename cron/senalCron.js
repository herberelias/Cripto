const cron = require('node-cron');
const { generarSenal, guardarSenal } = require('../services/generadorSenales');

// Ejecutar cada 30 segundos
function iniciarCronSenales() {
    console.log('🔄 Cron de señales iniciado - Se ejecutará cada 30 segundos');

    cron.schedule('*/30 * * * * *', async () => {
        try {
            console.log('⏰ Ejecutando análisis de señales...');

            const senal = await generarSenal('1h');

            if (senal) {
                const senalId = await guardarSenal(senal);
                console.log(`✅ Nueva señal ${senal.tipo} guardada con ID: ${senalId}`);
            } else {
                console.log('ℹ️  No se generó señal en este ciclo');
            }

        } catch (error) {
            console.error('❌ Error en cron de señales:', error.message);
        }
    });
}

module.exports = { iniciarCronSenales };
