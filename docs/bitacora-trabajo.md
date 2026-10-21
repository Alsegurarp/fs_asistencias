# Bitácora de trabajo

Las entradas están ordenadas por fecha y describen el resultado de cada
sesión. Expresiones como «sin teléfono», «pendiente» o «en ejecución» dentro
de una entrada antigua no sustituyen el [estado vigente](estado-y-pendientes.md)
ni los avances posteriores. Se preservan los commits, conteos y límites
originales para no atribuir pruebas de una versión a otra.

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
El push de esta corrección debe comprobarse en una nueva ejecución de Actions;
repetir la ejecución antigua conserva el Dockerfile vulnerable de aquel commit.

Confirmación posterior: la corrección se publicó en `main`/`f72941e` y los
cuatro trabajos aprobaron en la
[ejecución 39636653675](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39636653675):
backend, portal, Android y contrato/seguridad, incluido el análisis de las
cinco imágenes. Queda corregido el fallo de CI; el servidor público conserva
su despliegue pendiente. Esta actualización documental no cambia las imágenes.

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
