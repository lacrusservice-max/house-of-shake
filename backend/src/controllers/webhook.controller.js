const prisma = require('../config/prisma');
const webhookQueue = require('../queues/webhook.queue');
const logger = require('../config/logger');

async function handleOrderCreate(req, res) {
  const order = req.body;
  const topic = 'orders/create';

  const log = await prisma.webhookLog.create({
    data: {
      topic,
      shopDomain: req.headers['x-shopify-shop-domain'] || '',
      orderId: String(order.id),
      payload: JSON.stringify(order),
      status: 'pending',
    },
  });

  await webhookQueue.add('orders/create', { order, logId: log.id });
  res.status(200).json({ received: true });
}

async function handleOrderPaid(req, res) {
  // orders/paid confirma lo que orders/create ya procesó
  // Solo logueamos
  logger.info(`Orden pagada: ${req.body.order_number}`);
  res.status(200).json({ received: true });
}

async function handleOrderCancelled(req, res) {
  const order = req.body;

  const log = await prisma.webhookLog.create({
    data: {
      topic: 'orders/cancelled',
      shopDomain: req.headers['x-shopify-shop-domain'] || '',
      orderId: String(order.id),
      payload: JSON.stringify(order),
      status: 'pending',
    },
  });

  await webhookQueue.add('orders/cancelled', { order, logId: log.id });
  res.status(200).json({ received: true });
}

async function handleCustomerCreate(req, res) {
  const customer = req.body;

  const log = await prisma.webhookLog.create({
    data: {
      topic: 'customers/create',
      shopDomain: req.headers['x-shopify-shop-domain'] || '',
      payload: JSON.stringify(customer),
      status: 'pending',
    },
  });

  await webhookQueue.add('customers/create', { customer, logId: log.id });
  res.status(200).json({ received: true });
}

module.exports = { handleOrderCreate, handleOrderPaid, handleOrderCancelled, handleCustomerCreate };
