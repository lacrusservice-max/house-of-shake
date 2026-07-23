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

async function sendPointsEarned({ to, firstName, pointsAdded, newBalance }) {
  const pinesAdded   = Math.floor(pointsAdded / 10);
  const pinesTotal   = Math.floor(newBalance / 10);
  const pinesInCycle = pinesTotal % 120;
  const pinesLeft    = 120 - pinesInCycle;

  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>¡Acabas de acumular Pinos en tu visita a House of Shake! 🌲</p>
    <div class="pts-box">
      <div class="pts-num">+${pinesAdded} 🌲</div>
      <div class="pts-lbl">Pinos ganados</div>
    </div>
    <p style="text-align:center;color:#666;font-size:14px">
      Pinos en tu ciclo: <strong style="color:${NAVY}">${pinesInCycle} / 120</strong>
      ${pinesInCycle >= 120 ? '&nbsp;·&nbsp; <strong style="color:#16a34a">¡Bebida lista!</strong>' : `&nbsp;·&nbsp; Te faltan <strong>${pinesLeft}</strong> para bebida gratis`}
    </p>
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app/mi-cuenta">Ver mis Pinos</a>
    </p>
    <p style="color:#aaa;font-size:12px;margin-top:20px">1 Pino = $10 MXN · 120 Pinos = bebida gratis hasta $90 MXN</p>
  `;
  await send(to, `+${pinesAdded} Pinos 🌲 en House of Shake`, baseLayout(body));
}

async function sendLevelUp({ to, firstName, newLevel, newBalance }) {
  // En el sistema de Pinos no hay niveles visibles; este email solo se usa internamente.
  // Lo mantenemos silencioso (no enviamos nada al cliente).
  logger.debug(`sendLevelUp skipped for ${to} — no hay niveles en el sistema de Pinos`);
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
  const pinesBonus = Math.floor(availablePoints / 10);
  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>Bienvenido a la membresía House of Shake. A partir de ahora, cada visita suma Pinos. 🌲</p>
    <div class="pts-box">
      <div class="pts-num" style="font-size:32px">🌲 BIENVENIDO</div>
      <div class="pts-lbl" style="margin-top:4px">
        ${pinesBonus > 0 ? `+${pinesBonus} Pinos de regalo — ya puedes usarlos` : 'Membresía activa — listo para acumular'}
      </div>
    </div>
    <p><strong>¿Cómo funciona?</strong></p>
    <ul style="color:#555;font-size:14px;line-height:2">
      <li>Ganas <strong>1 Pino por cada $10 MXN</strong> que consumas</li>
      <li>Con <strong>120 Pinos</strong> obtienes una bebida gratis hasta $90 MXN</li>
      <li>Muestra tu código QR al staff antes de pagar</li>
      <li>Bonus: +20 Pinos en tu cumpleaños 🎂 · Pinos dobles en temporadas especiales ⚡</li>
    </ul>
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app/mi-cuenta">Ver mis Pinos</a>
    </p>
  `;
  await send(to, 'Bienvenido a House of Shake — Membresía activa 🌲', baseLayout(body));
}

async function sendPasswordReset({ to, firstName, resetLink }) {
  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>Recibimos una solicitud para restablecer tu contraseña de House of Shake Rewards.</p>
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="${resetLink}">Crear nueva contraseña</a>
    </p>
    <p style="color:#888;font-size:12px;margin-top:20px">
      Este enlace expira en 30 minutos. Si tú no solicitaste esto, puedes ignorar este correo — tu contraseña actual sigue funcionando normalmente.
    </p>
  `;
  await send(to, 'Restablece tu contraseña — House of Shake', baseLayout(body));
}

async function sendInactiveReminder({ to, firstName, availablePoints, daysSinceVisit }) {
  const body = `
    <p>Hola <strong>${firstName}</strong>,</p>
    <p>Hace ${daysSinceVisit} días que no te vemos por House of Shake — ¡te extrañamos!</p>
    ${availablePoints > 0
      ? `<div class="pts-box">
           <div class="pts-num">${Math.floor(availablePoints / 10)} 🌲</div>
           <div class="pts-lbl">Pinos esperándote</div>
         </div>
         <p style="text-align:center;color:#666;font-size:14px">
           Te faltan <strong style="color:${NAVY}">${120 - (Math.floor(availablePoints / 10) % 120)} Pinos</strong> para tu bebida gratis
         </p>`
      : `<p>Todavía no tienes Pinos — tu próxima visita es el mejor momento para empezar.</p>`
    }
    <p style="text-align:center;margin-top:24px">
      <a class="btn" href="https://house-of-shake.vercel.app">Visitarnos hoy</a>
    </p>
  `;
  await send(to, `Te extrañamos en House of Shake ☕ — tienes ${Math.floor(availablePoints / 10)} Pinos`, baseLayout(body));
}

module.exports = { sendPointsEarned, sendLevelUp, sendPointsRedeemed, sendWelcome, sendPasswordReset, sendInactiveReminder };
