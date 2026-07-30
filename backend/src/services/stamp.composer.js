'use strict';
/**
 * stamp.composer.js
 * Genera el strip.png de MARCA para Apple Wallet (storeCard).
 *
 * Strip @2x: 750×600 px — fondo TRANSPARENTE.
 * El backgroundColor del pass (#0F448B) cubre toda la tarjeta de forma uniforme.
 * El strip solo aporta: logo HOUSE OF SHAKE (blanco) + borde de madera.
 */
const sharp = require('sharp');
const path  = require('path');

const ASSETS = path.resolve(__dirname, '../../assets');

const BORDE_PATH = path.join(ASSETS, 'borde.png');
const TEXTO_PATH = path.join(ASSETS, 'texto-blanco.png');

// ─── Strip dimensions @2x ────────────────────────────────────────────────────
const STRIP_W = 750;
const STRIP_H = 600;

// ─── Layout @2x ──────────────────────────────────────────────────────────────
// El header de Apple (logo icon + headerFields) cubre ~130px desde arriba.
// Logo safe zone: y=145 .. BORDE_TOP.
// BORDE_TOP calculado para que el separador quede centrado verticalmente en el strip.
const TOP_H = 397;
const TEXTO_TOP_2X = 175;  // arriba del separador, debajo del header overlay

const BORDE_SCALE   = STRIP_W / 2400;
const BORDE_H_SCL   = Math.round(341 * BORDE_SCALE); // 107px — borde completo
const BORDE_BAR_SCL = Math.round(157 * BORDE_SCALE); // 49px  — centro de la barra
const BORDE_TOP     = TOP_H - BORDE_BAR_SCL;          // 348px

// ─── Build strip (fondo transparente) ────────────────────────────────────────

async function buildBaseStrip(w, h) {
  const bordeH   = Math.round(BORDE_H_SCL * (h / STRIP_H));
  const bordeTop = Math.round(BORDE_TOP   * (h / STRIP_H));
  const scale    = w / STRIP_W;

  // 1. Base totalmente transparente (RGBA)
  const baseBuf = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();

  // 2. Borde de madera — mantiene sus propios píxeles (no se hace transparente)
  const bordeBuf = await sharp(BORDE_PATH)
    .resize(w, bordeH, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // 3. Logo HOUSE OF SHAKE — texto blanco sobre transparente
  const textoTrimBuf = await sharp(TEXTO_PATH).trim().toBuffer();
  const textoMeta    = await sharp(textoTrimBuf).metadata();
  const ar = textoMeta.width / textoMeta.height;

  // Caja 720×160 @2x — lo más grande posible
  const maxTW = Math.round(720 * scale);
  const maxTH = Math.round(160 * (h / STRIP_H));
  let tw, th;
  if (ar >= maxTW / maxTH) {
    tw = maxTW; th = Math.round(maxTW / ar);
  } else {
    th = maxTH; tw = Math.round(maxTH * ar);
  }

  const textoBuf  = await sharp(textoTrimBuf).resize(tw, th).toBuffer();
  const textoLeft = Math.round((w - tw) / 2);
  const textoTop  = Math.round(TEXTO_TOP_2X * (h / STRIP_H));

  // 4. Composite sobre fondo transparente
  return sharp(baseBuf)
    .composite([
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
  // Embeber perfil sRGB para que iOS renderice el strip en el mismo espacio de color
  // que el backgroundColor del pass (evita diferencia visual en Display P3)
  return sharp(baseBuf)
    .withMetadata({ icc: 'srgb' })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

module.exports = { generateStripImage };
