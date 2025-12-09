const axios = require('axios');

const BINANCE_API_URL = process.env.BINANCE_API_URL || 'https://api.binance.com/api/v3';

// Obtener precio actual de BTC
async function getPrecioActual() {
    try {
        const response = await axios.get(`${BINANCE_API_URL}/ticker/24hr`, {
            params: { symbol: 'BTCUSDT' }
        });

        return {
            precio: parseFloat(response.data.lastPrice),
            cambio24h: parseFloat(response.data.priceChangePercent),
            volumen24h: parseFloat(response.data.volume),
            precioAlto24h: parseFloat(response.data.highPrice),
            precioBajo24h: parseFloat(response.data.lowPrice)
        };
    } catch (error) {
        console.error('Error obteniendo precio de Binance:', error.message);
        throw new Error('Error al obtener precio de BTC');
    }
}

// Obtener velas (OHLCV) para análisis técnico
async function getVelas(intervalo = '1h', limite = 100) {
    try {
        const response = await axios.get(`${BINANCE_API_URL}/klines`, {
            params: {
                symbol: 'BTCUSDT',
                interval: intervalo,
                limit: limite
            }
        });

        // Formato: [timestamp, open, high, low, close, volume, ...]
        return response.data.map(vela => ({
            timestamp: vela[0],
            open: parseFloat(vela[1]),
            high: parseFloat(vela[2]),
            low: parseFloat(vela[3]),
            close: parseFloat(vela[4]),
            volume: parseFloat(vela[5])
        }));
    } catch (error) {
        console.error('Error obteniendo velas de Binance:', error.message);
        throw new Error('Error al obtener datos históricos');
    }
}

// Obtener histórico de precios (últimas 24 horas)
async function getHistorico24h() {
    try {
        const velas = await getVelas('1h', 24);
        return velas.map(v => ({
            timestamp: v.timestamp,
            precio: v.close
        }));
    } catch (error) {
        throw error;
    }
}

module.exports = {
    getPrecioActual,
    getVelas,
    getHistorico24h
};
