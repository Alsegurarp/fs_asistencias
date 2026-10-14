#!/usr/bin/env bash
# Ensayo de respaldo y restauración.
#
# Por cada base: toma una instantánea, respalda con ella y cuenta las filas de
# cada tabla dentro de esa misma instantánea. Después restaura el respaldo en
# una instancia de PostgreSQL desechable, dentro de este mismo contenedor,
# vuelve a contar y exige que los conteos sean iguales. Como el conteo y el
# respaldo ven la misma instantánea, la comparación es exacta aunque la base
# siga recibiendo escrituras.
#
# BACKUP_MODE=backup guarda un paquete age; restore lo verifica sin el origen.
# rehearsal conserva el ensayo en memoria. Nunca imprime contenido de filas.
#
# Modo de control: con BACKUP_TAMPER=true borra una fila de la base restaurada
# antes de comparar. El ensayo debe fallar; si no falla, la comparación no
# sirve.
set -Eeuo pipefail

umask 077
WORK=$(mktemp -d /work/backup.XXXXXX)
MODE="${BACKUP_MODE:-rehearsal}"
SOURCE_HOST="${PGHOST:-}"
SOURCE_USER="${BACKUP_USER:-zenit_backup}"
DATABASES="${BACKUP_DATABASES:-}"
TAMPER="${BACKUP_TAMPER:-false}"
RESTORE_USER=restaura

fail() {
  echo "ENSAYO FALLIDO: $*" >&2
  exit 1
}

case "$MODE" in rehearsal|backup|restore) ;; *) fail "modo desconocido." ;; esac
# Representación estable de fechas y números en las huellas de contenido.
export PGOPTIONS='-c timezone=UTC -c datestyle=ISO,YMD -c extra_float_digits=3'
mkdir "$WORK/payload"
PAYLOAD="$WORK/payload"

# Cuenta las filas de cada tabla. Se usa igual en el origen y en la restauración.
# shortcut: agrega 64 bytes por fila en memoria, usar huellas por lotes antes de respaldar tablas de millones de filas.
COUNTS="select format('%I.%I', n.nspname, c.relname), (xpath('/row/c/text()', x.data))[1]::text::bigint, (xpath('/row/h/text()', x.data))[1]::text from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join lateral (select query_to_xml(format('select count(*) as c, encode(sha256(convert_to(coalesce(string_agg(h, %L order by h collate \"C\"), %L), %L)), %L) as h from (select encode(sha256(convert_to(row_to_json(t)::text, %L)), %L) as h from %I.%I t) hashed_rows', '', '', 'UTF8', 'hex', 'UTF8', 'hex', n.nspname, c.relname), false, true, '') as data) x where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%' order by 1"

source_psql() {
  psql -X -q -v ON_ERROR_STOP=1 -h "$SOURCE_HOST" -U "$SOURCE_USER" -w "$@"
}

restored_psql() {
  psql -X -q -v ON_ERROR_STOP=1 -h "$WORK/run" -U "$RESTORE_USER" "$@"
}

stop_instance() {
  if [ -f "$WORK/pgdata/postmaster.pid" ]; then
    pg_ctl -D "$WORK/pgdata" -m immediate -w stop > /dev/null 2>&1 || true
  fi
  if [ -n "${PENDING_FILE:-}" ]; then rm -f -- "$PENDING_FILE"; fi
  rm -rf -- "$WORK"
}
trap stop_instance EXIT

started=$(date +%s)
if [ "$MODE" = restore ]; then
  FILE="${BACKUP_FILE:?Falta BACKUP_FILE}"
  [[ "$FILE" =~ ^[a-zA-Z0-9_.-]+\.tar\.age$ ]] || fail "nombre de archivo inválido."
  [ -s /run/secrets/backup-age.key ] || fail "falta la clave privada de restauración."
  age --decrypt -i /run/secrets/backup-age.key -o "$WORK/archive.tar" "/backups/$FILE" \
    || fail "no se pudo autenticar y descifrar el paquete."
  # No se permiten rutas, enlaces ni archivos ajenos al formato.
  tar -tf "$WORK/archive.tar" > "$WORK/members"
  while read -r member; do
    [[ "$member" =~ ^(databases|roles\.sql|SHA256SUMS|[a-zA-Z_][a-zA-Z0-9_]*\.(dump|source))$ ]] || fail "archivo ajeno al formato."
  done < "$WORK/members"
  tar -tvf "$WORK/archive.tar" | awk 'substr($0,1,1) != "-" { exit 1 }' || fail "el paquete contiene enlaces o directorios."
  tar -xf "$WORK/archive.tar" -C "$PAYLOAD" --no-same-owner
  DATABASES=$(cat "$PAYLOAD/databases")
fi
[ -n "$DATABASES" ] || fail "no hay bases para respaldar o restaurar."
for db in $DATABASES; do
  [[ "$db" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || fail "nombre de base inválido."
done

if [ "$MODE" != restore ]; then
[ -n "$SOURCE_HOST" ] || fail "falta PGHOST."
PASSWORD_FILE="${BACKUP_PASSWORD_FILE:-/run/secrets/db_backup_password}"
[ -s "$PASSWORD_FILE" ] || fail "falta db_backup_password."
export PGPASSFILE="$WORK/pgpass"
printf '%s:5432:*:%s:%s\n' "$SOURCE_HOST" "$SOURCE_USER" "$(cat "$PASSWORD_FILE")" > "$PGPASSFILE"

source_psql -d postgres -At -c "select 1" > /dev/null 2>&1 \
  || fail "el rol $SOURCE_USER no puede entrar. Si el volumen de datos se creó antes de que existiera, hay que crearlo: docker compose exec db sh /docker-entrypoint-initdb.d/30-backup-role.sh"

echo "Origen: $(source_psql -d postgres -At -c "select 'PostgreSQL ' || current_setting('server_version')") en $SOURCE_HOST, con el rol $SOURCE_USER"
printf '%s\n' "$DATABASES" > "$PAYLOAD/databases"
# Los nombres se citan en el servidor. No se guardan contraseñas ni superusuarios.
source_psql -d postgres -At -c "select format('CREATE ROLE %I NOLOGIN %s;', rolname, case when rolinherit then 'INHERIT' else 'NOINHERIT' end) from pg_roles where rolname !~ '^pg_' and rolname <> '$RESTORE_USER' order by rolname" > "$PAYLOAD/roles.sql"
source_psql -d postgres -At -c "select format('GRANT %I TO %I WITH ADMIN %s, INHERIT %s, SET %s;', granted.rolname, member.rolname, case when m.admin_option then 'TRUE' else 'FALSE' end, case when m.inherit_option then 'TRUE' else 'FALSE' end, case when m.set_option then 'TRUE' else 'FALSE' end) from pg_auth_members m join pg_roles granted on granted.oid = m.roleid join pg_roles member on member.oid = m.member where member.rolname !~ '^pg_'" >> "$PAYLOAD/roles.sql"

# 1. Respaldo y conteos, en la misma instantánea.
for db in $DATABASES; do
  export ZENIT_DUMP="$PAYLOAD/$db.dump" ZENIT_DB="$db" ZENIT_HOST="$SOURCE_HOST" ZENIT_USER="$SOURCE_USER"
  source_psql -d "$db" -At -F '|' > "$PAYLOAD/$db.source" <<SQL
begin isolation level repeatable read read only;
select pg_export_snapshot() as snapshot \gset
\setenv ZENIT_SNAPSHOT :snapshot
\! pg_dump --snapshot="\$ZENIT_SNAPSHOT" --format=custom --file="\$ZENIT_DUMP" -h "\$ZENIT_HOST" -U "\$ZENIT_USER" -w -d "\$ZENIT_DB" && touch "\$ZENIT_DUMP.ok"
$COUNTS;
commit;
SQL
  [ -f "$PAYLOAD/$db.dump.ok" ] || fail "no se pudo respaldar la base $db."
  rm "$PAYLOAD/$db.dump.ok"
  [ -s "$PAYLOAD/$db.source" ] || fail "la base $db no tiene tablas."
  echo "Respaldo de $db: $(stat -c %s "$PAYLOAD/$db.dump") bytes."
done
(cd "$PAYLOAD" && sha256sum databases roles.sql *.dump *.source > SHA256SUMS)
if [ "$MODE" = backup ]; then
  [ -n "${BACKUP_RECIPIENT:-}" ] || fail "falta BACKUP_RECIPIENT (clave pública age)."
  PENDING_FILE=$(mktemp /backups/.pending.XXXXXX)
  (cd "$PAYLOAD" && tar -cf - databases roles.sql SHA256SUMS *.dump *.source) \
    | age -r "$BACKUP_RECIPIENT" -o "$PENDING_FILE"
  FILE="zenit-$(date -u +%Y%m%dT%H%M%SZ)-${PENDING_FILE##*.}.tar.age"
  mv -n "$PENDING_FILE" "/backups/$FILE"
  PENDING_FILE=
  echo "RESPALDO CIFRADO: $FILE; sha256 $(sha256sum "/backups/$FILE" | cut -d' ' -f1)."
  exit 0
fi
fi

# Recalcular la lista completa evita que el manifiesto omita un archivo.
(cd "$PAYLOAD" && sha256sum databases roles.sql *.dump *.source) > "$WORK/checksums"
cmp -s "$PAYLOAD/SHA256SUMS" "$WORK/checksums" || fail "el paquete no coincide con sus huellas."

# 2. Instancia desechable. Sólo escucha en un socket dentro de este contenedor.
mkdir -p "$WORK/run"
# Con la misma ordenación que la base real, para que los índices se reconstruyan igual.
# shellcheck disable=SC2086
if ! initdb -D "$WORK/pgdata" -U "$RESTORE_USER" --auth=trust --encoding=UTF8 --no-sync ${RESTORE_INITDB_ARGS:-} > "$WORK/initdb.log" 2>&1; then
  cat "$WORK/initdb.log" >&2
  fail "no se pudo crear la instancia desechable."
fi
pg_ctl -D "$WORK/pgdata" -o "-c listen_addresses='' -c unix_socket_directories=$WORK/run -c fsync=off" -l "$WORK/restore.log" -w start > /dev/null

# El respaldo nombra a los dueños y a quienes tienen permisos: esos roles deben
# existir para restaurar. Se crean sin acceso; las contraseñas no viajan en el
# respaldo, las pone la inicialización del entorno.
restored_psql -d postgres -f "$PAYLOAD/roles.sql"

# 3. Restauración y comparación.
tables=0
rows=0
for db in $DATABASES; do
  pg_restore --exit-on-error --create -h "$WORK/run" -U "$RESTORE_USER" -d postgres "$PAYLOAD/$db.dump" \
    || fail "el respaldo de $db no se restauró limpio."
  if [ "$TAMPER" = "true" ]; then
    victim=$(restored_psql -d "$db" -At -F '|' -c "$COUNTS" | awk -F'|' '$2 > 0 { print $1; exit }')
    [ -n "$victim" ] || fail "no hay ninguna tabla con filas en $db para el control."
    restored_psql -d "$db" -c "delete from $victim where ctid = (select ctid from $victim limit 1)" 2> /dev/null \
      || restored_psql -d "$db" -c "set session_replication_role = replica; delete from $victim where ctid = (select ctid from $victim limit 1)"
    echo "Control: se borró una fila de $victim en la base restaurada."
  fi
  restored_psql -d "$db" -At -F '|' -c "$COUNTS" > "$WORK/$db.restored"
  if ! diff -U0 "$PAYLOAD/$db.source" "$WORK/$db.restored" > "$WORK/$db.diff"; then
    echo "Diferencias en $db (- origen, + restaurada):" >&2
    cat "$WORK/$db.diff" >&2
    fail "los conteos o las huellas de contenido de $db no coinciden."
  fi
  db_tables=$(wc -l < "$PAYLOAD/$db.source")
  db_rows=$(awk -F'|' '{ total += $2 } END { print total + 0 }' "$PAYLOAD/$db.source")
  [ "$db_tables" -gt 0 ] || fail "la base $db no tiene tablas: no hay nada que comprobar."
  echo "Restauración de $db: $db_tables tablas y $db_rows filas, iguales al origen."
  tables=$((tables + db_tables))
  rows=$((rows + db_rows))
done

echo "ENSAYO CORRECTO: $tables tablas y $rows filas con contenido idéntico, en $(($(date +%s) - started)) s. La instancia de prueba se elimina."
