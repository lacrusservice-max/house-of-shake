const logger = require('../config/logger');
const prisma = require('../config/prisma');
const pointsService = require('../services/points.service');
const walletService = require('../services/wallet.service');

// En desarrollo sin Redis real, procesamos en línea (sin cola)
const USE_REAL_QUEUE = process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379';

let webhookQueue;
if (USE_REAL_QUEUE) {
  const Bull = require('bull');
  webhookQueue = new Bull('webhooks', {
    redis: process.env.REDIS_URL,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
} else {
  // Cola simulada: procesa inmediatamente en memoria
  const handlers = {};
  webhookQueue = {
    process: (name, fn) => { handlers[name] = fn; },
    add: async (name, data) => {
      setImmediate(async () => {
        try { await handlers[name]?.({ data }); } catch(e) { logger.error(`Job ${name} error:`, e.message); }
      });
    },
    on: () => {},
  };
  logger.info('Cola de webhooks: modo en memoria (desarrollo)');
}

webhookQueue.process('orders/create', async (job) => {
  const { order, logId } = job.data;
  logger.info(`Procesando orden creada: #${order.order_number}`);

  const shopifyCustomerId = String(order.customer?.id);
  if (!shopifyCustomerId) {
    logger.warn(`Orden ${order.id} sin cliente`);
    return;
  }

  const customer = await prisma.customer.findUnique({
    where: { shopifyCustomerId },
  });

  if (!customer) {
    logger.warn(`Cliente Shopify ${shopifyCustomerId} no encontrado en BD`);
    await updateWebhookLog(logId, 'skipped', 'Cliente no registrado en sistema de fidelización');
    return;
  }

  const orderAmount = parseFloat(order.total_price || 0);
  const result = await pointsService.addPoints(
    customer.id,
    orderAmount,
    String(order.id),
    String(order.order_number)
  );

  const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  await walletService.sendPushUpdate(updatedCustomer);

  await updateWebhookLog(logId, 'processed');
  logger.info(`Orden #${order.order_number}: +${result.pointsAdded} puntos`);
});

webhookQueue.process('orders/cancelled', async (job) => {
  const { order, logId } = job.data;
  logger.info(`Procesando cancelación de orden: #${order.order_number}`);

  const result = await pointsService.reversePoints(String(order.id));
  if (result) {
    const customer = await prisma.customer.findUnique({
      where: { shopifyCustomerId: String(order.customer?.id) },
    });
    if (customer) await walletService.sendPushUpdate(customer);
  }

  await updateWebhookLog(logId, 'processed');
});

webhookQueue.process('customers/create', async (job) => {
  const { customer: shopifyCustomer, logId } = job.data;
  logger.info(`Nuevo cliente Shopify: ${shopifyCustomer.email}`);

  const existing = await prisma.customer.findUnique({
    where: { shopifyCustomerId: String(shopifyCustomer.id) },
  });

  if (existing) {
    await updateWebhookLog(logId, 'skipped', 'Cliente ya existe');
    return;
  }

  const newCustomer = await prisma.customer.create({
    data: {
      shopifyCustomerId: String(shopifyCustomer.id),
      email: shopifyCustomer.email,
      firstName: shopifyCustomer.first_name || '',
      lastName: shopifyCustomer.last_name || '',
      phone: shopifyCustomer.phone,
    },
  });

  await pointsService.addWelcomeBonus(newCustomer.id);
  await updateWebhookLog(logId, 'processed');
  logger.info(`Cliente creado: ${newCustomer.id}`);
});

async function updateWebhookLog(logId, status, error = null) {
  if (!logId) return;
  await prisma.webhookLog.update({
    where: { id: logId },
    data: { status, error, processedAt: new Date() },
  });
}

webhookQueue.on('failed', (job, err) => {
  logger.error(`Job fallido ${job.id} (${job.name}):`, err.message);
});

webhookQueue.on('completed', (job) => {
  logger.debug(`Job completado ${job.id} (${job.name})`);
});

module.exports = webhookQueue;
