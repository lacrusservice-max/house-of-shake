FROM node:20-alpine

WORKDIR /app

# Dependencias del sistema (el strip se compone con PNG, sin SVG/fuentes)
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Generar cliente Prisma
RUN npx prisma generate

# Crear directorios necesarios
RUN mkdir -p certs logs pass-template/images

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"]
