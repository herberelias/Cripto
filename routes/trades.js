const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
    getTrades,
    abrirTrade,
    cerrarTrade,
    getEstadisticas
} = require('../controllers/tradeController');

router.use(authenticateToken);

router.get('/', getTrades);
router.post('/', abrirTrade);
router.put('/:id/cerrar', cerrarTrade);
router.get('/estadisticas', getEstadisticas);

module.exports = router;
