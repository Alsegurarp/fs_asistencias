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

El primer comando genera una sola vez los secretos locales en `secrets/`, que
Git ignora; se puede repetir y sólo crea los que falten. Entre ellos deja
vacío `secrets/operator_emails`: para dar de alta una empresa hay que escribir
ahí el correo de quien opera y volver a levantar el backend. Copiar
`.env.example` a `.env` es opcional: sólo hace falta para cambiar puertos,
nombres o direcciones.

- Portal: `http://localhost:8081`
- Estado de API: `http://localhost:8080/actuator/health`
- Identidad: `http://localhost:8082/realms/zenit`

Al levantar, el servicio `migrate` aplica las migraciones y termina; el backend
espera a que acabe bien. Es normal verlo como `Exited (0)`.

Para empezar de cero: `docker compose down -v` y borrar el contenido de
`secrets/`. Quien ya tenía el entorno debe hacerlo una vez, porque los roles de
la base y la base de identidad se crean al inicializar el volumen.

## Base de datos

Cada conexión usa el rol con menos permisos que le sirve.

| Rol | Quién lo usa | Qué puede |
| --- | --- | --- |
| `zenit_admin` | Nadie: sólo inicializa el volumen | Administra la instancia |
| `zenit_migrator` | El servicio `migrate` | Es dueño del esquema y lo cambia |
| `zenit_app` | El backend al atender | Lee y escribe sólo lo que una migración le abrió |
| `keycloak_app` | El proveedor de identidad | Su propia base; no entra a la del producto |

- El backend no cambia el esquema. Al arrancar comprueba que esté al día y, si
  falta una migración o no puede conectarse, no arranca.
- `zenit_app` no hereda permisos. Cada migración que crea una tabla termina con
  su `GRANT`, y sólo con las operaciones que hacen falta: una tabla sin `GRANT`
  no se puede leer desde el backend.
- La evidencia sólo se agrega. Sobre `attendance_event` y `audit_log` el
  backend puede insertar y leer, no corregir ni borrar.
- Toda tabla de una empresa lleva `tenant_id`, y sus llaves foráneas lo
  incluyen: un registro no puede apuntar a datos de otra empresa.
- Una migración aplicada no se edita. Un cambio va en un archivo nuevo en
  `backend/src/main/resources/db/migration/`.

## Pruebas

Las pruebas unitarias corren al construir la imagen del backend. Las de
integración usan una base PostgreSQL desechable, inicializada igual que la real:

```powershell
docker compose --profile test run --rm --build backend-it
docker compose --profile test down db-it backend-it
```

El segundo comando retira la base de pruebas sin tocar el entorno levantado.
Una prueba de integración lleva `@Tag("integration")` y comprueba también lo
que debe fallar: el caso negativo es parte de la prueba.

`ApiIT`, `DirectoryIT` y `CaptureIT` recorren el API por HTTP con dos empresas
y tokens firmados por una clave de prueba, que el backend valida como los del
proveedor de identidad. Comparten `ApiTestBase`. `CaptureTestBase` simula lo
que hace la app: genera su clave, se activa, firma su aserción y firma cada
marcaje. Una ruta nueva agrega su caso de aislamiento entre empresas y su fila
en la matriz de roles.

## Identidad

El inicio de sesión de las personas lo hace Keycloak, no el backend. Los
dispositivos no lo usan: se identifican con su propia clave.

- El realm `zenit` se importa de `infra/keycloak/realm/zenit-realm.json` la
  primera vez. Ese archivo no lleva claves, secretos ni usuarios: las claves
  de firma se generan en cada instalación.
- Toda cuenta nueva debe configurar un segundo factor en su primera entrada.
  El registro abierto y la concesión directa por contraseña están apagados, y
  cinco intentos fallidos bloquean la cuenta por un tiempo.
- El portal se identifica como `zenit-portal`, con PKCE. Sus tokens duran
  cinco minutos y llevan la audiencia `zenit-api`.
- El backend niega todo por defecto. Sin credencial sólo responden el estado
  del sistema y la salud; `/api/v1/me` pide un token válido. Una ruta nueva se
  abre de forma explícita en `SecurityConfig`: mientras no esté ahí responde
  401 sin token y 403 con él.
- Un token se acepta si su firma, su vigencia, su emisor y su audiencia son
  correctos. Los rechazos responden con el formato de error del contrato y sin
  decir el motivo.
- La consola de administración está en `http://localhost:8082/admin`. La
  cuenta `arranque` es temporal y su contraseña está en
  `secrets/keycloak_admin_password`; se sustituye por cuentas personales.
- El archivo del realm sólo se lee cuando el realm no existe. Un cambio se
  hace en la consola de una instalación limpia, se exporta con `kc.sh export`
  y se le quitan las claves antes de versionarlo.
- El correo de una cuenta sólo lo cambia la administración del realm, no la
  propia persona: el backend liga a cada quien por su correo verificado.

## Empresas, personas y roles

El token dice quién es la persona; su empresa y sus roles salen de la base.

- Una persona pertenece a una sola empresa: su correo y su cuenta no se
  repiten entre empresas.
- Quien opera el servicio da de alta cada empresa con `POST /api/v1/tenants`
  y en la misma petición nombra, por correo, a quien la administrará. Los
  operadores son la lista de correos de `secrets/operator_emails`, uno por
  línea. Ese archivo nace vacío: mientras lo esté, nadie puede dar de alta
  una empresa. Un operador no entra a los datos de ninguna empresa.
- Quien administra una empresa invita al resto con `POST /api/v1/users` y les
  da roles. La cuenta de cada persona se crea aparte, en la consola de
  identidad, con ese mismo correo marcado como verificado.
- La primera vez que alguien entra con un correo invitado y verificado queda
  ligado a su invitación. Un correo sin verificar no liga a nadie, y una
  invitación ya ligada no la toma otra cuenta.
- Toda consulta lleva la empresa de quien llama. Lo de otra empresa responde
  404, y una empresa no puede quedarse sin nadie que la administre.
- Altas, invitaciones, cambios de rol y de acceso quedan en la bitácora, que
  se lee en `GET /api/v1/audit-log`. Los rechazos por permiso quedan en los
  registros del backend, con el identificador de correlación de la respuesta.
- Una ruta nueva se abre en `SecurityConfig` con los mismos roles que el
  contrato declara en `x-roles`, y lee la empresa de `CurrentPerson`, nunca
  del cuerpo ni de la ruta.

## Padrón, sedes, horarios y tarjetas

Todo es de una empresa y se consulta con la empresa de quien llama.

- Nada se borra. Una sede se desactiva, una persona se da de baja y una
  tarjeta se revoca; el rol de la base con el que atiende el backend no tiene
  permiso de borrar en estas tablas.
- Un horario no se edita: para cambiarlo se crea otro con una vigencia nueva y
  se asigna desde una fecha. Asignarlo cierra el anterior el día previo.
- Una persona es única por su identificador externo dentro de la empresa. Al
  cambiarla, un campo que no se manda queda igual; `siteId` o `employmentEnd`
  en nulo lo borran.
- Importación CSV, plantilla 1: `external_id,display_name,employment_start,site_name`,
  en UTF-8, hasta 1 MB y 5000 filas. Sin indicar `dryRun=false` sólo valida.
  Repetir un archivo no duplica a nadie, y la misma `Idempotency-Key` devuelve
  el mismo resultado sin volver a aplicar. El archivo no se guarda: quedan su
  huella, los conteos y las filas rechazadas.
- Una tarjeta entra al inventario con su número impreso y su huella. La huella
  no sale en ninguna respuesta ni en la bitácora. Sólo se asigna una tarjeta
  del inventario: la que ya tuvo titular no pasa a otra persona. Asignar una
  segunda tarjeta a alguien reemplaza la anterior en la misma operación.
- Cambiar los encabezados del CSV sube `TEMPLATE_VERSION` en `ImportService`
  y se documenta en el contrato.

## Dispositivos y captura

Un dispositivo no tiene cuenta ni contraseña: se identifica con su propia
clave.

- Quien administra o lleva recursos humanos emite un código de un solo uso,
  que vale 15 minutos y fija la modalidad: `personal`, ligado a una persona, o
  `terminal`, ligado a una sede. El servidor guarda la huella del código, no
  el código.
- El dispositivo genera una clave P-256, la registra al activar y demuestra
  que la posee firmando el código. La clave privada nunca viaja. El teléfono
  nuevo de una persona cierra el anterior en la misma operación.
- Cada petición del dispositivo lleva una aserción ES256 que él mismo firma,
  dirigida a `zenit-capture` y con vida de hasta dos minutos. No hay token de
  dispositivo emitido por el servidor. La credencial de una persona no sirve
  en las rutas de dispositivo, ni al revés.
- Cada marcaje viaja como un sobre firmado. El servidor lo guarda tal como
  llegó, con su huella. Marcajes, coordenadas, incidencias y rechazos sólo se
  agregan: el rol de la base que atiende no puede corregirlos ni borrarlos.
- La misma clave de idempotencia devuelve el mismo recibo. Lo que no cuadra
  con la tarjeta, la firma o la sesión se rechaza con recibo y no se
  reintenta; lo que es dudoso se acepta y abre una incidencia.
- La coordenada se queda en la base. El portal recibe el veredicto de
  ubicación y la precisión.
- El esquema real de la tarjeta todavía no se verifica. La tarjeta simulada,
  `uid_sha256`, no está autenticada y nace apagada: para probar la app en
  local, con datos ficticios, se pone `CAPTURE_SIMULATED_CARDS=true` en
  `.env`. Ahí la prueba de la tarjeta es la huella con la que se registró.
- Las reglas viven en `CaptureRules.kt` y sus valores en `CaptureProperties`.
  La cuota de intentos se lleva en memoria: vale para una sola instancia.

## Seguridad del entorno local

El entorno local sigue las mismas reglas que tendrá un ambiente publicado.

- Ninguna contraseña tiene valor por defecto ni viaja como variable de entorno:
  se monta como archivo. Sin ese archivo, la base y el backend no arrancan.
- Cada servicio recibe sólo la contraseña de su rol: el backend no tiene la del
  dueño del esquema ni la del administrador de la instancia.
- Los puertos se publican sólo en `127.0.0.1`. Para probar desde un teléfono
  conectado por USB se usa `adb reverse`; `BIND_ADDRESS` permite cambiarlo.
- La base no publica puerto y vive en una red sin salida que sólo comparte con
  el backend, el paso de migraciones y el proveedor de identidad. El portal no
  la alcanza. La identidad usa su propia base y su propio rol, que no entra a
  la del producto.
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
repositorio es público. Sus reglas están en `.gitleaks.toml`, que sólo
exceptúa dos valores ficticios de los ejemplos del contrato: la firma de
muestra y una clave de idempotencia. Un ejemplo nuevo con forma de token
reutiliza esa firma; no se exceptúan archivos completos.

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
