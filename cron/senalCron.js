const cron = require('node-cron');
const { generarSenal, guardarSenal, validarSenalesActivas } = require('../services/generadorSenales');
const { activarTrailingStop } = require('../services/trailingStopService');
const { analizarMercadoDinamico } = require('../services/analisisDinamicoService');
const logger = require('../utils/logger');

/**
 * Sistema Híbrido Multi-Timeframe de Generación de Señales:
 * 
 * 1. GENERACIÓN PROGRAMADA (múltiples timeframes):
 *    - 30m: Cada 30 minutos (day trading)
 *    - 1h: Cada hora (swing intraday)
 *    - 4h: Cada 4 horas (swing multiday)
 *    - Analiza velas completas (datos fiables)
 *    - Indicadores calculados correctamente
 *    - Genera señales de calidad profesional
 * 
 * 2. ANÁLISIS DINÁMICO (cada 5 minutos):
 *    - Detecta picos de volumen (>150% promedio)
 *    - Detecta movimientos de precio (>1% en 5 min)
 *    - Detecta cruces de indicadores
 *    - Detecta RSI en zonas extremas
 *    - Genera señales oportunistas en tiempo real
 *    - Sistema anti-duplicados
 * 
 * 3. MONITOREO (cada 5 minutos):
 *    - Verifica precios en tiempo real
 *    - Valida si señales activas siguen siendo válidas
 *    - Activa trailing stop loss para proteger ganancias
 *    - Puede invalidar señales si contexto cambia drásticamente
 */

/**
 * Función auxiliar para generar y guardar señal de un timeframe
 */
async function generarYGuardarSenal(timeframe) {
    try {
        logger.section(`GENERACIÓN DE SEÑALES (cierre de vela ${timeframe})`);

        const senal = await generarSenal(timeframe);

        if (senal) {
            const senalId = await guardarSenal(senal);
            logger.senal(senal.tipo, `Nueva señal ${timeframe} guardada con ID: ${senalId}`);
            logger.info(`Probabilidad: ${senal.probabilidad}% | R:B: ${senal.ratioRB}`);
            logger.info(`Entrada: $${senal.precioEntrada} | SL: $${senal.stopLoss} | TP3: $${senal.takeProfit3}`);
        } else {
            logger.info(`No se generó señal ${timeframe} (criterios no cumplidos)`);
        }

    } catch (error) {
        logger.error(`Error en generación de señales ${timeframe}:`, error);
    }
}

function iniciarCronSenales() {
    logger.section('🚀 SISTEMA DE SEÑALES MULTI-TIMEFRAME INICIADO');
    logger.info('📊 Generación 30m: cada 30 minutos');
    logger.info('📊 Generación 1h: cada hora');
    logger.info('📊 Generación 4h: cada 4 horas');
    logger.info('🔍 Análisis dinámico: cada 5 minutos');
    logger.info('👁️  Monitoreo: cada 5 minutos');
    logger.info('🔄 Trailing Stop: automático en ganancias');

    // GENERACIÓN 30 MINUTOS: Cada 30 minutos (minuto 0 y 30)
    cron.schedule('0,30 * * * *', async () => {
        await generarYGuardarSenal('30m');
    });

    // GENERACIÓN 1 HORA: Cada hora al cierre de vela (minuto 0)
    cron.schedule('0 * * * *', async () => {
        await generarYGuardarSenal('1h');
    });

    // GENERACIÓN 4 HORAS: Cada 4 horas (minuto 0 de las horas 0, 4, 8, 12, 16, 20)
    cron.schedule('0 */4 * * *', async () => {
        await generarYGuardarSenal('4h');
    });

    // MONITOREO + ANÁLISIS DINÁMICO: Cada 5 minutos
    cron.schedule('*/5 * * * *', async () => {
        try {
            // 1. Análisis dinámico del mercado (detecta oportunidades)
            await analizarMercadoDinamico();


            // 2. Validar que las señales activas sigan siendo válidas
            await validarSenalesActivas();


            // 3. Activar trailing stop para señales en ganancia
            await activarTrailingStop();

        } catch (error) {
            logger.error('Error en monitoreo y análisis dinámico:', error);
        }
    });
}

module.exports = { iniciarCronSenales };
