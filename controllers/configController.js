const db = require('../config/database');

// Obtener configuración del usuario
async function getConfig(req, res) {
    try {
        const usuarioId = req.usuarioId;

        const [config] = await db.query(
            'SELECT * FROM configuracion_usuario WHERE usuario_id = ?',
            [usuarioId]
        );

        if (config.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuración no encontrada'
            });
        }

        res.json({
            success: true,
            data: config[0]
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener configuración'
        });
    }
}

// Actualizar configuración
async function updateConfig(req, res) {
    try {
        const usuarioId = req.usuarioId;
        const {
            timeframePreferido,
            probabilidadMinima,
            ratioRiesgoBeneficioMinimo,
            tipoSenales,
            alertasSonido,
            alertasEmail,
            agresividad,
            balanceVirtual
        } = req.body;

        await db.query(
            `UPDATE configuracion_usuario
       SET timeframe_preferido = ?,
           probabilidad_minima = ?,
           ratio_riesgo_beneficio_minimo = ?,
           tipo_senales = ?,
           alertas_sonido = ?,
           alertas_email = ?,
           agresividad = ?,
           balance_virtual = ?
       WHERE usuario_id = ?`,
            [
                timeframePreferido,
                probabilidadMinima,
                ratioRiesgoBeneficioMinimo,
                tipoSenales,
                alertasSonido,
                alertasEmail,
                agresividad,
                balanceVirtual,
                usuarioId
            ]
        );

        res.json({
            success: true,
            message: 'Configuración actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar configuración'
        });
    }
}

module.exports = {
    getConfig,
    updateConfig
};
