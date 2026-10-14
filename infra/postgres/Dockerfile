# Base de datos del entorno. Parte de la imagen oficial de PostgreSQL sobre
# Alpine y le cambia tres cosas, las tres para que traiga menos defectos
# conocidos y menos privilegios.
FROM postgres:18.6-alpine3.24@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873 AS database

# 1. Paquetes del sistema con vulnerabilidades ya corregidas, que la imagen
#    base todavía no trae. Se quita cuando la imagen base los incluya.
RUN apk add --no-cache "zlib>=1.3.2-r1" "libcrypto3>=3.5.9-r0" "libssl3>=3.5.9-r0"

# 2. La imagen oficial arranca como root y baja de privilegios con esta
#    herramienta, que viene compilada con una versión antigua de su lenguaje y
#    concentra casi todas las vulnerabilidades graves de la imagen. Aquí no
#    hace falta, porque el contenedor ya arranca sin privilegios.
RUN rm /usr/local/bin/gosu

# 3. Arranca directamente como el usuario de la base, sin pasar por root.
USER postgres

# Sólo las herramientas de respaldo necesitan cifrado; la base conserva su imagen.
FROM database AS backup-tools
USER root
RUN apk add --no-cache age \
    && mkdir -p /work /backups \
    && chown postgres:postgres /work /backups
COPY backup /opt/zenit
USER postgres
