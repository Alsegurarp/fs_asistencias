# Bitácora de trabajo

Las entradas están ordenadas por fecha y describen el resultado de cada
sesión. Expresiones como «sin teléfono», «pendiente» o «en ejecución» dentro
de una entrada antigua no sustituyen el [estado vigente](estado-y-pendientes.md)
ni los avances posteriores. Se preservan los commits, conteos y límites
originales para no atribuir pruebas de una versión a otra.

## 8 de noviembre de 2026 — Cierres según el lienzo

Rama `feat/portal-cierres` desde `main` en `718e72c` (PR #40 integrada y
desplegada). Tercera pantalla del bloque 1 (OPE-04, OPE-09 a 11, TEL-10):
la última corrida de la semana con su avance, los acuses que filtran la
lista, las pestañas de cerradas, bloqueadas y reabiertas, el diálogo «Cerrar
las pendientes» con el alcance y quiénes seguirán bloqueadas, y el cierre de
una persona con lo congelado, sus días trabajados, su acuse y reabrir con
motivo. Retira la pantalla anterior de Cierres: el portal ya no cierra
personas elegidas, sólo pide corridas. Las bloqueadas salen de las
incidencias abiertas que bloquean el cierre, agrupadas por persona.

Hallazgos al recorrerla, ya corregidos: dos personas del simulador con el
mismo nombre en sedes distintas no se distinguían (las bloqueadas llevan su
sede si el nombre se repite y las cerradas el número de empleado); para
Supervisión, que sólo ve las corridas de su sede, el banner decía «Sin
corridas» junto a nueve semanas cerradas por una corrida de toda la empresa
(ahora lo explica); y pedir otra corrida tras una fallida validaba fuera de
la petición, con un error sin atrapar si la sede no era válida.

Pruebas: 253 del portal en 24 archivos, con el contraste de los colores
nuevos. Recorrido en Chromium contra un entorno local aislado con 35
personas del simulador y una semana terminada: 23 vistas de los cuatro roles
de empresa y la operación, a 1440 y 390 px, sin errores de consola, sin
respuestas fallidas y sin desborde. Una corrida real de toda la empresa
cerró 15 de 35 en 5 segundos y bloqueó 20 (15 por incidencias y 5 tramos
sin salida que pasaron a incidencias); la ficha mostró los días congelados;
reabrir pasó a la persona a Reabiertas y una segunda corrida la volvió a
cerrar; RH cierra sin reabrir, Auditoría consulta por enlace directo y
Supervisión ve su sede. Sin despliegue: espera la PR.

## 8 de noviembre de 2026 — Días de la semana en el cálculo y el cierre

Rama `feat/dias-de-la-semana` desde `main` en `a48f7ea` (PR #39 integrada y
desplegada). Fase 6 del backend de la maqueta, decidida antes del piloto: el
cálculo ya repartía cada día en ordinario y extra y lo descartaba; ahora
`WeekCalculator` lo entrega en `days`, `WeekCore` lo congela en el cierre,
la semana de una persona lo entrega (calculada o congelada) y la asistencia
de la empresa dice cuántos días trabajó cada persona y cuántos llevan extra.
Un cierre anterior no guardó los días: se entregan nulos y nada se recalcula.
Contrato 0.26.0. El portal muestra el reparto por día en la ficha de
Asistencia, «Extra N de M días» en la tabla y el aviso del lienzo.

Pruebas: unitarias del cálculo (la suma de los días es la semana, el tope
semanal pasa días enteros a extra, un turno de noche se queda en su día) y de
integración (los días suman los totales, se congelan al cerrar y un cierre
sin días responde nulos), suite completa del backend y 258 del portal. Sin
despliegue: espera la PR.

## 8 de noviembre de 2026 — Incidencias según el lienzo

Rama `feat/portal-incidencias` desde `main` en `9327414` (PR #38 integrada y
desplegada). Segunda pantalla del bloque 1: lista y tablero (OPE-03, OPE-05),
resueltas con su historial (OPE-06), «Todo en orden» (EST-08) y teléfono
(TEL-02, TEL-09). Retira la pantalla anterior de Incidencias; las piezas que
todavía usan Cierres, Dispositivos, Usuarios y Mi asistencia pasan a
`legacy.tsx`. El menú lleva el conteo de abiertas. El contrato sube a 0.25.0:
`q` en `GET /incidents`, por nombre o número, antes de paginar, con su caso
en `OperationIT`. Cierres y Asistencia abren Incidencias con la semana y la
incidencia en la dirección.

Arreglo encontrado al recorrerla: el texto sólo para lectores de pantalla
medía 100 % (en `sx`, un ancho de 1 es 100 %) y desbordaba la página; ahora
es una pieza de `ui.tsx` en píxeles, con prueba.

Pruebas: 258 del portal en 24 archivos y la suite completa del backend, con
el contrato validado. Recorrido en Chromium contra un entorno local aislado
con 35 personas del simulador y 20 incidencias de una semana ya terminada:
22 vistas de los cuatro roles de empresa y la operación, a 1440 y 390 px,
sin errores de consola, sin respuestas fallidas, sin desborde y con un solo
h1; asignar a RH, resolver como justificada, ajustar excluyendo una lectura
repetida, confirmar una sincronización tarde, el historial de una resuelta,
«Ver su semana», enlace directo sin sesión y Supervisión con sólo su sede.
Repetido el de Asistencia: 28 vistas, sin hallazgos. Sin despliegue: espera
la PR.

## 8 de noviembre de 2026 — Asistencia según el lienzo

Rama `feat/portal-asistencia` desde `main` en `a11fdcc` (PR #37 integrada y
desplegada en el ambiente publicado ese día). Primera pantalla de Operación
del bloque 1: tabla de la semana de cada persona (OPE-02), ficha con semana,
marcajes y cierres (OPE-02, OPE-07, OPE-08), carga (EST-09) y teléfono
(TEL-07, TEL-08), en `/asistencia`, que pasa a ser el inicio de
Administración, RH, Supervisión y Auditoría. Piezas compartidas para las
siguientes secciones en `ui.tsx`. El contrato sube a 0.24.0: `q` en
`GET /attendance/weeks`, buscado en el servidor antes de paginar, con su
prueba de integración.

Arreglos del marco al recorrerlo: el encabezado de página ya no toma el foco
cuando sólo cambian los parámetros de la dirección (al cambiar de pestaña de
la ficha, Escape dejaba de cerrarla), y el regreso del inicio de sesión
conserva los parámetros, no sólo la ruta.

Pruebas: 257 del portal en 24 archivos y la suite completa del backend, con
el contrato validado. Recorrido en Chromium contra un entorno local aislado
con 34 personas del simulador de dispositivos en dos sedes y un horario
asignado a la mitad: 28 vistas de Administración, RH, Supervisión (con una
sola sede) y Auditoría, a 1440 y 390 px, sin errores de consola, sin
respuestas fallidas, con un solo h1 y sin desborde; filtros, búsqueda, sede,
segunda página, semana anterior, ficha y sus pestañas, Escape y atrás,
exportar (CSV de 34 filas) y enlace directo a una ficha sin sesión. Quien
opera el servicio recibe la pantalla de sin permiso.

Hallazgos: la semana calculada no trae el tiempo extra de cada día, que el
lienzo muestra en la ficha; `GET /week-closures` pide la semana, así que la
ficha consulta los cierres de las últimas seis; el marcaje no dice con qué
tarjeta se hizo. Detalle en [Construir el portal](construir-el-portal.md).
Sin despliegue: espera la PR.

## 8 de noviembre de 2026 — Marco del portal según el lienzo

Rama `feat/portal-base` desde `main` en `eafc2ad`. El portal adopta el marco
del lienzo aprobado: `design.ts` con sus valores, tema de MUI, direcciones
con `react-router` (ya instalado y sin uso), menú por rol en `sections.ts`,
`Shell.tsx`, `Portal.tsx` (reemplaza a `Workspace.tsx`), `More.tsx` y
`States.tsx`. Inter 5.3.0 se empaqueta con el portal. Las pantallas
anteriores se montan en su dirección sin cambios, salvo que el expediente,
tras descargar, deja la dirección en `/reportes/expediente` en lugar de `/`.

Pruebas: 233 aprobadas en 21 archivos, en el contenedor de construcción; las
del marco cubren menú y pestañas por rol, permiso explícito del expediente,
regreso de la verificación sin permiso, inicio por rol, página no
encontrada, consola de operación, ocultar el menú, menú de la cuenta,
teléfono, paso de Cierres a Incidencias, contraste de los colores del lienzo
y revisión automática de accesibilidad.

Recorrido en Chromium contra un entorno local aislado, con datos ficticios y
cuentas de los cinco roles con contraseña y código de segundo factor: 41
vistas a 1440 y 390 px sin errores de consola, sin respuestas fallidas, con
un solo h1 por página y sin desborde horizontal; alta real de una sede;
enlace directo sin sesión que vuelve a su pantalla; cerrar sesión y volver a
entrar; y el expediente completo: conceder permiso, solicitar, verificar con
contraseña y código nuevo, volver por `/dossier/callback` y descargar el ZIP.
El recorrido corrió en el contenedor de Playwright 1.52.0.

Hallazgos: con la empresa suspendida, `/me` responde sin empresa ni roles,
igual que una cuenta sin acceso, y el portal no puede mostrar la pantalla de
empresa suspendida; el lienzo no tiene «Mi asistencia» ni destino para
«Ayuda y soporte»; su panel de marca trae una cifra de ejemplo que el portal
no muestra. Sin despliegue: espera la PR.

## 6 de noviembre de 2026 — Corrección del análisis de imágenes de la PR #30

La [PR #30](https://github.com/Alsegurarp/fs_asistencias/pull/30) está abierta
contra `main`, sobre la rama publicada `fix/comida-acuses-respaldo-s3`.
En el [CI de `7d9dd15`](https://github.com/Alsegurarp/fs_asistencias/actions/runs/42299368750)
aprobaron backend/identidad, portal y Android. En contrato/seguridad también
aprobaron contrato, secretos, construcción y las dos autopruebas de respaldo.
El análisis final bloqueó `db` y `backup`: `CVE-2026-107891`, gravedad alta,
en `musl` y `musl-utils` 1.2.6-r2. Las otras tres imágenes aprobaron.

Se exige `musl>=1.2.6-r3` y `musl-utils>=1.2.6-r3` en la etapa `database`
de `infra/postgres/Dockerfile`, heredada por `backup-tools`. Es el mismo
patrón que ya usa el backend; no cambia PostgreSQL, age ni la política de
análisis. [Alpine registra la corrección en esa revisión](https://security.alpinelinux.org/vuln/CVE-2026-107891).
Comprobadas herencia, versiones mínimas y diff. Docker local sigue denegado;
la reconstrucción, restauración y análisis del cambio quedan a la siguiente
ejecución remota. Sin excepciones nuevas, merge ni despliegue.

## 6 de noviembre de 2026 — Ejecución con tres agentes

Por instrucción del usuario trabajaron tres agentes en portal, Android y E6.
Portal: ajuste mínimo de línea en ID/huella del acuse y fixture con SHA-256
completo; 27 dirigidas y TypeScript aprobados por el agente, 218 globales y
build Vite aprobados por coordinación. E6: revisión de código y autoensayo
Jackson contra JSON adicional, sin defecto confirmado ni cambios redundantes.
Android incorpora una regresión de cancelación y aprueba tres escenarios del
helper de producción en autoensayo compilado localmente; la suite offline no
resolvió AGP 9.4.1, por lo que la regresión JUnit nueva sigue sin ejecutarse.
Los detalles de validación se conservan en el acta.

Se preparan IAM y lifecycle en archivos privados para `Cliente-demo` desde
ejemplos versionados; campos/aislamiento de prefijo comprobados, sin AWS real.
DNS observado desde la estación mantiene CNAME al dominio raíz, con IP ajena
a la VPS declarada. Consulta HTTPS rechazada desde esta sesión; Docker y
control visual siguen inaccesibles. Sin SSH, aplicación de permisos, cambios
DNS, despliegue ni purga. [Acta y condiciones restantes por tarea](qa-continuacion-multiagente-2026-11-06.md).

## 6 de noviembre de 2026 — Dominio y recursos declarados

Recibidos por chat `https://zenit.fastsolution.com.mx/`, 2 CPU, 8 GB RAM y
50 GB de disco. El origen sin barra final y la identidad en `/id` ya coinciden
con `servidor.env`; no fue necesario modificar las URL. Se actualiza el
formulario y seguimiento. «Linux» confirma la familia del sistema; queda
identificar distribución/versión, espacio libre y permisos efectivos al disponer
de acceso. Sin consultas DNS, conexión SSH, cambios de nginx ni despliegue.

## 6 de noviembre de 2026 — Incorporación de respuestas de infraestructura

Leído `D:/Code/fs_asistencia/secrets-respuestas-cierre.md` sin modificarlo.
Respuestas parciales del bloque 1: alias `Cliente-demo`, IP, responsables,
nginx existente y usuario de despliegue sin sudo. Se completan `HostName` e
identificador `ZENIT_INSTANCE_ID` en los archivos privados ignorados. Se
retira `User root` del ejemplo y se deja un marcador de usuario pendiente;
puerto 22 aún provisional. Comprobaciones locales de IP, formato del ID y
contenido escrito aprobadas; no se ejecutaron suites funcionales ajenas a
estos cambios de configuración/documentación.

El archivo menciona `authorized_keys` y `known_hosts` sin ruta; el perfil
local sólo contiene `config`. Faltan clave privada y host verificado. También
dominio, nombre/puerto SSH, acceso Docker efectivo y recursos cuantificados;
la cadena recibida es del kernel, no identificación completa de distribución.
Se actualiza el formulario y se detalla la preparación administrativa por
Alexis, preservando nginx y sin otorgar sudo/acceso adicional. No se conecta
por SSH, modifica infraestructura ni habilita el despliegue. Las demás
respuestas no se infieren: continúan 17 tareas y seis P0.

## 6 de noviembre de 2026 — Continuación y verificación del portal

Revisados el árbol local y los pendientes sin sustituir los cambios previos.
**218 pruebas web en 20 archivos, TypeScript y build Vite 8.1.0 aprobados**.
El comando habitual de pruebas falló antes de ejecutarlas con `spawn EPERM`
al intentar iniciar esbuild. Se reutilizó la configuración de ensayo local
existente, sin cambiar dependencias ni configuración de producción:

```powershell
node web/node_modules/vitest/vitest.mjs run --config build/continuacion-qa/vitest.config.mjs --configLoader native --pool threads --maxWorkers 2 --reporter dot
# Desde web/:
npm run lint
node node_modules/vite/bin/vite.js build --configLoader native
```

La suite conserva avisos React de actualizaciones fuera de `act`; el build
conserva el aviso de bundle mayor de 500 kB. Identidad estática, mediante
`node --test infra/keycloak/realm.test.mjs infra/keycloak/health.test.mjs`:
cinco aprobadas, cero fallos y seis casos de runtime omitidos.

Docker devolvió acceso denegado a la tubería del motor. Git Bash tampoco
pudo crear su signal pipe; no se ejecutó otra autoprueba externa. Computer
Use devolvió tubería nativa inexistente y host del navegador indisponible;
no hubo recorrido manual. Los ensayos reales anteriores conservan su fecha.

Se comprobó sin red que el bucket privado y su región coinciden con
`bucket.md`, sin mostrar valores ni modificar el archivo. El perfil SSH aún
contiene `IP_VPS`, sin `identity` ni `known_hosts`; instancia y clave pública
age siguen vacías. Se solicitaron los datos faltantes y custodios sin pedir
secretos por el chat. No se contactó AWS/Hostinger, publicó, desplegó ni purgó.
Se mantienen 17 tareas abiertas total o parcialmente y seis P0.

## 6 de noviembre de 2026 — Confirmación definitiva del bucket AWS

El usuario confirma usar el bucket AWS aportado en `bucket.md`, región
`us-east-2`; queda sustituida la referencia intermedia a Firebase/GCS y no
se mantiene como opción de transporte. Continúa VPS Hostinger en United
States - Phoenix, diario/30 días, cifrado, RPO 24 h/RTO 4 h y custodia.

Se prepara `secrets/hostinger/respaldo.env`, ignorado por Git, con el nombre
exacto del archivo y su región. Faltan identificador de instancia, clave
pública age e identidad técnica AWS del perfil `zenit-respaldo`; no se
generaron claves ni credenciales. Transporte AWS nativo y **autoprueba final
aprobados**: carga condicional sin sobrescritura, frontera de 5 GiB, descarga
y SHA-256 antes de rotar, fallos, retención exacta por prefijo y concurrencia.
Un paquete mayor de 5 GiB se conserva localmente y requiere multipart
condicional. Se mantiene análisis JSON con Python estándar; no se agrega
soporte para GCS ni endpoints alternativos. Workflow parseado y diff limpio.
Evidencia: `build/qa-infra-20261106/s3-native-final.log`.

Se actualizan guía y decisiones vigentes, conservando los ensayos anteriores
con sus fechas. La configuración privada se comparó con el nombre y región
de `bucket.md`; ignorada por Git. No se contacta ni modifica el bucket real,
no se repiten suites Android/web ajenas al cambio y no se ejecuta CI Linux.

## 6 de noviembre de 2026 — Región Hostinger y archivos para declarar el destino

El usuario confirma **United States - Phoenix** y completará IP/dominio.
Se prepara el perfil local ignorado `secrets/hostinger-ssh/config`, con
`HostName IP_VPS`, y `deploy/servidor/.env.despliegue`, apuntado a ese perfil.
El dominio se declara en las dos URL existentes de
`deploy/servidor/zenit/servidor.env`; la guía identifica también DNS, borde,
certificados y comprobaciones que deben adaptarse antes de desplegar con
otro nombre. No se añadieron variables que el guion no consuma.

Se encontró y leyó `bucket.md` en el directorio padre: nombre y enlace de
AWS S3/us-east-2, distintos del destino Firebase indicado previamente. Se
solicitó confirmar el proveedor; no se configuró como GCS ni se consultó la
cuenta. Quedan por recibir la clave SSH autorizada/identidad Google o AWS
según la aclaración, y la clave del host verificada. Sin conexiones remotas,
credenciales nuevas, DNS ni despliegue en este paso.

## 6 de noviembre de 2026 — Resolución general, E6 y comida visual offline

El usuario autoriza continuar todas las tareas y confirma **Hostinger para
VPS** y **Cloud Storage for Firebase/GCS para respaldo**, sustituyendo S3.
Se conservan instancia por cliente, cifrado, copia diaria/30 días, RPO 24 h,
RTO 4 h y custodia. Transporte externo adaptado y autoprueba final aprobada;
no hay
proyecto/bucket/acceso operativo ni configuración SSH local identificados.
Se solicitó identificar esos recursos sin enviar secretos por el chat y se
ofreció la integración Firebase disponible, aún sin instalación/conexión
confirmadas. No se provisionó ni desplegó.

Los frentes de trabajo completaron estas verificaciones locales:

- **E6/tarea 15:** [ensayo aprobado](qa-expediente-e6-2026-11-06.md) con
  PostgreSQL/Keycloak reales: cierre objetado/reabierto y nueva versión
  conforme, descarga MFA/PKCE, OTP incorrecto y repetición rechazados, JAR
  actualizado sin red y consulta de ambos históricos. Huellas de acuses
  recalculadas; anclaje externo incorrecto rechazado. Accesos ficticios
  retirados y empresa de ensayo suspendida. Semana sin marcajes: no prueba
  cálculo. No sustituye custodia ni aceptación integral/pública.
- **Portal/tareas 3/15:** corregido `PersonalAttendance` para no presentar
  como vigente un acuse de otro cierre. Dos regresiones fallaron antes y
  pasan después. **218 pruebas y build web aprobados**. Se conserva aviso
  de tamaño del bundle; no se añadieron dependencias.
- **Android/tarea 13:** [recorrido visual offline aprobado](qa-android-visual-2026-11-06.md)
  de la pantalla real en Samsung API 37, con sesión ficticia en memoria:
  aviso/vigencia en ambos sentidos, opciones de comida y limpieza de una
  selección obsoleta. Nueve capturas; red activa ausente durante el ensayo,
  radios restauradas y tres SHA-256 operativos intactos. 17 unitarias,
  lint/APK y manifiesto release aprobados; fixture sólo debug/no exportada.
  No se atribuye integración ViewModel/backend/reposo a esa fixture.
- **Identidad/tarea 2:** 11 casos distintos reales aprobados, incluidos MFA,
  12 códigos de recuperación y aplicación idempotente. Los primeros intentos
  de idempotencia fallaron por slash de configuración de ensayo y rename
  Windows sobre archivo montado; corregido el ensayo, resultado final 8/8
  de realm, sin omisiones, más los tres casos de flujos aislados.
- **Respaldo/tarea 1:** gcloud nativo, subida sin sobrescribir y descarga por
  flujo con SHA-256 antes de rotar. Validador JSON exige dos reglas exactas
  de 30 días por prefijo y rechaza borrados superpuestos o prefijos vacíos/
  mal formados; autoprueba final aprobada con esas regresiones. Se adaptan
  ejemplo/configuración/guía y CI con Python estándar del runner sin red,
  sin añadirlo a PostgreSQL/age. Workflow parseado; no se ejecutó CI Linux ni
  GCS real. [Guía vigente y migración del ejemplo AWS](respaldos-cifrados.md).

Al cerrar, se sincronizó el archivo privado de identidad del entorno QA con
su cliente técnico efectivo, restaurando el atributo de sólo lectura. Se
reinició únicamente su backend para cargarlo: autenticación técnica, lectura
administrativa sin cambios y salud `UP` aprobadas; copia temporal del secreto
retirada sin mostrar valores. Backend/identidad locales quedan disponibles.
Registros finales en `build/qa-infra-20261106/`.

El navegador/control nativo no estuvo disponible: E6 usó el protocolo HTTP
de prueba existente; no se presenta como aceptación visual del portal.
El [listado vigente por las 17 tareas](TareasPendientes.md#resolución-por-frente--6-de-noviembre-de-2026)
precisa lo resuelto técnicamente y recursos/decisiones restantes. Sin purga,
captura release, publicación ni modificación de reglas contractuales.

## 6 de noviembre de 2026 — Revisión de pendientes y vigencia de comida Android

Por instrucción del usuario se revisaron los pendientes con dos agentes y se
comprobó el Samsung conectado por ADB. Fetch y avance directo a
`origin/main/5b0a66c`; se preserva la entrada de cierre anterior que ya estaba
modificada localmente. PR #29 integrada, sin desarrollo E6 que repetir.
Docker Desktop iniciado y motor accesible fuera del sandbox, sin contenedores
en ejecución; backend/identidad no se levantaron en este ensayo.

Se encontró y corrigió un defecto de la tarea 13: `AttendanceViewModel`
mantenía aviso/política de comida obsoletos al llegar su vigencia sin otra
operación. Se añade una emisión local al vencer, cancelada al cambiar la
sesión o dejar de observar pantalla; al volver se relee el registro. Sin
sondeo periódico, red, cambios de formato ni cambio a validación de captura.

**Verificado ahora:** 17 unitarias Android sin fallos/omisiones, lint sin
errores (11 avisos), APK y autoensayo físico aprobados. Con almacén aislado
y servidor de fixture cerrado se comprobaron ambos sentidos de comida,
transición al vencer y retirada del aviso sin otra escritura. Los APK
conservan el certificado instalado; vinculación, base y WAL operativos
conservan exactamente sus SHA-256. [Acta y evidencia](qa-android-2026-11-06.md).

La prueba no acredita recorrido visual Compose, NFC autenticada ni aceptación
pública. Se mantienen 17 tareas abiertas y seis P0. Sigue el ensayo E6 de
expediente nuevo con dos versiones/acuses, MFA y JAR independiente, además
de comida visual y accesibilidad con sesión real. Sin commit, publicación,
despliegue ni purga; dependencias operativas externas sin cambios.

## 5 de noviembre de 2026 — Cierre de sesión y pendientes para el 6 de noviembre

Por instrucción del usuario se registra el trabajo para continuar mañana,
**6 de noviembre**, sin iniciar nuevas tareas en este cierre. La
[PR #29](https://github.com/Alsegurarp/fs_asistencias/pull/29) ya está integrada
en `main/5b0a66c701e78bb59a01e8750d96dbab01131c88`: verificación de integridad
del acuse en E6, cinco regresiones y acta Android real. El
[CI de la PR](https://github.com/Alsegurarp/fs_asistencias/actions/runs/42149454777)
aprobó sus cuatro trabajos, incluidos unitarias/integración PostgreSQL e
identidad. El fallo del push anterior fue HTTP 429 de Maven Central al
descargar JUnit/Objenesis antes de ejecutar pruebas; no requirió cambiar
código. La repetición local sin caché de tareas aprobó **96 unitarias, cero
fallos, errores u omisiones**. No queda pendiente corregir ese fallo ni
integrar la PR.

Android personal y terminal aprobaron contra backend local real. Se
retiraron accesos ficticios y túnel ADB; los tres archivos operativos del
teléfono conservaron sus SHA-256. El resultado y sus límites están en el
[acta del teléfono](qa-android-2026-11-05.md). No equivale a NFC autenticada
ni aceptación del entorno público.

### Pendientes declarados

Se conservan los IDs globales: **17 tareas abiertas total o parcialmente,
seis P0**. Las tareas 7, 11 y 14 ya están completadas técnicamente; sus
requisitos de aceptación pública relacionados siguen en los frentes de QA.

| Tarea | Prioridad | Trabajo restante para cierre |
| --- | --- | --- |
| 1 — Respaldo externo | P0 | Proveer S3 y custodios; activar respaldo diario/30 días y probar recuperación en destino con RPO 24 h/RTO 4 h. Automatización y ensayo local ya existen |
| 2 — Identidad operativa | P0 | Incorporar SMTP/remitente cuando se retome ese frente; cuentas personales, responsables/turnos y ensayo operativo de recuperación y doble aprobación. Los 12 códigos ya están implementados |
| 3 — Jornada y evidencia del acuse | P0 | Completar condiciones concretas de jornada, descanso computable y cruce anual; documento/texto versionado del acuse y atención de objeciones, conservando históricos |
| 4 — Tarjetas auténticas | P0 | Tecnología/protocolo, provisión y custodia de claves; integrar y probar captura/rechazo con tarjetas reales. Captura release continúa bloqueada |
| 5 — Reglas operativas | P0 | Aceptar en el destino las reglas ya implementadas de suspensión, baja y supervisores por sede; no repetir su desarrollo |
| 6 — Producción administrada | P0 | Proveer VPS/instancia privada por cliente, dominio y accesos; desplegar y comprobar aislamiento, operación y recuperación real |
| 8 — Proxies y cuotas | P1 | Prueba con dos IP públicas distintas; conserva su delegación a otro desarrollador y el aplazamiento del usuario |
| 9 — Recorridos del portal | P1 | Completar recorridos por roles con sesión real y aceptación del usuario en la versión desplegada |
| 10 — Retención Android | P1 | Conservar y recuperar sobres rechazados, recibos y evidencia sólo local antes de implementar purga acotada que preserve pendientes |
| 12 — Imágenes y despliegue | P1 | Obtener inventario efectivo del destino, comprobar imágenes y aceptar el despliegue; los análisis locales/CI no acreditan ese servidor |
| 13 — Empresa y dispositivos | P2 | Ratificar SUP-025; comprobar aviso/vigencia del cambio de comida sin red en teléfono, accesibilidad manual y aceptación desplegada |
| 15 — Semana, acuse y expediente | P2 | Verificar un expediente nuevo con acuses mediante el JAR actualizado y completar recuperación/aceptación integral E6 y pública |
| 16 — Operador | P2 | Aceptar pantallas y operaciones con sesión de operador en el ambiente objetivo; implementación local ya probada |
| 17 — Horarios y ausencias | P2 | Recabar condiciones del empleador y casos esperados; implementar retardos, faltas, salidas anticipadas, vacaciones e incapacidades con su evidencia |
| 18 — Capacidad y continuidad | P2 | Definir objetivos de carga y VPS; medir carga sostenida y continuidad, DNS y renovación real de certificados |
| 19 — Nómina | P2 | Recibir sistema/versión, formato o API y ejemplo ficticio del cliente; implementar y validar el conector concreto |
| 20 — Contrato 1.0 | P2 | Acordar compatibilidad con consumidores y congelar/publicar tras completar funcionalidades, recorridos y aceptación |

### Orden para retomar mañana

1. Sincronizar la base con `main` integrado y comprobar cambios posteriores,
   backend/identidad locales y autorización ADB. Este cierre conserva la rama
   local `fix/verificacion-evidencia-expediente/0e17805`; no la sincroniza.
2. **Expediente nuevo con acuses:** generar/descargar con MFA un ZIP ficticio,
   usar sus dos huellas del canal autorizado y ejecutar el JAR actualizado.
   Incluir versiones reabierta/vigente y verificar su consulta independiente;
   el ZIP histórico probado no contiene acuses.
3. **Comida sin red en Android:** comprobar visualmente aviso y vigencia
   programada con datos ficticios y almacén aislado; preservar los datos
   operativos y registrar condiciones de red, versión y restauración.
4. **Accesibilidad del portal:** completar teclado, foco, zoom 200 %, ancho
   320 px y lector de pantalla con sesión real; registrar pantallas/roles
   comprobados y defectos reproducibles.

Los tres ensayos técnicos anteriores pueden avanzar con el entorno de
pruebas disponible; la aceptación integral conserva sus requisitos. No se
inician provisión, despliegue, purga ni captura NFC release por esta nota.
El control del navegador terminó al no poder verificar su URL; comprobar
disponibilidad de control visual antes de los recorridos y no sustituirlos
por resultados de API o instrumentación. Provisión, SMTP diferido, claves de
tarjetas, especificación de nómina y aceptación de responsables continúan
según las dependencias registradas en [Tareas pendientes](TareasPendientes.md).

## 5 de noviembre de 2026 — Preparación de PR de integridad E6 y QA Android

Por instrucción del usuario se prepara la entrega de
`fix/verificacion-evidencia-expediente` contra `main/c63a9da`, que ya incluye
la PR #28. Su árbol coincide con la base `4d8c6aa` de las pruebas registradas;
el reflujo CSV y las seis pruebas de jornada quedan en la entrega anterior.
Esta entrega agrega la comprobación de huella y empleado del acuse en E6,
cinco regresiones y la evidencia de Android físico contra backend real.
No publica secretos, códigos, APK, bases ni registros locales. Las 96
unitarias backend y el JAR conservan su evidencia previa; Android conserva
15 unitarias, lint y los resultados instrumentales descritos en su acta.
La aceptación integral y los seis P0 conservan sus requisitos.

## 5 de noviembre de 2026 — Android contra backend real tras arranque manual

El usuario inició el proyecto aislado `zenit-android-check`: PostgreSQL,
Keycloak y backend saludables, migración finalizada. Se resolvió la colisión
de 38082 usando 48080/48082, sin detener servicios existentes. HTTP confirmó
salud e issuer. Se reutilizó la instrumentación actual y su almacenamiento
aislado, con empresa, padrón y tarjetas simuladas ficticios.

Personal aprobó activación/código de un uso, cola cifrada con transporte
interrumpido, persistencia entre procesos, sincronización, recibos,
idempotencia y renovación de sesión. Consulta y objeción de cierre versión 1,
recuperación sin copia local, duplicado 409, reapertura y conformidad versión 2
aprobados. API confirmó dos marcajes sin duplicados y ambos acuses históricos;
sus huellas SHA-256 se recalcularon y coincidieron. La semana cerrada anterior
no tiene marcajes; no es prueba del cálculo sobre los eventos actuales.

Terminal activó, pero el teléfono desapareció de ADB durante la fase de cola.
Tras reconectar por indicación del usuario se confirmaron tres pendientes
firmados en una copia de la base aislada y se continuó sin recapturar.
Sincronización, recibos, idempotencia, renovación y restricción de semana
personal (local y 403 real) aprobaron. No se recuperó la salida final de la
fase de cola interrumpida. API confirmó dos marcajes por modo sin duplicados.
Dispositivos ficticios revocados, empresa de ensayo suspendida y cuentas/
cliente temporales eliminados; secretos de esas cuentas retirados del estado.
Túnel ADB propio retirado y los tres archivos operativos del teléfono idénticos
por SHA-256 al terminar. [Acta y evidencia](qa-android-2026-11-05.md).
No acredita NFC autenticada, aceptación pública ni la suite completa de
integración; no se cambió código Android ni se publicó este avance.

## 5 de noviembre de 2026 — Android físico actual y nueva comprobación Docker

El usuario indicó que hay un Android conectado y pidió repetir Docker y
la prueba. ADB confirmó Samsung SM-S928B autorizado, ahora Android 17/API 37.
Docker volvió a denegar acceso en ambas tuberías conocidas; tampoco hay
backend/identidad escuchando en los puertos locales habituales revisados.
No se presenta ese rechazo como motor apagado ni como integración aprobada.

Se ejecutó la fixture instalada y luego se construyeron los APK actuales
desde el árbol Android `16f8c58e4a047c1505bdece98f3d24b00fc3841c`, base
`4d8c6aa`, sin fuentes Android modificadas. Gradle 9.6.0/JDK 25, cachés y SDK
existentes sin red; salida aislada en `build/android-check/`. Aprobaron
**15 unitarias, lint con 0 errores/7 advertencias y ambos APK**.

APK instalados anteriores preservados; certificados coincidentes comprobados
antes de actualizar con `adb install -r`. La fixture actual aprobó con
`INSTRUMENTATION_CODE: -1`. Vinculación, base operativa y WAL conservaron
exactamente sus SHA-256. Sin desinstalación, borrado operativo ni túnel ADB.
La [nueva acta](qa-android-2026-11-05.md) contiene hashes de APK, cobertura,
evidencia y límites. No se certifica NFC ni backend real con HTTP simulado.

La mejora local E6 conserva sus 96 unitarias previas; no se atribuye a la
fixture Android validación de ese JAR. Los servicios reales, teléfono con
tarjeta autenticada, aviso visual de comida offline, identidad y aceptación
pública siguen pendientes. No se publicó ni desplegó este avance.

## 5 de noviembre de 2026 — Tareas disponibles e integridad del acuse en E6

El usuario pidió verificar los frentes realizables y comenzar. Se confirmó
el [CI de `4d8c6aa`](https://github.com/Alsegurarp/fs_asistencias/actions/runs/42116138374)
con sus cuatro trabajos aprobados. La rama anterior está publicada, pero no
se creó la PR: conector 403, credencial no disponible dentro del sandbox y
solicitud de elevación rechazada por la política de la sesión. El navegador
llegó al inicio de sesión de GitHub; se solicitó al usuario ese paso y no se
automatizó. El control del escritorio dejó después de devolver un proceso
de ventana. No se declara creada ni integrada una PR inexistente.

Se abrió `fix/verificacion-evidencia-expediente` desde ese commit y se
ejecutó el trabajo técnico de E6 que no requiere decisiones nuevas: el
verificador sólo comprobaba la huella del snapshot del cierre y referencias
existentes; ahora recalcula la del acuse y comprueba que su empleado coincida
con el del cierre. La fórmula es la del backend desde `ae92c881`; se conserva
la fecha como instante UTC, nota exacta, tipo y actor histórico. El archivo
se recorre en dos pasadas; el índice agrega hash/empleado de cada cierre.

**Prueba de regresión:** antes del cambio, tres pruebas nuevas fallaron al
aceptar nota incoherente, empleado distinto y traslado a otra versión del
cierre, aun con hashes externos/estructurales coherentes. Después aprobaron
las nueve del verificador y las **96 unitarias backend**, sin fallos, errores
ni omisiones. Los cinco casos nuevos abarcan además seis alteraciones de
campos, conformidad sin nota, objeción con Unicode/separadores, microsegundos,
zona distinta, actor de dispositivo ausente y cierre reabierto.

**Artefacto:** `:backend:dossierVerifierJar` aprobado. El JAR nuevo aceptó el
ZIP ficticio histórico de `build/e4-e5-qa/expediente.zip` usando sus huellas
conservadas y rechazó una huella de manifiesto falsa con salida 1. El ZIP
histórico no contiene acuses; los acuses se comprueban en las fixtures nuevas.
No se sustituyen por este resultado una descarga nueva o aceptación integral.

Gradle 9.8.0/JDK 25 sin red, caché de lectura y Kotlin en proceso. La salida
habitual tenía escrituras concurrentes del editor; se aisló mediante init
script temporal en `build/e6-check/`, sin detener procesos del usuario ni
cambiar configuración versionada. Informes en `build/continuacion-qa/`:
`e6-before-isolated.log`, `e6-final.log`, `e6-jar-historical.log` y
`e6-jar-bad-anchor.log`. `git diff --check` correcto.

Formato 1, contrato, API, base y productor del expediente sin cambios. No
hay nueva custodia, texto jurídico, purga, autenticación de tarjeta ni
despliegue. Docker vuelve a denegar acceso: no se repitieron PostgreSQL,
identidad, Android, portal ni seguridad de imágenes para este cambio. Los
17 pendientes y seis P0 conservan sus requisitos. Este avance queda local.

## 5 de noviembre de 2026 — Continuación de jornada, evidencia y accesibilidad

Por instrucción del usuario se continuaron los frentes que no requieren
proveedor, SMTP ni tarjetas. Fetch correcto y base `origin/main/2ab9745`;
`main` local actualizado por avance directo y rama de trabajo
`fix/jornada-evidencia-accesibilidad`. Se conservaron las dos notas locales
de la verificación anterior. No se hizo commit, push, PR ni despliegue.

**Jornada:** seis pruebas nuevas en `WeekCalculatorTest`: inicio y fin
exactos de semana, turno que cruza Año Nuevo sin dividir su jornada, semana
con distinta regla suministrada conservando el resultado previo, adelanto
del reloj en Tijuana y equivalencia UTC/zona local. Las 21 del calculador
y después las 91 unitarias backend aprobaron, sin fallos ni omisiones. No
se modificó producción del calculador, migraciones ni reglas vigentes.
El caso de año no decide qué regla debe elegir el servicio para esa semana.

**Evidencia:** revisión de Room/DeviceStore, captura/recibos, acuse/consulta
semanal y columnas/esquema/verificador del expediente. Se añadió la
[matriz de recuperación](retencion-android.md#contraste-de-evidencia-para-continuar--5-de-noviembre-de-2026)
con diferencias concretas y siguiente desarrollo delimitado. Un rechazo
sin `echoKey` ni siquiera genera fila; copiar bases cifradas tampoco prueba
recuperación sin la clave Keystore. Se conserva la protección de pendientes.
No se implementó custodia nueva ni purga, ni se inventó el texto del acuse.

**Portal:** [QA manual parcial](accesibilidad.md#revisión-manual-parcial--5-de-noviembre-de-2026)
en Zen/Windows con componentes reales y respuestas simuladas. Un único
cambio de producción: `overflowWrap: 'anywhere'` en el párrafo de encabezados
CSV, cuyo desbordamiento y corrección se comprobaron a 320 px. El selector
de archivos sí abre con teclado; se descartó el cambio provisional de ese
control tras observar el diálogo nativo retrasado. No queda ese cambio ni
su prueba provisional en el árbol final.

**Validación final:** 91 unitarias backend y 216 pruebas web aprobadas, sin
fallos ni omisiones; las 21 del calculador incluyen los seis casos nuevos.
Se repitió la suite web completa sobre el árbol final después de restaurar
el selector original. TypeScript, build normal de Vite y `git diff --check`
aprobaron; persiste el aviso de paquete >500 kB.

Entorno: JDK 25/Gradle 9.8.0 sin red, caché de dependencias anterior en lectura
y caché de escritura dentro de `build/gradle-local`; Kotlin en proceso para
evitar escribir fuera del workspace. Vitest en threads con configuración
temporal de resolución/Oxc instalado para sortear `spawn EPERM` de Vite 7;
no se cambió configuración del producto ni se agregaron dependencias.
Informes temporales en `build/continuacion-qa/`. Fixture web retirada y
servidor temporal detenido al finalizar. No se tocaron servicios ajenos.

**Límites:** Docker sigue denegando acceso; no se repitieron PostgreSQL,
identidad ni hardware. No se ejecutó lector de pantalla ni aceptación
pública; las pantallas con datos simulados no prueban permisos/operaciones
del backend. Issue #18 sin modificaciones remotas. Permanecen 17 tareas
globales abiertas total o parcialmente y seis P0, con sus dependencias.

## 5 de noviembre de 2026 — Verificación de pendientes después de integrar la PR #27

Se contrastaron los pendientes con código, informes locales y GitHub.
La [PR #27](https://github.com/Alsegurarp/fs_asistencias/pull/27) ya está
integrada en `main/2ab9745` desde las 14:00 de Ciudad de México. Los cuatro
trabajos del [CI de main](https://github.com/Alsegurarp/fs_asistencias/actions/runs/42099223401)
aprobaron: backend/identidad, portal, Android y contrato/seguridad/respaldo.
Esto sustituye el estado «CI por concluir» de la entrada de publicación;
no acredita despliegue, hardware ni aceptación operativa.

Antes de editar documentación, Git estaba limpio en la rama de #27,
`3560d4f`; `main` local seguía en `645174d`. No se sincronizaron ramas ni se
modificó código. Docker deniega acceso a la tubería desde esta sesión;
no se declara detenido ni se infiere el estado de sus servicios. Se
recontaron 186 pruebas backend existentes sin fallos/errores/omisiones y se
consultaron los informes anteriores de 216 web, 14 identidad y S3 simulado;
no se ejecutaron de nuevo.

El [contexto para continuar](TareasPendientes.md#verificación-para-continuar--5-de-noviembre-de-2026-posterior-a-la-pr-27)
ordena los 17 pendientes y sus dependencias, con seis P0. Ya no corresponde
implementar Q10–Q13, códigos de recuperación ni automatización S3 otra vez.
La issue #18 sigue abierta y desactualizada en GitHub; se registra su
conciliación pendiente sin modificarla. SMTP y prueba de dos IP conservan
el aplazamiento del usuario. No se desplegó, purgó ni habilitó captura release.

## 5 de noviembre de 2026 — PR #27 de jornada, operación y guía de demo

Por instrucción del usuario se abrió la
[PR #27](https://github.com/Alsegurarp/fs_asistencias/pull/27), lista para
revisión hacia `main` desde `feat/jornada-operacion-y-guia-demo`, con todos
los cambios actuales del producto y la documentación previa preservada.
Commit de implementación: `985a520`; base remota comprobada: `645174d`, sin
divergencia respecto de `main` local antes de crear la rama. Se añade después
este registro del enlace en un commit documental de la misma PR.

Alcance: candidato 0.18.0 y migraciones V012/V013; supervisores por sedes,
baja con fecha y suspensión aprobadas; cálculo diario/semanal de jornada;
colección de sedes de supervisión en expediente/verificador; recuperación
Keycloak con 12 códigos de un uso; automatización de respaldo externo S3 y
su paso de CI; correcciones de imágenes; decisiones/revisión legal,
seguimiento individual de las 17 tareas y guía de demo de 12 páginas con
fuente reproducible e ilustración ficticia.

Validación de esta entrega: se conservan los resultados del árbol integrado
registrados abajo (85 unitarias backend, 101 integraciones PostgreSQL, 216 web,
14 identidad, contratos, compilación, recuperación local y autoprueba S3,
cinco imágenes sin críticas/altas y análisis de secretos sin hallazgos).
Antes de publicar se comprobó `git diff --check` y el inventario de archivos;
no se incluyeron secretos, dependencias locales ni resultados temporales.
Se declara el PDF binario en `.gitattributes` para preservar sus bytes y
evitar conversión de finales de línea al clonarlo desde Windows.
No se repiten las suites por el único cambio documental de preparación.

La PR reúne avances implementados y límites expresos; no declara terminadas
las 17 tareas ni habilita datos reales. No incluye integración automática a
`main`, despliegue, captura física release, purga Android o aceptación jurídica
integral. GitHub confirmó PR abierta, no borrador y base `main`; el CI remoto
se inicia al publicar y queda pendiente de concluir. No se presenta su estado
como aprobado por los resultados locales. El conector GitHub devolvió 403
por permisos de la integración; se publicó con la autenticación Git ya
disponible, sin copiar credenciales al repositorio.

## 5 de noviembre de 2026 — Ejecución de las 17 tareas por necesidad inmediata

El usuario solicita ejecutar las 17 tareas abiertas, comenzar por necesidad
inmediata y registrar aquí su avance. Se conservan los IDs de la lista global.
Primero se atienden los seis P0 que impiden uso con datos reales; los frentes
que requieren recursos externos continúan con preparación verificable mientras
se obtienen esos recursos. Una implementación local no equivale a aceptación
pública, prueba física, autorización jurídica ni contratación de infraestructura.

| Secuencia | Tarea / necesidad | Resultado ejecutado | Pendiente para cierre integral |
| --- | --- | --- | --- |
| 1 | 1 — Respaldo, P0: evitar pérdida | Automatización diaria S3 cifrada por instancia, verificación descargando bytes, rotación local sólo tras éxito, regla S3 de 30 días/versiones, servicio/timer y autoprueba de fallos. Ensayo de restauración coherente de ambas bases sin origen aprobado | Proveer bucket/endpoint/rol y custodios; instalar/activar timer y monitorización; recuperar desde S3 real en el destino y medir RPO 24 h/RTO 4 h. No se activó un servicio ficticio |
| 2 | 2 — Identidad, P0: recuperar acceso | Keycloak 26.8.1 admite contraseña + código de recuperación en el acceso normal; 12 códigos, consumo único y conservación de OTP comprobados. Aplicación al realm existente idempotente y alta nueva configuradas; 14 pruebas reales/estáticas aprobadas | SMTP/remitente diferidos expresamente por el usuario; correo verificado/recuperación efectiva, nombres de turnos/aprobadores y simulacro de soporte. Doble aprobación documentada es procedimiento humano, no control automático añadido a Keycloak |
| 3 | 3 — Jornada/acuse, P0: resultados legales | V013: límites diarios diurno/nocturno/mixto, clasificación por tiempo nocturno, extra diaria/semanal sin doble conteo y alertas de distribución/límite combinado; se conservan versiones previas. 15 casos unitarios del cálculo e integración aprobados | Descanso computable según salida libre del centro, jornada contractual inferior, menores/regímenes especiales y criterio de cruce anual; texto/evidencia versionada y acuerdo de ambas partes para acuse, aceptación integral |
| 4 | 4 — Tarjeta auténtica, P0: confianza de captura | Revisado el bloqueo de release y herramientas de ejemplo; se conserva la protección de captura y se documenta en la guía | Tecnología MF1K/DESFire, tarjetas/lector/teléfono, claves/provisión y protocolo de autenticación aún sin respuesta. No basta retirar DEBUG; integración física pendiente |
| 5 | 5 — Reglas, P0: permisos e históricos | Q10–Q13 aprobadas e implementadas: suspensión conserva dispositivos existentes; baja exige fecha no futura, revoca tarjeta y termina horario aplicable; V012 limita supervisores por sedes antes de paginar. Portal/contrato/expediente actualizados y casos de seguridad aprobados, incluido auditor + supervisor | Aceptar la versión desplegada con el cliente. La implementación y regresión locales están completas; esa aceptación se comparte con 9/12/16 |
| 6 | 6 — Producción, P0: separación y recuperación | Sustituido Q01 por VPS/instancia privada por cliente; S3 gestionado por desarrolladores y custodio cliente con relevo documentado. Compatibilidad legal revisada sin atribuir a la LFT una tecnología concreta | Proveedor/región/cuenta/dominio, contratos/privacidad, bucket/accesos y entrega de custodias concretos. No se contrató ni se desplegó producción sin esos recursos |
| 7 | 12 — Imágenes, P1: versión y seguridad | Reconstruidas backend/web/Keycloak/backup/db. Detectadas y corregidas cuatro altas de libexpat en backend/web (2.10.0-r0); musl actualizado en backend. PostgreSQL antiguo sustituido por la construcción actual. Cinco análisis locales finales sin críticas/altas ni nuevas excepciones | IDs/commit reales del servidor por Gabriel, análisis de esas imágenes, despliegue y comprobación pública. Las etiquetas locales no prueban qué está publicado |
| 8 | 9 — Portal, P1: recorridos y aislamiento | 216 pruebas/compilación. Sesión real contraseña/OTP contra runtime aislado con V012/V013; comprobados Configuración, diálogo de comida y Usuarios/Supervisión; Escape devuelve foco al botón. Datos exclusivamente ficticios | Recorrido completo de todos los roles, aceptación pública/del usuario y versión del destino. No se atribuye a esta inspección manual la cobertura de todas las pantallas |
| 9 | 10 — Retención, P1: preservar evidencia | Revisión de DAO y expediente: no se purga ni pierde pendiente por antigüedad. Plazo laboral documentado; se preserva evidencia que sólo existe en Android | Archivo recuperable de sobres rechazados, textos históricos/evidencia local faltante y disponibilidad de duplicados. Sin ello no hay purga segura; no se inventó un plazo de caché con la ley |
| 10 | 8 — Proxies, P1: cuotas independientes | Revisado guion/entrega anterior de HTTPS y cabeceras falsas; las pruebas históricas conservan su alcance | Dos conexiones con IP públicas distintas y destino operativo; prueba delegada anteriormente a otro desarrollador. No se simulan dos IP con cabeceras |
| 11 | 13 — Empresa/dispositivos, P2 | PR #26 integrada sin rehacerla; formulario con motivo/aviso/cancelación y teclado inspeccionado en portal aislado. Recorridos automáticos de dispositivos/comida aprobados | Ratificar SUP-025, aceptación desplegada y aviso/vigencia offline en teléfono real; lector de pantalla, zoom y 320 px manuales completos pendientes |
| 12 | 15 — Semana/acuse/expediente, P2 | Productor y verificador incluyen tenant_user_site con referencias/aislamiento; lector acepta ZIP anteriores sin esa colección. Pruebas de alteración, relaciones y exportación real aprobadas. JAR actual verifica ZIP histórico anclado, sin red | Aceptación integral Q07/Q14 y evidencia ausente declarada por el formato. Entregar verificador actualizado con ZIP nuevo; uno antiguo puede rechazarlo de forma segura. No habilita borrar origen |
| 13 | 16 — Operador, P2 | Uso mensual/reactivación existentes preservados; suspensión elegida implementada y comprobada por integración, incluyendo captura existente y bloqueo de administración/nuevo enrolamiento | Aceptación de pantallas con sesión de operador actual y ambiente público. No presentar conteo de uso como facturación o nómina |
| 14 | 17 — Horarios/ausencias, P2 | Aplicados mínimos de cálculo de jornada y documentados derechos/causas que resuelve LFT; horarios/asignaciones conservan sus pruebas | Capturar condiciones del empleador, antigüedad, vacaciones/incapacidad y evidencia, y desarrollar su gestión/clasificación. Horario asignado aún no genera retardos/faltas ni una sanción automática |
| 15 | 18 — Capacidad/continuidad, P2 | Guion/línea base ficticia 50/300 del 22 revisados; ensayo actual de recuperación local aprobado | Volumen/objetivos Q19, VPS objetivo, carga sostenida, continuidad, DNS y renovación real de certificados. La línea base anterior no se convierte en SLA actual |
| 16 | 19 — Nómina, P2 | Verificado que CSV genérico no constituye conector; flujo y límites aclarados en guía. Se solicitó especificación, sin respuesta | Sistema/versión, formato/API y ejemplo ficticio aceptado por el primer cliente; implementar y probar la integración concreta |
| 17 | 20 — Contrato, P2: compatibilidad | Candidato 0.18.0 válido; contrato/ejemplos y esquema de expediente alineados con nuevas sedes y baja, sin alterar formato 1 ni cierres históricos | Congelar/publicar 1.0 tras funcionalidades, consumidores, recorridos y aceptación. Renombrar la versión no cierra esas dependencias |

**Evidencia conjunta del árbol integrado:** 85 unitarias backend y 101
integraciones PostgreSQL, sin fallos ni omitidas; 216 pruebas web y compilación;
14 pruebas de identidad, sin omitidas; contratos principal/expediente válidos.
Se corrigieron además las fixtures de versión de regla, supervisor con sede,
renovación de sesión y CSV de extra diaria. Los resultados se conservan en
`build/tasks17-it-results/`, `tasks17-integration-final.log`, `tasks17-web.log`,
`tasks17-identity-final.log` y `tasks17-contract-final.log`. Gradle ejecutó el
árbol actual dentro de Docker, con PostgreSQL aislado. Ninguna prueba usó datos
de producción. La compilación web conserva un aviso de paquete >500 kB.

Respaldos: `build/tasks17-backup.log` acredita instantáneas concurrentes de
Zenit/Keycloak, recuperación sin origen, contraseñas nuevas y rechazo de
destino ocupado/cifrado o contenido alterados. `build/tasks17-s3-final.log`
acredita transporte simulado sin red, checksum, errores, retención, bloqueo
concurrente y rechazo de prefijo/endpoint inseguros. No es un ensayo de S3 real.
Seguridad: `build/security/summary.json` y SBOM/informes por imagen conservan
IDs y fecha de los cinco análisis del día; hay hallazgos de menor severidad,
no cero vulnerabilidades. El análisis anterior falló correctamente y no se
suprimieron esas alertas mediante excepciones.

| Imagen local analizada el 5 de noviembre | Identificador SHA-256 (no inventario público) |
| --- | --- |
| backend | `2d9ee33b7ba7d99bce68c9efe0d9047b02efb88df3519aa571bea046f19000dc` |
| web | `36ed71588162ef5e8c9a0bd85815fc3219b73ca95a72ea59c40e29b7de277ef9` |
| Keycloak | `741b3a13156d722f0727ef3a7a6a9770d49c9835b62ca4fb1ad64fd6f6d52167` |
| backup | `d49be99b2e68b3f83247745e5aff1677c8b06f12f17d4742344bca5f1cce607e` |
| PostgreSQL | `75f523f61e81ab148ccce8995c6f198751731cea1f8ee8b76a7910b9045ac3ef` |

El análisis del árbol modificado/nuevo y del historial (122 commits) terminó
sin secretos detectados (`build/tasks17-secrets-worktree.log` y
`build/tasks17-secrets-history.log`); no se copiaron al ensayo los secretos
privados ni los binarios del PDF.

**Entrega adicional solicitada:** [guía de demo para el cliente](guia-demo-cliente.md)
y [PDF de 12 páginas](../output/pdf/guia-demo-zenit-cliente.pdf), con pasos,
responsables, rutas de pantalla, creación de cuenta, roles/sedes, dispositivos,
cierre/acuse y descargas; se diferencia demo ficticia de producción. Se
renderizaron e inspeccionaron las 12 páginas, con validación de texto, límites,
folios y enlaces. Fuente reproducible en `docs/tools/generar-guia-demo.py`.

**Cierre de sesión de trabajo, no cierre ficticio del proyecto:** las 17 tareas
están atendidas y registradas arriba, pero permanecen abiertas total o
parcialmente (seis P0) por las condiciones indicadas. La tarea 5 tiene código
y pruebas locales completos. No se publicaron cambios, ni se ejecutó CI
remoto, purga Android, ensayo físico o despliegue de producción. Los servicios
de prueba creados son aislados y contienen sólo datos ficticios. Se preservan
los cambios documentales locales previos. Las respuestas posteriores del
usuario prevalecen sobre las decisiones históricas siguientes.

## 5 de noviembre de 2026 — Reforma de 40 horas como respuesta normativa

El usuario amplía el criterio rector: contestar con la reforma de 40 horas
todas las preguntas que puedan resolverse con ella, por ser el objetivo del
proyecto. Se contrastaron de nuevo el decreto de la LFT del 1 de mayo,
la reforma constitucional del 3 de marzo y la LFT de la Cámara de Diputados.
Se documentaron respuestas por clave y pendientes concretos: Q06, Q07,
Q14 y Q15 tienen mínimos normativos, y las demás preguntas separan esos
límites de recursos, condiciones del empleador y elecciones técnicas.

Se actualizó el cuestionario y el seguimiento para no esperar otra elección
de los mínimos expresos ni un dictamen genérico. Se conservan interpretaciones
concretas, validación profesional cuando corresponda, implementación y
aceptación. La búsqueda en DOF/STPS no localizó las disposiciones generales
del registro; no prueba su inexistencia ni permite inventar requisitos.
No se modificaron cálculos, migraciones, cierres, datos ni servicios; sin
pruebas funcionales nuevas por tratarse de documentación. Las tareas globales
siguen abiertas hasta implementar y comprobar los requisitos.

## 5 de noviembre de 2026 — Respuestas Q01–Q04 y precisión Q23

El usuario ratificó producción exclusiva de Zenit administrada por fastSolution
con aislamiento lógico, sin VPS por cliente; respaldo externo diario/30 días,
RPO 24 h y RTO 4 h, descartando la propuesta semanal por incompatibilidad.
Eligió recuperación de contraseña por correo verificado, pérdida de OTP con
los 12 códigos de Keycloak 26.8.1 y soporte con doble aprobación como último
recurso. Se usará SMTP provisional antes del nombre comercial y cuentas
personales con MFA, turnos primario/respaldo y sin credenciales compartidas.

Q23 confirma #26 integrada con motivo, cancelación y siete días hasta la
vigencia; mantiene pendientes ratificar SUP-025 y aceptar el recorrido
desplegado. Se actualizaron decisiones, cuestionarios, guía de identidad y
seguimiento vigente, preservando los cortes históricos y los cambios
documentales locales previos. Siguen pendientes recursos, configuración,
responsables, ensayos y aceptación: permanecen 17 tareas abiertas y seis P0.
No se modificaron código, secretos, realms ni infraestructura; no se
ejecutaron pruebas funcionales por tratarse de actualización documental.

## 4 de noviembre de 2026 — Dudas consolidadas para consultar con el equipo

Se cruzaron notas de producto, decisiones, preguntas Q01–Q22, tareas,
bitácoras, reglas provisionales, retención/recuperación y alcance móvil.
Se consultaron también la issue #18 y los comentarios de la PR #26:
la primera conserva seguimiento anterior a E1–E5 y la segunda no tiene
comentarios que aclaren los detalles de comida anotados como propuesta.
No se reabre el modelo SaaS, la política diaria/30 días y objetivos 24 h/4 h,
el alcance del expediente/MFA ni el CI ya implementado.

Se preparó [el cuestionario Q01–Q25](dudas-producto-para-equipo.md), con
opciones, responsables por función y dependencias. Q23–Q25 recogen detalles
de comida, ubicación/incidencias y cierre automático; no agregan tres tareas
globales ni aprueban cambios. La aceptación E6 se recoge en Q07/Q14/Q17.
Se entrega para que el usuario lo consulte con los desarrolladores; no se
enviaron mensajes ni se cambiaron reglas, infraestructura o datos. No hubo
pruebas nuevas por tratarse de revisión/documentación.

## 4 de noviembre de 2026 — Docker disponible y flujo de uso del producto

Por indicación del usuario se volvió a consultar Docker ya inicializado.
La primera consulta encontró acceso denegado a la tubería desde el sandbox;
al repetir con permisos, `docker version` devolvió cliente y servidor
29.9.2, contexto `desktop-linux` y Docker Desktop 4.97.0. El motor está
disponible. `docker compose ps --all` mostró los servicios locales de Zenit
detenidos, incluidos backend, PostgreSQL, Keycloak y portal. No se
arrancaron ni modificaron servicios, bases o volúmenes; no se ejecutaron
integraciones nuevas. Este resultado sustituye el bloqueo de motor del
corte anterior, sin atribuir salud al producto sólo por tener Docker activo.

Se creó [Flujo del producto y pendientes](flujo-del-producto-y-pendientes.md),
con diagrama y pasos en orden de uso: preparación, alta de empresa, acceso,
configuración, tarjetas/dispositivos, captura/sincronización, revisión,
incidencias, cierre, acuse, CSV y expediente. Se contrastaron contrato,
navegación web, entrada/repositorio Android, exportación y actas de alcance.
La revisión hace explícito que `AttendanceRepository.capture()` exige
`BuildConfig.DEBUG`: release no permite registrar asistencia hasta integrar
tarjetas reales. También sitúa las reglas de jornada/ausencias, nómina,
conservación y operación pendientes; distingue presentación debug, funciones
conectadas y aceptación. Se actualizan el contexto y los índices para
encontrarlo. Siguen 17 tareas globales y seis P0, sin commit, PR ni despliegue.

## 4 de noviembre de 2026 — Sincronización local y contexto para continuar

Se comparó `main/fa2396d` con `origin/main` después de `git fetch origin
--prune`: cero commits locales propios y 16 remotos pendientes. Los únicos
cambios del árbol estaban en `backend/bin/`: 29 archivos, todos copias
exactas de fuentes presentes en HEAD, origin/main o las ramas E4/E5 y
E4/E6. No había una entrega nueva que publicar. Las PR #22–#26 ya estaban
integradas; `main` avanzó directamente a `645174d`, sin conflictos.

Se preservó la carpeta completa en
`build/revision-local-20261104-092300/backend-bin/`, con manifiesto SHA-256,
diff original y `resultado.md`. Se creó además el stash «Respaldo
backend/bin antes de sincronizar main 2026-11-04». Después de actualizar se
repuso la copia local, ahora ignorada por la PR #25. Uno de sus archivos
cambió durante las comprobaciones posteriores; se verificó que los 29
originales del respaldo conservaran sus bytes. No trasladar estas copias a
`src/` ni aplicar el stash como si fuera una función pendiente.

| Comprobación nueva | Resultado |
| --- | --- |
| Git | HEAD = origin/main = `645174d`; árbol limpio al concluir sincronización y `git diff --check` aprobado |
| Portal | Dependencias sincronizadas con `pnpm install --frozen-lockfile`; 214 pruebas en 20 archivos y `pnpm build` aprobados |
| Backend | `gradle :backend:test --offline --no-daemon --console=plain`, con JDK 25 local: 72 pruebas, cero fallos, errores u omisiones |
| Identidad estática | `node --test infra/keycloak/realm.test.mjs`: cuatro aprobadas y dos omitidas por requerir Keycloak real |
| Docker/integración | Desktop informa que está iniciado, pero no existe la tubería del motor Linux; no se pudieron ejecutar PostgreSQL ni identidad real |

Los primeros intentos de Git y Node encontraron restricciones del sandbox;
se repitieron con permisos y finalizaron correctamente. Gradle se ejecutó
en el host como comprobación puntual ante la falta del motor, no como
cambio del flujo Docker del proyecto. Los avisos de React `act()`, tamaño
del bundle y deprecaciones de Gradle no causaron fallos. No se repitieron
Android, contrato, análisis de imágenes/secretos, CI remoto ni servidor
público; no se acredita un despliegue. Las integraciones y pruebas Android
del 1 de noviembre conservan su fecha.

Por petición del usuario se actualizan tareas, estado y contexto de
reanudación. E4/E5, E6 técnica, medición/accesibilidad automática y cambio
programado de comida ya no se presentan como desarrollo por iniciar. Se
conservan **17 tareas globales y seis P0**: faltan aceptación integral E6,
Q07/Q14 y las decisiones/recursos externos. Primero comprobar Docker y
retomar integración; después las validaciones manuales de comida y
accesibilidad según recursos. La prueba de dos IP con datos móviles sigue
asignada a otro desarrollador. Esta actualización queda local, sin commit
ni PR; no se inicia otra tarea hasta continuar con el usuario.

## 30 de octubre de 2026 — Retiro de `backend/bin/` del repositorio

`backend/bin/` tenía 78 archivos versionados desde el 17 de octubre: copias de
fuentes Kotlin, migraciones SQL y `application.yml` que el editor genera al
compilar. Ningún archivo de Gradle, Docker, CI ni guion lo usa: Gradle
compila desde `src/` hacia `build/`, y el `Dockerfile` sólo lo copiaba al
contexto. Sale de Git y queda en `.gitignore` y `.dockerignore`. La
compilación y las pruebas del backend se repitieron sin él.

## 30 de octubre de 2026 — Medición para facturar y accesibilidad del portal

Rama `feat/medicion-uso-y-accesibilidad`, sobre `main` en `ddab8dc`. Cubre
dos requisitos del MVP que no tenían tarea ni ruta.

- **Medición para facturar.** API 0.16.0, 71 operaciones.
  `GET /tenants/{tenantId}/usage?month=AAAA-MM`, sólo para quien opera el
  servicio, devuelve conteos del mes en la zona horaria de la empresa:
  personas que marcaron, personas con relación laboral vigente, tarjetas
  asignadas, dispositivos activos y marcajes. No devuelve datos de personas.
  Cada conteo sale de datos con historia, así que un mes terminado no cambia.
  El portal lo muestra en Empresas → «Uso de …». Qué se cobra lo decide el
  precio.
- **Accesibilidad.** axe-core 4.14.0 (dependencia sólo de pruebas) revisa las
  reglas de WCAG 2.1 A y AA en las 11 pantallas con prueba y en los diálogos
  de alta y uso de empresas; una prueba aparte mide el contraste de la paleta,
  que salió del archivo de entrada a `web/src/theme.ts`. La revisión del
  código no encontró fallas. Falta el recorrido manual por teclado, con lector
  de pantalla y con zoom: [accesibilidad](accesibilidad.md).
- `DossierContractTest` ya no fija la versión del contrato en 0.15.0: exige
  0.15.0 o posterior, que es lo que garantiza que E4/E5 siguen publicadas.

Comprobado en Docker: backend con 67 pruebas unitarias y 90 de integración,
incluidas las dos nuevas de uso, la fila nueva de la matriz de roles y la
cobertura del contrato; portal con compilación y 205 pruebas; contrato y
ejemplos válidos; búsqueda de secretos sin hallazgos en los archivos
cambiados. Sin despliegue: se despliega al integrarse la PR.

## 28 de octubre de 2026 — Corrección de los dos fallos de Actions en PR #22

Se revisaron las ejecuciones de
[push 40777656642](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40777656642)
y [PR 40777662875](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40777662875),
ambas sobre `b1d67bd`. En las dos aprobaron backend, portal y Android; falló
el mismo trabajo `contrato-y-seguridad`, al analizar las imágenes. Backend,
portal, PostgreSQL y respaldo aprobaron sus análisis; sólo Keycloak falló
por Guava 33.6.0-jre, `GHSA-xxph-c9ww-hj94` / `CVE-2026-102554` alta.

Se sustituye únicamente ese JAR por **33.7.2-jre**, versión corregida de la
[publicación oficial de Guava](https://github.com/google/guava/releases/tag/v33.7.2),
en la etapa Keycloak, antes de la construcción optimizada. Descarga Maven
Central fijada por SHA-256
`b530942257fb935f8b2cfaa5f8eb5bd59c555fd8e8d01b8ce98912e077ea606c`.
Se conserva el nombre de archivo que referencia Quarkus; los metadatos y
el inventario identifican 33.7.2-jre. La prueba de runtime ahora exige la
huella corregida y un único JAR Guava, además de UID, Java y certificados.

La imagen reconstruida aprobó el mismo análisis local que falló en CI:
**0 críticas, 0 altas, 22 medias, 11 bajas y 0 desconocidas**, sin hallazgos
aceptados. `.grype.yaml` conserva `ignore: []` y el umbral `high` no cambia.
UID 1000, Java/certificados y readiness 200/503 comprobados sobre esa imagen.
La regresión real de identidad aprobó **8/8, sin omisiones**, incluidos OTP
nuevo con SSO, mínimo ACR y permisos del cliente técnico. Se ejecutó en un
proyecto Docker nuevo, sin puertos publicados, tras descartar el entorno de
ensayo que conservaba credenciales de base anteriores. La nueva ejecución
remota se comprueba después de publicar en la misma PR. No hay despliegue público
ni cambios de datos o cuentas de operación; `backend/bin/` se preserva.
Evidencia local: `build/keycloak-guava-fix/` y `build/security/`.

## 28 de octubre de 2026 — E4/E5, recuperación E6 y QA Android

**Publicación:** [PR #22](https://github.com/Alsegurarp/fs_asistencias/pull/22)
abierta, sin borrador, contra `main`; commit funcional `0a1f9a2` y ajuste del
análisis de secretos en `606362c`. Se verificaron base, rama remota y head
esperado. El conector rechazó crearla con 403; se publicó con la credencial
Git ya configurada sin exponerla. CI remoto en curso al publicar; las
validaciones locales siguientes no se atribuyen a una ejecución remota.
No se integra ni despliega. La actualización de publicación sólo toca docs.

Por instrucción del usuario se completa la entrega E4–E6 y se ejecuta QA
Android antes de preparar una PR. Se crea `feat/expediente-e4-e6-qa` desde
main/fa2396d y se incorpora `feat/expediente-e4-e5` (`5cc975d`). La consulta
remota confirmó que la PR #21 ya se integró en la rama E2/E3 después de que
#20 llegara a main: ese código no estaba en el árbol main revisado al inicio.
Se conserva también el corte documental inicial, sin rehacer E4/E5.

- **E4/E5:** API 0.15.0, 70 operaciones; V010, desafío correlacionado,
  PKCE/OIDC/OTP nuevo, autorización y descarga de un uso, invalidación por
  cambios de cuenta/permiso/empresa y portal con gestión de permiso/retorno.
  [Acta y configuración efectiva](entrega-expediente-e4-e5.md).
- **E6 técnica:** [JAR independiente y procedimiento de salida](entrega-expediente-e6.md),
  esquema incorporado, huellas externas obligatorias, ZIP/NDJSON por flujo,
  conteos, empresa, IDs/referencias y snapshots; consulta sin servicio/red.
  No restaura una instalación ni habilita borrado. Q07/Q14 y aceptación del
  responsable/jurídica mantienen pendiente el cierre integral de E6.
- **QA Android:** [acta del 28](qa-android-2026-10-28.md), APK actualizado sin
  borrar datos, navegación visual y autoensayo; captura personal/terminal,
  cola y sincronización, renovación/idempotencia, objeción, recuperación sin
  copia local, reapertura y conformidad contra backend real ficticio. Terminal
  rechazada con 403 en consulta personal. Nueva fase `week` de instrumentación.

Validación final: **67 unitarias y 88 integraciones PostgreSQL**, sin fallos,
errores ni omisiones; **189 pruebas web** y compilación; **ocho pruebas de
identidad real**, ninguna omitida; **13 unitarias Android**, lint y APK; ambos
contratos válidos. Se ejecutó el JAR final sin red y en sólo lectura sobre el
ZIP descargado el 27, contrastado con su huella conservada. Los casos E6 de
alteración/truncamiento/empresa/referencias y los perfiles anuales 50/300
aprobaron en backend. La historia de Chrome del 27 conserva su fecha; el
host de acceso del navegador no estuvo disponible para repetirla en esta sesión.

Docker Desktop se restableció. ADB perdió/reanudó la conexión; se repuso el
túnel y la cola terminal conservada se sincronizó. La empresa ficticia quedó
suspendida, sus dispositivos revocados y el cliente temporal eliminado, con
históricos/acuse comprobados. No se cambió el vínculo original del teléfono
ni se modificaron datos o identidad públicos. Se preserva `backend/bin/`.

Fuera de la PR quedan secretos, binarios, logs y capturas locales. El análisis
explícito de historial e integraciones recorrió **110 commits sin hallazgos**,
incluido el código propio del merge `0a1f9a2`. Se añadió a `secret-scan`
`--full-history --diff-merges=first-parent` para que CI tampoco omita esos
cambios. El análisis ordinario previo había recorrido 85 commits. No se cierra ninguno de
los 17 pendientes globales ni los seis P0 por esta entrega técnica.

## 28 de octubre de 2026 — Avance verificado y pendientes priorizados

Se revisaron historial, árbol de trabajo, fuentes, contratos, migraciones,
workflow, documentación y GitHub mediante consultas de lectura. `main` local
y la rama remota consultada coinciden en
`fa2396d6d77ccef63a4dac2589c62a300e622727`. La
[PR #20](https://github.com/Alsegurarp/fs_asistencias/pull/20) se integró el
27 de octubre a las 11:50 de Ciudad de México; sustituye el estado «abierta»
del corte anterior. E1–E3 están integradas; E4–E6 siguen pendientes.

### Cambios que ya tiene el proyecto

- Backend/contrato: API 0.14.0 con **67 operaciones**. E2/E3 añaden permiso
  explícito por cuenta/empresa, concesión y revocación auditadas, solicitud
  idempotente, estado y manifiesto. V009 incorpora permiso, expediente y
  bloques. La preparación conserva históricos y evidencia disponible en
  ZIP/NDJSON, con instantánea coherente y bloques de hasta 64 KiB; caduca a
  las 24 horas sin borrar la evidencia de origen. La descarga sigue cerrada.
- Portal: están integrados catálogos, horarios/importación, dispositivos,
  incidencias, cierres, CSV, usuarios, configuración, semana y acuse personal
  y las entregas A1–A5. Las actas previas acreditan 33 casos A5 locales y
  17 casos locales de horarios/CSV; no se repitieron en esta sesión.
  La interfaz del expediente E5 todavía no existe.
- Android: captura y cola cifrada, sincronización, semana/acuse y navegación
  operativa simplificada del 26 están integradas. El recorrido visual del
  21 es evidencia de aquella versión; falta QA visual de la interfaz del 26.
  Las herramientas MF1K no acreditan captura autenticada de asistencia.
- Infraestructura: CI para backend/identidad, portal, Android y
  contrato/seguridad; ensayo de respaldo cifrado/restauración y revisión de
  imágenes integrados. No equivalen a un respaldo externo operativo.
- Modelos: V001–V009 representadas en PlantUML, con 32 entidades y 52
  relaciones; la entrega anterior verificó compatibilidad con 1.2025.10 y
  1.2026.8. No se volvieron a renderizar en esta revisión.

### Evidencia comprobada en esta sesión

| Comprobación | Resultado y límite |
| --- | --- |
| Integración | Git local y consulta de `main` en GitHub coinciden; PR #20 cerrada e integrada |
| CI de la PR #20 | [Ejecución 40541212345](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40541212345): cuatro trabajos aprobados |
| CI del merge en `main/fa2396d` | [Ejecución 40554372464](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40554372464): backend, portal, Android y contrato/seguridad aprobados; incluidos identidad/OTP, respaldo y análisis de imágenes |
| Resultados locales E2/E3 conservados | Recuento de 22 XML unitarios: **60 pruebas**; 14 XML de integración: **83 pruebas**. Cero fallos, errores u omisiones en ambos grupos. Es lectura de resultados anteriores, no otra ejecución |
| Implementación del expediente | Cinco operaciones activas verificadas en contrato/controlador; desafío, autorización y descarga sólo en contrato candidato. Sin pantalla de expediente en el portal |
| Entorno local | `docker compose ps --all` no conecta: no existe la tubería del motor Docker Desktop. No se arrancaron servicios ni se ejecutaron pruebas nuevas |
| Árbol de trabajo recibido | Cambios previos exclusivamente en `backend/bin/`, incluidos archivos sin seguimiento; se preservan y no se contabilizan como una entrega funcional nueva |
| Seguimiento remoto | [Issue #18](https://github.com/Alsegurarp/fs_asistencias/issues/18) abierta y sin actualizar sus casillas E1–E3; no refleja las integraciones ya confirmadas. No se modificó GitHub |

### Trabajo pendiente y orden recomendado

El [listado priorizado](TareasPendientes.md#trabajo-priorizado-con-el-contexto-del-28-de-octubre)
declara alcance, dependencias y criterios verificables. Primero **E4**
(MFA nuevo, autorización y descarga de un uso), después **E5** (portal).
La verificación técnica de **E6** puede iniciarse con el ejemplo existente;
su aceptación completa requiere la descarga implementada, Q07/Q14 y las
decisiones de conservación. La QA Android del 26 necesita teléfono y backend
disponibles. Para ejecutar pruebas locales, primero restablecer Docker.

Se mantienen **17 tareas globales abiertas total o parcialmente y seis P0**:
respaldo externo, identidad operativa/SMTP, jornada/acuse, tarjetas reales,
reglas de negocio y producción administrada. E1–E6 son subtareas de ese
inventario. No se fija un porcentaje global sin criterios de aceptación
equivalentes, ni se cierran tareas por integración o por CI solamente.

Esta sesión actualiza bitácora, estado, lista de tareas y referencias de
seguimiento. Se comprobaron 229 enlaces/anclas locales en los ocho documentos
modificados, las 67 operaciones del contrato y `git diff --check`, sin errores.
No modifica producto, datos, realm activo ni `backend/bin/`;
no hace commit, publicación o despliegue. Servidor público, teléfono y
aceptación del usuario/jurídica no comprobados. Los cortes anteriores
conservan su fecha y resultados originales.

## 27 de octubre de 2026 — E4/E5: MFA por operación y portal

Publicada en la [PR #21](https://github.com/Alsegurarp/fs_asistencias/pull/21),
abierta y sin integrar; commit funcional `ba95304`. La base es
`feat/expediente-e2-e3` porque #20 sigue abierta. Tras integrar #20, cambiar
la base de #21 a `main`. CI remoto en curso al publicar, sin atribuirle las
pruebas locales. El conector devolvió 403; la publicación terminó mediante
la credencial Git configurada, sin exponerla.

Implementación en `feat/expediente-e4-e5`, sobre E2/E3. V010 añade
desafíos/autorizaciones ligados a empresa, expediente y solicitante, versiones
de acceso y consumo antes de transmitir. Se versionan el cliente dedicado,
retorno exacto, mapa/mínimo ACR 2 y OTP con edad cero. El portal administra
el permiso explícito y completa solicitud, estado, callback PKCE y descarga.
OpenAPI 0.15.0 publica las ocho operaciones; formato 1 y CSV se conservan.

[Acta y límites](entrega-expediente-e4-e5.md): 64 unitarias, 88 integraciones,
189 pruebas web y 11 de identidad real aprobadas, sin omisiones. Historia en
Chrome con permiso, OTP incorrecto/nuevo, ZIP íntegro, segunda descarga 410 y
revocación; evidencia ficticia y capturas locales. Ambos contratos válidos;
modelos V010 con 34 entidades/55 relaciones renderizados en PlantUML
1.2025.10 y 1.2026.8. Se corrigieron durante el ensayo el perfil `migrate`,
la configuración mínima ACR y una sección duplicada del contrato YAML.

E6 y Q07/Q14 siguen pendientes. No se despliega, elimina evidencia ni purga
Android; no se modifica el realm público. Un realm ya existente requiere
aplicar administrativamente la configuración nueva: reiniciar no la importa.
Se conservan los cambios previos/generados de `backend/bin/`.
Los 96 archivos de fuentes/recursos coinciden con el contenedor final aprobado;
el diff preparado pasó el análisis de secretos sin hallazgos. Entorno aislado
y contenedores de pruebas retirados, con XML/capturas/evidencia local guardados.

## 27 de octubre de 2026 — Publicación de E2/E3, PR #20

La [PR #20](https://github.com/Alsegurarp/fs_asistencias/pull/20) está abierta,
sin borrador y sin integrar contra `main/f4104e1`. Rama
`feat/expediente-e2-e3`; commit funcional
`15fa11cfcbf40155c4834ea09eebc252d629dd98`. Incluye 31 archivos de código,
migración, contrato, pruebas y documentación, verificados también mediante
la lista remota de cambios; ninguno pertenece a `backend/bin/` o a secretos,
logs/renders locales. La actualización posterior de publicación sólo toca docs.

El conector GitHub devolvió 403 al crear la PR; se completó con la credencial
Git configurada y el mecanismo de publicación local del repositorio, sin
exponer la credencial. GitHub confirmó PR abierta, head esperado y base main.
Los [checks de la PR](https://github.com/Alsegurarp/fs_asistencias/pull/20/checks)
están en curso al corte de publicación; no se registran como aprobados.

Se conservan las **60 unitarias y 83 integraciones locales aprobadas**. Los
90 archivos de fuentes/recursos coinciden por SHA-256 con la imagen probada;
no se repitió negocio por cambios de documentación. PlantUML 1.2025.10 y
1.2026.8 validan el modelo corregido (32 entidades/52 relaciones). Análisis
del historial previo a publicar: 81 commits, sin secretos. E4/E5/E6, aceptación
y despliegue permanecen pendientes; no se integra la PR ni se habilita descarga.

## 27 de octubre de 2026 — Compatibilidad PlantUML y preparación de PR E2/E3

Ante el reporte del usuario, se reprodujo `IllegalStateException` con el JAR
1.2025.10 de Plan UML 0.0.8. El fallo ocurre en Smetana (`JUtils.qsort`,
`mincross.restore_best`) al distribuir horizontalmente `02-relaciones.puml`;
la comprobación previa sólo con 1.2026.8 no lo revelaba. Se retiró
`left to right direction` y se conservó el motor sin dependencias nuevas.

[Acta actualizada](entrega-expediente-e2-e3.md#corrección-de-compatibilidad-de-02-relacionespuml):
sintaxis y renderizado SVG/PNG correctos con 1.2025.10 y 1.2026.8, revisión
visual y comprobación de las mismas 32 entidades y 52 relaciones. El código
de salida no bastaba para detectar la excepción: también se revisaron stderr
y SVG. No se cambió código de negocio ni se repitieron sus pruebas por este
ajuste visual; se conservan las 60 unitarias y 83 integraciones ya aprobadas.

Por instrucción del usuario se actualizan documentación, seguimiento y
bitácora y se prepara una PR de E2/E3 contra `main`. Incluye implementación,
migración V009, contrato 0.14.0, pruebas, modelos `.puml` y esta corrección.
Los archivos previos/generados de `backend/bin/`, secretos, logs y renders
locales quedan fuera. E4/E5/E6 y el despliegue conservan sus pendientes.

## 27 de octubre de 2026 — E2/E3: permiso y expediente íntegro

Implementación local en `feat/expediente-e2-e3`, sin publicar ni desplegar.
V009 añade permiso explícito ligado a la cuenta, expediente y bloques del ZIP;
API 0.14.0 publica cinco operaciones de permiso/solicitud/consulta/manifiesto.
La preparación usa una instantánea REPEATABLE READ, cursor de 256 filas y
bloques de 64 KiB. Conserva históricos/evidencia original y limpia únicamente
el archivo temporal vencido. E4/E5/E6 siguen pendientes, sin descarga ni purga.

[Acta](entrega-expediente-e2-e3.md): **60 unitarias y 83 integraciones aprobadas**,
sin fallos, errores u omisiones; cuatro unitarias y ocho historias nuevas.
Incluye el recorrido de Ana, revocación/cambio de cuenta, permisos/aislamiento,
concurrencia con escrituras, fallos/reintentos, caducidad y perfiles anuales
50/300 (36 500/219 000 marcajes). Ambos contratos válidos y regresión CSV aprobada.
Se corrigieron timestamptz SQL y coerciones JSON detectadas por las pruebas.

El usuario pidió el modelo general en `docs/dbFlow` y precisó formato `.puml`.
Se añaden [jerarquía](dbFlow/01-jerarquia.puml) y [relaciones](dbFlow/02-relaciones.puml),
con las 32 tablas y las fronteras de Keycloak/Android; sintaxis PlantUML validada.
El Markdown de esa carpeta queda como índice. Se mantienen fuera de la entrega
los cambios de `backend/bin/`; no se modificaron servicios/datos públicos.

## 27 de octubre de 2026 — Verificación de E2–E5

Se contrastaron las fuentes backend/portal, migraciones, contratos, realm y
ensayo MFA con GitHub e historial actualizado mediante `git fetch origin`.
La [verificación](verificacion-e2-e5-2026-10-27.md) corrige el corte anterior:
E1 ya está integrada en `main/f4104e1` mediante PR #19 y el CI de la PR
40454604478 aprobó sus cuatro trabajos. La issue #18 sigue abierta con su
lista sin actualizar. E2–E5 aún no tienen implementación; quedan documentados
alcance, dependencias y pruebas de cierre en el orden E2 → E3/E4 → E5.

Docker responde fuera del aislamiento, sin servicios del proyecto activos.
No se cambió de rama, ejecutaron nuevas pruebas, modificó el producto ni se
publicaron cambios en GitHub. Se preservó `backend/bin/`. E6, aceptación y
decisiones externas mantienen su alcance; no se cierran pendientes globales.

## 26 de octubre de 2026 — E1: contrato candidato, formato y pruebas

El usuario pidió desarrollar E1, probarla y publicar una PR. Rama de entrega:
`feat/expediente-e1-contrato`, desde main/5d7b783. Se entregan el
[contrato candidato 0.14.0-draft.1 y formato 1](contrato-expediente-e1.md): ocho
operaciones propuestas, permiso explícito, destinatario por empresa/usuario/
vínculo OIDC, estados, errores, caducidades y reintentos. El formato define
23 tipos de registro y sus campos/relaciones, ZIP/NDJSON y manifiesto con
huellas. Incluye un ejemplo ficticio con inventario, conteos y bytes verificables.
El contrato activo 0.13.0 y sus 62 operaciones/CSV siguen sin cambios.

**Entrega publicada:** commit `b5aff1f1848e617e96a2297b9c9ec3ed499f468b`,
[PR #19](https://github.com/Alsegurarp/fs_asistencias/pull/19) abierta para
revisión contra main, sin integrar. Estado consultado el 26 a las 23:15
de Ciudad de México (27 de octubre, 05:15 UTC): las ejecuciones de
[push 40453960241](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40453960241)
y [PR 40454133202](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40454133202)
siguen en curso; no se registran todavía como aprobadas. El conector devolvió
403 al crear la PR; se completó mediante el mecanismo del repositorio con
la credencial Git configurada, sin exponerla ni incluirla en la entrega.

Validación local en Docker, sin SDK/dependencias nuevos en el host:

- Lint de contrato activo y candidato aprobado.
- Build backend/simulador y **56 pruebas unitarias aprobadas**, incluidas
  **8 nuevas DossierContractTest**, sin omisiones ni errores. Cubren ejemplos/
  referencias, PKCE real del ejemplo y state, inyección de empresa/campos/JWT,
  estados incompatibles, manifiesto, secretos y huellas/conteos del fixture.
- **75 integraciones PostgreSQL aprobadas**, incluidas ExportsIT y
  ContractCoverageIT: igualdad de rutas y contrato, permisos/aislamiento y
  validación de respuestas/peticiones del API existente.
- El lint existente valida ambos contratos; las pruebas nuevas entran al build
  y trabajo backend de CI. XML de la suite E1: 8 pruebas, 0 omitidas, 0 fallos,
  0 errores. Registros locales ignorados: build/e1-contract-final.log,
  build/e1-backend-final.log y build/e1-backend-integration.log.
- Diez documentos y 241 enlaces locales/anclas comprobados; diff sin errores.
  Se detuvo sólo db-it, creada para esta ejecución, sin borrar datos/volúmenes.
- Búsqueda de secretos en los 79 commits del historial, incluido el commit
  de E1, sin hallazgos antes de publicar la rama.

Se corrigieron durante la validación la iteración de arrays de Jackson 3 y
la configuración explícita de ambos dialectos de esquema en el registro de
pruebas. Las condiciones parciales declaran additionalProperties=true para
el lint, conservando cerrados el objeto final y los cuerpos de petición.
No se flexibilizaron reglas de lint ni se añadieron dependencias/excepciones.

E1 queda completada en su alcance técnico de diseño y pruebas; la descripción
de PR registra el commit y evidencia de entrega. E2 es el siguiente desarrollo.
Las rutas candidatas aún no atienden peticiones; MFA de negocio, permiso,
exportador y portal siguen en E2–E5. E6 conserva aceptación/Q07/Q14.
No se despliega, purga, modifica el realm activo ni se cierran pendientes
globales. Cambios previos de backend/bin excluidos de la entrega.

### Tarea realizada y trabajo restante

**Realizada: E1 — contrato y formato del expediente, con pruebas locales.**
Su publicación no significa integración en main ni funcionamiento de las
operaciones propuestas. Falta completar CI remoto y la revisión/integración
de la PR #19. El seguimiento funcional permanece en la
[issue #18](https://github.com/Alsegurarp/fs_asistencias/issues/18).

| Orden | Pendiente por realizar | Dependencia y criterio de cierre |
| --- | --- | --- |
| E2, siguiente | Permiso específico y aislamiento en backend/persistencia | Usar E1; concesión/revocación auditadas, vínculo/empresa/usuario resueltos en servidor y pruebas de acceso ajeno, revocación y cambios de cuenta. No heredar permiso de roles actuales |
| E3 | Preparación del expediente íntegro | E1/E2; instantánea coherente, históricos y archivo/manifiesto legibles, excluyendo secretos y otros clientes. Probar concurrencia, caducidad/limpieza y perfiles 50/300 durante un año por lotes |
| E4 | MFA nuevo y autorización de un uso | E1/E2; E3 para aceptar la descarga real. Correlacionar desafío/OIDC/usuario/empresa/expediente y consumir atómicamente; probar renovación, reutilización, vencimiento, revocación y descargas concurrentes |
| E5 | Solicitud, estado y descarga en portal | E1–E4; permisos, PKCE/state/nonce, accesibilidad, cancelación, errores y cambio de cuenta; conservar CSV semanal |
| E6 | Recuperación y consulta fuera de Zenit | E3–E5; detectar alteraciones/truncamiento/datos ajenos y comprobar históricos. Q07/Q14 y aceptación siguen necesarias para el cierre integral; no habilitar supresión automáticamente |

Secuencia restante: **E2 → E3/E4 → E5 → E6**. QA de las nuevas pantallas
Android requiere teléfono/servicios disponibles. Respaldos externos,
producción, identidad/SMTP, tarjeta real, reglas laborales, retención,
aceptación pública y nómina conservan los bloqueos descritos en
[el listado vigente](tareas-desarrollo-2026-10-26.md#pendientes-que-todavía-no-pueden-cerrarse-íntegramente).
Se mantienen **17 tareas globales abiertas y seis P0**; E1 es una subtarea,
no una tarea global adicional ni un cierre de esos requisitos.

## 26 de octubre de 2026 — Pendientes disponibles para desarrollo

Por solicitud del usuario se contrastaron documentos, código, historial y
GitHub sobre main/5d7b783. Las PR #15/#16 están integradas; los cuatro
trabajos de [Verificaciones 40311310435](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40311310435)
aprobaron. La issue #18 conserva E1–E6 abiertas y el contrato/backend/portal
no implementan el expediente. Las mejoras Android y de paquetes del 26 ya
están en main; queda separado el recorrido visual de las pantallas nuevas.

Se declaró el [listado para desarrollo](tareas-desarrollo-2026-10-26.md):
E1 inmediata; E2–E5 con dependencias internas; verificación técnica de E6
después, conservando Q07/Q14/aceptación. QA Android requiere Docker y
teléfono disponible. Se enlazó el corte vigente desde los documentos de
seguimiento sin alterar la evidencia histórica. Permanecen 17 tareas globales
abiertas y seis P0; no se implementaron funcionalidades ni modificaron issues.

La consulta de solo lectura de Compose no pudo conectar a dockerDesktopLinuxEngine
(tubería inexistente). No se inició el motor ni ejecutaron pruebas nuevas de
producto, recorrido de teléfono o comprobación pública. Se conservaron los
cambios previos de backend/bin. La revisión de documentación no acredita
despliegue, purga o habilitación para datos reales.

## 23 de octubre de 2026 — Preparación de PR y declaración de implementación

El usuario solicita publicar una PR con el contexto, metas, prueba MFA y
workflow de esta sesión, y declarar el trabajo para implementar el expediente.
Se declaran [E1–E6](expediente-empresa.md#tareas-declaradas-para-implementación),
con alcance, área responsable, dependencias y aceptación: contrato, permiso,
preparación del archivo, autorización por descarga con MFA, portal y
recuperación independiente. Todas siguen abiertas; no se asignan personas o
fechas ni se incrementa el conteo global.

La PR #15 permanece abierta y contiene la base documental de esta entrega.
Se prepara una rama/PR dependiente sobre
`test/respaldo-concurrente-ci-2026-10-23`, desde `2ad99e7`, para que su diff
incluya sólo esta sesión y no vuelva a presentar respaldo/CI como trabajo
nuevo. La publicación y su enlace se registrarán al obtener la respuesta de
GitHub. Se excluyen cambios previos de `backend/bin/`, secretos y registros
locales. Se conserva la evidencia local 10/10 de identidad; la publicación
no equivale a integración, despliegue o aceptación del expediente completo.
La declaración se conserva en el repositorio y como lista de seguimiento en
la descripción de PR. El conector de GitHub rechazó crear un issue con 403
(`Resource not accessible by integration`); no se creó un issue externo.
Comprobaciones previas a publicación: sintaxis del ensayo Node y diff sin
errores; nueve documentos, 150 enlaces locales y 41 anclas comprobados.

## 23 de octubre de 2026 — Metas de expediente empresarial y MFA por descarga

El usuario aprobó continuar los pendientes e incorporar el contexto y las
metas de esta conversación. Se acuerda entregar al empleador autorizado un
expediente legible e íntegro de su empresa, con versiones y ajustes; comprobar
que pueda conservarlo y consultarlo antes de suprimirlo al terminar el
servicio; y mantener el aislamiento entre clientes. El respaldo completo
multiempresa no sustituye esa entrega.

Según servicio y contrato, empleador y fastSolution normalmente actuarán como
responsable y encargado del tratamiento, respectivamente. El rol `owner` no
elimina derechos de las personas trabajadoras. Se acuerda permiso específico,
MFA de Keycloak/Red Hat y autorización nueva, breve y de un uso ligada al
usuario, empresa y expediente para cada descarga. MFA comprueba identidad;
Zenit decide y audita qué archivo puede obtener esa persona. La extracción
indebida por una persona autorizada conserva el control de permisos/finalidad.

Se revisó el código: los CSV semanales admiten descargar el exporte de otra
persona de la misma empresa con administración, RH o auditoría; ese caso está
probado y no se amplía al expediente completo. El acceso actual usa OTP, pero
el backend no exige otra verificación para cada descarga. La imagen usa
Keycloak comunitario 26.8.1 sobre UBI; no es Red Hat build of Keycloak.
No se infiere una migración de distribución ni soporte comercial.

Se documentan [alcance, controles, secuencia y casos de aceptación](expediente-empresa.md).
Se completó la prueba aislada de viabilidad de MFA por operación,
versionada en `infra/keycloak/dossier-mfa.test.mjs` e incorporada al workflow.
**Resultado local: 10/10 pruebas de identidad aprobadas, sin omisiones.**
La prueba nueva verifica firma/emisor/audiencia, PKCE, `state` y `nonce`;
con la misma sesión SSO exige OTP de nuevo, rechaza OTP incorrecto/consumido
y la elevación silenciosa, y devuelve ACR 1 al solicitar nivel inferior.
Se comprobó la renovación antes de bajar el nivel: el token renovado conserva
ACR 2 y `auth_time`, sin pedir otro OTP. Por tanto, ACR 2 por sí solo tampoco
prueba una verificación nueva por descarga; la vinculación y el consumo del
desafío/autorización del lado de Zenit siguen siendo necesarios.

El ensayo usa su propio realm/cuenta en Keycloak aislado, eliminado al terminar;
Compose retira sus contenedores y redes. No modifica el realm `zenit` ni
secretos de operación. El paso de CI está preparado localmente; no se ha
publicado ni ejecutado en GitHub para estos cambios. La validación no acredita
todavía expediente, permiso de negocio, desafío ligado al archivo ni
autorización de descarga. Siguiente trabajo: pasos 2–4 del documento técnico.
Ejecución final: 24 de octubre a las 03:02 UTC (23 de octubre, 21:02 en
Ciudad de México), 29.7 segundos de pruebas. Registro local ignorado:
`build/dossier-mfa-2026-10-23/tests.log`, SHA-256
`70789CEA3A6A248D42FCE83E53CC639E37BFA3A311517A7638689E78EF3DDFF1`.
Se conservan Q14, Q03/Q04 y Q10–Q13, las 17 tareas globales abiertas y seis P0.
No se purgan datos, modifica el realm activo, despliega el servidor público
ni se incluyen los cambios preexistentes de `backend/bin/`.

## 23 de octubre de 2026 — CI aprobado y criterio legal para retención y evidencia

La entrega de respaldo/CI se publicó en `ffa8306`, rama
`test/respaldo-concurrente-ci-2026-10-23`, con la
[PR #15 en borrador](https://github.com/Alsegurarp/fs_asistencias/pull/15).
Los cuatro trabajos de la
[ejecución 39990444637](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39990444637)
aprobaron: backend, portal, Android y contrato/seguridad. El nuevo paso de
respaldo cifrado/recuperación sin red aprobó también en el runner.
No se integró en `main` ni se desplegó el servidor.

El usuario precisó que las tareas de sesión 3 y 5 deben seguir la legislación
mexicana, incluida la reducción a 46 horas en 2027, y confirmó el cumplimiento
legal como criterio rector. Se verificaron DOF, LFT, LSS, LFPDPPP y su
Reglamento, además del ámbito de NOM-151; se actualizaron
[retención](retencion-android.md), [criterios de negocio](decisiones-de-negocio.md)
y [revisión legal](revision-juridica-jornada-acuse.md).
V005 y su prueba existente ya contienen 46 horas para 2027; no se cambió el
cálculo ni se consideran cerradas sus brechas diarias/descansos.

La conservación laboral del artículo 804 no se convierte en una purga de
cada fila a los 365 días ni en un plazo arbitrario de caché Android.
El artículo 52 del Reglamento establece recuperación previa a la supresión
al terminar el servicio en nube en el supuesto que regula. No obliga a un
tercero certificador a habilitar cada recuperación. La entrega completa por
empresa aún falta: la recuperación de toda la instalación no la sustituye
y no debe exponer información de otros clientes.

Las tareas de sesión 3 y 5 avanzan en criterios normativos; siguen parciales:
archivo/recuperación íntegros y disponibilidad local antes de purgar, y
opciones operativas de suspensión, baja, supervisor y marcaje que la ley no
elige por sí sola. La tarea 4 conserva Q03/Q04: modalidad de recuperación,
SMTP/remitente y responsables/cuentas, sin respuesta adicional. No se
habilitó correo ni se borró evidencia. El cambio Android sólo precisa el
comentario `shortcut:` del DAO; no altera su comportamiento.

## 23 de octubre de 2026 — Respaldo concurrente validado y preparación de CI

El usuario autorizó las tareas de sesión 1–5 de la lista anterior: respaldo
concurrente, integración en CI, retención Android, identidad y reglas de
negocio. Estos números no sustituyen los órdenes de las tareas globales.

**Tarea de sesión 1: aprobada localmente.** Se construyó `backup-tools` y se
ejecutó `self-test.sh` en un contenedor sin red, sin volúmenes del proyecto,
con raíz de sólo lectura, usuario PostgreSQL y capacidades retiradas.
Después de exportar la instantánea de cada base, otra conexión actualiza una
fila, elimina otra e inserta tres; se comprueban cuatro filas posteriores
en cada origen. La restauración conserva las dos filas originales por base,
con sus huellas, y se realiza con el origen apagado.
También aprueban recuperación persistente con contraseñas nuevas y rechazos
de destino ocupado, contraseña antigua, filas eliminadas, contenido distinto,
cifrado alterado y clave incorrecta. La garantía es por base; no sincroniza
las instantáneas de Zenit e identidad entre sí.

Se corrigió un fallo real del ensayo: el montaje `/work` tenía `noexec` y
el shell omitía el auxiliar de escritura al buscar `pg_dump`.
La comprobación de cambios en el origen falló y evitó una aprobación falsa.
Se habilita `exec` sólo en el tmpfs `/work` del autoensayo, tanto en CI como
en el comando documentado. No cambia `rehearse.sh` ni los montajes operativos.
La ejecución final a las 16:47 UTC terminó con `AUTOPRUEBA CORRECTA` y código 0.
Registro local ignorado: `build/respaldo-concurrente-prueba-2026-10-23.log`,
SHA-256 `04E476BFEFC296311F232F12A3F04515D0F391853E3F076126FF1B20C5DB8BBE`.

**Tarea de sesión 2:** se añade el mismo comando probado al trabajo
`contrato-y-seguridad` del workflow. La integración remota y su resultado
de CI se registrarán con la entrega; el éxito local no los sustituye.
Los cambios preexistentes de `backend/bin/` se conservan fuera de la entrega.

**Tareas de sesión 3–5:** se revisaron el DAO y el procesamiento Android,
el realm y el procedimiento de identidad, y las propuestas de negocio.
Se solicitaron los plazos/alcance de retención (Q14), la modalidad de
recuperación y provisión SMTP/cuentas (Q03/Q04), y la elección explícita de
reglas (Q10–Q13). Autorizar estas tareas no determina esas opciones.
Mientras no haya respuesta no se elimina evidencia, no se habilita correo
sin configurar ni se declaran reglas aprobadas. Tres pruebas estáticas del
realm aprobaron; dos integraciones se omitieron al no configurar su entorno.
Esto no acredita envío/recepción de correo ni recuperación completa de acceso.

No hubo despliegue público ni cambios de datos reales. Las 17 tareas globales
y seis P0 conservan sus dependencias; el ensayo de respaldo no entrega una
copia externa ni acredita los objetivos operativos de recuperación.

## 23 de octubre de 2026 — Contexto consolidado y siguientes tareas

Se revisaron el historial local, el árbol de trabajo, las actas del 21/22 y
los documentos de pendientes. `HEAD` y la referencia local `origin/main`
siguen en `0723baf`, con las PR #13/#14 integradas; en esta revisión no se
ejecutó otro pull/fetch ni se consultó GitHub. El modelo vigente es SaaS
administrado por fastSolution, con aislamiento lógico entre empresas y sólo
datos ficticios hasta cerrar los requisitos de producción.

El avance comprobado conserva sus fechas: A5 local 33/33, semana/acuse
Android contra backend real local, horarios/importación 17/17, línea base
50/300 y cinco imágenes analizadas sin críticas/altas ni excepciones.
Contrato 0.13, 62 operaciones y V001–V008 siguen siendo la base documentada;
no se atribuyen nuevas pruebas ni disponibilidad actual a esas actas.

Se identificó trabajo local adicional sin commit en
`infra/postgres/backup/self-test.sh` y `.github/workflows/verificaciones.yml`:
el autoensayo añade escrituras concurrentes posteriores a la instantánea
de cada base y el workflow añade su ejecución aislada sin red. El registro
`build/respaldo-concurrente-2026-10-23.log` sólo contiene una denegación de
acceso a la API Docker. **No acredita ejecución ni aprobación del ensayo**;
revisarlo, ejecutarlo y comprobar CI queda como siguiente trabajo posible.
La garantía sigue siendo por base, sin un instante común entre Zenit e identidad.
Se conservaron estos cambios y los preexistentes de `backend/bin/` sin editarlos.

Se actualizaron estado, prioridades y referencias de tareas, con una
[lista concreta para continuar](tareas-criticas-primero.md#tareas-posibles-desde-el-corte-del-23-de-octubre).
No se reabren A1–A5 ni se inventan políticas de retención, jornada o negocio.
Permanecen 17 tareas globales abiertas total o parcialmente y seis P0.
El servidor público y la prueba móvil con dos IP conservan sus aplazamientos.
Esta sesión sólo modifica documentación; no repite suites, escaneos, pruebas
en teléfono, CI remoto ni despliegue.
Verificación documental: `git diff --check` sin errores; 162 enlaces locales
y las dos anclas nuevas comprobados en los seis documentos modificados.

## 23 de octubre de 2026 — Sincronización y actualización de pendientes

Por solicitud del usuario se ejecutó `git pull origin` en `main`: avance
directo de `579270f` a `0723baf`, sin conflictos, con `HEAD` igual a
`origin/main`. Quedan integradas las PR #13 (acta Android) y #14 (QA local,
carga y seguridad, incluida la corrección posterior de Keycloak).
Se conservaron los diez archivos modificados y las rutas sin seguimiento
preexistentes de `backend/bin/`; no se borraron ni incluyeron en una entrega.

Se revisaron historial, estado, prioridades y actas del 21/22. Se actualizaron
las referencias pendientes de horarios/importación local (17/17), retención
Android analizada sin purga, carga local 50/300 y cinco imágenes sin
críticas/altas ni excepciones. Los resultados conservan la fecha y el alcance
de sus actas; no se repitieron ni se atribuyen a esta sincronización.

Permanecen 17 tareas abiertas total o parcialmente y seis P0: respaldo externo,
identidad operativa, jornada/acuse aprobados, tarjeta autenticada, reglas de
negocio y producción para datos reales. Q14/Q19 siguen pendientes; el servidor
público conserva su aplazamiento. Se comprobó el estado de Git y la diferencia
documental; no se verificaron servicios, teléfono, CI remoto ni despliegue.

## 22 de octubre de 2026 — Corrección de Keycloak tras el fallo de CI

El CI de la PR #14 detectó una crítica en certificados y una alta en Java
de la imagen oficial de identidad. Keycloak 26.8.1 por sí solo no las
resolvió. Se conserva su distribución y se construye un runtime UBI mínimo
con Oracle JDK 25.0.5.0.2 verificado por SHA-256, incluido el bloqueo de
certificados eMudhra. Se actualiza pcre2 y se retiran sus seis excepciones.

Las cinco imágenes locales aprobaron el análisis sin críticas, altas ni
aceptaciones. Nueve pruebas aisladas de identidad/seguridad aprobaron con
UID 1000 y sistema de archivos de sólo lectura. Los hallazgos restantes,
licencia, huella de la imagen y límite de ARM64 constan en el
[acta de seguridad](seguridad-keycloak-2026-10-22.md).
No se sustituyó el servicio local en operación ni se desplegó el servidor.
El CI posterior también detectó una carrera en la prueba de salida faltante:
ahora espera la desaparición del botón tras guardar, además de comprobar
el PATCH exacto; no cambia el comportamiento del portal.

## 22 de octubre de 2026 — Consolidación, navegador, carga, imágenes y retención

`git pull --autostash origin main` incorporó dos commits hasta `ad21177` y
restauró los cambios locales sin conflictos. Se revisaron historial y actas,
se comprobaron sus huellas y se consolidó la documentación Android del 21.
Se preservan y excluyen de la entrega los cambios previos de `backend/bin/`.

Por autorización del usuario se ejecutaron las tareas de sesión 1–5:
17/17 casos de horarios/importación y permisos en Chrome local; línea base
50/300 con 1,400 marcajes, 350 cierres, 240 consultas y seis exportes
verificados; revisión/corrección de portal y herramienta de despliegue;
análisis del alcance mínimo de retención Android sin fijar plazo ni purga.

Ambas imágenes finales aprobaron con cero críticas/altas/desconocidas y
tres medias de BusyBox por imagen, sin excepciones nuevas. Portal actualiza
musl; la herramienta construye curl 8.23.0 verificado sin libssh2 vulnerable.
Dos pruebas reproducibles, HTTP/HTTPS de la herramienta y nginx aprobaron.
La limpieza revocó 400 tarjetas y 20 dispositivos ficticios, suspendió dos
empresas, deshabilitó once identidades y restauró el archivo de operadores.
Backend reiniciado para retirar el operador de ensayo; evidencia conservada.

[Acta, métricas, huellas y límites](qa-local-2026-10-22.md) y
[análisis de retención Android](retencion-android.md).
La tarea de sesión 6 queda diferida: no hubo SSH, despliegue ni comprobación
del servidor público. Se mantienen 17 tareas globales abiertas total o
parcialmente y seis P0; Q14/Q19 conservan sus decisiones. No se repiten
suites completas ni se atribuye CI remoto a las imágenes de esta sesión.

## 21 de octubre de 2026 — Entorno y semana/acuse Android reales locales

Completadas las dos acciones autorizadas tras la revisión de avance: entorno
levantado conservando volúmenes/secretos y recorrido visual de semana/acuse
en Samsung SM-S928B API 36 contra backend real local. Backend, portal e
identidad responden; PostgreSQL/Keycloak saludables y V001–V008 exitosas.

Con datos ficticios se comprobaron semana vacía, cierre de ocho horas,
revisión/confirmación/cancelación, objeción, recuperación del mismo recibo
sin copia local, duplicado 409 con sesión Trabajador, reapertura, versión
nueva sin herencia y conformidad. Preferencias originales del teléfono
restauradas byte por byte y túnel retirado. Recursos de ensayo inactivos;
eventos, cierres, acuses y auditoría conservados. Servicios locales levantados.

[Acta, evidencia y límites](qa-android-semana-acuse-2026-10-21.md).
No cambia código ni APK, no despliega el servidor ni prueba NFC físico.
La tarea global 15 avanza; aceptación pública/del usuario y expediente
conservan sus requisitos. Las 17 tareas globales permanecen abiertas total
o parcialmente.

## 21 de octubre de 2026 — Corrección del análisis de seguridad del portal

La [ejecución 39626828092](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39626828092)
de `main`/`b2f7832` aprobó backend, portal y Android, pero falló en seguridad:
la imagen del portal aún incluía nginx 1.30.5 y curl 8.22.0, con tres
críticas y dos altas sin aceptar. Los resultados del análisis del 20 son
antecedentes y no sustituyen una consulta con la base de vulnerabilidades actual.

Se actualizó `web/Dockerfile` a nginx-unprivileged 1.30.6 sobre Alpine 3.24,
fijado al digest oficial
`sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03`.
La nueva base aún incluía curl 8.22.0 y el repositorio estable no ofrecía
8.23.0. Se retiró curl y, por dependencia, libcurl: no se usan en el arranque,
configuración ni servicio del portal. Los usos de curl de la herramienta de
despliegue pertenecen a otra imagen o al host y no se modificaron.
Se conservaron el umbral del escáner y las excepciones existentes de identidad.

Detalle de los hallazgos del fallo y su resolución en la imagen del portal:

| Componente | Hallazgo | Resultado |
| --- | --- | --- |
| nginx 1.30.5-r1 | CVE-2026-93479, CVE-2026-15176 y CVE-2026-97205, críticas; CVE-2026-97629, alta; CVE-2026-95101, media | Actualizado a 1.30.6-r1; ausentes del informe posterior. |
| curl 8.22.0-r0 | CVE-2026-92392, alta | Retirados curl y libcurl del runtime del portal. |
| libxpm 3.5.19-r0 | CVE-2026-94287, media | Actualizado a 3.5.20-r0. |
| busybox, busybox-binsh y ssl_client 1.37.0-r31 | CVE-2025-60876, media | Persisten tres hallazgos de una misma CVE; no se declaran resueltos. |

`infra/check-images.ps1 -Targets web` aprobó a las 16:31:18 UTC:
**0 críticas, 0 altas, 3 medias y 0 excepciones**. Son tres paquetes de
BusyBox asociados a CVE-2025-60876. El SBOM confirma nginx 1.30.6-r1,
libxpm 3.5.20-r0 y ausencia de curl/libcurl. ID de la imagen comprobada:
`sha256:6543df2a1fb2b0aa46a0d5e52d47768e10b7929885214506eae2c545ea7c6b42`.

Construcción y compilación web aprobadas. La imagen se levantó sólo en local:
`nginx -t`, HTML/JavaScript 200, cabeceras/CSP, proxy al backend 200 y API
protegida 401 sin sesión. Conserva UID 101, raíz de sólo lectura y todas las
capacidades retiradas. No se repitió QA A5 ni se desplegó el servidor público.
Evidencia ignorada por Git: `build/security/web.cdx.json`, `web.vulns.json`,
`web-scan.log`, `summary.json` y `web-runtime-2026-10-21.json`.
La validación remota se realizó con el commit corregido: repetir la ejecución
antigua conserva el Dockerfile vulnerable de aquel commit.

Confirmación posterior: la corrección se publicó en `main`/`f72941e` y los
cuatro trabajos aprobaron en la
[ejecución 39636653675](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39636653675):
backend, portal, Android y contrato/seguridad, incluido el análisis de las
cinco imágenes. Queda corregido el fallo de CI; el servidor público conserva
su despliegue pendiente. Esta actualización documental no cambia las imágenes.

El cierre de CI quedó documentado y publicado en `main`/`4852c66`. La evidencia
de los cuatro trabajos aprobados corresponde a `f72941e`, no acredita por sí
sola una ejecución posterior del commit documental. El resumen local conserva
análisis del 20 para las otras cuatro imágenes; la aprobación conjunta del 21
procede de Actions, sin atribuirles un nuevo análisis local.

Pendientes derivados: atender las tres medias de BusyBox en una actualización
posterior y completar Q17 para verificar el despliegue público. La imagen
separada de la herramienta de despliegue conserva su referencia a curl 8.22.0;
no forma parte de estas cinco imágenes y su seguridad no queda acreditada por
este resultado. La actualización de esta bitácora sólo revisa evidencia ya
generada; no repite pruebas, escaneos ni despliegues.

## 21 de octubre de 2026 — Entrega del cierre de QA para publicación

Por solicitud del usuario, se reúne en `main` el cierre documental y técnico
del [acta A5](qa-a1-a5-2026-10-21.md): 33/33 casos locales, corrección de los
permisos tmpfs de Keycloak y regresiones de recursos de identidad y acuse
Android ajeno. Se verificó que la huella de `results.json` coincide con el
acta, así como los 33 IDs, la limpieza y los enlaces relativos de los
documentos modificados. `git diff --check` no encontró errores.

La entrega conserva fuera del commit secretos, cookies, APK, registros y
guiones locales bajo `build/`, además de los cambios preexistentes en
`backend/bin/`. La sincronización con GitHub y su workflow no representan
un despliegue del servidor: Q17, horarios/importación en navegador y el
recorrido visual Android contra backend real mantienen sus pendientes.
La ejecución de CI correspondiente se identifica por el SHA de esta entrega;
las ejecuciones de PR #10/#11 documentadas anteriormente son antecedentes.

## 21 de octubre de 2026 — Documentación reconciliada y QA A5 local

Sobre `main`/`907a93a`, se actualizaron las secciones que seguían mostrando
como pendientes reactivación, consulta personal, acuse del servidor o cambio
obligatorio. Los cortes del 19 y del 20 previos a A1–A5 se identificaron como
históricos, preservando commits/conteos. Se distinguieron la aplicación
Android operativa, la administración con portal real y su presentación debug.
Se corrigió también la propuesta histórica de bases por cliente: el modelo
vigente es SaaS compartido con aislamiento lógico, ya aprobado.

Docker estaba detenido; se levantó el ambiente conservando volúmenes y
secretos. Backend saludable, portal e identidad accesibles, V001–V008 exitosas.
Las 162 pruebas web y compilación aprobaron en la revisión del mismo día.

Se ejecutaron **33/33 casos A5 locales**, con Chrome automatizado, Keycloak y
backend reales, llamadas HTTP por rol y Android instrumental donde corresponde.
[Acta por caso, entorno y límites](qa-a1-a5-2026-10-21.md). Incluye contraseña
nueva obligatoria con OTP, auditoría, 503 real del proveedor, aislamiento,
acuse desde dispositivo simulado firmado, recuperación desde otra sesión,
reapertura/históricos y dos bloqueados paginados. Se observaron renovaciones
automáticas en nueve cuentas y se comprobaron cookies/salida. No acredita
despliegue público, aceptación del usuario ni recorrido visual Android real.

La QA encontró CSS/JS de Keycloak con 404: tmpfs de UID 0/modo 0755 impedían
crear la caché gzip al proceso UID 1000. Se fijó dueño/modo de sus directorios
temporales, manteniendo raíz de sólo lectura y restricciones. Se recreó sólo
identidad; recursos 200 y siete pruebas aisladas salud/realm aprobadas,
incluida la nueva regresión. No se publicó el servidor ni se cambió su realm.

En Samsung SM-S928B API 36 se actualizó sin borrar datos el APK instrumental,
añadiendo rechazo de acuse de otro cierre. Construcción, unitarias, lint y
ambos APK aprobados; `OK: FIXTURE`, código -1. La app operativa conserva la
misma huella que el 20; el cambio sólo amplía instrumentación con HTTP simulado.

Limpieza terminada a las 14:46:43 UTC: once identidades ficticias deshabilitadas,
cuatro dispositivos y tres tarjetas revocados; ambas empresas de QA quedan
identificadas y suspendidas, sin borrar históricos. Se restauró la lista
original de operadores y se reinició backend para retirar el operador de
ensayo. No se modificaron cuentas humanas, OTP existente ni los cambios
preexistentes de `backend/bin/`.

Evidencia local en `build/qa-a5-2026-10-21/`; credenciales/cookies únicamente
en `secrets/`. Siguen 17 tareas globales abiertas total o parcialmente.
Siguiente: inventario y aceptación pública mediante Q17, pantallas de
horarios/importación fuera de A5 y recorrido visual Android contra backend
real. Las decisiones jurídicas, operativas y NFC conservan sus dependencias.

## 20 de octubre de 2026 — Revisión de las 17 tareas y teléfono disponible

El usuario pide identificar cierres posibles y dudas por tarea, e indica
que hay teléfono ADB. Se comprueba Samsung SM-S928B autorizado, API 36.
Backend, portal, base e identidad locales están en ejecución. La
[matriz por tarea](tareas-ejecutables-y-preguntas-qa.md#posibilidad-de-cierre-con-la-evidencia-disponible)
declara qué puede avanzarse y conserva Q01–Q22; Q09 ya no pide conseguir
teléfono. No se cierra íntegramente ninguna de las 17 tareas con evidencia
documental: 9/13 necesitan aceptación del portal y entorno; 15 conserva
recorrido real, expediente y definiciones de jornada/evidencia.

Se construyen ambos APK desde Android de `main`/`e4d7683`: 13 unitarias
aprobadas, lint con 0 errores/13 advertencias. La primera instalación rechaza
la firma Docker; se comprueba que la clave debug local coincide con la app
instalada y se firman ambos APK con ella, sin copiar la clave al repositorio.
La actualización con `adb install -r` aprueba sin desinstalar ni borrar datos.

La instrumentación termina `OK: FIXTURE` e `INSTRUMENTATION_CODE: -1`.
Además de Keystore, cola y sincronización simulada, ejecuta consulta semanal,
objeción, recuperación del acuse sin copia local, reapertura y nulo explícito
del servidor, conflicto 409 y rechazo local en terminal. Usa HTTP simulado
en el teléfono y almacén separado; no acredita backend real, tarjeta física,
login/OTP en navegador ni aceptación visual. Las fuentes instrumentales del
contenedor coinciden con las actuales.

Evidencia ignorada por Git: `build/reanudacion-android-build.log`,
`build/reanudacion-android-fixture.log`, `build/reanudacion-android-evidence.json`
y `build/reanudacion-android-artifacts/` (APK firmados bajo `local-signed/`,
resultados unitarios y lint). Los cambios previos de `backend/bin/` se
conservan. No se cambian redes del teléfono, cuentas humanas ni el servidor
público; la prueba móvil de dos IP sigue diferida a otro desarrollador.

## 20 de octubre de 2026 — PR integrada y contexto para continuar

Se comprueba que `main` local y la referencia `origin/main` coinciden en
`e4d7683`, commit de integración de la [PR #10](https://github.com/Alsegurarp/fs_asistencias/pull/10).
GitHub confirma que está integrada. Los cuatro trabajos de la
[ejecución de la PR](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39504126988)
aprobaron; el árbol de archivos de `e4d7683` coincide con el de la rama
verificada `5c0b5c5`. A1–A5 están incorporadas a `main`.

El usuario confirma funcionamiento después de aprobar la PR. No se recibió
un acta por caso del guion de 33 pruebas ni el inventario del servidor;
esa confirmación no acredita por separado pruebas físicas o despliegue.
Se actualizan las referencias que todavía presentaban la PR y CI como
pendientes, y se conserva el modelo SaaS aprobado. No hay nuevas respuestas
a Q01–Q22 en el repositorio. Permanecen 17 tareas globales abiertas.

El siguiente trabajo es registrar la aceptación por rol del guion A5 y
completar el recorrido de contraseña/OTP de A4. El contexto y las dependencias
están en [Tareas críticas primero](tareas-criticas-primero.md#trabajo-técnico-que-podemos-iniciar).
Los cambios locales anteriores de `backend/bin/` se conservan. En esta
revisión no se repiten pruebas funcionales, se levantan servicios ni se
publican cambios; sólo se actualiza la documentación para retomar.

## 20 de octubre de 2026 — Preparación de PR e integración remota

El usuario solicita la PR de A1–A5 y comprobar compatibilidad con el remoto.
Se incorporan `df020b3` y `ef23c20`, sin conflictos de Git, conservando el
modelo SaaS aprobado y el ajuste de formato Android. Se corrigen referencias
anteriores a bases por cliente en el estado y las preguntas Q01/Q05; las
evaluaciones de respaldo conservan su alcance histórico explícito.
La rama excluye secretos, registros locales y `backend/bin/`. La PR ejecuta
los cuatro trabajos de CI sobre la integración propuesta. No se integra
la PR a `main` ni se despliega el servidor público en esta sesión.

## 20 de octubre de 2026 — Implementación y validación local A1–A5

El usuario autoriza las cinco entregas. Se implementaron reactivación desde
portal, Mi asistencia web, recuperación del acuse desde servidor y cambio
obligatorio de contraseña para cuentas activas vinculadas. Contrato 0.13,
62 operaciones, sin dependencias ni migraciones nuevas. A5 entrega el
[guion con datos ficticios y 33 casos](qa-a1-a5.md).

Aprobaron construcción/unitarias y 75 integraciones PostgreSQL, 162 pruebas
y compilación del portal, 13 unitarias Android, lint y ambos APK, contrato
y 7 comprobaciones de identidad aislada. El cliente técnico conservó la
credencial OTP y otras acciones, con alcance explícito al rol manage-users.
Backend y portal reconstruidos y analizados sin altas/críticas sin atender.
Arranque y HTTP locales comprobados.

Se preparó el cliente técnico sólo en Keycloak local, con secreto ignorado
por Git y montado únicamente en backend; no se modificaron cuentas humanas.
Se mantuvieron volúmenes e históricos. Los cambios anteriores de backend/bin
se conservaron; el entorno también refleja allí copias de fuentes modificadas.
No se hizo commit/push ni despliegue público. Instrumentación, navegador,
recuperación de acceso perdido y decisiones globales conservan sus pendientes.
[Detalle y evidencia](entregas-a1-a5.md).

## 20 de octubre de 2026 — Trabajo ejecutable y preguntas para QA

Se revisaron código y documentación sobre `1984be3`, junto con la evidencia
final de Actions 39472918113: cuatro trabajos aprobados. Se consultaron de
nuevo backend (`UP`), portal (HTTP 200) y ADB (sin teléfonos). No se repitió
la batería completa ni se comprobó el servidor público.

Se declararon cinco entregas locales posibles: reactivación de empresas,
semana personal web, recuperación del acuse desde servidor, cambio obligatorio
de contraseña para cuentas vinculadas y guion de QA por rol. Cada una conserva
las dependencias de operación y aceptación de su tarea de origen.

Se prepararon [22 preguntas con IDs estables](tareas-ejecutables-y-preguntas-qa.md)
para los desarrolladores y los responsables de producto/operación, con mapa
a las 17 tareas abiertas. Las respuestas pendientes no se interpretan como
decisiones aprobadas. No se implementaron funciones, cambiaron reglas ni
publicaron estos documentos en esta revisión.

## 20 de octubre de 2026 — Actions antes de publicar avances

El usuario autoriza ejecutar GitHub Actions y después hacer push. Se comprobó
que `HEAD` y `origin/main` coinciden en `565dbdd`, y se ejecutó manualmente
`Verificaciones` sobre esa versión. Backend, portal, Android y
contrato/seguridad aprobaron en la
[ejecución 39472077601](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39472077601).

Se prepara la publicación de siete documentos: informe local, estado,
pendientes, prioridades, verificaciones, índice y esta bitácora. Se excluyen
los cambios preexistentes de `backend/bin/`, secretos y archivos de `build/`.
El push dispara otra ejecución para el commit documental; no despliega
servicios ni cierra las tareas de aceptación manual.

## 20 de octubre de 2026 — Verificación actualizada del ambiente local

Por solicitud del usuario se repitió la verificación sobre `main`/`565dbdd`.
Docker y los cinco servicios estaban detenidos. Se inició Docker, se
reconstruyó el ambiente conservando volúmenes y secretos y se aplicó V008
sobre la base local, que seguía en V007. Backend, portal, base e identidad
quedan en ejecución; el migrador terminó con código 0.

Aprobaron construcción/unitarias y 74 integraciones del backend, compilación
y 151 pruebas del portal, 13 unitarias Android, lint sin errores y ambos APK,
6 comprobaciones de identidad aislada, contrato/ejemplos, secretos en 57
commits y análisis de las cinco imágenes. Se conservan las seis excepciones
de identidad; no hay altas o críticas nuevas sin atender. Los IDs de las
cuatro imágenes en ejecución coinciden con los analizados.

HTTP local comprobó backend `UP`, portal/JavaScript, identidad/emisor y 401
sin sesión directo y por proxy; CSP correcta. Después de V008, el ensayo
restauró 131 tablas y 1,970 filas con contenido idéntico. No sustituye la
recuperación completa del 18 ni guarda una copia operativa.

ADB no mostró teléfonos: no se ejecutó instrumentación ni tarjeta física,
login/OTP integrado o semana/acuse real. Tampoco se probó sesión completa del
navegador, release, carga o servidor público. Las 17 tareas conservan sus
dependencias. Se retiraron sólo los contenedores desechables de identidad e
integración; se conservaron los cambios preexistentes de `backend/bin/`.
No se hizo commit, push ni despliegue público.

[Informe, advertencias, huellas y archivos de evidencia](verificacion-local-2026-10-20.md).

## 20 de octubre de 2026 — Accesos Android, semana y tarjetas MF1K

Se integraron los cambios locales de Android conservando semana/acuse y el
formato actualizado del código de vinculación. La app añade bienvenida,
Administración dentro de la app mediante el portal HTTPS, presentación
separada y preparación física de credenciales con dos empleados de ejemplo.

La vista del cliente muestra empleados listos para cargar; no aprueba
solicitudes. Carga y borrado requieren confirmación y verifican por relectura.
Se añadió consulta del contenido y se ocultaron los detalles técnicos. El
borrado libera la asignación local para reutilizar la tarjeta; no cambia
asignaciones del servidor ni acredita autenticidad para asistencia.

Validación: debug, instrumentación compilada, lint y 13 pruebas unitarias.
APK final instalado por Wi-Fi sin borrar datos. No se ejecutó instrumentación
ni release; siguen login/OTP integrado, tarjetas físicas y semana/acuse
contra backend publicado. Se conserva el reporte del usuario de que no pudo
sobrescribir, sin afirmar una causa física ni éxito de borrado no observado.

Se separa la entrega por cambio: `fix(build)` para caché Docker;
`feat(android)` para semana/acuse y presentación; `feat(nfc)` para credenciales;
`feat(android)` para bienvenida/administración; `docs(android)` para alcance,
verificación y pendientes. [Guía actualizada](guia-app-android.md).

## 19 de octubre de 2026 — Modelo de alojamiento aprobado

Gabriel, Roberto Arregui y Alex Segura aprueban que Zenit opere por defecto
como SaaS administrado por fastSolution. Producción será exclusiva de Zenit,
separada de los ambientes de prueba y compartida lógicamente entre empresas;
no se asigna una VPS, base ni bucket por cliente. Una base o un stack dedicados
se cotizan como modalidad Enterprise cuando los exijan contrato, sector,
residencia, volumen o riesgo. Una instalación en infraestructura del cliente es
una oferta distinta.

El servidor compartido actual queda sólo para datos ficticios y se abandona
antes del primer dato real. La decisión no selecciona proveedor ni región y no
autoriza producción: siguen pendientes contratos de tratamiento y
subprocesadores, privacidad y retención, revisión jurídica, respaldo externo,
custodia y restauración. No se cambió código, no se desplegó y no se cargaron
datos reales en esta entrega documental.

## 19 de octubre de 2026 — Corte de evidencia y espera de QA

El usuario pide guardar el avance y continuar después de su QA prevista
para hoy. Se consolida [la evidencia del corte](evidencia-avance-2026-10-19.md):
commit `8a86916` publicado en `main`, los cuatro trabajos de la ejecución
39365266093 aprobados, resultados locales, huellas de registros y decisiones
posteriores de arquitectura, perfiles y contraseñas.

Se distingue el código publicado de las definiciones y evaluación que siguen
guardadas localmente, y de la versión desplegada, todavía no confirmada para
esa QA. Permanecen 17 tareas abiertas y no se acredita ninguna QA nueva.
Se espera recibir sus resultados antes de continuar con implementación.
No se realiza otro push, despliegue ni cambio de cuentas o respaldos.

## 19 de octubre de 2026 — Alojamiento definido y evaluación del respaldo anual

El usuario precisa que la infraestructura del cliente aloja sólo sus datos
operativos y el sistema vive en un VPS de fastSolution. El destino de los
respaldos sigue en evaluación. Declara perfiles típicos de 50 empleados
(mediano) y 300 (grande), con entrada, salida e inicio/fin de descanso.
Con un descanso diario y cinco días por 52 semanas, representan 52,000 y
312,000 marcajes al año; se requiere un año consultable.

Se entrega [evaluación de respaldo anual](evaluacion-respaldo-anual.md), con
tarifas oficiales de S3, GCS, R2 y B2, supuestos de tamaño y costo de varias
copias. Propone conservar el año en PostgreSQL del cliente y usar objetos
externos para recuperación; S3 Standard inicialmente o GCS Standard si ya
se opera en Google Cloud. Las doce copias mensuales adicionales son una
propuesta, sin aprobar ni habilitar. No se presupone compresión medida.

La revisión confirma que el backend usa una sola fuente de datos: el modelo
distribuido exige adaptación y pruebas. P0-01 continúa abierta. No se crean
buckets, contratan servicios, transfieren datos ni cambian conexiones o
políticas de borrado. Las tarifas consultadas y sus condiciones se enlazan
en la evaluación; costos de VPS, operación, solicitudes y red van aparte.

## 19 de octubre de 2026 — Respuestas sobre respaldo y contraseña

El usuario aporta definiciones para P0-01 y P0-02:

- Respaldo por ambas partes, con responsabilidad principal de fastSolution
  sobre la información de sus clientes. El tercero no tiene la información
  del cliente y el cliente debe contar con infraestructura propia; el modelo
  sigue por definir. Se registra el alcance y lo pendiente en
  [Recuperación](recuperacion-servicio.md#definición-recibida-para-el-modelo-de-respaldo).
- Recuperación administrada desde el portal web: visualizar empleados y
  declarar para la cuenta seleccionada el cambio de contraseña al próximo
  login. Se registra como requisito aún sin implementar en
  [Identidad](preparar-ambiente-compartido.md#recuperación-administrada-desde-el-portal).

La revisión de `Users.tsx` y `UserService.kt` confirmó que el portal no ofrece
esa acción y que la contraseña reside en el proveedor de identidad. Los
respaldos existentes contienen las bases completas de una instalación, no
una copia individual preparada para cada cliente.

Se solicitaron dos precisiones: si la infraestructura del cliente alojará
sólo su respaldo o también el sistema, y cómo obtiene acceso quien olvidó
su contraseña antes de establecer la nueva. No se eligieron mecanismos por
omisión. Ambas P0 permanecen abiertas. Sólo se actualiza documentación;
no se modifican cuentas, contraseñas, reglas OTP, respaldos ni despliegues.

## 19 de octubre de 2026 — Publicación autorizada de la tarea 14 y pendientes

El usuario autoriza hacer push de los avances del día. Se prepara en `main`,
sobre `430ac29`, el detalle de personas bloqueadas por corrida, contrato 0.12,
migración V008, portal, pruebas y documentación. Incluye el estado de las
17 tareas abiertas y la entrega de la prueba con datos móviles a otro
desarrollador. Se conservan fuera del commit secretos, registros locales,
`portalError.md` y las tres modificaciones previas bajo `backend/bin/`.

Las validaciones locales de esta implementación están en la entrada siguiente.
El push dispara las verificaciones de GitHub Actions; su resultado corresponde
al nuevo commit y debe consultarse por separado. No se despliegan servicios
ni se cambian reglas de negocio o protecciones de rama.

## 19 de octubre de 2026 — Tarea 14 implementada y validada localmente

Las corridas guardan a cada persona bloqueada con causa e incidencias en
V008 (`week_closure_run_blocked`), dentro de la misma transacción del intento
de cierre. Un reintento actualiza el bloqueo o lo retira si consigue cerrar;
una corrida terminada conserva su detalle aunque otra cierre después a esa
persona. No se reconstruyen bloqueos de corridas anteriores a esta función.

Contrato 0.12.0, 61 operaciones: se añade
`GET /week-closure-runs/{runId}/blocked`, paginado, con los permisos de lectura
actuales y filtro de empresa. El portal muestra nombres, causas, incidencias,
páginas y reintento ante errores; las corridas antiguas conservan sus conteos.

Comprobado:

- Backend: construcción, unitarias y 74 pruebas de integración PostgreSQL.
  Incluyen ambos motivos, incidencias, paginación y validación de parámetros,
  permisos, aislamiento, interrupción y retirada del bloqueo al reintentar.
  Evidencia: `build/task14-backend-it.log`.
- Portal: compilación y 151 pruebas aprobadas. Evidencias:
  `build/task14-web-build.log` y `build/task14-web-tests.log`.
- Contrato y ejemplos válidos: `build/task14-contract.log`. Sintaxis de
  diagramas de cierres y modelo de datos comprobada con PlantUML.

Implementación completada localmente. No se publicó ni desplegó; falta
aceptación de pantallas con sesión real. La migración V008 debe acompañar
al backend y el portal nuevos. La tarea 8 con datos móviles sigue entregada
a otro desarrollador, por indicación del usuario.

## 19 de octubre de 2026 — Prueba móvil diferida y continuación de tarea 14

El usuario indica dejar la prueba con datos móviles pendiente para otro
desarrollador. Se registra su procedimiento y criterio de aceptación en
[TareasPendientes.md](TareasPendientes.md#entrega-a-otro-desarrollador-prueba-con-datos-móviles-tarea-8).
La tarea 8 sigue abierta; no se modificarán los ajustes de conexión del teléfono
para ejecutarla en esta continuación. Se continúa con la tarea 14: detalle
individual de personas bloqueadas en corridas de cierre.

## 19 de octubre de 2026 — Dispositivo conectado y nueva comprobación HTTPS

Tras volver a consultar ADB, el Samsung SM-S928B aparece autorizado. Se usó
la instrumentación ya instalada, sin modificar ni reinstalar la aplicación:

- Autoensayo local aprobado: Keystore ES256, migración sin pérdida, activación,
  cola cifrada, reintento idéntico, recibos, captura concurrente y reenrolamiento
  sin borrado. Evidencia: `build/device-recheck-fixture.log`.
- Prueba pública desde la computadora aprobada nuevamente: HTTPS, cabeceras
  falsas y cuota de activación (diez respuestas 410 y después 429). Evidencias:
  `build/public-proxy-check.json` y `build/device-recheck-public-proxy.log`.
  La evidencia anterior se conservó en `build/public-proxy-before-device-*.json`.
- El ensayo del teléfono no obtuvo el resultado esperado mientras estaba
  agotada esa cuota. Su mensaje no muestra el estado recibido, por lo que no
  se atribuye un HTTP concreto a ese fallo. Registro:
  `build/device-recheck-proxy-phone.log`.
- Tras vencer la ventana, el teléfono recibió `410/enrollment_gone` por HTTPS
  entre 23:53:30 y 23:53:31 UTC. Evidencias:
  `build/device-recheck-proxy-baseline.log` y `.json`.

El teléfono usa Wi-Fi y tiene los datos móviles desactivados. La tarea 8
permanece abierta: falta comprobar otra salida pública con cuota independiente
durante la misma ventana. Se consultó si dispone de datos móviles para ese
ensayo; todavía no se cambiaron sus ajustes de conexión.

No se crearon empleados, tarjetas ni dispositivos: se usó un código de
activación imposible. No se desplegó ni se repitió el recorrido completo
personal/terminal contra backend. La disponibilidad actual del teléfono
corrige el bloqueo de ADB observado en la revisión anterior.

## 19 de octubre de 2026 — Declaración de TareasPendientes.md

A petición del usuario se crea [TareasPendientes.md](TareasPendientes.md),
con el estado posterior a la integración en `main` (`430ac29`). Se declaran
18 tareas abiertas total o parcialmente: seis P0, cuatro P1 y ocho P2,
conservando la numeración de [Tareas críticas primero](tareas-criticas-primero.md).

Las tareas 7 y 11 quedan identificadas como completadas en su alcance.
Se incorpora la [ejecución aprobada de main](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39303294132),
con los cuatro trabajos de GitHub Actions correctos. Se distingue implementación
de despliegue y aceptación, y se declara la tarea 14 como el siguiente trabajo
que puede iniciarse desde el repositorio. Se registran las dependencias de
segunda IP pública, navegador, retención Android y coordinación SSH.

Este registro sólo actualiza documentación: no inicia esas tareas, modifica
reglas de negocio, elimina evidencia ni despliega servicios.

## 19 de octubre de 2026 — Integración de avanceLunes en main

El usuario autoriza integrar la rama. Se actualizó `main` por fast-forward
desde `8dc2a75` hasta `4bde26f`, conservando los cuatro commits de avance y
corrección, sin conflictos ni cambios adicionales de aplicación. La integración
se preparó en una copia de trabajo separada para preservar los tres archivos
generados previamente modificados y `portalError.md` en el espacio del usuario.

El commit de origen tiene los cuatro trabajos aprobados en la
[ejecución 39301664714](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39301664714).
Se añade esta actualización documental para declarar la adopción del workflow
en `main`. Su publicación dispara las mismas cuatro verificaciones; los
resultados por commit se consultan en
[GitHub Actions](https://github.com/Alsegurarp/fs_asistencias/actions/workflows/verificaciones.yml).
No se cambiaron protecciones de rama ni se desplegaron servicios.

## 19 de octubre de 2026 — GitHub Actions aprobado

La [ejecución 39300778600](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39300778600),
del commit `d5d2a007f898839e8a59d69ac4087c9817ef39ac` en `avanceLunes`,
aprobó **los cuatro trabajos completos**: backend, portal, Android y
contrato/seguridad. Backend incluyó preparación de secretos, integración,
arranque de identidad, pruebas de realm/OTP/readiness y limpieza. Checkout y
su limpieza final aprobaron en todos los trabajos. Evidencias locales:
`build/actions-39300778600.json` y `build/actions-watch-latest.log`.

Quedan comprobadas en GitHub las dos correcciones: retirada del gitlink
huérfano (`0275823`) y creación de directorios por el runner antes del generador
de secretos (`d5d2a00`). El push no fue rechazado; fallaron las verificaciones
que se dispararon después. Para adoptar el workflow en `main` falta integrar
la rama y decidir si sus trabajos serán obligatorios antes de integrar cambios.
No se modificaron protecciones de rama ni se desplegaron servicios.

## 19 de octubre de 2026 — Permisos del runner y avance de Actions

La corrección `0275823` superó checkout en los cuatro trabajos. En la
[segunda ejecución](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39299707609)
aprobaron **portal, Android y contrato/seguridad**, incluido el análisis de las
cinco imágenes construido en GitHub. Backend aprobó compilación e integración,
pero falló antes de identidad: `mkdir` no pudo entrar a `secrets/`, que Docker
había creado con dueño `root` y modo 700. Evidencias locales descargadas:
`build/actions-39299707609.json` y `build/actions-backend.log`.

Se corrigió el orden del workflow: el runner crea primero la ruta de secretos
de identidad y sus padres; después se ejecuta el generador existente. El dueño
de los directorios sigue siendo el runner y el generador mantiene el modo 700.
No se ampliaron permisos de secretos ni se cambió la receta de producción.

Comprobación Linux sin red, con secretos ficticios en tmpfs: el directorio
creado por root reprodujo `Permission denied`; el creado por el usuario del
runner permitió crear la subcarpeta y leer los archivos necesarios después de
ejecutar el mismo generador de Compose. YAML y orden de pasos también
comprobados. Evidencias: `build/ci-secrets-root.log` y
`build/ci-secrets-runner.log`. Falta acreditar el recorrido completo de backend
e identidad en la siguiente ejecución de GitHub.

## 19 de octubre de 2026 — Corrección del checkout de GitHub Actions

El push de `fdf8cc4` a `avanceLunes` se recibió correctamente. La
[primera ejecución](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39280373595)
falló en checkout en los cuatro trabajos, antes de compilar o probar.
El usuario facilitó la salida en `portalError.md`; Git intentaba procesar
`fastSolutionLanding/prototype_fastSolution`, registrado como gitlink sin
`.gitmodules` ni URL de submódulo.

Se retiró únicamente esa referencia del índice y se excluyó la carpeta local
en `.gitignore`, conservando su contenido. Ningún código ni receta del
monorepo usa esa ruta. El despliegue de la landing ya utiliza su propio clon
mediante `LANDING_REPO` en `deploy/servidor/desplegar.sh`.

Se reprodujo el mismo fallo en un clon Linux limpio, sin red y con el origen
montado en sólo lectura. Tras retirar la referencia en ese clon, el recorrido
recursivo que ejecuta checkout terminó con código cero, sin gitlinks huérfanos
y conservando la carpeta. Evidencia: `build/checkout-regression.log`.
Falta confirmar el resultado completo de Actions después de publicar la
corrección. `portalError.md` y los tres archivos generados previos quedan fuera
del commit. No se desplegaron servicios ni se modificó `main`.

## 19 de octubre de 2026 — Publicación autorizada de los avances

El usuario autoriza crear el commit y hacer push de los cambios verificados.
Se utiliza la rama `avanceLunes`, sobre `8dc2a75`, sin modificar `main` ni
desplegar servicios. El alcance incluye el ensayo Android reproducible,
configuración de empresa, verificaciones automáticas, correcciones de seguridad
y documentación. Se excluyen secretos, evidencias locales bajo `build/` y las
tres modificaciones previas de archivos generados bajo `backend/bin/`.
Se comprobó el remoto antes de preparar el commit. El resultado de la primera
ejecución de GitHub Actions se debe verificar tras publicar.

## 19 de octubre de 2026 — Proxy público, horarios e importación con sesión real

El usuario solicita registrar las pruebas y continuar el trabajo restante,
facilitando un token nuevo mediante `secrets/android-development-token.txt`.
Se comprobó `/me` con rol `admin_empresa` y empresa asignada; no se copiaron
el token ni credenciales a código o registros.

**Orden 8 (P1): comprobación pública parcial aprobada.** El guion versionado
[`infra/test-public-proxy.mjs`](../infra/test-public-proxy.mjs) verificó:

- HTTP redirige al mismo dominio HTTPS.
- `X-Forwarded-Proto`, `X-Forwarded-Host` y `Forwarded` falsos no cambian el
  emisor ni los endpoints HTTPS publicados por identidad.
- Diez activaciones con firma válida y un código imposible respondieron
  `410/enrollment_gone`; las siguientes dos, `429/rate_limited`, aun cambiando
  las cabeceras IP en cada petición. No se crearon dispositivos.
- El estado público del servicio siguió respondiendo tras agotar esa cuota.

Evidencia: `build/public-proxy-check.json`, 14:59:50–14:59:51 UTC. Falta
comprobar desde una segunda IP pública real que otro visitante conserve su
cuota durante la misma ventana. Se solicitó confirmar datos móviles en el
teléfono para esa prueba; no se ha considerado cerrada la tarea completa.

**Orden 9 (P1): horarios e importación aprobados por API HTTPS.** El guion
[`infra/test-directory-api.mjs`](../infra/test-directory-api.mjs) comprobó:

- Horario de lunes a viernes 09:00–17:00, descanso de 30 minutos y persistencia
  al consultar; asignación vigente y otra futura que no cambia la actual.
- Validación de CSV con una fila válida y otra con fecha inválida, sin modificar
  empleados; aplicación de la aceptada y omisión de la rechazada.
- Reenvío con la misma clave idempotente, repetición con otra clave sin duplicar,
  actualización del empleado importado, sede inexistente y archivo vacío.
- Limpieza confirmada: dos empleados y su sede quedaron inactivos. Los horarios
  e importaciones se conservan como históricos de prueba.

Evidencia: `build/qa-df119b67-ac8b-4c90-9-directory.json`, 14:59:48–14:59:51 UTC.
La cuenta era de administración: no acredita permisos de otros roles, pantallas,
cookies, renovación ni cierre de sesión del portal. Esos puntos siguen abiertos.

**Orden 11 (P1): verificaciones automáticas preparadas y comprobadas localmente.**
El workflow [verificaciones.yml](../.github/workflows/verificaciones.yml) reúne
cuatro trabajos con las recetas Docker existentes, permisos de lectura y
checkout fijado a SHA. Se validaron su YAML y las comprobaciones siguientes:

- Backend: construcción, unitarias y **74 pruebas de integración PostgreSQL**.
  Evidencia: `build/pending-backend-ci.log`; contenedores de prueba retirados.
- Portal: **148 pruebas** y compilación aprobadas, incluidos nueve casos de
  configuración de empresa y navegación por rol. Evidencia:
  `build/pending-web-settings.log` y `build/pending-web-settings-build.log`.
- Android: nueve unitarias, lint y construcción de app e instrumentación en
  Docker (`build/pending-android-ci.log`). También se compiló con el SDK local y se ejecutó la fase `proxy` en
  el Samsung conectado: devolvió `410/enrollment_gone` por HTTPS. Evidencia:
  `build/pending-proxy-phone.log`. Este ensayo aislado no acredita dos IP reales.
- Identidad: **seis pruebas aprobadas**, incluidas importación del realm, OTP y
  readiness HTTP 200/503. Se corrigió el healthcheck compartido: aceptaba un
  componente `UP` aunque la respuesta global fuera 503 durante el arranque;
  ahora exige HTTP 200. Evidencia: `build/pending-identity-tests.log`.

La primera ejecución en GitHub queda pendiente de subir el workflow. No se
crearon commits, se publicó una rama ni se modificaron protecciones de GitHub.
El contrato y sus ejemplos aprobaron (`build/pending-contract.log`); Gitleaks
no detectó secretos en los 44 commits ni en las fuentes modificadas, excluyendo
secretos locales y archivos generados (`build/pending-secret-scan.log` y
`build/pending-source-secrets.log`). También aprobaron sintaxis de los guiones,
configuración Compose, enlaces locales de los documentos y `git diff --check`.

**Orden 12 (P1): cinco imágenes locales analizadas y correcciones verificadas.**
El guion [check-images.ps1](../infra/check-images.ps1) genera inventarios,
registra ID y fecha por imagen y falla ante altas/críticas sin aceptar. El
análisis actualizado encontró altas de libexpat en backend/portal y libx11
en portal; se actualizaron esos paquetes, reconstruyeron ambas imágenes y
repitió su análisis. Las cinco entradas de `build/security/summary.json`
aprobaron con cero altas/críticas sin atender. Keycloak conserva las seis
excepciones previas; no se aceptaron hallazgos nuevos. La base de Grype se
trasladó a un volumen Docker para evitar la lectura lenta de SQLite desde Windows.
Se verificó que los cinco IDs actuales coincidieran con los del resumen y se
retiraron las cachés temporales duplicadas; se conservaron los informes y el
volumen de análisis activo. No quedaron contenedores de prueba ejecutándose.

Estos resultados corresponden a los IDs registrados, no a las imágenes del
servidor. Falta obtener su inventario mediante Gabriel, desplegar las
correcciones y comprobar el servicio público; no se hizo SSH ni despliegue.
El procedimiento está en [Verificaciones automáticas](verificaciones-automaticas.md).

**Orden 13 (P2): configuración de empresa implementada localmente.**
Consulta para administración, RH, supervisor y auditor; edición sólo para
administración. Usa GET/PATCH `/tenant`, envía únicamente campos modificados,
permite desactivar el cierre con `null`, conserva entradas tras errores y no
pisa campos ajenos cuando se refresca la consulta durante una edición. Se
reutilizaron API, permisos y componentes existentes. Las pruebas del portal
pasaron; falta aceptación visual con sesión real y despliegue. No se cambió
la configuración de ninguna empresa publicada.

Se solicitó el criterio de retención Android antes de implementar purga y la
disponibilidad de datos móviles para la segunda IP. No se eliminó evidencia
de captura ni se modificaron radios del teléfono. Continúan los bloqueos P0
y el resto de tareas declaradas en [Tareas críticas primero](tareas-criticas-primero.md).

## 19 de octubre de 2026 — Android reproducible contra backend local y HTTPS

**Orden crítico 7 (P1): completado para tarjeta simulada y datos ficticios.**
Se agregó `BackendSmoke.kt` al runner existente, con fases `activate`, `queue`
y `sync` en procesos separados, y el guion versionado
[`infra/test-android-backend.ps1`](../infra/test-android-backend.ps1). El modo
sin argumentos conserva el fixture y ahora informa `OK: FIXTURE`; el backend
informa `OK: BACKEND` y los argumentos incompletos fallan sin recurrir al fixture.

Se corrigió un bloqueo real: `AttendanceRepository` exigía grupos de cuatro
caracteres y el backend emite cinco. La app acepta ahora el límite de 6–32
caracteres del contrato, como el otro repositorio de activación existente,
y la pantalla muestra el formato emitido por el servidor.

Comprobado con Gradle local: 9 pruebas unitarias sin fallos, lint con cero
errores (10 avisos), APK debug y de instrumentación construidos juntos e
instalados con actualización en Samsung SM-S928B, Android API 36. Ambos modos,
personal y terminal, pasaron contra `http://localhost:18080` mediante túnel ADB
y después contra `https://zenit.fastsolution.com.mx` sin túnel:

- Activación persistente, clave Keystore no exportable y código de un uso.
- Captura cifrada con transporte interrumpido, reintento sin cambiar sobres,
  bloqueo de renovación con pendientes y cola conservada entre procesos.
- Dos recibos aceptados y uno rechazado por tarjeta desconocida en cada modo,
  reenvío idempotente y renovación con sesión nueva/consecutivo reiniciado.
- Exactamente dos marcajes en backend por empleado, sin duplicados.
- Dispositivos y tarjetas revocados, empleados y sede desactivados; históricos
  y auditoría conservados. La empresa local aislada quedó suspendida, la cuenta
  técnica desactivada y su cliente de identidad eliminado; cero dispositivos
  activos y cero sesiones abiertas en el ensayo local.

Registros locales ignorados por Git: `build/android-af822ab61981496891c58d785b54f16d.log`
(local) y `build/android-d2eb5507819b4e1498e0372519d824a4.log` (HTTPS). Cada uno
incluye HEAD `8dc2a75`, la presencia de cambios locales, hashes de ambos APK,
fases y limpieza; no contiene tokens ni códigos de activación. El usuario
facilitó la sesión HTTPS mediante un archivo bajo `secrets/`; no se utilizó ni
se guardó su contraseña. No había navegador conectado al control UI.

El guion admite `SIM_TOKEN` o `TokenPath`, vuelve a leer este último en cada
petición y exige cuatro minutos de vigencia antes de crear recursos. El fixture
anterior y el fallo ante argumentos incompletos también se ejecutaron en el
teléfono. La búsqueda de secretos de los 44 commits del historial no encontró
hallazgos. Pasaron la revisión de enlaces y `git diff --check`.

Límites: el corte de transporte se induce sólo en el almacén del ensayo, sin
apagar redes del teléfono. No acredita NFC autenticado, ubicación física,
release, ni cookies/renovación/cierre de sesión del portal. La prueba HTTPS no
despliega el código modificado ni cierra la comprobación de cuotas y cabeceras
falsas del orden 8. Los bloqueos P0 siguen abiertos.

## 19 de octubre de 2026 — Verificación y declaración de tareas pendientes

Se contrastaron estado, prioridades y decisiones con el commit `8dc2a75` y las
fuentes de instrumentación Android, almacenamiento local, navegación del portal
y configuración de proxies. Se conservan los 20 órdenes de
[Tareas críticas primero](tareas-criticas-primero.md), con criterios de cierre
y dependencias. Su columna Orden es la referencia para continuar; los números
históricos de Estado y pendientes se mantienen como correspondencia.

Se corrigieron notas desactualizadas: Dispositivos y alta/listado de empresas
ya existen, los tres correos administrativos están confirmados y el cambio de
proxies está implementado. La bitácora del 18 registra 74 pruebas de integración,
138 de portal y recuperación local de 130 tablas/1.867 filas; son resultados
anteriores, no comprobaciones ejecutadas hoy.

Primera tarea técnica propuesta: orden 7, hacer reproducible el recorrido de
Android contra backend. `SmokeInstrumentation` sigue usando `FixtureServer`
sin atender argumentos de conexión. Se declararon alcance, aceptación,
dependencias y evidencia de cierre. Los respaldos externos y la identidad
operativa conservan sus definiciones pendientes; no se aprobaron reglas de
negocio ni se inició implementación.

Verificación de esta entrega: revisión de fuentes y documentos, enlaces
relativos de los documentos modificados y `git diff --check`. No se ejecutaron
pruebas ni se accedió al servidor o al teléfono. Se conservaron las tres
modificaciones previas bajo `backend/bin/`.

## 18 de octubre de 2026 — Backend listo para conectar la app

Para que la app se conecte al ambiente publicado hacían falta cuatro cosas,
y ésta es la parte que vive en el repositorio:

- **Dirección real del visitante.** El backend no leía la dirección
  reenviada y el nginx del portal reemplazaba `X-Forwarded-Proto` por `http`:
  el límite de activaciones fallidas contaba a todo el público como una sola
  dirección. Ahora Tomcat toma `X-Forwarded-For` y `X-Forwarded-Proto` sólo
  desde direcciones internas, y el portal conserva el esquema que trae el
  borde.
- **Tarjeta simulada encendida** en `deploy/servidor/zenit/servidor.env`,
  sólo mientras el ambiente tenga datos ficticios.
- **Pantalla Dispositivos en el portal:** emitir el código de activación
  personal o de terminal, listar dispositivos y revocarlos, con los permisos
  del contrato.
- **Pantalla Empresas para quien opera el servicio:** listar empresas y dar
  de alta una con su primera administración. Antes el portal sólo le decía
  que se implementaría después, y sin ella no había cómo crear la empresa de
  prueba sin llamar al API a mano.
- **Guía:** la dirección de la app es sin `/api`, y
  [Conectar la app al ambiente publicado](guia-app-android.md#conectar-la-app-al-ambiente-publicado)
  explica cuentas, empresa de prueba, huella de la tarjeta y activación.

Verificado en Docker: 74 pruebas de integración del backend, incluida una
nueva con dos visitantes detrás del proxy; con la lectura de cabeceras
apagada, esa prueba falla. Portal: compilación y 138 pruebas, 7 nuevas de
Dispositivos y 3 de Empresas. La receta de la huella se comparó con el cálculo sobre los bytes
en un contenedor. Sin verificar todavía: el despliegue, las cuentas, la
empresa de prueba y el recorrido con un teléfono real.

## 18 de octubre de 2026 — Flujos actuales antes de ampliar permisos

Alexis pide revisar la lógica existente antes de continuar con altas y nuevos
permisos. Se documentaron [17 flujos PlantUML](flujos/README.md), contrastados
con servicios, contrato, migraciones, portal y Android. Se generó la
[cobertura de las 60 operaciones](flujos/cobertura-api.md) y un modelo por áreas
con las 28 tablas actuales del producto. Sintaxis, SVG y PNG se comprobaron
con PlantUML 1.2026.8; los renderizados están en `build/flujos/`, ignorado por Git.

Se distinguen empresa, empleado, usuario de acceso, dispositivo y evento;
también API implementado, UI conectada y presentación móvil sin datos reales.
El rol superadmin de producto con acceso transversal no existe. Alexis desea
acceso futuro a ambas plataformas y datos reales, pero indica no implementarlo
si no está definido. No se agregaron roles, selector de empresa, suplantación
ni excepciones nuevas de autorización.

Para la tarea 2 quedaron declarados Roberto Arregui, Gabriel Hidalgo y Alexis
Segura como superadmins previstos de identidad. Los tres correos están ahora
confirmados en `secrets/zenit-identity-plan.json`, protegido localmente y fuera
de Git; no se crearon cuentas remotas. El único operador solicitado es
`operation-zenit@fastsolution.com.mx`, identificador sin buzón. Se generó una
contraseña temporal de 16 caracteres, comprobada y guardada en
`secrets/zenit-operator-credential.json`, con acceso restringido al usuario local.
No se publica la contraseña ni se aplicó a una cuenta todavía.

SMTP continúa pendiente por tramitación del correo. Falta definir el encargado
de OTP/recuperación del operador y resolver su autorización interna: el código
actual reconoce operadores por correo verificado. Se propuso usar su identificador
Keycloak, pero no se implementó al priorizar esta revisión. La tarea 1 conserva
sus pendientes técnicos con Gabriel. No se accedió al servidor en esta entrega.

## 18 de octubre de 2026 — Tarea 2: preparación de identidad operativa

Alexis solicita continuar con la tarea 2 del orden por criticidad: cuentas
personales, OTP, operador y SMTP. La tarea 1 mantiene su pendiente con Gabriel.

Se encontró que el realm permitía reiniciar el OTP dentro de la recuperación
y no exigía reautenticación al usuario local tras cambiar contraseña. Se
desactivó el subflujo de reinicio OTP y se configuró `force-login=true` en el
realm versionado. No se habilitaron correo, verificación ni recuperación sin
SMTP funcional. Cambiar el archivo no modifica el realm ya publicado.

Pasaron cuatro comprobaciones, incluida importación y consulta del flujo activo
en Keycloak 26.8.0 con PostgreSQL aislado en memoria, puerto local 38082 y
secretos de prueba separados. No se realizaron envíos, altas reales, acceso SSH
ni cambios en el servidor. Las pruebas no acreditan el recorrido real de correo,
contraseña y OTP en navegador.

Se solicitaron personas/correos de administración técnica y operación, y
confirmación del proveedor y remitente SMTP por canal seguro. Falta respuesta.
Se preparó el [procedimiento para Gabriel](preparar-ambiente-compartido.md#correo-y-cuentas-personales),
incluidos prueba de recuperación con OTP conservado, roles separados y retiro
de `arranque` sólo después de comprobar accesos personales y recuperación.

## 18 de octubre de 2026 — Tarea 1: definición técnica pendiente con Gabriel

Alexis se identifica como el interlocutor de esta sesión e indica que las
preguntas sobre la clave privada del respaldo y la continuación técnica deben
dirigirse al desarrollador **Gabriel**, quien realiza las conexiones SSH con el
servidor. No se interpreta esta indicación como designación automática de Gabriel
como custodio de la clave.

Pendiente consultar con Gabriel:

- Quién custodiará la clave privada y dónde conservará su segunda copia separada.
- Qué servidor recibirá los respaldos y cómo será la conexión y transferencia,
  incluida la VPN si se utiliza.
- Cómo instalar y comprobar la automatización mediante su acceso autorizado.

Se mantienen la política aprobada por Alexis y la atención de fallos por el
equipo de fastSolution. La tarea 1 sigue en curso; la generación de claves de
operación y la configuración remota esperan estas definiciones. No se realizó
contacto externo ni se accedió al servidor en esta actualización.

## 18 de octubre de 2026 — Tarea 1: acceso y política de respaldo confirmados

Por indicación del responsable del proyecto:

- El acceso SSH al servidor de Zenit se realiza únicamente por el usuario
  **Gabriel** del proyecto. Las intervenciones remotas de esta tarea deben
  coordinarse con Gabriel; no se habilitan ni se suponen accesos adicionales.
- El destino de los respaldos será **otro servidor**, probablemente conectado
  mediante otra VPN. Faltan identificar ese servidor, su almacenamiento,
  conectividad y mecanismo de transferencia; la VPN no define el destino por sí sola.
- Política aprobada: **copia diaria**, **30 días de retención**, objetivo de
  pérdida máxima de **24 horas** y objetivo de recuperación de **4 horas**.
  Son objetivos aceptados, aún pendientes de automatización y comprobación.
- El **equipo de fastSolution** atiende los fallos de respaldo y recuperación.

La custodia de la clave privada age y su segunda copia siguen pendientes de
definición. Se aclaró su función: descifrar respaldos, independiente de licencias,
cuentas de clientes, claves SSH y claves de desarrollo. No se generó una clave
de operación ni se programaron transferencias sin el destino definido.

## 18 de octubre de 2026 — Tarea 1: recuperación local de bases y servicios

**Estado: en curso; copia externa y decisiones operativas pendientes.** Se
reutilizó `rehearse.sh` para agregar `BACKUP_MODE=recover`: conserva sólo una
instancia verificada en un destino vacío, con contraseñas nuevas de base de
datos y un marcador de éxito que exige la configuración separada de recuperación.
El backup y la restauración de ensayo conservan sus modos anteriores.

La autoprueba pasó con recuperación persistente, contraseña nueva y rechazo
de la anterior, rol interno sin acceso, destino ocupado, filas eliminadas,
contenido alterado, ciphertext alterado y clave equivocada. PostgreSQL exige
conservar SUPERUSER en su rol bootstrap; `restaura` queda NOLOGIN sin contraseña.

El recorrido de servicio pasó con las bases ficticias locales, con el origen
apagado durante restauración y comprobación: 130 tablas y 1.867 filas idénticas,
siete migraciones, backend UP, emisor de recuperación y autenticación de la
cuenta Keycloak restaurada. Duró 66 segundos en local, incluida construcción
con caché; no representa el tiempo de recuperación del ambiente público.
El proyecto `recovery-check-20261018134300` quedó detenido y su volumen separado
se conserva para revisión. Se eliminó la clave age de ensayo. El origen local
quedó detenido como al comenzar y no se tocó el servidor publicado.

Se solicitaron destino externo/acceso SSH, custodio y segunda copia de la clave,
frecuencia, retención, objetivos y responsable de fallos. Sin respuesta todavía;
no se genera clave de operación ni se activa una programación. Instrucciones,
evidencia y pasos pendientes en [Recuperación del servicio](recuperacion-servicio.md).

## 18 de octubre de 2026 — Revisión y prioridad de pendientes

Se declaró [Tareas críticas primero](tareas-criticas-primero.md), con los bloqueos
para datos reales, dependencias y criterios de cierre. Se conservan los números
originales de pendientes para poder darles seguimiento.

Comprobado hoy: 128 pruebas del portal tanto en el árbol local como en la imagen
existente, compilación TypeScript/Vite y HTTP 200 del portal público, estado del
API y descubrimiento de identidad. El entorno local no tenía servicios activos.

La revisión encontró una discrepancia entre registros locales de enrolamiento
Android y el runner versionado, la URL Android con `/api` en la guía, la cuota
de activación usando la dirección del proxy y la retención móvil sin purga.
Se declararon como pendientes; no se modificó la aplicación ni el servidor.
No se repitieron backend, Android, respaldo, vulnerabilidades ni sesión real.

## 18 de octubre de 2026 — Publicación en el servidor compartido

**Estado: Zenit publicado con datos ficticios; la landing espera su
credencial de correo.** Zenit corre en <https://zenit.fastsolution.com.mx>
sobre el commit `2c24cde`, con la configuración de servidor de
`deploy/servidor/`. Un borde propio de fastSolution termina TLS con
certificados de Let's Encrypt que emite y renueva lego; el borde del
anfitrión sólo enruta por nombre, sin descifrar. Los secretos se generaron en
el servidor y no salen de él.

Comprobado por la dirección pública: portal, estado del backend y página de
acceso de la identidad; emisor público correcto aunque se falsifiquen
cabeceras; `404` para la administración, `master` y la salud de la
identidad; `421` para un `Host` ajeno; puertos internos cerrados; consola de
identidad por túnel. Detalle en [Despliegue en el servidor](despliegue-en-servidor.md).

No comprobado: ninguna sesión real (no hay cuentas de personas), correo,
respaldo operativo, ni una renovación real de certificado. La landing quedó
construida; su `Dockerfile` se corrigió para dejar su imagen sin
vulnerabilidades altas y arranca cuando exista su credencial.

## 17 de octubre de 2026 — Declaración de pendientes

Se consolidaron en [Estado y pendientes](estado-y-pendientes.md#lista-consolidada-de-tareas-pendientes)
las tareas 2 y 4 aún abiertas y las tareas 7 a 20 sin abordar, conservando
la numeración y el orden de complejidad originales. Se registraron sus
dependencias y los límites de las tareas 5 y 6 completadas. No se aprobaron
reglas de negocio, no se ejecutaron funciones nuevas ni se publicó el sistema.

## 17 de octubre de 2026 — Ejecución de tareas 1 a 6

**Estado: avance comprobado; decisiones y recorrido manual abiertos.**
Docker Desktop se inició y el entorno local se reconstruyó sin borrar volúmenes.
El API respondió `UP` en el puerto local 18080 y el portal HTTP 200 en 8081.

- Documentación unificada: alcance actual del portal, presentación móvil,
  verificaciones de respaldos y URL de identidad. Se retiró la indicación
  desactualizada de que el portal no iniciaba sesión y el desarrollo fuera de Docker.
- Backend: construcción con pruebas unitarias y 73 pruebas de integración correctas.
  Contrato válido. Búsqueda de secretos del historial sin hallazgos tras una
  excepción exacta, por valor y archivo, para un UUID ficticio de una prueba.
- Portal: 128 pruebas correctas con dos procesos. El primer intento por omisión
  tuvo 8 fallos de espera/sincronización; `pnpm test` ahora usa ese límite.
- Android: construcción Docker correcta con 9 pruebas unitarias, lint y APK
  debug. No se repitieron release ni instrumentación en el teléfono.
- Identidad configurable: imágenes local y HTTPS ficticia construidas; cliente,
  nginx y CSP coinciden; HTTP 200 comprobado. No se publicó ni verificó TLS real.
- Respaldos: autoprueba aislada correcta, incluidos casos de alteración y clave
  incorrecta. Ensayo local correcto: 130 tablas/1.772 filas con contenido idéntico.
  No se generaron claves de operación ni se guardó una copia cifrada persistente.
- Decisiones de negocio: [propuestas preparadas](decisiones-de-negocio.md),
  pendientes de respuesta; no se modificaron reglas ni permisos.
- Horarios/importación: [guion preparado](validacion-tareas-1-a-6.md#guion-pendiente-con-sesión-real).
  Computer Use detuvo el control de Chrome al no poder determinar la URL activa
  con suficiente certeza. La prueba con sesión real sigue pendiente.

La [validación detallada](validacion-tareas-1-a-6.md) conserva comandos,
resultados y el estado final de Android.

## 14 de octubre de 2026 — Jornada, acuse y respaldos

**Estado: avance parcial; tareas abiertas.** El usuario pidió registrar lo
pendiente y continuar con la siguiente tarea crítica. No se consideran
completadas ni se cambia su prioridad.

### Revisión jurídica de jornada y acuse

Entregado: [revisión documental](revision-juridica-jornada-acuse.md) contra
fuentes oficiales del DOF y la LFT. Se confirmó el calendario de topes y se
identificaron diferencias entre las disposiciones y el cálculo implementado.
No se cambió el algoritmo, el contrato ni la evidencia de cierres existentes.

Falta para cerrar:

1. Dictamen de un profesional laboral sobre jornada y valor del acuse,
   considerando contratos y régimen aplicable al cliente.
2. Aprobar criterios y resultados esperados de jornada diurna, nocturna y
   mixta; tiempo extraordinario diario y semanal; descansos computables;
   distribución de horas; cruces de medianoche, semana y año; periodos
   anteriores a la reforma y ausencias.
3. Implementar esos criterios con pruebas y conservar las reglas y los
   cierres históricos. Las alertas actuales no acreditan conformidad laboral.
4. Definir el documento presentado al trabajador, su identidad, acuerdo del
   empleador, versión del texto, copia reproducible y atención de objeciones.
   La huella del servidor no equivale por sí sola a firma avanzada ni prueba
   plena de acuerdo.
5. Revisar las disposiciones generales de registro electrónico antes de
   publicar y de enero de 2027; aprobar la retención documental.

### Respaldos cifrados y restauración nueva

Entregado: modos `backup` y `backup-restore`, cifrado age, verificación de
conteos y contenido, autoprueba aislada y [guía](respaldos-cifrados.md).
No se generó todavía una clave de operación ni se guardó una copia comprobada.

Falta para cerrar:

1. Iniciar Docker Desktop. El intento desde este entorno falló por acceso
   denegado a los registros de Docker; el motor sigue detenido.
2. Construir las herramientas y ejecutar la autoprueba: restauración sin
   origen y rechazo de filas eliminadas, contenido distinto, paquete alterado
   y clave incorrecta. Repetir el ensayo existente, que también fue modificado.
3. Generar y custodiar las claves; guardar una copia cifrada de las bases
   locales y restaurarla en el contenedor aislado. Repetir con escrituras
   simultáneas y registrar el resultado.
4. Analizar vulnerabilidades de la imagen nueva que incluye age y comprobar
   el procedimiento en el sistema operativo del servidor elegido.
5. Recuperar un ambiente completo con secretos nuevos, permisos revisados,
   migraciones correctas, backend saludable y acceso a Keycloak. La prueba
   preparada sólo verifica las bases, no la recuperación de los servicios.
6. Definir destino fuera de la máquina, periodicidad, retención, responsable,
   custodia separada de claves y objetivos de recuperación. Probar la carga
   prevista; adaptar la verificación por lotes si supera el límite documentado.

Comprobado: `docker compose --profile ops config --quiet` y
`git diff --check`, sin errores. No ejecutados: construcción, autoprueba,
restauración, análisis de vulnerabilidades ni pruebas funcionales.

Actualización del 14 de octubre de 2026: la imagen se construyó y la parte de
autoprueba del punto 2 terminó correctamente. Restauró dos bases ficticias sin
el origen disponible y rechazó filas eliminadas, contenido distinto con el
mismo conteo, un paquete alterado y otra clave privada. Los paquetes ocuparon
2,333 y 2,345 bytes. Sigue pendiente repetir el ensayo existente y recorrer las
bases locales.

También se completó la parte de análisis del punto 4. El primer inventario
encontró 2 críticas y 10 altas en age; por decisión del usuario se corrigió la
imagen en vez de aceptar el riesgo. age 1.3.2 y age-keygen se recompilaron con
Go 1.27.2 y `x/crypto` 0.56.0. El segundo análisis terminó sin error, con 0
críticas, 0 altas, 4 medias y 1 de gravedad desconocida; esta última sólo
afecta a `openpgp`, ausente del grafo de importación de los ejecutables. No se
generaron claves de operación ni respaldos locales. Siguen abiertos el ensayo
existente del punto 2, los puntos 3, 5 y 6, y la comprobación del procedimiento
en el sistema operativo que se elija para el servidor.

Actualización del 14 de octubre de 2026, con el entorno local levantado desde
un volumen nuevo: el ensayo existente respaldó y restauró la base del producto
y la de identidad y comparó 125 tablas y 215 filas con contenido idéntico, en
2 segundos. Queda cerrado el punto 2. Los puntos 3, 5 y 6 esperan decidir
custodio de la clave privada y de su copia aislada, destino fuera de la
máquina, frecuencia, retención, quién atiende un fallo y objetivos de
recuperación; sin eso no se genera una clave de operación. La comprobación en
el sistema operativo del servidor espera que exista el servidor.

### Siguiente tarea

Preparar el ambiente compartido con TLS, correo verificado, recuperación de
contraseña y cuentas personales de administración. Pendientes de confirmar:
servidor/proveedor, dominios del portal e identidad y servicio SMTP. No se
ha autorizado ni realizado una publicación.

## 14 de octubre de 2026 — Preparación del ambiente compartido

**Estado: en curso; depende de infraestructura y Docker.** Se encontró que
la imagen del portal usaba la identidad local y su CSP sólo permitía ese
origen. Ahora Compose pasa `IDENTITY_URL` a la construcción del cliente y a
la generación de CSP; ambos usan el mismo valor que backend y Keycloak.

Comprobado: resolución de Compose con dirección local y con dominio ficticio
HTTPS, y `git diff --check`. No comprobado: construcción del portal, nginx
en ejecución ni recorrido de acceso por HTTPS. Docker sigue detenido.

Se preparó [el procedimiento del ambiente compartido](preparar-ambiente-compartido.md).
Faltan servidor y dominios, emisión y renovación de certificados, SMTP,
configuración del realm activo, prueba de verificación y recuperación,
cuentas personales con OTP y retiro de la cuenta temporal tras comprobar
el acceso. No se habilitaron cambios de identidad sin SMTP ni se publicó.

Actualización del 14 de octubre de 2026: la imagen del portal se construyó con
la dirección de identidad local y con una ficticia HTTPS. En los dos casos la
CSP de nginx y el cliente contienen la misma dirección, y la otra no aparece
en el código servido. La imagen quedó restaurada con la dirección local.
Siguen sin comprobarse nginx en ejecución y el recorrido de acceso por HTTPS.

Actualización del 14 de octubre de 2026: con el entorno local completo, nginx
respondió `200` en la raíz con la CSP y las cabeceras esperadas, y su proxy
devolvió el estado del backend. Sigue sin comprobarse el recorrido de acceso
por HTTPS: espera servidor, dominios y certificados.
