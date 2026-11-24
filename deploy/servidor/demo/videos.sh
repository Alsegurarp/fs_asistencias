#!/usr/bin/env bash
# Graba los videos del portal contra el ambiente LOCAL (docker compose de la
# raíz): portal en localhost:8081 e identidad en localhost:8082. Todo corre en
# contenedores; no hace falta Node en la computadora.
#
#   bash deploy/servidor/demo/demo-local.sh reiniciar     # primero, la empresa de demostración
#   bash deploy/servidor/demo/videos.sh                    # todos los clips, en MP4
#   DEMO_CLIPS=01-panel,05-personal bash deploy/servidor/demo/videos.sh
#   DEMO_VOZ=es_MX-ald-medium bash deploy/servidor/demo/videos.sh   # otra voz; «no» sin voz
#   DEMO_MUSICA=no bash deploy/servidor/demo/videos.sh               # sin música
#
# Música: si existe output/video/portal/musica.mp3 se usa esa; si no, una
# pista suave que se sintetiza (sin derechos de terceros).
#
# Los videos quedan en output/video/portal/. Usa las cuentas de DEMO_SECRETOS,
# igual que demo-local.sh.
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1
# Playwright 1.52 más Xvfb, ffmpeg y la voz (videos.Dockerfile); se construye una vez.
NAVEGADOR=zenit-demo-videos:1.52.0

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
[ -s "$DEMO_SECRETOS/cuentas.json" ] || { echo "falta cuentas.json en DEMO_SECRETOS: corra antes demo-local.sh reiniciar" >&2; exit 1; }
SECRETOS=$(ruta_docker "$DEMO_SECRETOS")
mkdir -p "$MONOREPO/output/video/portal"
SALIDA=$(ruta_docker "$MONOREPO/output/video/portal")

docker build --quiet --tag "$NAVEGADOR" --file "$AQUI/videos.Dockerfile" "$AQUI" > /dev/null

# Chromium visible necesita más memoria compartida que la de omisión (64 MB).
docker run --rm --init --shm-size=1g --add-host host.docker.internal:host-gateway \
  -v "$AQUI:/demo" -v zenit-demo-node-modules:/demo/node_modules \
  -v "$SECRETOS:/secretos:ro" -v "$SALIDA:/videos" \
  -e DEMO_PORTAL=http://localhost:8081 -e DEMO_PUENTE=host.docker.internal -e DEMO_CLIPS="${DEMO_CLIPS:-}" \
  -e DEMO_VOZ="${DEMO_VOZ:-}" -e DEMO_MUSICA="${DEMO_MUSICA:-}" -e DEMO_MUSICA_VOLUMEN="${DEMO_MUSICA_VOLUMEN:-}" -e DEMO_EFECTOS="${DEMO_EFECTOS:-}" -e DEMO_DESFASE_MS="${DEMO_DESFASE_MS:-}" \
  -w /demo "$NAVEGADOR" sh -c "npm ci --silent --no-audit --no-fund > /dev/null && node videos.mjs"

echo "Videos listos en output/video/portal/"
