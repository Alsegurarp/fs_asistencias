#!/usr/bin/env bash
# Demostración de Zenit en el ambiente publicado (sólo datos ficticios).
#
#   bash deploy/servidor/demo/demo.sh preparar    # una vez: cuentas, QR y clave de tarjetas
#   bash deploy/servidor/demo/demo.sh reiniciar   # borra la empresa de demostración y la siembra de nuevo
#   bash deploy/servidor/demo/demo.sh estado      # conteos, sin datos personales
#   bash deploy/servidor/demo/demo.sh limpiar     # borra la empresa y las cuentas de la demostración
#   bash deploy/servidor/demo/demo.sh capturas    # capturas para la guía (cierra la semana: reiniciar después)
#   bash deploy/servidor/demo/demo.sh pdf         # output/pdf/guia-de-demostracion.pdf
#
# Usa deploy/servidor/.env.despliegue (fuera de Git): el perfil SSH, como el
# despliegue, y DEMO_SECRETOS, la carpeta local donde viven las cuentas y la
# clave de las tarjetas. DEMO_LATITUD y DEMO_LONGITUD, opcionales, ponen la
# sede Matriz Centro donde se presenta. Ver docs/guia-de-demostracion.md.
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1
SERVIDOR=/opt/.fastsolution
TRABAJO_REMOTO=$SERVIDOR/zenit/demo-trabajo
NAVEGADOR=mcr.microsoft.com/playwright:v1.52.0-noble
COMPRESOR=alpine:3.20

ruta_docker() {
  if command -v cygpath > /dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}
AQUI=$(ruta_docker "$(cd "$(dirname "$0")" && pwd)")
DESPLIEGUE=$(ruta_docker "$(cd "$AQUI/.." && pwd)")
MONOREPO=$(ruta_docker "$(cd "$AQUI/../../.." && pwd)")

uso() {
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
}
falla() {
  echo "error: $*" >&2
  exit 1
}

[ $# -ge 1 ] || uso
orden=$1

if [ -f "$DESPLIEGUE/.env.despliegue" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$DESPLIEGUE/.env.despliegue"
  set +a
fi
: "${DEMO_SECRETOS:?Defina DEMO_SECRETOS en deploy/servidor/.env.despliegue: una carpeta local fuera del repositorio}"
SECRETOS=$(ruta_docker "$DEMO_SECRETOS")
mkdir -p "$DEMO_SECRETOS" "$MONOREPO/output/pdf"

# Guiones de Node en el contenedor del navegador, con versiones fijas.
node_demo() {
  docker run --rm --init \
    -v "$AQUI:/demo" -v zenit-demo-node-modules:/demo/node_modules \
    -v "$SECRETOS:/secretos" -v "$MONOREPO/docs:/docs" -v "$MONOREPO/output/pdf:/salida" \
    -e DEMO_PORTAL="${DEMO_PORTAL:-https://zenit.fastsolution.com.mx}" \
    -e DEMO_LATITUD="${DEMO_LATITUD:-}" -e DEMO_LONGITUD="${DEMO_LONGITUD:-}" \
    -w /demo "$NAVEGADOR" sh -c "npm ci --silent --no-audit --no-fund > /dev/null && node $*"
}

# El servidor, por la herramienta del despliegue. Lo que se sube va a una
# carpeta de trabajo de 700 que se borra al terminar.
herramienta() {
  : "${FS_SSH_PERFIL:?Defina FS_SSH_PERFIL en deploy/servidor/.env.despliegue}"
  : "${FS_SSH_ALIAS:?Defina FS_SSH_ALIAS en deploy/servidor/.env.despliegue}"
  FS_ARBOL=$(ruta_docker "$CARGA") FS_SSH_PERFIL=$(ruta_docker "$FS_SSH_PERFIL") \
    docker compose -f "$DESPLIEGUE/herramienta/compose.yaml" run --rm -T herramienta "$@"
}
CARGA=""
preparar_carga() {
  [ -n "$CARGA" ] && rm -rf "$CARGA"
  CARGA=$(mktemp -d)
  trap 'rm -rf "$CARGA"' EXIT
  mkdir -p "$CARGA/carga"
  cp "$AQUI/en-servidor.sh" "$CARGA/carga/"
  for archivo in "$@"; do
    [ -f "$DEMO_SECRETOS/$archivo" ] || falla "falta $archivo en DEMO_SECRETOS: corra primero «demo.sh preparar»"
    cp "$DEMO_SECRETOS/$archivo" "$CARGA/carga/"
  done
  herramienta remoto "mkdir -p -m 700 $TRABAJO_REMOTO && chmod 700 $TRABAJO_REMOTO" > /dev/null
  herramienta subir carga "$TRABAJO_REMOTO/carga" --borrar > /dev/null
}
en_servidor() {
  herramienta remoto "bash $TRABAJO_REMOTO/carga/en-servidor.sh $*"
}
terminar_carga() {
  herramienta remoto "rm -rf $TRABAJO_REMOTO" > /dev/null
}

case "$orden" in
  preparar)
    node_demo preparar.mjs
    preparar_carga pilot_card_key
    en_servidor piloto "$TRABAJO_REMOTO/carga"
    terminar_carga
    ;;
  reiniciar)
    node_demo preparar.mjs
    preparar_carga cuentas.tsv
    en_servidor borrar
    en_servidor crear "$TRABAJO_REMOTO/carga"
    terminar_carga
    node_demo sembrar.mjs
    preparar_carga
    en_servidor estado
    terminar_carga
    ;;
  limpiar)
    preparar_carga
    en_servidor borrar
    terminar_carga
    ;;
  estado)
    preparar_carga
    en_servidor estado
    terminar_carga
    ;;
  capturas)
    node_demo capturas.mjs
    # Paleta reducida: la tercera parte del peso, sin perder la lectura del texto.
    docker run --rm -v "$MONOREPO/docs/guia-de-demostracion:/capturas" "$COMPRESOR"       sh -c 'apk add --no-cache pngquant > /dev/null && for f in /capturas/*.png; do pngquant --force --skip-if-larger --quality 75-95 --ext .png "$f" || true; done'
    echo "Capturas comprimidas en docs/guia-de-demostracion/"
    ;;
  pdf)
    node_demo pdf.mjs
    echo "PDF: output/pdf/guia-de-demostracion.pdf"
    ;;
  *) uso ;;
esac
