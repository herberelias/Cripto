const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { iniciarCronSenales } = require('./cron/senalCron');
const { iniciarVerificacionCron } = require('./cron/verificacionCron');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/senales', require('./routes/senales'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/config', require('./routes/config'));
app.use('/api/estadisticas', require('./routes/estadisticas'));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'Crypto Señales API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            senales: '/api/senales',
            trades: '/api/trades',
            config: '/api/config',
            estadisticas: '/api/estadisticas'
        }
    });
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📡 API disponible en http://localhost:${PORT}`);

    // Iniciar cron de señales
    iniciarCronSenales();

    // Iniciar cron de verificación
    iniciarVerificacionCron();
});
