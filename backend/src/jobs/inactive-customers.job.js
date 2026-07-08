const cron = require('node-cron');
const prisma = require('../config/prisma');
const emailService = require('../services/email.service');
const logger = require('../config/logger');

// Runs every day at 10:00 AM Mexico City time
function startInactiveCustomersJob() {
  cron.schedule('0 10 * * *', async () => {
    logger.info('[job:inactive-customers] Iniciando chequeo de clientes inactivos...');
    try {
      const now = new Date();
      const days30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const days60ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // 30-day inactive: send "we miss you"
      const inactive30 = await prisma.$queryRaw`
        SELECT c.id, c."firstName", c.email, c."availablePoints",
               ext.last_visit_at,
               EXTRACT(DAY FROM NOW() - ext.last_visit_at)::int AS days_inactive
        FROM customers c
        JOIN LATERAL (SELECT last_visit_at FROM customers WHERE id = c.id) ext ON TRUE
        WHERE c.email IS NOT NULL
          AND ext.last_visit_at IS NOT NULL
          AND ext.last_visit_at < ${days30ago}
          AND ext.last_visit_at >= ${days60ago}
        LIMIT 100
      `;

      for (const customer of inactive30) {
        try {
          await emailService.sendInactiveReminder({
            to: customer.email,
            firstName: customer.firstName,
            availablePoints: customer.availablePoints,
            daysSinceVisit: customer.days_inactive,
          });
        } catch (e) {
          logger.warn(`[job:inactive] email error for ${customer.email}: ${e.message}`);
        }
      }

      logger.info(`[job:inactive-customers] Emails enviados: ${inactive30.length} clientes (30 días)`);
    } catch (err) {
      logger.error('[job:inactive-customers] Error:', err.message);
    }
  }, { timezone: 'America/Mexico_City' });

  logger.info('[job:inactive-customers] Job programado — diario a las 10:00 AM');
}

module.exports = { startInactiveCustomersJob };
