/**
 * Creates permanent admin and staff accounts.
 * Safe to run multiple times — uses upsert.
 */
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    email: 'admin@houseofshake.com',
    name: 'Administrador HoS',
    password: 'HoSAdmin2025!',
    role: 'admin',
    permanent: true,
  },
  {
    email: 'staff@houseofshake.com',
    name: 'Personal HoS',
    password: 'HoSStaff2025!',
    role: 'staff',
    permanent: true,
  },
];

async function main() {
  console.log('🔐 Creando cuentas permanentes...\n');

  for (const account of ACCOUNTS) {
    const hashed = await bcrypt.hash(account.password, 12);
    const user = await prisma.adminUser.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        permanent: true,
        active: true,
        password: hashed,
      },
      create: {
        email: account.email,
        name: account.name,
        password: hashed,
        role: account.role,
        permanent: true,
        active: true,
      },
    });

    console.log(`✅ ${user.role.toUpperCase()} — ${user.email}`);
    console.log(`   Nombre: ${user.name}`);
    console.log(`   Contraseña: ${account.password}`);
    console.log(`   Permanente: ✓ (nunca se borra)\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Cuentas listas. Guarda estas credenciales en un lugar seguro.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
