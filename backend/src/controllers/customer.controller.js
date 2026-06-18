const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const walletService = require('../services/wallet.service');
const shopifyService = require('../services/shopify.service');
const { getRedis } = require('../config/redis');
const logger = require('../config/logger');

async function getOrCreateCustomer(req, res, next) {
  try {
    const { email, shopifyCustomerId, firstName, lastName, phone } = req.body;

    if (!email && !shopifyCustomerId) {
      return res.status(400).json({ error: 'Email o shopifyCustomerId requerido' });
    }

    let customer = shopifyCustomerId
      ? await prisma.customer.findUnique({ where: { shopifyCustomerId } })
      : await prisma.customer.findUnique({ where: { email } });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          shopifyCustomerId: shopifyCustomerId || `manual_${Date.now()}`,
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          phone,
        },
      });
      await pointsService.addWelcomeBonus(customer.id);
      customer = await prisma.customer.findUnique({ where: { id: customer.id } });
    }

    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

async function getCustomerByEmail(req, res, next) {
  try {
    const { email } = req.params;
    const customer = await prisma.customer.findUnique({ where: { email: decodeURIComponent(email) } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

async function getCustomerTransactions(req, res, next) {
  try {
    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

async function redeemPoints(req, res, next) {
  try {
    const { id } = req.params;
    const { points } = req.body;

    if (!points || points < 1) {
      return res.status(400).json({ error: 'Puntos inválidos' });
    }

    const result = await pointsService.redeemPoints(id, points);

    // Crear código de descuento en Shopify
    const discount = await shopifyService.createDiscountCode(id, result.discountUsd);

    const customer = await prisma.customer.findUnique({ where: { id } });
    await walletService.sendPushUpdate(customer);

    res.json({ ...result, discountCode: discount.code });
  } catch (err) {
    if (err.message.includes('insuficientes') || err.message.includes('múltiplo')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function downloadWalletPass(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (!walletService.areCertsAvailable()) {
      return res.status(503).json({
        error: 'Apple Wallet no configurado',
        instructions: 'Sigue las instrucciones en README.md para obtener los certificados',
      });
    }

    const passBuffer = await walletService.generatePass(customer, {});
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="houseofshake.pkpass"`,
    });
    res.send(passBuffer);
  } catch (err) {
    next(err);
  }
}

async function getPublicProfile(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        availablePoints: true,
        level: true,
        lifetimePoints: true,
        walletPassSerial: true,
      },
    });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrCreateCustomer,
  getCustomerByEmail,
  getCustomerById,
  getCustomerTransactions,
  redeemPoints,
  downloadWalletPass,
  getPublicProfile,
};
