#!/usr/bin/env bash
# La empresa de demostración en el ambiente LOCAL (docker compose de la raíz):
# portal en localhost:8081 e identidad en localhost:8082. No toca el servidor.
#
#   bash deploy/servidor/demo/demo-local.sh reiniciar
#   DEMO_HORA=07:30 bash deploy/servidor/demo/demo-local.sh reiniciar
#   bash deploy/servidor/demo/demo-local.sh estado
#
# Usa las mismas piezas que demo.sh: preparar.mjs y sembrar.mjs en el
# contenedor del navegador, y en-servidor.sh en un contenedor con acceso a
# Docker. Las cuentas salen de DEMO_SECRETOS (en .env.despliegue o en el
# entorno); la clave de identidad, de ./secrets.
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1
NAVEGADOR=mcr.microsoft.com/playwright:v1.52.0-noble
HERRAMIENTAS=alpine:3.20

ruta_docker() {
  if command -v cygpath > /dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}
AQUI=$(ruta_docker "$(cd "$(dirname "$0")" && pwd)")
DESPLIEGUE=$(ruta_docker "$(cd "$AQUI/.." && pwd)")
MONOREPO=$(ruta_docker "$(cd "$AQUI/../../.." && pwd)")

if [ -f "$DESPLIEGUE/.env.despliegue" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$DESPLIEGUE/.env.despliegue"
  set +a
fi
: "${DEMO_SECRETOS:?Defina DEMO_SECRETOS (la carpeta con cuentas.json de la demostración) en deploy/servidor/.env.despliegue o al correr}"
mkdir -p "$DEMO_SECRETOS"
SECRETOS=$(ruta_docker "$DEMO_SECRETOS")
SECRETOS_LOCALES=$(ruta_docker "$MONOREPO/secrets")
DEMO_HORA=${DEMO_HORA:-}
[[ -z $DEMO_HORA || $DEMO_HORA =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || { echo "DEMO_HORA va como HH:MM" >&2; exit 64; }
[ -s "$MONOREPO/secrets/keycloak_admin_password" ] || { echo "falta secrets/keycloak_admin_password" >&2; exit 1; }

node_demo() {
  docker run --rm --init --add-host host.docker.internal:host-gateway \
    -v "$AQUI:/demo" -v zenit-demo-node-modules:/demo/node_modules -v "$SECRETOS:/secretos" \
    -e DEMO_PORTAL=http://localhost:8081 -e DEMO_HORA="$DEMO_HORA" \
    -e DEMO_LATITUD="${DEMO_LATITUD:-}" -e DEMO_LONGITUD="${DEMO_LONGITUD:-}" \
    -w /demo "$NAVEGADOR" sh -c "npm ci --silent --no-audit --no-fund > /dev/null && (node puente.mjs &) && sleep 1 && node $*"
}

local_() {
  docker run --rm -i --add-host host.docker.internal:host-gateway \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$AQUI:/demo:ro" -v "$SECRETOS:/carga:ro" -v "$SECRETOS_LOCALES:/secretos-locales:ro" \
    -e ZENIT_SECRETOS=/secretos-locales -e ZENIT_KC=http://host.docker.internal:8082 \
    "$HERRAMIENTAS" sh -c "apk add --no-cache -q bash curl jq docker-cli > /dev/null && bash /demo/en-servidor.sh $*"
}

case "${1:-}" in
  reiniciar)
    node_demo preparar.mjs
    local_ borrar
    local_ crear /carga
    node_demo sembrar.mjs
    [ -z "$DEMO_HORA" ] || local_ recepcion "$DEMO_HORA"
    local_ estado
    ;;
  estado) local_ estado ;;
  *) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 64 ;;
esac
