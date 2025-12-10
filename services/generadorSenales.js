const db = require('../config/database');
const precioService = require('./precioService');
const indicadorService = require('./indicadorService');

// Generar señal basada en indicadores técnicos
async function generarSenal(timeframe = '1h') {
    try {
        // Obtener velas históricas
        const velas = await precioService.getVelas('BTC', timeframe, 200);

        if (velas.length < 200) {
            console.log('No hay suficientes datos para análisis');
            return null;
        }

        // Calcular indicadores
        const indicadores = indicadorService.calcularIndicadores(velas);

        // Sistema de puntuación
        let puntuacion = 0;
        let razonesLong = [];
        let razonesShort = [];

        // 1. RSI (20 puntos)
        if (indicadores.rsi < 30) {
            puntuacion += 20;
            razonesLong.push(`RSI en sobreventa (${indicadores.rsi.toFixed(2)})`);
        } else if (indicadores.rsi > 70) {
            puntuacion += 20;
            razonesShort.push(`RSI en sobrecompra (${indicadores.rsi.toFixed(2)})`);
        }

        // 2. MACD (15 puntos)
        if (indicadores.macd && indicadores.macdSignal) {
            if (indicadores.macd > indicadores.macdSignal && indicadores.macdHistogram > 0) {
                puntuacion += 15;
                razonesLong.push('MACD cruce alcista');
            } else if (indicadores.macd < indicadores.macdSignal && indicadores.macdHistogram < 0) {
                puntuacion += 15;
                razonesShort.push('MACD cruce bajista');
            }
        }

        // 3. EMAs (20 puntos)
        const precioActual = indicadores.precioActual;
        if (precioActual > indicadores.ema20 && indicadores.ema20 > indicadores.ema50) {
            puntuacion += 20;
            razonesLong.push('Precio sobre EMAs (tendencia alcista)');
        } else if (precioActual < indicadores.ema20 && indicadores.ema20 < indicadores.ema50) {
            puntuacion += 20;
            razonesShort.push('Precio bajo EMAs (tendencia bajista)');
        }

        // 4. Soporte/Resistencia en EMA 200 (15 puntos)
        const distanciaEMA200 = Math.abs(precioActual - indicadores.ema200) / precioActual * 100;
        if (distanciaEMA200 < 1) { // Precio cerca de EMA 200
            puntuacion += 15;
            if (precioActual > indicadores.ema200) {
                razonesLong.push('Precio rebotando en EMA 200 (soporte)');
            } else {
                razonesShort.push('Precio rechazado en EMA 200 (resistencia)');
            }
        }

        // 5. Bandas de Bollinger (10 puntos)
        if (indicadores.bollingerInferior && precioActual <= indicadores.bollingerInferior) {
            puntuacion += 10;
            razonesLong.push('Precio en banda inferior de Bollinger');
        } else if (indicadores.bollingerSuperior && precioActual >= indicadores.bollingerSuperior) {
            puntuacion += 10;
            razonesShort.push('Precio en banda superior de Bollinger');
        }

        // 6. Volumen (10 puntos)
        if (indicadores.volumenActual > indicadores.volumenPromedio * 1.3) {
            puntuacion += 10;
            razonesLong.push(`Volumen alto (${((indicadores.volumenActual / indicadores.volumenPromedio - 1) * 100).toFixed(0)}% sobre promedio)`);
            razonesShort.push(`Volumen alto (${((indicadores.volumenActual / indicadores.volumenPromedio - 1) * 100).toFixed(0)}% sobre promedio)`);
        }

        // 7. Análisis de Volumen (15 puntos)
        const volumenPromedio = velas.slice(-20).reduce((sum, v) => sum + v.volumeto, 0) / 20;
        const volumenActual = velas[velas.length - 1].volumeto;
        const volumenRelativo = volumenActual / volumenPromedio;

        if (volumenRelativo > 1.5) {
            puntuacion += 15;
            if (velas[velas.length - 1].close > velas[velas.length - 1].open) {
                razonesLong.push('Volumen alcista fuerte');
            } else {
                razonesShort.push('Volumen bajista fuerte');
            }
        }

        // 8. Patrones de velas mejorados (15 puntos)
        const ultimaVela = velas[velas.length - 1];
        const penultimaVela = velas[velas.length - 2];
        const terceraVela = velas[velas.length - 3];

        const cuerpoUltima = Math.abs(ultimaVela.close - ultimaVela.open);
        const mechaSupUltima = ultimaVela.high - Math.max(ultimaVela.open, ultimaVela.close);
        const mechaInfUltima = Math.min(ultimaVela.open, ultimaVela.close) - ultimaVela.low;

        // Martillo alcista (mecha inferior larga, cuerpo pequeño arriba)
        if (mechaInfUltima > 2 * cuerpoUltima && mechaSupUltima < cuerpoUltima * 0.5) {
            puntuacion += 15;
            razonesLong.push('Patrón martillo alcista');
        }

        // Estrella fugaz bajista (mecha superior larga, cuerpo pequeño abajo)
        if (mechaSupUltima > 2 * cuerpoUltima && mechaInfUltima < cuerpoUltima * 0.5) {
            puntuacion += 15;
            razonesShort.push('Patrón estrella fugaz bajista');
        }

        // Envolvente alcista
        if (penultimaVela.close < penultimaVela.open && // Vela bajista
            ultimaVela.close > ultimaVela.open && // Vela alcista
            ultimaVela.open < penultimaVela.close &&
            ultimaVela.close > penultimaVela.open) {
            puntuacion += 15;
            razonesLong.push('Patrón envolvente alcista');
        }

        // Envolvente bajista
        if (penultimaVela.close > penultimaVela.open && // Vela alcista
            ultimaVela.close < ultimaVela.open && // Vela bajista
            ultimaVela.open > penultimaVela.close &&
            ultimaVela.close < penultimaVela.open) {
            puntuacion += 15;
            razonesShort.push('Patrón envolvente bajista');
        }

        // Tres soldados blancos (alcista)
        if (terceraVela.close > terceraVela.open &&
            penultimaVela.close > penultimaVela.open &&
            ultimaVela.close > ultimaVela.open &&
            penultimaVela.close > terceraVela.close &&
            ultimaVela.close > penultimaVela.close) {
            puntuacion += 15;
            razonesLong.push('Patrón tres soldados blancos');
        }

        // Tres cuervos negros (bajista)
        if (terceraVela.close < terceraVela.open &&
            penultimaVela.close < penultimaVela.open &&
            ultimaVela.close < ultimaVela.open &&
            penultimaVela.close < terceraVela.close &&
            ultimaVela.close < penultimaVela.close) {
            puntuacion += 15;
            razonesShort.push('Patrón tres cuervos negros');
        }

        // 9. Divergencias RSI (20 puntos)
        const rsiActual = indicadores.rsi;
        const rsiAnterior = velas.length > 50 ? await indicadorService.calcularRSI(velas.slice(-50, -1)) : rsiActual;
        const precioActualDivergencia = ultimaVela.close;
        const precioAnterior = velas[velas.length - 50]?.close || precioActualDivergencia;

        // Divergencia alcista: precio baja pero RSI sube
        if (precioActualDivergencia < precioAnterior && rsiActual > rsiAnterior && rsiActual < 40) {
            puntuacion += 20;
            razonesLong.push('Divergencia alcista RSI');
        }

        // Divergencia bajista: precio sube pero RSI baja
        if (precioActualDivergencia > precioAnterior && rsiActual < rsiAnterior && rsiActual > 60) {
            puntuacion += 20;
            razonesShort.push('Divergencia bajista RSI');
        }

        // Determinar tipo de señal
        let tipoSenal = null;
        let razones = [];
        let probabilidad = 0;

        if (razonesLong.length > razonesShort.length && puntuacion >= 40) {
            tipoSenal = 'LONG';
            razones = razonesLong;
            probabilidad = Math.min(95, puntuacion);
        } else if (razonesShort.length > razonesLong.length && puntuacion >= 40) {
            tipoSenal = 'SHORT';
            razones = razonesShort;
            probabilidad = Math.min(95, puntuacion);
        }

        // Si no hay señal clara, retornar null
        if (!tipoSenal || razones.length < 2) {
            console.log(`Puntuación insuficiente: ${puntuacion}, Razones: ${razones.length}`);
            return null;
        }

        // Calcular Stop Loss y Take Profits usando ATR
        const atr = indicadores.atr;
        let stopLoss, takeProfit1, takeProfit2, takeProfit3;

        if (tipoSenal === 'LONG') {
            stopLoss = precioActual - (atr * 1.5);
            takeProfit1 = precioActual + (atr * 2);
            takeProfit2 = precioActual + (atr * 3.5);
            takeProfit3 = precioActual + (atr * 5);
        } else {
            stopLoss = precioActual + (atr * 1.5);
            takeProfit1 = precioActual - (atr * 2);
            takeProfit2 = precioActual - (atr * 3.5);
            takeProfit3 = precioActual - (atr * 5);
        }

        // Calcular ratio riesgo/beneficio
        const riesgo = Math.abs(precioActual - stopLoss);
        const beneficio = Math.abs(takeProfit3 - precioActual);
        const ratioRB = beneficio / riesgo;

        // Solo generar señal si ratio R:B es favorable
        if (ratioRB < 2) {
            console.log(`Ratio R:B insuficiente: ${ratioRB.toFixed(2)}`);
            return null;
        }

        const senal = {
            tipo: tipoSenal,
            precioEntrada: precioActual,
            stopLoss: parseFloat(stopLoss.toFixed(2)),
            takeProfit1: parseFloat(takeProfit1.toFixed(2)),
            takeProfit2: parseFloat(takeProfit2.toFixed(2)),
            takeProfit3: parseFloat(takeProfit3.toFixed(2)),
            probabilidad: Math.round(probabilidad),
            ratioRB: parseFloat(ratioRB.toFixed(2)),
            razon: razones.join('; '),
            timeframe,
            indicadores: {
                rsi: parseFloat(indicadores.rsi.toFixed(2)),
                macd: indicadores.macd ? parseFloat(indicadores.macd.toFixed(4)) : null,
                macdSignal: indicadores.macdSignal ? parseFloat(indicadores.macdSignal.toFixed(4)) : null,
                ema20: parseFloat(indicadores.ema20.toFixed(2)),
                ema50: parseFloat(indicadores.ema50.toFixed(2)),
                ema200: parseFloat(indicadores.ema200.toFixed(2)),
                bollingerSuperior: indicadores.bollingerSuperior ? parseFloat(indicadores.bollingerSuperior.toFixed(2)) : null,
                bollingerInferior: indicadores.bollingerInferior ? parseFloat(indicadores.bollingerInferior.toFixed(2)) : null,
                volumenActual: parseFloat(indicadores.volumenActual.toFixed(2)),
                volumenPromedio: parseFloat(indicadores.volumenPromedio.toFixed(2)),
                puntuacionTotal: puntuacion
            }
        };

        console.log(`✅ Señal ${tipoSenal} generada - Probabilidad: ${probabilidad}% - Ratio R:B: ${ratioRB.toFixed(2)}`);
        return senal;

    } catch (error) {
        console.error('Error generando señal:', error);
        return null;
    }
}

// Guardar señal en base de datos
async function guardarSenal(senal) {
    try {
        const [result] = await db.query(
            `INSERT INTO senales 
       (tipo, precio_entrada, stop_loss, take_profit_1, take_profit_2, take_profit_3,
        probabilidad, ratio_riesgo_beneficio, razon, timeframe, fecha_expiracion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
            [
                senal.tipo,
                senal.precioEntrada,
                senal.stopLoss,
                senal.takeProfit1,
                senal.takeProfit2,
                senal.takeProfit3,
                senal.probabilidad,
                senal.ratioRB,
                senal.razon,
                senal.timeframe
            ]
        );

        const senalId = result.insertId;

        // Guardar indicadores
        await db.query(
            `INSERT INTO indicadores_senal
       (senal_id, rsi, macd, macd_signal, ema_20, ema_50, ema_200,
        bollinger_superior, bollinger_inferior, volumen_actual, volumen_promedio, puntuacion_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                senalId,
                senal.indicadores.rsi,
                senal.indicadores.macd,
                senal.indicadores.macdSignal,
                senal.indicadores.ema20,
                senal.indicadores.ema50,
                senal.indicadores.ema200,
                senal.indicadores.bollingerSuperior,
                senal.indicadores.bollingerInferior,
                senal.indicadores.volumenActual,
                senal.indicadores.volumenPromedio,
                senal.indicadores.puntuacionTotal
            ]
        );

        return senalId;
    } catch (error) {
        console.error('Error guardando señal:', error);
        throw error;
    }
}

module.exports = {
    generarSenal,
    guardarSenal
};
