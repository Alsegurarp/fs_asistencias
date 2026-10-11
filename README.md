# Control Jornada 40 Horas

Plataforma de control de jornada desarrollada por Fast Solutions.

## Estado técnico

Monorepo inicial del producto. El primer corte contiene esqueletos ejecutables
del backend, el portal web y la aplicación Android, además de contratos y
migraciones. Cada aplicación mantiene toolchain, dependencias y build propios.

## Módulos

- `backend/`: API Kotlin/JVM con Spring Boot.
- `web/`: portal React y TypeScript.
- `android/`: aplicación Kotlin/Compose para captura NFC, ubicación puntual y
  cola local.
- `connector/`: futuro agente saliente para redes de clientes.
- `contracts/`: contrato OpenAPI ejecutable.
- `infra/`: configuración técnica que no pertenece a una aplicación.

## Arranque local

```powershell
Copy-Item .env.example .env
docker compose up --build
```

- Portal: `http://localhost:8081`
- Estado de API: `http://localhost:8080/actuator/health`

## Desarrollo exclusivamente con Docker

- El host se utiliza únicamente para Docker, Docker Compose, Git y el editor.
- No se instalan runtimes, SDK, gestores de paquetes, dependencias, bases de datos ni herramientas del proyecto en el host.
- Compilación, desarrollo, migraciones, lint, pruebas y artefactos se ejecutan dentro de contenedores.
- El flujo inicial está definido en `Dockerfile`, `web/Dockerfile`,
  `android/Dockerfile` y `compose.yaml`.
- Android es un proyecto Gradle independiente; su imagen ejecuta pruebas, lint y
  ensambla el APK de depuración sin instalar el SDK en el host.

```powershell
docker build --file android/Dockerfile android
```

## Commits

Usa Conventional Commits con mensajes detallados en español, por ejemplo `feat(auth): agrega inicio de sesión`. Las ramas usan `tipo/descripcion-kebab-case`.
