# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Zenit (fastSolution) es una plataforma de control de jornada: captura de
marcajes por NFC/lector, cálculo de la semana, incidencias, cierres con acuse
del empleado, exportes y expediente íntegro. Todo el proyecto (código,
documentación, commits) está en español.

## Regla de entorno: sólo Docker

El host sólo tiene Docker, Compose, Git y el editor. **No se instalan JDK,
Node, pnpm, Gradle ni SDK de Android en el host**: compilar, probar, migrar y
lintear se hace en contenedores. Excepción: los guiones `node --test` de
`infra/` se corren con el Node del runner en CI.

## Comandos

```powershell
# Primera vez: secretos locales en secrets/ (Git los ignora); repetible
docker compose --profile setup run --rm secrets-init
# Levantar todo (portal :8081, API :8080/actuator/health, Keycloak :8082/realms/zenit)
docker compose up --build
# Empezar de cero: docker compose down -v  y vaciar secrets/

# Backend: las unitarias corren dentro de `docker build` (etapa build del Dockerfile raíz)
# Integración contra PostgreSQL desechable, y retirar esa base después
docker compose --profile test run --rm --build backend-it
docker compose --profile test down db-it backend-it

# Una sola clase de integración (sustituye el CMD de la etapa `it`)
docker compose --profile test run --rm --build backend-it gradle :backend:integrationTest --no-daemon --offline --tests "mx.fastsolution.zenit.workday.WorkdayIT"
# Una sola unitaria
docker compose --profile test run --rm --build backend-it gradle :backend:test --no-daemon --offline --tests "<Clase>"

# Portal (web/): compilar y probar sin red; pnpm lint = tsc -b
docker build --target build --tag zenit-web-check web
docker run --rm --network none zenit-web-check pnpm test
docker run --rm --network none zenit-web-check pnpm exec vitest run src/Closures.test.tsx

# Android: pruebas, lint y APK de depuración dentro de la imagen
docker build --file android/Dockerfile android

# Contrato y secretos (correr antes de cada push: el repo es público)
docker compose --profile tools run --rm contract-lint
docker compose --profile tools run --rm secret-scan

# Keycloak (realm)
node --test infra/keycloak/realm.test.mjs
```

Otras herramientas (`device-sim`, `backup*`, `sbom`, `vuln-scan`) están en la
tabla de "Herramientas de operación" del README y en `docs/entorno-local.md`.
CI (`.github/workflows/verificaciones.yml`) corre backend+Keycloak, portal,
Android y contrato/seguridad/imágenes con exactamente estos comandos.

## Arquitectura

- `contracts/openapi.yaml` es **la frontera** entre backend, portal y app, y
  lleva versión (subirla al cambiarlo). `ContractCheck` valida cada respuesta
  y cada petición aceptada en las pruebas de integración contra el esquema, y
  `ContractCoverageIT` (corre al final) exige que las rutas del backend sean
  exactamente las operaciones del contrato y que cada una se haya ejercitado.
  Contrato y código cambian en el mismo commit.
- `backend/`: un solo servicio Spring Boot 4 / Kotlin / JDK 25, jOOQ con SQL
  en texto, Flyway, PostgreSQL 18. Sin broker ni caché: el trabajo diferido va
  por la tabla de trabajos (`jobs`). Un paquete por tema en
  `backend/src/main/kotlin/mx/fastsolution/zenit/`; cada archivo junta tipos,
  acceso a datos, servicio y controlador del tema. Conjuntos de fuentes
  aparte: `src/simulator/` (simulador de dispositivo, sólo habla por el API) y
  `src/dossierVerifier/` (verificador del expediente).
- Identidad: personas entran por Keycloak (realm en
  `infra/keycloak/realm/zenit-realm.json`, sin secretos); los dispositivos no
  usan Keycloak, firman con su propia clave. `CurrentPerson` resuelve persona,
  empresa y roles desde el token.
- Migraciones: el servicio `migrate` (rol `zenit_migrator`) las aplica y
  termina con `Exited (0)`; el backend (rol `zenit_app`) **no cambia el
  esquema** y no arranca si falta una.
- `web/`: React 19 + TypeScript + Vite + MUI + TanStack Query + keycloak-js,
  pnpm. Archivos planos en `web/src/`: cada pantalla `X.tsx` con su lógica pura
  en `xModel.ts` y pruebas `*.test.ts(x)` al lado.
- `android/`: proyecto Gradle independiente (Kotlin/Compose), captura NFC,
  ubicación puntual y cola local; modalidades terminal y personal.
- `infra/` (Postgres, Keycloak, guiones), `deploy/servidor/` (despliegue),
  `connector/` (futuro agente saliente, vacío).

## Reglas del backend que no se rompen

(Detalle en `docs/continuar-el-backend.md`.)

1. Negar por defecto: una ruta no abierta en `SecurityConfig` responde 401/403.
   Sus roles coinciden con `x-roles` del contrato.
2. La empresa sale de quien llama (`CurrentPerson` o el dispositivo), nunca
   del cuerpo ni de la ruta. Toda consulta filtra por `tenant_id`.
3. Lo de otra empresa responde **404**, nunca 403.
4. Toda tabla de empresa lleva `tenant_id`, también en sus llaves foráneas.
   Cada migración que crea tabla termina con su `GRANT` mínimo a `zenit_app`
   (que no hereda permisos). La evidencia (`attendance_event`, `audit_log`,
   ajustes, acuses) sólo se inserta; `rule_set` sólo se lee.
5. Una migración aplicada no se edita: archivo nuevo `VNNN__descripcion.sql`
   en `backend/src/main/resources/db/migration/`.
6. Nada sensible en logs ni bitácora (tokens, correos, nombres, motivos,
   cuerpos); de un error se guarda su clase, no su mensaje.
7. Texto en español con orden alfabético pide `COLLATE "es-x-icu"` explícito
   (la base ordena con `C.UTF-8`).

Agregar una ruta: contrato → migración (si aplica) → código (`Checks` para
validar, `Problems` para errores, `AuditLog` para acciones administrativas) →
`SecurityConfig` → pruebas → documentación, todo en el mismo commit.

## Pruebas de integración

- Llevan `@Tag("integration")` (la tarea `test` las excluye). Cada una prueba
  también lo que debe fallar.
- Bases: `ApiTestBase` (llamadas, tokens firmados con clave de prueba, crear
  empresas/personas), `CaptureTestBase` (simula el dispositivo),
  `WorkdayTestBase` (semana ya terminada). Clase por tema: `ApiIT`,
  `DirectoryIT`, `CaptureIT`, `WorkdayIT`, `ClosureRunsIT`, `AdministrationIT`,
  `ExportsIT`, `JobsIT`, `QuotaIT`, `DatabaseRolesIT`.
- Una ruta nueva agrega su fila en la matriz de roles (401 sin credencial, 403
  a quien no le toca) y su caso de aislamiento entre dos empresas; una tabla
  nueva, su caso en `DatabaseRolesIT`.
- `zenit.jobs.enabled` va apagado: la prueba llama a `jobWorker` cuando le
  toca. El paso del tiempo se simula moviendo fechas en la base.

## Documentación y commits

- `docs/` es extensa y se mantiene al día con el código (README y docs en el
  mismo commit). Puntos de entrada: `docs/README.md`,
  `docs/logica-de-negocio.md` (reglas), `docs/estado-y-pendientes.md`
  (qué falta; su sección «Pendientes del MVP» es la vigente) y
  `docs/bitacora-trabajo.md` (la entrada más nueva va arriba).
  `docs/tareas-criticas-primero.md` y `docs/TareasPendientes.md` son cortes
  históricos de antes del MVP.
- Datos de ejemplo siempre ficticios (dominio `.invalid`). Un ejemplo con forma
  de token reutiliza la firma de muestra exceptuada en `.gitleaks.toml`; no se
  exceptúan archivos completos. Vulnerabilidades aceptadas van en
  `.grype.yaml` con motivo, alcance y fecha de revisión.
- Conventional Commits con mensaje detallado en español
  (`feat(auth): agrega inicio de sesión`); ramas `tipo/descripcion-kebab-case`.
