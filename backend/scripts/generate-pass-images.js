#!/usr/bin/env node
/**
 * Genera todas las imágenes requeridas para el Apple Wallet pass
 * House of Shake — colores: #C85032 (rojo) / #2C1A0E (café oscuro) / #F5C842 (oro)
 *
 * Sin dependencias externas — puro Node.js + zlib
 *
 * Uso: node scripts/generate-pass-images.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../pass-template/images');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ─── CRC32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── PNG builder ──────────────────────────────────────────────────────────────
function makePNG(w, h, getPixel) {
  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = getPixel(x, y, w, h);
      const i = (y * w + x) * 4;
      pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
    }
  }
  const rowSize = w * 4;
  const raw = Buffer.alloc(h * (rowSize + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowSize + 1)] = 0; // filter: None
    pixels.copy(raw, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crcB]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, RGBA

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Color helpers ──────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function lerpRgb(c1, c2, t) { return c1.map((v, i) => lerp(v, c2[i], t)); }
function dist(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }

// Brand colors
const RED    = hexToRgb('#C85032');
const DARK   = hexToRgb('#2C1A0E');
const GOLD   = hexToRgb('#F5C842');
const CREAM  = hexToRgb('#FBF7F0');
const MID    = hexToRgb('#8B2E14');  // midpoint between red and dark

// ─── ICON (coffee cup mark on dark background) ──────────────────────────────
function makeIcon(size) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.42;       // outer circle
  const r2 = size * 0.30;       // inner circle (cup body)
  return makePNG(size, size, (x, y) => {
    const d = dist(x, y, cx, cy);

    // Outer circle — brand red
    if (d <= r) {
      // Coffee cup silhouette
      // Steam dots (2 small circles above cup)
      const s1 = dist(x, y, cx - size*0.10, cy - r2 * 0.55);
      const s2 = dist(x, y, cx + size*0.10, cy - r2 * 0.55);
      if (s1 <= size * 0.07 || s2 <= size * 0.07) return [...GOLD, 255];

      // Cup body (trapezoid approximation via ellipse + clip)
      const cupTop    = cy - r2 * 0.30;
      const cupBottom = cy + r2 * 0.55;
      const cupW      = r2 * 0.75;
      const taper = 0.85; // bottom narrower
      if (y >= cupTop && y <= cupBottom) {
        const t = (y - cupTop) / (cupBottom - cupTop);
        const halfW = cupW * (1 - t * (1 - taper));
        if (Math.abs(x - cx) <= halfW) return [...CREAM, 255];
      }

      // Handle (small arc right side of cup)
      const handleCx = cx + r2 * 0.72;
      const handleCy = cy + r2 * 0.10;
      const hOuter = r2 * 0.25, hInner = r2 * 0.13;
      const hd = dist(x, y, handleCx, handleCy);
      if (hd <= hOuter && hd >= hInner && y >= cy - r2*0.15 && y <= cy + r2*0.35) return [...CREAM, 255];

      // Saucer (flat ellipse below cup)
      const saucerY = cupBottom + size * 0.035;
      const saucerW = r2 * 0.95, saucerH = size * 0.06;
      if (Math.abs(y - saucerY) <= saucerH && Math.abs(x - cx) <= saucerW) return [...CREAM, 255];

      // Background of outer circle
      return [...RED, 255];
    }

    // Outside circle — dark background
    return [...DARK, 255];
  });
}

// ─── LOGO (brand pill: "HOS" mark + colored band) ───────────────────────────
function makeLogo(w, h) {
  return makePNG(w, h, (x, y, W, H) => {
    const t = x / W;    // 0→1 horizontal gradient
    const margin = H * 0.12;

    if (y < margin || y > H - margin) return [...DARK, 0]; // transparent edges

    // Horizontal gradient: DARK → RED → GOLD (left to right)
    let r, g, b;
    if (t < 0.5) {
      [r, g, b] = lerpRgb(DARK, RED, t * 2);
    } else {
      [r, g, b] = lerpRgb(RED, MID, (t - 0.5) * 2);
    }

    // Gold accent stripe at 80%
    if (t > 0.78 && t < 0.82) [r, g, b] = GOLD;

    return [r, g, b, 255];
  });
}

// ─── STRIP (wide background for storeCard strip area) ───────────────────────
function makeStrip(w, h) {
  return makePNG(w, h, (x, y, W, H) => {
    const tx = x / W;
    const ty = y / H;

    // Radial highlight from top-left
    const radial = 1 - Math.min(1, dist(x, y, 0, 0) / (W * 0.8));
    const highlight = radial * 0.25;

    // Base gradient: dark (bottom-right) → red (top-left)
    const t = (tx * 0.4 + ty * 0.6);
    const [r, g, b] = lerpRgb(RED, DARK, t);

    // Horizontal gold band near top
    const band = ty < 0.04 ? 1 : ty < 0.08 ? 1 - (ty - 0.04) / 0.04 : 0;

    return [
      Math.min(255, Math.round(r + (GOLD[0] - r) * band * 0.8 + (255 - r) * highlight)),
      Math.min(255, Math.round(g + (GOLD[1] - g) * band * 0.8 + (255 - g) * highlight)),
      Math.min(255, Math.round(b + (GOLD[2] - b) * band * 0.8 + (255 - b) * highlight)),
      255,
    ];
  });
}

// ─── THUMBNAIL (small rect version of icon) ─────────────────────────────────
function makeThumbnail(size) {
  // Simple centered coffee badge
  return makePNG(size, size, (x, y, W, H) => {
    const t = Math.max(x/W, y/H);
    const [r, g, b] = lerpRgb(RED, DARK, t * 0.7);
    return [r, g, b, 255];
  });
}

// ─── Write all required images ───────────────────────────────────────────────
const specs = [
  // icon: app notification icon
  { name: 'icon.png',           fn: () => makeIcon(29) },
  { name: 'icon@2x.png',        fn: () => makeIcon(58) },
  { name: 'icon@3x.png',        fn: () => makeIcon(87) },
  // logo: brand logo on pass strip
  { name: 'logo.png',           fn: () => makeLogo(160, 50) },
  { name: 'logo@2x.png',        fn: () => makeLogo(320, 100) },
  { name: 'logo@3x.png',        fn: () => makeLogo(480, 150) },
  // strip: background for storeCard
  { name: 'strip.png',          fn: () => makeStrip(375, 123) },
  { name: 'strip@2x.png',       fn: () => makeStrip(750, 246) },
  { name: 'strip@3x.png',       fn: () => makeStrip(1125, 369) },
  // thumbnail (optional, used in some pass layouts)
  { name: 'thumbnail.png',      fn: () => makeThumbnail(90) },
  { name: 'thumbnail@2x.png',   fn: () => makeThumbnail(180) },
];

console.log('\n🎨  Generando imágenes del Apple Wallet pass...\n');
for (const { name, fn } of specs) {
  const buf = fn();
  const out = path.join(OUT, name);
  fs.writeFileSync(out, buf);
  console.log(`  ✅  ${name.padEnd(20)} ${buf.length.toLocaleString()} bytes`);
}

console.log('\n✅  Todas las imágenes generadas en:', OUT, '\n');
