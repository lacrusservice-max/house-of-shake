'use strict';
/**
 * stamp.composer.js
 * Genera strip.png para Apple Wallet (storeCard).
 *
 * Strip @2x: 750×600 px — más alto para cubrir más de la tarjeta.
 * Layout:
 *   Y 0-270  → Fondo Azul (madera) + logo HOUSE OF SHAKE centrado
 *   Y 270-320 → BORDE (barra de madera café + pino central)
 *   Y 320-600 → Fondo Claro (crema) + acumulador-pino stamps
 */
const sharp = require('sharp');
const path  = require('path');

const ASSETS = path.resolve(__dirname, '../../assets');

const FONDO_AZUL_PATH  = path.join(ASSETS, 'fondo-azul.jpg');
const FONDO_CLARO_PATH = path.join(ASSETS, 'fondo-claro.jpg');
const BORDE_PATH       = path.join(ASSETS, 'borde.png');
const TEXTO_PATH       = path.join(ASSETS, 'texto-blanco.png');
const PINO_PATH        = path.join(ASSETS, 'acumulador-pino.png');

// ─── Strip dimensions @2x ────────────────────────────────────────────────────
const STRIP_W = 750;
const STRIP_H = 600;

// ─── Section layout @2x ──────────────────────────────────────────────────────
const TOP_H = 270; // blue wood: Y 0 → 270

// BORDE: 2400×341 original, bar center Y≈157, scale=750/2400=0.3125
// scaled: 750×107, bar_center_scaled = 49
const BORDE_SCALE   = STRIP_W / 2400;              // 0.3125
const BORDE_H_SCL   = Math.round(341 * BORDE_SCALE); // 107
const BORDE_BAR_SCL = Math.round(157 * BORDE_SCALE); // 49
const BORDE_TOP     = TOP_H - BORDE_BAR_SCL;       // 221

// Cream section starts just below the bar bottom (original bar bottom Y≈185)
const CREAM_START = BORDE_TOP + Math.round(185 * BORDE_SCALE); // ≈ 279

// Pino slots: centered in cream section (Y 279 → 600)
const SLOT_X = [100, 165, 222, 277, 335, 392, 450, 510, 567, 622];
const SLOT_Y = Math.round(CREAM_START + (STRIP_H - CREAM_START) / 2); // ≈ 440
const PINE_W = 54; // slightly larger, more breathing room

// ─── Build base strip ────────────────────────────────────────────────────────

async function buildBaseStrip(w, h) {
  const topH      = Math.round(TOP_H * (h / STRIP_H));
  const bordeH    = Math.round(BORDE_H_SCL * (h / STRIP_H));
  const bordeTop  = Math.round(BORDE_TOP * (h / STRIP_H));
  const scale     = w / STRIP_W;

  // 1. Full cream background
  const creamBuf = await sharp(FONDO_CLARO_PATH)
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 2. Blue wood top section
  const blueBuf = await sharp(FONDO_AZUL_PATH)
    .resize(w, topH, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 3. Borde divider
  const bordeBuf = await sharp(BORDE_PATH)
    .resize(w, bordeH, { fit: 'fill' })
    .toBuffer();

  // 4. Logo — trim transparent, scale to fit blue section
  const textoTrimBuf = await sharp(TEXTO_PATH).trim().toBuffer();
  const textoMeta    = await sharp(textoTrimBuf).metadata();
  const ar = textoMeta.width / textoMeta.height;

  // At @2x full size, logo fits inside 680×160 box
  const maxTW = Math.round(680 * scale);
  const maxTH = Math.round(160 * (h / STRIP_H));
  let tw, th;
  if (ar >= maxTW / maxTH) {
    tw = maxTW; th = Math.round(maxTW / ar);
  } else {
    th = maxTH; tw = Math.round(maxTH * ar);
  }

  const textoBuf  = await sharp(textoTrimBuf).resize(tw, th).toBuffer();
  const textoLeft = Math.round((w - tw) / 2);
  const textoTop  = Math.round((topH - th) / 2);

  // 5. Composite
  return sharp(creamBuf)
    .composite([
      { input: blueBuf,  left: 0,        top: 0 },
      { input: textoBuf, left: textoLeft, top: textoTop },
      { input: bordeBuf, left: 0,         top: bordeTop },
    ])
    .toBuffer();
}

// ─── Pino stamp helper ───────────────────────────────────────────────────────

async function preparePino(targetWidth) {
  const resized = await sharp(PINO_PATH)
    .resize(targetWidth)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    rgba[i * 4]     = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = (r < 8 && g < 8 && b < 8) ? 0 : 255;
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Genera strip.png con N pino stamps.
 * @param {number} stampsEarned 0–10
 * @param {'2x'|'1x'} resolution
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateStripImage(stampsEarned, resolution = '2x') {
  const is2x = resolution === '2x';
  const w    = is2x ? STRIP_W : Math.round(STRIP_W / 2);
  const h    = is2x ? STRIP_H : Math.round(STRIP_H / 2);
  const sc   = is2x ? 1 : 0.5;

  const pineW  = Math.round(PINE_W * sc);
  const slotY  = Math.round(SLOT_Y * sc);
  const slotXs = SLOT_X.map(x => Math.round(x * sc));

  const baseBuf = await buildBaseStrip(w, h);

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
      left:  Math.round(slotXs[i] - pineW / 2),
      top:   Math.round(slotY - pineH / 2),
    });
  }

  return sharp(baseBuf)
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

module.exports = { generateStripImage };
