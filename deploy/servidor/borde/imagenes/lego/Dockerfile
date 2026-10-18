# Emisión y renovación de certificados con lego, recompilado con las
# correcciones de seguridad de Go y x/net. La imagen final sólo lleva el
# ejecutable, los certificados raíz y busybox para el ciclo de renovación.
FROM golang:1.27.2-alpine3.24@sha256:f92b6ef800e499660581efdabdf25d9d817a9d124eaf900924f0504e7e27e12d AS lego-builder
ARG LEGO_VERSION=v5.5.2
ARG X_NET_VERSION=v0.60.0
ENV CGO_ENABLED=0 \
    GOTOOLCHAIN=local
WORKDIR /src
RUN go mod init fastsolution.local/lego-build \
    && go get "github.com/go-acme/lego/v5@${LEGO_VERSION}" \
        "golang.org/x/net@${X_NET_VERSION}" \
    && go mod verify \
    && mkdir -p /out \
    && go build -buildvcs=false -trimpath \
        -ldflags="-s -w -buildid= -X main.version=${LEGO_VERSION}" \
        -o /out/lego github.com/go-acme/lego/v5 \
    && cp "/go/pkg/mod/github.com/go-acme/lego/v5@${LEGO_VERSION}/LICENSE" /out/LICENSE-lego

FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates
COPY --from=lego-builder /out/lego /usr/local/bin/lego
COPY --from=lego-builder /out/LICENSE-lego /usr/share/licenses/lego/LICENSE
USER 101:101
ENTRYPOINT ["/usr/local/bin/lego"]
