#!/bin/sh
# Separa los roles de la base del producto. Sólo corre la primera vez que se
# inicializa el volumen de datos.
#
#   zenit_migrator  dueño del esquema; sólo lo usa el paso de migraciones.
#   zenit_app       atiende peticiones; no es dueño de nada y no recibe ningún
#                   permiso sobre tablas aquí: cada migración abre lo suyo.
set -eu

migrador="$(cat /run/secrets/db_migrator_password)"
aplicacion="$(cat /run/secrets/db_app_password)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=migrador="$migrador" --set=aplicacion="$aplicacion" --set=base="$POSTGRES_DB" <<'SQL'
CREATE ROLE zenit_migrator LOGIN PASSWORD :'migrador';
CREATE ROLE zenit_app LOGIN PASSWORD :'aplicacion';

ALTER DATABASE :"base" OWNER TO zenit_migrator;
GRANT CONNECT ON DATABASE :"base" TO zenit_app;
GRANT USAGE ON SCHEMA public TO zenit_app;
SQL
