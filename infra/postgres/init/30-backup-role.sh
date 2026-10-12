#!/bin/sh
# Rol para respaldar: sólo lee. No es dueño de nada, no escribe y no puede
# cambiar el esquema. Lo usa el ensayo de respaldo y restauración.
#
# Corre la primera vez que se inicializa el volumen de datos. Se puede volver a
# correr sin daño en un volumen que ya existía:
#   docker compose exec db sh /docker-entrypoint-initdb.d/30-backup-role.sh
set -eu

respaldo="$(cat /run/secrets/db_backup_password)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=respaldo="$respaldo" --set=base="$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE zenit_backup LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zenit_backup') \gexec
ALTER ROLE zenit_backup PASSWORD :'respaldo';

-- Lee todas las tablas de las dos bases, y nada más.
GRANT pg_read_all_data TO zenit_backup;
GRANT CONNECT ON DATABASE :"base" TO zenit_backup;
GRANT CONNECT ON DATABASE keycloak TO zenit_backup;
SQL
