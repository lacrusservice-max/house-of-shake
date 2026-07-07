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

const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  `https://${process.env.SHOPIFY_STORE_URL}`,
  process.env.SHOPIFY_APP_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://house-of-shake.vercel.app',
].filter(Boolean);

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

app.listen(PORT, () => {
  logger.info(`🚀 House of Shake API en puerto ${PORT}`);

  const walletService = require('./services/wallet.service');
  const walletReady = walletService.areCertsAvailable();
  logger.info(`🍎 Apple Wallet: ${walletReady ? 'CONFIGURADO' : 'PENDIENTE'}`);
  if (walletReady) walletService.initCerts(); // warm up cert cache at startup

  // Run DB setup async — does NOT block server startup or healthcheck
  setImmediate(() => setupDatabase());
});

async function setupDatabase() {
  const prisma = require('./config/prisma');
  const bcrypt = require('bcrypt');

  try {
    // 1. Add new columns safely with IF NOT EXISTS (idempotent)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS permanent BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "staffId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "staffEmail" TEXT;
    `);
    // Loyalty extended columns
    await prisma.$executeRawUnsafe(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS visit_count INTEGER NOT NULL DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday_reward_year INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE config ADD COLUMN IF NOT EXISTS double_points_enabled BOOLEAN NOT NULL DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE config ADD COLUMN IF NOT EXISTS double_points_expiry TIMESTAMPTZ;`);
    logger.info('✅ Schema actualizado');
  } catch (e) {
    logger.warn('Schema (puede que ya estén las columnas):', e.message);
  }

  // 2. Create permanent accounts (upsert — safe to run every deploy)
  const accounts = [
    {
      email: 'admin@houseofshake.com',
      name: 'Administrador House of Shake',
      password: process.env.ADMIN_PASSWORD || 'HoSAdmin2025!',
      role: 'admin',
    },
    {
      email: 'staff@houseofshake.com',
      name: 'Personal House of Shake',
      password: process.env.STAFF_PASSWORD || 'HoSStaff2025!',
      role: 'staff',
    },
  ];

  for (const acc of accounts) {
    try {
      const existing = await prisma.adminUser.findUnique({ where: { email: acc.email } });
      const hashed = await bcrypt.hash(acc.password, 10);

      if (!existing) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO admin_users (id, email, name, password, role, active, permanent, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, true, NOW(), NOW())`,
          acc.email, acc.name, hashed, acc.role,
        );
        logger.info(`✅ Cuenta creada: ${acc.email} (${acc.role})`);
      } else {
        // Ensure it's marked active and permanent
        await prisma.$executeRawUnsafe(
          `UPDATE admin_users SET active = true, permanent = true, "updatedAt" = NOW() WHERE email = $1`,
          acc.email,
        );
        logger.info(`✔ Cuenta ya existe: ${acc.email}`);
      }
    } catch (e) {
      logger.error(`Error con cuenta ${acc.email}:`, e.message);
    }
  }

  // 3. Update existing admin account password to match env var if set
  if (process.env.ADMIN_PASSWORD) {
    try {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await prisma.$executeRawUnsafe(
        `UPDATE admin_users SET password = $1, "updatedAt" = NOW() WHERE email = 'admin@houseofshake.com'`,
        hashed,
      );
      logger.info('✅ Contraseña de admin sincronizada con env var');
    } catch (e) { /* ignore */ }
  }

  logger.info('🎉 Base de datos lista');
}

module.exports = app;
