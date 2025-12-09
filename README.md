# Crypto Señales - Backend

Sistema de señales de trading de criptomonedas con análisis técnico automatizado.

## Características

- ✅ Autenticación JWT
- ✅ Generación automática de señales cada 30 segundos
- ✅ Análisis técnico con RSI, MACD, EMAs, Bollinger Bands
- ✅ Sistema de puntuación para señales
- ✅ Trades simulados (paper trading)
- ✅ Estadísticas y seguimiento de rendimiento
- ✅ Precios en tiempo real de Binance

## Instalación

```bash
# Instalar dependencias
npm install

# Copiar archivo de configuración
cp .env.example .env

# Editar .env con tus credenciales de MySQL
```

## Configuración

Edita el archivo `.env`:

```
PORT=3001
DB_HOST=localhost
DB_USER=crypto_user
DB_PASSWORD=CryptoSenales2025!
DB_NAME=crypto_senales
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES_IN=7d
```

## Uso

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## Endpoints API

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/profile` - Obtener perfil

### Señales
- `GET /api/senales/activas` - Señales activas
- `GET /api/senales/historial` - Historial
- `GET /api/senales/:id` - Detalle de señal
- `GET /api/senales/precio/actual` - Precio BTC actual
- `GET /api/senales/precio/historico` - Histórico 24h

### Trades
- `GET /api/trades` - Trades del usuario
- `POST /api/trades` - Abrir trade
- `PUT /api/trades/:id/cerrar` - Cerrar trade
- `GET /api/trades/estadisticas` - Estadísticas

### Configuración
- `GET /api/config` - Obtener configuración
- `PUT /api/config` - Actualizar configuración

## Tecnologías

- Node.js + Express
- MySQL
- JWT Authentication
- Binance API
- Technical Indicators
- Node-cron

## Autor

Sistema de señales de trading automatizado
