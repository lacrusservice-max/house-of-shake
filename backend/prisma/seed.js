const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Config por defecto
  await prisma.config.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      pointsPerDollar: parseFloat(process.env.POINTS_PER_DOLLAR || '1'),
      pointsToRedeem: parseInt(process.env.POINTS_TO_REDEEM || '100'),
      redeemValueUsd: parseFloat(process.env.REDEEM_VALUE_USD || '5'),
      welcomeBonus: parseInt(process.env.POINTS_WELCOME_BONUS || '50'),
      expiryMonths: parseInt(process.env.POINTS_EXPIRY_MONTHS || '12'),
      silverThreshold: parseInt(process.env.SILVER_THRESHOLD || '101'),
      goldThreshold: parseInt(process.env.GOLD_THRESHOLD || '301'),
      silverBonusPercent: parseFloat(process.env.SILVER_BONUS_PERCENT || '10'),
      goldBonusPercent: parseFloat(process.env.GOLD_BONUS_PERCENT || '20'),
    },
  });

  // Admin por defecto
  const hashedPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'Admin123!',
    12
  );

  await prisma.adminUser.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@houseofshake.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@houseofshake.com',
      password: hashedPassword,
      name: 'House of Shake Admin',
      role: 'admin',
    },
  });

  console.log('✅ Seed completado: Config y Admin creados');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
