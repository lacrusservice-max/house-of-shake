const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * LICENCIA DE SERVICIO
 *
 * El sistema opera mientras la licencia esté vigente. Al vencer, la caja, la
 * cuenta del cliente y el pass de Apple Wallet quedan suspendidos hasta que se
 * renueve desde el panel de administración.
 *
 * Dos reglas que no se rompen nunca:
 *
 *  1. Las rutas de administración y /health NO se bloquean. Si se bloquearan,
 *     una licencia vencida dejaría fuera a quien tiene que renovarla — el
 *     sistema se cerraría con la llave dentro.
 *  2. Nada se borra. La suspensión solo impide operar: los Pinos, el historial
 *     y las cuentas siguen intactos y reaparecen completos al renovar.
 */

const DIAS_AVISO = 3; // desde cuántos días antes se avisa en el panel

let cache = { valor: null, hasta: 0 };

/** Fecha de vencimiento, o null si nunca se configuró (= sin límite). */
async function getLicenseUntil() {
  if (cache.valor !== null && Date.now() < cache.hasta) return cache.valor;
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT license_until FROM config LIMIT 1`);
    const v = rows?.[0]?.license_until ? new Date(rows[0].license_until) : null;
    cache = { valor: v, hasta: Date.now() + 30000 }; // 30s: renovar surte efecto casi al instante
    return v;
  } catch {
    return null; // si la columna no existe todavía, el servicio opera normal
  }
}

/** Estado completo de la licencia. */
async function getStatus() {
  const until = await getLicenseUntil();
  if (!until) return { active: true, unlimited: true, until: null, daysLeft: null, expiringSoon: false };

  const ms = until.getTime() - Date.now();
  const daysLeft = Math.ceil(ms / 86400000);
  return {
    active: ms > 0,
    unlimited: false,
    until: until.toISOString(),
    daysLeft,
    expiringSoon: ms > 0 && daysLeft <= DIAS_AVISO,
  };
}

/** Extiende la licencia N días desde hoy (o desde su vencimiento si sigue vigente). */
async function renew(dias) {
  const n = parseInt(dias, 10);
  if (!n || n < 1 || n > 3650) throw new Error('Número de días inválido (1 a 3650)');

  const actual = await getLicenseUntil();
  const base = actual && actual.getTime() > Date.now() ? actual : new Date();
  const nueva = new Date(base.getTime() + n * 86400000);

  await prisma.$executeRawUnsafe(
    `UPDATE config SET license_until = $1::timestamptz`, nueva.toISOString()
  );
  cache = { valor: null, hasta: 0 };
  logger.info(`🔑 Licencia renovada ${n} días — vigente hasta ${nueva.toISOString()}`);
  return getStatus();
}

/** Fija una fecha exacta de vencimiento. null = sin límite. */
async function setUntil(fechaISO) {
  if (fechaISO === null) {
    await prisma.$executeRawUnsafe(`UPDATE config SET license_until = NULL`);
  } else {
    const d = new Date(fechaISO);
    if (isNaN(d.getTime())) throw new Error('Fecha inválida');
    await prisma.$executeRawUnsafe(`UPDATE config SET license_until = $1::timestamptz`, d.toISOString());
  }
  cache = { valor: null, hasta: 0 };
  return getStatus();
}

/**
 * Middleware de bloqueo. Se aplica SOLO a rutas de operación (caja y cliente),
 * nunca a /admin ni a /health.
 */
async function requireActiveLicense(req, res, next) {
  const st = await getStatus();
  if (st.active) return next();
  return res.status(402).json({
    error: 'Servicio temporalmente suspendido. Contacta al proveedor del sistema.',
    serviceSuspended: true,
  });
}

module.exports = { getStatus, renew, setUntil, requireActiveLicense, DIAS_AVISO };
