// Arranque como proceso normal: escucha un puerto y levanta los trabajos en
// segundo plano. Se usa en local y en cualquier hosting con proceso propio.
//
// La aplicación vive en app.js y las migraciones en setup-db.js, para que
// Vercel pueda importar la app sin que nadie llame a listen().
const app = require('./app');
const logger = require('./config/logger');
const { setupDatabase } = require('./setup-db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 House of Shake API en puerto ${PORT}`);

  const walletService = require('./services/wallet.service');
  const walletReady = walletService.areCertsAvailable();
  logger.info(`🍎 Apple Wallet: ${walletReady ? 'CONFIGURADO' : 'PENDIENTE'}`);
  if (walletReady) walletService.initCerts();

  const { startInactiveCustomersJob } = require('./jobs/inactive-customers.job');
  const { startBackupJob } = require('./jobs/backup.job');
  startInactiveCustomersJob();
  startBackupJob();

  // No bloquea el arranque ni el healthcheck.
  setImmediate(async () => {
    await setupDatabase();
    // Tras migrar, el guardián verifica que el sistema pueda operar de verdad
    // y repara lo que sepa reparar. Cada caída grande de este proyecto empezó
    // por una condición que dejó de cumplirse tras un reinicio.
    try {
      const { revisarSistema } = require('./services/guardian');
      await revisarSistema();
    } catch (e) {
      logger.error('Guardián falló al arrancar:', e.message);
    }
  });
});

module.exports = app;
