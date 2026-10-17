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

# age 1.3.2 se recompila con las correcciones de seguridad de Go y x/crypto.
# La etapa final recibe sólo los dos ejecutables que usa el respaldo.
FROM golang:1.27.2-alpine3.24@sha256:f92b6ef800e499660581efdabdf25d9d817a9d124eaf900924f0504e7e27e12d AS age-builder
ARG AGE_VERSION=v1.3.2
ARG X_CRYPTO_VERSION=v0.56.0
ENV CGO_ENABLED=0 \
    GOTOOLCHAIN=local
WORKDIR /src
RUN go mod init zenit.local/age-build \
    && go get "filippo.io/age/cmd/age@${AGE_VERSION}" \
        "filippo.io/age/cmd/age-keygen@${AGE_VERSION}" \
        "golang.org/x/crypto@${X_CRYPTO_VERSION}" \
    && go mod verify \
    && mkdir -p /out \
    && go build -buildvcs=false -trimpath -ldflags="-s -w -buildid=" \
        -o /out/age filippo.io/age/cmd/age \
    && go build -buildvcs=false -trimpath -ldflags="-s -w -buildid=" \
        -o /out/age-keygen filippo.io/age/cmd/age-keygen \
    && cp "/go/pkg/mod/filippo.io/age@${AGE_VERSION}/LICENSE" /out/LICENSE-age

# Sólo las herramientas de respaldo necesitan cifrado; la base conserva su imagen.
FROM database AS backup-tools
USER root
RUN mkdir -p /work /backups /usr/share/licenses/age \
    && chown postgres:postgres /work /backups
COPY --from=age-builder /out/age /out/age-keygen /usr/local/bin/
COPY --from=age-builder /out/LICENSE-age /usr/share/licenses/age/LICENSE
COPY backup /opt/zenit
USER postgres
