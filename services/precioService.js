const axios = require('axios');

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// Obtener precio actual de BTC
async function getPrecioActual() {
    try {
        const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
            params: {
                ids: 'bitcoin',
                vs_currencies: 'usd',
                include_24hr_vol: true,
                include_24hr_change: true,
                include_last_updated_at: true
            }
        });

        const data = response.data.bitcoin;

        // Obtener high/low de las últimas 24h
        const marketData = await axios.get(`${COINGECKO_API_URL}/coins/bitcoin/market_chart`, {
            params: {
                vs_currency: 'usd',
                days: 1
            }
        });

        const precios24h = marketData.data.prices.map(p => p[1]);
        const precioAlto24h = Math.max(...precios24h);
        const precioBajo24h = Math.min(...precios24h);

        return {
            precio: data.usd,
            cambio24h: data.usd_24h_change || 0,
            volumen24h: data.usd_24h_vol || 0,
            precioAlto24h,
            precioBajo24h
        };
    } catch (error) {
        console.error('Error obteniendo precio de CoinGecko:', error.message);
        throw new Error('Error al obtener precio de BTC');
    }
}

// Obtener velas (OHLCV) para análisis técnico
async function getVelas(intervalo = '1h', limite = 100) {
    try {
        // CoinGecko usa días en lugar de intervalos específicos
        // Convertir límite a días aproximados
        let dias = 1;
        if (intervalo === '1h') {
            dias = Math.ceil(limite / 24);
        } else if (intervalo === '4h') {
            dias = Math.ceil(limite / 6);
        } else if (intervalo === '1d') {
            dias = limite;
        }

        // Máximo 365 días para CoinGecko free
        dias = Math.min(dias, 365);

        const response = await axios.get(`${COINGECKO_API_URL}/coins/bitcoin/market_chart`, {
            params: {
                vs_currency: 'usd',
                days: dias,
                interval: intervalo === '1h' ? 'hourly' : 'daily'
            }
        });

        const precios = response.data.prices;
        const volumenes = response.data.total_volumes;

        // Convertir a formato de velas
        const velas = [];
        for (let i = 0; i < Math.min(precios.length, limite); i++) {
            const timestamp = precios[i][0];
            const close = precios[i][1];
            const volume = volumenes[i] ? volumenes[i][1] : 0;

            // Simular OHLC basado en el precio de cierre
            // (CoinGecko free no da OHLC completo)
            const variacion = close * 0.001; // 0.1% de variación
            velas.push({
                timestamp,
                open: close - variacion,
                high: close + variacion,
                low: close - variacion,
                close,
                volume
            });
        }

        return velas.slice(-limite); // Últimas 'limite' velas
    } catch (error) {
        console.error('Error obteniendo velas de CoinGecko:', error.message);
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
