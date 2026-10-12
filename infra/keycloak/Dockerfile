# Imagen optimizada del proveedor de identidad. El motor de base y la sonda de
# salud se fijan al construir: así arranca sin recompilar y admite un sistema
# de archivos de sólo lectura.
FROM quay.io/keycloak/keycloak:26.8.0@sha256:27b3230fbabb8c9ff3c66c864cf09dcd8a41aca82e5100679d109ef0eeb05741 AS build
ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.8.0@sha256:27b3230fbabb8c9ff3c66c864cf09dcd8a41aca82e5100679d109ef0eeb05741
COPY --from=build /opt/keycloak/ /opt/keycloak/
# Definición del realm. No lleva claves, secretos ni usuarios.
COPY realm/ /opt/keycloak/data/import/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
