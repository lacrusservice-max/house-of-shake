/**
 * stamp.composer.js
 * Genera la imagen strip del Apple Wallet pass con los pinos
 * estampados pixel-perfect sobre cada slot del banner.
 *
 * Banner original: 750×304 px
 * Strip @2x target: 750×246 px  (escala vertical: 246/304 = 0.809)
 * Strip @1x target: 375×123 px  (mitad exacta del @2x)
 *
 * Centros de los 10 slots en el banner ORIGINAL (750×304),
 * detectados por análisis de brillo por columna:
 *   X: [100, 165, 222, 277, 335, 392, 450, 510, 567, 622]
 *   Y: 250
 *
 * Al escalar a 750×246, Y escala a: 250 × (246/304) ≈ 202
 * X no cambia (mismo ancho 750).
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const BANNER_PATH = path.resolve(__dirname, '../../assets/apple-wallet-banner.jpg');
const PINO_PATH   = path.resolve(__dirname, '../../assets/acumulador-pino.png');

// Centros de los 10 slots en la imagen @2x resultante (750×246)
const SCALE_Y     = 246 / 304;
const SLOT_Y_2X   = Math.round(250 * SCALE_Y); // 202
const SLOT_X_2X   = [100, 165, 222, 277, 335, 392, 450, 510, 567, 622];

// Tamaño del pino en @2x: 46px de ancho → encaja en slot ~40px con efecto stamp
const PINE_W_2X = 46;

/**
 * Prepara el PNG del pino con canal alpha correcto.
 * Si el fondo es negro opaco, lo convierte a transparente.
 */
async function preparePino(targetWidth) {
  const meta = await sharp(PINO_PATH).metadata();

  // Redimensionar manteniendo proporción
  const resized = await sharp(PINO_PATH)
    .resize(targetWidth)
    .removeAlpha()    // normalizar a RGB puro
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    // Fondo negro puro (R,G,B < 8) → transparente; árbol → opaco
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
 * Genera el strip image con los pinos compositeados.
 *
 * @param {number} stampsEarned  0–10
 * @param {'2x'|'1x'} resolution
 * @returns {Promise<Buffer>}  JPEG buffer listo para insertar en el pass
 */
async function generateStripImage(stampsEarned, resolution = '2x') {
  const is2x      = resolution === '2x';
  const stripW    = is2x ? 750 : 375;
  const stripH    = is2x ? 246 : 123;
  const pineW     = is2x ? PINE_W_2X : Math.round(PINE_W_2X / 2);
  const slotY     = is2x ? SLOT_Y_2X : Math.round(SLOT_Y_2X / 2);
  const slotXList = is2x
    ? SLOT_X_2X
    : SLOT_X_2X.map(x => Math.round(x / 2));

  // Banner escalado al tamaño exacto del strip
  const bannerBuf = await sharp(BANNER_PATH)
    .resize(stripW, stripH, { fit: 'fill' })   // fill: escala exacto sin recorte
    .toBuffer();

  if (stampsEarned <= 0) {
    return sharp(bannerBuf).png({ compressionLevel: 6 }).toBuffer();
  }

  // Preparar el pino con transparencia correcta
  const pinoBuf  = await preparePino(pineW);
  const pinoMeta = await sharp(pinoBuf).metadata();
  const pineH    = pinoMeta.height;

  // Compositar N pinos sobre el banner
  const composites = [];
  for (let i = 0; i < Math.min(stampsEarned, 10); i++) {
    composites.push({
      input: pinoBuf,
      left:  Math.round(slotXList[i] - pineW / 2),
      top:   Math.round(slotY - pineH / 2),
    });
  }

  return sharp(bannerBuf)
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

module.exports = { generateStripImage };
