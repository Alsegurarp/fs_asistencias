FROM gradle:9.2.1-jdk25-alpine AS build
WORKDIR /workspace

COPY settings.gradle.kts build.gradle.kts gradle.properties ./
COPY backend/build.gradle.kts backend/build.gradle.kts
RUN gradle :backend:dependencies --no-daemon

COPY backend backend
RUN gradle :backend:test :backend:bootJar --no-daemon

FROM eclipse-temurin:25.0.1_8-jre-alpine
RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/backend/build/libs/backend.jar /app/app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
