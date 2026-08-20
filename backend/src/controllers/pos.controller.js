const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const walletService = require('../services/wallet.service');
const { normalizeEmail, getMemberNumber } = require('../services/member');
const { puntosToPinos, formatPinos, rewardStatus } = require('../services/pinos');
const intentService = require('../services/intent');
const logger = require('../config/logger');

// Productos que el cliente puede canjear + los que tiene casi al alcance,
// junto con el estado de premios (cuántos puede llevarse, cuánto le falta).
async function getAffordableProducts(availablePoints) {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ pointsValue: 'asc' }, { sortOrder: 'asc' }],
  });

  const affordable = products.filter(p => p.pointsValue <= availablePoints);
  const almostAffordable = products.filter(
    p => p.pointsValue > availablePoints && p.pointsValue <= availablePoints * 1.3 + 50
  ).slice(0, 3);

  return { affordable, almostAffordable, reward: rewardStatus(availablePoints, products) };
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

    const { affordable, almostAffordable, reward } = await getAffordableProducts(customer.availablePoints);

    const memberNumber = await getMemberNumber(customer.id);
    // Lo que el cliente marcó desde su cuenta: el staff lo ve sin preguntar,
    // llegue por QR de la web, por el pass de Wallet o buscándolo por nombre.
    const pendingIntent = await intentService.getIntent(customer.id, customer.availablePoints);

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
      // Cuántos premios puede LLEVARSE (no cuántos productos distintos puede
      // elegir), cuánto le falta y si ya llegó a la meta.
      reward,
      pendingIntent,
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
// Tope del cobro manual. El staff necesita cobrar ventas que no cuadran con el
// catálogo (pedidos especiales, promos), pero un campo sin límite permitía
// teclear $2000 y regalarse 200 Pinos. Con tope sigue siendo útil y deja de ser
// una puerta abierta. El admin no tiene tope.
const MAX_MONTO_MANUAL = 1500;

async function addPointsForPurchase(req, res) {
  const { customerId } = req.params;
  const { amount, description } = req.body;
  const monto = parseFloat(amount);

  if (!monto || monto <= 0 || Number.isNaN(monto)) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  const esAdmin = req.admin?.role === 'admin';
  if (!esAdmin && monto > MAX_MONTO_MANUAL) {
    return res.status(400).json({
      error: `El máximo por venta manual es $${MAX_MONTO_MANUAL} MXN. Para un monto mayor, cóbralo por productos o pídeselo a un administrador.`,
      maxAmount: MAX_MONTO_MANUAL,
    });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const result = await pointsService.addPoints(
      customerId,
      monto,
      null,
      null,
      // "Monto manual" en la descripción: permite distinguirlas de las ventas
      // por catálogo al revisar el historial.
      description || `Monto manual $${monto.toFixed(2)} — ${req.admin?.email || 'POS'}`,
      req.admin?.id,
      req.admin?.email,
    );

    const updated = await prisma.customer.findUnique({ where: { id: customerId } });
    await walletService.sendPushUpdate(updated).catch(() => {});

    const beforeReward = await getAffordableProducts(customer.availablePoints);
    const afterReward  = await getAffordableProducts(updated.availablePoints);

    res.json({
      success: true,
      reward: afterReward.reward,
      // Avisa en caja cuando esta compra fue la que le desbloqueó un premio
      justUnlocked: !beforeReward.reward.hasReward && afterReward.reward.hasReward,
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


// Cobro POR PRODUCTO — el staff elige del catálogo y NUNCA teclea dinero.
//
// El precio sale de la base, no del cliente HTTP: aunque alguien manipule la
// petición, no puede inventar montos. Es la diferencia con add-points, donde un
// barista podía escribir $2000 y regalarse 200 Pinos.
async function addPointsForProducts(req, res) {
  const { customerId } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos un producto' });
  }
  if (items.length > 30) {
    return res.status(400).json({ error: 'Demasiados productos en una sola venta' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const ids = [...new Set(items.map(i => i.productId).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ error: 'Productos inválidos' });

    const productos = await prisma.product.findMany({ where: { id: { in: ids }, active: true } });
    const porId = new Map(productos.map(p => [p.id, p]));

    let total = 0;
    const detalle = [];
    for (const it of items) {
      const prod = porId.get(it.productId);
      if (!prod) return res.status(400).json({ error: 'Un producto ya no está disponible. Vuelve a intentarlo.' });
      const cant = Math.min(20, Math.max(1, parseInt(it.qty, 10) || 1));
      total += prod.price * cant;                // ← precio de la BD
      detalle.push({ nombre: prod.name, cant, precio: prod.price });
    }

    const resumen = detalle.map(d => (d.cant > 1 ? `${d.cant}× ${d.nombre}` : d.nombre)).join(', ');
    const descripcion = `${resumen} — $${total.toFixed(2)} MXN · ${req.admin?.email || 'POS'}`;

    const result = await pointsService.addPoints(
      customerId, total, null, null, descripcion, req.admin?.id, req.admin?.email,
    );

    const updated = await prisma.customer.findUnique({ where: { id: customerId } });
    await walletService.sendPushUpdate(updated).catch(() => {});

    const antes   = await getAffordableProducts(customer.availablePoints);
    const despues = await getAffordableProducts(updated.availablePoints);

    logger.info(`🧾 Venta por producto: ${resumen} ($${total}) — cliente ${customerId} por ${req.admin?.email}`);

    res.json({
      success: true,
      total,
      items: detalle,
      reward: despues.reward,
      justUnlocked: !antes.reward.hasReward && despues.reward.hasReward,
      pointsAdded: result.pointsAdded,
      pinosAdded: puntosToPinos(result.pointsAdded),
      pinosAddedLabel: formatPinos(result.pointsAdded),
      newAvailablePoints: updated.availablePoints,
      newAvailablePinosLabel: formatPinos(updated.availablePoints),
      customerName: customer.firstName,
      doublePoints: result.doublePoints,
    });
  } catch (err) {
    logger.error('POS addPointsForProducts error:', err.message);
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

    const { affordable, almostAffordable, reward } = await getAffordableProducts(result.newBalance);

    res.json({
      success: true,
      reward,
      pointsRedeemed: parseInt(points),
      pinosRedeemed: result.pinosRedeemed,
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

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    // El costo sale del catálogo real (el premio más barato activo), no de un
    // 120 escrito a mano: con el canje por categoría, el mínimo es 100.
    const products = await prisma.product.findMany({ where: { active: true } });
    const estado = rewardStatus(customer.availablePoints, products);

    if (!estado.hasReward) {
      return res.status(400).json({
        error: `${customer.firstName} tiene ${formatPinos(customer.availablePoints)} Pinos. `
             + `Necesita ${estado.cheapestCost} para canjear.`,
      });
    }

    const pinosCosto  = estado.cheapestCost;
    const puntosCosto = pinosCosto * 10;

    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: {
          availablePoints: { decrement: puntosCosto },
          // Antes solo se descontaba availablePoints: totalPoints quedaba
          // inflado y el libro mayor se descuadraba con cada canje.
          totalPoints: { decrement: puntosCosto },
        },
      }),
      prisma.transaction.create({
        data: {
          customerId,
          type: 'REDEEM',
          points: -puntosCosto,
          description: `🌲 Canje en caja — ${pinosCosto} Pinos`,
          staffId: req.admin?.id || null,
          staffEmail: req.admin?.email || null,
        },
      }),
    ]);

    const newAvailablePoints = updatedCustomer.availablePoints;
    await walletService.sendPushUpdate(updatedCustomer).catch(() => {});
    await pointsService.invalidateCache(customerId).catch(() => {});
    await intentService.clearIntent(customerId).catch(() => {});

    const { affordable, almostAffordable, reward } = await getAffordableProducts(newAvailablePoints);

    logger.info(`🌲 Canje en caja: ${pinosCosto} Pinos — cliente ${customerId}`);
    res.json({
      success: true,
      pinesRedeemed: pinosCosto,
      newAvailablePoints,
      newAvailablePinosLabel: formatPinos(newAvailablePoints),
      customerName: customer.firstName,
      reward,
      affordableProducts: affordable,
      almostAffordableProducts: almostAffordable,
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
    // Solicitud cumplida: se limpia para que no reaparezca en la próxima visita
    await intentService.clearIntent(customerId).catch(() => {});

    const newAvailablePoints = updatedCustomer.availablePoints;
    const { affordable, almostAffordable, reward } = await getAffordableProducts(newAvailablePoints);

    logger.info(`🎁 Canje producto "${product.name}" (${pinosCost} Pinos) — cliente ${customerId}`);
    res.json({
      success: true,
      productName: product.name,
      pinosCost,
      newAvailablePoints,
      newAvailPinos: Math.floor(newAvailablePoints / 10),
      newAvailPinosLabel: formatPinos(newAvailablePoints),
      customerName: customer.firstName,
      affordableProducts: affordable,
      almostAffordableProducts: almostAffordable,
      reward,
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

module.exports = { lookupCustomer, addPointsForPurchase, addPointsForProducts, redeemPoints, redeemFreeDrink, redeemProduct, searchCustomers };
