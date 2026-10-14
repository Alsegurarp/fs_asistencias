#!/usr/bin/env bash
# Prueba aislada: no recibe datos, contraseñas ni red del entorno real.
set -Eeuo pipefail
umask 077
mkdir -p /work/source-socket
cleanup() { pg_ctl -D /work/source -m immediate -w stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
printf 'fixture-only\n' > /run/secrets/db_backup_password
age-keygen -o /run/secrets/backup-age.key 2>/dev/null
export BACKUP_RECIPIENT
BACKUP_RECIPIENT=$(age-keygen -y /run/secrets/backup-age.key)
initdb -D /work/source -U fixture --auth=trust --locale-provider=builtin --builtin-locale=C.UTF-8 >/dev/null
pg_ctl -D /work/source -o '-c listen_addresses= -c unix_socket_directories=/work/source-socket' -l /work/source.log -w start >/dev/null
psql -X -q -v ON_ERROR_STOP=1 -h /work/source-socket -U fixture -d postgres <<'SQL'
CREATE ROLE zenit_backup LOGIN PASSWORD 'fixture-only';
GRANT pg_read_all_data TO zenit_backup;
CREATE ROLE fixture_owner NOLOGIN;
CREATE DATABASE zenit OWNER fixture_owner;
CREATE DATABASE keycloak OWNER fixture_owner;
SQL
for db in zenit keycloak; do
  psql -X -q -v ON_ERROR_STOP=1 -h /work/source-socket -U fixture -d "$db" <<'SQL'
CREATE TABLE probe(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, label text, body jsonb, bytes bytea, at timestamptz);
INSERT INTO probe(label, body, bytes, at) VALUES ('Árbol / ñ', '{"a": null, "b": 3}', '\x00ff', '2026-10-14T02:03:04Z'), (NULL, '{}', NULL, NULL);
ALTER TABLE probe OWNER TO fixture_owner;
SQL
done
export PGHOST=/work/source-socket BACKUP_DATABASES='zenit keycloak'
BACKUP_MODE=backup bash /opt/zenit/rehearse.sh
export BACKUP_FILE
BACKUP_FILE=$(basename /backups/zenit-*.tar.age)
# Se apaga el origen antes de restaurar: ya no puede suministrar datos ni roles.
cleanup
BACKUP_MODE=restore bash /opt/zenit/rehearse.sh > /work/success.log 2>&1
grep -q 'ENSAYO CORRECTO: 2 tablas y 4 filas' /work/success.log
if BACKUP_MODE=restore BACKUP_TAMPER=true bash /opt/zenit/rehearse.sh > /work/deleted.log 2>&1; then
  echo 'FALLO: aceptó filas eliminadas.' >&2; exit 1
fi
grep -q 'huellas de contenido.*no coinciden' /work/deleted.log
# Misma cantidad de filas, huella de contenido equivocada: también debe fallar.
mkdir /work/changed
age -d -i /run/secrets/backup-age.key /backups/"$BACKUP_FILE" | tar -xf - -C /work/changed
awk -F'|' 'BEGIN { OFS="|" } { $3="0000000000000000000000000000000000000000000000000000000000000000"; print }' /work/changed/zenit.source > /work/changed/replaced
mv /work/changed/replaced /work/changed/zenit.source
(cd /work/changed && sha256sum databases roles.sql *.dump *.source > SHA256SUMS && tar -cf - databases roles.sql SHA256SUMS *.dump *.source) | age -r "$BACKUP_RECIPIENT" -o /backups/content.tar.age
if BACKUP_MODE=restore BACKUP_FILE=content.tar.age bash /opt/zenit/rehearse.sh > /work/content.log 2>&1; then
  echo 'FALLO: aceptó contenido diferente.' >&2; exit 1
fi
grep -q 'huellas de contenido.*no coinciden' /work/content.log
# Un byte añadido al ciphertext debe fallar antes de iniciar PostgreSQL.
cp /backups/"$BACKUP_FILE" /backups/corrupt.tar.age
printf '\000' >> /backups/corrupt.tar.age
if BACKUP_MODE=restore BACKUP_FILE=corrupt.tar.age bash /opt/zenit/rehearse.sh > /work/corrupt.log 2>&1; then
  echo 'FALLO: aceptó un paquete alterado.' >&2; exit 1
fi
grep -q 'no se pudo autenticar y descifrar' /work/corrupt.log
age-keygen -o /work/wrong.key 2>/dev/null
cp /work/wrong.key /run/secrets/backup-age.key
if BACKUP_MODE=restore bash /opt/zenit/rehearse.sh > /work/wrong.log 2>&1; then
  echo 'FALLO: aceptó otra clave privada.' >&2; exit 1
fi
grep -q 'no se pudo autenticar y descifrar' /work/wrong.log
echo 'AUTOPRUEBA CORRECTA: restauración sin origen, filas eliminadas, contenido distinto, cifrado alterado y clave incorrecta.'
