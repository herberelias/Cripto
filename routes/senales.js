const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
    getSenalesActivas,
    getHistorial,
    getSenal,
    getPrecioActual,
    getHistorico
} = require('../controllers/senalController');

router.use(authenticateToken);

router.get('/activas', getSenalesActivas);
router.get('/historial', getHistorial);
router.get('/precio/actual', getPrecioActual);
router.get('/precio/historico', getHistorico);
router.get('/:id', getSenal);

module.exports = router;
