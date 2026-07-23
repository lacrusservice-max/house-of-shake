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
// TEXTO_TOP_2X=245: logo bien debajo del header overlay (~240px @2x).
// Borde comprimido a 80px (crop centrado) → más espacio crema visible en preview.
// TOP_H=374 → BORDE_BAR_SCL=35 (crop) → BORDE_TOP=339, borde Y=339-419.
// CREAM_START=383, texto visible en Mac preview (cutoff ~440px @2x).
const TOP_H = 374;
const TEXTO_TOP_2X = 245;

const BORDE_SCALE   = STRIP_W / 2400;   // 0.3125
const BORDE_H_SCL   = 80;               // px @2x — borde crop centrado (era 107)
const BORDE_BAR_SCL = 35;               // px desde top del borde recortado al centro de la barra
const BORDE_TOP     = TOP_H - BORDE_BAR_SCL; // 339

const CREAM_START = BORDE_TOP + 44;     // 383 — donde empieza la parte crema del borde

// Stamps: debajo del texto (cuando hay customerInfo van a Y=490, iPhone sólo)
const SLOT_X = [100, 165, 222, 277, 335, 392, 450, 510, 567, 622];
const SLOT_Y = CREAM_START + 40; // 423
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

  // Caja 680×70 @2x — logo visible, 10px de respiro antes del borde
  const maxTW = Math.round(680 * scale);
  const maxTH = Math.round(70 * (h / STRIP_H));
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

// ─── XML escape helper ────────────────────────────────────────────────────────

function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── SVG bold text overlay (sección crema) ───────────────────────────────────

async function buildTextOverlay(w, h, customerInfo) {
  const { name, pinesInCycle, pinesLeft } = customerInfo;
  const sc = w / STRIP_W;

  const nameStr = String(name).toUpperCase();

  const nameFontSz   = Math.round((nameStr.length > 22 ? 20 : 25) * sc);
  const pinesFontSz  = Math.round(22 * sc);
  const rewardFontSz = Math.round(17 * sc);

  // nameY: 34px sobre CREAM_START → 17px bajo el pino del borde, visible en preview
  // rewardY: 56px sobre CREAM_START → segunda línea, visible en Mac preview (~440px @2x)
  const nameY   = Math.round((CREAM_START + 34) * sc);  // 417 @2x
  const rewardY = Math.round((CREAM_START + 56) * sc);  // 439 @2x

  const padX   = Math.round(40 * sc);
  const rightX = Math.round(710 * sc);

  const pinesStr  = pinesLeft === 0 ? '¡BEBIDA LISTA!' : `${pinesInCycle}/120 PINOS`;
  const rewardStr = pinesLeft === 0
    ? 'Muestrame al staff para canjear'
    : `${pinesLeft} Pinos mas para tu bebida gratis`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="${padX}" y="${nameY}" font-family="DejaVu Sans, sans-serif" font-weight="900" font-size="${nameFontSz}" fill="#1B2F56">${escXml(nameStr)}</text>
  <text x="${rightX}" y="${nameY}" font-family="DejaVu Sans, sans-serif" font-weight="900" font-size="${pinesFontSz}" fill="#1B2F56" text-anchor="end">${escXml(pinesStr)}</text>
  <text x="${padX}" y="${rewardY}" font-family="DejaVu Sans, sans-serif" font-weight="700" font-size="${rewardFontSz}" fill="#8C5F0F">${escXml(rewardStr)}</text>
</svg>`;

  return Buffer.from(svg);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Genera strip.png con N pino stamps y texto en negrita del cliente.
 * @param {number} stampsEarned 0–10
 * @param {'2x'|'1x'} resolution
 * @param {{ name: string, pinesInCycle: number, pinesLeft: number }|null} customerInfo
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateStripImage(stampsEarned, resolution = '2x', customerInfo = null) {
  const is2x = resolution === '2x';
  const w    = is2x ? STRIP_W : Math.round(STRIP_W / 2);
  const h    = is2x ? STRIP_H : Math.round(STRIP_H / 2);
  const sc   = is2x ? 1 : 0.5;

  const pineW  = Math.round(PINE_W * sc);
  // Con texto en la sección crema, los stamps bajan a Y≈490 @2x (visibles en iPhone)
  const stampY = Math.round((customerInfo ? 490 : SLOT_Y) * sc);
  const slotXs = SLOT_X.map(x => Math.round(x * sc));

  const baseBuf    = await buildBaseStrip(w, h);
  const composites = [];

  if (stampsEarned > 0) {
    const pinoBuf  = await preparePino(pineW);
    const pinoMeta = await sharp(pinoBuf).metadata();
    const pineH    = pinoMeta.height;
    for (let i = 0; i < Math.min(stampsEarned, 10); i++) {
      composites.push({
        input: pinoBuf,
        left:  Math.round(slotXs[i] - pineW / 2),
        top:   Math.round(stampY - pineH / 2),
      });
    }
  }

  if (customerInfo) {
    const textBuf = await buildTextOverlay(w, h, customerInfo);
    composites.push({ input: textBuf, left: 0, top: 0 });
  }

  if (!composites.length) {
    return sharp(baseBuf).png({ compressionLevel: 6 }).toBuffer();
  }

  return sharp(baseBuf)
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

module.exports = { generateStripImage };
