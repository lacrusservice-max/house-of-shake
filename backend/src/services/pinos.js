/**
 * ECONOMÍA DE PINOS — fuente única de verdad.
 *
 * Internamente todo se guarda en "puntos" enteros: 1 Pino = 10 puntos.
 * Guardar enteros evita errores de redondeo con decimales, y permite mostrar
 * medios Pinos: una compra de $65 da 65 puntos = 6.5 Pinos.
 *
 *   ACUMULAR  →  1 Pino por cada $10 MXN gastados, con decimales.
 *                $65 = 6.5 Pinos · $69 = 6.9 Pinos · $110 = 11 Pinos
 *
 *   CANJEAR   →  costo fijo por categoría, NO por precio del producto:
 *                Repostería ................... 100 Pinos
 *                Cafés y bebidas .............. 110 Pinos
 *                Milkshakes y alimentos ....... 120 Pinos
 */

const PUNTOS_POR_PINO = 10;

// $1 MXN gastado = 1 punto interno = 0.1 Pino ⇒ $10 = 1 Pino
const PUNTOS_POR_PESO = 1;

// Costo de canje en Pinos según la categoría del producto
const TIER_REPOSTERIA = 100;
const TIER_BEBIDAS    = 110;
const TIER_ESPECIALES = 120;

const CATEGORY_TIERS = {
  // Alimentos son los platos fuertes ($115–125), no la repostería: cuestan lo
  // mismo que un milkshake, no lo mismo que un croissant.
  alimentos:      TIER_ESPECIALES,
  reposteria:     TIER_REPOSTERIA,
  'repostería':   TIER_REPOSTERIA,
  'cold-coffees': TIER_BEBIDAS,
  'cold-brew':    TIER_BEBIDAS,
  matcha:         TIER_BEBIDAS,
  fitfresh:       TIER_BEBIDAS,
  chai:           TIER_BEBIDAS,
  frio:           TIER_BEBIDAS,
  'frío':         TIER_BEBIDAS,
  bebida:         TIER_BEBIDAS,
  milkshakes:     TIER_ESPECIALES,
  especiales:     TIER_ESPECIALES,
};

/** Costo de canje en Pinos para una categoría. Default: bebidas. */
function pinosCostForCategory(category) {
  if (!category) return TIER_BEBIDAS;
  return CATEGORY_TIERS[String(category).trim().toLowerCase()] ?? TIER_BEBIDAS;
}

/** Costo de canje en PUNTOS internos para una categoría. */
function puntosCostForCategory(category) {
  return pinosCostForCategory(category) * PUNTOS_POR_PINO;
}

/** Puntos internos que otorga una compra. $65 → 65 puntos (= 6.5 Pinos). */
function puntosFromAmount(amountMxn) {
  const amount = parseFloat(amountMxn) || 0;
  return Math.round(amount * PUNTOS_POR_PESO);
}

/** Puntos internos → Pinos con un decimal. 65 → 6.5 */
function puntosToPinos(puntos) {
  return Math.round(((parseInt(puntos, 10) || 0) / PUNTOS_POR_PINO) * 10) / 10;
}

/** Pinos → puntos internos. 6.5 → 65 */
function pinosToPuntos(pinos) {
  return Math.round((parseFloat(pinos) || 0) * PUNTOS_POR_PINO);
}

/** Texto listo para UI: 6.5 → "6.5", 7 → "7" (sin ".0" colgando). */
function formatPinos(puntos) {
  const p = puntosToPinos(puntos);
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

/**
 * Estado de premios de un cliente: qué puede llevarse YA y, si no le alcanza,
 * cuánto le falta.
 *
 * El saldo ES el progreso. Antes se mostraba `saldo % 120`, así que un cliente
 * con 243 Pinos veía "3 / 120" — como si estuviera empezando — cuando en
 * realidad ya tenía para dos premios.
 *
 * @param {number} puntos   saldo en puntos internos
 * @param {Array}  products catálogo activo (con pointsValue)
 */
function rewardStatus(puntos, products = []) {
  const balance = puntosToPinos(puntos);
  const catalog = products
    .filter(p => p && p.active !== false)
    .map(p => ({ ...p, pinosCost: Math.round((p.pointsValue ?? 0) / PUNTOS_POR_PINO) }))
    .filter(p => p.pinosCost > 0);

  if (catalog.length === 0) {
    return { balance, hasReward: false, affordable: [], affordableCount: 0,
             redeemableCount: 0, cheapestCost: TIER_REPOSTERIA,
             nextGoalCost: TIER_REPOSTERIA, pinosToNextGoal: Math.max(0, TIER_REPOSTERIA - balance),
             progressPct: 0 };
  }

  const cheapestCost = Math.min(...catalog.map(p => p.pinosCost));
  const affordable   = catalog.filter(p => p.pinosCost <= balance);
  const hasReward    = affordable.length > 0;

  // Cuántos premios puede llevarse de una sentada, tomando siempre el más
  // barato que le quede alcanzando. Es distinto de `affordable.length`, que es
  // cuántos productos DISTINTOS del menú puede elegir: con 243 Pinos podía
  // elegir entre 40 productos, pero llevarse solo 2.
  let restante = balance;
  let redeemableCount = 0;
  while (restante >= cheapestCost) {
    const masBarato = Math.min(
      ...catalog.filter(p => p.pinosCost <= restante).map(p => p.pinosCost)
    );
    restante -= masBarato;
    redeemableCount++;
  }

  // Siguiente meta: el premio más barato que todavía no alcanza; si ya le
  // alcanza para todo, la meta es juntar otro premio más.
  const porEncima = catalog.filter(p => p.pinosCost > balance).map(p => p.pinosCost);
  const nextGoalCost = porEncima.length ? Math.min(...porEncima) : cheapestCost;

  // redondeado a un decimal: sin esto, 243.1 arrojaba 56.900000000000006
  const round1 = (n) => Math.round(n * 10) / 10;
  const sobrante = balance % cheapestCost;
  const pinosToNextGoal = hasReward
    ? round1(sobrante === 0 ? cheapestCost : cheapestCost - sobrante)
    : round1(Math.max(0, nextGoalCost - balance));

  // Con premio disponible la barra mide el avance hacia el SIGUIENTE: dejarla
  // en 100% la mostraba llena mientras el texto decía "60 / 100".
  const progressPct = hasReward
    ? Math.max(0, Math.min(100, Math.round(((cheapestCost - pinosToNextGoal) / cheapestCost) * 100)))
    : Math.max(0, Math.min(100, Math.round((balance / nextGoalCost) * 100)));

  return {
    balance,
    hasReward,
    affordable,
    affordableCount: affordable.length,
    redeemableCount,
    cheapestCost,
    nextGoalCost,
    pinosToNextGoal,
    progressPct,
  };
}

module.exports = {
  PUNTOS_POR_PINO,
  PUNTOS_POR_PESO,
  rewardStatus,
  TIER_REPOSTERIA,
  TIER_BEBIDAS,
  TIER_ESPECIALES,
  CATEGORY_TIERS,
  pinosCostForCategory,
  puntosCostForCategory,
  puntosFromAmount,
  puntosToPinos,
  pinosToPuntos,
  formatPinos,
};
