#!/usr/bin/env bash
# Despliega Zenit o la landing en el servidor compartido y muestra el avance:
# porcentaje, paso actual, tiempo transcurrido y tiempo restante estimado.
# Todo lo que hace queda en un registro en build/despliegue/registros/.
#
#   bash deploy/servidor/desplegar.sh zenit   [commit] [--detalle]
#   bash deploy/servidor/desplegar.sh landing [commit] [--detalle] [--credencial <smtp.env>]
#
# Despliega siempre un commit, nunca cambios sin commit. Sin commit, usa HEAD.
# La configuración local va en deploy/servidor/.env.despliegue, fuera de Git:
# ver despliegue.env.ejemplo y docs/instructivo-de-despliegue.md.
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1

SERVIDOR=/opt/.fastsolution

# En Windows (Git Bash), Docker y Git son programas de Windows: reciben rutas
# como D:/carpeta, no como /d/carpeta. En Linux y macOS no cambia nada.
ruta_docker() {
  if command -v cygpath > /dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

AQUI=$(ruta_docker "$(cd "$(dirname "$0")" && pwd)")
MONOREPO=$(ruta_docker "$(cd "$AQUI/../.." && pwd)")

uso() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
}

falla() {
  echo "error: $*" >&2
  exit 1
}

aviso() {
  echo "aviso: $*" >&2
}

# --- Argumentos y configuración -------------------------------------------

[ $# -ge 1 ] || uso
objetivo=$1
shift
commit=""
detalle=0
credencial=""
while [ $# -gt 0 ]; do
  case "$1" in
    --detalle) detalle=1 ;;
    --credencial)
      credencial=${2:?--credencial necesita la ruta del archivo}
      shift
      ;;
    -h | --help) uso ;;
    -*) falla "opción desconocida: $1" ;;
    *) commit=$1 ;;
  esac
  shift
done

if [ -f "$AQUI/.env.despliegue" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$AQUI/.env.despliegue"
  set +a
fi
: "${FS_SSH_PERFIL:?Defina FS_SSH_PERFIL en deploy/servidor/.env.despliegue}"
: "${FS_SSH_ALIAS:?Defina FS_SSH_ALIAS en deploy/servidor/.env.despliegue}"

case "$objetivo" in
  zenit)
    REPO=$MONOREPO
    REMOTO=$SERVIDOR/zenit/fuente/deploy/servidor/remoto.sh
    ;;
  landing)
    : "${LANDING_REPO:?Defina LANDING_REPO, el clon del repositorio de la landing}"
    REPO=$(ruta_docker "$LANDING_REPO")
    REMOTO=$SERVIDOR/landing/remoto.sh
    ;;
  *) uso ;;
esac
[ -z "$credencial" ] || [ "$objetivo" = landing ] || falla "--credencial sólo aplica a la landing"
[ -z "$credencial" ] || [ -f "$credencial" ] || falla "no existe la credencial: $credencial"

SHA=$(git -C "$REPO" rev-parse --verify "${commit:-HEAD}^{commit}" 2> /dev/null) ||
  falla "no existe el commit ${commit:-HEAD} en $REPO"
CORTO=$(git -C "$REPO" rev-parse --short "$SHA")
if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
  aviso "hay cambios sin commit en $REPO; se despliega $CORTO, sin ellos"
fi
if [ -z "$(git -C "$REPO" branch -r --contains "$SHA" 2> /dev/null)" ]; then
  aviso "$CORTO no está en ninguna rama remota: súbelo para que el equipo lo tenga"
fi

TRABAJO=$MONOREPO/build/despliegue/$objetivo
REGISTROS=$MONOREPO/build/despliegue/registros
HISTORIAL=$MONOREPO/build/despliegue/historial.tsv
mkdir -p "$TRABAJO" "$REGISTROS"
touch "$HISTORIAL"
LOG=$REGISTROS/$objetivo-$(date +%Y%m%d-%H%M%S)-$CORTO.log

# --- Herramienta en contenedor ----------------------------------------------

herramienta() {
  local montajes=()
  [ -n "$credencial" ] && montajes=(-v "$(ruta_docker "$credencial"):/credencial/smtp.env:ro")
  FS_ARBOL=$(ruta_docker "$TRABAJO") FS_SSH_PERFIL=$(ruta_docker "$FS_SSH_PERFIL") \
    docker compose -f "$AQUI/herramienta/compose.yaml" run --rm -T "${montajes[@]}" herramienta "$@"
}

remoto() {
  herramienta remoto bash "$REMOTO" "$@"
}

# --- Pasos ------------------------------------------------------------------

paso_revisar() {
  docker version --format 'Docker {{.Server.Version}}' ||
    falla "Docker no responde: abre Docker Desktop y espera a que arranque"
  local archivo
  for archivo in config known_hosts identity; do
    [ -f "$FS_SSH_PERFIL/$archivo" ] || falla "falta $archivo en $FS_SSH_PERFIL"
  done
  # La primera vez construye la herramienta; después, Docker la toma de caché.
  docker build --quiet --tag fastsolution-despliegue:1 "$AQUI/herramienta" > /dev/null
  echo "herramienta de despliegue lista"
  herramienta remoto "test -d $SERVIDOR/$objetivo/secretos && echo 'conexión correcta: $objetivo existe en el servidor'"
}

paso_exportar() {
  rm -rf "$TRABAJO/arbol" "$TRABAJO/config"
  mkdir -p "$TRABAJO/arbol"
  # Fin de línea tal como está en Git: los guiones corren en Linux.
  git -C "$REPO" -c core.autocrlf=false archive --format=tar "$SHA" |
    tar --force-local -x -C "$TRABAJO/arbol"
  echo "$CORTO" > "$TRABAJO/arbol/.version-desplegada"
  echo "árbol de $CORTO: $(find "$TRABAJO/arbol" -type f | wc -l) archivos"
  if [ "$objetivo" = landing ]; then
    # La landing corre con la composición y el guion de este repositorio.
    local config_sha
    config_sha=$(git -C "$MONOREPO" rev-parse --short HEAD)
    mkdir -p "$TRABAJO/config" "$TRABAJO/tmp"
    git -C "$MONOREPO" -c core.autocrlf=false archive --format=tar HEAD \
      deploy/servidor/landing deploy/servidor/remoto.sh | tar --force-local -x -C "$TRABAJO/tmp"
    mv "$TRABAJO/tmp/deploy/servidor/landing/compose.yaml" "$TRABAJO/tmp/deploy/servidor/landing/servidor.env" \
      "$TRABAJO/tmp/deploy/servidor/remoto.sh" "$TRABAJO/config/"
    rm -rf "$TRABAJO/tmp"
    echo "configuración de la landing tomada del monorepo en $config_sha"
  fi
}

paso_subir() {
  if [ "$objetivo" = zenit ]; then
    herramienta subir arbol "$SERVIDOR/zenit/fuente" --borrar
    herramienta remoto "find $SERVIDOR/zenit/fuente -name '*.sh' -exec chmod 755 {} +"
  else
    herramienta subir arbol "$SERVIDOR/landing/fuente" --borrar
    herramienta subir config "$SERVIDOR/landing"
  fi
}

paso_credencial() {
  herramienta credencial "$SERVIDOR/landing/secretos/smtp.env"
}

paso_construir() { remoto construir "$objetivo" "$CORTO"; }
paso_actualizar() { remoto actualizar "$objetivo" "$CORTO"; }
paso_esperar() { remoto esperar "$objetivo" "$CORTO"; }
paso_identidad() { remoto identidad "$objetivo" "$CORTO"; }
paso_borde() { remoto borde "$objetivo" "$CORTO"; }

paso_comprobar() {
  if [ "$objetivo" = zenit ]; then
    herramienta comprobar << 'FIN'
GET https://zenit.fastsolution.com.mx/api/v1/system/status 200
GET https://zenit.fastsolution.com.mx/ 200
GET https://zenit.fastsolution.com.mx/id/realms/zenit/.well-known/openid-configuration 200 "issuer":"https://zenit.fastsolution.com.mx/id/realms/zenit"
GET https://zenit.fastsolution.com.mx/api/v1/me 401
GET https://zenit.fastsolution.com.mx/id/admin/ 404
GET https://zenit.fastsolution.com.mx/id/realms/master 404
FIN
  else
    herramienta comprobar << 'FIN'
GET https://fastsolution.com.mx/ 200 !X-Powered-By
GET https://www.fastsolution.com.mx/ 301
POST https://fastsolution.com.mx/api/contact 400
FIN
  fi
}

# Clave, nombre y segundos por omisión. El tiempo restante usa el promedio de
# los tres últimos despliegues de cada paso, y éstos sólo cuando no los hay.
if [ "$objetivo" = zenit ]; then
  PASOS=(
    "revisar|Revisando la estación y la conexión|10"
    "exportar|Exportando el commit|5"
    "subir|Subiendo el árbol al servidor|20"
    "construir|Construyendo las imágenes|200"
    "actualizar|Actualizando los servicios|30"
    "esperar|Esperando a que Zenit responda|30"
    "identidad|Aplicando la configuración de identidad|20"
    "borde|Revisando el borde|5"
    "comprobar|Comprobando por la dirección pública|10"
  )
else
  PASOS=(
    "revisar|Revisando la estación y la conexión|10"
    "exportar|Exportando el commit|5"
    "subir|Subiendo el árbol al servidor|10"
  )
  [ -n "$credencial" ] && PASOS+=("credencial|Copiando la credencial de correo|5")
  PASOS+=(
    "construir|Construyendo la imagen|40"
    "actualizar|Actualizando el contenedor|10"
    "esperar|Esperando a que la landing esté sana|15"
    "comprobar|Comprobando por la dirección pública|10"
  )
fi

# --- Avance -----------------------------------------------------------------

TOTAL=${#PASOS[@]}
ESPERADO=()
TOTAL_ESPERADO=0
for i in "${!PASOS[@]}"; do
  IFS='|' read -r clave _ omision <<< "${PASOS[$i]}"
  previo=$(awk -F'\t' -v o="$objetivo" -v c="$clave" '$1 == o && $2 == c {print $3}' "$HISTORIAL" |
    tail -n 3 | awk '{s += $1; n++} END {if (n) printf "%d", s / n}')
  ESPERADO[$i]=${previo:-$omision}
  [ "${ESPERADO[$i]}" -gt 0 ] || ESPERADO[$i]=1
  TOTAL_ESPERADO=$((TOTAL_ESPERADO + ESPERADO[$i]))
done

TTY=0
[ -t 1 ] && [ $detalle = 0 ] && TTY=1
# Para probar la barra cuando la salida no es una terminal.
[ "${DESPLIEGUE_BARRA:-0}" = 1 ] && [ $detalle = 0 ] && TTY=1
COLUMNAS=$(tput cols 2> /dev/null || echo 100)

reloj() { printf '%d:%02d' $(($1 / 60)) $(($1 % 60)); }

avance() { # índice, segundos en el paso
  local i=$1 t=$2 hecho=0 resto=0 j pct barra lleno esp=${ESPERADO[$1]}
  for ((j = 0; j < i; j++)); do hecho=$((hecho + ESPERADO[j])); done
  if [ "$t" -lt $((esp * 95 / 100)) ]; then hecho=$((hecho + t)); else hecho=$((hecho + esp * 95 / 100)); fi
  for ((j = i + 1; j < TOTAL; j++)); do resto=$((resto + ESPERADO[j])); done
  [ "$t" -lt "$esp" ] && resto=$((resto + esp - t))
  pct=$((hecho * 100 / TOTAL_ESPERADO))
  lleno=$((pct * 30 / 100))
  barra=$(printf '%*s' "$lleno" '' | tr ' ' '#')$(printf '%*s' $((30 - lleno)) '' | tr ' ' '.')
  local excedido=""
  [ "$t" -gt "$esp" ] && excedido=" (este paso tarda más que de costumbre)"
  printf '[%s] %3d%%  %d/%d %s  %s transcurrido, ~%s restante%s' \
    "$barra" "$pct" $((i + 1)) "$TOTAL" "$NOMBRE" "$(reloj $((SECONDS - INICIO)))" "$(reloj "$resto")" "$excedido"
}

ultima_linea() {
  tail -n 1 "$LOG" 2> /dev/null | tr -d '\r' | sed 's/\x1b\[[0-9;]*[A-Za-z]//g' | cut -c1-$((COLUMNAS - 4))
}

PASO_ACTUAL=""
interrumpir() {
  [ -n "${PID:-}" ] && kill "$PID" 2> /dev/null || true
  [ $TTY = 1 ] && printf '\r\033[K\n\033[K\033[1A\r'
  echo "despliegue interrumpido en: $PASO_ACTUAL" | tee -a "$LOG" >&2
  exit 130
}
trap interrumpir INT TERM

ejecutar() { # índice
  local i=$1 clave t estado
  IFS='|' read -r clave NOMBRE _ <<< "${PASOS[$i]}"
  PASO_ACTUAL=$NOMBRE
  printf '\n== %d/%d %s (%s)\n' $((i + 1)) "$TOTAL" "$NOMBRE" "$(date +%T)" >> "$LOG"
  local inicio_paso=$SECONDS
  if [ $TTY = 1 ]; then
    ("paso_$clave") >> "$LOG" 2>&1 &
    PID=$!
    while kill -0 "$PID" 2> /dev/null; do
      printf '\r\033[K%s\n\033[K  %s\033[1A\r' "$(avance "$i" $((SECONDS - inicio_paso)))" "$(ultima_linea)"
      sleep 1
    done
    estado=0
    wait "$PID" || estado=$?
    PID=""
    printf '\r\033[K\n\033[K\033[1A\r'
  else
    # Sin barra: se muestra el registro del paso mientras corre. El paso no va
    # dentro de un `||`, donde bash dejaría de detenerse en el primer error.
    avance "$i" 0
    echo
    local desde
    desde=$(($(wc -l < "$LOG") + 1))
    ("paso_$clave") >> "$LOG" 2>&1 &
    PID=$!
    tail -n "+$desde" -f --pid="$PID" "$LOG"
    estado=0
    wait "$PID" || estado=$?
    PID=""
  fi
  t=$((SECONDS - inicio_paso))
  if [ "$estado" = 0 ]; then
    printf 'bien   %d/%d %-42s %s\n' $((i + 1)) "$TOTAL" "$NOMBRE" "$(reloj "$t")"
    printf '%s\t%s\t%s\t%s\n' "$objetivo" "$clave" "$t" "$(date +%F)" >> "$HISTORIAL"
    return 0
  fi
  printf 'FALLÓ  %d/%d %-42s %s\n' $((i + 1)) "$TOTAL" "$NOMBRE" "$(reloj "$t")" >&2
  echo "--- últimas líneas del registro ---" >&2
  tail -n 25 "$LOG" >&2
  echo "--- registro completo: $LOG" >&2
  [ "$clave" = revisar ] || remoto registrar "$objetivo" "$CORTO" "fallo-$clave" $((SECONDS - INICIO)) >> "$LOG" 2>&1 || true
  exit 1
}

# --- Despliegue ---------------------------------------------------------------

echo "Despliegue de $objetivo en $CORTO ($(git -C "$REPO" log -1 --format=%s "$SHA"))"
echo "Tiempo estimado: ~$(reloj "$TOTAL_ESPERADO"). Registro: $LOG"
{
  echo "objetivo: $objetivo"
  echo "commit: $SHA"
  echo "inicio: $(date -Iseconds)"
} > "$LOG"
INICIO=$SECONDS
for i in "${!PASOS[@]}"; do
  ejecutar "$i"
done
TOTAL_REAL=$((SECONDS - INICIO))
remoto registrar "$objetivo" "$CORTO" bien "$TOTAL_REAL" >> "$LOG" 2>&1 ||
  aviso "no se pudo anotar el despliegue en el servidor"
echo "fin: $(date -Iseconds), $TOTAL_REAL s" >> "$LOG"
echo "Listo: $objetivo en $CORTO, desplegado y comprobado en $(reloj "$TOTAL_REAL")."
