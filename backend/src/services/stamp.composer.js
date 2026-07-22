'use strict';
/**
 * stamp.composer.js
 * Genera imágenes para el Apple Wallet pass (tipo: generic).
 *
 * background.png — Fondo pantalla completa (750×1000 @2x):
 *   Fondo Azul (top 45%) → texto-BLANCO centrado → BORDE divisor → Fondo Claro (bottom 55%)
 *   + acumulador-pino.png × N compositeados en la sección crema.
 */
'use strict';
const sharp = require('sharp');
const path  = require('path');

const ASSETS = path.resolve(__dirname, '../../assets');

const FONDO_AZUL_PATH  = path.join(ASSETS, 'fondo-azul.jpg');
const FONDO_CLARO_PATH = path.join(ASSETS, 'fondo-claro.jpg');
const BORDE_PATH       = path.join(ASSETS, 'borde.png');
const TEXTO_PATH       = path.join(ASSETS, 'texto-blanco.png');
const PINO_PATH        = path.join(ASSETS, 'acumulador-pino.png');

// ─── Background dimensions ────────────────────────────────────────────────────
const BG_W = 750;
const BG_H = 1000;

// ─── Section layout @2x ──────────────────────────────────────────────────────
// Blue wood cubre la mitad superior de la tarjeta
const TOP_H = 450; // Y 0 → 450

// BORDE original: 2400×341, bar sólido Y≈130–185, center Y≈157
// Scale 750/2400 = 0.3125 → img 750×107, bar_center_scaled = 49
const BORDE_SCALE          = BG_W / 2400;              // 0.3125
const BORDE_H_SCALED       = Math.round(341 * BORDE_SCALE); // 107
const BORDE_BAR_CENTER_SCL = Math.round(157 * BORDE_SCALE); // 49
const BORDE_TOP            = TOP_H - BORDE_BAR_CENTER_SCL;  // 401

// Crema inicia justo debajo de la barra
const CREAM_START = BORDE_TOP + Math.round(185 * BORDE_SCALE); // ≈ 459

// Pino slots: centrados en crema, sobre el área del QR code (≈Y 650–950)
const SLOT_X = [100, 165, 222, 277, 335, 392, 450, 510, 567, 622];
const SLOT_Y = CREAM_START + 80; // ≈ 539
const PINE_W = 52;

// ─── Core builder ────────────────────────────────────────────────────────────

/**
 * Builds the 750×1000 @2x base background (no stamps yet).
 */
async function buildBackground() {
  // 1. Full cream background (bottom layer)
  const creamFull = await sharp(FONDO_CLARO_PATH)
    .resize(BG_W, BG_H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 2. Blue wood — top section only
  const blueBuf = await sharp(FONDO_AZUL_PATH)
    .resize(BG_W, TOP_H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 3. Borde — scaled to full width
  const bordeBuf = await sharp(BORDE_PATH)
    .resize(BG_W, BORDE_H_SCALED, { fit: 'fill' })
    .toBuffer();

  // 4. Logo — trim transparent padding, scale to fit blue section
  const textoTrimBuf = await sharp(TEXTO_PATH).trim().toBuffer();
  const textoMeta    = await sharp(textoTrimBuf).metadata();

  const MAX_TW = 680;
  const MAX_TH = 160; // más alto para una sección azul de 450px
  const ar = textoMeta.width / textoMeta.height;
  let tw, th;
  if (ar >= MAX_TW / MAX_TH) {
    tw = MAX_TW; th = Math.round(MAX_TW / ar);
  } else {
    th = MAX_TH; tw = Math.round(MAX_TH * ar);
  }

  const textoBuf  = await sharp(textoTrimBuf).resize(tw, th).toBuffer();
  const textoLeft = Math.round((BG_W - tw) / 2);
  const textoTop  = Math.round((TOP_H - th) / 2);

  // 5. Composite layers: cream → blue → logo → borde
  return sharp(creamFull)
    .composite([
      { input: blueBuf,  left: 0,        top: 0 },
      { input: textoBuf, left: textoLeft, top: textoTop },
      { input: bordeBuf, left: 0,         top: BORDE_TOP },
    ])
    .toBuffer();
}

/**
 * Prepara el PNG del pino con alpha correcto (fondo negro → transparente).
 */
async function preparePino(targetWidth) {
  const resized = await sharp(PINO_PATH)
    .resize(targetWidth)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    rgba[i * 4]     = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = (r < 8 && g < 8 && b < 8) ? 0 : 255;
  }

  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

/**
 * Genera el background.png del pass con N pinos compositeados.
 *
 * @param {number} stampsEarned  0–10
 * @returns {Promise<Buffer>}  PNG 750×1000 para Apple Wallet (generic pass)
 */
async function generateBackgroundImage(stampsEarned) {
  const baseBuf = await buildBackground();

  if (stampsEarned <= 0) {
    return sharp(baseBuf).png({ compressionLevel: 6 }).toBuffer();
  }

  const pinoBuf  = await preparePino(PINE_W);
  const pinoMeta = await sharp(pinoBuf).metadata();
  const pineH    = pinoMeta.height;

  const composites = [];
  for (let i = 0; i < Math.min(stampsEarned, 10); i++) {
    composites.push({
      input: pinoBuf,
      left:  Math.round(SLOT_X[i] - PINE_W / 2),
      top:   Math.round(SLOT_Y - pineH / 2),
    });
  }

  return sharp(baseBuf)
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Genera el strip.png legacy (750×246) — mantenido por compatibilidad.
 * @deprecated Usar generateBackgroundImage con pass tipo generic.
 */
async function generateStripImage(stampsEarned, resolution = '2x') {
  const STRIP_W = 750;
  const STRIP_H = 246;
  const TOP_STRIP = 120;

  const is2x = resolution === '2x';
  const sw = is2x ? STRIP_W : 375;
  const sh = is2x ? STRIP_H : 123;

  const BORDE_S = sw / 2400;
  const BORDE_HS = Math.round(341 * BORDE_S);
  const BORDE_TP = TOP_STRIP - Math.round(157 * BORDE_S);
  const CREAM_S  = BORDE_TP + Math.round(185 * BORDE_S);

  const creamBuf = await sharp(FONDO_CLARO_PATH).resize(sw, sh, { fit: 'cover' }).toBuffer();
  const blueBuf  = await sharp(FONDO_AZUL_PATH).resize(sw, TOP_STRIP * (is2x ? 1 : 0.5), { fit: 'cover' }).toBuffer();
  const bordeBuf = await sharp(BORDE_PATH).resize(sw, BORDE_HS, { fit: 'fill' }).toBuffer();

  const textoTrimBuf = await sharp(TEXTO_PATH).trim().toBuffer();
  const textoMeta    = await sharp(textoTrimBuf).metadata();
  const ar = textoMeta.width / textoMeta.height;
  const th = Math.round(Math.min(90, TOP_STRIP * (is2x ? 1 : 0.5) * 0.8));
  const tw = Math.round(th * ar);
  const textoBuf  = await sharp(textoTrimBuf).resize(tw, th).toBuffer();

  const baseBuf = await sharp(creamBuf)
    .composite([
      { input: blueBuf,  left: 0,                      top: 0 },
      { input: textoBuf, left: Math.round((sw-tw)/2),   top: Math.round((TOP_STRIP*(is2x?1:0.5)-th)/2) },
      { input: bordeBuf, left: 0,                      top: BORDE_TP },
    ])
    .toBuffer();

  if (stampsEarned <= 0) return sharp(baseBuf).png({ compressionLevel: 6 }).toBuffer();

  const pineW = is2x ? 46 : 23;
  const slotY = Math.round(CREAM_S + (sh - CREAM_S) / 2);
  const slotX = [100, 165, 222, 277, 335, 392, 450, 510, 567, 622].map(x => Math.round(x * (is2x ? 1 : 0.5)));

  const pinoBuf  = await preparePino(pineW);
  const pinoMeta = await sharp(pinoBuf).metadata();
  const pineH    = pinoMeta.height;

  const composites = [];
  for (let i = 0; i < Math.min(stampsEarned, 10); i++) {
    composites.push({ input: pinoBuf, left: Math.round(slotX[i] - pineW/2), top: Math.round(slotY - pineH/2) });
  }

  return sharp(baseBuf).composite(composites).png({ compressionLevel: 6 }).toBuffer();
}

module.exports = { generateBackgroundImage, generateStripImage };
