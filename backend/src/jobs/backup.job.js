const cron = require('node-cron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// Uploads a backup file to Cloudflare R2 (S3-compatible)
async function uploadToR2(filePath, fileName) {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET) {
    logger.warn('[job:backup] R2 not configured — skipping upload (set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT)');
    return;
  }

  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const fileStream = fs.createReadStream(filePath);
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: `backups/db/${fileName}`,
    Body: fileStream,
    ContentType: 'application/gzip',
  }));

  logger.info(`[job:backup] Backup subido a R2: backups/db/${fileName}`);
}

function startBackupJob() {
  // Runs every Sunday at 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    logger.info('[job:backup] Iniciando backup de base de datos...');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      logger.warn('[job:backup] DATABASE_URL no configurado — backup omitido');
      return;
    }

    const tmpDir = '/tmp';
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `hos-db-${ts}.sql.gz`;
    const filePath = path.join(tmpDir, fileName);

    try {
      execSync(`pg_dump "${dbUrl}" | gzip > "${filePath}"`, { timeout: 120000 });
      const stat = fs.statSync(filePath);
      logger.info(`[job:backup] Dump creado: ${fileName} (${(stat.size / 1024).toFixed(0)} KB)`);

      await uploadToR2(filePath, fileName);

      fs.unlinkSync(filePath);
      logger.info('[job:backup] Backup completado');
    } catch (err) {
      logger.error('[job:backup] Error:', err.message);
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }, { timezone: 'America/Mexico_City' });

  logger.info('[job:backup] Job programado — domingos a las 3:00 AM');
}

module.exports = { startBackupJob };
