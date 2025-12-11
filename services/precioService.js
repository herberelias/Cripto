const axios = require('axios');

// APIs disponibles (sin restricciones geográficas)
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const KRAKEN_API = 'https://api.kraken.com/0/public';

/**
 * Mapear timeframes a endpoints de CryptoCompare
 */
function getEndpointCryptoCompare(intervalo) {
    const map = {
        '15m': 'histominute',
        '30m': 'histominute',
        '1h': 'histohour',
        '4h': 'histohour',
        '1d': 'histoday'
    };
    return map[intervalo] || 'histohour';
}

/**
 * Obtener velas desde CryptoCompare
 */
async function getVelasCryptoCompare(simbolo = 'BTC', intervalo = '1h', limite = 100) {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

    // Determinar endpoint según intervalo
    const endpoint = getEndpointCryptoCompare(intervalo);
    
    // Para intervalos en minutos, ajustar el límite
    let limiteAjustado = limite;
    let aggregate = 1;
    
    if (intervalo === '15m') {
        aggregate = 15;
    } else if (intervalo === '30m') {
        aggregate = 30;
    } else if (intervalo === '4h') {
        aggregate = 4;
    }

    const url = `${CRYPTOCOMPARE_API}/${endpoint}`;
    const response = await axios.get(url, {
        params: {
            fsym: simbolo,
            tsym: 'USD',
            limit: limiteAjustado,
            aggregate: aggregate,
            api_key: apiKey
        },
        timeout: 10000
    });

    if (!response.data || !response.data.Data) {
        throw new Error('Respuesta inválida de CryptoCompare');
    }

    return response.data.Data.map(vela => ({
        timestamp: vela.time * 1000,
        open: vela.open,
        high: vela.high,
        low: vela.low,
        close: vela.close,
        volume: vela.volumeto
    }));
}

/**
 * Obtener velas desde CoinGecko
 */
async function getVelasCoinGecko(simbolo = 'BTC', intervalo = '1h', limite = 100) {
    // CoinGecko usa días, convertir límite según intervalo
    let days = 1;
    
    switch(intervalo) {
        case '15m':
        case '30m':
            days = Math.ceil(limite / 96); // ~15min granularidad
            break;
        case '1h':
            days = Math.ceil(limite / 24);
            break;
        case '4h':
            days = Math.ceil(limite / 6);
            break;
        case '1d':
            days = limite;
            break;
        default:
            days = Math.ceil(limite / 24);
    }

    const coinId = simbolo === 'BTC' ? 'bitcoin' : simbolo.toLowerCase();
    const url = `${COINGECKO_API}/coins/${coinId}/ohlc`;

    const response = await axios.get(url, {
        params: {
            vs_currency: 'usd',
            days: days
        },
        timeout: 10000
    });

    // CoinGecko devuelve [timestamp, open, high, low, close]
    return response.data.slice(-limite).map(vela => ({
        timestamp: vela[0],
        open: vela[1],
        high: vela[2],
        low: vela[3],
        close: vela[4],
        volume: 0 // CoinGecko OHLC no incluye volumen
    }));
}

/**
 * Mapear timeframes a minutos para Kraken
 */
function getIntervalMinutosKraken(intervalo) {
    const map = {
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440
    };
    return map[intervalo] || 60;
}

/**
 * Obtener velas desde Kraken
 */
async function getVelasKraken(simbolo = 'BTC', intervalo = '1h', limite = 100) {
    // Kraken usa intervalos en minutos
    const intervalMinutos = getIntervalMinutosKraken(intervalo);

    const par = `${simbolo}USD`;
    const url = `${KRAKEN_API}/OHLC`;

    const response = await axios.get(url, {
        params: {
            pair: par,
            interval: intervalMinutos,
            since: Math.floor(Date.now() / 1000) - (limite * intervalMinutos * 60)
        },
        timeout: 10000
    });

    if (!response.data.result) {
        throw new Error('Respuesta inválida de Kraken');
    }

    // Kraken devuelve objeto con el par como key
    const parKey = Object.keys(response.data.result).find(k => k !== 'last');
    const velas = response.data.result[parKey];

    return velas.slice(-limite).map(vela => ({
        timestamp: vela[0] * 1000,
        open: parseFloat(vela[1]),
        high: parseFloat(vela[2]),
        low: parseFloat(vela[3]),
        close: parseFloat(vela[4]),
        volume: parseFloat(vela[6])
    }));
}

/**
 * Obtener velas con sistema de fallback (CryptoCompare -> CoinGecko -> Kraken)
 */
async function getVelas(simbolo = 'BTC', intervalo = '1h', limite = 100) {
    const intentos = [
        { nombre: 'CryptoCompare', fn: () => getVelasCryptoCompare(simbolo, intervalo, limite) },
        { nombre: 'CoinGecko', fn: () => getVelasCoinGecko(simbolo, intervalo, limite) },
        { nombre: 'Kraken', fn: () => getVelasKraken(simbolo, intervalo, limite) }
    ];

    for (const intento of intentos) {
        try {
            console.log(`📊 Intentando obtener velas desde ${intento.nombre}...`);
            const velas = await intento.fn();
            console.log(`✅ Velas obtenidas desde ${intento.nombre}: ${velas.length} registros`);
            return velas;
        } catch (error) {
            console.error(`❌ Error con ${intento.nombre}:`, error.message);
            // Continuar con el siguiente intento
        }
    }

    throw new Error('Error: No se pudo obtener velas de ninguna API disponible');
}

/**
 * Obtener precio actual desde CryptoCompare
 */
async function getPrecioCryptoCompare() {
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
}

/**
 * Obtener precio actual desde CoinGecko
 */
async function getPrecioCoinGecko() {
    const url = `${COINGECKO_API}/simple/price`;

    const response = await axios.get(url, {
        params: {
            ids: 'bitcoin',
            vs_currencies: 'usd',
            include_24hr_vol: true,
            include_24hr_change: true
        },
        timeout: 10000
    });

    const data = response.data.bitcoin;

    return {
        precio: data.usd,
        cambio24h: data.usd_24h_change || 0,
        volumen24h: data.usd_24h_vol || 0,
        precioAlto24h: data.usd,
        precioBajo24h: data.usd,
        precioBajo: data.usd,
        precioAlto: data.usd
    };
}

/**
 * Obtener precio actual desde Kraken
 */
async function getPrecioKraken() {
    const url = `${KRAKEN_API}/Ticker`;

    const response = await axios.get(url, {
        params: {
            pair: 'XBTUSD'
        },
        timeout: 10000
    });

    const data = response.data.result.XXBTZUSD;

    return {
        precio: parseFloat(data.c[0]),
        cambio24h: 0, // Kraken no da cambio % directamente
        volumen24h: parseFloat(data.v[1]),
        precioAlto24h: parseFloat(data.h[1]),
        precioBajo24h: parseFloat(data.l[1]),
        precioBajo: parseFloat(data.l[1]),
        precioAlto: parseFloat(data.h[1])
    };
}

/**
 * Obtener precio actual con sistema de fallback
 */
async function getPrecioActual() {
    const intentos = [
        { nombre: 'CryptoCompare', fn: getPrecioCryptoCompare },
        { nombre: 'CoinGecko', fn: getPrecioCoinGecko },
        { nombre: 'Kraken', fn: getPrecioKraken }
    ];

    for (const intento of intentos) {
        try {
            console.log(`💰 Intentando obtener precio desde ${intento.nombre}...`);
            const precio = await intento.fn();
            console.log(`✅ Precio obtenido desde ${intento.nombre}: $${precio.precio.toFixed(2)}`);
            return precio;
        } catch (error) {
            console.error(`❌ Error con ${intento.nombre}:`, error.message);
            // Continuar con el siguiente intento
        }
    }

    throw new Error('Error: No se pudo obtener precio de ninguna API disponible');
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
