const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * RESPALDO DE LA BASE
 *
 * La versión anterior llamaba a pg_dump por consola y subía el archivo a
 * Cloudflare R2. Nunca produjo ni un respaldo: R2 jamás se configuró, así que
 * la tarea se saltaba con un aviso, y cuando el proveedor suspendió la base no
 * existía ninguna copia de los clientes ni de sus Pinos.
 *
 * Ahora lee las tablas con Prisma —sin depender de binarios externos, que no
 * existen en un entorno sin servidor— y guarda un JSON. Destino: Vercel Blob
 * si está configurado; si no, disco local. Nunca se salta en silencio: si no
 * hay dónde guardar, lo dice fuerte.
 */

const TABLAS = ['customers', 'transactions', 'products', 'wallet_registrations', 'admin_users', 'config'];

/** Los BigInt de Postgres no son serializables a JSON. */
const reemplazo = (_k, v) => (typeof v === 'bigint' ? Number(v) : v);

async function crearDump() {
  const datos = { fecha: new Date().toISOString(), tablas: {} };
  for (const t of TABLAS) {
    try {
      datos.tablas[t] = await prisma.$queryRawUnsafe(`SELECT * FROM ${t}`);
    } catch (e) {
      logger.warn(`[job:backup] tabla ${t} omitida: ${e.message}`);
      datos.tablas[t] = [];
    }
  }
  const n = datos.tablas.customers?.length || 0;
  const m = datos.tablas.transactions?.length || 0;
  logger.info(`[job:backup] Dump: ${n} clientes · ${m} movimientos`);
  return { json: JSON.stringify(datos, reemplazo), clientes: n, movimientos: m };
}

/** Sube a Vercel Blob. Requiere BLOB_READ_WRITE_TOKEN. */
async function subirABlob(nombre, json) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { put } = require('@vercel/blob');
  // PRIVADO: el respaldo lleva correos, teléfonos y contraseñas cifradas de
  // los clientes. Un enlace público sería una filtración de datos personales.
  const { url } = await put(`backups/${nombre}`, json, {
    access: 'private',
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });
  logger.info(`[job:backup] Subido a Vercel Blob: ${url}`);
  return url;
}

async function runBackup() {
  const { json, clientes, movimientos } = await crearDump();
  const nombre = `hos-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;

  const url = await subirABlob(nombre, json).catch(e => {
    logger.error(`[job:backup] Fallo al subir a Blob: ${e.message}`);
    return null;
  });

  if (url) return { destino: url, clientes, movimientos };

  // Sin destino remoto, al menos queda una copia en disco. En un entorno sin
  // servidor /tmp desaparece, así que esto es un último recurso, no un plan.
  const dir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ruta = path.join(dir, nombre);
    fs.writeFileSync(ruta, json);
    logger.warn(`[job:backup] ⚠️ Sin destino remoto. Copia local: ${ruta}`);
    logger.warn('[job:backup] ⚠️ Configura BLOB_READ_WRITE_TOKEN para respaldo fuera del servidor.');
    return { destino: ruta, clientes, movimientos, soloLocal: true };
  } catch (e) {
    logger.error(`[job:backup] ❌ SIN RESPALDO: ${e.message}`);
    throw e;
  }
}

function startBackupJob() {
  cron.schedule('0 3 * * 0', () => runBackup().catch(() => {}), { timezone: 'America/Mexico_City' });
  logger.info('[job:backup] Job programado — domingos a las 3:00 AM');
}

module.exports = { startBackupJob, runBackup };
