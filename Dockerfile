FROM gradle:9.8.1-jdk25-alpine@sha256:88b059d39a3971709550fc721c029b0c54ab785dfe4fa4169ae04017cf2c22a4 AS build
# La caché de Gradle va fuera del volumen que declara la imagen base: así las
# pruebas de integración la reutilizan sin red y sin capacidades de Linux.
ENV GRADLE_USER_HOME=/gradle-home
WORKDIR /workspace

COPY settings.gradle.kts build.gradle.kts gradle.properties ./
COPY backend/build.gradle.kts backend/build.gradle.kts
# Maven Central y el portal de plugins a veces responden que no existe un
# artefacto que sí existe (CI del 27 de noviembre: kotlin-gradle-plugins-bom,
# spring-core y commons-compress). Ante una falla de red la descarga se repite
# una vez en 30 s, como en android/Dockerfile. La segunda vuelta lleva
# --refresh-dependencies porque Gradle recuerda lo que no encontró. Si
# vuelve a fallar, la falla es real.
RUN set -o pipefail; \
    network='Could not (resolve|GET|HEAD|download)|Connection reset|Connect timed out|Read timed out|Remote host terminated the handshake|Received status code (429|5[0-9][0-9])'; \
    refresh=''; \
    for attempt in 1 2; do \
        if gradle :backend:dependencies --no-daemon $refresh 2>&1 | tee /tmp/gradle.log; then rm -f /tmp/gradle.log; exit 0; fi; \
        if [ "$attempt" = 1 ] && grep -qiE "$network" /tmp/gradle.log; then \
            echo 'Falla de red al descargar; se repite una vez en 30 s.'; sleep 30; refresh='--refresh-dependencies'; continue; \
        fi; \
        exit 1; \
    done

# El contrato entra a la etapa de pruebas: las de integración validan contra él.
COPY contracts contracts
COPY backend backend
# El simulador de dispositivo se compila aquí para que su error, si lo hay, salga al construir.
RUN gradle :backend:test :backend:bootJar :backend:simulatorClasses :backend:dossierVerifierJar --no-daemon

# Pruebas contra PostgreSQL real. No forma parte de la imagen que se ejecuta:
# la usa docker compose con el perfil test.
FROM build AS it
CMD ["gradle", ":backend:integrationTest", "--no-daemon", "--offline"]

FROM eclipse-temurin:25.0.5.1_2-jre-alpine-3.24@sha256:69c2a26e9894016e274c880fa542956d005b3755f84db765145185e87405bd89
# Paquetes del sistema con vulnerabilidades ya corregidas, que la imagen
# base todavía no trae. Se quita cuando la imagen base los incluya.
RUN apk add --no-cache "zlib>=1.4-r0" "openssl>=3.5.9-r1" "libcrypto3>=3.5.9-r1" "libssl3>=3.5.9-r1" "libpng>=1.6.59-r0" "libexpat>=2.10.0-r0" "brotli-libs>=1.2.1-r0" "musl>=1.2.6-r3" "musl-utils>=1.2.6-r3"
RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/backend/build/libs/backend.jar /app/app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
