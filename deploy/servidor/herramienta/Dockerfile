# Herramienta de despliegue: SSH, rsync y curl en un contenedor efímero, para
# que la estación sólo necesite Git y Docker. No lleva destinos, llaves ni
# código: el perfil SSH y el árbol a subir se montan al correr.
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk upgrade --no-cache \
    && apk add --no-cache \
        "bash=5.3.9-r1" \
        "curl=8.22.0-r0" \
        "openssh-client-default=10.3_p1-r1" \
        "rsync=3.5.0-r0" \
        ca-certificates \
    && adduser -D -u 10001 -h /home/deploy deploy
COPY --chmod=0755 entrada.sh /usr/local/bin/herramienta
USER 10001:10001
WORKDIR /home/deploy
ENTRYPOINT ["/usr/local/bin/herramienta"]
