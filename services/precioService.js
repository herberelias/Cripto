const axios = require('axios');

// Usar CryptoCompare API (sin restricciones geográficas)
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data';

/**
 * Obtener velas (candlesticks) de CryptoCompare
 */
async function getVelas(simbolo = 'BTC', intervalo = '1h', limite = 100) {
    try {
        const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

        // Determinar endpoint según intervalo
        let endpoint = 'histohour'; // Por defecto 1h (sin v2)
        if (intervalo === '1d') endpoint = 'histoday';
        if (intervalo === '4h') endpoint = 'histohour';

        const url = `${CRYPTOCOMPARE_API}/${endpoint}`;
        const response = await axios.get(url, {
            params: {
                fsym: simbolo,
                tsym: 'USD',
                limit: limite,
                api_key: apiKey
            },
            timeout: 10000
        });

        console.log('Respuesta de CryptoCompare:', JSON.stringify(response.data).substring(0, 200));

        // CryptoCompare v1 API usa response.data.Data directamente
        if (!response.data || !response.data.Data) {
            console.error('Estructura de respuesta:', response.data);
            throw new Error('Respuesta inválida de CryptoCompare');
        }

        const velas = response.data.Data.map(vela => ({
            timestamp: vela.time * 1000, // Convertir a milisegundos
            open: vela.open,
            high: vela.high,
            low: vela.low,
            close: vela.close,
            volume: vela.volumeto
        }));

        return velas;
    } catch (error) {
        console.error('Error obteniendo velas de CryptoCompare:', error.message);
        if (error.response) {
            console.error('Respuesta del servidor:', error.response.data);
        }
        throw new Error('Error al obtener datos históricos de CryptoCompare');
    }
}

/**
 * Obtener precio actual de Bitcoin
 */
async function getPrecioActual() {
    try {
        const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
        const url = `${CRYPTOCOMPARE_API}/pricemultifull`;

        const response = await axios.get(url, {
            params: {
                fsyms: 'BTC',
                tsyms: 'USD',
                api_key: apiKey
            },
            timeout: 10000
        });

        const data = response.data.RAW.BTC.USD;

        return {
            precio: data.PRICE,
            cambio24h: data.CHANGEPCT24HOUR,
            volumen24h: data.VOLUME24HOURTO,
            precioAlto24h: data.HIGH24HOUR,
            precioBajo24h: data.LOW24HOUR,
            precioBajo: data.LOW24HOUR,
            precioAlto: data.HIGH24HOUR
        };
    } catch (error) {
        console.error('Error obteniendo precio de CryptoCompare:', error.message);
        throw new Error('Error al obtener precio actual de CryptoCompare');
    }
}

/**
 * Obtener datos históricos para gráficos
 */
async function getDatosHistoricos(dias = 7) {
    try {
        const limite = dias * 24; // Horas
        const velas = await getVelas('BTC', '1h', limite);

        return velas.map(vela => ({
            fecha: new Date(vela.timestamp),
            precio: vela.close
        }));
    } catch (error) {
        console.error('Error obteniendo histórico de CryptoCompare:', error.message);
        throw new Error('Error al obtener datos históricos');
    }
}

module.exports = {
    getVelas,
    getPrecioActual,
    getDatosHistoricos
};
