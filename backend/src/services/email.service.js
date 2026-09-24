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

/** ¿Hay proveedor de correo configurado? Sin esto no sale ni un solo email. */
function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

let avisoFaltaKey = false;

async function send(to, subject, html) {
  const client = getResend();
  if (!client) {
    // Antes esto era logger.debug: el envío se saltaba en silencio y nadie se
    // enteraba de que NINGÚN correo salía (bienvenida, Pinos, reset de
    // contraseña). Ahora avisa fuerte una vez y deja rastro en cada intento.
    if (!avisoFaltaKey) {
      logger.error(
        '⚠️  RESEND_API_KEY no está configurada — NO se está enviando ningún correo ' +
        '(bienvenida, puntos, recuperación de contraseña). Configúrala en las ' +
        'variables de entorno para activarlos.'
      );
      avisoFaltaKey = true;
    }
    logger.warn(`[correo NO enviado — falta RESEND_API_KEY] Para: ${to} | Asunto: ${subject}`);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const res = await client.emails.send({ from: FROM, to, subject, html });
    if (res?.error) {
      logger.error(`[error de correo] ${to} — ${res.error.message || JSON.stringify(res.error)}`);
      return { sent: false, reason: res.error.message || 'rechazado por el proveedor' };
    }
    logger.info(`📧 Correo enviado a ${to} — ${subject} (id ${res?.data?.id || '—'})`);
    return { sent: true, id: res?.data?.id };
  } catch (err) {
    logger.error(`[error de correo] ${to} — ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

// ── Plantilla ────────────────────────────────────────────────────────────────
//
// Solo dos colores, los mismos de la web: azul #0F448B y blanco.
// Fondo totalmente blanco, sin grises ni crema, y el logo del encabezado en grande.

const BLUE      = '#0F448B';
const BLUE_SOFT = 'rgba(15,68,139,.06)';
const LINE      = 'rgba(15,68,139,.14)';
const TEXT      = '#0F448B';
const TEXT_SOFT = 'rgba(15,68,139,.65)';

const LOGO = 'https://house-of-shake.vercel.app/logo-encabezado.png';
const SITE = 'https://house-of-shake.vercel.app';

function baseLayout(body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#FFFFFF;">
  <!-- Tablas y estilos en línea: Gmail y Outlook ignoran gran parte del CSS
       en <style>, y con clases el correo llegaba sin formato. -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#FFFFFF;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:#FFFFFF;">

          <!-- Logo grande, el mismo del encabezado de la web -->
          <tr>
            <td align="center" style="padding:8px 0 28px;">
              <img src="${LOGO}" alt="House of Shake" width="220"
                   style="display:block;width:220px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>

          <tr>
            <td style="padding:0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                       font-size:15px;line-height:1.75;color:${TEXT_SOFT};">
              ${body}
            </td>
          </tr>

          <tr>
            <td style="padding:32px 8px 0;">
              <div style="border-top:1px solid ${LINE};padding-top:18px;
                          font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                          font-size:12px;line-height:1.7;color:${TEXT_SOFT};text-align:center;">
                House of Shake · Av. Teziutlán Nte. 42, La Paz, Puebla<br>
                <a href="${SITE}/mi-cuenta" style="color:${BLUE};font-weight:700;text-decoration:none;">
                  Ver mi cuenta
                </a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Título de sección, en azul. */
function heading(text) {
  return `<h1 style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                     font-size:26px;line-height:1.2;font-weight:800;color:${BLUE};
                     letter-spacing:-.3px;">${text}</h1>`;
}

/** Botón azul con texto SIEMPRE blanco. */
function button(label, href) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
           style="margin:26px auto 8px;">
      <tr>
        <td align="center" bgcolor="${BLUE}" style="border-radius:12px;">
          <a href="${href}"
             style="display:inline-block;padding:15px 34px;background:${BLUE};
                    color:#FFFFFF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
                    text-decoration:none;border-radius:12px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/** Cifra destacada: azul sobre fondo blanco con borde suave. */
function bigNumber(value, label) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:22px 0;">
      <tr>
        <td align="center" style="background:${BLUE_SOFT};border:1px solid ${LINE};
                                  border-radius:16px;padding:24px 20px;">
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:46px;
                      line-height:1;font-weight:800;color:${BLUE};">${value}</div>
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;
                      letter-spacing:2px;text-transform:uppercase;color:${TEXT_SOFT};
                      margin-top:8px;font-weight:700;">${label}</div>
        </td>
      </tr>
    </table>`;
}

const p = (t) => `<p style="margin:0 0 14px;">${t}</p>`;
const strong = (t) => `<strong style="color:${TEXT};font-weight:800;">${t}</strong>`;
const small = (t) => `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.65;color:${TEXT_SOFT};">${t}</p>`;

// ── Correos ──────────────────────────────────────────────────────────────────

async function sendPointsEarned({ to, firstName, pointsAdded, newBalance }) {
  const pinos = (v) => {
    const n = Math.round((v / 10) * 10) / 10;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };
  const body = `
    ${heading('Sumaste Pinos')}
    ${p(`Hola ${strong(firstName)}, gracias por tu visita a House of Shake.`)}
    ${bigNumber(`+${pinos(pointsAdded)}`, 'Pinos ganados')}
    ${p(`Tu saldo ahora es de ${strong(pinos(newBalance) + ' Pinos')}.`)}
    ${button('Ver mis Pinos', `${SITE}/mi-cuenta`)}
    ${small('Ganas 1 Pino por cada $10 MXN. Desde 100 Pinos ya puedes canjear un producto gratis.')}
  `;
  return send(to, `Sumaste ${pinos(pointsAdded)} Pinos en House of Shake`, baseLayout(body));
}

async function sendLevelUp({ to }) {
  // El sistema de Pinos no tiene niveles visibles: no se envía nada al cliente.
  logger.debug(`sendLevelUp omitido para ${to} — no hay niveles en el sistema de Pinos`);
  return { sent: false, reason: 'sin_niveles' };
}

async function sendPointsRedeemed({ to, firstName, pointsRedeemed, newBalance }) {
  const pinos = (v) => Math.round(v / 10);
  const body = `
    ${heading('Canje realizado')}
    ${p(`Hola ${strong(firstName)}, tu canje se aplicó correctamente.`)}
    ${bigNumber(`${pinos(pointsRedeemed)}`, 'Pinos canjeados')}
    ${p(`Te quedan ${strong(pinos(newBalance) + ' Pinos')} disponibles.`)}
    ${button('Ver mi cuenta', `${SITE}/mi-cuenta`)}
  `;
  return send(to, 'Canje realizado — House of Shake', baseLayout(body));
}

async function sendWelcome({ to, firstName, availablePoints = 0 }) {
  const bonus = Math.round(availablePoints / 10);
  const body = `
    ${heading('Bienvenido a House of Shake')}
    ${p(`Hola ${strong(firstName)}, tu membresía ya está activa. Desde hoy, cada visita suma.`)}
    ${bonus > 0 ? bigNumber(`${bonus}`, 'Pinos de regalo') : ''}
    ${p(strong('Cómo funciona'))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">
      ${[
        'Ganas 1 Pino por cada $10 MXN que consumas.',
        'Desde 100 Pinos puedes canjear un producto gratis.',
        'Repostería 100 · Cafés y bebidas 110 · Milkshakes y alimentos 120 Pinos.',
        'Muestra tu código QR al staff antes de pagar.',
      ].map(t => `
      <tr>
        <td width="18" valign="top" style="padding:5px 0;color:${BLUE};font-weight:800;">·</td>
        <td style="padding:5px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                   font-size:14.5px;line-height:1.65;color:${TEXT_SOFT};">${t}</td>
      </tr>`).join('')}
    </table>
    ${button('Ver mi cuenta', `${SITE}/mi-cuenta`)}
  `;
  return send(to, 'Bienvenido a House of Shake', baseLayout(body));
}

async function sendPasswordReset({ to, firstName, resetLink }) {
  const body = `
    ${heading('Recupera tu contraseña')}
    ${p(`Hola ${strong(firstName)}, recibimos una solicitud para restablecer la contraseña de tu cuenta.`)}
    ${p('Toca el botón para elegir una nueva:')}
    ${button('Crear nueva contraseña', resetLink)}
    ${small(`Este enlace expira en 30 minutos. Si no fuiste tú, ignora este correo — tu contraseña actual sigue funcionando.`)}
    ${small(`¿El botón no funciona? Copia y pega este enlace:<br>
      <a href="${resetLink}" style="color:${BLUE};word-break:break-all;">${resetLink}</a>`)}
  `;
  return send(to, 'Recupera tu contraseña — House of Shake', baseLayout(body));
}

async function sendInactiveReminder({ to, firstName, availablePoints, daysSinceVisit }) {
  const pinos = Math.round(availablePoints / 10);
  const body = `
    ${heading('Te extrañamos')}
    ${p(`Hola ${strong(firstName)}, hace ${daysSinceVisit} días que no te vemos por House of Shake.`)}
    ${pinos > 0
      ? bigNumber(`${pinos}`, 'Pinos esperándote') + p(pinos >= 100
          ? `Ya te alcanza para canjear un producto ${strong('gratis')}.`
          : `Te faltan ${strong((100 - pinos) + ' Pinos')} para tu primer premio.`)
      : p('Tu próxima visita es el mejor momento para empezar a acumular.')}
    ${button('Ver el menú', `${SITE}/menu`)}
  `;
  return send(to, `Te extrañamos en House of Shake`, baseLayout(body));
}

module.exports = {
  sendPointsEarned,
  sendLevelUp,
  sendPointsRedeemed,
  sendWelcome,
  sendPasswordReset,
  sendInactiveReminder,
  isConfigured,
};
