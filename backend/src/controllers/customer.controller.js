const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const walletService = require('../services/wallet.service');
const shopifyService = require('../services/shopify.service');
const { getRedis } = require('../config/redis');
const { normalizeEmail, assignMemberNumber, getMemberNumber } = require('../services/member');
const logger = require('../config/logger');

async function getOrCreateCustomer(req, res, next) {
  try {
    const { shopifyCustomerId, firstName, lastName, phone } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email && !shopifyCustomerId) {
      return res.status(400).json({ error: 'Email o shopifyCustomerId requerido' });
    }

    // Busca por Shopify ID y también por email: un mismo cliente puede llegar
    // por la tienda online y por caja, y no debe terminar con dos cuentas.
    let customer = null;
    if (shopifyCustomerId) {
      customer = await prisma.customer.findUnique({ where: { shopifyCustomerId } });
    }
    if (!customer && email) {
      customer = await prisma.customer.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      // Enlaza la cuenta existente con Shopify en vez de duplicarla
      if (customer && shopifyCustomerId && !customer.shopifyCustomerId) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { shopifyCustomerId },
        });
      }
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          shopifyCustomerId: shopifyCustomerId || null,
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          phone: phone || null,
        },
      });
      await assignMemberNumber(customer.id);
      await pointsService.addWelcomeBonus(customer.id);
      customer = await prisma.customer.findUnique({ where: { id: customer.id } });
    }

    const memberNumber = await getMemberNumber(customer.id);
    res.json({ customer: { ...customer, memberNumber } });
  } catch (err) {
    next(err);
  }
}

async function getCustomerByEmail(req, res, next) {
  try {
    const { email } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { email: decodeURIComponent(email).toLowerCase() },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({
      customer: {
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
      },
    });
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
    // El valor en dinero salía de la economía vieja (1 Pino = $1). Con canje por
    // categoría ya no hay una equivalencia fija, así que se usa el saldo en Pinos.
    const discount = await shopifyService.createDiscountCode(id, result.pinosRedeemed);

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
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true,
        availablePoints: true, lifetimePoints: true,
        level: true, walletPassSerial: true, walletPassToken: true,
        updatedAt: true,
      },
    });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (!walletService.areCertsAvailable()) {
      return res.status(503).json({
        error: 'Apple Wallet no configurado',
        instructions: 'Sigue las instrucciones en README.md para obtener los certificados',
      });
    }

    // El número de socio va bajo el QR del pass: si la cámara no lo lee, el
    // staff puede teclearlo.
    const memberNumber = await getMemberNumber(customer.id);
    const passBuffer = await walletService.generatePass({ ...customer, memberNumber });
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

async function quickRegisterFromPOS(req, res, next) {
  try {
    const { firstName, lastName, phone } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email) return res.status(400).json({ error: 'Email requerido' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ese correo no parece válido' });
    }
    if (!firstName || !String(firstName).trim()) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const existing = await prisma.customer.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      // No es un error para el staff: el cliente ya estaba dado de alta, así que
      // se le devuelve su ficha lista para cobrar en vez de un mensaje muerto.
      const memberNumber = await getMemberNumber(existing.id);
      return res.status(200).json({
        alreadyExisted: true,
        message: `${existing.firstName} ya estaba registrado — puedes cobrarle directo.`,
        customer: {
          id: existing.id,
          memberNumber,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          availablePoints: existing.availablePoints,
          lifetimePoints: existing.lifetimePoints,
          level: existing.level,
          recentTransactions: [],
        },
      });
    }

    const customer = await prisma.customer.create({
      data: {
        // shopifyCustomerId queda null: rellenarlo con "pos_<timestamp>" impedía
        // enlazar después la cuenta real de Shopify de este mismo cliente.
        shopifyCustomerId: null,
        email,
        firstName: String(firstName).trim(),
        lastName: String(lastName || '').trim(),
        phone: String(phone || '').trim() || null,
      },
    });

    const memberNumber = await assignMemberNumber(customer.id);
    await pointsService.addWelcomeBonus(customer.id);
    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });

    logger.info(`🆕 Cliente dado de alta en caja: ${email} (socio #${memberNumber}) por ${req.admin?.email || 'POS'}`);

    res.status(201).json({
      alreadyExisted: false,
      customer: {
        id: updated.id,
        memberNumber,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        availablePoints: updated.availablePoints,
        lifetimePoints: updated.lifetimePoints,
        level: updated.level,
        recentTransactions: [],
      },
    });
  } catch (err) {
    logger.error('quickRegisterFromPOS error:', err.message);
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
  quickRegisterFromPOS,
};
