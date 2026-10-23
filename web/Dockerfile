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
# curl no se usa al arrancar ni servir el portal; retirarlo elimina también libcurl vulnerable.
RUN apk add --no-cache "tiff>=4.7.2-r0" "zlib>=1.3.2-r1" "libexpat>=2.9.0-r0" "libx11>=1.8.14-r0" "musl>=1.2.6-r3" "musl-utils>=1.2.6-r3" \
    && apk del --no-network curl
ARG VITE_IDENTITY_URL=http://localhost:8082
COPY nginx.conf /tmp/nginx.conf.template
# La CSP y el cliente usan la misma dirección; se conservan las variables de nginx.
RUN VITE_IDENTITY_URL="$VITE_IDENTITY_URL" envsubst '${VITE_IDENTITY_URL}' < /tmp/nginx.conf.template > /etc/nginx/conf.d/default.conf \
    && rm /tmp/nginx.conf.template
USER 101
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
