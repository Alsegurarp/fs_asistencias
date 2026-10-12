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
# No conserva nada: el respaldo, la instancia y los conteos viven en memoria y
# desaparecen con el contenedor. No imprime datos, sólo nombres de tabla,
# conteos y huellas.
#
# Modo de control: con BACKUP_TAMPER=true borra una fila de la base restaurada
# antes de comparar. El ensayo debe fallar; si no falla, la comparación no
# sirve.
set -Eeuo pipefail

WORK=/work
SOURCE_HOST="${PGHOST:?Falta PGHOST}"
SOURCE_USER="${BACKUP_USER:-zenit_backup}"
DATABASES="${BACKUP_DATABASES:?Falta BACKUP_DATABASES}"
TAMPER="${BACKUP_TAMPER:-false}"
RESTORE_USER=restaura

fail() {
  echo "ENSAYO FALLIDO: $*" >&2
  exit 1
}

# La contraseña va en un archivo que sólo lee este usuario, no en el ambiente.
umask 077
PASSWORD_FILE=/run/secrets/db_backup_password
[ -s "$PASSWORD_FILE" ] || fail "no existe el secreto db_backup_password; hay que generar los secretos otra vez."
export PGPASSFILE="$WORK/pgpass"
printf '%s:5432:*:%s:%s\n' "$SOURCE_HOST" "$SOURCE_USER" "$(cat "$PASSWORD_FILE")" > "$PGPASSFILE"

# Cuenta las filas de cada tabla. Se usa igual en el origen y en la restauración.
COUNTS="select n.nspname || '.' || c.relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%' order by 1"

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
}
trap stop_instance EXIT

source_psql -d postgres -At -c "select 1" > /dev/null 2>&1 \
  || fail "el rol $SOURCE_USER no puede entrar. Si el volumen de datos se creó antes de que existiera, hay que crearlo: docker compose exec db sh /docker-entrypoint-initdb.d/30-backup-role.sh"

echo "Origen: $(source_psql -d postgres -At -c "select 'PostgreSQL ' || current_setting('server_version')") en $SOURCE_HOST, con el rol $SOURCE_USER"
started=$(date +%s)

# 1. Respaldo y conteos, en la misma instantánea.
for db in $DATABASES; do
  export ZENIT_DUMP="$WORK/$db.dump" ZENIT_DB="$db" ZENIT_HOST="$SOURCE_HOST" ZENIT_USER="$SOURCE_USER"
  source_psql -d "$db" -At -F '|' > "$WORK/$db.source" <<SQL
begin isolation level repeatable read read only;
select pg_export_snapshot() as snapshot \gset
\setenv ZENIT_SNAPSHOT :snapshot
\! pg_dump --snapshot="\$ZENIT_SNAPSHOT" --format=custom --file="\$ZENIT_DUMP" -h "\$ZENIT_HOST" -U "\$ZENIT_USER" -w -d "\$ZENIT_DB" && touch "\$ZENIT_DUMP.ok"
$COUNTS;
commit;
SQL
  [ -f "$WORK/$db.dump.ok" ] || fail "no se pudo respaldar la base $db."
  echo "Respaldo de $db: $(stat -c %s "$WORK/$db.dump") bytes, sha256 $(sha256sum "$WORK/$db.dump" | cut -d' ' -f1)"
done

# 2. Instancia desechable. Sólo escucha en un socket dentro de este contenedor.
mkdir -p "$WORK/run"
initdb -D "$WORK/pgdata" -U "$RESTORE_USER" --auth=trust --encoding=UTF8 --no-sync > /dev/null
pg_ctl -D "$WORK/pgdata" -o "-c listen_addresses='' -c unix_socket_directories=$WORK/run -c fsync=off" -l "$WORK/restore.log" -w start > /dev/null

# El respaldo nombra a los dueños y a quienes tienen permisos: esos roles deben
# existir para restaurar. Se crean sin acceso; las contraseñas no viajan en el
# respaldo, las pone la inicialización del entorno.
source_psql -d postgres -At -c "select rolname from pg_roles where rolname !~ '^pg_'" | while read -r role; do
  [ "$role" = "$RESTORE_USER" ] || restored_psql -d postgres -c "create role \"$role\" nologin"
done

# 3. Restauración y comparación.
tables=0
rows=0
for db in $DATABASES; do
  restored_psql -d postgres -c "create database \"$db\" template template0 encoding 'UTF8'"
  pg_restore --exit-on-error -h "$WORK/run" -U "$RESTORE_USER" -d "$db" "$WORK/$db.dump" \
    || fail "el respaldo de $db no se restauró limpio."
  if [ "$TAMPER" = "true" ]; then
    victim=$(restored_psql -d "$db" -At -F '|' -c "$COUNTS" | awk -F'|' '$2 > 0 { print $1; exit }')
    [ -n "$victim" ] || fail "no hay ninguna tabla con filas en $db para el control."
    restored_psql -d "$db" -c "delete from $victim where ctid = (select ctid from $victim limit 1)" 2> /dev/null \
      || restored_psql -d "$db" -c "set session_replication_role = replica; delete from $victim where ctid = (select ctid from $victim limit 1)"
    echo "Control: se borró una fila de $victim en la base restaurada."
  fi
  restored_psql -d "$db" -At -F '|' -c "$COUNTS" > "$WORK/$db.restored"
  if ! diff "$WORK/$db.source" "$WORK/$db.restored" > "$WORK/$db.diff"; then
    echo "Diferencias en $db (origen < y restaurada >):" >&2
    cat "$WORK/$db.diff" >&2
    fail "los conteos de $db no coinciden."
  fi
  db_tables=$(wc -l < "$WORK/$db.source")
  db_rows=$(awk -F'|' '{ total += $2 } END { print total + 0 }' "$WORK/$db.source")
  [ "$db_tables" -gt 0 ] || fail "la base $db no tiene tablas: no hay nada que comprobar."
  echo "Restauración de $db: $db_tables tablas y $db_rows filas, iguales al origen."
  tables=$((tables + db_tables))
  rows=$((rows + db_rows))
done

echo "ENSAYO CORRECTO: $tables tablas y $rows filas restauradas e iguales, en $(($(date +%s) - started)) s. No se conservó nada."
