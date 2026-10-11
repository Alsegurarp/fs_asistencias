# Zenit

Plataforma de control de jornada desarrollada por fastSolution.

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
docker compose --profile setup run --rm secrets-init
docker compose up --build
```

El primer comando genera una sola vez la contraseña local de la base en
`secrets/db_password`, que Git ignora. Copiar `.env.example` a `.env` es
opcional: sólo hace falta para cambiar puertos o nombres.

- Portal: `http://localhost:8081`
- Estado de API: `http://localhost:8080/actuator/health`

Para empezar de cero: `docker compose down -v` y borrar `secrets/db_password`.

## Seguridad del entorno local

El entorno local sigue las mismas reglas que tendrá un ambiente publicado.

- Ninguna contraseña tiene valor por defecto ni viaja como variable de entorno:
  se monta como archivo. Sin ese archivo, la base y el backend no arrancan.
- Los puertos se publican sólo en `127.0.0.1`. Para probar desde un teléfono
  conectado por USB se usa `adb reverse`; `BIND_ADDRESS` permite cambiarlo.
- La base no publica puerto y vive en una red sin salida que sólo comparte con
  el backend. El portal no la alcanza.
- Los contenedores corren sin usuario root, sin capacidades de Linux, sin
  privilegios nuevos, con el sistema de archivos en sólo lectura y con límites
  de memoria y de procesos.
- El backend sólo expone el estado de salud y no devuelve detalles internos en
  sus errores. El portal envía cabeceras de seguridad y una política de
  contenido.
- Las imágenes base llevan versión y digest. Al actualizar una se cambian los
  dos.

## Contrato y verificaciones

`contracts/openapi.yaml` describe el API completo del MVP y es la frontera
entre el backend, el portal y la app. Cada cuerpo lleva un ejemplo ficticio.

```powershell
docker compose --profile tools run --rm contract-lint
docker compose --profile tools run --rm secret-scan
```

El primero valida el contrato y sus ejemplos. El segundo busca secretos en todo
el historial de Git; conviene correrlo antes de cada push, porque el
repositorio es público.

El contrato se probó generando un cliente Kotlin con OpenAPI Generator 7.26.0
(Retrofit y kotlinx.serialization) y los tipos de TypeScript con
openapi-typescript 7.13.0; ambos compilan. En Kotlin hay que excluir
`infrastructure/ApiClient.kt` con `.openapi-generator-ignore`: el contrato
declara dos credenciales de tipo bearer y el generador duplica su ayudante. No
hace falta, porque la app firma su propia aserción con un interceptor.

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
