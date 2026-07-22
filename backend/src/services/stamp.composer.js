'use strict';
/**
 * stamp.composer.js
 * Genera strip.png para Apple Wallet (storeCard).
 *
 * Strip @2x: 750×600 px
 * Layout:
 *   Y 0-270  → Azul marino sólido (#1B2F56) + logo HOUSE OF SHAKE centrado
 *   Y 270-320 → BORDE (barra café + pino central)
 *   Y 320-600 → Crema sólido (#E7DEC7) + acumulador-pino stamps
 */
const sharp = require('sharp');
const path  = require('path');

const ASSETS = path.resolve(__dirname, '../../assets');

const BORDE_PATH = path.join(ASSETS, 'borde.png');
const TEXTO_PATH = path.join(ASSETS, 'texto-blanco.png');
const PINO_PATH  = path.join(ASSETS, 'acumulador-pino.png');

// Colores sólidos — sin texturas
const NAVY  = { r: 27,  g: 47,  b: 86  };
const CREAM = { r: 231, g: 222, b: 199 };

// ─── Strip dimensions @2x ────────────────────────────────────────────────────
const STRIP_W = 750;
const STRIP_H = 600;

// ─── Section layout @2x ──────────────────────────────────────────────────────
// TOP_H=300: logo queda al 52% del topH (Y≈156), debajo del header overlay de
// Apple (~130px). CREAM_START=309 queda dentro del área visible del strip (~370px).
const TOP_H = 300;

const BORDE_SCALE   = STRIP_W / 2400;              // 0.3125
const BORDE_H_SCL   = Math.round(341 * BORDE_SCALE); // 107
const BORDE_BAR_SCL = Math.round(157 * BORDE_SCALE); // 49
const BORDE_TOP     = TOP_H - BORDE_BAR_SCL;       // 251

const CREAM_START = BORDE_TOP + Math.round(185 * BORDE_SCALE); // 309

// Stamps: 42px debajo del borde, dentro del área visible del strip
const SLOT_X = [100, 165, 222, 277, 335, 392, 450, 510, 567, 622];
const SLOT_Y = BORDE_TOP + BORDE_H_SCL + 42; // 251 + 107 + 42 = 400
const PINE_W = 54;

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

  // 3. Borde divider
  const bordeBuf = await sharp(BORDE_PATH)
    .resize(w, bordeH, { fit: 'fill' })
    .toBuffer();

  // 4. Logo — trim transparent, posicionar al 52% del topH
  // Header overlay de Apple cubre ~130px @2x; al 52% de topH=300 → Y=156 (margen ✓)
  // Logo cabe holgado antes del borde en Y=251.
  const textoTrimBuf = await sharp(TEXTO_PATH).trim().toBuffer();
  const textoMeta    = await sharp(textoTrimBuf).metadata();
  const ar = textoMeta.width / textoMeta.height;

  // Caja 640×90 @2x → logo queda entre header overlay y borde con margen
  const maxTW = Math.round(640 * scale);
  const maxTH = Math.round(90 * (h / STRIP_H));
  let tw, th;
  if (ar >= maxTW / maxTH) {
    tw = maxTW; th = Math.round(maxTW / ar);
  } else {
    th = maxTH; tw = Math.round(maxTH * ar);
  }

  const textoBuf  = await sharp(textoTrimBuf).resize(tw, th).toBuffer();
  const textoLeft = Math.round((w - tw) / 2);
  const textoTop  = Math.round(topH * 0.52);

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
