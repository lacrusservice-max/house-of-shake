'use strict';
/**
 * stamp.composer.js
 * Genera el strip del Apple Wallet compositeando:
 *   1. Fondo Madera Azul (top section, blue wood)
 *   2. texto-BLANCO.png (House of Shake logo, centrado en top)
 *   3. BORDE.png (divisor de madera café con pino central)
 *   4. Fondo Claro (bottom section, crema — donde van los pino stamps)
 *   5. acumulador-pino.png × N (pinos del cliente)
 *
 * Strip @2x target: 750×246 px
 * Strip @1x target: 375×123 px
 */
const sharp  = require('sharp');
const path   = require('path');

const ASSETS = path.resolve(__dirname, '../../assets');

const FONDO_AZUL_PATH  = path.join(ASSETS, 'fondo-azul.jpg');
const FONDO_CLARO_PATH = path.join(ASSETS, 'fondo-claro.jpg');
const BORDE_PATH       = path.join(ASSETS, 'borde.png');
const TEXTO_PATH       = path.join(ASSETS, 'texto-blanco.png');
const PINO_PATH        = path.join(ASSETS, 'acumulador-pino.png');

// ─── Strip dimensions @2x ────────────────────────────────────────────────────
const STRIP_W   = 750;
const STRIP_H   = 246;

// ─── Section layout @2x ──────────────────────────────────────────────────────
const TOP_H     = 120;  // blue wood section height (Y 0→120)

// BORDE: original 2400×341 — bar is solid from Y≈130 to Y≈185, center ≈ Y=157
// Scale to width 750: ratio=750/2400=0.3125 → height=107 → bar_center=49
const BORDE_SCALE           = STRIP_W / 2400;               // 0.3125
const BORDE_H_SCALED        = Math.round(341 * BORDE_SCALE); // 107
const BORDE_BAR_CENTER_ORIG = 157;                           // measured Y in original
const BORDE_BAR_CENTER_SCL  = Math.round(BORDE_BAR_CENTER_ORIG * BORDE_SCALE); // 49
const BORDE_TOP             = TOP_H - BORDE_BAR_CENTER_SCL; // 71 (BORDE top in strip)

// Cream section starts just below the bar
const CREAM_START = BORDE_TOP + Math.round(185 * BORDE_SCALE); // ≈71+58=129
// Note: 185 is original Y of bar bottom

// ─── Pino slot positions @2x ────────────────────────────────────────────────
// X evenly distributed, Y centered in cream section
const SLOT_X_2X = [100, 165, 222, 277, 335, 392, 450, 510, 567, 622];
const SLOT_Y_2X = Math.round(CREAM_START + (STRIP_H - CREAM_START) / 2); // ≈190
const PINE_W_2X = 46;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds the 750×246 @2x base strip (blue wood + logo + border + cream).
 * No pinos yet — pure background.
 */
async function buildBaseStrip() {
  // 1. Full cream background (covers entire strip so bottom is already cream)
  const creamFull = await sharp(FONDO_CLARO_PATH)
    .resize(STRIP_W, STRIP_H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 2. Blue wood — covers just the top section
  const blueBuf = await sharp(FONDO_AZUL_PATH)
    .resize(STRIP_W, TOP_H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 3. BORDE — scaled to full strip width
  const bordeBuf = await sharp(BORDE_PATH)
    .resize(STRIP_W, BORDE_H_SCALED, { fit: 'fill' })
    .toBuffer();

  // 4. texto-BLANCO — trim transparent padding then scale to fit top section
  const textoTrimBuf = await sharp(TEXTO_PATH).trim().toBuffer();
  const textoMeta    = await sharp(textoTrimBuf).metadata();

  // Fit logo inside 680×90 box (leaves padding inside the 120px top section)
  const MAX_TW = 680;
  const MAX_TH = 90;
  const ar = textoMeta.width / textoMeta.height;
  let tw, th;
  if (ar >= MAX_TW / MAX_TH) {
    // wider than box → constrain by width
    tw = MAX_TW;
    th = Math.round(MAX_TW / ar);
  } else {
    // taller than box → constrain by height
    th = MAX_TH;
    tw = Math.round(MAX_TH * ar);
  }

  const textoBuf = await sharp(textoTrimBuf).resize(tw, th).toBuffer();
  const textoLeft = Math.round((STRIP_W - tw) / 2);
  const textoTop  = Math.round((TOP_H - th) / 2);

  // 5. Composite: cream → blue (top) → logo → borde
  return sharp(creamFull)
    .composite([
      { input: blueBuf,  left: 0,         top: 0 },
      { input: textoBuf, left: textoLeft,  top: textoTop },
      { input: bordeBuf, left: 0,          top: BORDE_TOP },
    ])
    .toBuffer();
}

/**
 * Prepare a pino PNG with correct alpha channel.
 * If background is near-black (legacy), makes it transparent.
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
    // Near-black → transparent (legacy format cleanup)
    rgba[i * 4 + 3] = (r < 8 && g < 8 && b < 8) ? 0 : 255;
  }

  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

/**
 * Generates the strip image with N pino stamps composited.
 *
 * @param {number} stampsEarned  0–10
 * @param {'2x'|'1x'} resolution
 * @returns {Promise<Buffer>}  PNG buffer for Apple Wallet
 */
async function generateStripImage(stampsEarned, resolution = '2x') {
  const is2x     = resolution === '2x';
  const scale    = is2x ? 1 : 0.5;
  const pineW    = Math.round(PINE_W_2X * scale);
  const slotY    = Math.round(SLOT_Y_2X * scale);
  const slotXList = SLOT_X_2X.map(x => Math.round(x * scale));

  // Build full @2x base, then scale down if 1x requested
  const baseBuf2x = await buildBaseStrip();
  const baseBuf   = is2x
    ? baseBuf2x
    : await sharp(baseBuf2x).resize(375, 123).toBuffer();

  if (stampsEarned <= 0) {
    return sharp(baseBuf).png({ compressionLevel: 6 }).toBuffer();
  }

  const pinoBuf  = await preparePino(pineW);
  const pinoMeta = await sharp(pinoBuf).metadata();
  const pineH    = pinoMeta.height;

  const composites = [];
  for (let i = 0; i < Math.min(stampsEarned, 10); i++) {
    composites.push({
      input: pinoBuf,
      left:  Math.round(slotXList[i] - pineW / 2),
      top:   Math.round(slotY - pineH / 2),
    });
  }

  return sharp(baseBuf)
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

module.exports = { generateStripImage };
