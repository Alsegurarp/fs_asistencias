# Guía del portal web

**Actualización del 11 de noviembre, Usuarios y Mi perfil (sin cambios al contrato):**
- **Usuarios y roles (EMP-04):** cifras de acceso (con acceso, invitaciones sin aceptar, Supervisión con sedes y quién puede descargar el expediente), pestañas por rol con su cuenta, búsqueda por nombre o correo, y por persona su rol, alcance, estado, fecha de invitación, cuenta y expediente. Todo sale del servidor (`GET /users` con `q`, `role`, `status` y `dossierPermission`; `GET /users/summary`). Las cifras filtran: `?estado=invitadas` y `?expediente=1`.
- **Editar acceso:** `?persona=<id>` abre el panel con nombre, roles, sedes de Supervisión, la fila del padrón para Trabajador y el permiso del expediente; «Guardar cambios» manda sólo lo que cambió (`PATCH /users/{id}` y, aparte, `PUT /users/{id}/dossier-permission`). La seguridad de la cuenta (contraseña nueva, soltar la liga, deshabilitar o habilitar) pide confirmación y se aplica en el acto.
- **Invitar (EMP-05):** `?invitar=1`, también desde el menú Crear. No manda correo: la persona entra con ese correo verificado. Un correo que ya tiene acceso se marca en su campo (`email_unavailable`).
- **Permisos por rol (EMP-06):** `?permisos=1`, una tabla de consulta.
- **Mi perfil (CTA-01, TEL-11):** desde el menú de la cuenta o «Más» en teléfono (`?perfil=1`): empresa, rol, alcance, expediente y si está en el padrón; «Cambiar» y «Reconfigurar» abren la consola de cuenta de Keycloak. **Ayuda y soporte** (`?ayuda=1`) da el correo y el teléfono de soporte.

**Actualización del 10 de noviembre, Configuración (contrato 0.33.0):**
- **Configuración (EMP-01):** una sola pantalla con la empresa (nombre, zona horaria, inicio de semana y cierre automático, con sus cifras), las políticas y reglas, y las sedes con su zona de marcaje en un mapa de OpenStreetMap. Sólo Administración cambia; los demás roles la consultan. `/configuracion/sedes` lleva aquí.
- **Sede (EMP-07):** `?sede=<id>` abre una sede y `?sede=nueva` agrega una. El punto se arrastra en el mapa o se escribe con latitud y longitud, junto con el radio. Desactivar y reactivar están en el pie.
- **Comida (EMP-02 y 08):** `?comida=1` muestra la política de hoy y el cambio programado, que se puede cancelar; `?comida=programar` programa uno con motivo y muestra desde cuándo entraría.
- **Reglas (EMP-03):** `?reglas=1` muestra los topes por año, las reglas por día y la fuente.
- **API:** cada sede trae `people` (personas activas) y `terminals` (terminales activas).

**Actualización del 10 de noviembre, tras el recorrido en local (contrato 0.32.0):**
- **Filas:** un clic en cualquier parte de la fila abre su detalle en Tarjetas, Asistencia, Personal, Cierres e Incidencias.
- **Tarjetas:** nueva columna «Tecnología» («Huella manual» o «MIFARE Classic firmada»). Una tarjeta sin titular dice «Antes: <persona>», con la fecha en «Desde». El detalle trae la tecnología y «Lecturas», con cuántos marcajes tiene la tarjeta y cuándo y dónde fue el último. El historial del detalle sigue siendo de asignaciones.

**Actualización del 10 de noviembre, buscador y menú Crear:**
- **Buscador (CTA-05):** en la barra superior busca personas, tarjetas y lectores, con pocos resultados de cada tipo y sólo en lo que el rol ve. Enter abre el primero, las flechas recorren la lista, Esc cierra y la tecla «/» enfoca la búsqueda.
- **Menú Crear (CTA-04), tecla «C»:** dar de alta a una persona, crear un horario, activar un lector y registrar una tarjeta, cada uno en su ventana sobre la página actual. «Cerrar la semana» lleva a Cierres con la confirmación abierta (`/cierres?cerrar=1`). Sólo aparece lo que el rol puede hacer; «Invitar» llega con el bloque 3 y «Generar un reporte» con el bloque 4.

**Actualización del 10 de noviembre, Dispositivos y tarjetas (contrato 0.31.0):**
- **Lectores (PAD-02):** con sus cifras (activos, sin señal más de 24 h, revocados o reemplazados), búsqueda y revocar con motivo. «Activar lector» abre un panel para una terminal de sede o un teléfono personal, con el código de un solo uso y su vencimiento.
- **Tarjetas (PAD-11):** pestañas por estado con sus cifras, quién tiene cada tarjeta y desde cuándo. El detalle trae quién la registró (persona o terminal), la última lectura, el historial, y las acciones asignar, reponer con otra del inventario y revocar como revocada, perdida o dañada.
- **Registrar tarjeta (PAD-12):** etiqueta y huella, con la opción de asignarla en el mismo paso a quien no tiene tarjeta.
- **API:** el detalle sale de `GET /cards/{cardId}`.

**Actualización del 9 de noviembre, Importar CSV (contrato 0.29.0):**
Importaciones con el lienzo (PAD-09) y el modal de tres pasos: subir,
revisar sin cambiar nada y aplicar las filas listas (PAD-04 a 06). El
historial aplica una revisión pendiente eligiendo otra vez el mismo archivo.
El resultado dice altas, con cambios y sin cambios: `counts` trae
`created`, `updated` y `unchanged`. Detalle en
[Importación de empleados](#importación-de-empleados).

**Actualización del 9 de noviembre, Personal y horarios (contrato 0.28.0):**
primera pantalla del Padrón con el lienzo, en `/personal`. Personas con su
sede, horario vigente, tarjeta, origen y estado; filtros por estado, horario,
«Sin tarjeta», sede y búsqueda en el servidor; la ficha con el horario
vigente, sus días y los anteriores (`GET /employees/{employeeId}/schedule-assignments`,
nueva), la tarjeta, editar, dar de baja con fecha efectiva y reactivar; alta
con horario y tarjeta opcionales. Horarios separa vigentes e históricos,
cuenta a las personas de cada uno, crea y asigna desde una fecha a varias
personas. Fuentes del padrón muestra cada fuente y los cambios recientes.

**Actualización del 9 de noviembre, Panel (contrato 0.27.0):** cuarta y
última pantalla de Operación, en `/panel`, que pasa a ser el inicio de
Administración, RH, Supervisión y Auditoría. Asistencia de hoy, la semana
anterior con sus cierres y acuses y «Terminar el cierre», las cifras de la
semana, lo que pide atención, quienes más horas llevan contra el tope y la
actividad reciente de la bitácora (Administración y Auditoría). Una empresa
sin personal ve sus primeros pasos. La campana de la barra superior junta el
cambio de comida, las incidencias de severidad alta y lo pendiente de la
semana anterior; «Marcar como vistos» se recuerda en el navegador.

**Actualización del 8 de noviembre, Cierres:** tercera pantalla de Operación
con el lienzo, en `/cierres`. La última corrida de la semana con su avance,
los acuses (conformes, con objeción, sin acuse) que filtran la lista, las
pestañas de cerradas, bloqueadas y reabiertas, y «Cerrar las pendientes», que
pide una corrida para toda la empresa o una sede y la sigue mientras se
puede seguir trabajando. El cierre de una persona muestra lo congelado, sus
días trabajados y su acuse; Administración lo reabre con motivo.

**Actualización del 8 de noviembre, días de la semana (contrato 0.26.0):**
la semana calculada trae `days`, cada día con su tiempo trabajado, de
descanso, ordinario y extra, del mismo reparto que da los totales, y el
cierre los congela. Cada fila de `GET /attendance/weeks` dice en
`workedDays` y `overtimeDays` cuántos días trabajó y cuántos llevan extra.
Con eso la ficha de Asistencia muestra «8:00 +1:05» y la tabla «Extra 3 de 4
días», con el máximo de días de las reglas (`overtimeMaxDays`). Una semana
cerrada antes de 0.26.0 los trae nulos.

**Actualización del 8 de noviembre, Incidencias:** segunda pantalla de
Operación con el lienzo, en `/incidencias`. Abiertas y resueltas en lista o
tablero (sin asignar, asignadas y resueltas esta semana); búsqueda por nombre
o número (`q`, nueva en el contrato 0.25.0), tipo, sede y los filtros «Mías»,
«Severidad alta» y «Bloquean un cierre», todo en el servidor. El detalle se
abre sobre la lista con las marcas del día, la salida que falta, a quién está
asignada y el formulario para resolverla como justificada, confirmada o
ajustada; una resuelta muestra su decisión y su historial. El menú lleva
cuántas siguen abiertas. Lo elegido vive en la dirección; Cierres y
Asistencia llegan con la semana y la incidencia.

**Actualización del 8 de noviembre, Asistencia:** primera pantalla de
Operación reconstruida con el lienzo, en `/asistencia` y como inicio de
Administración, RH, Supervisión y Auditoría. Tabla de la semana de cada
persona con ordinarias y extra contra el tope de las reglas vigentes, lo de
hoy y lo que pide atención; filtros «Con alertas», «Con tiempo extra», «Sin
entrada hoy» y «En turno» con sus conteos, búsqueda por nombre o número y
sede, todo en el servidor (`q` es nuevo en el contrato 0.24.0). La ficha de
una persona se abre sobre la tabla con su semana día por día, sus marcajes
con la evidencia y sus cierres con el acuse. «Exportar vista» baja un CSV con
todas las páginas de lo filtrado. Semana, filtros, búsqueda, persona y
pestaña viven en la dirección: un enlace o el botón atrás los conservan. En
teléfono, tarjetas con la barra de horas y la ficha a pantalla completa.

**Actualización del 8 de noviembre, marco del lienzo:** el portal ya tiene la
barra superior, el menú lateral ocultable con grupos plegables (Operación,
Padrón, Empresa), la barra inferior de teléfono con «Más», el menú de la
cuenta y los estados de sin permiso, página no encontrada, error, cuenta sin
empresa y sesión terminada, con los colores, la tipografía Inter y las formas
del lienzo aprobado. Cada pantalla tiene su dirección (`/incidencias`,
`/personal/horarios`, `/reportes/expediente`…), el botón atrás funciona y un
enlace directo sobrevive al inicio de sesión. Sin sesión, el portal va
directo al inicio de sesión del servicio de identidad; al salir muestra «Tu
sesión terminó». Las pantallas de abajo siguen siendo las anteriores, dentro
del marco, hasta que su sección se reconstruya. Orden, direcciones y reglas
para el equipo en [Construir el portal](construir-el-portal.md).

**Actualización del 5 de noviembre, API candidata 0.18.0:** Usuarios permite
asignar sedes a supervisores al invitar o editar. Sin sedes no reciben datos
de supervisión. La restricción se aplica en servidor antes de paginar; las
semanas con evidencia de sedes ajenas se deniegan completas. El rol auditor
adicional permite leer toda la empresa, sin ampliar escrituras del supervisor.
Una baja en Empleados exige fecha efectiva no futura, revoca tarjeta y termina
el horario aplicable, conservando históricos. Suspender mantiene captura de
dispositivos existentes y bloquea administración y nuevas vinculaciones.
La jornada ya incluye clasificación y extra diaria/semanal sin duplicación;
sus límites pendientes están en [lógica de negocio](logica-de-negocio.md).

Actualización E4/E5 del 27 de octubre: **Expediente empresarial** aparece sólo
con permiso explícito, incluso para administración. Desde **Usuarios**, una
cuenta administradora puede conceder/revocar con confirmación. El expediente
permite solicitar, consultar preparación/vencimiento, guardar manifiesto y
verificar identidad con OTP nuevo antes de cada descarga. Al volver de Keycloak,
pulsar **Continuar con la descarga verificada**. Cancelar o vencer exige otra
verificación; si la descarga se consume e interrumpe, solicitar otro expediente.
No admite reanudación. El CSV semanal conserva su recorrido y permisos.
[Pruebas, configuración y límites](entrega-expediente-e4-e5.md).

Actualización A1–A4 del 20 de octubre: el operador puede reactivar empresas
con motivo, el trabajador consulta su semana y el acuse del servidor en
Mi asistencia y administración puede exigir contraseña nueva a cuentas
activas vinculadas. Se aprobaron 162 pruebas y compilación. Los recorridos
del usuario y del ambiente público conservan sus pendientes. El 21 aprobaron
los [33 casos locales A5](qa-a1-a5-2026-10-21.md), con login/OTP real,
renovación/salida, configuración y bloqueos por rol; [guion](qa-a1-a5.md).

Qué tiene que hacer el portal: iniciar sesión, saber qué mostrar a cada rol y
contra qué ruta va cada pantalla. Antes conviene leer
[Consumir el API](consumir-el-api.md) y [Casos de uso](casos-de-uso.md).

Estado: el módulo `web/` implementa inicio de sesión con el adaptador oficial
`keycloak-js`, PKCE S256, tokens en memoria, renovación y cierre de sesión.
Consulta `/me` y ofrece sedes (alta y edición), empleados (alta y edición) y
tarjetas (registro, asignación y revocación), con permisos por rol y listas
con cursor. Incluye estados de carga, errores de campos y referencia de
correlación. También implementa horarios y asignaciones, importación CSV y
usuarios y configuración de empresa. El 19 de octubre de 2026 pasaron
compilación y 148 pruebas. El usuario ya comprobó acceso, catálogos,
incidencias, cuatro cierres, descarga única y usuarios. Horarios e importación
pasaron por API HTTPS con sesión real; siguen sus pantallas y los demás
recorridos. Véase la [bitácora](bitacora-trabajo.md).

La navegación de Incidencias, Cierres y Exportes respeta los roles de `/me`.
Incidencias ya tiene listado, filtros, detalle, semana del empleado,
asignación y resolución con los tres tipos de ajuste. Cierres ya permite
consultar, cerrar, reabrir y seguir corridas; Exportes permite solicitar CSV,
consultar su preparación y descargar archivo y manifiesto.
El supervisor ve Incidencias y Cierres;
el auditor también ve Exportes. El administrador y RH ven las tres secciones.
Los permisos de resolver, cerrar y reabrir se distinguen en `permissions()`;
el servidor sigue siendo quien autoriza cada operación.

El cliente compartido de `web/src/api.ts` admite una clave de idempotencia
como cuarto argumento: `api('/exports', 'POST', pedido, clave)`. Quien crea
la solicitud genera la clave una vez y conserva ese valor al reintentar.
`apiDownload('/exports/<id>/download')` devuelve el `blob` y el nombre del
archivo indicado por el servidor, sin interpretar el CSV como JSON. Ambos
caminos renuevan la credencial y conservan los errores de campos y la
referencia de correlación; las descargas no se reintentan automáticamente.
Las peticiones autenticadas no admiten redirecciones ni caché HTTP.
`api()` también admite `FormData` para importar el CSV: conserva token y clave,
sin fijar `Content-Type`, para que el navegador genere el límite multipart.

## Horarios y asignaciones

La pestaña **Horarios** permite consultar a administración, RH, supervisión
y auditoría; sólo administración y RH crean y asignan. Lista los horarios
con cursor y muestra zona, vigencia, días, entrada, salida y descanso.
Una salida anterior a la entrada termina al día siguiente. No se edita un
horario existente: se crea otro con su vigencia.

Crear usa `POST /schedules` con entre uno y siete días distintos. El servidor
valida zona IANA, vigencias, entrada distinta de salida y descanso de 0 a 480
minutos que quepa en el turno. Los errores conservan el formulario.

**Asignar** elige un empleado y una fecha, y usa
`POST /employees/{id}/schedule-assignments`. La fecha debe estar dentro de la
vigencia del horario y después del inicio de la última asignación. La anterior
se cierra el día previo si se cruza; la nueva termina con la vigencia del horario.
Desde el contrato 0.28.0, `GET /employees/{id}/schedule-assignments` da las
asignaciones de una persona, de la más reciente a la más antigua: la ficha
muestra la vigente con su fecha, la que viene y las anteriores. La lista y la
ficha marcan el horario **vigente hoy**: una asignación futura aparece como
«Desde el …». Asignar a varias personas hace una petición por persona; si
alguna falla, se dice quién y por qué y las demás quedan asignadas. El horario
tampoco determina retardos, faltas ni salida anticipada en el cálculo actual
de asistencia.

## Importación de empleados

Desde el 9 de noviembre es la pestaña **Importaciones** de Personal y horarios
(PAD-09), en `/personal/importaciones`, sólo para Administración y RH. Lista
cada archivo que se subió (`GET /imports`): nombre, quién lo subió, cuándo,
filas, listas, con error y estado (Revisado, sin aplicar · Revisado y
aplicado · Aplicado · Falló), con «Revisar y aplicar», «Ver errores» o «Ver
huella». En teléfono cada importación es una tarjeta.

«Importar CSV», en el encabezado de la sección o en la pestaña, abre el
modal en `?importar=archivo` (PAD-04 a 06); `?importar=<id>` abre una
importación del historial. Tres pasos:

1. **Subir archivo**: arrastrar o elegir el CSV. Antes de enviarlo dice el
   nombre, cuántas filas trae y su tamaño, y rechaza un archivo vacío o de
   más de 1 MB. Enlaza la plantilla.
2. **Revisar**: `POST /imports/csv` con `dryRun=true`. Filas, listas para
   aplicar, con error y la tabla de las filas rechazadas (fila, número, qué
   pasa; muestra las primeras 100) con «Descargar errores». Un archivo que no
   es la plantilla o no está en UTF-8 no se puede aplicar.
3. **Aplicar**: `dryRun=false` con `reviewedImportId` de la revisión, así el
   servidor comprueba que es el mismo archivo. El resultado dice altas, con
   cambios, sin cambios y fuera por error (desde el contrato 0.29.0; las
   importaciones anteriores sólo dicen cuántas se aplicaron), quién y cuándo,
   y la huella de las filas aplicadas.

El servidor no guarda el archivo: aplicar una revisión del historial pide
elegirlo otra vez, y si no es el mismo responde `review_mismatch` y el modal
lo explica. Cada archivo lleva sus dos claves de idempotencia; reintentar
tras perder la respuesta manda el mismo archivo con la misma clave y no
aplica dos veces. Elegir otro archivo estrena claves. Al aplicar se
actualizan el padrón, sus conteos, la asistencia, las fuentes y la bitácora.

El formato UTF-8 es:

```csv
external_id,display_name,employment_start,site_name
IMPORT-DEMO-001,Elena Demo,2026-10-01,
IMPORT-DEMO-002,Fernando Demo,2026-10-01,
```

El límite es 1 MB de archivo y 5.000 filas. `site_name` es el nombre de una
sede activa, sin distinguir mayúsculas; nombres ambiguos se rechazan. Una
sede vacía deja al empleado sin sede, también al actualizarlo. El
identificador externo hace alta o actualización de nombre, sede y fecha de
alta, conservando estado y tarjetas. No se eliminan empleados. Las filas
rechazadas no se aplican. Nginx admite 2 MB de petición para que el
envoltorio multipart no rechace un archivo válido de 1 MB; el backend
mantiene los límites de archivo y petición.

La revisión es una vista previa: aplicar vuelve a validar contra el estado
actual del backend, así que los conteos pueden variar si cambian las sedes o
el padrón entre ambos pasos.

### Prueba manual de ambos entregables

1. Como administración o RH, crear un horario lunes a viernes, 09:00–17:00,
   descanso 0, zona `America/Mexico_City`, vigente desde `2026-10-01`.
2. Asignarlo a Ana Demo desde `2026-10-01`. Verificar la confirmación y el
   horario vigente en Empleados. Si ya tiene asignación, usar una fecha posterior
   a su inicio y dentro de la vigencia del horario nuevo.
3. Crear otro turno, 22:00–06:00, y comprobar la indicación del día siguiente.
4. Probar salida igual a entrada o descanso demasiado largo: debe rechazar y
   conservar el formulario. Consultar como auditor: sin botones de escritura.
5. Descargar el CSV de ejemplo, validarlo y comprobar dos filas aceptadas
   antes de aplicar. Confirmar y aplicar; buscar `IMPORT-DEMO-001` y
   `IMPORT-DEMO-002` en Empleados. No asigna tarjetas ni horarios automáticamente.
6. Repetir con una fila de fecha inválida: mostrar el error y exigir confirmar
   cuántas filas se aplican. No aplicar si sólo se quería probar la validación.

Verificación automática del 19: 148 pruebas del portal y compilación correctas.
Las pruebas de UI usan API simulada; horarios e importación también pasaron
por API HTTPS con sesión real. Queda pendiente este recorrido en navegador.
Se reutilizaron las rutas existentes, sin cambios en el backend.

El desarrollo se verifica dentro de Docker, conforme a las reglas del
repositorio. Reconstruir con `docker compose up --build --detach web` y abrir
`http://localhost:8081`, la dirección de retorno permitida por el realm local.
nginx envía `/api` al backend por la red interna. El proveedor
de identidad sigue en `http://localhost:8082`. Al recargar la página se vuelve
a pulsar «Iniciar sesión»: los tokens no se guardan; Keycloak conserva su
sesión y decide si hace falta pedir credenciales otra vez.

`VITE_IDENTITY_URL` permite cambiar la dirección de identidad en desarrollo.
En Docker, Compose pasa `IDENTITY_URL` a la construcción del portal y a
`connect-src` de nginx; cambiarla exige reconstruir la imagen. El backend y
Keycloak usan la misma dirección. Hay un ambiente compartido publicado con
HTTPS; su recorrido completo de sesión del navegador sigue pendiente.
Ver [Ambiente compartido](preparar-ambiente-compartido.md).

Compilación: `docker compose build web`. Para las pruebas, construir
`docker build --target build --tag zenit-web-check web` y ejecutar
`docker run --rm --network none zenit-web-check pnpm test`.

## Inicio de sesión

El portal no pide ni guarda contraseñas: manda a la persona al proveedor de
identidad y recibe un token. Es el flujo de código de autorización con PKCE,
que cualquier librería de OpenID Connect para navegador implementa.

| Dato | Valor en local |
| --- | --- |
| Emisor | `http://localhost:8082/realms/zenit` |
| Cliente | `zenit-portal` |
| Retorno | Una ruta del propio portal, por ejemplo `http://localhost:8081/retorno` |
| Alcance | `openid` |
| PKCE | `S256`, obligatorio |

La librería descubre el resto del emisor, en
`/.well-known/openid-configuration`.

Lo que hay que cuidar:

- El token de acceso vive 5 minutos. Renovarlo antes de que venza, con el
  token de renovación, sin que la persona lo note.
- Guardar los tokens en memoria. No en `localStorage`: cualquier script de la
  página podría leerlos.
- En su primera entrada, el proveedor le pide a la persona cambiar su
  contraseña temporal y configurar un segundo factor. Eso ocurre en las
  páginas del proveedor; el portal sólo espera el retorno.
- Al cerrar sesión, cerrarla también en el proveedor, con su ruta de fin de
  sesión.

Cada llamada al API lleva `Authorization: Bearer <token de acceso>`.

## Después de entrar

Lo primero es `GET /api/v1/me`:

| Respuesta | Qué mostrar |
| --- | --- |
| `tenant` nulo y sin roles | La cuenta existe pero nadie la ha invitado: una pantalla que lo explique |
| Rol `operador_saas` | Alta, lista, reactivación y uso mensual de empresas; sin datos internos |
| Roles de empresa | El menú que corresponde a sus roles, con el nombre de la empresa |

Una persona puede tener varios roles: el menú es la unión de lo que cada uno
permite. `tenant.breakPolicy` y `tenant.timeZone` se usan en todo el portal.
Si `tenant.upcomingBreakPolicy` no es nulo, el portal avisa a todos los roles
de la empresa qué cambia con la comida y desde qué día: en el banner del Panel,
en la campana y, en las demás pantallas, arriba del contenido.

La política de comida no se cambia en «Editar configuración»: quien administra
la programa en Configuración con «Programar cambio de comida» y un motivo, y
quien opera, desde «Comida de …» en Empresas. Entra el primer día de semana de
la empresa dentro de la siguiente quincena, con al menos 7 días de aviso, y se
puede cancelar antes. Mientras haya uno programado, el inicio de semana no se
puede cambiar.

## Pantallas contra rutas

Las rutas van sin el prefijo `/api/v1`.

### Operador

| Pantalla | Rutas |
| --- | --- |
| Empresas | `GET /tenants`, `POST /tenants` |
| Suspender y reactivar | `POST /tenants/{tenantId}/suspension`, `POST /tenants/{tenantId}/reactivation` |
| Uso de una empresa | `GET /tenants/{tenantId}/usage?month=AAAA-MM` |
| Consola: búsqueda, filtros y conteos (desde 0.23.0) | `GET /tenants?q=&status=&administration=`, `GET /tenants/summary` |
| Consola: uso del mes de todas (desde 0.23.0) | `GET /tenants/usage?month=AAAA-MM`, `GET /tenants/usage/summary` |
| Consola: invitar otra administración (desde 0.23.0) | `POST /tenants/{tenantId}/administrators` |

Desde el contrato 0.23.0 cada empresa de `GET /tenants` trae `administration`:
su estado (`linked`, `pending`, `none`), cuántas personas la administran y
hasta cinco, con correo, si ya entraron y cuándo. El portal todavía no usa
esas rutas. «Invitar otra administración» sólo se ofrece cuando el estado no
es `linked`; si lo es, el servidor responde 409 `administrator_linked`. El CSV
del uso se arma recorriendo las páginas de `GET /tenants/usage`, sólo con
conteos.

El uso abre con el mes en curso en la zona horaria de la empresa y muestra sólo
conteos: personas que marcaron, personas vigentes, tarjetas, dispositivos y
marcajes. Avisa si el mes ya terminó o si sus conteos siguen creciendo.

Suspender y reactivar piden un motivo, que queda en la bitácora de la empresa.
Conviene pedir confirmación: al suspender, toda su gente y sus dispositivos
pierden el acceso en ese momento.

### Empresa y acceso (administrador)

| Pantalla | Rutas |
| --- | --- |
| Datos de la empresa | `GET /tenant`, `PATCH /tenant` |
| Personas con acceso | `GET /users`, `POST /users`, `GET /users/{userId}`, `PATCH /users/{userId}`, `POST /users/{userId}/unlink` |
| Bitácora | `GET /audit-log` |

Al dar de alta una empresa hay que pedir su política de descanso: si la comida
se marca o no se considera. Al invitar a un trabajador, ligarlo a su fila del
padrón con `employeeId`; sin esa liga no podrá ver su semana en el portal.

En los datos de la empresa va el cierre programado, `autoCloseAfterHours`:
un interruptor y un número de horas, de 1 a 168. Apagado se manda `null`.
Explicar ahí que el sistema pasa una sola vez por semana y que cierra sólo a
quien no tiene nada pendiente.

«Soltar la liga» (`unlink`) es para la persona que perdió su cuenta y volvió
con otra del mismo correo. No es la forma de quitarle el acceso a alguien:
para eso está `disabled`. Conviene decirlo en la propia pantalla.

### Configuración (administrador y RH)

| Pantalla | Rutas |
| --- | --- |
| Sedes | `GET /sites`, `POST /sites`, `GET /sites/{siteId}`, `PATCH /sites/{siteId}` |
| Horarios | `GET /schedules`, `POST /schedules`, `GET /schedules/{scheduleId}` |
| Padrón | `GET /employees?status=&scheduleId=&withoutCard=&siteId=&q=`, `GET /employees/summary?status=&siteId=&q=`, `POST /employees`, `GET /employees/{employeeId}`, `PATCH /employees/{employeeId}` |
| Horarios de una persona | `GET /employees/{employeeId}/schedule-assignments` (desde 0.28.0), `POST /employees/{employeeId}/schedule-assignments` |
| Fuentes del padrón | `GET /integrations/checkpoints`; cambios recientes, `GET /audit-log?group=directory` (Administración) |
| Importaciones | `GET /imports`, `POST /imports/csv` (revisar con `dryRun=true`, aplicar con `dryRun=false` y `reviewedImportId`), `GET /imports/{importId}`; altas, con cambios y sin cambios desde 0.29.0 |
| Tarjetas | `GET /cards`, `GET /cards/summary`, `GET /cards/{cardId}`, `POST /cards`, `POST /cards/{cardId}/assignments`, `POST /cards/{cardId}/revocation` |
| Dispositivos | `GET /devices`, `GET /devices/summary`, `POST /device-enrollments`, `POST /devices/{deviceId}/revocation` |
| De dónde viene el padrón | `GET /integrations/checkpoints` |

Notas:

- Las sedes sólo las crea y cambia el administrador.
- Un horario no se edita: la pantalla ofrece crear otro, no modificar.
- La carga del padrón tiene dos pasos. Primero se sube el archivo sin
  `dryRun`, que sólo valida y devuelve cada fila rechazada con su línea; se
  muestra el resultado, y sólo si la persona confirma se sube otra vez con
  `dryRun=false` y `reviewedImportId`. Cada subida lleva su propia
  `Idempotency-Key`.
- El código de enrolamiento sólo aparece en la respuesta de
  `POST /device-enrollments`. Mostrarlo en grande, con su vencimiento; no se
  puede volver a consultar.
- La huella de una tarjeta se captura al registrarla y no vuelve en ninguna
  respuesta.
- Desde el contrato 0.21.0 el backend ya resuelve, y el portal todavía no
  usa: la búsqueda `q` y los filtros de tarjetas y lectores, y sus conteos en
  `/summary`. Llegan con Dispositivos y tarjetas.

### Operación (administrador, RH, supervisor, auditor)

| Pantalla | Rutas |
| --- | --- |
| Panel: totales de hoy y de la semana, quienes más horas llevan (`mostHours` desde 0.27.0) y reglas | `GET /attendance/summary?date=`, `GET /rule-sets?effectiveOn=` |
| Panel: semana anterior, lo que pide atención y actividad | `GET /week-closures/summary?week=`, `GET /incidents?status=open&sort=severity&limit=5`, `GET /audit-log?limit=5` (Administración y Auditoría) |
| Panel: primeros pasos de una empresa sin personal (Administración) | `GET /sites`, `GET /schedules`, `GET /employees/summary`, `GET /cards/summary`, `GET /users/summary` |
| Campana de avisos | Las mismas del Panel, sin `audit-log`; el cambio de comida viene en `GET /me` |
| Asistencia: tabla, filtros y conteos (búsqueda desde 0.24.0; `workedDays` y `overtimeDays` desde 0.26.0) | `GET /attendance/weeks?week=&siteId=&attention=&q=`, `GET /attendance/summary?date=&siteId=`, `GET /rule-sets?effectiveOn=` |
| Asistencia: ficha de una persona | `GET /employees/{employeeId}/attendance?week=`, `GET /attendance-events?employeeId=&from=&to=`, `GET /week-closures?week=&employeeId=` (seis semanas) |
| Marcajes | `GET /attendance-events` |
| Semana de una persona | `GET /employees/{employeeId}/attendance?week=` |
| Incidencias: lista, tablero y conteos (búsqueda desde 0.25.0) | `GET /incidents?status=&sort=&q=&type=&siteId=&week=&assignee=&severity=&blocksClosure=`, `GET /incidents/summary?type=&siteId=&week=` |
| Incidencias: detalle, asignar y resolver | `GET /incidents/{incidentId}`, `GET /incidents/{incidentId}/assignees`, `PATCH /incidents/{incidentId}`, `GET /attendance-events?employeeId=&from=&to=` (marcas del día) |
| Cierres | `GET /week-closures`, `POST /week-closures`, `GET /week-closures/{closureId}`, `POST /week-closures/{closureId}/reopen` |
| Corridas de cierre | `POST /week-closure-runs`, `GET /week-closure-runs`, `GET /week-closure-runs/{runId}` |
| Reglas laborales | `GET /rule-sets` |
| Exportes | `POST /exports`, `GET /exports/{exportId}`, `GET /exports/{exportId}/download`, `GET /exports/{exportId}/manifest` |

Notas:

- El auditor sólo lee: no ve los botones de resolver, cerrar ni reabrir.
  Exportar sí puede.
- El supervisor resuelve incidencias pero no cierra semanas.
- Sólo el administrador reabre un cierre, y debe escribir el motivo.
- La lista de marcajes trae el veredicto de ubicación y la precisión, nunca
  la coordenada.

### Trabajador

| Pantalla | Rutas |
| --- | --- |
| Mi semana | `GET /me/attendance?week=` |
| Mi cierre | `GET /week-closures/{closureId}`, `POST /week-closures/{closureId}/acknowledgements` |

Si la cuenta no está ligada a una fila del padrón, `GET /me/attendance`
responde 403: explicar que falta que su empresa lo ligue.

## La semana

La respuesta de la semana ya viene calculada. El portal la dibuja; no suma.

- `segments`: tramos de trabajo y de descanso, con inicio, fin y minutos. Uno
  con `endAt` nulo está abierto: mostrarlo como «sin salida».
- `totals`: minutos trabajados, de descanso, ordinarios y extraordinarios.
- `days` (desde 0.26.0): cada día con algún tramo, con sus minutos
  trabajados, de descanso, ordinarios y extraordinarios. Un turno que cruza
  la medianoche cuenta en el día en que empezó. La suma de los días es
  `totals`: el portal no reparte nada. Nulo en una semana cerrada antes de
  0.26.0, que no lo guardó.
- `alerts`: avisos con gravedad `info`, `warning` o `critical`. Mostrar su
  `message`. Pueden aparecer códigos nuevos.
- `openIncidentIds`: lo que falta revisar de esa semana.
- `closure`: nulo si no se ha cerrado. Con estado `closed`, lo que se ve es lo
  congelado; con `reopened`, se está viendo el cálculo de ahora.

Mostrar siempre un aviso de que el cálculo es una referencia: sus topes no
tienen revisión jurídica.

## Incidencias

Implementado en `web/src/Incidents.tsx`. Las listas usan cursor y los filtros
por estado, tipo, sede y fecha de la semana reinician la paginación. Se
consultan los nombres de empleado y sede; las fechas se muestran en la zona
de la empresa, sin recalcular los totales de jornada del backend.

El detalle permite elegir la semana: la fecha de apertura de una incidencia
no necesariamente es la del marcaje, especialmente en sincronización tardía.
La semana consultada muestra los tramos, alertas, totales e incidencias
pendientes. Los marcajes se cargan por páginas; si el relacionado no aparece,
se indica que hay que cargar más o elegir otra semana. Los ajustes de excluir
y cambiar tipo sólo seleccionan marcajes reales cargados de ese empleado,
sin utilizar identificadores sintéticos de ajustes anteriores.

Administrador, RH y supervisor pueden autoasignarse y quitar la asignación;
el administrador puede elegir otra persona con acceso vigente. RH, supervisor
y auditor no consultan `/users`, porque esa ruta sólo admite administradores.
Un responsable ajeno se muestra como «Otra persona de la empresa» cuando no
se tiene permiso de consultar su nombre.

Desde el contrato 0.20.0 el backend ya resuelve esto, y el portal todavía no
lo usa: cada incidencia trae `assigneeName`, `assignedByName` y
`resolution.resolvedByName`, y `GET /incidents/{incidentId}/assignees` da a
quién puede asignar cada rol. La asignación sólo acepta a quienes da esa
lista (422 `assignee_cannot_resolve`).

Al agregar un marcaje se introduce la hora en la zona de la empresa y se envía
el instante UTC. Una hora inexistente por cambio horario no se admite; si
se repite, hay que elegir la primera o segunda ocurrencia. La resolución
conserva el motivo ante errores y muestra la referencia de correlación. Si
otra persona ya resolvió, se recarga el detalle y se retiran los controles;
si la semana está cerrada, se pide que el administrador la reabra. Resolver
actualiza la lista y vuelve a consultar la semana del empleado.

Una incidencia abierta de marcaje faltante, con un tramo de trabajo sin salida,
muestra **Agregar salida faltante** antes del resumen semanal. El botón prepara
«Ajustar jornada → Agregar marcaje → Salida» y enfoca la fecha y hora; no
inventa la hora ni guarda sin motivo. Justificar o confirmar una incidencia
no agrega la salida y puede dejar la semana bloqueada.

Verificado con pruebas de formularios y eventos React en jsdom, además de
pruebas de payloads y zonas horarias. El PMO verifica el recorrido contra el
backend real; estas pruebas usan respuestas simuladas.

1. Lista con filtros: estado, tipo, sede y semana.
2. Detalle: tipo, gravedad, persona, sede, marcaje y, si ya se atendió, quién y
   por qué.
3. Resolver, con `PATCH /incidents/{incidentId}`:

```json
{ "resolution": { "decision": "justified", "reason": "El teléfono estuvo sin señal durante el turno." } }
```

```json
{
  "resolution": {
    "decision": "adjusted",
    "reason": "Olvidó marcar la salida; la confirma su supervisor.",
    "adjustment": { "kind": "add_event", "eventType": "clock_out", "occurredAt": "2026-10-05T21:00:00Z" }
  }
}
```

- El motivo es obligatorio, de 10 a 500 caracteres.
- Asignar es `{ "assigneeUserId": "<id>" }`; quitar la asignación,
  `{ "assigneeUserId": null }`.
- 409 `incident_already_resolved`: alguien más la resolvió; recargar.
- 409 `week_closed`: la semana está cerrada; hay que reabrirla antes de
  ajustar.

## Cierre

Implementado en `web/src/Closures.tsx` y `web/src/ClosureSheet.tsx`, en
`/cierres`. Abre la última semana terminada. La semana, el alcance (toda la
empresa o una sede), la pestaña (`pestana`: `bloqueadas`, `reabiertas`), el
acuse (`acuse`: `conformes`, `objecion`, `sin-acuse`) y el cierre abierto
(`cierre`) viven en la dirección.

| Parte | Rutas |
| --- | --- |
| Conteos y acuses de la semana | `GET /week-closures/summary?week=&siteId=` |
| Última corrida y su avance | `GET /week-closure-runs?week=`, `GET /week-closure-runs/{runId}` |
| Cerradas y reabiertas | `GET /week-closures?week=&status=&siteId=&acknowledgement=`, con cursor |
| Bloqueadas | `GET /incidents?week=&blocksClosure=true&status=open&siteId=`, agrupadas por persona |
| Cierre de una persona | `GET /week-closures/{closureId}`; sus días, de `GET /employees/{employeeId}/attendance?week=` |
| Reabrir | `POST /week-closures/{closureId}/reopen` |

- **La corrida.** El banner muestra la última corrida de la semana y del
  alcance: quién la pidió o si fue el cierre programado, cuántas cerró de
  cuántas, cuántas quedaron bloqueadas y si el cierre automático está
  activo. Sin corridas, dice cuántas semanas hay cerradas.
- **Cerrar las pendientes** (Administración y RH) abre un diálogo con el
  alcance, cuántas personas hay, cuántas se cerrarán y quiénes seguirán
  bloqueadas y por qué. Pide `POST /week-closure-runs`; el portal ya no
  cierra personas elegidas. Una semana que no termina deja el botón
  deshabilitado con la fecha desde la que se puede.
- **El seguimiento.** Mientras corre, la pantalla consulta la corrida cada
  cinco segundos y se detiene en `done`, en `failed` o ante un error; un 429
  la pausa con «Reanudar». Al terminar actualiza conteos, listas,
  incidencias y Asistencia. Una fallida ofrece «Pedir otra con el mismo
  alcance».
- **Bloqueadas.** Salen de las incidencias abiertas que bloquean el cierre.
  Un tramo sin salida bloquea desde que una corrida lo vuelve incidencia
  «Falta la marca que cierra». Cada una lleva a su incidencia en
  Incidencias, con la semana. Si dos bloqueadas se llaman igual, llevan su
  sede; en las cerradas va el número de empleado junto al nombre.
- **El cierre de una persona** muestra lo congelado (ordinarias, extra y
  días trabajados), el acuse con la nota de una objeción, quién cerró, las
  reglas y la huella. Una versión reabierta o un cierre anterior al contrato
  0.26.0 dicen «—» en días trabajados.
- **Reabrir** es de Administración, con motivo de 10 a 500 caracteres. Un 409
  `closure_not_closed` quiere decir que otra persona ya la reabrió: la ficha
  lo dice y vuelve a pedir el cierre.
- **Supervisión** ve sólo las corridas de su sede: la de toda la empresa no
  aparece y el banner lo explica; lo que cerró sí. Auditoría consulta.

La validación del backend y el guion de aceptación están en
[Validación de cierres](validacion-cierres.md).

Reglas de las corridas que la pantalla respeta:

- Mientras una corrida de esa semana y ese alcance no termina, pedirla otra
  vez devuelve la misma: el botón se puede oprimir dos veces sin daño.
- `failed` no deshace nada: lo que alcanzó a cerrar sigue cerrado. Se pide
  otra.
- `closed` y `total` cuentan a todas las personas del alcance, también las
  que ya estaban cerradas: una segunda corrida dice «15 cerradas de 35»
  aunque sólo haya cerrado una más.
- `GET /week-closure-runs?week=` lista de la más antigua a la más reciente,
  también las que abrió el cierre programado, con `origin` en `scheduled`.
- Un cierre hecho por el sistema trae `closedBy` en nulo: se muestra «Cierre
  programado» donde iría el nombre de quien cerró.
- `POST /week-closures` cierra hasta 500 personas en la misma petición; el
  portal no lo usa.

## Usuarios y roles

La pestaña **Usuarios** sólo se muestra a `admin_empresa`. Lista usuarios con
cursor, estado, roles y empleado vinculado. Usa `GET /users`, `POST /users`,
`PATCH /users/{id}` y `POST /users/{id}/unlink`.

La invitación exige correo y al menos un rol; permite nombre y empleado
opcionales. No crea identidades, contraseñas ni envía correo. Crear la cuenta
en el realm `zenit` con el mismo correo verificado y configurar su contraseña
temporal y segundo factor sigue siendo tarea del administrador de Keycloak.

La edición no cambia el correo y manda sólo los campos modificados. Desvincular
del empleado envía `employeeId: null`; omitirlo conserva el vínculo. Habilitar
restaura el estado activo si existe identidad ligada, o invitado si no existe.
Si el backend responde `last_admin`, el formulario conserva sus valores:
agregar otro administrador habilitado antes de quitar ese rol o acceso.
Editar el propio acceso actualiza `/me` para ajustar la navegación.

**Desvincular cuenta** exige confirmar que la identidad anterior fue desactivada
en Keycloak: esta operación conserva los roles y no bloquea el acceso.

Desde el 11 de noviembre la pantalla usa la búsqueda `q` y los filtros por
rol, estado y permiso de expediente de `GET /users`, y sus conteos en
`GET /users/summary` (ver la actualización al inicio). Reportes todavía no
usa `GET /exports` ni `GET /dossiers` para su historial, ni los filtros de la
bitácora con su cuenta acotada en `GET /audit-log/summary`.
Si la cuenta anterior sigue activa con el mismo correo verificado, vuelve
a vincularse al entrar. Para quitar el acceso a la empresa, deshabilitarlo.
Ni habilitación ni desvinculación cambian contraseñas o segundo factor.
El rol Trabajador dispone de **Mi asistencia**: consulta su semana y el acuse
vigente recuperado del servidor. No permite consultar a otro empleado ni
enviar acuses desde la web. El envío se realiza desde Android personal o API.
La aceptación por rol se registra con el guion A5.

Prueba manual sugerida en Zenit Demo:

1. Entrar como administración; comprobar que aparecen las cuatro cuentas demo.
2. Invitar `demo.nuevo@zenit.example` con rol Auditoría: queda Invitado,
   sin recibir correo. No necesita crear otra identidad para comprobar la lista.
3. Cambiar nombre o roles de esa invitación y vincular/desvincular un empleado.
4. Deshabilitar y habilitar la invitación; debe volver a Invitado.
5. Intentar deshabilitar al único administrador: debe conservar el formulario
   y mostrar el rechazo del servidor. Cancelar y conservar el acceso demo.
6. Entrar como RH, supervisión y auditoría: no deben ver Usuarios.

La desvinculación real se prueba sólo con una cuenta secundaria desactivada
previamente en Keycloak. No usar la cuenta del único administrador para ese ensayo.
Pruebas automatizadas: formularios y permisos en jsdom con API simulada.
El usuario comprobó Usuarios con sesión real; los casos específicos de
desvinculación y último administrador no se dan por verificados sin evidencia.

## Exportes

La pantalla implementada permite elegir una fecha de la semana y una sede
opcional, y solicitar un CSV. Conserva la clave de idempotencia al reintentar
un fallo; cambia la clave al modificar el pedido o tras una solicitud exitosa.
Consulta el estado cada cinco segundos mientras está en cola. Si la consulta
falla, pausa y ofrece **Actualizar estado**. Sólo habilita **Descargar CSV**
cuando está listo y descarga por el cliente autenticado, sin abrir una URL
con credenciales. Se puede solicitar otro archivo con **Solicitar CSV**.

Después de descargar, el backend informa `expired`, que se presenta como
«No disponible (usado o vencido)». El manifiesto sigue disponible y se guarda
como JSON. La pantalla muestra el SHA-256 informado por el servidor, pero
no comprueba automáticamente la huella del archivo ni del manifiesto.
No hay historial: el API no lista exportes y al abandonar la pestaña se
pierde la referencia del pedido en pantalla. No se persisten tokens ni archivos.

Verificación del 19: 148 pruebas del portal y compilación correctas. El usuario
comprobó la descarga única con sesión real. Para repetir en la demo, elegir
`2026-10-05`, dejar todas las sedes y comprobar cuatro filas en el CSV.

Pedir, esperar y descargar:

```ts
// Sin probar: ilustra el orden de las llamadas.
async function exportar(api: string, token: string, semana: string): Promise<Blob> {
  const cabeceras = { Authorization: `Bearer ${token}` };
  const clave = crypto.randomUUID(); // una por intención; se conserva al reintentar
  const pedido = await fetch(`${api}/exports`, {
    method: "POST",
    headers: { ...cabeceras, "Content-Type": "application/json", "Idempotency-Key": clave },
    body: JSON.stringify({ weekStart: semana, format: "csv" }),
  }).then((r) => r.json());

  let exporte = pedido;
  while (exporte.status === "queued") {
    await new Promise((listo) => setTimeout(listo, 2000));
    exporte = await fetch(`${api}/exports/${pedido.id}`, { headers: cabeceras }).then((r) => r.json());
  }
  if (exporte.status !== "ready") throw new Error(`Exporte ${exporte.status}`);

  // downloadUrl es relativa al servidor del API.
  const archivo = await fetch(new URL(exporte.downloadUrl, api), { headers: cabeceras });
  if (!archivo.ok) throw new Error(`Descarga ${archivo.status}`);
  return archivo.blob();
}
```

- La descarga pide la credencial: no se puede abrir el enlace en otra pestaña
  ni ponerlo en un `<a href>`. Se descarga con `fetch` y se entrega al
  navegador como archivo.
- El archivo se descarga una sola vez y vale quince minutos. Para tenerlo otra
  vez se pide otro exporte.
- 422 con el error `no_closed_weeks`: esa semana, o esa sede, no tiene cierres
  vigentes.
- `failed`: no se pudo preparar; pedirlo otra vez.
- El manifiesto (`GET /exports/{exportId}/manifest`) sigue disponible después
  de descargar. Sirve para comprobar un archivo guardado: su `fileSha256` debe
  ser el SHA-256 del archivo. Si la pantalla comprueba la huella del propio
  manifiesto contra `manifestHash`, debe calcularla sobre los bytes de la
  respuesta, sin pasarla antes por `JSON.parse`.
- El archivo es un CSV en UTF-8 que una hoja de cálculo abre con sus acentos.

## Listas

Todas las listas son paginadas con cursor. Usar «cargar más» o desplazamiento
continuo, no números de página: el API no da el total.

## Errores en pantalla

- 422: marcar cada campo con su `errors[].message`.
- 409: mostrar el motivo según `code` y recargar.
- 403: no debería ocurrir si el menú respeta los roles; si ocurre, avisar y
  volver a pedir `GET /me`, porque los roles pudieron cambiar.
- 429: la persona pasó su cuota de peticiones por minuto. Esperar y reintentar
  con pausa creciente; no reintentar en ciclo cerrado. Una pantalla que
  consulta el avance de algo debe hacerlo cada varios segundos, no sin pausa.
- En cualquier error, dejar a la vista el `correlationId`.

## Configuración de empresa

La pestaña Configuración consulta `GET /tenant`, sin pedir un identificador de
empresa: el backend toma la empresa de la sesión. Administración, RH, supervisor
y auditoría pueden verla; sólo administración puede editar mediante `PATCH /tenant`.
Muestra nombre, identificador, zona horaria, inicio de semana, política de
descansos y cierre programado.

La edición conserva el identificador y envía sólo los campos modificados. El
cierre programado admite de 1 a 168 horas después del fin de la semana; dejarlo
vacío envía `null` y lo desactiva. Un rechazo conserva el formulario. Guardar
actualiza también la cuenta y las consultas; un refresco mientras se edita no
sobrescribe campos ajenos que la persona no haya cambiado.

El 19 de octubre de 2026 pasaron 148 pruebas del portal y su compilación. Nueve
pruebas de Configuración cubren permisos, cambios parciales, desactivación,
formularios con error y refresco durante la edición. La navegación tiene una
prueba adicional. La pantalla se recorrió después con sesiones reales por rol
en A5 local del 21; falta su despliegue y aceptación pública y del usuario.

Ese mismo día pasaron horarios, asignación futura e importación por API HTTPS
con una sesión real de administración: validación sin escritura, aplicación
parcial, repetición sin duplicados, actualización, sede inexistente y archivo
vacío. El [guion](../infra/test-directory-api.mjs) exige datos ficticios y limpia
sus empleados y sede; no sustituye la prueba de las pantallas ni de otros roles.

## Lista de comprobación

- [ ] Los tokens viven en memoria y se renuevan solos.
- [ ] El menú sale de los roles de `GET /me`.
- [ ] Las fechas se muestran en la zona de la empresa.
- [ ] La carga del padrón valida antes de aplicar.
- [ ] El código de enrolamiento se muestra una vez, con su vencimiento.
- [ ] Resolver una incidencia exige motivo.
- [ ] El exporte se descarga con credencial, no con un enlace.
- [ ] Cerrar a toda la empresa usa la corrida de cierre y muestra su avance.
- [ ] Un cierre sin `closedBy` se muestra como hecho por el cierre programado.
- [ ] Soltar la liga de una cuenta explica que no quita el acceso.
- [ ] Suspender una empresa pide motivo y confirmación.
- [ ] Ninguna pantalla recalcula lo que el servidor ya calculó.
