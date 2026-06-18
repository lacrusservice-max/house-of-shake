const { verifyWebhookHmac } = require('../services/shopify.service');
const logger = require('../config/logger');

function verifyShopifyWebhook(req, res, next) {
  const signature = req.headers['x-shopify-hmac-sha256'];
  if (!signature) {
    logger.warn('Webhook sin firma HMAC');
    return res.status(401).json({ error: 'Firma requerida' });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(400).json({ error: 'Body requerido' });
  }

  try {
    const isValid = verifyWebhookHmac(rawBody, signature);
    if (!isValid) {
      logger.warn('Firma HMAC inválida en webhook');
      return res.status(401).json({ error: 'Firma inválida' });
    }
    next();
  } catch (err) {
    logger.error('Error verificando webhook:', err);
    return res.status(500).json({ error: 'Error de verificación' });
  }
}

module.exports = { verifyShopifyWebhook };
