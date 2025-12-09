const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { getConfig, updateConfig } = require('../controllers/configController');

router.use(authenticateToken);

router.get('/', getConfig);
router.put('/', updateConfig);

module.exports = router;
