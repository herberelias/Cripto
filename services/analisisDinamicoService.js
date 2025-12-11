const db = require('../config/database');
const precioService = require('./precioService');
const indicadorService = require('./indicadorService');

/**
 * Configuración de triggers para análisis dinámico
 */
const CONFIG_TRIGGERS = {
    volumen: {
        umbralAlto: 1.5,        // 150% del promedio
        umbralExtremo: 2.0,     // 200% del promedio
        puntosAlto: 10,
        puntosExtremo: 20
    },
    precio: {
        umbralMovimiento: 1.0,   // 1% en 5 minutos
        umbralFuerte: 2.0,       // 2% en 5 minutos
        puntosNormal: 15,
        puntosFuerte: 25
    },
    rsi: {
        sobreventa: 30,
        sobrecompra: 70,
        puntos: 15
    },
    cruceEmas: {
        puntos: 20
    },
    patrones: {
        puntos: 15
    }
};

/**
 * Detectar triggers (disparadores) de oportunidades en el mercado
 */
async function detectarTriggers() {
    try {
        const triggers = [];

        // Obtener datos recientes (5 minutos)
        const velas5m = await precioService.getVelas('BTC', '5m', 50);
        if (velas5m.length < 20) return triggers;

        const precioActual = velas5m[velas5m.length - 1].close;
        const precio5minAtras = velas5m[velas5m.length - 2].close;

        // Calcular indicadores
        const indicadores = indicadorService.calcularIndicadores(velas5m);

        // TRIGGER 1: Pico de volumen
        const volumenActual = velas5m[velas5m.length - 1].volumeto;
        const volumenPromedio = velas5m.slice(-20).reduce((sum, v) => sum + v.volumeto, 0) / 20;
        const ratioVolumen = volumenActual / volumenPromedio;

        if (ratioVolumen >= CONFIG_TRIGGERS.volumen.umbralExtremo) {
            const esVelaAlcista = velas5m[velas5m.length - 1].close > velas5m[velas5m.length - 1].open;
            triggers.push({
                tipo: 'volumen_extremo',
                intensidad: ratioVolumen,
                direccion: esVelaAlcista ? 'LONG' : 'SHORT',
                puntos: CONFIG_TRIGGERS.volumen.puntosExtremo,
                descripcion: `Volumen ${(ratioVolumen * 100).toFixed(0)}% del promedio`
            });
        } else if (ratioVolumen >= CONFIG_TRIGGERS.volumen.umbralAlto) {
            const esVelaAlcista = velas5m[velas5m.length - 1].close > velas5m[velas5m.length - 1].open;
            triggers.push({
                tipo: 'volumen_alto',
                intensidad: ratioVolumen,
                direccion: esVelaAlcista ? 'LONG' : 'SHORT',
                puntos: CONFIG_TRIGGERS.volumen.puntosAlto,
                descripcion: `Volumen ${(ratioVolumen * 100).toFixed(0)}% del promedio`
            });
        }

        // TRIGGER 2: Movimiento de precio significativo
        const cambioPrecio = ((precioActual - precio5minAtras) / precio5minAtras) * 100;

        if (Math.abs(cambioPrecio) >= CONFIG_TRIGGERS.precio.umbralFuerte) {
            triggers.push({
                tipo: 'movimiento_fuerte',
                porcentaje: cambioPrecio,
                direccion: cambioPrecio > 0 ? 'LONG' : 'SHORT',
                puntos: CONFIG_TRIGGERS.precio.puntosFuerte,
                descripcion: `Movimiento ${cambioPrecio > 0 ? '+' : ''}${cambioPrecio.toFixed(2)}% en 5 min`
            });
        } else if (Math.abs(cambioPrecio) >= CONFIG_TRIGGERS.precio.umbralMovimiento) {
            triggers.push({
                tipo: 'movimiento_precio',
                porcentaje: cambioPrecio,
                direccion: cambioPrecio > 0 ? 'LONG' : 'SHORT',
                puntos: CONFIG_TRIGGERS.precio.puntosNormal,
                descripcion: `Movimiento ${cambioPrecio > 0 ? '+' : ''}${cambioPrecio.toFixed(2)}% en 5 min`
            });
        }

        // TRIGGER 3: RSI en zonas extremas
        if (indicadores.rsi < CONFIG_TRIGGERS.rsi.sobreventa) {
            triggers.push({
                tipo: 'rsi_sobreventa',
                valor: indicadores.rsi,
                direccion: 'LONG',
                puntos: CONFIG_TRIGGERS.rsi.puntos,
                descripcion: `RSI en sobreventa (${indicadores.rsi.toFixed(1)})`
            });
        } else if (indicadores.rsi > CONFIG_TRIGGERS.rsi.sobrecompra) {
            triggers.push({
                tipo: 'rsi_sobrecompra',
                valor: indicadores.rsi,
                direccion: 'SHORT',
                puntos: CONFIG_TRIGGERS.rsi.puntos,
                descripcion: `RSI en sobrecompra (${indicadores.rsi.toFixed(1)})`
            });
        }

        // TRIGGER 4: Cruce de EMAs (solo si hay datos suficientes)
        if (velas5m.length >= 22) {
            const ema9Actual = indicadores.ema20; // Usamos ema20 como proxy
            const ema21Actual = indicadores.ema50; // Usamos ema50 como proxy

            // Calcular EMAs de vela anterior
            const velasAnteriores = velas5m.slice(0, -1);
            const indicadoresAnteriores = indicadorService.calcularIndicadores(velasAnteriores);
            const ema9Anterior = indicadoresAnteriores.ema20;
            const ema21Anterior = indicadoresAnteriores.ema50;

            // Cruce alcista
            if (ema9Actual > ema21Actual && ema9Anterior <= ema21Anterior) {
                triggers.push({
                    tipo: 'cruce_emas_alcista',
                    direccion: 'LONG',
                    puntos: CONFIG_TRIGGERS.cruceEmas.puntos,
                    descripcion: 'Cruce alcista de EMAs'
                });
            }
            // Cruce bajista
            else if (ema9Actual < ema21Actual && ema9Anterior >= ema21Anterior) {
                triggers.push({
                    tipo: 'cruce_emas_bajista',
                    direccion: 'SHORT',
                    puntos: CONFIG_TRIGGERS.cruceEmas.puntos,
                    descripcion: 'Cruce bajista de EMAs'
                });
            }
        }

        return triggers;

    } catch (error) {
        console.error('Error detectando triggers:', error);
        return [];
    }
}

/**
 * Verificar si ya existe una señal similar reciente
 */
async function existeSenalReciente(tipo, minutos = 15) {
    try {
        const [senales] = await db.query(`
            SELECT id, tipo, timeframe, fecha_creacion
            FROM senales
            WHERE tipo = ?
            AND estado = 'activa'
            AND fecha_creacion > DATE_SUB(NOW(), INTERVAL ? MINUTE)
            ORDER BY fecha_creacion DESC
            LIMIT 1
        `, [tipo, minutos]);

        return senales.length > 0;
    } catch (error) {
        console.error('Error verificando señal reciente:', error);
        return false;
    }
}

/**
 * Analizar contexto de un timeframe específico
 */
async function analizarContexto(timeframe) {
    try {
        const velas = await precioService.getVelas('BTC', timeframe, 100);
        if (velas.length < 50) return { tendencia: 'neutral', fuerza: 0 };

        const indicadores = indicadorService.calcularIndicadores(velas);

        // Determinar tendencia
        let tendencia = 'neutral';
        let fuerza = 0;

        if (indicadores.ema20 > indicadores.ema50 && indicadores.ema50 > indicadores.ema200) {
            tendencia = 'alcista';
            fuerza = ((indicadores.ema20 - indicadores.ema200) / indicadores.ema200) * 100;
        } else if (indicadores.ema20 < indicadores.ema50 && indicadores.ema50 < indicadores.ema200) {
            tendencia = 'bajista';
            fuerza = ((indicadores.ema200 - indicadores.ema20) / indicadores.ema200) * 100;
        }

        return {
            tendencia,
            fuerza: Math.abs(fuerza),
            rsi: indicadores.rsi,
            precio: indicadores.precioActual
        };
    } catch (error) {
        console.error(`Error analizando contexto ${timeframe}:`, error);
        return { tendencia: 'neutral', fuerza: 0 };
    }
}

/**
 * Generar señal dinámica basada en triggers
 */
async function generarSenalDinamica(triggers) {
    try {
        // Determinar dirección dominante
        const triggersLong = triggers.filter(t => t.direccion === 'LONG');
        const triggersShort = triggers.filter(t => t.direccion === 'SHORT');

        if (triggersLong.length === 0 && triggersShort.length === 0) {
            return null;
        }

        const direccion = triggersLong.length > triggersShort.length ? 'LONG' : 'SHORT';
        const triggersAlineados = direccion === 'LONG' ? triggersLong : triggersShort;

        // Calcular puntuación base de triggers
        let puntuacion = triggersAlineados.reduce((sum, t) => sum + t.puntos, 0);

        // Analizar contexto multi-timeframe
        const contexto15m = await analizarContexto('15m');
        const contexto1h = await analizarContexto('1h');
        const contexto4h = await analizarContexto('4h');

        // Ajustar puntuación según contexto
        if (contexto4h.tendencia === direccion) {
            puntuacion += 10; // Bonus por alineación con tendencia 4h
        } else if (contexto4h.tendencia !== 'neutral' && contexto4h.tendencia !== direccion) {
            puntuacion -= 15; // Penalización por ir contra tendencia 4h
        }

        if (contexto1h.tendencia === direccion) {
            puntuacion += 5; // Bonus menor por alineación 1h
        }

        // Verificar criterios mínimos
        if (puntuacion < 30 || triggersAlineados.length < 2) {
            console.log(`Señal dinámica rechazada - Puntuación: ${puntuacion}, Triggers: ${triggersAlineados.length}`);
            return null;
        }

        // Obtener precio actual y calcular niveles
        const precioActual = contexto15m.precio;
        const velas1h = await precioService.getVelas('BTC', '1h', 50);
        const indicadores1h = indicadorService.calcularIndicadores(velas1h);
        const atr = indicadores1h.atr;

        // Calcular Stop Loss y Take Profits
        let stopLoss, takeProfit1, takeProfit2, takeProfit3;

        if (direccion === 'LONG') {
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

        // Verificar ratio mínimo
        if (ratioRB < 2) {
            console.log(`Señal dinámica rechazada - Ratio R:B insuficiente: ${ratioRB.toFixed(2)}`);
            return null;
        }

        // Calcular probabilidad (limitada a 30-70% para señales dinámicas)
        const probabilidad = Math.min(70, Math.max(30, puntuacion));

        // Crear razones descriptivas
        const razones = triggersAlineados.map(t => t.descripcion).join('; ');
        const contextoDesc = contexto4h.tendencia !== 'neutral'
            ? `; Tendencia 4h ${contexto4h.tendencia}`
            : '';

        return {
            tipo: direccion,
            precioEntrada: precioActual,
            stopLoss: parseFloat(stopLoss.toFixed(2)),
            takeProfit1: parseFloat(takeProfit1.toFixed(2)),
            takeProfit2: parseFloat(takeProfit2.toFixed(2)),
            takeProfit3: parseFloat(takeProfit3.toFixed(2)),
            probabilidad: Math.round(probabilidad),
            ratioRB: parseFloat(ratioRB.toFixed(2)),
            razon: razones + contextoDesc,
            timeframe: '5m',
            indicadores: {
                rsi: parseFloat(contexto15m.rsi.toFixed(2)),
                macd: null,
                macdSignal: null,
                ema20: parseFloat(indicadores1h.ema20.toFixed(2)),
                ema50: parseFloat(indicadores1h.ema50.toFixed(2)),
                ema200: parseFloat(indicadores1h.ema200.toFixed(2)),
                bollingerSuperior: null,
                bollingerInferior: null,
                volumenActual: 0,
                volumenPromedio: 0,
                puntuacionTotal: Math.round(puntuacion)
            }
        };

    } catch (error) {
        console.error('Error generando señal dinámica:', error);
        return null;
    }
}

/**
 * Analizar mercado dinámicamente (ejecutar cada 5 minutos)
 */
async function analizarMercadoDinamico() {
    try {
        console.log('🔍 Iniciando análisis dinámico del mercado...');

        // Detectar triggers
        const triggers = await detectarTriggers();

        if (triggers.length === 0) {
            console.log('No se detectaron triggers significativos');
            return;
        }

        console.log(`✅ Detectados ${triggers.length} triggers:`, triggers.map(t => t.tipo).join(', '));

        // Determinar dirección dominante
        const triggersLong = triggers.filter(t => t.direccion === 'LONG');
        const triggersShort = triggers.filter(t => t.direccion === 'SHORT');
        const direccionDominante = triggersLong.length > triggersShort.length ? 'LONG' : 'SHORT';

        // Verificar si ya existe señal reciente del mismo tipo
        const existeReciente = await existeSenalReciente(direccionDominante, 15);
        if (existeReciente) {
            console.log(`⚠️  Ya existe señal ${direccionDominante} reciente, evitando duplicado`);
            return;
        }

        // Generar señal dinámica
        const senal = await generarSenalDinamica(triggers);

        if (senal) {
            // Guardar señal (reutilizamos la función del generador)
            const { guardarSenal } = require('./generadorSenales');
            const senalId = await guardarSenal(senal);

            console.log(`🎯 Señal dinámica ${senal.tipo} generada con ID: ${senalId}`);
            console.log(`   Probabilidad: ${senal.probabilidad}% | R:B: ${senal.ratioRB}`);
            console.log(`   Triggers: ${triggers.length} | Razón: ${senal.razon}`);
        }

    } catch (error) {
        console.error('❌ Error en análisis dinámico:', error);
    }
}

module.exports = {
    analizarMercadoDinamico,
    detectarTriggers,
    generarSenalDinamica,
    analizarContexto
};
