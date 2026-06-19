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
    if (!admin) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
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

/** Generate a test pass for the logged-in admin (for validation) */
async function testWalletPass(req, res, next) {
  try {
    const status = walletService.getWalletStatus();
    if (!status.ready) {
      return res.status(400).json({
        error: 'Wallet no configurado',
        checks: status.checks,
      });
    }
    // Use first customer as test
    const customer = await prisma.customer.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!customer) return res.status(404).json({ error: 'No hay clientes registrados aún' });

    const passBuffer = await walletService.generatePass(customer);
    if (!passBuffer) return res.status(503).json({ error: 'Error generando el pase' });

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="test_houseofshake.pkpass"`,
    });
    res.send(passBuffer);
  } catch (err) {
    logger.error('testWalletPass error:', err);
    res.status(500).json({ error: err.message });
  }
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
};
