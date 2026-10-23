# Herramienta de despliegue: SSH, rsync y curl en un contenedor efímero, para
# que la estación sólo necesite Git y Docker. No lleva destinos, llaves ni
# código: el perfil SSH y el árbol a subir se montan al correr.
# shortcut: compila curl sin libssh2 vulnerable; volver al APK cuando Alpine estable lo corrija.
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS curl-build
RUN apk add --no-cache build-base openssl-dev zlib-dev \
    && wget -q https://curl.se/download/curl-8.23.0.tar.xz -O /tmp/curl.tar.xz \
    && echo "8dadd7d2536a314f982ad05a651b713f426bf7d02cc2c76cffb9796f2218e6c5  /tmp/curl.tar.xz" | sha256sum -c - \
    && mkdir /tmp/curl \
    && tar -xJf /tmp/curl.tar.xz -C /tmp/curl --strip-components=1 \
    && cd /tmp/curl \
    && ./configure --with-openssl --disable-shared --without-libpsl --without-libssh2 \
        --with-ca-bundle=/etc/ssl/certs/ca-certificates.crt \
    && make -j2 \
    && strip src/curl

FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk upgrade --no-cache \
    && apk add --no-cache \
        "bash=5.3.9-r1" \
        "openssh-client-default=10.3_p1-r1" \
        "rsync=3.5.0-r0" \
        ca-certificates libssl3 libcrypto3 zlib \
    && adduser -D -u 10001 -h /home/deploy deploy
COPY --from=curl-build /tmp/curl/src/curl /usr/local/bin/curl
COPY --chmod=0755 entrada.sh /usr/local/bin/herramienta
USER 10001:10001
WORKDIR /home/deploy
ENTRYPOINT ["/usr/local/bin/herramienta"]
