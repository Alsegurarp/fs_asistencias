#!/usr/bin/env bash
# Lo que la demostración hace dentro del servidor. Lo sube y lo llama
# deploy/servidor/demo/demo.sh desde la estación; no se corre a mano.
#
#   en-servidor.sh estado
#   en-servidor.sh borrar
#   en-servidor.sh crear  <carpeta con cuentas.tsv>
#   en-servidor.sh recepcion <HH:MM>
#   en-servidor.sh piloto <carpeta con pilot_card_key>
#
# Sólo toca la empresa de demostración (identificador fijo) y las cuentas
# demo.<algo>@zenit.example: cualquier otra empresa o cuenta queda fuera. No
# imprime contraseñas, claves ni correos que no sean de la demostración.
set -Eeuo pipefail

EMPRESA=demo-altiplano
NOMBRE='Distribuidora Altiplano'
SECRETOS=/opt/.fastsolution/zenit/secretos
BASE=fastsolution-zenit-db-1
BACKEND=fastsolution-zenit-backend-1
KC=http://127.0.0.1:19082
CUENTA='^demo\.[a-z]+@zenit\.example$'

psql_demo() { docker exec -i "$BASE" psql -U zenit_admin -d zenit -v ON_ERROR_STOP=1 -At; }

# Token de la cuenta de arranque, en un archivo de 600 para no pasarlo por la
# línea de órdenes.
TOKEN_ARCHIVO=""
token() {
  [ -n "$TOKEN_ARCHIVO" ] && return
  TOKEN_ARCHIVO=$(mktemp)
  trap 'rm -f "$TOKEN_ARCHIVO"' EXIT
  chmod 600 "$TOKEN_ARCHIVO"
  local clave respuesta
  clave=$(cat "$SECRETOS/keycloak_admin_password")
  respuesta=$(curl -s -m 20 --data-urlencode client_id=admin-cli --data-urlencode grant_type=password \
    --data-urlencode username=arranque --data-urlencode "password=$clave" "$KC/realms/master/protocol/openid-connect/token")
  printf 'Authorization: Bearer %s' "$(jq -r .access_token <<< "$respuesta")" > "$TOKEN_ARCHIVO"
  grep -q 'Bearer ey' "$TOKEN_ARCHIVO" || { echo "sin token de administración de identidad" >&2; exit 1; }
}

kc() { curl -s -m 20 -H @"$TOKEN_ARCHIVO" "$@"; }

# Identificadores de las cuentas de la demostración en identidad.
cuentas_demo() {
  kc "$KC/admin/realms/zenit/users?search=demo.&max=100" \
    | jq -r --arg patron "$CUENTA" '.[] | select(.username | test($patron)) | .id'
}

estado() {
  token
  echo "cuentas de demostración en identidad: $(cuentas_demo | wc -l)"
  psql_demo << SQL
SELECT 'empresa de demostración: ' || coalesce((SELECT name || ' (' || status || ')' FROM tenant WHERE slug = '$EMPRESA'), 'no existe');
SELECT 'personas: ' || count(*) FROM employee WHERE tenant_id = (SELECT id FROM tenant WHERE slug = '$EMPRESA');
SELECT 'dispositivos activos: ' || count(*) FROM device WHERE status = 'active' AND tenant_id = (SELECT id FROM tenant WHERE slug = '$EMPRESA');
SELECT 'marcajes: ' || count(*) FROM attendance_event WHERE tenant_id = (SELECT id FROM tenant WHERE slug = '$EMPRESA');
SQL
  if [ -s "$SECRETOS/pilot_card_key" ]; then echo "clave de las tarjetas del piloto: presente"; else echo "clave de las tarjetas del piloto: falta"; fi
}

borrar() {
  token
  local id borradas=0
  for id in $(cuentas_demo); do
    kc -o /dev/null -X DELETE "$KC/admin/realms/zenit/users/$id"
    borradas=$((borradas + 1))
  done
  echo "cuentas de demostración borradas de identidad: $borradas"
  # Cada tabla de una empresa lleva su tenant_id: se borra por esa columna, con
  # las llaves foráneas en pausa sólo dentro de esta transacción.
  psql_demo << SQL
BEGIN;
SET LOCAL session_replication_role = replica;
DO \$\$
DECLARE empresa uuid; tabla record; n bigint;
BEGIN
  SELECT id INTO empresa FROM tenant WHERE slug = '$EMPRESA';
  IF empresa IS NULL THEN RAISE NOTICE 'no había empresa de demostración'; RETURN; END IF;
  FOR tabla IN SELECT table_name FROM information_schema.columns
               WHERE table_schema = 'public' AND column_name = 'tenant_id' ORDER BY table_name LOOP
    EXECUTE format('DELETE FROM %I WHERE tenant_id = \$1', tabla.table_name) USING empresa;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '% filas de %', n, tabla.table_name; END IF;
  END LOOP;
  DELETE FROM tenant WHERE id = empresa;
  RAISE NOTICE 'empresa de demostración borrada';
END \$\$;
COMMIT;
SQL
}

# Una siembra tardía, como si se hubiera corrido a las HH:MM de hoy: lo que
# creó pasa a esa hora (creación, recepción y bitácora) y se quitan las
# incidencias «sincronizada tarde» que abrió el desfase, porque recibidas a esa
# hora esas marcas llegan dentro de las 24 horas (lateSyncHours del servidor).
# Va justo después de sembrar; repetirla no mueve nada.
recepcion() {
  local hora=${1:?falta la hora}
  [[ $hora =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || { echo "hora inválida: use HH:MM" >&2; exit 64; }
  psql_demo << SQL
BEGIN;
DO \$\$
DECLARE empresa uuid; desfase interval; columna record; quitadas bigint;
BEGIN
  SELECT id, created_at - (((now() AT TIME ZONE time_zone)::date + time '$hora') AT TIME ZONE time_zone)
    INTO empresa, desfase FROM tenant WHERE slug = '$EMPRESA';
  IF empresa IS NULL THEN RAISE EXCEPTION 'no hay empresa de demostración'; END IF;
  IF desfase < interval '0' THEN RAISE EXCEPTION 'la empresa es anterior a las $hora de hoy: no hay siembra que mover'; END IF;
  FOR columna IN SELECT c.table_name, c.column_name FROM information_schema.columns c
                 WHERE c.table_schema = 'public' AND c.column_name IN ('created_at', 'received_at', 'at')
                   AND EXISTS (SELECT 1 FROM information_schema.columns t WHERE t.table_schema = 'public'
                               AND t.table_name = c.table_name AND t.column_name = 'tenant_id') LOOP
    EXECUTE format('UPDATE %I SET %I = %I - \$2 WHERE tenant_id = \$1', columna.table_name, columna.column_name, columna.column_name)
      USING empresa, desfase;
  END LOOP;
  UPDATE tenant SET created_at = created_at - desfase WHERE id = empresa;
  WITH quitar AS (
    DELETE FROM incident i USING attendance_event e
    WHERE i.tenant_id = empresa AND e.tenant_id = empresa AND e.id = i.event_id
      AND i.type = 'late_sync' AND e.received_at - e.observed_at <= interval '24 hours'
    RETURNING i.id)
  DELETE FROM audit_log a USING quitar q
  WHERE a.tenant_id = empresa AND a.action = 'incident.opened' AND a.target_id = q.id::text;
  GET DIAGNOSTICS quitadas = ROW_COUNT;
  UPDATE attendance_event e SET outcome = 'accepted'
  WHERE e.tenant_id = empresa AND e.outcome = 'accepted_with_incident'
    AND NOT EXISTS (SELECT 1 FROM incident i WHERE i.tenant_id = empresa AND i.event_id = e.id);
  RAISE NOTICE 'siembra movida % atrás; % incidencias del desfase quitadas', date_trunc('second', desfase), quitadas;
END \$\$;
COMMIT;
SQL
}

# cuentas.tsv: rol, correo, nombre, contraseña, secreto del código, modo.
# Modo «listo»: contraseña y código ya configurados, para quien presenta.
# Modo «nuevo»: contraseña temporal; el primer ingreso se hace en vivo.
crear() {
  local carpeta=${1:?falta la carpeta}
  token
  local rol correo nombre clave otp modo cuerpo codigo id sql
  sql="BEGIN;
INSERT INTO tenant (id, slug, name, status, time_zone, week_starts_on, break_policy)
VALUES (gen_random_uuid(), '$EMPRESA', '$NOMBRE', 'active', 'America/Mexico_City', 'monday', 'not_considered');"
  while IFS=$'\t' read -r rol correo nombre clave otp modo; do
    [[ $correo =~ $CUENTA ]] || { echo "cuenta fuera de la demostración: se omite" >&2; continue; }
    case "$modo" in listo | nuevo) ;; *) echo "línea de cuenta incompleta: se detiene" >&2; exit 65 ;; esac
    [ "$otp" = - ] && otp=""
    case "$rol" in admin_empresa | rh | supervisor | auditor | trabajador) ;; *) echo "rol desconocido: se omite" >&2; continue ;; esac
    if [ "$modo" = nuevo ]; then
      cuerpo=$(jq -n --arg e "$correo" --arg n "$nombre" --arg p "$clave" \
        '{username:$e,email:$e,emailVerified:true,enabled:true,firstName:($n|split(" ")[0]),lastName:($n|split(" ")[1:]|join(" ")),
          requiredActions:["CONFIGURE_TOTP"],credentials:[{type:"password",value:$p,temporary:true}]}')
    else
      cuerpo=$(jq -n --arg e "$correo" --arg n "$nombre" --arg p "$clave" --arg o "$otp" \
        '{username:$e,email:$e,emailVerified:true,enabled:true,firstName:($n|split(" ")[0]),lastName:($n|split(" ")[1:]|join(" ")),
          requiredActions:[],credentials:[{type:"password",value:$p,temporary:false},
          {type:"otp",userLabel:"Demostración",secretData:({value:$o}|tojson),
           credentialData:({subType:"totp",digits:6,period:30,algorithm:"HmacSHA1",counter:0}|tojson)}]}')
    fi
    codigo=$(kc -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d "$cuerpo" "$KC/admin/realms/zenit/users")
    if [ "$modo" != nuevo ]; then
      # Identidad agrega por omisión las acciones del primer ingreso: quien
      # presenta ya tiene su código, así que se quitan.
      id=$(kc "$KC/admin/realms/zenit/users?exact=true&username=$(jq -rn --arg e "$correo" '$e|@uri')" | jq -r '.[0].id')
      kc -o /dev/null -X PUT -H 'Content-Type: application/json' -d '{"requiredActions":[]}' "$KC/admin/realms/zenit/users/$id"
    fi
    echo "cuenta de $rol en identidad: $codigo"
    sql+="
INSERT INTO tenant_user (tenant_id, id, email, display_name, status)
  SELECT id, gen_random_uuid(), '$correo', '$nombre', 'invited' FROM tenant WHERE slug = '$EMPRESA';
INSERT INTO tenant_user_role (tenant_id, user_id, role, granted_by)
  SELECT tenant_id, id, '$rol', 'demostracion' FROM tenant_user WHERE email = '$correo';"
  done < "$carpeta/cuentas.tsv"
  sql+="
COMMIT;"
  psql_demo <<< "$sql" > /dev/null
  echo "empresa de demostración creada, con sus cuentas invitadas"
}

# La clave con que se firman las tarjetas del piloto. Sólo se instala si el
# servidor no tiene una: cambiarla invalida las tarjetas ya escritas.
piloto() {
  local carpeta=${1:?falta la carpeta}
  if [ -s "$SECRETOS/pilot_card_key" ]; then
    echo "la clave de las tarjetas del piloto ya existe: se conserva"
  else
    cp "$carpeta/pilot_card_key" "$SECRETOS/.pilot_card_key.nuevo"
    chmod 444 "$SECRETOS/.pilot_card_key.nuevo"
    mv -f "$SECRETOS/.pilot_card_key.nuevo" "$SECRETOS/pilot_card_key"
    echo "clave de las tarjetas del piloto instalada"
  fi
  docker restart "$BACKEND" > /dev/null
  echo "backend reiniciado para leer la clave"
}

orden=${1:-}
shift || true
case "$orden" in
  estado) estado ;;
  borrar) borrar ;;
  crear) crear "$@" ;;
  recepcion) recepcion "$@" ;;
  piloto) piloto "$@" ;;
  *) echo "uso: en-servidor.sh estado|borrar|crear <carpeta>|recepcion <HH:MM>|piloto <carpeta>" >&2; exit 64 ;;
esac
