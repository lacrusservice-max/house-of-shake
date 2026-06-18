require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const logger = require('./config/logger');
const routes = require('./routes/index');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Crear directorio de logs si no existe
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configurado para tienda Shopify
const allowedOrigins = [
  `https://${process.env.SHOPIFY_STORE_URL}`,
  process.env.SHOPIFY_APP_URL,
  'http://localhost:3000',
  'http://localhost:5173', // Dashboard dev
].filter(Boolean);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
}));

app.use(compression());

// Capturar raw body ANTES de parsear JSON (necesario para validar webhooks Shopify)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/webhooks/')) {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      req.rawBody = data;
      req.body = JSON.parse(data || '{}');
      next();
    });
  } else {
    next();
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir el widget estático
app.use('/widget', express.static(path.join(__dirname, '../../widget/dist'), {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
  },
}));

// API Routes
app.use('/api', routes);

// Swagger Docs (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerDoc = require('./swagger.json');
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    logger.info(`Swagger docs: http://localhost:${PORT}/docs`);
  } catch (e) {
    logger.debug('Swagger no disponible');
  }
}

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 House of Shake Loyalty API corriendo en puerto ${PORT}`);
  logger.info(`🏪 Tienda: https://${process.env.SHOPIFY_STORE_URL}`);
  logger.info(`🍎 Apple Wallet: ${require('./services/wallet.service').areCertsAvailable() ? 'CONFIGURADO' : 'PENDIENTE DE CERTIFICADOS'}`);
});

module.exports = app;
