const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');

const shopifyClient = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-07`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
});

function verifyWebhookHmac(rawBody, signature) {
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

async function getCustomer(shopifyCustomerId) {
  const { data } = await shopifyClient.get(`/customers/${shopifyCustomerId}.json`);
  return data.customer;
}

async function getOrder(shopifyOrderId) {
  const { data } = await shopifyClient.get(`/orders/${shopifyOrderId}.json`);
  return data.order;
}

async function createDiscountCode(customerId, discountAmount) {
  const priceRuleData = {
    price_rule: {
      title: `FIDELIDAD-${customerId.substring(0, 8).toUpperCase()}`,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'fixed_amount',
      value: `-${discountAmount.toFixed(2)}`,
      customer_selection: 'all',
      starts_at: new Date().toISOString(),
      usage_limit: 1,
    },
  };

  const { data: priceRule } = await shopifyClient.post('/price_rules.json', priceRuleData);
  const ruleId = priceRule.price_rule.id;

  const code = `HOS${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const { data: discountData } = await shopifyClient.post(
    `/price_rules/${ruleId}/discount_codes.json`,
    { discount_code: { code } }
  );

  return { code, ruleId, discountCodeId: discountData.discount_code.id };
}

async function registerWebhooks(baseUrl) {
  const topics = [
    'orders/create',
    'orders/paid',
    'orders/cancelled',
    'customers/create',
  ];

  const results = [];
  for (const topic of topics) {
    try {
      const { data } = await shopifyClient.post('/webhooks.json', {
        webhook: {
          topic,
          address: `${baseUrl}/api/webhooks/shopify/${topic.replace('/', '-')}`,
          format: 'json',
        },
      });
      results.push({ topic, id: data.webhook.id, status: 'created' });
      logger.info(`Webhook registrado: ${topic}`);
    } catch (err) {
      const msg = err.response?.data?.errors || err.message;
      logger.warn(`Webhook ${topic}:`, msg);
      results.push({ topic, status: 'error', error: msg });
    }
  }
  return results;
}

async function listWebhooks() {
  const { data } = await shopifyClient.get('/webhooks.json');
  return data.webhooks;
}

async function registerScriptTag(baseUrl) {
  try {
    const { data } = await shopifyClient.post('/script_tags.json', {
      script_tag: {
        event: 'onload',
        src: `${baseUrl}/widget/loyalty-widget.js`,
        display_scope: 'online_store',
      },
    });
    logger.info('ScriptTag registrado:', data.script_tag.id);
    return data.script_tag;
  } catch (err) {
    logger.error('Error registrando ScriptTag:', err.response?.data || err.message);
    throw err;
  }
}

async function getCustomerByEmail(email) {
  const { data } = await shopifyClient.get(`/customers/search.json?query=email:${encodeURIComponent(email)}&limit=1`);
  return data.customers?.[0] || null;
}

module.exports = {
  verifyWebhookHmac,
  getCustomer,
  getOrder,
  createDiscountCode,
  registerWebhooks,
  listWebhooks,
  registerScriptTag,
  getCustomerByEmail,
};
