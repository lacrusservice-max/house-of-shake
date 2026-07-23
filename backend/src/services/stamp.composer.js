'use strict';
/**
 * stamp.composer.js
 * Genera el strip.png de MARCA para Apple Wallet (storeCard).
 *
 * Strip @2x: 750×600 px — solo branding (sin texto, se compone con PNG):
 *   Navy sólido (#1B2F56) + logo HOUSE OF SHAKE + borde de madera con pino.
 *
 * El texto del cliente (nombre, pinos, recompensa) NO va en el strip porque
 * Wallet lo recorta poco después del borde. Ese texto vive en los campos
 * nativos del pase (secondaryFields/auxiliaryFields en wallet.service.js),
 * que se renderizan en la zona crema y nunca se recortan.
 */
const sharp = require('sharp');
const path  = require('path');

const ASSETS = path.resolve(__dirname, '../../assets');

const BORDE_PATH = path.join(ASSETS, 'borde.png');
const TEXTO_PATH = path.join(ASSETS, 'texto-blanco.png');

// Colores sólidos — sin texturas
const NAVY  = { r: 27,  g: 47,  b: 86  };
const CREAM = { r: 231, g: 222, b: 199 };

// ─── Strip dimensions @2x ────────────────────────────────────────────────────
const STRIP_W = 750;
const STRIP_H = 600;

// ─── Section layout @2x ──────────────────────────────────────────────────────
// Logo grande en navy · BORDE COMPLETO (107px, sin recorte) · textos en la crema.
//
// TEXTO_TOP_2X=245: logo bien debajo del header overlay real.
// maxTH=85 → logo bottom ≈ 330. BORDE_TOP=348 (gap 18px). Borde Y=348-455.
// Textos del cliente en la crema, debajo del borde completo.
const TOP_H = 397;
const TEXTO_TOP_2X = 245;

const BORDE_SCALE   = STRIP_W / 2400;              // 0.3125
const BORDE_H_SCL   = Math.round(341 * BORDE_SCALE); // 107 — borde COMPLETO
const BORDE_BAR_SCL = Math.round(157 * BORDE_SCALE); // 49  — centro de la barra
const BORDE_TOP     = TOP_H - BORDE_BAR_SCL;       // 348

// ─── Build base strip ────────────────────────────────────────────────────────

async function buildBaseStrip(w, h) {
  const topH      = Math.round(TOP_H * (h / STRIP_H));
  const bordeH    = Math.round(BORDE_H_SCL * (h / STRIP_H));
  const bordeTop  = Math.round(BORDE_TOP * (h / STRIP_H));
  const scale     = w / STRIP_W;

  // 1. Full cream background (sólido)
  const creamBuf = await sharp({
    create: { width: w, height: h, channels: 3, background: CREAM },
  }).png().toBuffer();

  // 2. Navy top section (sólido)
  const blueBuf = await sharp({
    create: { width: w, height: topH, channels: 3, background: NAVY },
  }).png().toBuffer();

  // 3. Borde divider — crop centrado para preservar el pino sin distorsionar
  const bordeBuf = await sharp(BORDE_PATH)
    .resize(w, bordeH, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 4. Logo — trim transparent, posicionar al 52% del topH
  // Header overlay de Apple cubre ~130px @2x; al 52% de topH=300 → Y=156 (margen ✓)
  // Logo cabe holgado antes del borde en Y=251.
  const textoTrimBuf = await sharp(TEXTO_PATH).trim().toBuffer();
  const textoMeta    = await sharp(textoTrimBuf).metadata();
  const ar = textoMeta.width / textoMeta.height;

  // Caja 680×85 @2x — logo grande y prominente
  const maxTW = Math.round(680 * scale);
  const maxTH = Math.round(85 * (h / STRIP_H));
  let tw, th;
  if (ar >= maxTW / maxTH) {
    tw = maxTW; th = Math.round(maxTW / ar);
  } else {
    th = maxTH; tw = Math.round(maxTH * ar);
  }

  const textoBuf  = await sharp(textoTrimBuf).resize(tw, th).toBuffer();
  const textoLeft = Math.round((w - tw) / 2);
  // Posición fija escalada desde TEXTO_TOP_2X=245: garantiza clearance del header
  const textoTop  = Math.round(TEXTO_TOP_2X * (h / STRIP_H));

  // 5. Composite
  return sharp(creamBuf)
    .composite([
      { input: blueBuf,  left: 0,        top: 0 },
      { input: textoBuf, left: textoLeft, top: textoTop },
      { input: bordeBuf, left: 0,         top: bordeTop },
    ])
    .toBuffer();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Genera strip.png de marca: fondo navy + logo HOUSE OF SHAKE + borde de madera.
 *
 * IMPORTANTE: Apple Wallet recorta el strip del storeCard poco después del borde.
 * Por eso el texto del cliente (nombre, pinos, recompensa) NO va en el strip —
 * va en los campos nativos del pase (secondaryFields/auxiliaryFields), que se
 * renderizan en la zona crema debajo del strip y NUNCA se recortan.
 *
 * Los pino stamps también caían en la zona recortada; el progreso ahora se
 * comunica por los campos nativos y el headerField "PINOS X/120".
 *
 * @param {'2x'|'1x'} resolution
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateStripImage(resolution = '2x') {
  const is2x = resolution === '2x';
  const w    = is2x ? STRIP_W : Math.round(STRIP_W / 2);
  const h    = is2x ? STRIP_H : Math.round(STRIP_H / 2);

  const baseBuf = await buildBaseStrip(w, h);
  return sharp(baseBuf).png({ compressionLevel: 6 }).toBuffer();
}

module.exports = { generateStripImage };
