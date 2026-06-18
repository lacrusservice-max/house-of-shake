# 🏆 House of Shake — Sistema de Fidelización con Apple Wallet

Sistema completo de puntos integrado con Shopify y Apple Wallet para la cafetería House of Shake.

---

## 📋 Arquitectura

```
house-of-shake-loyalty/
├── backend/          # Node.js + Express + Prisma (API + Webhooks + Wallet)
├── widget/           # Vanilla JS (ScriptTag para Shopify)
├── dashboard/        # React + Vite + TailwindCSS (panel admin)
└── setup.sh          # Script de instalación
```

**Flujo de datos:**
```
Shopify Store ──webhook──► Backend API ──► PostgreSQL
                                │
                                ├──► Redis (caché + colas)
                                ├──► Apple Wallet (APNs push)
                                └──► Dashboard Admin
```

---

## 🍎 PASO 1: CERTIFICADOS APPLE WALLET (LEER PRIMERO)

> ⚠️ **Necesitas una cuenta de Apple Developer activa ($99 USD/año)**
> Registrarse en: https://developer.apple.com/programs/enroll/

### A. Crear el Pass Type ID

1. Ve a **https://developer.apple.com/account**
2. Inicia sesión con tu Apple ID
3. En el menú izquierdo → **Certificates, IDs & Profiles**
4. En el menú izquierdo → **Identifiers**
5. Clic en el botón **"+"** (azul, arriba a la derecha)
6. Selecciona **"Pass Type IDs"** → Clic **Continue**
7. En **Description**: `House of Shake Fidelización`
8. En **Identifier**: `pass.com.houseofshake.fidelidad`
9. Clic **Continue** → **Register**

### B. Generar el Certificado del Pase

1. En la lista de Identifiers, clic sobre `pass.com.houseofshake.fidelidad`
2. Clic en **"Create Certificate"** (en la sección Certificates)
3. Selecciona **"Pass Type ID Certificate"** → **Continue**
4. **Crear un CSR en tu Mac:**
   - Abre **"Acceso a Llaveros"** (buscarlo en Spotlight con ⌘+Space)
   - Menú: **Acceso a Llaveros → Asistente de Certificado → Solicitar un certificado a una autoridad de certificación**
   - Email: tu email de Apple Developer
   - Nombre común: `House of Shake Wallet`
   - Selecciona: **"Guardada en el disco"**
   - Clic **Continuar** → guarda el archivo `CertificateSigningRequest.certSigningRequest`
5. En Apple Developer, sube el archivo CSR que acabas de crear
6. Clic **Continue** → **Download**
7. El archivo descargado se llama `pass.cer`

### C. Convertir a .p12

1. Doble-clic en `pass.cer` — se abre Acceso a Llaveros automáticamente
2. En Acceso a Llaveros, busca **"Pass Type ID: pass.com.houseofshake.fidelidad"**
3. Clic derecho → **"Exportar..."**
4. Formato: **Intercambio de Información Personal (.p12)**
5. Nombre: `certificate.p12`
6. Ponle una contraseña (guárdala, la necesitarás en `.env`)
7. Clic **Guardar**

### D. Descargar el Certificado Intermedio WWDR

1. Ve a: https://www.apple.com/certificateauthority/
2. Descarga: **"Apple Worldwide Developer Relations Certification Authority G4"**
   - Archivo: `AppleWWDRCAG4.cer`
3. Conviértelo a PEM:
   ```bash
   openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
   ```

### E. Obtener tu Team ID

1. Ve a **https://developer.apple.com/account**
2. En la esquina superior derecha está tu Team ID (formato: `ABC123DEFG` — 10 caracteres)
3. También lo ves en: **Membership details → Team ID**

### F. Configurar en el Proyecto

Una vez que tienes todos los archivos, ejecuta:

```bash
cd backend
node scripts/setup-certs.js \
  --cert /ruta/al/certificate.p12 \
  --password TuPasswordDelCert \
  --wwdr /ruta/al/wwdr.pem \
  --team TU_TEAM_ID \
  --pass-id pass.com.houseofshake.fidelidad
```

El script valida automáticamente todo y actualiza tu `.env`.

### G. Agregar imágenes al template del pase

Pon estas imágenes en `backend/pass-template/images/`:

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `icon.png` | 29×29 px | Ícono del pase |
| `icon@2x.png` | 58×58 px | Ícono retina |
| `icon@3x.png` | 87×87 px | Ícono super-retina |
| `logo.png` | 160×50 px | Logo de la tienda |
| `logo@2x.png` | 320×100 px | Logo retina |
| `logo@3x.png` | 480×150 px | Logo super-retina |
| `strip.png` | 375×98 px | Imagen de fondo (opcional) |
| `strip@2x.png` | 750×196 px | Imagen de fondo retina |

> **Tip:** Usa fondo `rgb(200, 80, 50)` (rojo House of Shake) y logo blanco.

---

## 🔧 PASO 2: CONFIGURAR BASE DE DATOS (Railway)

1. Ve a **https://railway.app** y crea una cuenta
2. Nuevo proyecto → **"Add PostgreSQL"**
3. Clic en el servicio PostgreSQL → **Variables** → Copia `DATABASE_URL`
4. En `backend/.env` pega la URL:
   ```
   DATABASE_URL=postgresql://postgres:password@host.railway.app:5432/railway
   ```
5. Añade también Redis:
   - Nuevo servicio → **"Add Redis"**
   - Copia `REDIS_URL`
   ```
   REDIS_URL=redis://default:password@host.railway.app:6379
   ```

---

## 🛒 PASO 3: CONFIGURAR SHOPIFY

### Configurar el .env con tus credenciales

```bash
# backend/.env
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
SHOPIFY_STORE_URL=house-of-shake.myshopify.com
SHOPIFY_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

### Registrar Webhooks y ScriptTag (automático)

Una vez que el backend está corriendo:

1. Ve al dashboard admin: `http://localhost:5173`
2. Login con `admin@houseofshake.com`
3. En Dashboard → botón **"🔧 Setup Shopify"**
4. Esto registra automáticamente los 4 webhooks y el ScriptTag

O manualmente desde terminal:
```bash
curl -X POST https://clc-house-of-shake.com/api/admin/setup-shopify \
  -H "Authorization: Bearer TU_JWT_TOKEN"
```

---

## 🚀 PASO 4: INSTALACIÓN LOCAL

```bash
# Clonar y configurar
./setup.sh

# Configurar base de datos
cd backend
nano .env  # Editar DATABASE_URL, REDIS_URL, JWT_SECRET

# Migraciones
npx prisma migrate dev --name init
npm run db:seed

# Iniciar backend
npm run dev

# En otra terminal — Dashboard
cd ../dashboard
npm run dev
```

**URLs:**
- API: http://localhost:3000/api/health
- Dashboard: http://localhost:5173
- Docs API: http://localhost:3000/docs

---

## ☁️ PASO 5: DEPLOY EN RAILWAY

```bash
# Instalar Railway CLI
npm install -g @railway/cli
railway login

# En el directorio backend/
railway link   # Conectar al proyecto
railway up     # Deploy

# Variables de entorno en Railway Dashboard
# Agregar todas las variables de backend/.env
```

**Configurar dominio personalizado:**
1. Railway → tu servicio → Settings → Domains
2. Agrega: `clc-house-of-shake.com`
3. Apunta tu DNS al dominio de Railway

---

## 📱 USO EN TIENDA FÍSICA

Cuando un cliente llega a la caja:

1. Cliente muestra su Apple Wallet en el iPhone
2. Cajero escanea el código QR con cualquier lector
3. Hace una petición GET al dashboard o API:
   ```
   GET /api/customers/{customer_id}/public
   ```
4. Ver puntos del cliente y permitir canje

Para canjear desde dashboard:
1. Buscar cliente en **Clientes**
2. Clic **"Ajustar"** → ingresar puntos negativos (−100)
3. Sistema aplica el descuento

---

## 🔐 SEGURIDAD

- Webhooks de Shopify validados con HMAC-SHA256
- JWT con expiración de 24h para el dashboard
- Rate limiting: 100 peticiones/minuto por IP
- Headers de seguridad via Helmet
- CORS solo para el dominio de la tienda

---

## 📊 SISTEMA DE PUNTOS

| Regla | Valor (configurable) |
|-------|---------------------|
| Puntos por $1 USD | 1 punto |
| Puntos para canjear | 100 puntos |
| Valor del canje | $5 USD |
| Bono de bienvenida | 50 puntos |
| Expiración | 12 meses |

**Niveles:**
- 🥉 **Bronce**: 0-100 pts (sin bonus)
- 🥈 **Plata**: 101-300 pts (+10% en cada compra)
- 🥇 **Oro**: 301+ pts (+20% en cada compra)

---

## 🆘 SOLUCIÓN DE PROBLEMAS

**Apple Wallet no funciona:**
```bash
cd backend && node scripts/validate-certs.js
```

**Webhooks de Shopify no llegan:**
- Verifica que `SHOPIFY_WEBHOOK_SECRET` sea correcto
- En Shopify Admin → Settings → Notifications → Webhooks

**Base de datos no conecta:**
```bash
cd backend && npx prisma db pull
```

**Widget no aparece en la tienda:**
- Verifica que el ScriptTag esté registrado en Shopify Admin → Apps → Script tags
- Revisa la consola del navegador en la tienda

---

## 📞 Soporte

App: CLC - HOUSE OF SHAKE  
URL: https://clc-house-of-shake.com  
Tienda: house-of-shake.myshopify.com
