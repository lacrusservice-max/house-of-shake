#!/usr/bin/env node
/**
 * Validador de Certificados Apple Wallet
 * Ejecutar: node scripts/validate-certs.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

console.log('\n🍎 VALIDADOR DE CERTIFICADOS APPLE WALLET\n');
console.log('==========================================\n');

let allOk = true;

function check(label, fn) {
  try {
    const result = fn();
    console.log(`✅ ${label}${result ? ': ' + result : ''}`);
    return true;
  } catch (err) {
    console.error(`❌ ${label}: ${err.message}`);
    allOk = false;
    return false;
  }
}

// 1. Variables de entorno
console.log('📋 Variables de entorno:\n');
check('WALLET_TEAM_ID', () => {
  if (!process.env.WALLET_TEAM_ID || process.env.WALLET_TEAM_ID === 'TU_TEAM_ID_APPLE') throw new Error('No configurado');
  return process.env.WALLET_TEAM_ID;
});
check('WALLET_PASS_TYPE_ID', () => {
  if (!process.env.WALLET_PASS_TYPE_ID) throw new Error('No configurado');
  if (!process.env.WALLET_PASS_TYPE_ID.startsWith('pass.')) throw new Error('Debe empezar con "pass."');
  return process.env.WALLET_PASS_TYPE_ID;
});
check('WALLET_CERTIFICATE_PATH', () => {
  const p = process.env.WALLET_CERTIFICATE_PATH;
  if (!p) throw new Error('No configurado');
  return p;
});

// 2. Archivos de certificados
console.log('\n📁 Archivos de certificados:\n');
const certPath = path.resolve(process.env.WALLET_CERTIFICATE_PATH || './certs/certificate.p12');
const wwdrPath = path.resolve(process.env.WWDR_CERTIFICATE_PATH || './certs/wwdr.pem');

check('certificate.p12 existe', () => {
  if (!fs.existsSync(certPath)) throw new Error(`No encontrado en ${certPath}`);
  const size = fs.statSync(certPath).size;
  if (size < 1000) throw new Error('Archivo demasiado pequeño, puede estar corrupto');
  return `${(size / 1024).toFixed(1)} KB`;
});

check('wwdr.pem existe', () => {
  if (!fs.existsSync(wwdrPath)) throw new Error(`No encontrado en ${wwdrPath}`);
  const size = fs.statSync(wwdrPath).size;
  return `${(size / 1024).toFixed(1)} KB`;
});

// 3. Validar contenido del certificado P12
console.log('\n🔐 Validación del certificado P12:\n');
if (fs.existsSync(certPath)) {
  check('P12 es legible con la contraseña', () => {
    const p12Der = fs.readFileSync(certPath).toString('binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, process.env.WALLET_CERTIFICATE_PASSWORD || '');
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = bags[forge.pki.oids.certBag];
    if (!certs || certs.length === 0) throw new Error('No se encontraron certificados en el P12');
    const cert = certs[0].cert;
    const subject = cert.subject.getField('CN')?.value || 'Desconocido';
    const expiry = cert.validity.notAfter;
    const daysLeft = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) throw new Error(`Certificado EXPIRADO hace ${Math.abs(daysLeft)} días`);
    if (daysLeft < 30) throw new Error(`Certificado expira en ${daysLeft} días — renuévalo pronto`);
    return `${subject} | Expira en ${daysLeft} días`;
  });

  check('P12 contiene Pass Type Certificate', () => {
    const p12Der = fs.readFileSync(certPath).toString('binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, process.env.WALLET_CERTIFICATE_PASSWORD || '');
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = bags[forge.pki.oids.certBag];
    const cert = certs?.[0]?.cert;
    const cn = cert?.subject?.getField('CN')?.value || '';
    if (!cn.includes('Pass Type ID')) throw new Error(`CN no es Pass Type: "${cn}"`);
    if (process.env.WALLET_PASS_TYPE_ID && !cn.includes(process.env.WALLET_PASS_TYPE_ID)) {
      throw new Error(`El certificado es para "${cn}" pero la variable es "${process.env.WALLET_PASS_TYPE_ID}"`);
    }
    return cn;
  });
}

// 4. Validar WWDR
console.log('\n🌐 Validación del certificado WWDR:\n');
if (fs.existsSync(wwdrPath)) {
  check('WWDR.pem es válido', () => {
    const pem = fs.readFileSync(wwdrPath, 'utf8');
    if (!pem.includes('BEGIN CERTIFICATE')) throw new Error('No es un PEM válido');
    const cert = forge.pki.certificateFromPem(pem);
    const cn = cert.subject.getField('CN')?.value || '';
    if (!cn.includes('Apple')) throw new Error(`No parece un certificado Apple: "${cn}"`);
    return cn;
  });
}

// 5. Validar pass-template
console.log('\n📦 Validación del template de pase:\n');
check('pass-template/pass.json existe', () => {
  const p = path.resolve('./pass-template/pass.json');
  if (!fs.existsSync(p)) throw new Error('No encontrado');
  const content = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!content.passTypeIdentifier) throw new Error('Falta passTypeIdentifier');
  if (!content.teamIdentifier || content.teamIdentifier === 'XXXXXXXXXX') throw new Error('teamIdentifier no configurado');
  return 'OK';
});

check('Imágenes del template', () => {
  const imgDir = path.resolve('./pass-template/images');
  if (!fs.existsSync(imgDir)) throw new Error('Directorio images/ no encontrado');
  const required = ['icon.png', 'icon@2x.png', 'logo.png', 'logo@2x.png'];
  const missing = required.filter(f => !fs.existsSync(path.join(imgDir, f)));
  if (missing.length > 0) throw new Error(`Faltan imágenes: ${missing.join(', ')}`);
  return 'Todas las imágenes presentes';
});

// Resumen
console.log('\n==========================================');
if (allOk) {
  console.log('🎉 ¡TODO CORRECTO! Listo para generar pases Apple Wallet.\n');
} else {
  console.log('⚠️  Hay errores que corregir antes de generar pases.\n');
  console.log('👉 Sigue las instrucciones en README.md → Sección "Certificados Apple Wallet"\n');
  process.exit(1);
}
