const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const walletService = require('../services/wallet.service');
const { normalizeEmail, getMemberNumber } = require('../services/member');
const { puntosToPinos, formatPinos } = require('../services/pinos');
const logger = require('../config/logger');

// Returns products the customer can afford + products almost in reach
async function getAffordableProducts(availablePoints) {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ pointsValue: 'asc' }, { sortOrder: 'asc' }],
  });

  const affordable = products.filter(p => p.pointsValue <= availablePoints);
  const almostAffordable = products.filter(
    p => p.pointsValue > availablePoints && p.pointsValue <= availablePoints * 1.3 + 50
  ).slice(0, 3);

  return { affordable, almostAffordable };
}

// Staff scans QR → look up customer; staff sees limited data, admin sees full data
async function lookupCustomer(req, res) {
  const { code } = req.params;
  const isAdmin = req.admin?.role === 'admin';

  try {
    // El staff puede llegar por QR (id / serial del pass), por número de socio
    // (el cliente lo dicta) o por email — los tres resuelven al mismo cliente.
    const term = String(code || '').trim();
    const asMemberNumber = /^\d+$/.test(term) ? parseInt(term, 10) : null;

    const orConditions = [{ id: term }, { walletPassSerial: term }];
    if (term.includes('@')) {
      orConditions.push({ email: { equals: normalizeEmail(term), mode: 'insensitive' } });
    }
    if (asMemberNumber !== null) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id FROM customers WHERE member_number = $1 LIMIT 1`, asMemberNumber
      ).catch(() => []);
      if (rows?.[0]?.id) orConditions.push({ id: rows[0].id });
    }

    const customer = await prisma.customer.findFirst({
      where: { OR: orConditions },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, type: true, points: true,
            description: true, createdAt: true,
          },
        },
      },
    });

    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Extended fields (added via raw SQL)
    const extras = await prisma.$queryRawUnsafe(
      `SELECT birthday, visit_count, last_visit_at FROM customers WHERE id = $1`,
      customer.id
    ).catch(() => [{}]);
    const ext = extras[0] || {};

    const today = new Date();
    const bd = ext.birthday ? new Date(ext.birthday) : null;
    const isBirthday = bd && bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();

    // Check double points
    const dpRows = await prisma.$queryRawUnsafe(
      `SELECT double_points_enabled, double_points_expiry FROM config LIMIT 1`
    ).catch(() => [{}]);
    const dp = dpRows[0] || {};
    const doublePointsActive = dp.double_points_enabled && (!dp.double_points_expiry || new Date(dp.double_points_expiry) > new Date());

    const { affordable, almostAffordable } = await getAffordableProducts(customer.availablePoints);

    const config = await prisma.config.findFirst();
    const pointsToMxn = config ? (config.redeemValueUsd / config.pointsToRedeem) * 20 : 0.1;

    const memberNumber = await getMemberNumber(customer.id);

    const data = {
      id: customer.id,
      memberNumber,
      firstName: customer.firstName,
      lastName: isAdmin ? customer.lastName : (customer.lastName ? customer.lastName[0] + '.' : ''),
      availablePoints: customer.availablePoints,
      availablePinos: puntosToPinos(customer.availablePoints),
      availablePinosLabel: formatPinos(customer.availablePoints),
      totalPoints: customer.totalPoints,
      lifetimePoints: customer.lifetimePoints,
      level: customer.level,
      recentTransactions: customer.transactions,
      isBirthday: !!isBirthday,
      visitCount: Number(ext.visit_count) || 0,
      lastVisitAt: ext.last_visit_at || null,
      doublePointsActive: !!doublePointsActive,
      affordableProducts: affordable,
      almostAffordableProducts: almostAffordable,
      pointsValueMxn: parseFloat(pointsToMxn.toFixed(4)),
    };

    if (isAdmin) {
      data.email = customer.email;
      data.phone = customer.phone;
    }

    res.json(data);
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
      description || `Compra física $${parseFloat(amount).toFixed(2)} — ${req.admin?.email || 'POS'}`,
      req.admin?.id,
      req.admin?.email,
    );

    const updated = await prisma.customer.findUnique({ where: { id: customerId } });
    await walletService.sendPushUpdate(updated).catch(() => {});

    res.json({
      success: true,
      pointsAdded: result.pointsAdded,
      pinosAdded: puntosToPinos(result.pointsAdded),
      pinosAddedLabel: formatPinos(result.pointsAdded),
      newBalance: result.newBalance,
      newAvailablePoints: updated.availablePoints,
      newAvailablePinos: puntosToPinos(updated.availablePoints),
      newAvailablePinosLabel: formatPinos(updated.availablePoints),
      customerName: customer.firstName,
      doublePoints: result.doublePoints,
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
    const result = await pointsService.redeemPoints(
      customerId,
      parseInt(points),
      req.admin?.id,
      req.admin?.email,
    );
    const updated = await prisma.customer.findUnique({ where: { id: customerId } });
    await walletService.sendPushUpdate(updated).catch(() => {});

    const { affordable, almostAffordable } = await getAffordableProducts(result.newBalance);

    res.json({
      success: true,
      pointsRedeemed: parseInt(points),
      discountUsd: result.discountUsd,
      discountMxn: parseFloat((result.discountUsd * 20).toFixed(2)),
      newBalance: result.newBalance,
      affordableProducts: affordable,
      almostAffordableProducts: almostAffordable,
    });
  } catch (err) {
    logger.error('POS redeemPoints error:', err.message);
    res.status(400).json({ error: err.message });
  }
}

// Staff canjea bebida gratis — 120 Pinos = 1200 pts deducidos de availablePoints
async function redeemFreeDrink(req, res) {
  const { customerId } = req.params;
  const PINES_REQUERIDOS = 120;
  const PUNTOS_REQUERIDOS = PINES_REQUERIDOS * 10; // 1200

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const availPines = Math.floor(customer.availablePoints / 10);
    if (availPines < PINES_REQUERIDOS) {
      return res.status(400).json({
        error: `El cliente tiene ${availPines} Pinos. Necesita ${PINES_REQUERIDOS} para canjear la bebida gratis.`,
      });
    }

    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: { availablePoints: { decrement: PUNTOS_REQUERIDOS } },
      }),
      prisma.transaction.create({
        data: {
          customerId,
          type: 'REDEEM',
          points: -PUNTOS_REQUERIDOS,
          description: `🌲 Bebida gratis canjeada — 120 Pinos completados`,
          staffId: req.admin?.id || null,
          staffEmail: req.admin?.email || null,
        },
      }),
    ]);

    const newAvailablePoints = updatedCustomer.availablePoints;
    const newAvailPines      = Math.floor(newAvailablePoints / 10);
    const newPinesInCycle    = newAvailPines % PINES_REQUERIDOS;

    await walletService.sendPushUpdate({ ...customer, availablePoints: newAvailablePoints }).catch(() => {});

    logger.info(`🌲 Bebida gratis canjeada: ${PINES_REQUERIDOS} Pinos — cliente ${customerId}`);
    res.json({
      success: true,
      pinesRedeemed: PINES_REQUERIDOS,
      newAvailablePoints,
      newPinesInCycle,
      customerName: customer.firstName,
    });
  } catch (err) {
    logger.error('POS redeemFreeDrink error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// Staff canjea un PRODUCTO específico gratis — descuenta su costo en Pinos (pointsValue)
async function redeemProduct(req, res) {
  const { customerId } = req.params;
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId requerido' });

  try {
    const [customer, product] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (!product || !product.active) return res.status(404).json({ error: 'Producto no encontrado' });

    if (customer.availablePoints < product.pointsValue) {
      const faltanPinos = Math.ceil((product.pointsValue - customer.availablePoints) / 10);
      return res.status(400).json({
        error: `Pinos insuficientes. ${product.name} cuesta ${Math.round(product.pointsValue / 10)} Pinos y al cliente le faltan ${faltanPinos}.`,
        faltanPinos,
      });
    }

    const pinosCost = Math.round(product.pointsValue / 10);
    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: {
          availablePoints: { decrement: product.pointsValue },
          totalPoints: { decrement: product.pointsValue },
        },
      }),
      prisma.transaction.create({
        data: {
          customerId,
          type: 'REDEEM',
          points: -product.pointsValue,
          description: `🎁 Canje: ${product.name} gratis — ${pinosCost} Pinos`,
          staffId: req.admin?.id || null,
          staffEmail: req.admin?.email || null,
        },
      }),
    ]);

    await walletService.sendPushUpdate(updatedCustomer).catch(() => {});
    await pointsService.invalidateCache(customerId).catch(() => {});

    const newAvailablePoints = updatedCustomer.availablePoints;
    const { affordable, almostAffordable } = await getAffordableProducts(newAvailablePoints);

    logger.info(`🎁 Canje producto "${product.name}" (${pinosCost} Pinos) — cliente ${customerId}`);
    res.json({
      success: true,
      productName: product.name,
      pinosCost,
      newAvailablePoints,
      newAvailPinos: Math.floor(newAvailablePoints / 10),
      customerName: customer.firstName,
      affordableProducts: affordable,
      almostAffordableProducts: almostAffordable,
    });
  } catch (err) {
    logger.error('POS redeemProduct error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function searchCustomers(req, res) {
  const { q = '' } = req.query;
  const term = q.trim();
  if (term.length < 2) return res.json({ customers: [] });

  try {
    // La pantalla de caja ofrece "Buscar por email" y "Buscar por nombre", pero
    // esto solo miraba nombre y apellido: buscar un correo nunca daba resultados.
    const where = { OR: [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName:  { contains: term, mode: 'insensitive' } },
      { email:     { contains: term, mode: 'insensitive' } },
      { phone:     { contains: term } },
    ]};

    if (/^\d+$/.test(term)) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id FROM customers WHERE CAST(member_number AS TEXT) LIKE $1 LIMIT 8`,
        `${term}%`
      ).catch(() => []);
      for (const r of rows) where.OR.push({ id: r.id });
    }

    const customers = await prisma.customer.findMany({
      where,
      take: 8,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        availablePoints: true, level: true, phone: true,
      },
      orderBy: { firstName: 'asc' },
    });

    const ids = customers.map(c => c.id);
    const numbers = ids.length
      ? await prisma.$queryRawUnsafe(
          `SELECT id, member_number FROM customers WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`,
          ...ids
        ).catch(() => [])
      : [];
    const numberById = new Map(numbers.map(r => [r.id, r.member_number ? Number(r.member_number) : null]));

    // Datos parcialmente ocultos: el staff necesita reconocer al cliente,
    // no leer su teléfono ni su correo completos.
    const masked = customers.map(c => ({
      id: c.id,
      memberNumber: numberById.get(c.id) ?? null,
      firstName: c.firstName,
      lastName: c.lastName ? c.lastName[0] + '.' : '',
      email: c.email ? c.email.replace(/^(.{2}).*(@.*)$/, '$1···$2') : null,
      phone: c.phone ? '···' + c.phone.slice(-4) : null,
      availablePoints: c.availablePoints,
      availablePinosLabel: formatPinos(c.availablePoints),
      level: c.level,
    }));

    res.json({ customers: masked });
  } catch (err) {
    logger.error('POS searchCustomers error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { lookupCustomer, addPointsForPurchase, redeemPoints, redeemFreeDrink, redeemProduct, searchCustomers };
