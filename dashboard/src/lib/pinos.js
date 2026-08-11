/**
 * Conversión de Pinos en el frontend — espejo de backend/src/services/pinos.js.
 *
 * El backend guarda "puntos" enteros: 1 Pino = 10 puntos. Así una compra de
 * $65 vale 65 puntos y se muestra como 6.5 Pinos sin perder los centavos.
 */

export const PUNTOS_POR_PINO = 10;

/** Costo de canje en Pinos según la categoría del producto. */
export const TIER_REPOSTERIA = 100;
export const TIER_BEBIDAS    = 110;
export const TIER_ESPECIALES = 120;

const CATEGORY_TIERS = {
  alimentos: TIER_ESPECIALES,
  reposteria: TIER_REPOSTERIA,
  'repostería': TIER_REPOSTERIA,
  'cold-coffees': TIER_BEBIDAS,
  'cold-brew': TIER_BEBIDAS,
  matcha: TIER_BEBIDAS,
  fitfresh: TIER_BEBIDAS,
  chai: TIER_BEBIDAS,
  frio: TIER_BEBIDAS,
  'frío': TIER_BEBIDAS,
  bebida: TIER_BEBIDAS,
  milkshakes: TIER_ESPECIALES,
  especiales: TIER_ESPECIALES,
};

export function pinosCostForCategory(category) {
  if (!category) return TIER_BEBIDAS;
  return CATEGORY_TIERS[String(category).trim().toLowerCase()] ?? TIER_BEBIDAS;
}

/** Puntos internos → número de Pinos con un decimal. 65 → 6.5 */
export function toPinos(puntos = 0) {
  return Math.round(((Number(puntos) || 0) / PUNTOS_POR_PINO) * 10) / 10;
}

/** Texto para UI: 6.5 → "6.5", 7 → "7" (sin ".0" colgando). */
export function fmtPinos(puntos = 0) {
  const p = toPinos(puntos);
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

/** Pinos enteros ya ganados — para barras de progreso y slots del ciclo. */
export function pinosEnteros(puntos = 0) {
  return Math.floor((Number(puntos) || 0) / PUNTOS_POR_PINO);
}

/** Costo de canje de un producto, en Pinos (usa el valor del backend si viene). */
export function pinosDeProducto(product) {
  if (!product) return TIER_BEBIDAS;
  if (product.pointsValue != null) return Math.round(product.pointsValue / PUNTOS_POR_PINO);
  return pinosCostForCategory(product.category);
}

/**
 * Estado de premios — espejo de backend/src/services/pinos.js `rewardStatus`.
 * Se usa como respaldo cuando la respuesta del servidor aún no trae `reward`.
 *
 * El saldo ES el progreso: mostrar `saldo % 120` hacía que alguien con 243
 * Pinos viera "3 / 120", como si estuviera empezando.
 */
export function rewardStatus(puntos = 0, products = []) {
  const balance = toPinos(puntos);
  const catalog = (products || [])
    .filter(p => p && p.active !== false)
    .map(p => ({ ...p, pinosCost: pinosDeProducto(p) }))
    .filter(p => p.pinosCost > 0);

  if (!catalog.length) {
    return { balance, hasReward: false, affordable: [], affordableCount: 0,
             redeemableCount: 0, cheapestCost: TIER_REPOSTERIA, nextGoalCost: TIER_REPOSTERIA,
             pinosToNextGoal: Math.max(0, TIER_REPOSTERIA - balance), progressPct: 0 };
  }

  const round1 = (n) => Math.round(n * 10) / 10;
  const cheapestCost = Math.min(...catalog.map(p => p.pinosCost));
  const affordable   = catalog.filter(p => p.pinosCost <= balance);
  const hasReward    = affordable.length > 0;

  // Cuántos premios puede llevarse, no cuántos productos distintos puede elegir.
  let restante = balance;
  let redeemableCount = 0;
  while (restante >= cheapestCost) {
    restante -= Math.min(...catalog.filter(p => p.pinosCost <= restante).map(p => p.pinosCost));
    redeemableCount++;
  }

  const porEncima = catalog.filter(p => p.pinosCost > balance).map(p => p.pinosCost);
  const nextGoalCost = porEncima.length ? Math.min(...porEncima) : cheapestCost;
  const sobrante = balance % cheapestCost;
  const pinosToNextGoal = hasReward
    ? round1(sobrante === 0 ? cheapestCost : cheapestCost - sobrante)
    : round1(Math.max(0, nextGoalCost - balance));
  // Con premio disponible la barra mide el avance hacia el SIGUIENTE: dejarla
  // en 100% la mostraba llena mientras el texto decía "60 / 100".
  const progressPct = hasReward
    ? Math.max(0, Math.min(100, Math.round(((cheapestCost - pinosToNextGoal) / cheapestCost) * 100)))
    : Math.max(0, Math.min(100, Math.round((balance / nextGoalCost) * 100)));

  return { balance, hasReward, affordable, affordableCount: affordable.length,
           redeemableCount, cheapestCost, nextGoalCost, pinosToNextGoal, progressPct };
}
