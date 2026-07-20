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

app.listen(PORT, () => {
  logger.info(`🚀 House of Shake API en puerto ${PORT}`);

  const walletService = require('./services/wallet.service');
  const walletReady = walletService.areCertsAvailable();
  logger.info(`🍎 Apple Wallet: ${walletReady ? 'CONFIGURADO' : 'PENDIENTE'}`);
  if (walletReady) walletService.initCerts(); // warm up cert cache at startup

  // Start background jobs
  const { startInactiveCustomersJob } = require('./jobs/inactive-customers.job');
  const { startBackupJob } = require('./jobs/backup.job');
  startInactiveCustomersJob();
  startBackupJob();

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

  // 4. Fix welcomeBonus to 100 pts (= 10 Pinos) if still at old default of 50
  try {
    const cfg = await prisma.config.findFirst();
    if (cfg && cfg.welcomeBonus < 100) {
      await prisma.config.updateMany({ data: { welcomeBonus: 100 } });
      logger.info('✅ welcomeBonus actualizado a 100 (10 Pinos)');
    }
  } catch (e) { logger.warn('Config update:', e.message); }

  // 5. Seed products from menu if table is empty
  try {
    const productCount = await prisma.product.count();
    if (productCount === 0) {
      const pines = (price) => Math.ceil(price / 10) * 10; // points = pines*10
      const products = [
        // ── Cold Coffees (frío) ──────────────────────────────────
        { name: 'Iced Coffee',                              description: 'Café frío con hielo.',                                                                         price: 65,  pointsValue: pines(65),  category: 'frío',       sortOrder: 1  },
        { name: 'Iced Latte',                               description: 'Café espresso mezclado con leche y hielos (16oz).',                                             price: 70,  pointsValue: pines(70),  category: 'frío',       sortOrder: 2  },
        { name: 'Iced Vanilla Latte',                       description: 'Café espresso mezclado con jarabe sabor vainilla, leche y hielos (16oz).',                      price: 88,  pointsValue: pines(88),  category: 'frío',       sortOrder: 3  },
        { name: 'White Mocha',                              description: 'Café espresso mezclado con mocha blanco y leche con hielos (16oz).',                            price: 88,  pointsValue: pines(88),  category: 'frío',       sortOrder: 4  },
        { name: 'Caramel Macchiato',                        description: 'Caramel Macchiato con café, leche y caramelo, servido frío.',                                   price: 88,  pointsValue: pines(88),  category: 'frío',       sortOrder: 5  },
        { name: 'Mocha',                                    description: 'Café espresso mezclado con mocha y leche con hielos (16oz).',                                   price: 90,  pointsValue: pines(90),  category: 'frío',       sortOrder: 6  },
        { name: 'Iced Tiramisu Latte',                      description: 'Doble espresso frío, leche cremosa y vainilla/cacao, inspirado en el tiramisú.',                price: 95,  pointsValue: pines(95),  category: 'frío',       sortOrder: 7  },
        { name: 'Iced Latte & Lavander Cold Foam',          description: 'Latte con doble espresso, leche vaporizada y un toque de lavanda con cold foam.',               price: 95,  pointsValue: pines(95),  category: 'frío',       sortOrder: 8  },
        { name: 'Coconut Iced Latte & Coconut Cold Foam',   description: 'Latte helado con leche de coco y espuma fría de coco.',                                        price: 95,  pointsValue: pines(95),  category: 'frío',       sortOrder: 9  },
        { name: 'Pistachio Iced Latte & Pistachio Cold Foam', description: 'Latte con doble espresso, polvo de pistacho y cold foam de pistacho.',                       price: 95,  pointsValue: pines(95),  category: 'frío',       sortOrder: 10 },
        { name: 'Teddy Bear Latte',                         description: 'Latte frío con doble espresso, miel, vainilla y canela.',                                       price: 95,  pointsValue: pines(95),  category: 'frío',       sortOrder: 11 },
        { name: 'Iced Brown Sugar Oatmilk Shaken Espresso', description: 'Espresso con azúcar morena, leche de avena y hielo, agitado.',                                 price: 96,  pointsValue: pines(96),  category: 'frío',       sortOrder: 12 },
        { name: 'Vienna Iced Latte',                        description: 'Espresso fuerte con leche fría cubierta con dos capas de cold foam.',                           price: 96,  pointsValue: pines(96),  category: 'frío',       sortOrder: 13 },
        { name: 'Sunset Tonic',                             description: 'Tónica con jugo cítrico y cold brew o doble espresso. Refrescante y único.',                   price: 111, pointsValue: pines(111), category: 'frío',       sortOrder: 14 },
        // ── Cold Brew (frío) ─────────────────────────────────────
        { name: 'Cold Brew',                                description: 'Café infusionado en frío por 20 horas para un sabor suave y concentrado.',                     price: 98,  pointsValue: pines(98),  category: 'frío',       sortOrder: 15 },
        { name: 'Vanilla Sweet Cream Cold Brew',            description: 'Cold brew con crema dulce de vainilla.',                                                        price: 105, pointsValue: pines(105), category: 'frío',       sortOrder: 16 },
        // ── Matcha (especiales) ──────────────────────────────────
        { name: 'Iced Matcha',                              description: 'Té verde matcha batido con hielo y leche. Sabor suave y herbáceo.',                             price: 89,  pointsValue: pines(89),  category: 'especiales', sortOrder: 17 },
        { name: 'Iced Matcha Lemonade',                     description: 'Té verde matcha mezclado con limonada. Refrescante y equilibrado.',                             price: 88,  pointsValue: pines(88),  category: 'especiales', sortOrder: 18 },
        { name: 'Iced Matcha & Lavander Cold Foam',         description: 'Matcha frío con cold foam de lavanda. Refrescante y floral.',                                   price: 94,  pointsValue: pines(94),  category: 'especiales', sortOrder: 19 },
        { name: 'Iced Matcha & Mint Cold Foam',             description: 'Matcha frío con espuma fría de menta.',                                                         price: 94,  pointsValue: pines(94),  category: 'especiales', sortOrder: 20 },
        { name: 'Iced Salted Caramel Pretzel Matcha',       description: 'Matcha frío con caramelo salado y pretzel. Dulce y salado al mismo tiempo.',                   price: 94,  pointsValue: pines(94),  category: 'especiales', sortOrder: 21 },
        { name: 'Iced Tiramisu Matcha',                     description: 'Matcha frío con el sabor cremoso del tiramisú, cacao y vainilla.',                              price: 94,  pointsValue: pines(94),  category: 'especiales', sortOrder: 22 },
        { name: 'Passion Fruit Matcha',                     description: 'Matcha con maracuyá y limonada fresca. Cítrico y exótico.',                                     price: 96,  pointsValue: pines(96),  category: 'especiales', sortOrder: 23 },
        // ── Fitfresh (especiales) ────────────────────────────────
        { name: 'Ginger Mint Lemonade',                     description: 'Limonada con té de jengibre y menta. Vibrante y refrescante (16oz).',                          price: 89,  pointsValue: pines(89),  category: 'especiales', sortOrder: 24 },
        { name: 'Pink Coconut Drink',                       description: 'Bebida de coco y fresa con trozos de fresa y hielo. Tropical.',                                 price: 89,  pointsValue: pines(89),  category: 'especiales', sortOrder: 25 },
        { name: 'Strawberry Acai Lemonade',                 description: 'Extracto de café verde con concentrado de frutas, acai y fresa.',                               price: 89,  pointsValue: pines(89),  category: 'especiales', sortOrder: 26 },
        // ── Chai (especiales) ────────────────────────────────────
        { name: 'Chai',                                     description: 'Chai frío con hielo.',                                                                          price: 88,  pointsValue: pines(88),  category: 'especiales', sortOrder: 27 },
        { name: 'Dirty Chai',                               description: 'Mezcla de chai y café, servido frío con hielo. Lo mejor de dos mundos.',                        price: 93,  pointsValue: pines(93),  category: 'especiales', sortOrder: 28 },
        // ── Milkshakes (especiales) ──────────────────────────────
        { name: 'Vanilla Milkshake',                        description: 'Helado de vainilla, leche y extracto de vainilla (16oz).',                                     price: 99,  pointsValue: pines(99),  category: 'especiales', sortOrder: 29 },
        { name: 'Caramel Pretzel Milkshake',                description: 'Helado de vainilla, leche, caramelo y trozos de pretzel salado.',                              price: 110, pointsValue: pines(110), category: 'especiales', sortOrder: 30 },
        { name: 'Chocolate Milkshake',                      description: 'Helado de chocolate, leche y jarabe de chocolate.',                                             price: 110, pointsValue: pines(110), category: 'especiales', sortOrder: 31 },
        { name: 'Pistachio Milkshake',                      description: 'Batido cremoso con delicado sabor a pistacho.',                                                 price: 110, pointsValue: pines(110), category: 'especiales', sortOrder: 32 },
        { name: "S'more Milkshake",                         description: 'Helado de vainilla, malvavisco, galletas graham y chocolate.',                                  price: 110, pointsValue: pines(110), category: 'especiales', sortOrder: 33 },
        // ── Repostería (alimentos) ───────────────────────────────
        { name: 'Chocolate Cookie',                         description: 'Galleta de chocolate ideal para satisfacer un antojo dulce.',                                   price: 69,  pointsValue: pines(69),  category: 'alimentos',  sortOrder: 34 },
        { name: 'Lotus Cookie',                             description: 'Galleta Lotus con sabor a caramelo y especias. Para acompañar bebidas calientes.',              price: 69,  pointsValue: pines(69),  category: 'alimentos',  sortOrder: 35 },
        { name: 'Croissant',                                description: 'Clásico croissant de hojaldre, ideal para acompañar con café o té.',                            price: 74,  pointsValue: pines(74),  category: 'alimentos',  sortOrder: 36 },
        { name: 'Chocolatine',                              description: 'Chocolatine de hojaldre con relleno de chocolate.',                                             price: 74,  pointsValue: pines(74),  category: 'alimentos',  sortOrder: 37 },
        { name: 'Pumpkin Muffin',                           description: 'Muffin esponjoso con sabor a calabaza.',                                                        price: 79,  pointsValue: pines(79),  category: 'alimentos',  sortOrder: 38 },
      ];
      await prisma.product.createMany({ data: products.map(p => ({ ...p, active: true })) });
      logger.info(`✅ ${products.length} productos del menú sembrados`);
    }
  } catch (e) {
    logger.warn('Products seed:', e.message);
  }

  logger.info('🎉 Base de datos lista');
}

module.exports = app;
