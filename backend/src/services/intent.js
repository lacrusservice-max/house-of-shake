const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { puntosToPinos } = require('./pinos');

/**
 * SOLICITUD DE CANJE
 *
 * El cliente toca "Pídelo gratis" en su cuenta y queda anotado qué producto
 * quiere. Cuando el staff lo identifica —por QR de la web, por el pass de
 * Apple Wallet, por nombre, correo o número de socio— ve ese producto listo
 * para confirmar, con su foto.
 *
 * Vive en la ficha del cliente (una solicitud a la vez: nadie pide dos cosas
 * simultáneas en el mostrador) y caduca sola, para que una elección de ayer no
 * aparezca mañana en caja.
 */

const EXPIRA_EN_MINUTOS = 45;

/** Guarda la intención de canjear un producto. Reemplaza cualquier anterior. */
async function setIntent(customerId, productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) {
    const err = new Error('Ese producto ya no está disponible');
    err.status = 404;
    throw err;
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Cliente no encontrado');
    err.status = 404;
    throw err;
  }

  if (customer.availablePoints < product.pointsValue) {
    const faltan = puntosToPinos(product.pointsValue - customer.availablePoints);
    const err = new Error(
      `Te faltan ${faltan} Pinos para canjear ${product.name}.`
    );
    err.status = 400;
    throw err;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE customers SET pending_product_id = $1, pending_since = NOW() WHERE id = $2`,
    productId, customerId
  );

  logger.info(`🎯 Solicitud de canje: ${product.name} — cliente ${customerId}`);
  return buildIntent(product, new Date());
}

/** Borra la solicitud (el cliente cambió de opinión, o ya se canjeó). */
async function clearIntent(customerId) {
  await prisma.$executeRawUnsafe(
    `UPDATE customers SET pending_product_id = NULL, pending_since = NULL WHERE id = $1`,
    customerId
  ).catch(() => {});
}

/**
 * Solicitud vigente de un cliente, o null.
 * Devuelve null (y limpia) si caducó, si el producto se desactivó o si el
 * cliente ya no tiene Pinos suficientes — así el staff nunca ve una opción
 * que no puede cumplir.
 */
async function getIntent(customerId, availablePoints = null) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT pending_product_id, pending_since FROM customers WHERE id = $1`,
    customerId
  ).catch(() => []);

  const row = rows?.[0];
  if (!row?.pending_product_id) return null;

  const desde = row.pending_since ? new Date(row.pending_since) : null;
  const caduco = !desde || (Date.now() - desde.getTime()) > EXPIRA_EN_MINUTOS * 60 * 1000;
  if (caduco) {
    await clearIntent(customerId);
    return null;
  }

  const product = await prisma.product.findUnique({ where: { id: row.pending_product_id } });
  if (!product || !product.active) {
    await clearIntent(customerId);
    return null;
  }

  if (availablePoints !== null && availablePoints < product.pointsValue) {
    await clearIntent(customerId);
    return null;
  }

  return buildIntent(product, desde);
}

function buildIntent(product, desde) {
  const expiraEn = new Date(desde.getTime() + EXPIRA_EN_MINUTOS * 60 * 1000);
  return {
    productId:   product.id,
    productName: product.name,
    imageUrl:    product.imageUrl || null,
    category:    product.category,
    price:       product.price,
    pinosCost:   puntosToPinos(product.pointsValue),
    pointsValue: product.pointsValue,
    since:       desde.toISOString(),
    expiresAt:   expiraEn.toISOString(),
    minutesLeft: Math.max(0, Math.round((expiraEn.getTime() - Date.now()) / 60000)),
  };
}

module.exports = { setIntent, clearIntent, getIntent, EXPIRA_EN_MINUTOS };
