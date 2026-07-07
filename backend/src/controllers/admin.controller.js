const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const https = require('https');
const prisma = require('../config/prisma');
const { getRedis } = require('../config/redis');
const pointsService = require('../services/points.service');
const walletService = require('../services/wallet.service');
const shopifyService = require('../services/shopify.service');
const logger = require('../config/logger');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    // active may not exist yet if columns haven't been added — treat null/undefined as active
    if (!admin || admin.active === false) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    }).catch(() => {});

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (err) {
    next(err);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCustomers,
      totalPoints,
      redemptionsToday,
      recentTransactions,
      newCustomersThisMonth,
      pointsEarnedThisMonth,
      activeCustomers30d,
      topCustomers,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.aggregate({ _sum: { availablePoints: true } }),
      prisma.transaction.count({ where: { type: 'REDEEM', createdAt: { gte: todayStart } } }),
      prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.transaction.aggregate({
        where: { type: 'EARN', createdAt: { gte: monthStart } },
        _sum: { points: true },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
      prisma.customer.findMany({
        orderBy: { lifetimePoints: 'desc' },
        take: 5,
        select: { firstName: true, lastName: true, lifetimePoints: true, level: true },
      }),
    ]);

    const levelCounts = await prisma.customer.groupBy({
      by: ['level'],
      _count: { level: true },
    });

    res.json({
      totalCustomers,
      totalAvailablePoints: totalPoints._sum.availablePoints || 0,
      redemptionsToday,
      recentTransactions,
      levelDistribution: levelCounts,
      newCustomersThisMonth,
      pointsEarnedThisMonth: pointsEarnedThisMonth._sum.points || 0,
      activeCustomers30d: activeCustomers30d.length,
      topCustomers,
    });
  } catch (err) {
    next(err);
  }
}

async function listCustomers(req, res, next) {
  try {
    const { page = 1, limit = 20, search, level } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (level) where.level = level;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.customer.count({ where }),
    ]);

    res.json({ customers, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
}

async function listTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20, type, customerId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (type) where.type = type;
    if (customerId) where.customerId = customerId;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
}

async function getConfig(req, res, next) {
  try {
    const config = await prisma.config.findFirst();
    res.json({ config });
  } catch (err) {
    next(err);
  }
}

async function updateConfig(req, res, next) {
  try {
    const updates = req.body;
    const config = await prisma.config.updateMany({ data: updates });

    // Invalidar caché de config
    const redis = getRedis();
    await redis.del('config:points');

    res.json({ success: true, config });
  } catch (err) {
    next(err);
  }
}

async function forceUpdateWalletPass(req, res, next) {
  try {
    const { customerId } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    await walletService.sendPushUpdate(customer);
    res.json({ success: true, message: `Push enviado a ${customer.email}` });
  } catch (err) {
    next(err);
  }
}

async function adjustPoints(req, res, next) {
  try {
    const { customerId } = req.params;
    const { points, description } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: {
          availablePoints: { increment: points },
          totalPoints: { increment: points },
          lifetimePoints: points > 0 ? { increment: points } : undefined,
        },
      }),
      prisma.transaction.create({
        data: {
          customerId,
          type: 'ADJUSTMENT',
          points,
          description: description || `Ajuste manual por admin`,
        },
      }),
    ]);

    await walletService.sendPushUpdate(customer);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function exportCustomersCSV(req, res, next) {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const header = 'ID,Email,Nombre,Puntos Disponibles,Puntos Totales,Nivel,Creado\n';
    const rows = customers.map(c =>
      `"${c.id}","${c.email}","${c.firstName} ${c.lastName}",${c.availablePoints},${c.lifetimePoints},"${c.level}","${c.createdAt.toISOString()}"`
    ).join('\n');

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes_${Date.now()}.csv"`,
    });
    res.send('﻿' + header + rows);
  } catch (err) {
    next(err);
  }
}

async function setupShopify(req, res, next) {
  try {
    const baseUrl = process.env.API_BASE_URL;
    const [webhooks, scriptTag] = await Promise.all([
      shopifyService.registerWebhooks(baseUrl),
      shopifyService.registerScriptTag(baseUrl).catch(e => ({ error: e.message })),
    ]);

    res.json({ webhooks, scriptTag });
  } catch (err) {
    next(err);
  }
}

async function getWalletStatus(req, res, next) {
  try {
    const status = walletService.getWalletStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

/** Download Apple WWDR G4 certificate from Apple's public server */
async function downloadWwdr(req, res, next) {
  try {
    const WWDR_URL = 'https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer';
    const buf = await new Promise((resolve, reject) => {
      https.get(WWDR_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Apple server returned ${response.statusCode}`));
          return;
        }
        const chunks = [];
        response.on('data', c => chunks.push(c));
        response.on('end',  () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
    // Return as base64 for env var use OR as PEM-like base64 for file use
    res.json({
      success: true,
      base64: buf.toString('base64'),
      size: buf.length,
      instructions: 'Copy the base64 value above and set it as WWDR_CERT_BASE64 environment variable in Railway.',
    });
  } catch (err) {
    next(err);
  }
}

/** Generate a test pass using the most recent customer (for validation). */
async function testWalletPass(req, res, next) {
  try {
    const status = walletService.getWalletStatus();
    if (!status.ready) {
      return res.status(400).json({ error: 'Wallet no configurado', checks: status.checks });
    }
    const customer = await prisma.customer.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!customer) return res.status(404).json({ error: 'No hay clientes registrados aún' });

    const passBuffer = await walletService.generatePass(customer);
    if (!passBuffer) return res.status(503).json({ error: 'Error generando el pase' });

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename="test_houseofshake.pkpass"',
    });
    res.send(passBuffer);
  } catch (err) {
    logger.error('testWalletPass error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Generate a test pass with fake data — does NOT touch the DB.
 * Useful for validating cert config before having any real customers.
 * GET /api/admin/wallet/test-generate
 */
async function testGeneratePass(req, res, next) {
  try {
    const status = walletService.getWalletStatus();
    if (!status.ready) {
      return res.status(400).json({ error: 'Wallet no configurado', checks: status.checks });
    }

    const fakeCustomer = {
      id:              '00000000-0000-0000-0000-000000000001',
      firstName:       'Cliente',
      lastName:        'Prueba',
      availablePoints: 150,
      lifetimePoints:  250,
      level:           'SILVER',
      walletPassSerial: `TEST-${Date.now()}`,
      walletPassToken:  `testtoken${Date.now()}00000000`,
    };

    const { buffer } = await walletService.generatePassBuffer(fakeCustomer);

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename="test_demo_houseofshake.pkpass"',
    });
    res.send(buffer);
  } catch (err) {
    logger.error('testGeneratePass error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── STAFF MANAGEMENT ──────────────────────────────────────────────
async function listStaff(req, res, next) {
  try {
    const staff = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, email: true, name: true, role: true,
        active: true, permanent: true, lastLogin: true, createdAt: true,
      },
    });
    res.json({ staff });
  } catch (err) { next(err); }
}

async function createStaff(req, res, next) {
  try {
    const { email, name, password, role = 'staff' } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, nombre y contraseña requeridos' });
    }
    if (!['staff', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.adminUser.create({
      data: { email, name, password: hashed, role, active: true, permanent: false },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    res.status(201).json({ user });
  } catch (err) { next(err); }
}

async function updateStaff(req, res, next) {
  try {
    const { id } = req.params;
    const { name, active, password } = req.body;

    const user = await prisma.adminUser.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.permanent && active === false) {
      return res.status(403).json({ error: 'No se puede desactivar una cuenta permanente' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (active !== undefined) data.active = active;
    if (password) data.password = await bcrypt.hash(password, 12);

    const updated = await prisma.adminUser.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, active: true, permanent: true },
    });
    res.json({ user: updated });
  } catch (err) { next(err); }
}

// ── FINANCIAL STATS ───────────────────────────────────────────────
async function getFinancialStats(req, res, next) {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'today') {
      startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(0);
    }

    const config = await prisma.config.findFirst();
    const redeemRatio = config ? (config.redeemValueUsd / config.pointsToRedeem) : 0.05;

    const [earnTxs, redeemTxs, monthlyEarn, staffActivity] = await Promise.all([
      // Ingresos (ventas registradas en POS con orderAmount)
      prisma.transaction.aggregate({
        where: { type: 'EARN', createdAt: { gte: startDate }, orderAmount: { not: null } },
        _sum: { orderAmount: true, points: true },
        _count: true,
      }),
      // Canjes (descuentos otorgados)
      prisma.transaction.aggregate({
        where: { type: 'REDEEM', createdAt: { gte: startDate } },
        _sum: { points: true },
        _count: true,
      }),
      // Ingresos por día (últimos 30 días para gráfica)
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as fecha,
          SUM("orderAmount") as ingresos,
          COUNT(*) as transacciones
        FROM transactions
        WHERE type = 'EARN'
          AND "orderAmount" IS NOT NULL
          AND "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY fecha ASC
      `,
      // Actividad por staff
      prisma.transaction.groupBy({
        by: ['staffEmail'],
        where: {
          createdAt: { gte: startDate },
          staffEmail: { not: null },
          type: { in: ['EARN', 'REDEEM'] },
        },
        _count: true,
        _sum: { orderAmount: true },
      }),
    ]);

    const totalIngresos = earnTxs._sum.orderAmount || 0;
    const totalCanjes = Math.abs(redeemTxs._sum.points || 0);
    const totalDescuentos = totalCanjes * redeemRatio;

    res.json({
      period,
      ingresos: {
        total: totalIngresos,
        transacciones: earnTxs._count,
        puntos_otorgados: earnTxs._sum.points || 0,
      },
      canjes: {
        total_puntos: totalCanjes,
        total_descuento_mxn: totalDescuentos,
        transacciones: redeemTxs._count,
      },
      balance_neto: totalIngresos - totalDescuentos,
      grafica_diaria: monthlyEarn,
      actividad_staff: staffActivity.map(s => ({
        staff: s.staffEmail,
        transacciones: s._count,
        ingresos: s._sum.orderAmount || 0,
      })),
    });
  } catch (err) { next(err); }
}

async function getBirthdayCustomers(req, res, next) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT c.id, c."firstName", c."lastName", c.email, c.level,
             c."availablePoints", c."lifetimePoints",
             ext.birthday, ext.birthday_reward_year, ext.visit_count
      FROM customers c
      JOIN LATERAL (
        SELECT birthday, birthday_reward_year, visit_count
        FROM customers WHERE id = c.id
      ) ext ON TRUE
      WHERE EXTRACT(MONTH FROM ext.birthday) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(DAY FROM ext.birthday) = EXTRACT(DAY FROM NOW())
      ORDER BY c."firstName"
    `).catch(() => []);

    res.json({ customers: rows, count: rows.length });
  } catch (err) { next(err); }
}

async function toggleDoublePoints(req, res, next) {
  try {
    const { enabled, hours = 24 } = req.body;
    if (enabled) {
      const expiry = new Date(Date.now() + hours * 60 * 60 * 1000);
      await prisma.$executeRawUnsafe(
        `UPDATE config SET double_points_enabled = true, double_points_expiry = $1`,
        expiry.toISOString()
      );
      res.json({ success: true, enabled: true, expiresAt: expiry, message: `Puntos dobles activados por ${hours}h 🔥` });
    } else {
      await prisma.$executeRawUnsafe(`UPDATE config SET double_points_enabled = false, double_points_expiry = NULL`);
      res.json({ success: true, enabled: false, message: 'Puntos dobles desactivados' });
    }
    // Invalidate config cache
    const redis = getRedis();
    await redis.del('config:points').catch(() => {});
  } catch (err) { next(err); }
}

async function getDoublePointsStatus(req, res, next) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT double_points_enabled, double_points_expiry FROM config LIMIT 1`
    ).catch(() => [{}]);
    const r = rows[0] || {};
    const active = r.double_points_enabled && (!r.double_points_expiry || new Date(r.double_points_expiry) > new Date());
    res.json({ enabled: !!active, expiresAt: r.double_points_expiry || null });
  } catch (err) { next(err); }
}

module.exports = {
  login,
  getDashboardStats,
  listCustomers,
  listTransactions,
  getConfig,
  updateConfig,
  forceUpdateWalletPass,
  adjustPoints,
  exportCustomersCSV,
  setupShopify,
  getWalletStatus,
  downloadWwdr,
  testWalletPass,
  testGeneratePass,
  listStaff,
  createStaff,
  updateStaff,
  getFinancialStats,
  getBirthdayCustomers,
  toggleDoublePoints,
  getDoublePointsStatus,
};
