#!/bin/bash
# =============================================================
# HOUSE OF SHAKE — Setup Inicial
# =============================================================
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   HOUSE OF SHAKE — Sistema de Puntos    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js no encontrado. Instala Node.js 18+ desde https://nodejs.org${NC}"
  exit 1
fi
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Necesitas Node.js 18+. Versión actual: $(node --version)${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# Backend
echo ""
echo -e "${YELLOW}📦 Instalando dependencias del backend...${NC}"
cd backend
npm install
echo -e "${GREEN}✅ Backend instalado${NC}"

# Copiar .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠️  Archivo .env creado — configura las variables antes de continuar${NC}"
  echo -e "   nano .env"
fi

# Crear directorios necesarios
mkdir -p certs logs pass-template/images

cd ..

# Dashboard
echo ""
echo -e "${YELLOW}📦 Instalando dependencias del dashboard...${NC}"
cd dashboard
npm install
if [ ! -f .env ]; then
  cp .env.example .env
fi
cd ..

# Widget (copiar a dist)
mkdir -p widget/dist
cp widget/src/loyalty-widget.js widget/dist/loyalty-widget.js
echo -e "${GREEN}✅ Widget copiado${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         SETUP COMPLETADO                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "Próximos pasos:"
echo ""
echo -e "1. ${YELLOW}Configura la base de datos:${NC}"
echo -e "   cd backend && nano .env (agrega DATABASE_URL)"
echo ""
echo -e "2. ${YELLOW}Ejecuta las migraciones:${NC}"
echo -e "   cd backend && npx prisma migrate dev"
echo ""
echo -e "3. ${YELLOW}Inicializa la base de datos:${NC}"
echo -e "   cd backend && npm run db:seed"
echo ""
echo -e "4. ${YELLOW}Inicia el backend:${NC}"
echo -e "   cd backend && npm run dev"
echo ""
echo -e "5. ${YELLOW}Inicia el dashboard (otra terminal):${NC}"
echo -e "   cd dashboard && npm run dev"
echo ""
echo -e "6. ${YELLOW}Para certificados Apple Wallet:${NC}"
echo -e "   Lee README.md → Sección 'Certificados Apple Wallet'"
echo ""
echo -e "Dashboard: ${BLUE}http://localhost:5173${NC}"
echo -e "API:       ${BLUE}http://localhost:3000/api/health${NC}"
echo -e "Docs:      ${BLUE}http://localhost:3000/docs${NC}"
echo ""
