/**
 * Apple Wallet service — House of Shake Loyalty
 *
 * Certificados soportados en dos modos (prioridad: base64 > archivo):
 *   Base64 (Railway-safe):  WALLET_CERT_BASE64, WWDR_CERT_BASE64
 *   Archivo local:          WALLET_CERTIFICATE_PATH, WWDR_CERTIFICATE_PATH
 *
 * Los certificados se parsean UNA SOLA VEZ al arrancar el servidor
 * y se cachean en memoria para evitar overhead en cada solicitud.
 */
const { PKPass } = require('passkit-generator');
const forge      = require('node-forge');
const apn        = require('apn');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');
const prisma     = require('../config/prisma');
const logger     = require('../config/logger');

// ─── Certificate loading & cache ─────────────────────────────────────────────

function loadCertBuffer(base64EnvKey, fileEnvKey) {
  if (process.env[base64EnvKey]) {
    return Buffer.from(process.env[base64EnvKey], 'base64');
  }
  const filePath = process.env[fileEnvKey];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}

/** Parse a .p12 buffer → { signerCert: Buffer (PEM), signerKey: Buffer (PEM) } */
function parseP12(p12Buffer, password = '') {
  try {
    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const asn1   = forge.asn1.fromDer(p12Der);
    const p12Obj = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);

    const certBags = p12Obj.getBags({ bagType: forge.pki.oids.certBag });
    const certs    = (certBags[forge.pki.oids.certBag] || []).map(b => b.cert);
    if (!certs.length) throw new Error('No certificates found in .p12 file');

    const leaf = certs.find(c => {
      const cn = c.subject.getField('CN')?.value || '';
      return !cn.includes('Apple') && !cn.includes('WWDR');
    }) || certs[0];

    const keyBags = p12Obj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag  = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
    if (!keyBag) throw new Error('No private key found in .p12 file');

    return {
      signerCert: Buffer.from(forge.pki.certificateToPem(leaf)),
      signerKey:  Buffer.from(forge.pki.privateKeyToPem(keyBag.key)),
    };
  } catch (err) {
    throw new Error(`Error parsing .p12 certificate: ${err.message}`);
  }
}

// Module-level cert cache — parsed ONCE at startup
let _certCache = null;

function _loadCerts() {
  const p12Buffer  = loadCertBuffer('WALLET_CERT_BASE64', 'WALLET_CERTIFICATE_PATH');
  const wwdrBuffer = loadCertBuffer('WWDR_CERT_BASE64', 'WWDR_CERTIFICATE_PATH');
  if (!p12Buffer || !wwdrBuffer) return null;

  try {
    const { signerCert, signerKey } = parseP12(
      p12Buffer,
      process.env.WALLET_CERTIFICATE_PASSWORD || ''
    );
    _certCache = { signerCert, signerKey, wwdrBuffer };
    logger.info('Apple Wallet: certificados cargados en memoria ✓');
    return _certCache;
  } catch (err) {
    logger.error('Apple Wallet: error cargando certificados —', err.message);
    return null;
  }
}

/** Returns cached certs, loading them on first call. */
function getCerts() {
  return _certCache ?? _loadCerts();
}

/** Call at server startup to eagerly warm up the cert cache. */
function initCerts() {
  if (!areCertsAvailable()) return;
  _loadCerts();
}

function areCertsAvailable() {
  const p12  = loadCertBuffer('WALLET_CERT_BASE64', 'WALLET_CERTIFICATE_PATH');
  const wwdr = loadCertBuffer('WWDR_CERT_BASE64', 'WWDR_CERTIFICATE_PATH');
  const team = process.env.WALLET_TEAM_ID;
  return !!(p12 && wwdr && team && team !== 'PENDIENTE' && process.env.WALLET_PASS_TYPE_ID);
}

// ─── Pass helpers ─────────────────────────────────────────────────────────────

const LEVEL_NAMES = { BRONZE: 'BRONCE', SILVER: 'PLATA', GOLD: 'ORO' };

function getNextLevelInfo(lifetimePoints) {
  if (lifetimePoints < 101) return `${101 - lifetimePoints} pts para Plata`;
  if (lifetimePoints < 301) return `${301 - lifetimePoints} pts para Oro`;
  return '¡Nivel Oro alcanzado!';
}

function buildWebServiceURL() {
  if (process.env.WALLET_WEB_SERVICE_URL) {
    const u = process.env.WALLET_WEB_SERVICE_URL;
    return u.endsWith('/') ? u : `${u}/`;
  }
  const base = (process.env.API_BASE_URL || '').replace(/\/$/, '');
  return `${base}/wallet/`;
}

// ─── Core pass builder (no DB writes) ────────────────────────────────────────

/**
 * Builds and returns a signed .pkpass Buffer for the given customer data.
 * Does NOT write anything to the database — safe to call for previews/tests.
 *
 * @param {{ id, firstName, lastName, availablePoints, lifetimePoints, level,
 *           walletPassSerial?, walletPassToken? }} customerData
 * @returns {Promise<Buffer>}
 */
async function generatePassBuffer(customerData) {
  const certs = getCerts();
  if (!certs) throw new Error('Certificados Apple Wallet no configurados');

  const { signerCert, signerKey, wwdrBuffer } = certs;
  const serial    = customerData.walletPassSerial || uuidv4();
  const passToken = customerData.walletPassToken  || uuidv4().replace(/-/g, '');

  const pass = await PKPass.from(
    {
      model:        path.resolve(__dirname, '../../pass-template.pass'),
      certificates: { wwdr: wwdrBuffer, signerCert, signerKey },
    },
    {
      passTypeIdentifier:  process.env.WALLET_PASS_TYPE_ID,
      teamIdentifier:      process.env.WALLET_TEAM_ID,
      serialNumber:        serial,
      authenticationToken: passToken,
      webServiceURL:       buildWebServiceURL(),
      foregroundColor:     'rgb(224, 212, 180)',
      backgroundColor:     'rgb(27, 47, 86)',
      labelColor:          'rgb(196, 168, 102)',
    }
  );

  pass.setBarcodes({
    format:          'PKBarcodeFormatQR',
    message:         customerData.id,
    messageEncoding: 'utf-8',
    altText:         `ID: ${customerData.id.substring(0, 8).toUpperCase()}`,
  });

  pass.headerFields.push({
    key:           'level',
    label:         'NIVEL',
    value:         LEVEL_NAMES[customerData.level] || 'BRONCE',
    textAlignment: 'PKTextAlignmentRight',
  });
  pass.primaryFields.push({
    key:           'points',
    label:         'PUNTOS DISPONIBLES',
    value:         String(customerData.availablePoints || 0),
    changeMessage: 'Tus puntos cambiaron a %@',
  });
  pass.secondaryFields.push(
    { key: 'name',     label: 'CLIENTE',       value: `${customerData.firstName} ${customerData.lastName}` },
    { key: 'lifetime', label: 'PUNTOS TOTALES', value: String(customerData.lifetimePoints || 0) }
  );
  pass.auxiliaryFields.push({
    key:   'next_level',
    label: 'PRÓXIMO NIVEL',
    value: getNextLevelInfo(customerData.lifetimePoints || 0),
  });
  pass.backFields.push(
    { key: 'how',    label: '¿Cómo funciona?',    value: '1 punto por cada $1 MXN gastado. 100 puntos = $5 MXN de descuento en tu próxima compra.' },
    { key: 'levels', label: 'Niveles',             value: 'Bronce: 0–100 pts | Plata: 101–300 pts (+10% bonus) | Oro: 301+ pts (+20% bonus)' },
    { key: 'redeem', label: 'Canjear',             value: 'Muestra tu tarjeta al staff al pagar. El staff escaneará tu QR y aplicará el descuento.' },
    { key: 'app',    label: 'Ver tu saldo online',  value: 'house-of-shake.vercel.app/mi-cuenta' },
    { key: 'id',     label: 'ID de Cliente',        value: customerData.id.substring(0, 8).toUpperCase() }
  );

  return { buffer: pass.getAsBuffer(), serial, passToken };
}

// ─── Pass generation with DB persistence ─────────────────────────────────────

/**
 * Generates a signed .pkpass for an existing DB customer,
 * persisting the serial + token if they weren't set yet.
 */
async function generatePass(customer) {
  if (!areCertsAvailable()) {
    logger.warn('Certificados Apple Wallet no configurados — modo demo');
    return null;
  }

  const data = {
    ...customer,
    walletPassSerial: customer.walletPassSerial || uuidv4(),
    walletPassToken:  customer.walletPassToken  || uuidv4().replace(/-/g, ''),
  };

  const { buffer, serial, passToken } = await generatePassBuffer(data);

  // Only write to DB if serial/token changed
  if (!customer.walletPassSerial || !customer.walletPassToken) {
    await prisma.customer.update({
      where: { id: customer.id },
      data:  { walletPassSerial: serial, walletPassToken: passToken },
    });
  }

  return buffer;
}

// ─── APNs push update ─────────────────────────────────────────────────────────

async function sendPushUpdate(customer) {
  const apnKeyBuffer = process.env.APN_KEY_BASE64
    ? Buffer.from(process.env.APN_KEY_BASE64, 'base64')
    : (process.env.APN_KEY_PATH && fs.existsSync(process.env.APN_KEY_PATH))
      ? fs.readFileSync(process.env.APN_KEY_PATH)
      : null;

  if (!apnKeyBuffer || !process.env.APN_KEY_ID || process.env.APN_KEY_ID === 'PENDIENTE') {
    return; // APNs not configured — skip silently
  }

  const registrations = await prisma.walletRegistration.findMany({
    where: { customerId: customer.id },
  });
  if (!registrations.length) return;

  const apnProvider = new apn.Provider({
    token: {
      key:    apnKeyBuffer,
      keyId:  process.env.APN_KEY_ID,
      teamId: process.env.APN_TEAM_ID || process.env.WALLET_TEAM_ID,
    },
    production: process.env.APN_PRODUCTION === 'true',
  });

  const notification    = new apn.Notification();
  notification.topic    = process.env.WALLET_PASS_TYPE_ID;
  notification.pushType = 'background';
  notification.expiry   = Math.floor(Date.now() / 1000) + 3600;

  for (const reg of registrations) {
    try {
      await apnProvider.send(notification, reg.pushToken);
      logger.info(`APNs push enviado a dispositivo ${reg.deviceId}`);
    } catch (err) {
      logger.warn(`APNs push falló para ${reg.deviceId}: ${err.message}`);
    }
  }
  apnProvider.shutdown();
}

// ─── Config status (for admin UI) ────────────────────────────────────────────

function getWalletStatus() {
  const p12    = loadCertBuffer('WALLET_CERT_BASE64', 'WALLET_CERTIFICATE_PATH');
  const wwdr   = loadCertBuffer('WWDR_CERT_BASE64', 'WWDR_CERTIFICATE_PATH');
  const teamId = process.env.WALLET_TEAM_ID;
  const passId = process.env.WALLET_PASS_TYPE_ID;
  const apnKey = process.env.APN_KEY_BASE64 ||
                 (process.env.APN_KEY_PATH && fs.existsSync(process.env.APN_KEY_PATH));

  return {
    ready:  !!(p12 && wwdr && teamId && teamId !== 'PENDIENTE' && passId),
    checks: {
      p12_certificate:    !!p12,
      wwdr_certificate:   !!wwdr,
      team_id:            !!(teamId && teamId !== 'PENDIENTE'),
      pass_type_id:       !!passId,
      apns_key:           !!apnKey,
      cert_cached:        !!_certCache,
      pass_type_id_value: passId || null,
      team_id_value:      (teamId && teamId !== 'PENDIENTE') ? teamId : null,
      web_service_url:    buildWebServiceURL(),
    },
  };
}

module.exports = {
  initCerts,
  generatePass,
  generatePassBuffer,
  sendPushUpdate,
  areCertsAvailable,
  getWalletStatus,
};
