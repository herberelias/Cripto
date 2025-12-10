const db = require('../config/database');
const precioService = require('./precioService');
const indicadorService = require('./indicadorService');

// Generar señal basada en indicadores técnicos
async function generarSenal(timeframe = '1h') {
    try {
        // Obtener velas históricas del timeframe principal
        const velas = await precioService.getVelas('BTC', timeframe, 200);

        if (velas.length < 200) {
            console.log('No hay suficientes datos para análisis');
            return null;
        }

        // Obtener velas de timeframe superior (4h) para análisis de tendencia general
        const velas4h = await precioService.getVelas('BTC', '4h', 100);
        
        if (velas4h.length < 50) {
            console.log('No hay suficientes datos del timeframe superior');
            return null;
        }

        // Calcular indicadores del timeframe principal
        const indicadores = indicadorService.calcularIndicadores(velas);
        
        // Calcular indicadores del timeframe superior para filtro de tendencia
        const indicadores4h = indicadorService.calcularIndicadores(velas4h);
        
        // Análisis de tendencia general (timeframe superior)
        let tendenciaGeneral = 'neutral';
        if (indicadores4h.ema20 > indicadores4h.ema50 && indicadores4h.ema50 > indicadores4h.ema200) {
            tendenciaGeneral = 'alcista';
        } else if (indicadores4h.ema20 < indicadores4h.ema50 && indicadores4h.ema50 < indicadores4h.ema200) {
            tendenciaGeneral = 'bajista';
        }
        
        console.log(`📊 Tendencia general (4h): ${tendenciaGeneral.toUpperCase()}`);

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

        // 6. Volumen alto indica actividad, pero NO dirección (NEUTRAL)
        // Solo se usa para dar más peso si hay volumen de confirmación
        const volumenAlto = indicadores.volumenActual > indicadores.volumenPromedio * 1.3;
        const factorVolumen = volumenAlto ? 1.2 : 1.0; // Multiplicador para otros indicadores

        // 7. Análisis de Volumen con Dirección (15 puntos)
        const volumenPromedio = velas.slice(-20).reduce((sum, v) => sum + v.volumeto, 0) / 20;
        const volumenActual = velas[velas.length - 1].volumeto;
        const volumenRelativo = volumenActual / volumenPromedio;

        if (volumenRelativo > 1.5) {
            if (velas[velas.length - 1].close > velas[velas.length - 1].open) {
                puntuacion += 15;
                razonesLong.push('Volumen alcista fuerte');
            } else {
                puntuacion += 15;
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
        const rangoVela = ultimaVela.high - ultimaVela.low;
        const esVelaAlcista = ultimaVela.close > ultimaVela.open;
        const esVelaBajista = ultimaVela.close < ultimaVela.open;
        
        // Contexto de tendencia
        const enTendenciaBajista = precioActual < indicadores.ema50;
        const enTendenciaAlcista = precioActual > indicadores.ema50;

        // Martillo alcista (mecha inferior larga, cuerpo pequeño arriba, vela alcista, en tendencia bajista)
        if (mechaInfUltima > 2 * cuerpoUltima && 
            mechaSupUltima < cuerpoUltima * 0.5 && 
            cuerpoUltima > rangoVela * 0.1 && // Cuerpo mínimo 10% del rango
            esVelaAlcista &&
            enTendenciaBajista) {
            puntuacion += 15;
            razonesLong.push('Patrón martillo alcista válido');
        }

        // Estrella fugaz bajista (mecha superior larga, cuerpo pequeño abajo, vela bajista, en tendencia alcista)
        if (mechaSupUltima > 2 * cuerpoUltima && 
            mechaInfUltima < cuerpoUltima * 0.5 && 
            cuerpoUltima > rangoVela * 0.1 && // Cuerpo mínimo 10% del rango
            esVelaBajista &&
            enTendenciaAlcista) {
            puntuacion += 15;
            razonesShort.push('Patrón estrella fugaz bajista válido');
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

        // 9. Divergencias RSI - DESHABILITADO (implementación incorrecta)
        // TODO: Implementar correctamente buscando picos locales en precio y RSI
        // Requiere: identificar mínimos/máximos relativos, comparar al menos 2-3 picos
        // Por ahora se omite para evitar señales falsas

        // Sistema de confirmación por categorías
        const categoriaTendencia = {
            long: razonesLong.filter(r => r.includes('EMA') || r.includes('MACD')).length,
            short: razonesShort.filter(r => r.includes('EMA') || r.includes('MACD')).length
        };
        
        const categoriaMomentum = {
            long: razonesLong.filter(r => r.includes('RSI') || r.includes('Volumen')).length,
            short: razonesShort.filter(r => r.includes('RSI') || r.includes('Volumen')).length
        };
        
        const categoriaPatrones = {
            long: razonesLong.filter(r => r.includes('Patrón') || r.includes('Bollinger')).length,
            short: razonesShort.filter(r => r.includes('Patrón') || r.includes('Bollinger')).length
        };

        // Contar categorías confirmadas (al menos 1 razón en la categoría)
        const categoriasLong = (categoriaTendencia.long > 0 ? 1 : 0) + 
                               (categoriaMomentum.long > 0 ? 1 : 0) + 
                               (categoriaPatrones.long > 0 ? 1 : 0);
        
        const categoriasShort = (categoriaTendencia.short > 0 ? 1 : 0) + 
                                (categoriaMomentum.short > 0 ? 1 : 0) + 
                                (categoriaPatrones.short > 0 ? 1 : 0);

        // Determinar tipo de señal con sistema de confirmación
        let tipoSenal = null;
        let razones = [];
        let probabilidad = 0;

        // Requiere al menos 2 de 3 categorías alineadas + puntuación mínima 40
        if (categoriasLong >= 2 && razonesLong.length > razonesShort.length && puntuacion >= 40) {
            tipoSenal = 'LONG';
            razones = razonesLong;
            // Aplicar factor de volumen si hay volumen alto
            probabilidad = Math.min(95, Math.round(puntuacion * factorVolumen));
        } else if (categoriasShort >= 2 && razonesShort.length > razonesLong.length && puntuacion >= 40) {
            tipoSenal = 'SHORT';
            razones = razonesShort;
            probabilidad = Math.min(95, Math.round(puntuacion * factorVolumen));
        }

        // Si no hay señal clara, retornar null
        if (!tipoSenal || razones.length < 3) {
            console.log(`Señal rechazada - Puntuación: ${puntuacion}, Razones: ${razones.length}, Categorías: ${tipoSenal === 'LONG' ? categoriasLong : categoriasShort}`);
            return null;
        }

        // Filtro de tendencia general - Solo tomar señales alineadas con tendencia superior
        if (tendenciaGeneral === 'alcista' && tipoSenal === 'SHORT') {
            console.log(`❌ Señal SHORT rechazada - Tendencia general es ALCISTA`);
            return null;
        } else if (tendenciaGeneral === 'bajista' && tipoSenal === 'LONG') {
            console.log(`❌ Señal LONG rechazada - Tendencia general es BAJISTA`);
            return null;
        }
        
        // Bonus si está alineada con tendencia fuerte
        if ((tendenciaGeneral === 'alcista' && tipoSenal === 'LONG') || 
            (tendenciaGeneral === 'bajista' && tipoSenal === 'SHORT')) {
            probabilidad = Math.min(95, probabilidad + 5);
            razones.push(`Alineada con tendencia ${tendenciaGeneral} 4h`);

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

/**
 * Validar señales activas (ejecutar cada 5 minutos)
 * Verifica que las señales activas sigan siendo válidas según precio actual
 * y puede invalidarlas si el contexto cambió drásticamente
 */
async function validarSenalesActivas() {
    try {
        const precioActual = await precioService.getPrecioActual();
        const precio = precioActual.precio;

        // Obtener señales activas de las últimas 2 horas
        const [senales] = await db.query(`
            SELECT s.*, i.rsi, i.ema_20, i.ema_50 
            FROM senales s
            LEFT JOIN indicadores_senal i ON s.id = i.senal_id
            WHERE s.estado = 'activa' 
            AND s.fecha_creacion > DATE_SUB(NOW(), INTERVAL 2 HOUR)
        `);

        if (senales.length === 0) {
            return;
        }

        for (const senal of senales) {
            let debeInvalidarse = false;
            let motivoInvalidacion = '';

            // Validación 1: Precio se movió demasiado desde la entrada (>5%)
            const movimientoPorcentaje = Math.abs((precio - senal.precio_entrada) / senal.precio_entrada * 100);
            if (movimientoPorcentaje > 5) {
                debeInvalidarse = true;
                motivoInvalidacion = `Precio se movió ${movimientoPorcentaje.toFixed(1)}% desde entrada`;
            }

            // Validación 2: Ya alcanzó stop loss (aunque verificación cada 10 min lo detectará)
            if (senal.tipo === 'LONG' && precio <= senal.stop_loss) {
                debeInvalidarse = true;
                motivoInvalidacion = 'Stop Loss alcanzado';
            } else if (senal.tipo === 'SHORT' && precio >= senal.stop_loss) {
                debeInvalidarse = true;
                motivoInvalidacion = 'Stop Loss alcanzado';
            }

            // Validación 3: Contexto de mercado cambió (verificar con datos recientes)
            // Esto requeriría análisis en tiempo real más complejo
            // Por ahora solo validamos movimientos de precio extremos

            if (debeInvalidarse) {
                await db.query(`
                    UPDATE senales 
                    SET estado = 'invalidada', 
                        notas = CONCAT(COALESCE(notas, ''), ' - Invalidada: ${motivoInvalidacion}')
                    WHERE id = ?
                `, [senal.id]);

                console.log(`⚠️  Señal #${senal.id} (${senal.tipo}) invalidada: ${motivoInvalidacion}`);
            }
        }

    } catch (error) {
        console.error('Error validando señales activas:', error);
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
    guardarSenal,
    validarSenalesActivas
};
