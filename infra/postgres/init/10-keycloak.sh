#!/bin/sh
# Crea la base y el rol del proveedor de identidad, separados de los del
# producto. Sólo corre la primera vez que se inicializa el volumen de datos.
set -eu

clave="$(cat /run/secrets/keycloak_db_password)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=clave="$clave" <<'SQL'
CREATE ROLE keycloak_app LOGIN PASSWORD :'clave';
CREATE DATABASE keycloak OWNER keycloak_app;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
SQL

# El rol de identidad no entra a la base del producto.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "REVOKE CONNECT ON DATABASE \"$POSTGRES_DB\" FROM PUBLIC"
