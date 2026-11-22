FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_IDENTITY_URL=http://localhost:8082
RUN VITE_IDENTITY_URL="$VITE_IDENTITY_URL" pnpm build

# Variante que corre sin privilegios, con el usuario 101.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
# Paquetes del sistema con una vulnerabilidad alta ya corregida, que la imagen
# base todavía no trae. Se quita cuando la imagen base los incluya.
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
# curl no se usa al arrancar ni servir el portal; retirarlo elimina también libcurl vulnerable.
RUN apk add --no-cache "tiff>=4.7.2-r0" "zlib>=1.4-r0" "libxslt>=1.1.43-r4" "libexpat>=2.10.0-r0" "libx11>=1.8.14-r0" "musl>=1.2.6-r3" "musl-utils>=1.2.6-r3" "brotli-libs>=1.2.1-r0" "libcrypto3>=3.5.9-r1" "libssl3>=3.5.9-r1" "libxml2>=2.13.9-r3" \
    && apk del --no-network curl
ARG VITE_IDENTITY_URL=http://localhost:8082
COPY nginx.conf /tmp/nginx.conf.template
# La CSP y el cliente usan la misma dirección; se conservan las variables de nginx.
RUN VITE_IDENTITY_URL="$VITE_IDENTITY_URL" envsubst '${VITE_IDENTITY_URL}' < /tmp/nginx.conf.template > /etc/nginx/conf.d/default.conf \
    && rm /tmp/nginx.conf.template
USER 101
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
