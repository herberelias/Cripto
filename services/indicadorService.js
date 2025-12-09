const { RSI, MACD, EMA, BollingerBands, ATR } = require('technicalindicators');

// Calcular RSI
function calcularRSI(precios, periodo = 14) {
    const rsiInput = {
        values: precios,
        period: periodo
    };
    const rsiValues = RSI.calculate(rsiInput);
    return rsiValues[rsiValues.length - 1]; // Último valor
}

// Calcular MACD
function calcularMACD(precios) {
    const macdInput = {
        values: precios,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    };
    const macdValues = MACD.calculate(macdInput);
    return macdValues[macdValues.length - 1]; // Último valor
}

// Calcular EMAs
function calcularEMAs(precios) {
    const ema20 = EMA.calculate({ period: 20, values: precios });
    const ema50 = EMA.calculate({ period: 50, values: precios });
    const ema200 = EMA.calculate({ period: 200, values: precios });

    return {
        ema20: ema20[ema20.length - 1],
        ema50: ema50[ema50.length - 1],
        ema200: ema200[ema200.length - 1]
    };
}

// Calcular Bandas de Bollinger
function calcularBollinger(precios, periodo = 20, desviaciones = 2) {
    const bollingerInput = {
        period: periodo,
        values: precios,
        stdDev: desviaciones
    };
    const bollingerValues = BollingerBands.calculate(bollingerInput);
    return bollingerValues[bollingerValues.length - 1]; // Último valor
}

// Calcular ATR (Average True Range) para Stop Loss
function calcularATR(velas, periodo = 14) {
    const atrInput = {
        high: velas.map(v => v.high),
        low: velas.map(v => v.low),
        close: velas.map(v => v.close),
        period: periodo
    };
    const atrValues = ATR.calculate(atrInput);
    return atrValues[atrValues.length - 1]; // Último valor
}

// Calcular todos los indicadores
function calcularIndicadores(velas) {
    const precios = velas.map(v => v.close);
    const volumenes = velas.map(v => v.volume);

    // Volumen promedio
    const volumenPromedio = volumenes.reduce((a, b) => a + b, 0) / volumenes.length;
    const volumenActual = volumenes[volumenes.length - 1];

    const rsi = calcularRSI(precios);
    const macd = calcularMACD(precios);
    const emas = calcularEMAs(precios);
    const bollinger = calcularBollinger(precios);
    const atr = calcularATR(velas);

    return {
        rsi,
        macd: macd ? macd.MACD : null,
        macdSignal: macd ? macd.signal : null,
        macdHistogram: macd ? macd.histogram : null,
        ema20: emas.ema20,
        ema50: emas.ema50,
        ema200: emas.ema200,
        bollingerSuperior: bollinger ? bollinger.upper : null,
        bollingerMedia: bollinger ? bollinger.middle : null,
        bollingerInferior: bollinger ? bollinger.lower : null,
        atr,
        volumenActual,
        volumenPromedio,
        precioActual: precios[precios.length - 1]
    };
}

module.exports = {
    calcularRSI,
    calcularMACD,
    calcularEMAs,
    calcularBollinger,
    calcularATR,
    calcularIndicadores
};
