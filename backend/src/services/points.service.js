const prisma = require('../config/prisma');
const { getRedis } = require('../config/redis');
const logger = require('../config/logger');
const emailService = require('./email.service');

const CACHE_PREFIX = 'customer:points:';
const CACHE_TTL = 300; // 5 minutos

async function getConfig() {
  const redis = getRedis();
  const cached = await redis.get('config:points');
  if (cached) return JSON.parse(cached);

  const config = await prisma.config.findFirst();
  await redis.setex('config:points', 60, JSON.stringify(config));
  return config;
}

function calculateLevel(points, config) {
  if (points >= config.goldThreshold) return 'GOLD';
  if (points >= config.silverThreshold) return 'SILVER';
  return 'BRONZE';
}

function applyLevelBonus(basePoints, level, config) {
  if (level === 'GOLD') return Math.floor(basePoints * (1 + config.goldBonusPercent / 100));
  if (level === 'SILVER') return Math.floor(basePoints * (1 + config.silverBonusPercent / 100));
  return basePoints;
}

async function getCustomerPoints(customerId) {
  const redis = getRedis();
  const cacheKey = `${CACHE_PREFIX}${customerId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { availablePoints: true, totalPoints: true, level: true, lifetimePoints: true },
  });

  if (!customer) return null;
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(customer));
  return customer;
}

async function invalidateCache(customerId) {
  const redis = getRedis();
  await redis.del(`${CACHE_PREFIX}${customerId}`);
}

async function isDoublePointsActive() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT double_points_enabled, double_points_expiry FROM config LIMIT 1`
    );
    const r = rows[0];
    if (!r?.double_points_enabled) return false;
    if (r.double_points_expiry && new Date(r.double_points_expiry) < new Date()) return false;
    return true;
  } catch { return false; }
}

async function addPoints(customerId, orderAmount, shopifyOrderId, shopifyOrderNum, customDescription, staffId, staffEmail) {
  const config = await getConfig();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error(`Cliente no encontrado: ${customerId}`);

  const doublePoints = await isDoublePointsActive();
  const basePoints = Math.floor(orderAmount * config.pointsPerDollar) * (doublePoints ? 2 : 1);
  const pointsWithBonus = applyLevelBonus(basePoints, customer.level, config);

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + config.expiryMonths);

  const description = customDescription ||
    (shopifyOrderNum
      ? `Compra #${shopifyOrderNum} - $${orderAmount.toFixed(2)} USD`
      : `Compra física $${orderAmount.toFixed(2)}`);

  const [updatedCustomer] = await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        totalPoints: { increment: pointsWithBonus },
        availablePoints: { increment: pointsWithBonus },
        lifetimePoints: { increment: pointsWithBonus },
      },
    }),
    prisma.transaction.create({
      data: {
        customerId,
        type: 'EARN',
        points: pointsWithBonus,
        description,
        shopifyOrderId,
        shopifyOrderNum,
        orderAmount,
        staffId: staffId || null,
        staffEmail: staffEmail || null,
        expiresAt,
      },
    }),
  ]);

  const newLevel = calculateLevel(updatedCustomer.lifetimePoints, config);
  const levelChanged = newLevel !== updatedCustomer.level;
  if (levelChanged) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { level: newLevel },
    });
    logger.info(`Cliente ${customerId} subió a nivel ${newLevel}`);
  }

  // Track visit count and last visit
  await prisma.$executeRawUnsafe(
    `UPDATE customers SET visit_count = visit_count + 1, last_visit_at = NOW() WHERE id = $1`,
    customerId
  ).catch(() => {});

  await invalidateCache(customerId);
  logger.info(`+${pointsWithBonus} puntos para cliente ${customerId} (orden ${shopifyOrderNum})${doublePoints ? ' [2x]' : ''}`);

  // updatedCustomer already reflects the post-increment value from Prisma
  const newBalance = updatedCustomer.availablePoints;
  const finalLevel = newLevel || updatedCustomer.level;

  // Send emails async — never block the POS flow
  setImmediate(async () => {
    try {
      const fullCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (fullCustomer?.email) {
        await emailService.sendPointsEarned({
          to: fullCustomer.email,
          firstName: fullCustomer.firstName,
          pointsAdded: pointsWithBonus,
          newBalance,
          level: finalLevel,
        });
        if (levelChanged) {
          await emailService.sendLevelUp({ to: fullCustomer.email, firstName: fullCustomer.firstName, newLevel: finalLevel, newBalance });
        }
      }
    } catch (e) { logger.warn('Email error (addPoints):', e.message); }
  });

  return { pointsAdded: pointsWithBonus, newBalance, level: finalLevel, doublePoints };
}

async function addBirthdayBonus(customerId, bonusPoints = 200) {
  const config = await getConfig();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + config.expiryMonths);

  const [updatedCustomer] = await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        totalPoints: { increment: bonusPoints },
        availablePoints: { increment: bonusPoints },
        lifetimePoints: { increment: bonusPoints },
      },
    }),
    prisma.transaction.create({
      data: {
        customerId,
        type: 'BIRTHDAY',
        points: bonusPoints,
        description: `🎂 ¡Feliz cumpleaños! +${bonusPoints / 10} Pinos de regalo`,
        expiresAt,
      },
    }),
  ]);

  await invalidateCache(customerId);
  logger.info(`🎂 Bono de cumpleaños (${bonusPoints} puntos) para cliente ${customerId}`);
  return { pointsAdded: bonusPoints, newBalance: updatedCustomer.availablePoints + bonusPoints };
}

async function redeemPoints(customerId, pointsToRedeem, staffId, staffEmail, description = 'Canje de puntos') {
  const config = await getConfig();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error('Cliente no encontrado');

  if (customer.availablePoints < pointsToRedeem) {
    throw new Error(`Puntos insuficientes. Disponible: ${customer.availablePoints}, solicitado: ${pointsToRedeem}`);
  }

  if (pointsToRedeem % config.pointsToRedeem !== 0) {
    throw new Error(`Los puntos deben ser múltiplo de ${config.pointsToRedeem}`);
  }

  const discountUsd = (pointsToRedeem / config.pointsToRedeem) * config.redeemValueUsd;

  const [updatedCustomer] = await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        availablePoints: { decrement: pointsToRedeem },
        totalPoints: { decrement: pointsToRedeem },
      },
    }),
    prisma.transaction.create({
      data: {
        customerId,
        type: 'REDEEM',
        points: -pointsToRedeem,
        description: `${description} - $${discountUsd.toFixed(2)} MXN de descuento`,
        staffId: staffId || null,
        staffEmail: staffEmail || null,
      },
    }),
  ]);

  await invalidateCache(customerId);
  logger.info(`-${pointsToRedeem} puntos canjeados por cliente ${customerId}`);

  const redeemedBalance = updatedCustomer.availablePoints;
  const discountMxn = parseFloat((discountUsd * 20).toFixed(2));

  setImmediate(async () => {
    try {
      const fullCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (fullCustomer?.email) {
        await emailService.sendPointsRedeemed({
          to: fullCustomer.email,
          firstName: fullCustomer.firstName,
          pointsRedeemed: pointsToRedeem,
          discountMxn,
          newBalance: redeemedBalance,
        });
      }
    } catch (e) { logger.warn('Email error (redeemPoints):', e.message); }
  });

  return { pointsRedeemed: pointsToRedeem, discountUsd, discountMxn, newBalance: redeemedBalance };
}

async function reversePoints(shopifyOrderId) {
  const transaction = await prisma.transaction.findFirst({
    where: { shopifyOrderId, type: 'EARN' },
    include: { customer: true },
  });

  if (!transaction) {
    logger.warn(`No se encontró transacción para orden ${shopifyOrderId}`);
    return null;
  }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: transaction.customerId },
      data: {
        totalPoints: { decrement: transaction.points },
        availablePoints: { decrement: Math.min(transaction.points, transaction.customer.availablePoints) },
        lifetimePoints: { decrement: transaction.points },
      },
    }),
    prisma.transaction.create({
      data: {
        customerId: transaction.customerId,
        type: 'REVERSAL',
        points: -transaction.points,
        description: `Reversión de orden cancelada #${transaction.shopifyOrderNum}`,
        shopifyOrderId,
      },
    }),
  ]);

  await invalidateCache(transaction.customerId);
  logger.info(`Puntos revertidos para orden ${shopifyOrderId}`);
  return { reversed: true, points: transaction.points };
}

async function addWelcomeBonus(customerId) {
  const config = await getConfig();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + config.expiryMonths);

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        totalPoints: { increment: config.welcomeBonus },
        availablePoints: { increment: config.welcomeBonus },
        lifetimePoints: { increment: config.welcomeBonus },
      },
    }),
    prisma.transaction.create({
      data: {
        customerId,
        type: 'WELCOME_BONUS',
        points: config.welcomeBonus,
        description: `🌲 ¡Bienvenido a House of Shake! +${config.welcomeBonus / 10} Pinos de regalo`,
        expiresAt,
      },
    }),
  ]);

  await invalidateCache(customerId);
  logger.info(`Bono de bienvenida (${config.welcomeBonus} puntos) para cliente ${customerId}`);
}

module.exports = { addPoints, redeemPoints, reversePoints, addWelcomeBonus, addBirthdayBonus, getCustomerPoints, getConfig, isDoublePointsActive };
