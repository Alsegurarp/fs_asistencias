# Zenit

Plataforma de control de jornada desarrollada por fastSolution.

## Estado técnico

Monorepo del producto. El backend atiende las 62 operaciones del contrato 0.13,
con 75 pruebas de integración PostgreSQL. El portal implementa inicio de sesión, sedes,
empleados, horarios y asignaciones, importación CSV, tarjetas, incidencias,
cierres, exportes, usuarios y configuración de empresa. A1–A4 añaden reactivación,
consulta semanal personal, recuperación de acuses y cambio obligatorio de
contraseña. Pasaron 162 pruebas del portal y su compilación; los ensayos de
horarios/importación por API HTTPS del 19 conservan su evidencia. Sigue el
recorrido público en navegador; los 33 casos A5 aprobaron localmente el 21
de octubre, con [acta y límites](docs/qa-a1-a5-2026-10-21.md). Android implementa
enrolamiento, sobres firmados y
sincronización con cola cifrada; el 19 de octubre se verificaron personal y
terminal en teléfono contra backend local y HTTPS publicado, con tarjetas
simuladas. La tarjeta autenticada real sigue pendiente. Cada aplicación mantiene
toolchain, dependencias y build propios.

Android debug también incluye una presentación independiente del producto,
con históricos y panel de Administrador/RH. Su alcance está en
[Producto móvil](docs/alcance-producto-movil.md).

## Documentación

La [bitácora](docs/bitacora-trabajo.md) registra las comprobaciones del 19 de
octubre y sus límites. [Tareas críticas primero](docs/tareas-criticas-primero.md)
declara el trabajo restante y las decisiones que requieren al usuario.

La carpeta [`docs/`](docs/README.md) explica qué hace el sistema, cómo se usa
y cómo se continúa:

| Para | Documento |
| --- | --- |
| Levantar el sistema y obtener un token | [Entorno local](docs/entorno-local.md) |
| Llenarlo de datos simulados, ensayar el respaldo y revisar vulnerabilidades | [Entorno local](docs/entorno-local.md) |
| Conocer el API de punta a punta | [Recorrido completo](docs/recorrido-completo.md) |
| Saber quién hace qué | [Casos de uso](docs/casos-de-uso.md) |
| Entender las reglas | [Lógica de negocio](docs/logica-de-negocio.md) |
| Llamar al API | [Consumir el API](docs/consumir-el-api.md) |
| Construir la app | [Guía de la app Android](docs/guia-app-android.md) |
| Construir el portal | [Guía del portal web](docs/guia-portal-web.md) |
| Buscar un término, un código o una tabla | [Diccionario](docs/diccionario.md) |
| Agregar algo al backend | [Continuar el backend](docs/continuar-el-backend.md) |
| Saber qué falta | [Estado y pendientes](docs/estado-y-pendientes.md) |
| Priorizar lo pendiente | [Tareas críticas primero](docs/tareas-criticas-primero.md) |
| Entender los flujos implementados y dónde nacen los datos | [Flujos PlantUML](docs/flujos/README.md) |

Este README resume las reglas de cada parte; el detalle está en esa carpeta, y
la referencia exacta de cada ruta en `contracts/openapi.yaml`.

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
`secrets/`.

Quien ya tenía el entorno debe recrear una vez su volumen local: la imagen de
PostgreSQL y la ordenación de textos cambiaron. El procedimiento y su efecto
sobre los datos ficticios están en
[Entorno local](docs/entorno-local.md#si-el-entorno-ya-existía).

## Base de datos

Cada conexión usa el rol con menos permisos que le sirve.

| Rol | Quién lo usa | Qué puede |
| --- | --- | --- |
| `zenit_admin` | Nadie: sólo inicializa el volumen | Administra la instancia |
| `zenit_migrator` | El servicio `migrate` | Es dueño del esquema y lo cambia |
| `zenit_app` | El backend al atender | Lee y escribe sólo lo que una migración le abrió |
| `keycloak_app` | El proveedor de identidad | Su propia base; no entra a la del producto |
| `zenit_backup` | El ensayo de respaldo | Lee las dos bases; no escribe ni cambia el esquema |

- El backend no cambia el esquema. Al arrancar comprueba que esté al día y, si
  falta una migración o no puede conectarse, no arranca.
- `zenit_app` no hereda permisos. Cada migración que crea una tabla termina con
  su `GRANT`, y sólo con las operaciones que hacen falta: una tabla sin `GRANT`
  no se puede leer desde el backend.
- La evidencia sólo se agrega. Sobre `attendance_event` y `audit_log` el
  backend puede insertar y leer, no corregir ni borrar. Lo mismo vale para un
  ajuste y para un acuse. De una incidencia y de un cierre sólo puede cambiar
  su atención y su estado, columna por columna: nunca lo que dicen. De un
  trabajo y de una corrida de cierre cambia su avance, y de un exporte su
  resultado: nunca lo que se pidió.
- Las reglas laborales (`rule_set`) sólo se leen. Cambian con una migración.
- Toda tabla de una empresa lleva `tenant_id`, y sus llaves foráneas lo
  incluyen: un registro no puede apuntar a datos de otra empresa.
- La imagen de PostgreSQL parte de la variante oficial sobre Alpine, pero
  arranca directamente sin root y sin capacidades. Las bases nuevas ordenan
  texto por código de carácter con `C.UTF-8`; una consulta que necesite orden
  alfabético en español pide `COLLATE "es-x-icu"` de forma explícita.
- Una migración aplicada no se edita. Un cambio va en un archivo nuevo en
  `backend/src/main/resources/db/migration/`.

## Pruebas

La configuración de identidad se comprueba con
`node --test infra/keycloak/realm.test.mjs`. El ensayo de importación en una
instancia aislada está en [Preparar el ambiente compartido](docs/preparar-ambiente-compartido.md#corrección-y-comprobación-local-del-18-de-octubre-de-2026).

Las pruebas unitarias corren al construir la imagen del backend. Las de
integración usan una base PostgreSQL desechable, inicializada igual que la real:

```powershell
docker compose --profile test run --rm --build backend-it
docker compose --profile test down db-it backend-it
```

El segundo comando retira la base de pruebas sin tocar el entorno levantado.
Una prueba de integración lleva `@Tag("integration")` y comprueba también lo
que debe fallar: el caso negativo es parte de la prueba.

`ApiIT`, `DirectoryIT`, `CaptureIT`, `WorkdayIT`, `ClosureRunsIT`,
`AdministrationIT` y `ExportsIT` recorren el API
por HTTP con dos empresas y tokens firmados por una clave de prueba, que el
backend valida como los del proveedor de identidad. Comparten `ApiTestBase`.
`CaptureTestBase` simula lo que hace la app: genera su clave, se activa, firma
su aserción y firma cada marcaje. Una ruta nueva agrega su caso de aislamiento
entre empresas y su fila en la matriz de roles.

`WorkdayIT` y `ExportsIT` necesitan una semana terminada cuyos marcajes todavía
se acepten. Por eso cada empresa de esas pruebas empieza su semana el día en
que corren, y ahí el umbral de la marca tardía se aleja para que no dependa de
la hora. Lo comparten en `WorkdayTestBase`.

En las pruebas los trabajos no corren solos: `zenit.jobs.enabled` va apagado y
cada prueba llama a `jobWorker` cuando le toca, sin esperas. `JobsIT` prueba el
trabajador con un trabajo que falla a propósito, y simula el paso del tiempo
moviendo la fecha del trabajo en la base. `ClosureRunsIT` interrumpe una
corrida de cierre a la mitad y comprueba que lo ya cerrado se conserva y que
el siguiente intento la termina.

La cuota por persona va abierta en las pruebas, porque toda la suite llama con
pocas identidades. `QuotaIT` la prueba de punta a punta con un límite bajo.

Cada respuesta que reciben las pruebas de integración se compara con el
contrato (`ContractCheck`): su estado tiene que estar descrito para esa
operación y su cuerpo tiene que cumplir el esquema, con sus formatos.
`ContractCoverageIT` corre al final y exige dos cosas más: que las rutas del
backend sean exactamente las operaciones del contrato, y que cada operación
haya respondido bien al menos una vez. Una ruta nueva sin contrato, o una
respuesta que cambia sin cambiar el contrato, rompe las pruebas: los dos se
cambian en el mismo commit. También se compara el cuerpo de cada petición que
el backend aceptó: si acepta algo que el contrato no describe, la prueba
falla. No se comprueba el formato de correo, porque los datos ficticios usan
el dominio reservado `.invalid`, ni la carga del padrón, que no es JSON.

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
- Quien opera el servicio suspende y reactiva una empresa, con un motivo que
  queda en su bitácora. Suspendida, queda cerrada para su gente y para sus
  dispositivos; no se borra nada y al reactivarla todo sigue como estaba.
- Si una persona pierde su cuenta y vuelve con otra del mismo correo, quien
  administra suelta su liga (`POST /api/v1/users/{userId}/unlink`) y la
  persona se liga otra vez al entrar. Soltar la liga no quita el acceso: para
  eso está `disabled`.
- Si quien perdió su cuenta es la única persona que administra, quien opera
  el servicio suelta la liga por correo y con un motivo mediante
  `POST /api/v1/tenants/{tenantId}/administrators/unlink`; no recibe datos de
  la persona y la acción queda en la bitácora de la empresa.
- Cada persona tiene una cuota de peticiones por minuto, 600 por defecto
  (`API_PERSON_REQUESTS_PER_MINUTE`). Se cuenta dentro de la cadena de
  seguridad, cuando ya se sabe quién llama, y responde 429 antes de llegar a
  la ruta. Vive en memoria: vale para una sola instancia.
- Una ruta nueva se abre en `SecurityConfig` con los mismos roles que el
  contrato declara en `x-roles`, y lee la empresa de `CurrentPerson`, nunca
  del cuerpo ni de la ruta. Las únicas excepciones son las tres rutas de
  operación del servicio: suspender, reactivar y soltar la liga de quien
  administra una empresa.

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
  en las rutas de dispositivo, ni al revés. Sólo las dos rutas del propio
  trabajador, su semana y el acuse de su cierre, admiten cualquiera de las
  dos: su cuenta o su teléfono personal.
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

## Jornada, incidencias y cierre

La semana de una persona se calcula de sus marcajes cada vez que se pide. No se
guarda hasta que se cierra.

- El cálculo está en `WeekCalculator.kt` y no toca la base: con los mismos
  marcajes, ajustes y reglas da siempre el mismo resultado. Lee los marcajes
  en el orden en que ocurrieron y vuelve a deducir su tipo, así que uno que
  llegó tarde ya no deja incoherentes a los demás. El tipo guardado en el
  marcaje no cambia.
- Un turno pertenece al día y a la semana en que empieza. Un tramo sin el
  marcaje que lo cierra queda abierto y no suma.
- Los topes son filas de `rule_set`, con vigencia y fuente, no constantes del
  código. Se aplican los vigentes en el último día de la semana. La tabla trae
  el calendario de reducción de 2026 a 2030; su lectura está sujeta a revisión
  jurídica y sus alertas informan, no bloquean ni sancionan.
- Una incidencia la atiende una persona: la asigna y la resuelve justificando,
  confirmando o ajustando, siempre con motivo. Un ajuste no edita el marcaje:
  agrega una intención, con autor y motivo, que el cálculo aplica.
- Cerrar congela el cálculo de cada persona con su huella. Quien tiene una
  incidencia abierta o un tramo sin cerrar no se cierra; a un tramo sin cerrar
  que no tiene incidencia, el cierre le abre una, para que haya con qué
  corregirlo. Una semana cerrada se
  entrega tal como se congeló y no admite ajustes: primero se reabre, con
  motivo. Reabrir conserva la versión cerrada y volver a cerrar crea otra.
- Un marcaje que llega de una semana ya cerrada se guarda y abre una
  incidencia; el cierre no cambia solo.
- El cierre directo responde en la petición y admite hasta 500 personas. Una
  corrida de cierre (`POST /api/v1/week-closure-runs`) cierra a toda la
  empresa o a una sede como trabajo, sin tope: cada persona en su propia
  transacción, de modo que lo ya cerrado se conserva si se interrumpe y el
  siguiente intento retoma lo que faltó. La lógica de cerrar a una persona es
  una sola, en `WeekCloser`, para los dos caminos.
- El cierre programado nace apagado. La empresa lo enciende con
  `autoCloseAfterHours`; el sistema pasa una vez por semana, cierra a quien no
  tiene nada pendiente y no vuelve a pasar. Un cierre del sistema no tiene
  persona en `closedBy`. Cada cuánto se revisa lo dice
  `CLOSURES_SCHEDULE_CHECK_SECONDS`.
- El trabajador ve su semana y acusa su cierre, conforme u objetándolo, una vez
  por cierre. Lo hace desde su teléfono personal o desde el portal, con su
  cuenta ligada a su fila del padrón (`employeeId` de la persona). Una terminal
  no puede, y el cierre de otra persona no existe para él.
- Cambiar un tope es una migración nueva que agrega una versión de `rule_set`;
  las semanas ya cerradas conservan la versión con la que se cerraron.

## Exportes, trabajos y fuentes del padrón

Un exporte saca los cierres vigentes de una semana a un archivo. Pedirlo sólo
lo encola; lo prepara un trabajo.

- Los trabajos viven en la tabla `job`. Un proceso toma uno por un tiempo; si
  falla, lo reintenta esperando cada vez el doble, y tras cinco intentos lo
  abandona y deja constancia en lo que lo esperaba. Si el proceso muere, otro
  lo toma cuando vence su plazo. Dos procesos nunca toman el mismo trabajo.
  Del error sólo se guarda su clase, nunca su mensaje.
- Un tipo de trabajo nuevo implementa `JobHandler` y se encola con
  `JobRepository.enqueue`. El trabajo no lleva datos: apunta a un registro.
- El archivo se guarda en la base mientras se puede descargar, quince minutos
  por defecto (`EXPORTS_TTL_MINUTES`). Se descarga una sola vez, con la misma
  credencial y los mismos roles que el exporte; después se descarta. Quedan
  su manifiesto y sus huellas, y en la bitácora quién lo descargó.
- El manifiesto declara empresa, semana, la huella del archivo y la de cada
  cierre que entró: liga lo exportado con lo cerrado. Se lee con
  `GET /api/v1/exports/{exportId}/manifest`, que lo entrega byte por byte como
  se guardó: su propia huella se vuelve a calcular sobre esa respuesta. Sigue
  disponible cuando el archivo ya no existe.
- Plantilla 1 del archivo: CSV en UTF-8 con marca de orden de bytes y fin de
  línea CRLF, una fila por cierre. A la celda que una hoja de cálculo tomaría
  por fórmula se le antepone un apóstrofo. Cambiar las columnas sube
  `TEMPLATE_VERSION` en `ExportCsv` y se documenta en el contrato.
- Las fuentes del padrón dicen de dónde viene y hasta dónde se sincronizó.
  Hoy sólo existe la carga por archivo: aparece al aplicar la primera y cada
  carga aplicada mueve su punto. El conector todavía no existe.
- `JOBS_ENABLED=false` apaga el proceso que da las vueltas; sirve para un
  paso que no debe atender trabajos.

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
- Las imágenes se revisan contra vulnerabilidades conocidas, con su inventario
  de componentes. Lo que tiene corrección publicada y la imagen base o Spring
  Boot todavía no traen se adelanta, con la versión mínima corregida y un
  comentario que dice por qué.
- El respaldo usa un rol que sólo lee. Los modos cifrados guardan un paquete
  age y lo restauran sin el origen, comparando conteos y huellas de contenido.
  La autoprueba aislada pasó; la copia de operación y la recuperación completa
  del servicio siguen pendientes.

Las herramientas que no atienden peticiones tienen sus propias reglas. El
generador de secretos, el inventario y el análisis de vulnerabilidades corren
como root dentro de su contenedor, con una sola capacidad, para poder escribir
en una carpeta del repositorio; ninguno recibe una contraseña ni el control de
Docker.

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
exceptúa valores ficticios concretos del contrato y de pruebas: la firma de
muestra y claves de idempotencia. Un ejemplo nuevo con forma de token
reutiliza esa firma; no se exceptúan archivos completos.

El contrato se probó generando un cliente Kotlin con OpenAPI Generator 7.26.0
(Retrofit y kotlinx.serialization) y los tipos de TypeScript con
openapi-typescript 7.13.0; ambos compilan. En Kotlin hay que excluir
`infrastructure/ApiClient.kt` con `.openapi-generator-ignore`: el contrato
declara dos credenciales de tipo bearer y el generador duplica su ayudante. No
hace falta, porque la app firma su propia aserción con un interceptor.

## Herramientas de operación

| Para | Comando |
| --- | --- |
| Llenar el entorno con personas, dispositivos y marcajes simulados | `docker compose --profile tools run --rm device-sim` |
| Ensayar el respaldo y la restauración | `docker compose --profile ops run --rm backup-rehearsal` |
| Guardar una copia cifrada | `docker compose --profile ops run --rm backup` |
| Verificar esa copia sin el origen | `docker compose --profile ops run --rm backup-restore` |
| Inventario de lo que lleva una imagen | `docker compose --profile tools run --rm sbom` |
| Vulnerabilidades conocidas de ese inventario | `docker compose --profile tools run --rm vuln-scan` |

Cada una pide algo antes de correr: un token, el entorno levantado o la imagen
exportada a un archivo. Está en [Entorno local](docs/entorno-local.md).

- El simulador vive en `backend/src/simulator/` y habla con el backend sólo
  por el API. Sólo sirve con la tarjeta simulada encendida y datos ficticios.
- El ensayo no conserva nada. El nuevo modo guarda una copia cifrada local;
  preparar las claves según [Respaldos cifrados](docs/respaldos-cifrados.md).
  La copia externa, retención y recuperación completa siguen pendientes.
- `vuln-scan` termina con error si hay una vulnerabilidad alta o crítica sin
  atender. Lo que una persona decide aceptar se anota en `.grype.yaml`, con
  su motivo, alcance y fecha de revisión.

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
