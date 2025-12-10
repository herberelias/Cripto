const precioService = require('../services/precioService');
const indicadorService = require('../services/indicadorService');
const fs = require('fs');
const path = require('path');

/**
 * Script de Backtesting
 * Simula señales en datos históricos para validar el algoritmo
 */

// Configuración
const MESES_HISTORICOS = 3;
const TIMEFRAME = '1h';
const UMBRAL_PUNTUACION = 30;
const RAZONES_MINIMAS = 1;

// Resultados
const resultados = {
    totalSenales: 0,
    senalesGanadoras: 0,
    senalesPerdedoras: 0,
    porRango: {},
    porTipo: { LONG: { total: 0, ganadoras: 0 }, SHORT: { total: 0, ganadoras: 0 } },
    mejorSenal: null,
    peorSenal: null,
    detalles: []
};

/**
 * Simular una señal en datos históricos
 */
function simularSenal(velas, indiceActual, indicadores) {
    const velaActual = velas[indiceActual];
    const precioEntrada = velaActual.close;

    // Determinar tipo de señal basado en indicadores
    let tipoSenal = null;
    let puntuacion = 0;
    let razonesLong = [];
    let razonesShort = [];

    // RSI
    if (indicadores.rsi < 30) {
        razonesLong.push('RSI sobreventa');
        puntuacion += 15;
    } else if (indicadores.rsi > 70) {
        razonesShort.push('RSI sobrecompra');
        puntuacion += 15;
    }

    // MACD
    if (indicadores.macd > indicadores.macdSignal && indicadores.macd > 0) {
        razonesLong.push('MACD alcista');
        puntuacion += 10;
    } else if (indicadores.macd < indicadores.macdSignal && indicadores.macd < 0) {
        razonesShort.push('MACD bajista');
        puntuacion += 10;
    }

    // EMAs
    if (indicadores.ema20 > indicadores.ema50 && indicadores.ema50 > indicadores.ema200) {
        razonesLong.push('EMAs alineadas alcista');
        puntuacion += 15;
    } else if (indicadores.ema20 < indicadores.ema50 && indicadores.ema50 < indicadores.ema200) {
        razonesShort.push('EMAs alineadas bajista');
        puntuacion += 15;
    }

    // Precio vs EMAs
    if (precioEntrada <= indicadores.ema200) {
        razonesLong.push('Precio en soporte EMA200');
        puntuacion += 10;
    } else if (precioEntrada >= indicadores.ema200 * 1.05) {
        razonesShort.push('Precio en resistencia');
        puntuacion += 10;
    }

    // Determinar tipo
    if (razonesLong.length > razonesShort.length && puntuacion >= UMBRAL_PUNTUACION) {
        tipoSenal = 'LONG';
    } else if (razonesShort.length > razonesLong.length && puntuacion >= UMBRAL_PUNTUACION) {
        tipoSenal = 'SHORT';
    }

    if (!tipoSenal || (tipoSenal === 'LONG' ? razonesLong : razonesShort).length < RAZONES_MINIMAS) {
        return null;
    }

    // Calcular SL y TP usando ATR
    const atr = indicadores.atr || (velaActual.high - velaActual.low);
    const stopLoss = tipoSenal === 'LONG'
        ? precioEntrada - (atr * 2)
        : precioEntrada + (atr * 2);
    const takeProfit = tipoSenal === 'LONG'
        ? precioEntrada + (atr * 5)
        : precioEntrada - (atr * 5);

    return {
        tipo: tipoSenal,
        precioEntrada,
        stopLoss,
        takeProfit,
        puntuacion,
        razones: tipoSenal === 'LONG' ? razonesLong : razonesShort,
        indicadores
    };
}

/**
 * Verificar resultado de la señal en velas futuras
 */
function verificarResultado(senal, velasFuturas) {
    for (const vela of velasFuturas) {
        if (senal.tipo === 'LONG') {
            // Verificar TP
            if (vela.high >= senal.takeProfit) {
                return {
                    resultado: 'ganadora',
                    precioSalida: senal.takeProfit,
                    ganancia: senal.takeProfit - senal.precioEntrada
                };
            }
            // Verificar SL
            if (vela.low <= senal.stopLoss) {
                return {
                    resultado: 'perdedora',
                    precioSalida: senal.stopLoss,
                    ganancia: senal.stopLoss - senal.precioEntrada
                };
            }
        } else { // SHORT
            // Verificar TP
            if (vela.low <= senal.takeProfit) {
                return {
                    resultado: 'ganadora',
                    precioSalida: senal.takeProfit,
                    ganancia: senal.precioEntrada - senal.takeProfit
                };
            }
            // Verificar SL
            if (vela.high >= senal.stopLoss) {
                return {
                    resultado: 'perdedora',
                    precioSalida: senal.stopLoss,
                    ganancia: senal.precioEntrada - senal.stopLoss
                };
            }
        }
    }

    // Si no alcanzó ni TP ni SL, considerar perdedora
    return {
        resultado: 'perdedora',
        precioSalida: velasFuturas[velasFuturas.length - 1].close,
        ganancia: senal.tipo === 'LONG'
            ? velasFuturas[velasFuturas.length - 1].close - senal.precioEntrada
            : senal.precioEntrada - velasFuturas[velasFuturas.length - 1].close
    };
}

/**
 * Ejecutar backtesting
 */
async function ejecutarBacktesting() {
    console.log('🔍 Iniciando Backtesting Histórico...\n');
    console.log(`📅 Período: ${MESES_HISTORICOS} meses`);
    console.log(`⏱️  Timeframe: ${TIMEFRAME}`);
    console.log(`📊 Umbral puntuación: ${UMBRAL_PUNTUACION}`);
    console.log(`📝 Razones mínimas: ${RAZONES_MINIMAS}\n`);

    try {
        // Obtener datos históricos
        const limite = MESES_HISTORICOS * 30 * 24; // Aproximado para 1h
        console.log(`📥 Obteniendo ${limite} velas históricas...`);

        const velas = await precioService.getVelas('BTC', TIMEFRAME, limite);
        console.log(`✅ ${velas.length} velas obtenidas\n`);

        // Simular señales
        console.log('🎯 Simulando señales...\n');

        for (let i = 200; i < velas.length - 100; i++) {
            // Calcular indicadores
            const velasParaIndicadores = velas.slice(i - 200, i + 1);
            const indicadores = await indicadorService.calcularIndicadores(velasParaIndicadores);

            // Simular señal
            const senal = simularSenal(velas, i, indicadores);

            if (senal) {
                // Verificar resultado en las próximas 100 velas
                const velasFuturas = velas.slice(i + 1, i + 101);
                const resultado = verificarResultado(senal, velasFuturas);

                // Registrar resultado
                resultados.totalSenales++;
                if (resultado.resultado === 'ganadora') {
                    resultados.senalesGanadoras++;
                } else {
                    resultados.senalesPerdedoras++;
                }

                // Por tipo
                resultados.porTipo[senal.tipo].total++;
                if (resultado.resultado === 'ganadora') {
                    resultados.porTipo[senal.tipo].ganadoras++;
                }

                // Por rango
                const rango = `${Math.floor(senal.puntuacion / 10) * 10}-${Math.floor(senal.puntuacion / 10) * 10 + 10}`;
                if (!resultados.porRango[rango]) {
                    resultados.porRango[rango] = { total: 0, ganadoras: 0 };
                }
                resultados.porRango[rango].total++;
                if (resultado.resultado === 'ganadora') {
                    resultados.porRango[rango].ganadoras++;
                }

                // Mejor/peor señal
                if (!resultados.mejorSenal || resultado.ganancia > resultados.mejorSenal.ganancia) {
                    resultados.mejorSenal = { ...senal, ...resultado };
                }
                if (!resultados.peorSenal || resultado.ganancia < resultados.peorSenal.ganancia) {
                    resultados.peorSenal = { ...senal, ...resultado };
                }

                // Guardar detalle
                resultados.detalles.push({
                    fecha: new Date(velas[i].time * 1000).toISOString(),
                    tipo: senal.tipo,
                    puntuacion: senal.puntuacion,
                    precioEntrada: senal.precioEntrada,
                    precioSalida: resultado.precioSalida,
                    ganancia: resultado.ganancia,
                    resultado: resultado.resultado
                });

                // Progreso
                if (resultados.totalSenales % 10 === 0) {
                    const tasaAcierto = (resultados.senalesGanadoras / resultados.totalSenales * 100).toFixed(1);
                    console.log(`📊 Señales simuladas: ${resultados.totalSenales} | Tasa acierto: ${tasaAcierto}%`);
                }
            }
        }

        // Generar reporte
        generarReporte();

    } catch (error) {
        console.error('❌ Error en backtesting:', error);
    }
}

/**
 * Generar reporte de resultados
 */
function generarReporte() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPORTE DE BACKTESTING');
    console.log('='.repeat(60) + '\n');

    // Estadísticas globales
    const tasaAcierto = (resultados.senalesGanadoras / resultados.totalSenales * 100).toFixed(2);
    console.log('📈 ESTADÍSTICAS GLOBALES:');
    console.log(`   Total señales: ${resultados.totalSenales}`);
    console.log(`   Ganadoras: ${resultados.senalesGanadoras}`);
    console.log(`   Perdedoras: ${resultados.senalesPerdedoras}`);
    console.log(`   Tasa de acierto: ${tasaAcierto}%`);
    console.log('');

    // Por tipo
    console.log('📊 POR TIPO:');
    for (const [tipo, stats] of Object.entries(resultados.porTipo)) {
        if (stats.total > 0) {
            const tasa = (stats.ganadoras / stats.total * 100).toFixed(2);
            console.log(`   ${tipo}: ${stats.ganadoras}/${stats.total} (${tasa}%)`);
        }
    }
    console.log('');

    // Por rango
    console.log('📊 POR RANGO DE PUNTUACIÓN:');
    for (const [rango, stats] of Object.entries(resultados.porRango)) {
        const tasa = (stats.ganadoras / stats.total * 100).toFixed(2);
        console.log(`   ${rango}: ${stats.ganadoras}/${stats.total} (${tasa}%)`);
    }
    console.log('');

    // Mejor/peor
    if (resultados.mejorSenal) {
        console.log('🏆 MEJOR SEÑAL:');
        console.log(`   Tipo: ${resultados.mejorSenal.tipo}`);
        console.log(`   Ganancia: $${resultados.mejorSenal.ganancia.toFixed(2)}`);
        console.log('');
    }

    if (resultados.peorSenal) {
        console.log('💔 PEOR SEÑAL:');
        console.log(`   Tipo: ${resultados.peorSenal.tipo}`);
        console.log(`   Pérdida: $${resultados.peorSenal.ganancia.toFixed(2)}`);
        console.log('');
    }

    // Guardar reporte en JSON
    const reportePath = path.join(__dirname, '../reports/backtesting_report.json');
    const reporteDir = path.dirname(reportePath);

    if (!fs.existsSync(reporteDir)) {
        fs.mkdirSync(reporteDir, { recursive: true });
    }

    fs.writeFileSync(reportePath, JSON.stringify({
        fecha: new Date().toISOString(),
        configuracion: {
            mesesHistoricos: MESES_HISTORICOS,
            timeframe: TIMEFRAME,
            umbralPuntuacion: UMBRAL_PUNTUACION,
            razonesMinimas: RAZONES_MINIMAS
        },
        resultados: {
            totalSenales: resultados.totalSenales,
            senalesGanadoras: resultados.senalesGanadoras,
            senalesPerdedoras: resultados.senalesPerdedoras,
            tasaAcierto: parseFloat(tasaAcierto),
            porTipo: resultados.porTipo,
            porRango: resultados.porRango,
            mejorSenal: resultados.mejorSenal,
            peorSenal: resultados.peorSenal
        },
        detalles: resultados.detalles
    }, null, 2));

    console.log(`💾 Reporte guardado en: ${reportePath}`);
    console.log('\n' + '='.repeat(60));
}

// Ejecutar
ejecutarBacktesting().then(() => {
    console.log('\n✅ Backtesting completado');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});
