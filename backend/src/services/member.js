const prisma = require('../config/prisma');
const logger = require('../config/logger');

const FIRST_MEMBER_NUMBER = 1001;

/**
 * Normaliza un email para guardarlo y para buscarlo.
 * Todo el sistema usa SIEMPRE esta función: si el registro guarda
 * "Juan@Gmail.com" pero el login busca "juan@gmail.com", el cliente queda
 * fuera de su propia cuenta (y el staff le suma Pinos a una cuenta fantasma).
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Siguiente número de socio libre. Se calcula desde el máximo actual para que
 * borrar una cuenta no reutilice su número.
 */
async function nextMemberNumber() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(MAX(member_number), $1 - 1) + 1 AS next FROM customers`,
    FIRST_MEMBER_NUMBER
  );
  return Number(rows?.[0]?.next) || FIRST_MEMBER_NUMBER;
}

/**
 * Asigna número de socio a un cliente recién creado.
 * Reintenta ante colisión (dos registros simultáneos pidiendo el mismo número).
 */
async function assignMemberNumber(customerId, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      const n = await nextMemberNumber();
      await prisma.$executeRawUnsafe(
        `UPDATE customers SET member_number = $1 WHERE id = $2 AND member_number IS NULL`,
        n, customerId
      );
      const rows = await prisma.$queryRawUnsafe(
        `SELECT member_number FROM customers WHERE id = $1`, customerId
      );
      const assigned = rows?.[0]?.member_number;
      if (assigned) return Number(assigned);
    } catch {
      // colisión con el índice único → reintenta con el siguiente número
    }
  }
  logger.warn(`No se pudo asignar número de socio a ${customerId}`);
  return null;
}

/** Lee el número de socio de un cliente (null si aún no tiene). */
async function getMemberNumber(customerId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT member_number FROM customers WHERE id = $1`, customerId
  ).catch(() => []);
  const n = rows?.[0]?.member_number;
  return n ? Number(n) : null;
}

/** Busca cliente por email (case-insensitive) o por número de socio. */
async function findCustomerByEmailOrMember(term) {
  const raw = String(term || '').trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM customers WHERE member_number = $1 LIMIT 1`, parseInt(raw, 10)
    ).catch(() => []);
    if (rows?.[0]?.id) {
      return prisma.customer.findUnique({ where: { id: rows[0].id } });
    }
    return null;
  }

  return prisma.customer.findFirst({
    where: { email: { equals: normalizeEmail(raw), mode: 'insensitive' } },
  });
}

module.exports = {
  FIRST_MEMBER_NUMBER,
  normalizeEmail,
  nextMemberNumber,
  assignMemberNumber,
  getMemberNumber,
  findCustomerByEmailOrMember,
};
