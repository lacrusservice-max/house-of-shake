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

// CORS — permite Vercel, Railway, Shopify y localhost
const allowedOrigins = [
  `https://${process.env.SHOPIFY_STORE_URL}`,
  process.env.SHOPIFY_APP_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://house-of-shake.vercel.app',
].filter(Boolean);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir sin origin (apps móviles, Postman) y subdominios de vercel/railway
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app') || origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) return callback(null, true);
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

app.listen(PORT, async () => {
  logger.info(`🚀 House of Shake Loyalty API corriendo en puerto ${PORT}`);
  logger.info(`🏪 Tienda: https://${process.env.SHOPIFY_STORE_URL}`);
  logger.info(`🍎 Apple Wallet: ${require('./services/wallet.service').areCertsAvailable() ? 'CONFIGURADO' : 'PENDIENTE DE CERTIFICADOS'}`);

  // Ensure permanent accounts exist on every startup
  try {
    const bcrypt = require('bcrypt');
    const prisma = require('./config/prisma');
    const permanentAccounts = [
      { email: 'admin@houseofshake.com', name: 'Administrador HoS', password: process.env.ADMIN_PASSWORD || 'HoSAdmin2025!', role: 'admin' },
      { email: 'staff@houseofshake.com', name: 'Personal HoS', password: process.env.STAFF_PASSWORD || 'HoSStaff2025!', role: 'staff' },
    ];
    for (const acc of permanentAccounts) {
      const existing = await prisma.adminUser.findUnique({ where: { email: acc.email } });
      if (!existing) {
        await prisma.adminUser.create({
          data: { ...acc, password: await bcrypt.hash(acc.password, 12), permanent: true, active: true },
        });
        logger.info(`✅ Cuenta permanente creada: ${acc.email} (${acc.role})`);
      } else if (!existing.permanent) {
        await prisma.adminUser.update({ where: { email: acc.email }, data: { permanent: true } });
      }
    }
  } catch (e) {
    logger.warn('No se pudieron verificar cuentas permanentes:', e.message);
  }
});

module.exports = app;
