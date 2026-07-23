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

  // ── Normalizar costo de canje de productos ────────────────────────────────
  // Sistema de canje: 1 Pino = $1 MXN. 1 Pino = 10 puntos internos.
  // ⇒ costo en puntos de un producto = precio × 10 (ej: bebida $90 = 900 pts = 90 Pinos).
  //
  // Los productos se cargaron con pointsValue ≈ precio (ej: $90 → 90 pts = 9 Pinos),
  // 10× por debajo de lo correcto. Este bloque repara esos valores.
  //
  // Guarda: solo toca productos claramente mal calibrados (pointsValue < precio × 1.5).
  // Un valor correcto (precio × 10) nunca cumple esa condición, así que es idempotente
  // y NUNCA sobrescribe un costo que el admin haya ajustado a mano desde el panel.
  const products = await prisma.product.findMany();
  let fixed = 0;
  for (const p of products) {
    if (p.pointsValue < p.price * 1.5) {
      await prisma.product.update({
        where: { id: p.id },
        data: { pointsValue: Math.round(p.price) * 10 },
      });
      fixed++;
    }
  }
  if (fixed > 0) console.log(`🌲 Costo de canje recalibrado en ${fixed}/${products.length} productos (1 Pino = $1)`);

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
