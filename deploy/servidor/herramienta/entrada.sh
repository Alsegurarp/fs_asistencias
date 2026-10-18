#!/usr/bin/env bash
# Órdenes de la herramienta de despliegue. Las llama deploy/servidor/desplegar.sh;
# cada una corre en un contenedor nuevo que se borra al terminar.
#
#   herramienta subir <carpeta en /arbol> <destino> [--borrar]
#   herramienta credencial <destino>
#   herramienta remoto <orden...>
#   herramienta comprobar          (lee las comprobaciones por la entrada)
set -Eeuo pipefail

# El perfil se monta en sólo lectura y con los permisos del sistema de la
# estación; SSH exige que la llave sea sólo de quien la usa, así que se copia
# a un directorio en memoria con 0600.
preparar_ssh() {
  local origen=/perfil destino=/home/deploy/.ssh archivo
  for archivo in config known_hosts identity; do
    [ -f "$origen/$archivo" ] || { echo "falta $archivo en el perfil SSH" >&2; exit 66; }
    cp "$origen/$archivo" "$destino/$archivo"
    chmod 600 "$destino/$archivo"
  done
  : "${FS_SSH_ALIAS:?falta FS_SSH_ALIAS}"
  SSH_OPCIONES=(
    -F "$destino/config"
    -o "IdentityFile=$destino/identity"
    -o IdentitiesOnly=yes
    -o "UserKnownHostsFile=$destino/known_hosts"
    -o StrictHostKeyChecking=yes
    -o BatchMode=yes
    -o ServerAliveInterval=15
  )
}

orden=${1:-}
shift || true

case "$orden" in
  subir)
    preparar_ssh
    carpeta=${1:?indique la carpeta dentro de /arbol}
    destino=${2:?indique el destino en el servidor}
    borrar=()
    [ "${3:-}" = "--borrar" ] && borrar=(--delete)
    rsync -r --checksum "${borrar[@]}" --chmod=D755,F644 --stats \
      -e "ssh ${SSH_OPCIONES[*]}" "/arbol/$carpeta/" "$FS_SSH_ALIAS:$destino/"
    ;;
  credencial)
    preparar_ssh
    destino=${1:?indique el destino en el servidor}
    [ -f /credencial/smtp.env ] || { echo "no se montó la credencial" >&2; exit 66; }
    rsync --chmod=F600 -e "ssh ${SSH_OPCIONES[*]}" /credencial/smtp.env "$FS_SSH_ALIAS:$destino"
    echo "credencial copiada sin mostrar su contenido"
    ;;
  remoto)
    preparar_ssh
    # Sin entrada estándar: nada del lado remoto debe esperar de ella.
    ssh "${SSH_OPCIONES[@]}" "$FS_SSH_ALIAS" "$@" < /dev/null
    ;;
  comprobar)
    # Cada línea: MÉTODO URL CÓDIGO [TEXTO que debe aparecer | !CABECERA que no
    # debe aparecer]. La primera se reintenta mientras el servicio arranca.
    fallas=0 primera=1
    while read -r metodo url esperado extra; do
      [ -z "${metodo:-}" ] && continue
      intentos=1
      [ $primera = 1 ] && intentos=20
      primera=0
      for ((i = 1; i <= intentos; i++)); do
        cuerpo=$(mktemp)
        cabeceras=$(mktemp)
        datos=()
        [ "$metodo" = POST ] && datos=(-H "Content-Type: application/json" -d '{}')
        codigo=$(curl -s -o "$cuerpo" -D "$cabeceras" -w '%{http_code}' --max-time 15 \
          -X "$metodo" "${datos[@]}" "$url" || true)
        bien=1
        motivo=""
        [ "$codigo" = "$esperado" ] || { bien=0; motivo="respondió $codigo, se esperaba $esperado"; }
        if [ $bien = 1 ] && [ -n "${extra:-}" ]; then
          if [ "${extra#!}" != "$extra" ]; then
            if grep -qi "^${extra#!}:" "$cabeceras"; then
              bien=0
              motivo="trae la cabecera ${extra#!}, que no debe publicarse"
            fi
          elif ! grep -qF "$extra" "$cuerpo"; then
            bien=0
            motivo="la respuesta no contiene $extra"
          fi
        fi
        rm -f "$cuerpo" "$cabeceras"
        [ $bien = 1 ] && break
        [ "$i" -lt "$intentos" ] && sleep 3
      done
      if [ $bien = 1 ]; then
        echo "bien  $codigo $metodo $url ${extra:-}"
      else
        echo "MAL   $metodo $url: $motivo"
        fallas=$((fallas + 1))
      fi
    done
    [ $fallas = 0 ] || { echo "$fallas comprobaciones fallaron" >&2; exit 1; }
    ;;
  *)
    echo "uso: herramienta subir|credencial|remoto|comprobar" >&2
    exit 64
    ;;
esac
