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
 *                Alimentos y repostería ....... 100 Pinos
 *                Cafés y bebidas .............. 110 Pinos
 *                Milkshakes y especiales ...... 120 Pinos
 */

const PUNTOS_POR_PINO = 10;

// $1 MXN gastado = 1 punto interno = 0.1 Pino ⇒ $10 = 1 Pino
const PUNTOS_POR_PESO = 1;

// Costo de canje en Pinos según la categoría del producto
const TIER_REPOSTERIA = 100;
const TIER_BEBIDAS    = 110;
const TIER_ESPECIALES = 120;

const CATEGORY_TIERS = {
  alimentos:      TIER_REPOSTERIA,
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

module.exports = {
  PUNTOS_POR_PINO,
  PUNTOS_POR_PESO,
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
