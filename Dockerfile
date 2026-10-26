FROM gradle:9.8.1-jdk25-alpine@sha256:88b059d39a3971709550fc721c029b0c54ab785dfe4fa4169ae04017cf2c22a4 AS build
# La caché de Gradle va fuera del volumen que declara la imagen base: así las
# pruebas de integración la reutilizan sin red y sin capacidades de Linux.
ENV GRADLE_USER_HOME=/gradle-home
WORKDIR /workspace

COPY settings.gradle.kts build.gradle.kts gradle.properties ./
COPY backend/build.gradle.kts backend/build.gradle.kts
RUN gradle :backend:dependencies --no-daemon

# El contrato entra a la etapa de pruebas: las de integración validan contra él.
COPY contracts contracts
COPY backend backend
# El simulador de dispositivo se compila aquí para que su error, si lo hay, salga al construir.
RUN gradle :backend:test :backend:bootJar :backend:simulatorClasses --no-daemon

# Pruebas contra PostgreSQL real. No forma parte de la imagen que se ejecuta:
# la usa docker compose con el perfil test.
FROM build AS it
CMD ["gradle", ":backend:integrationTest", "--no-daemon", "--offline"]

FROM eclipse-temurin:25.0.4.1_1-jre-alpine-3.24@sha256:3c0a9084927a221ccd1d007fcaf614465672c0af37aaa834c5184483afe56d61
# Paquetes del sistema con vulnerabilidades ya corregidas, que la imagen
# base todavía no trae. Se quita cuando la imagen base los incluya.
RUN apk add --no-cache "zlib>=1.3.2-r1" "openssl>=3.5.9-r0" "libcrypto3>=3.5.9-r0" "libssl3>=3.5.9-r0" "libpng>=1.6.59-r0" "libexpat>=2.9.0-r0" "brotli-libs>=1.2.1-r0"
RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/backend/build/libs/backend.jar /app/app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
