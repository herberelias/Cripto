const axios = require('axios');

// Usar Binance API (gratuita, sin límites estrictos)
const BINANCE_API = 'https://api.binance.com/api/v3';

/**
 * Obtener velas (candlesticks) de Binance
 */
async function getVelas(simbolo = 'BTCUSDT', intervalo = '1h', limite = 100) {
    try {
        const url = `${BINANCE_API}/klines`;
        const response = await axios.get(url, {
            params: {
                symbol: simbolo,
                interval: intervalo,
                limit: limite
            },
            timeout: 10000
        });

        // Formato de respuesta de Binance:
        // [timestamp, open, high, low, close, volume, closeTime, ...]
        const velas = response.data.map(vela => ({
            timestamp: vela[0],
            open: parseFloat(vela[1]),
            high: parseFloat(vela[2]),
            low: parseFloat(vela[3]),
            close: parseFloat(vela[4]),
            volume: parseFloat(vela[5])
        }));

        return velas;
    } catch (error) {
        console.error('Error obteniendo velas de Binance:', error.message);
        throw new Error('Error al obtener datos históricos de Binance');
    }
}

/**
 * Obtener precio actual de Bitcoin
 */
async function getPrecioActual() {
    try {
        const url = `${BINANCE_API}/ticker/24hr`;
        const response = await axios.get(url, {
            params: {
                symbol: 'BTCUSDT'
            },
            timeout: 10000
        });

        const data = response.data;

        return {
            precio: parseFloat(data.lastPrice),
            cambio24h: parseFloat(data.priceChangePercent),
            volumen24h: parseFloat(data.volume),
            precioAlto24h: parseFloat(data.highPrice),
            precioBajo24h: parseFloat(data.lowPrice),
            precioBajo: parseFloat(data.bidPrice),
            precioAlto: parseFloat(data.askPrice)
        };
    } catch (error) {
        console.error('Error obteniendo precio de Binance:', error.message);
        throw new Error('Error al obtener precio actual de Binance');
    }
}

/**
 * Obtener datos históricos para gráficos
 */
async function getDatosHistoricos(dias = 7) {
    try {
        // Binance usa intervalos, no días directos
        // Para 7 días con datos cada hora: 7 * 24 = 168 velas
        const limite = dias * 24;
        const velas = await getVelas('BTCUSDT', '1h', limite);

        return velas.map(vela => ({
            fecha: new Date(vela.timestamp),
            precio: vela.close
        }));
    } catch (error) {
        console.error('Error obteniendo histórico de Binance:', error.message);
        throw new Error('Error al obtener datos históricos');
    }
}

module.exports = {
    getVelas,
    getPrecioActual,
    getDatosHistoricos
};
