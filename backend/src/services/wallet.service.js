/**
 * Apple Wallet service — House of Shake Loyalty
 *
 * Certificados soportados en dos modos (prioridad: base64 > archivo):
 *   Base64 (Railway-safe):  WALLET_CERT_BASE64, WWDR_CERT_BASE64
 *   Archivo local:          WALLET_CERTIFICATE_PATH, WWDR_CERTIFICATE_PATH
 */
const { PKPass } = require('passkit-generator');
const forge     = require('node-forge');
const apn       = require('apn');
const path      = require('path');
const fs        = require('fs');
const { v4: uuidv4 } = require('uuid');
const prisma    = require('../config/prisma');
const logger    = require('../config/logger');

// ─── Certificate loading ──────────────────────────────────────────────────────

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

function areCertsAvailable() {
  const p12 = loadCertBuffer('WALLET_CERT_BASE64', 'WALLET_CERTIFICATE_PATH');
  const wwdr = loadCertBuffer('WWDR_CERT_BASE64', 'WWDR_CERTIFICATE_PATH');
  return !!(p12 && wwdr && process.env.WALLET_PASS_TYPE_ID && process.env.WALLET_TEAM_ID &&
            process.env.WALLET_TEAM_ID !== 'PENDIENTE');
}

/** Parse a .p12 buffer → { signerCert: Buffer (PEM), signerKey: Buffer (PEM) } */
function parseP12(p12Buffer, password = '') {
  try {
    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const asn1   = forge.asn1.fromDer(p12Der);
    const p12Obj = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);

    // Extract all certs and pick the leaf (signing cert, not CA)
    const certBags = p12Obj.getBags({ bagType: forge.pki.oids.certBag });
    const certs = (certBags[forge.pki.oids.certBag] || []).map(b => b.cert);
    if (!certs.length) throw new Error('No certificates found in .p12 file');

    // Prefer cert with a CN that isn't WWDR/Apple
    const leaf = certs.find(c => {
      const cn = c.subject.getField('CN')?.value || '';
      return !cn.includes('Apple') && !cn.includes('WWDR');
    }) || certs[0];

    // Extract private key
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

// ─── Pass generation ──────��───────────────────────────────────────────────────

const LEVEL_NAMES  = { BRONZE: 'BRONCE', SILVER: 'PLATA', GOLD: 'ORO' };
const LEVEL_COLORS = {
  BRONZE: 'rgb(205, 127, 50)',
  SILVER: 'rgb(192, 192, 192)',
  GOLD:   'rgb(255, 215, 0)',
};

function getNextLevelInfo(lifetimePoints) {
  if (lifetimePoints < 101) return `${101 - lifetimePoints} pts para Plata`;
  if (lifetimePoints < 301) return `${301 - lifetimePoints} pts para Oro`;
  return '¡Nivel Oro alcanzado!';
}

async function generatePass(customer) {
  if (!areCertsAvailable()) {
    logger.warn('Certificados Apple Wallet no configurados — modo demo');
    return null;
  }

  const p12Buffer = loadCertBuffer('WALLET_CERT_BASE64', 'WALLET_CERTIFICATE_PATH');
  const wwdrBuffer = loadCertBuffer('WWDR_CERT_BASE64', 'WWDR_CERTIFICATE_PATH');
  const password  = process.env.WALLET_CERTIFICATE_PASSWORD || '';

  const { signerCert, signerKey } = parseP12(p12Buffer, password);

  const serial    = customer.walletPassSerial || uuidv4();
  const passToken = customer.walletPassToken  || uuidv4();

  const overrides = {
    passTypeIdentifier: process.env.WALLET_PASS_TYPE_ID,
    teamIdentifier:     process.env.WALLET_TEAM_ID,
    serialNumber:       serial,
    authenticationToken: passToken,
    webServiceURL: `${process.env.WALLET_WEB_SERVICE_URL || process.env.API_BASE_URL + '/wallet'}/`,
    barcode: {
      format:          'PKBarcodeFormatQR',
      message:         customer.id,
      messageEncoding: 'utf-8',
      altText:         `ID: ${customer.id.substring(0, 8).toUpperCase()}`,
    },
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(200, 80, 50)',
    labelColor:      'rgb(255, 220, 200)',
    storeCard: {
      headerFields: [
        {
          key:            'level',
          label:          'NIVEL',
          value:          LEVEL_NAMES[customer.level] || 'BRONCE',
          textAlignment:  'PKTextAlignmentRight',
        },
      ],
      primaryFields: [
        {
          key:           'points',
          label:         'PUNTOS DISPONIBLES',
          value:         String(customer.availablePoints || 0),
          changeMessage: 'Tus puntos cambiaron a %@',
        },
      ],
      secondaryFields: [
        {
          key:   'name',
          label: 'CLIENTE',
          value: `${customer.firstName} ${customer.lastName}`,
        },
        {
          key:   'lifetime',
          label: 'PUNTOS TOTALES',
          value: String(customer.lifetimePoints || 0),
        },
      ],
      auxiliaryFields: [
        {
          key:   'next_level',
          label: 'PRÓXIMO NIVEL',
          value: getNextLevelInfo(customer.lifetimePoints || 0),
        },
      ],
      backFields: [
        {
          key:   'how',
          label: '¿Cómo funciona?',
          value: '1 punto por cada $1 MXN gastado. 100 puntos = $5 MXN de descuento en tu próxima compra.',
        },
        {
          key:   'levels',
          label: 'Niveles',
          value: 'Bronce: 0–100 pts | Plata: 101–300 pts (+10% bonus) | Oro: 301+ pts (+20% bonus)',
        },
        {
          key:   'redeem',
          label: 'Canjear',
          value: 'Muestra tu tarjeta al staff al pagar. El staff escaneará tu QR y aplicará el descuento.',
        },
        {
          key:   'app',
          label: 'Ver tu saldo online',
          value: 'house-of-shake.vercel.app/mi-cuenta',
        },
        {
          key:   'id',
          label: 'ID de Cliente',
          value: customer.id.substring(0, 8).toUpperCase(),
        },
      ],
    },
  };

  const pass = await PKPass.from(
    {
      model:        path.resolve(__dirname, '../../pass-template.pass'),
      certificates: { wwdr: wwdrBuffer, signerCert, signerKey },
    },
    overrides
  );

  // Persist serial + token in DB
  await prisma.customer.update({
    where: { id: customer.id },
    data:  { walletPassSerial: serial, walletPassToken: passToken },
  });

  return pass.getAsBuffer();
}

// ─── APNs push update ───��─────────────────────────────────────────────────────

async function sendPushUpdate(customer) {
  // Support base64 APN key too
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

  const notification      = new apn.Notification();
  notification.topic      = process.env.WALLET_PASS_TYPE_ID;
  notification.pushType   = 'background';
  notification.expiry     = Math.floor(Date.now() / 1000) + 3600;

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

// ─── Config status (for admin UI) ─���───────────────────────────────────────────

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
      p12_certificate: !!p12,
      wwdr_certificate: !!wwdr,
      team_id:    !!(teamId && teamId !== 'PENDIENTE'),
      pass_type_id: !!passId,
      apns_key:   !!apnKey,
      pass_type_id_value: passId || null,
      team_id_value:      (teamId && teamId !== 'PENDIENTE') ? teamId : null,
    },
  };
}

module.exports = { generatePass, sendPushUpdate, areCertsAvailable, getWalletStatus };
