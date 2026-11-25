#!/usr/bin/env bash
# Pasos de despliegue que corren en el servidor. Los invoca, por SSH,
# deploy/servidor/desplegar.sh desde la estación:
#
#   remoto.sh <acción> <zenit|landing|zenit-landing> [versión]
#
# Acciones: construir, actualizar, esperar, borde (sólo zenit) y registrar.
set -Eeuo pipefail

BASE=/opt/.fastsolution
accion=${1:?indique la acción}
objetivo=${2:?indique zenit, landing o zenit-landing}
version=${3:-sin-version}

zenit() {
  local F=$BASE/zenit/fuente
  docker compose --progress plain --project-directory "$F" \
    -f "$F/compose.yaml" -f "$F/deploy/servidor/zenit/compose.yaml" \
    --env-file "$F/deploy/servidor/zenit/servidor.env" "$@" < /dev/null
}

landing() {
  (cd "$BASE/landing" && LANDING_VERSION=$version \
    docker compose --progress plain --env-file servidor.env "$@" < /dev/null)
}

zenit_landing() {
  (cd "$BASE/zenit-landing" && ZENIT_LANDING_VERSION=$version \
    docker compose --progress plain --env-file servidor.env "$@" < /dev/null)
}

# Espera a que el portal responda por el borde propio, con el protocolo PROXY
# que pone la pasarela del servidor: prueba la cadena borde, portal y backend.
esperar_zenit() {
  local i codigo
  for ((i = 1; i <= 80; i++)); do
    codigo=$(curl -sk --haproxy-protocol --max-time 5 -o /dev/null -w '%{http_code}' \
      --resolve zenit.fastsolution.com.mx:19443:127.0.0.1 \
      https://zenit.fastsolution.com.mx:19443/api/v1/system/status || true)
    if [ "$codigo" = 200 ]; then
      echo "Zenit responde: estado del backend 200 tras $((i * 3)) s"
      zenit ps --format '{{.Service}} {{.Status}}'
      return 0
    fi
    [ $((i % 10)) = 0 ] && echo "esperando a Zenit: último código $codigo"
    sleep 3
  done
  echo "Zenit no respondió en 240 s; estado de los servicios:" >&2
  zenit ps --format '{{.Service}} {{.Status}}' >&2
  return 1
}

# Espera a que el contenedor de una landing corra la imagen de esta versión y
# su prueba de salud pase.
esperar_landing() { # proyecto Compose (también es el nombre de la imagen)
  local proyecto=$1 i estado
  for ((i = 1; i <= 40; i++)); do
    estado=$(docker inspect "$proyecto-landing-1" \
      --format '{{.Config.Image}} {{.State.Health.Status}}' 2>/dev/null || true)
    case "$estado" in
      "$proyecto:$version healthy")
        echo "landing sana: $estado"
        return 0
        ;;
    esac
    sleep 3
  done
  echo "la landing no quedó sana en 120 s: $estado" >&2
  docker logs --tail 20 "$proyecto-landing-1" >&2 || true
  return 1
}

# Lleva al borde en marcha la configuración del árbol desplegado, sólo si
# cambió. Los bloques nuevos se prueban con nginx -t en un contenedor
# desechable, con la imagen y los certificados del borde, antes de copiarlos.
borde() {
  local nuevo=$BASE/zenit/fuente/deploy/servidor/borde B=$BASE/borde
  local conf=0 imagen=0
  diff -rq "$nuevo/conf.d" "$B/conf.d" > /dev/null || conf=1
  { diff -q "$nuevo/compose.yaml" "$B/compose.yaml" &&
    diff -q "$nuevo/servidor.env" "$B/servidor.env" &&
    diff -rq "$nuevo/imagenes" "$B/imagenes"; } > /dev/null || imagen=1
  if [ $conf = 0 ] && [ $imagen = 0 ]; then
    echo "borde sin cambios"
    return 0
  fi
  if [ $imagen = 1 ]; then
    echo "borde: cambió su composición o sus imágenes; se reconstruye"
    cp "$nuevo/compose.yaml" "$nuevo/servidor.env" "$B/"
    rm -rf "$B/imagenes"
    cp -r "$nuevo/imagenes" "$B/imagenes"
    (cd "$B" && docker compose --progress plain --env-file servidor.env build < /dev/null)
  fi
  if [ $conf = 1 ]; then
    echo "borde: cambiaron sus bloques; se prueban antes de aplicarlos"
    diff -r "$B/conf.d" "$nuevo/conf.d" || true
    docker run --rm --network none --read-only --tmpfs /tmp \
      -v "$nuevo/conf.d:/etc/nginx/conf.d:ro" \
      -v "$B/estado/lego/certificates:/etc/nginx/certificados:ro" \
      -v "$B/estado/acme:/var/www/acme:ro" \
      --entrypoint nginx fastsolution-borde-nginx:1.30.7 -t < /dev/null
    rm -f "$B"/conf.d/*.conf
    cp "$nuevo"/conf.d/*.conf "$B/conf.d/"
    chmod 644 "$B"/conf.d/*.conf
  fi
  if [ $imagen = 1 ]; then
    (cd "$B" && docker compose --env-file servidor.env up -d < /dev/null)
  else
    docker exec fastsolution-borde-borde-1 nginx -s reload < /dev/null
  fi
  echo "borde actualizado"
}

# Aplica al realm existente lo que agrega el versionado y prepara el cliente
# técnico de contraseñas. El backend lee su secreto al arrancar: si cambió, se
# recrea y se vuelve a esperar. Sólo compara huellas; el secreto no se muestra.
#
# La credencial de correo que sube `desplegar.sh zenit --credencial` llega a
# una carpeta de quien despliega. La guarda con los demás secretos un
# contenedor, porque esa carpeta es de root; después se borra la copia.
instalar_correo() {
  local entrada=$BASE/zenit/correo-entrante
  [ -f "$entrada/smtp.env" ] || return 0
  zenit --profile identidad run --rm --no-deps --cap-add DAC_OVERRIDE \
    -v "$entrada:/entrada:ro" -v "$BASE/zenit/secretos:/destino" --entrypoint sh identidad -c \
    'mkdir -p /destino/correo && cp /entrada/smtp.env /destino/correo/smtp.env.nuevo &&
     chmod 444 /destino/correo/smtp.env.nuevo && mv /destino/correo/smtp.env.nuevo /destino/correo/smtp.env'
  rm -rf "$entrada"
  echo "credencial de correo guardada con los secretos, sin mostrarla"
}

identidad_zenit() {
  local carpeta=$BASE/zenit/secretos/identity-admin antes despues
  instalar_correo
  antes=$(sha256sum "$carpeta/identity_admin_client_secret" "$carpeta/audit_keycloak_client_secret" "$carpeta/audit_brevo_key" "$carpeta/audit_mail_from" 2> /dev/null || true)
  zenit --profile identidad run --rm identidad
  despues=$(sha256sum "$carpeta/identity_admin_client_secret" "$carpeta/audit_keycloak_client_secret" "$carpeta/audit_brevo_key" "$carpeta/audit_mail_from" 2> /dev/null || true)
  if [ "$antes" != "$despues" ]; then
    echo "el secreto del cliente técnico cambió: se recrea el backend"
    zenit up -d --force-recreate --no-deps backend
    esperar_zenit
  fi
}

case "$accion:$objetivo" in
  construir:zenit) zenit build ;;
  actualizar:zenit) zenit up -d ;;
  esperar:zenit) esperar_zenit ;;
  identidad:zenit) identidad_zenit ;;
  borde:zenit) borde ;;
  construir:landing) landing build ;;
  actualizar:landing) landing up -d ;;
  esperar:landing) esperar_landing fastsolution-landing ;;
  construir:zenit-landing) zenit_landing build ;;
  actualizar:zenit-landing) zenit_landing up -d ;;
  esperar:zenit-landing) esperar_landing fastsolution-zenit-landing ;;
  registrar:zenit | registrar:landing | registrar:zenit-landing)
    resultado=${4:?indique el resultado}
    segundos=${5:?indique la duración}
    printf '%s\t%s\t%s\t%ss\n' "$(date -Iseconds)" "$version" "$resultado" "$segundos" \
      >> "$BASE/$objetivo/despliegues.log"
    echo "registrado en $BASE/$objetivo/despliegues.log"
    ;;
  *)
    echo "acción desconocida: $accion $objetivo" >&2
    exit 64
    ;;
esac
