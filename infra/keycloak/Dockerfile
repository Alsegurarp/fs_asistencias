# Java 25 recibe el CPU de octubre y el bloqueo de certificados eMudhra.
# La imagen oficial aún incluye Java 21 y certificados vulnerables de UBI.
ARG TARGETARCH
FROM registry.access.redhat.com/ubi9:9.8@sha256:16e9e43d99e181463513cc84a514859b1abb9460f1c4d9e208da4b4e51cd5cc3 AS system
RUN mkdir /mnt/rootfs && \
    dnf install --installroot /mnt/rootfs --releasever 9 --setopt=install_weak_deps=false --nodocs -y \
        bash coreutils-single glibc-langpack-en grep sed findutils zlib tar gzip && \
    dnf --installroot /mnt/rootfs clean all && \
    printf 'keycloak:x:1000:0:Keycloak:/opt/keycloak:/sbin/nologin\n' >> /mnt/rootfs/etc/passwd

FROM scratch AS base
COPY --from=system /mnt/rootfs/ /

FROM base AS java-amd64
ADD --checksum=sha256:d430d3f9e91435d2d58d366b1dabf14b23fcf8629ed4b041757c1be444055946 https://download.oracle.com/java/25/archive/jdk-25.0.5.0.2_linux-x64_bin.tar.gz /tmp/java.tar.gz

FROM base AS java-arm64
ADD --checksum=sha256:070ae2ee07120a5b0dafac4d40f68eec356f2c1707fba940676f0b358ca269c2 https://download.oracle.com/java/25/archive/jdk-25.0.5.0.2_linux-aarch64_bin.tar.gz /tmp/java.tar.gz

FROM java-${TARGETARCH} AS java
RUN mkdir /opt/java && tar -xzf /tmp/java.tar.gz -C /opt/java --strip-components=1

FROM quay.io/keycloak/keycloak:26.8.1@sha256:79c623a22abacf3fe6c00a5fb30f5b7843d717b234033b80995891c06116d244 AS keycloak

FROM base AS runtime
ENV JAVA_HOME=/opt/java \
    PATH=/opt/java/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LANG=en_US.UTF-8 \
    KC_RUN_IN_CONTAINER=true
COPY --from=java /opt/java/ /opt/java/
USER 1000

# El motor y la sonda quedan fijados al construir con el mismo Java del runtime.
FROM runtime AS build
ENV KC_DB=postgres KC_HEALTH_ENABLED=true
COPY --from=keycloak --chown=1000:0 /opt/keycloak/ /opt/keycloak/
RUN /opt/keycloak/bin/kc.sh build

FROM runtime
COPY --from=build --chown=1000:0 /opt/keycloak/ /opt/keycloak/
# Definición del realm. No lleva claves, secretos ni usuarios.
COPY --chown=1000:0 realm/ /opt/keycloak/data/import/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
