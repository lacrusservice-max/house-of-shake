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
  alimentos: TIER_REPOSTERIA,
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
