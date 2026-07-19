// Endpoints requeridos por Apple Wallet Web Service Protocol
const prisma = require('../config/prisma');
const walletService = require('../services/wallet.service');
const logger = require('../config/logger');

// POST /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}
async function registerDevice(req, res, next) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
    const { pushToken } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('ApplePass ')) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const passToken = authHeader.substring(10);
    const customer = await prisma.customer.findFirst({
      where: { walletPassSerial: serialNumber, walletPassToken: passToken },
    });

    if (!customer) return res.status(401).json({ error: 'Pase no autorizado' });

    await prisma.walletRegistration.upsert({
      where: {
        deviceId_passSerial: {
          deviceId: deviceLibraryIdentifier,
          passSerial: serialNumber,
        },
      },
      update: { pushToken },
      create: {
        customerId: customer.id,
        deviceId: deviceLibraryIdentifier,
        pushToken,
        passSerial: serialNumber,
      },
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { walletRegistered: true, pushToken },
    });

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}
async function unregisterDevice(req, res, next) {
  try {
    const { deviceLibraryIdentifier, serialNumber } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('ApplePass ')) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    await prisma.walletRegistration.deleteMany({
      where: {
        deviceId: deviceLibraryIdentifier,
        passSerial: serialNumber,
      },
    });

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// GET /v1/devices/{deviceId}/registrations/{passTypeId}
async function getPassesForDevice(req, res, next) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = req.params;
    const { passesUpdatedSince } = req.query;

    const where = { deviceId: deviceLibraryIdentifier };
    if (passesUpdatedSince) {
      where.customer = {
        updatedAt: { gt: new Date(parseInt(passesUpdatedSince) * 1000) },
      };
    }

    const registrations = await prisma.walletRegistration.findMany({
      where,
      include: { customer: true },
    });

    if (registrations.length === 0) return res.status(204).send();

    const serialNumbers = registrations.map(r => r.passSerial);
    const lastUpdated = Math.max(...registrations.map(r =>
      Math.floor(r.customer.updatedAt.getTime() / 1000)
    ));

    res.json({ serialNumbers, lastUpdated: String(lastUpdated) });
  } catch (err) {
    next(err);
  }
}

// GET /v1/passes/{passTypeId}/{serial}
async function getLatestPass(req, res, next) {
  try {
    const { passTypeIdentifier, serialNumber } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('ApplePass ')) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const passToken = authHeader.substring(10);
    const customer = await prisma.customer.findFirst({
      where: { walletPassSerial: serialNumber, walletPassToken: passToken },
      select: {
        id: true, firstName: true, lastName: true,
        availablePoints: true, lifetimePoints: true,
        level: true, walletPassSerial: true, walletPassToken: true,
        updatedAt: true,
      },
    });

    if (!customer) return res.status(401).json({ error: 'No autorizado' });

    const passBuffer = await walletService.generatePass(customer);
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': customer.updatedAt.toUTCString(),
    });
    res.send(passBuffer);
  } catch (err) {
    next(err);
  }
}

// POST /v1/log
async function logError(req, res) {
  const { logs } = req.body;
  if (logs) logger.warn('Apple Wallet log:', logs);
  res.status(200).send();
}

module.exports = { registerDevice, unregisterDevice, getPassesForDevice, getLatestPass, logError };
