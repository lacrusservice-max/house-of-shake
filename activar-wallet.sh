#!/bin/bash
# Activa el push de Apple Wallet de punta a punta.
#
# Lo único que este script necesita de ti es tu clave privada .p8, que se lee
# del disco y se envía por stdin: nunca aparece en pantalla ni en el historial.
# Todo lo demás —variables, redespliegue y verificación— corre solo.
set -e

export PATH="/Users/sergio/.nvm/versions/node/v20.20.2/bin:$PATH"
cd "/Users/sergio/Desktop/HOUSE OF SHAKE"

KEY_ID="NPZU7K4B2U"
TEAM_ID="XCL2HJB52H"
P8="$HOME/Downloads/AuthKey_${KEY_ID}.p8"
API="https://backend-production-a4f91.up.railway.app/api"

echo "▸ 1/5  Buscando tu clave…"
if [ ! -f "$P8" ]; then
  echo "   ❌ No encontré $P8"
  echo "      Si la moviste, corre:  P8=/ruta/a/tu/AuthKey_${KEY_ID}.p8 bash activar-wallet.sh"
  exit 1
fi
echo "   ✓ $(basename "$P8")"

echo "▸ 2/5  Guardando en Railway…"
railway link --project house-of-shake-backend --service backend --environment production >/dev/null 2>&1
base64 -i "$P8" | tr -d '\n' | railway variables --service backend --set-from-stdin APN_KEY_BASE64 >/dev/null
railway variables --service backend \
  --set "APN_KEY_ID=$KEY_ID" \
  --set "APN_TEAM_ID=$TEAM_ID" \
  --set "APN_PRODUCTION=true" >/dev/null
echo "   ✓ APN_KEY_BASE64, APN_KEY_ID, APN_TEAM_ID, APN_PRODUCTION"

# Guardar la clave fuera de Downloads, que es carpeta de paso.
mkdir -p backend/certs
cp -n "$P8" "backend/certs/AuthKey_${KEY_ID}.p8" 2>/dev/null || true
echo "   ✓ respaldo en backend/certs/ (ignorado por git)"

echo "▸ 3/5  Redesplegando…"
# Obligatorio: al guardar variables, Railway revive la imagen ANTERIOR.
railway up --detach >/dev/null 2>&1
echo "   ✓ despliegue lanzado"

echo "▸ 4/5  Esperando a que arranque…"
for i in $(seq 1 30); do
  sleep 15
  if curl -s -m 10 "$API/health" 2>/dev/null | grep -q '"status":"ok"'; then
    printf "   ✓ backend arriba (%s min)\n" "$(( i / 4 ))"
    break
  fi
  printf "   · intento %s\n" "$i"
done

echo "▸ 5/5  Verificando el push real…"
sleep 5
railway logs --service backend 2>/dev/null | grep -iE "Wallet push|APNs" | tail -5 || true
echo ""
echo "════════════════════════════════════════════════"
echo "  Listo. Ahora avísale a Claude para que haga"
echo "  la prueba final: sumar Pinos a una cuenta y"
echo "  confirmar en los logs que el push salió."
echo "════════════════════════════════════════════════"
