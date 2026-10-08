// La aplicación Express, sin escuchar en ningún puerto.
//
// Separado de index.js para que el mismo código sirva en dos formas de
// ejecución: un proceso normal que escucha un puerto (local) y una función
// sin servidor en Vercel, que recibe la app ya construida. Antes el archivo
// llamaba a app.listen() al importarlo, y eso hacía imposible lo segundo.
require('dotenv').config();

// Sentry — init before anything else so it captures all errors
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const logger = require('./config/logger');
const routes = require('./routes/index');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Sin servidor el disco es de solo lectura salvo /tmp, así que crear la
// carpeta de registros al arrancar reventaba con EROFS y tumbaba TODA la API.
const esServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const logDir = process.env.LOG_DIR || (esServerless ? '/tmp/logs' : './logs');
try {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch (e) {
  // Que no se pueda escribir un registro jamás debe impedir servir peticiones.
  console.warn('No se pudo crear la carpeta de registros:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  `https://${process.env.SHOPIFY_STORE_URL}`,
  process.env.SHOPIFY_APP_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://house-of-shake.vercel.app',
].filter(Boolean);

// Railway (and most PaaS) sit behind a load balancer — trust the first proxy
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app') || origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) return callback(null, true);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
}));

app.use(compression());

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

app.use('/widget', express.static(path.join(__dirname, '../../widget/dist'), {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
  },
}));

app.use('/api', routes);

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

module.exports = app;
