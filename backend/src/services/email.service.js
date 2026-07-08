const logger = require('../config/logger');

let resend = null;

function getResend() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = require('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.EMAIL_FROM || 'House of Shake <noreply@houseofshake.com>';

async function send(to, subject, html) {
  const client = getResend();
  if (!client) {
    logger.debug(`[email skip — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await client.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    logger.warn(`[email error] ${err.message}`);
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

const NAVY = '#1B2F56';
const GOLD  = '#C8961E';
const CREAM = '#FBF7F0';

function baseLayout(body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .wrap { max-width:580px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; }
  .hdr { background:${NAVY}; padding:28px 32px; text-align:center; }
  .hdr img { height:44px; }
  .hdr h1 { color:${CREAM}; margin:12px 0 0; font-size:20px; font-weight:800; letter-spacing:1px; }
  .body { padding:32px; color:#333; font-size:15px; line-height:1.7; }
  .pts-box { background:${NAVY}; border-radius:12px; padding:20px 24px; text-align:center; margin:20px 0; }
  .pts-num { font-size:44px; font-weight:900; color:${GOLD}; line-height:1; }
  .pts-lbl { color:${CREAM}; font-size:12px; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
  .btn { display:inline-block; background:${GOLD}; color:#2C1A0E; padding:14px 32px; border-radius:10px; font-weight:800; text-decoration:none; font-size:14px; letter-spacing:.5px; margin-top:8px; }
  .ftr { background:#f8f8f8; padding:16px 32px; font-size:11px; color:#aaa; text-align:center; }
  .level-badge { display:inline-block; background:${GOLD}; color:#2C1A0E; padding:4px 14px; border-radius:20px; font-weight:800; font-size:12px; letter-spacing:1px; text-transform:uppercase; }
  .product-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0; font-size:14px; }
  .product-pts { font-weight:800; color:${GOLD}; }
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <img src="https://house-of-shake.vercel.app/logo-white.png" alt="House of Shake" />
    <h1>HOUSE OF SHAKE</h1>
  </div>
  <div class="body">${body}</div>
  <div class="ftr">House of Shake · Puebla, México<br>
    <a href="https://house-of-shake.vercel.app/mi-cuenta" style="color:${GOLD}">Ver mi cuenta de puntos</a>
  </div>
</div>
</body></html>`;
}

async function sendPointsEarned({ to, firstName, pointsAdded, newBalance, level, affordableProducts = [] }) {
  const productsHtml = affordableProducts.length > 0
    ? `<p style="font-weight:700;color:#333;margin:20px 0 8px">Con tus puntos puedes canjear:</p>
       ${affordableProducts.slice(0, 3).map(p =>
         `<div class="product-row"><span>${p.name}</span><span class="product-pts">${p.pointsValue} pts</span></div>`
       ).join('')}`
    : '';

  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>¡Acabas de acumular puntos en tu visita a House of Shake!</p>
    <div class="pts-box">
      <div class="pts-num">+${pointsAdded}</div>
      <div class="pts-lbl">puntos ganados</div>
    </div>
    <p style="text-align:center;color:#666;font-size:14px">
      Tu saldo actual: <strong style="color:${NAVY}">${newBalance} puntos</strong>
      &nbsp;·&nbsp; Nivel: <span class="level-badge">${level}</span>
    </p>
    ${productsHtml}
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app/mi-cuenta">Ver mi cuenta</a>
    </p>
    <p style="color:#aaa;font-size:12px;margin-top:20px">Recuerda: 100 pts = $5 MXN de descuento en tu próxima compra.</p>
  `;
  await send(to, `+${pointsAdded} puntos en House of Shake`, baseLayout(body));
}

async function sendLevelUp({ to, firstName, newLevel, newBalance }) {
  const LEVEL_NAMES = { SILVER: 'Plata', GOLD: 'Oro' };
  const LEVEL_PERKS = {
    SILVER: '10% de bonus en puntos por cada compra',
    GOLD:   '20% de bonus en puntos + beneficios exclusivos',
  };
  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>¡Felicidades! Acabas de subir de nivel en tu membresía House of Shake.</p>
    <div class="pts-box">
      <div style="font-size:48px;margin-bottom:8px">🎖</div>
      <div class="pts-num" style="font-size:32px">NIVEL ${(LEVEL_NAMES[newLevel] || newLevel).toUpperCase()}</div>
      <div class="pts-lbl" style="margin-top:8px">${LEVEL_PERKS[newLevel] || ''}</div>
    </div>
    <p style="text-align:center;color:#666;font-size:14px">Saldo actual: <strong style="color:${NAVY}">${newBalance} puntos</strong></p>
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app/mi-cuenta">Ver mi cuenta</a>
    </p>
  `;
  await send(to, `¡Subiste a nivel ${LEVEL_NAMES[newLevel] || newLevel}! 🎖`, baseLayout(body));
}

async function sendPointsRedeemed({ to, firstName, pointsRedeemed, discountMxn, newBalance }) {
  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>Tu canje de puntos fue aplicado exitosamente en tu visita a House of Shake.</p>
    <div class="pts-box">
      <div class="pts-num">$${parseFloat(discountMxn).toFixed(0)} MXN</div>
      <div class="pts-lbl">descuento aplicado · ${pointsRedeemed} pts canjeados</div>
    </div>
    <p style="text-align:center;color:#666;font-size:14px">
      Puntos restantes: <strong style="color:${NAVY}">${newBalance} puntos</strong>
    </p>
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app/mi-cuenta">Ver mi cuenta</a>
    </p>
  `;
  await send(to, `Canje exitoso — $${parseFloat(discountMxn).toFixed(0)} MXN de descuento`, baseLayout(body));
}

async function sendWelcome({ to, firstName, availablePoints = 0 }) {
  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>Bienvenido a la membresía House of Shake. A partir de ahora, cada visita suma.</p>
    <div class="pts-box">
      <div class="pts-num" style="font-size:32px">BIENVENIDO</div>
      <div class="pts-lbl" style="margin-top:4px">Membresía activa · ${availablePoints > 0 ? availablePoints + ' pts de bienvenida' : 'listo para acumular'}</div>
    </div>
    <p>¿Cómo funciona?</p>
    <ul style="color:#555;font-size:14px;line-height:2">
      <li>Acumulas <strong>1 punto por cada $1 MXN</strong> que gastes</li>
      <li>Con <strong>100 puntos</strong> obtienes $5 MXN de descuento</li>
      <li>Muestra tu código QR al staff al pagar para acumular</li>
      <li>Sube de nivel: Bronce → Plata (+10% bonus) → Oro (+20% bonus)</li>
    </ul>
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app/mi-cuenta">Ver mi cuenta</a>
    </p>
  `;
  await send(to, 'Bienvenido a House of Shake — Membresía activa', baseLayout(body));
}

async function sendInactiveReminder({ to, firstName, availablePoints, daysSinceVisit }) {
  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>Hace ${daysSinceVisit} días que no te vemos por House of Shake — ¡te extrañamos!</p>
    ${availablePoints > 0
      ? `<div class="pts-box">
           <div class="pts-num">${availablePoints}</div>
           <div class="pts-lbl">puntos esperándote</div>
         </div>
         <p style="text-align:center;color:#666;font-size:14px">
           Equivalen a <strong style="color:${NAVY}">$${Math.floor(availablePoints / 100) * 5} MXN de descuento</strong>
         </p>`
      : `<p>Todavía no tienes puntos acumulados — tu próxima visita es el mejor momento para empezar.</p>`
    }
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app">Visitarnos hoy</a>
    </p>
  `;
  await send(to, 'Te extrañamos en House of Shake ☕', baseLayout(body));
}

module.exports = { sendPointsEarned, sendLevelUp, sendPointsRedeemed, sendWelcome, sendInactiveReminder };
