const { PKPass } = require('passkit-generator');
const apn = require('apn');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const logger = require('../config/logger');

const CERTS_DIR = path.resolve(process.env.WALLET_CERTIFICATE_PATH
  ? path.dirname(process.env.WALLET_CERTIFICATE_PATH)
  : './certs');

function areCertsAvailable() {
  const certPath = process.env.WALLET_CERTIFICATE_PATH;
  const wwdrPath = process.env.WWDR_CERTIFICATE_PATH;
  return certPath && wwdrPath && fs.existsSync(certPath) && fs.existsSync(wwdrPath);
}

async function generatePass(customer, pointsData) {
  if (!areCertsAvailable()) {
    logger.warn('Certificados Apple Wallet no configurados — modo demo');
    return null;
  }

  const config = pointsData;
  const levelNames = { BRONZE: 'BRONCE', SILVER: 'PLATA', GOLD: 'ORO' };
  const levelColors = { BRONZE: 'rgb(205, 127, 50)', SILVER: 'rgb(192, 192, 192)', GOLD: 'rgb(255, 215, 0)' };

  const serial = customer.walletPassSerial || uuidv4();
  const passToken = customer.walletPassToken || uuidv4();

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.WALLET_PASS_TYPE_ID,
    teamIdentifier: process.env.WALLET_TEAM_ID,
    organizationName: 'House of Shake',
    description: 'Tarjeta de Fidelización House of Shake',
    logoText: 'House of Shake',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(200, 80, 50)',
    labelColor: 'rgb(255, 220, 200)',
    serialNumber: serial,
    webServiceURL: `${process.env.WALLET_WEB_SERVICE_URL}/`,
    authenticationToken: passToken,
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: customer.id,
      messageEncoding: 'utf-8',
      altText: `ID: ${customer.id.substring(0, 8).toUpperCase()}`,
    },
    storeCard: {
      headerFields: [
        {
          key: 'level',
          label: 'NIVEL',
          value: levelNames[customer.level] || 'BRONCE',
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      primaryFields: [
        {
          key: 'points',
          label: 'PUNTOS DISPONIBLES',
          value: String(customer.availablePoints || 0),
          changeMessage: 'Tus puntos han cambiado a %@',
        },
      ],
      secondaryFields: [
        {
          key: 'name',
          label: 'CLIENTE',
          value: `${customer.firstName} ${customer.lastName}`,
        },
        {
          key: 'lifetime',
          label: 'PUNTOS TOTALES',
          value: String(customer.lifetimePoints || 0),
        },
      ],
      auxiliaryFields: [
        {
          key: 'next_level',
          label: 'PRÓXIMO NIVEL',
          value: getNextLevelInfo(customer.lifetimePoints || 0),
        },
      ],
      backFields: [
        {
          key: 'terms',
          label: 'Cómo funciona',
          value: 'Gana 1 punto por cada $1 USD gastado. 100 puntos = $5 USD de descuento. Los puntos expiran a los 12 meses.',
        },
        {
          key: 'levels',
          label: 'Niveles',
          value: 'Bronce: 0-100 pts | Plata: 101-300 pts (+10% bonus) | Oro: 301+ pts (+20% bonus)',
        },
        {
          key: 'contact',
          label: 'Contacto',
          value: 'house-of-shake.myshopify.com',
        },
        {
          key: 'customer_id',
          label: 'ID de Cliente',
          value: customer.id.substring(0, 8).toUpperCase(),
        },
      ],
    },
  };

  try {
    const pass = await PKPass.from(
      {
        model: path.join(__dirname, '../../pass-template'),
        certificates: {
          wwdr: fs.readFileSync(process.env.WWDR_CERTIFICATE_PATH),
          signerCert: fs.readFileSync(process.env.WALLET_CERTIFICATE_PATH),
          signerKey: {
            keyFile: fs.readFileSync(process.env.WALLET_CERTIFICATE_PATH),
            passphrase: process.env.WALLET_CERTIFICATE_PASSWORD,
          },
        },
      },
      passJson
    );

    await prisma.customer.update({
      where: { id: customer.id },
      data: { walletPassSerial: serial, walletPassToken: passToken },
    });

    return pass.getAsBuffer();
  } catch (err) {
    logger.error('Error generando pase Wallet:', err);
    throw err;
  }
}

function getNextLevelInfo(lifetimePoints) {
  if (lifetimePoints < 101) return `${101 - lifetimePoints} puntos para Plata`;
  if (lifetimePoints < 301) return `${301 - lifetimePoints} puntos para Oro`;
  return '¡Nivel Oro alcanzado!';
}

async function sendPushUpdate(customer) {
  if (!process.env.APN_KEY_PATH || !fs.existsSync(process.env.APN_KEY_PATH)) {
    logger.warn('APNs no configurado — no se enviará push notification');
    return;
  }

  const registrations = await prisma.walletRegistration.findMany({
    where: { customerId: customer.id },
  });

  if (registrations.length === 0) return;

  const apnProvider = new apn.Provider({
    token: {
      key: fs.readFileSync(process.env.APN_KEY_PATH),
      keyId: process.env.APN_KEY_ID,
      teamId: process.env.APN_TEAM_ID,
    },
    production: process.env.APN_PRODUCTION === 'true',
  });

  const notification = new apn.Notification();
  notification.topic = process.env.WALLET_PASS_TYPE_ID;
  notification.pushType = 'background';

  for (const reg of registrations) {
    try {
      await apnProvider.send(notification, reg.pushToken);
      logger.info(`Push enviado a dispositivo ${reg.deviceId}`);
    } catch (err) {
      logger.error(`Error enviando push a ${reg.deviceId}:`, err);
    }
  }

  apnProvider.shutdown();
}

module.exports = { generatePass, sendPushUpdate, areCertsAvailable };
