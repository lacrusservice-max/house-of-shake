const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * GUARDIÁN DEL SISTEMA
 *
 * Revisa y REPARA las condiciones sin las cuales el sistema deja de funcionar.
 * Corre al arrancar y una vez al día.
 *
 * Existe porque cada caída grande de este proyecto tuvo la misma forma: algo
 * que se daba por hecho dejó de ser cierto tras un reinicio, y nadie se enteró
 * hasta que un cliente no pudo usar su cuenta.
 *
 *   · La tabla de configuración quedó vacía → el registro de clientes reventaba
 *     entero y nadie podía darse de alta.
 *   · Clientes sin número de socio → el staff no podía encontrarlos en caja.
 *   · Catálogo vacío → no se podía cobrar ni canjear nada.
 *
 * Cada revisión responde una sola pregunta: ¿se puede seguir operando? Si la
 * respuesta es no y tiene arreglo, lo aplica. Si no lo tiene, lo deja escrito
 * en los registros con el prefijo 🚨 para poder encontrarlo.
 */

const REVISIONES = [
  {
    nombre: 'configuración del sistema',
    async revisar() {
      const cfg = await prisma.config.findFirst();
      return cfg ? null : 'no existe la fila de configuración';
    },
    async reparar() {
      await prisma.config.create({
        data: {
          pointsPerDollar:    parseFloat(process.env.POINTS_PER_DOLLAR    || '1'),
          pointsToRedeem:     parseInt(process.env.POINTS_TO_REDEEM       || '100', 10),
          redeemValueUsd:     parseFloat(process.env.REDEEM_VALUE_USD     || '5'),
          welcomeBonus:       parseInt(process.env.POINTS_WELCOME_BONUS   || '100', 10),
          expiryMonths:       parseInt(process.env.POINTS_EXPIRY_MONTHS   || '12', 10),
          silverThreshold:    parseInt(process.env.SILVER_THRESHOLD       || '101', 10),
          goldThreshold:      parseInt(process.env.GOLD_THRESHOLD         || '301', 10),
          silverBonusPercent: parseFloat(process.env.SILVER_BONUS_PERCENT || '10'),
          goldBonusPercent:   parseFloat(process.env.GOLD_BONUS_PERCENT   || '20'),
        },
      });
      return 'configuración recreada';
    },
  },
  {
    nombre: 'números de socio',
    async revisar() {
      const r = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int n FROM customers WHERE member_number IS NULL`
      );
      const n = r?.[0]?.n || 0;
      return n ? `${n} cliente(s) sin número de socio` : null;
    },
    async reparar() {
      // Continúa la numeración desde el último asignado; nunca reutiliza.
      const r = await prisma.$queryRawUnsafe(`
        WITH base AS (SELECT COALESCE(MAX(member_number), 1000) AS m FROM customers),
        faltan AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS k
          FROM customers WHERE member_number IS NULL
        )
        UPDATE customers c SET member_number = base.m + faltan.k
        FROM faltan, base WHERE c.id = faltan.id
        RETURNING c.member_number`);
      return `${r.length} número(s) de socio asignado(s)`;
    },
  },
  {
    nombre: 'catálogo de productos',
    async revisar() {
      const n = await prisma.product.count({ where: { active: true } });
      return n === 0 ? 'no hay productos activos: no se puede cobrar ni canjear' : null;
    },
    // La siembra vive en setup-db (lee el menú público). Aquí solo se avisa:
    // repararlo a ciegas podría contradecir el menú real.
    reparar: null,
  },
  {
    nombre: 'cuadre de saldos',
    async revisar() {
      const r = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int n FROM (
          SELECT c.id FROM customers c
          LEFT JOIN transactions t ON t."customerId" = c.id
          GROUP BY c.id
          HAVING c."availablePoints" <> COALESCE(SUM(t.points), 0)
        ) x`);
      const n = r?.[0]?.n || 0;
      return n ? `${n} cliente(s) con saldo que no cuadra con su historial` : null;
    },
    // Nunca se repara solo: un descuadre puede significar Pinos de más o de
    // menos para una persona real. Eso lo decide un humano, no un cron.
    reparar: null,
  },
  {
    nombre: 'acceso del personal',
    async revisar() {
      const n = await prisma.adminUser.count({ where: { active: true } });
      return n === 0 ? 'no hay ninguna cuenta de personal activa' : null;
    },
    reparar: null,
  },
];

/**
 * Corre todas las revisiones y repara lo que pueda.
 * @returns {Promise<{ok: boolean, problemas: string[], reparados: string[]}>}
 */
async function revisarSistema({ reparar = true } = {}) {
  const problemas = [];
  const reparados = [];

  for (const r of REVISIONES) {
    let problema;
    try {
      problema = await r.revisar();
    } catch (e) {
      problemas.push(`${r.nombre}: no se pudo revisar (${e.message})`);
      continue;
    }
    if (!problema) continue;

    if (reparar && r.reparar) {
      try {
        const hecho = await r.reparar();
        reparados.push(`${r.nombre}: ${hecho}`);
        logger.warn(`🔧 Guardián reparó — ${r.nombre}: ${hecho}`);
        continue;
      } catch (e) {
        problemas.push(`${r.nombre}: ${problema} (falló el arreglo: ${e.message})`);
        continue;
      }
    }
    problemas.push(`${r.nombre}: ${problema}`);
  }

  if (problemas.length) {
    problemas.forEach(p => logger.error(`🚨 Guardián: ${p}`));
  } else if (!reparados.length) {
    logger.info('✅ Guardián: todo en orden');
  }

  return { ok: problemas.length === 0, problemas, reparados };
}

module.exports = { revisarSistema, REVISIONES };
