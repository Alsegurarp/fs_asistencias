# Control Jornada 40 Horas

Plataforma de control de jornada desarrollada por Fast Solutions.

## Estado técnico

Monorepo inicial del producto. El primer corte contiene el esqueleto ejecutable
del backend y del portal web, contratos y migraciones. Los directorios `android/`
y `connector/` reservan la integración del avance móvil existente y no deben
recibir una implementación paralela antes de inventariarlo.

## Módulos

- `backend/`: API Kotlin/JVM con Spring Boot.
- `web/`: portal React y TypeScript.
- `android/`: punto de integración de la aplicación Kotlin existente.
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
- El flujo inicial está definido en `Dockerfile`, `web/Dockerfile` y
  `compose.yaml`.
- Android se compilará en contenedor después de integrar y fijar el toolchain
  existente.

## Commits

Usa Conventional Commits con mensajes detallados en español, por ejemplo `feat(auth): agrega inicio de sesión`. Las ramas usan `tipo/descripcion-kebab-case`.
