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
    // Número de socio visible (1001, 1002, …) — el cliente lo dicta en caja y
    // el staff lo busca sin necesidad de QR ni de deletrear un UUID.
    await prisma.$executeRawUnsafe(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS member_number INTEGER;`);
    // Solicitud de canje: el cliente elige un producto en su cuenta y el staff
    // lo ve al identificarlo, sin importar si llegó por QR web, por el pass de
    // Wallet o buscándolo por nombre.
    await prisma.$executeRawUnsafe(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS pending_product_id TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS pending_since TIMESTAMPTZ;`);
    // Licencia de servicio. Arranca en NULL = sin límite, para que desplegar
    // esto NUNCA apague un sistema que estaba operando.
    await prisma.$executeRawUnsafe(`ALTER TABLE config ADD COLUMN IF NOT EXISTS license_until TIMESTAMPTZ;`);
    logger.info('✅ Schema actualizado');
  } catch (e) {
    logger.warn('Schema (puede que ya estén las columnas):', e.message);
  }

  // 1b. FUSIONA cuentas duplicadas por email.
  //
  //     Bug de origen: el registro guardaba el email tal cual lo tecleaba el
  //     cliente, así que "Juan@Gmail.com" y "juan@gmail.com" creaban DOS
  //     cuentas. El staff sumaba Pinos a una y el cliente entraba a la otra —
  //     por eso "se acumulaban" pero su cuenta nunca se actualizaba.
  //
  //     Se conserva la cuenta más antigua, se le mueven transacciones y saldo
  //     de las demás, y las duplicadas se borran. Idempotente: si no hay
  //     duplicados no toca nada.
  try {
    const dupes = await prisma.$queryRawUnsafe(`
      SELECT LOWER(TRIM(email)) AS key, COUNT(*)::int AS n
      FROM customers GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1
    `);

    for (const { key } of dupes) {
      const accounts = await prisma.customer.findMany({
        where: { email: { equals: key, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      });
      if (accounts.length < 2) continue;

      const [keep, ...remove] = accounts;
      for (const dup of remove) {
        await prisma.transaction.updateMany({
          where: { customerId: dup.id },
          data: { customerId: keep.id },
        });
        await prisma.walletRegistration.updateMany({
          where: { customerId: dup.id },
          data: { customerId: keep.id },
        }).catch(() => {});
        await prisma.customer.update({
          where: { id: keep.id },
          data: {
            totalPoints:     { increment: dup.totalPoints },
            availablePoints: { increment: dup.availablePoints },
            lifetimePoints:  { increment: dup.lifetimePoints },
            // conserva el dato si la cuenta principal lo tenía vacío
            phone:    keep.phone    || dup.phone    || null,
            password: keep.password || dup.password || null,
          },
        });
        await prisma.customer.delete({ where: { id: dup.id } });
      }
      logger.info(`🔗 Fusionadas ${remove.length} cuentas duplicadas de ${key}`);
    }

    // Normaliza TODOS los emails a minúsculas para que no vuelva a pasar
    const normalized = await prisma.$executeRawUnsafe(
      `UPDATE customers SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))`
    );
    if (normalized > 0) logger.info(`📧 ${normalized} emails normalizados a minúsculas`);

    // Índice único case-insensitive: la BD misma impide crear otro duplicado
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS customers_email_lower_idx ON customers (LOWER(email))`
    );
  } catch (e) {
    logger.warn('Dedupe de emails:', e.message);
  }

  // 1c. Asigna número de socio a quien no lo tenga (arranca en 1001)
  try {
    await prisma.$executeRawUnsafe(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) + 1000
               + COALESCE((SELECT MAX(member_number) - 1000 FROM customers), 0) AS n
        FROM customers WHERE member_number IS NULL
      )
      UPDATE customers c SET member_number = numbered.n
      FROM numbered WHERE c.id = numbered.id
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS customers_member_number_idx ON customers (member_number)`
    );
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM customers WHERE member_number IS NOT NULL`
    );
    logger.info(`🎫 ${count} clientes con número de socio`);
  } catch (e) {
    logger.warn('Números de socio:', e.message);
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

  // 5. Sincroniza la tabla `products` con el menú público (src/data/menu.js).
  //    Es la MISMA lista que ve el cliente en la web, así que el catálogo de
  //    canje del staff nunca queda desfasado del menú real.
  //
  //    - Producto del menú que no existe en BD  → se crea
  //    - Producto del menú que sí existe        → se actualiza (precio, categoría, costo)
  //    - Producto en BD que ya NO está en menú  → se desactiva (active=false),
  //      nunca se borra: las transacciones históricas deben seguir siendo legibles.
  try {
    const { MENU_ITEMS } = require('./data/menu');
    const { puntosCostForCategory } = require('./services/pinos');

    const existing = await prisma.product.findMany();
    const byName = new Map(existing.map(p => [p.name.trim().toLowerCase(), p]));
    const menuNames = new Set(MENU_ITEMS.map(m => m.name.trim().toLowerCase()));

    let created = 0, updated = 0, retired = 0;

    for (const item of MENU_ITEMS) {
      const key = item.name.trim().toLowerCase();
      const pointsValue = puntosCostForCategory(item.category);
      const imageUrl = `https://house-of-shake.vercel.app/images/products/${item.image}.png`;
      const row = byName.get(key);

      if (!row) {
        await prisma.product.create({
          data: {
            name: item.name,
            description: item.description,
            price: item.price,
            pointsValue,
            category: item.category,
            imageUrl,
            sortOrder: item.sortOrder,
            active: true,
          },
        });
        created++;
      } else {
        const needsUpdate =
          row.price !== item.price ||
          row.pointsValue !== pointsValue ||
          row.category !== item.category ||
          row.imageUrl !== imageUrl ||
          row.active !== true;
        if (needsUpdate) {
          await prisma.product.update({
            where: { id: row.id },
            data: {
              description: item.description,
              price: item.price,
              pointsValue,
              category: item.category,
              imageUrl,
              sortOrder: item.sortOrder,
              active: true,
            },
          });
          updated++;
        }
      }
    }

    for (const row of existing) {
      if (!menuNames.has(row.name.trim().toLowerCase()) && row.active) {
        await prisma.product.update({ where: { id: row.id }, data: { active: false } });
        retired++;
      }
    }

    logger.info(`🌲 Menú sincronizado: ${created} nuevos, ${updated} actualizados, ${retired} retirados`);
  } catch (e) {
    logger.warn('Sync de menú:', e.message);
  }

  logger.info('🎉 Base de datos lista');
}

module.exports = app;
