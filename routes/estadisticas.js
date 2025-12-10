const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
    getEstadisticasGlobales,
    getEstadisticasPorPuntuacion,
    getEstadisticasPorTipo,
    getRendimientoHistorico,
    getResultadosSenales
} = require('../controllers/estadisticasController');

router.use(authenticateToken);

// Rutas de estadísticas
router.get('/globales', getEstadisticasGlobales);
router.get('/por-puntuacion', getEstadisticasPorPuntuacion);
router.get('/por-tipo', getEstadisticasPorTipo);
router.get('/rendimiento', getRendimientoHistorico);
router.get('/resultados', getResultadosSenales);

module.exports = router;
