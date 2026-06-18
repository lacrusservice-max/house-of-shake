const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const walletService = require('../services/wallet.service');
const logger = require('../config/logger');

// Staff scans QR code → look up customer by walletPassSerial or id
async function lookupCustomer(req, res) {
  const { code } = req.params; // UUID (customer.id) encoded in QR
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: code },
          { walletPassSerial: code },
        ],
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    res.json({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      availablePoints: customer.availablePoints,
      totalPoints: customer.totalPoints,
      lifetimePoints: customer.lifetimePoints,
      level: customer.level,
      recentTransactions: customer.transactions,
    });
  } catch (err) {
    logger.error('POS lookupCustomer error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// Staff adds points for a physical purchase
async function addPointsForPurchase(req, res) {
  const { customerId } = req.params;
  const { amount, description } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const result = await pointsService.addPoints(
      customerId,
      parseFloat(amount),
      null,
      null,
      description || `Compra física $${parseFloat(amount).toFixed(2)}`
    );

    const updated = await prisma.customer.findUnique({ where: { id: customerId } });
    await walletService.sendPushUpdate(updated).catch(() => {});

    res.json({
      success: true,
      pointsAdded: result.pointsAdded,
      newBalance: result.newBalance,
      level: result.level,
    });
  } catch (err) {
    logger.error('POS addPoints error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// Staff redeems points for a customer
async function redeemPoints(req, res) {
  const { customerId } = req.params;
  const { points } = req.body;

  if (!points || points <= 0) {
    return res.status(400).json({ error: 'Puntos inválidos' });
  }

  try {
    const result = await pointsService.redeemPoints(customerId, parseInt(points));
    const updated = await prisma.customer.findUnique({ where: { id: customerId } });
    await walletService.sendPushUpdate(updated).catch(() => {});

    res.json({
      success: true,
      pointsRedeemed: parseInt(points),
      discountUsd: result.discountUsd,
      newBalance: result.newBalance,
    });
  } catch (err) {
    logger.error('POS redeemPoints error:', err.message);
    res.status(400).json({ error: err.message });
  }
}

module.exports = { lookupCustomer, addPointsForPurchase, redeemPoints };
