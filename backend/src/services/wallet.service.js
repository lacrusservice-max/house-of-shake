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
const { puntosToPinos, formatPinos, TIER_REPOSTERIA, TIER_BEBIDAS, TIER_ESPECIALES } = require('./pinos');
const { generateStripImage } = require('./stamp.composer');

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

let avisoFaltaAPNs = false;

// ─── Pass helpers ─────────────────────────────────────────────────────────────

// Premio más barato del menú (repostería). Es la meta a partir de la cual el
// cliente ya puede canjear algo.
const CHEAPEST_REWARD = TIER_REPOSTERIA;

// Sistema de Pinos: 1 Pino = 10 pts. Canje por categoría: 100 / 110 / 120.
//
// El saldo ES el progreso. Antes se usaba `availPines % 120`, así que la
// tarjeta de alguien con 243 Pinos mostraba "3/120" — igual que la web, ocultaba
// que ya tenía premio. Ahora el pass refleja el mismo estado que la cuenta.
function getPineProgress(availablePoints, lifetimePoints, meta = CHEAPEST_REWARD) {
  // Se usa puntosToPinos/formatPinos del módulo central: con Math.floor, una
  // compra de $65 (6.5 Pinos) se veía como 6 en la tarjeta y como 6.5 en la
  // web, y el cliente creía que el Wallet le contaba de menos.
  const availPines   = puntosToPinos(availablePoints || 0);
  const availLabel   = formatPinos(availablePoints || 0);
  const hasReward    = availPines >= meta;
  const sobrante     = availPines % meta;
  const pinesLeft    = round1(hasReward
    ? (sobrante === 0 ? meta : meta - sobrante)
    : Math.max(0, meta - availPines));
  const pinesInCycle = round1(hasReward ? meta - pinesLeft : availPines);
  const totalPines   = puntosToPinos(lifetimePoints || 0);
  const totalLabel   = formatPinos(lifetimePoints || 0);
  const rewardsReady = Math.floor(availPines / meta);
  return { availPines, availLabel, pinesInCycle, pinesLeft, totalPines, totalLabel, hasReward, rewardsReady, meta };
}

const round1 = (n) => Math.round(n * 10) / 10;

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
 *           visitCount?, walletPassSerial?, walletPassToken? }} customerData
 * @returns {Promise<Buffer>}
 */
async function generatePassBuffer(customerData) {
  const certs = getCerts();
  if (!certs) throw new Error('Certificados Apple Wallet no configurados');

  const { signerCert, signerKey, wwdrBuffer } = certs;
  const serial    = customerData.walletPassSerial || uuidv4();
  const passToken = customerData.walletPassToken  || uuidv4().replace(/-/g, '');

  const { pinesInCycle, pinesLeft, hasReward, rewardsReady, availPines, meta } = getPineProgress(
    customerData.availablePoints,
    customerData.lifetimePoints
  );

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
      foregroundColor:     'rgb(255, 255, 255)',
      backgroundColor:     'rgb(15, 68, 139)',
      labelColor:          'rgb(180, 210, 255)',
    }
  );

  // Strip de marca: navy + logo + borde. El texto del cliente NO va aquí
  // (Wallet recorta el strip); va en los campos nativos de abajo.
  try {
    const [strip2x, strip1x] = await Promise.all([
      generateStripImage('2x'),
      generateStripImage('1x'),
    ]);
    pass.addBuffer('strip.png',    strip1x);
    pass.addBuffer('strip@2x.png', strip2x);
    pass.addBuffer('strip@3x.png', strip2x);
    logger.info(`Wallet strip generado (${pinesInCycle}/${meta} Pinos) — cliente ${customerData.id.substring(0, 8)}`);
  } catch (err) {
    logger.error(`Stamp composer falló: ${err.message}`);
  }

  pass.setBarcodes({
    format:          'PKBarcodeFormatQR',
    message:         customerData.id,
    messageEncoding: 'utf-8',
    altText:         customerData.memberNumber
      ? `SOCIO #${customerData.memberNumber}`
      : `ID: ${customerData.id.substring(0, 8).toUpperCase()}`,
  });

  // Header (arriba, junto al logo): contador de Pinos del ciclo
  pass.headerFields.push({
    key:           'pines',
    label:         'PINOS',
    value:         availLabel,
    textAlignment: 'PKTextAlignmentRight',
  });

  // Campos nativos en la zona crema (SIEMPRE visibles, nunca se recortan):
  // fila 1 → nombre del cliente + Pinos restantes
  const rewardMsg = hasReward
    ? `🎉 ¡Llegaste a la meta! Te alcanza para ${rewardsReady} producto${rewardsReady === 1 ? '' : 's'} gratis. Muestra este QR al staff.`
    : `Te faltan ${pinesLeft} Pinos para tu primer producto gratis.`;

  pass.secondaryFields.push(
    {
      key:   'cliente',
      label: 'CLIENTE',
      value: `${customerData.firstName} ${customerData.lastName}`.trim().toUpperCase(),
    },
    {
      key:           'restantes',
      label:         'TE FALTAN',
      value:         hasReward ? '¡YA!' : `${pinesLeft}`,
      textAlignment: 'PKTextAlignmentRight',
    }
  );
  pass.auxiliaryFields.push({
    key:   'recompensa',
    label: 'RECOMPENSA',
    value: rewardMsg,
  });
  pass.backFields.push(
    { key: 'how',      label: '¿Cómo funciona?',    value: '1 Pino por cada $10 MXN gastados. Muestra tu tarjeta al staff antes de pagar.' },
    { key: 'reward',   label: 'Recompensa',          value: `Desde ${TIER_REPOSTERIA} Pinos canjeas un producto gratis: repostería ${TIER_REPOSTERIA} · cafés y bebidas ${TIER_BEBIDAS} · milkshakes y alimentos ${TIER_ESPECIALES}.` },
    { key: 'bonuses',  label: 'Bonos especiales',    value: '+20 Pinos en tu cumpleaños · +10 Pinos al registrarte · Pinos dobles en temporadas especiales' },
    { key: 'redeem',   label: 'Canjear',             value: 'Muestra tu QR al staff y pide lo que quieras del catálogo. Tus Pinos se descuentan solo al canjear; el resto se queda contigo.' },
    { key: 'app',      label: 'Ver tus Pinos online', value: 'house-of-shake.vercel.app/mi-cuenta' },
    { key: 'id',       label: 'ID de Cliente',        value: customerData.id.substring(0, 8).toUpperCase() }
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
    // Antes se saltaba en silencio y nadie se enteraba de que las tarjetas de
    // Apple Wallet nunca recibían el aviso de "tus Pinos cambiaron". El pass sí
    // se regenera con el saldo correcto cuando iOS lo consulta por su cuenta
    // (getLatestPass), pero eso puede tardar horas: sin push, el cliente ve su
    // tarjeta congelada justo después de pagar.
    if (!avisoFaltaAPNs) {
      logger.error(
        '⚠️  APNs sin configurar (falta APN_KEY_BASE64/APN_KEY_PATH o APN_KEY_ID) — ' +
        'las tarjetas de Apple Wallet NO se actualizan al instante. Se refrescarán ' +
        'solas cuando iOS consulte el pass, pero no justo después de cobrar.'
      );
      avisoFaltaAPNs = true;
    }
    return;
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

  let enviados = 0, fallidos = 0;
  try {
    for (const reg of registrations) {
      try {
        // apnProvider.send() NO lanza excepción cuando APNs rechaza: resuelve
        // con { sent, failed }. Antes se daba por enviado todo lo que no
        // explotara, así que un token inválido o una credencial mala se
        // registraban como éxito.
        const res = await apnProvider.send(notification, reg.pushToken);
        if (res?.failed?.length) {
          fallidos++;
          const r = res.failed[0];
          logger.warn(`APNs rechazó a ${reg.deviceId}: ${r.response?.reason || r.error?.message || r.status}`);
          // 410 = el dispositivo desinstaló el pass: su registro ya no sirve.
          if (r.status === '410' || r.response?.reason === 'Unregistered') {
            await prisma.walletRegistration.delete({ where: { id: reg.id } }).catch(() => {});
            logger.info(`Registro de Wallet retirado (dispositivo dio de baja el pass): ${reg.deviceId}`);
          }
        } else {
          enviados++;
        }
      } catch (err) {
        fallidos++;
        logger.warn(`APNs push falló para ${reg.deviceId}: ${err.message}`);
      }
    }
  } finally {
    // En finally: antes, un throw dejaba el Provider abierto y filtraba
    // conexiones con cada cobro.
    apnProvider.shutdown();
  }
  logger.info(`🍎 Wallet push — enviados: ${enviados}, fallidos: ${fallidos} (cliente ${customer.id.substring(0,8)})`);
  return { enviados, fallidos };
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
