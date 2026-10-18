# Borde de fastSolution: nginx oficial sin privilegios, con el usuario 101.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24@sha256:782bb89768cc87b7f95c18b95baa1af250e5d451f26794f59363540161147c01
# Paquete del sistema con una vulnerabilidad alta ya corregida que la imagen
# base todavía no trae. Se quita cuando la imagen base lo incluya.
USER root
RUN apk add --no-cache "zlib>=1.3.2-r1"
USER 101
