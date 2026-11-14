# Landing de Zenit (Next.js) para el servidor compartido.
#
# El repositorio de la landing sólo lleva la aplicación; cómo se construye y
# corre en el servidor vive aquí. El contexto de construcción es el árbol
# exportado de un commit de ese repositorio (ZENIT_LANDING_FUENTE en
# servidor.env). Dockerfile.dockerignore, junto a este archivo, deja fuera lo
# que la aplicación no necesita.
#
# Imagen base fijada por digest: la etiqueta puede apuntar a otros binarios
# en otro momento. Es la misma que usa el portal de Zenit.
FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# next/font descarga la tipografía al construir y la sirve desde el sitio.
RUN npm run build

FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
# Al correr sólo hace falta node: npm y corepack se retiran después de
# instalar, porque traen dependencias con vulnerabilidades que la aplicación
# no usa. apk upgrade toma las correcciones de Alpine que la base aún no trae.
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force \
    && apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /root/.npm
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
# La caché de imágenes optimizadas es el único lugar donde escribe: en el
# servidor es un tmpfs, porque el resto del sistema de archivos es de sólo
# lectura.
RUN rm -rf .next/cache && mkdir .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
