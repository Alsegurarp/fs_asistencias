# Borde de fastSolution: nginx oficial sin privilegios, con el usuario 101.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
# Paquetes del sistema con vulnerabilidades ya corregidas que la imagen base
# todavía no trae. Se quitan cuando la imagen base los incluya.
USER root
# nginx 1.30.7 (18-nov-2026) corrige CVE-2026-123633, CVE-2026-123007,
# CVE-2026-121810, CVE-2026-123634 y CVE-2026-113425 (críticas) y
# CVE-2026-118899 (alta). La imagen oficial aún no lo trae: se instala del
# repositorio firmado de nginx.org (la llave ya viene en la base), con sus
# módulos en la misma versión (la base los deja fijados en /etc/apk/world, por
# eso se piden con versión exacta). Se quita cuando la imagen base sea 1.30.7.
RUN apk add --no-cache -X https://nginx.org/packages/alpine/v3.24/main \
        nginx=1.30.7-r1 nginx-module-geoip=1.30.7-r1 nginx-module-image-filter=1.30.7-r1 \
        nginx-module-njs=1.30.7.1.0.2-r1 nginx-module-xslt=1.30.7-r1 \
    && rm -f /etc/nginx/*.apk-new /etc/nginx/conf.d/*.apk-new \
    && nginx -v 2>&1 | grep -q 'nginx/1.30.7'
# Mismos paquetes corregidos que el portal (web/Dockerfile). curl no se usa
# dentro del borde (la salud es `nginx -t`); retirarlo elimina libcurl vulnerable.
RUN apk add --no-cache "tiff>=4.7.2-r0" "zlib>=1.4-r0" "libxslt>=1.1.43-r4" "libexpat>=2.10.0-r0" "libx11>=1.8.14-r0" "musl>=1.2.6-r3" "musl-utils>=1.2.6-r3" "brotli-libs>=1.2.1-r0" \
    && apk del --no-network curl
USER 101
