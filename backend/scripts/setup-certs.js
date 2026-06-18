#!/usr/bin/env node
/**
 * Setup automático de certificados Apple Wallet
 * Una vez que tienes los archivos, este script los valida y configura el .env
 *
 * Uso: node scripts/setup-certs.js --cert ./MiCert.p12 --password MiPassword --wwdr ./wwdr.pem --team ABC123XYZ --pass-id pass.com.houseofshake.fidelidad
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const certFile = get('--cert');
const password = get('--password');
const wwdrFile = get('--wwdr');
const teamId = get('--team');
const passId = get('--pass-id');

if (!certFile || !wwdrFile || !teamId || !passId) {
  console.log(`
Uso: node scripts/setup-certs.js \\
  --cert ./certificate.p12 \\
  --password MiPassword \\
  --wwdr ./wwdr.pem \\
  --team TU_TEAM_ID \\
  --pass-id pass.com.houseofshake.fidelidad
`);
  process.exit(1);
}

const certsDir = path.resolve('./certs');
if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

// Copiar archivos
console.log('\n📁 Copiando certificados...');
fs.copyFileSync(certFile, path.join(certsDir, 'certificate.p12'));
fs.copyFileSync(wwdrFile, path.join(certsDir, 'wwdr.pem'));
console.log('✅ Certificados copiados a ./certs/');

// Actualizar pass-template con team ID y pass type ID
const passJson = path.resolve('./pass-template/pass.json');
if (fs.existsSync(passJson)) {
  let content = fs.readFileSync(passJson, 'utf8');
  content = content
    .replace(/"teamIdentifier": ".*?"/, `"teamIdentifier": "${teamId}"`)
    .replace(/"passTypeIdentifier": ".*?"/, `"passTypeIdentifier": "${passId}"`);
  fs.writeFileSync(passJson, content);
  console.log('✅ pass.json actualizado con Team ID y Pass Type ID');
}

// Actualizar .env
const envPath = path.resolve('./.env');
const envExample = path.resolve('./.env.example');
let envContent = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, 'utf8')
  : fs.readFileSync(envExample, 'utf8');

const updates = {
  WALLET_TEAM_ID: teamId,
  WALLET_PASS_TYPE_ID: passId,
  WALLET_CERTIFICATE_PATH: './certs/certificate.p12',
  WWDR_CERTIFICATE_PATH: './certs/wwdr.pem',
};
if (password) updates.WALLET_CERTIFICATE_PASSWORD = password;

for (const [key, val] of Object.entries(updates)) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${val}`);
  } else {
    envContent += `\n${key}=${val}`;
  }
}

fs.writeFileSync(envPath, envContent);
console.log('✅ .env actualizado');

// Ejecutar validador
console.log('\n🔍 Ejecutando validación...\n');
try {
  execSync('node scripts/validate-certs.js', { stdio: 'inherit' });
} catch {
  process.exit(1);
}
