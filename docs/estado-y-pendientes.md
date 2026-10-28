# Estado y pendientes

Qué está hecho, qué falta y qué no se ha verificado. Se actualiza cuando
cambia alguna de las tres cosas.

**Entrega posterior del 28 de octubre — E4/E5 y E6 técnica.** La rama
`feat/expediente-e4-e6-qa` incorpora E4/E5 desde la PR #21, integrada en E2/E3
después de que #20 llegara a main. API 0.15.0, 70 operaciones, desafío OIDC
con MFA nuevo, autorización/descarga de un uso y portal. [E6](entrega-expediente-e6.md)
añade verificación y consulta independientes sin red; su aceptación integral
conserva Q07/Q14. Backend: 67 unitarias/88 integraciones aprobadas; portal:
189; identidad real: ocho sin omisiones; Android: 13 unitarias, lint y APK.
Docker se restableció y la [QA técnica local en Samsung](qa-android-2026-10-28.md)
aprobó con almacén separado: captura personal/terminal, sincronización,
objeción, recuperación, reapertura/conformidad y 403 para terminal. El acta
declara los límites visuales/públicos. Publicación en bitácora. Sin despliegue público ni purga;
se mantienen 17 tareas globales y seis P0. Los cortes siguientes son históricos.

**Estado verificado al 28 de octubre de 2026.** `main` local y GitHub
coinciden en `fa2396d`; la [PR #20](https://github.com/Alsegurarp/fs_asistencias/pull/20)
ya está integrada. E1–E3 entregadas técnicamente: API 0.14.0, 67 operaciones,
permiso explícito y preparación del expediente con V009. Los cuatro trabajos
del [CI de main](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40554372464)
aprobaron. Recuento de resultados locales conservados: 60 unitarias y 83
integraciones, sin fallos/errores/omisiones; no se ejecutaron otra vez.
**Siguiente desarrollo: E4 → E5; E6 puede iniciar verificación del formato**
con los ejemplos existentes y mantiene su aceptación/decisiones pendientes.
La descarga sigue cerrada; no se acredita despliegue de E2/E3.

Docker Desktop no ofrece actualmente la tubería del motor; no se comprobaron
servicios, teléfono ni servidor público. Los cambios previos de `backend/bin/`
se preservan. Continúan 17 tareas globales abiertas y seis P0. Consultar la
[bitácora de este corte](bitacora-trabajo.md#28-de-octubre-de-2026--avance-verificado-y-pendientes-priorizados)
y el [trabajo priorizado con dependencias y criterios](TareasPendientes.md#trabajo-priorizado-con-el-contexto-del-28-de-octubre).
Los cortes siguientes son históricos y no sustituyen este estado.


**Estado local vigente del 27 de octubre: E2–E5 implementadas y probadas.**
[E4/E5](entrega-expediente-e4-e5.md) completan MFA nuevo, autorización de un
uso y portal; API 0.15.0, formato 1. Aprobaron 64 unitarias, 88 integraciones,
189 pruebas web, 11 de identidad real y la historia en Chrome con ZIP íntegro.
Ambos contratos y modelos PlantUML V010 comprobados. E6, Q07/Q14 y aceptación
siguen pendientes; no hay despliegue público de esta entrega.
[PR #21](https://github.com/Alsegurarp/fs_asistencias/pull/21) abierta sobre
la rama de #20; CI remoto en curso al publicar. Ambas siguen sin integrar.

**Corte anterior del 27 de octubre: E2/E3 implementadas y probadas.**
[Acta y pruebas](entrega-expediente-e2-e3.md): permiso explícito/aislamiento y
preparación íntegra por bloques, API 0.14.0, 60 unitarias y 83 integraciones
aprobadas sin omisiones, perfiles anuales 50/300 y ambos contratos válidos.
[Modelo jerárquico PlantUML](dbFlow/01-jerarquia.puml) y
[relaciones](dbFlow/02-relaciones.puml) incorporan V009. E4/E5/E6 siguen
pendientes; la descarga continúa cerrada. El modelo de relaciones se corrigió
para Plan UML/PlantUML 1.2025.10 y se verificó también con 1.2026.8.
[PR #20](https://github.com/Alsegurarp/fs_asistencias/pull/20) abierta y sin
integrar; [CI en curso](https://github.com/Alsegurarp/fs_asistencias/pull/20/checks)
al publicar. No hay despliegue de esta entrega. Los cortes siguientes conservan
su evidencia histórica.

**Revisión anterior del 27 de octubre, previa a E2/E3.** La
[verificación de E2–E5](verificacion-e2-e5-2026-10-27.md) confirma E1 integrada
en `main/f4104e1` mediante PR #19, con los cuatro trabajos de CI de la PR
aprobados. E2–E5 siguen sin implementar; orden: **E2 → E3/E4 → E5**.
Docker responde, sin servicios del proyecto activos. Se preservaron los
cambios previos de `backend/bin/`; no se ejecutaron nuevas pruebas locales.
La issue #18 sigue abierta, con su lista sin actualizar. Los cortes siguientes
son históricos; E6 y los bloqueos globales conservan su alcance.

**Corte anterior: 26 de octubre de 2026.** El
[listado para desarrollo](tareas-desarrollo-2026-10-26.md) contrasta código y
GitHub: PR #15/#16 integradas, CI de main/5d7b783 aprobado en sus cuatro
trabajos y la issue #18 abierta. E1 entrega el
[contrato/formato candidato](contrato-expediente-e1.md) con ocho pruebas nuevas
aprobadas; E2 es el siguiente desarrollo. E3–E5 tienen dependencias internas
y E6 conserva Q07/Q14/aceptación.
Mejoras Android del 26 integradas, con QA visual de esa interfaz pendiente.
Docker disponible para E1; servidor/teléfono no verificados. Se conservan
17 tareas globales abiertas y seis P0; los cortes siguientes son históricos.

E1 publicada en `b5aff1f`, [PR #19 abierta](https://github.com/Alsegurarp/fs_asistencias/pull/19),
sin integrar. Las 56 unitarias, 75 integraciones, lint y análisis de secretos
locales aprobaron; CI remoto sigue en curso al corte del 26 a las 23:15 de
Ciudad de México. La [bitácora](bitacora-trabajo.md#tarea-realizada-y-trabajo-restante)
declara E1 realizada y E2–E6 pendientes, con dependencias y límites.

Actualización del **23 de octubre de 2026**, posterior al criterio legal:
el usuario aprueba [expediente aislado por empresa y MFA por descarga](expediente-empresa.md).
Permiso específico y autorización nueva de un solo uso; el permiso amplio de
los CSV semanales no se extiende al expediente. La suite aislada de Keycloak
aprobó 10/10 sin omisiones, incluida la nueva prueba MFA; paso de CI preparado
localmente, sin publicar/ejecutar en remoto. El permiso, API, archivo íntegro y recuperación
fuera del servicio siguen pendientes. No se fija plazo de purga Android ni se
cierran Q03/Q04 o Q10–Q13. La distribución actual es Keycloak comunitario
26.8.1 sobre UBI; Red Hat build of Keycloak no está instalado.

Implementación declarada en [E1–E6](expediente-empresa.md#tareas-declaradas-para-implementación):
contrato, permiso específico, preparación, autorización con MFA, portal y
recuperación independiente. Pendientes, con sus dependencias y aceptación;
la prueba aislada no habilita descargas empresariales.

Corte anterior del **23 de octubre de 2026**: respaldo concurrente validado
localmente y en CI, con los cuatro trabajos aprobados para `ffa8306` en la
[PR #15 en borrador](https://github.com/Alsegurarp/fs_asistencias/pull/15);
integración en `main` pendiente. El usuario fija la legislación mexicana
como base de las tareas de sesión 3/5 y criterio rector del desarrollo.
[Conservación, recuperación y terceros](revision-juridica-jornada-acuse.md#recuperación-por-el-empleador-y-servicios-de-terceros)
documentados; faltan archivo recuperable por empresa, disponibilidad local y
opciones operativas no determinadas por la ley. Q03/Q04 de identidad siguen
pendientes. No se purga, habilita correo ni declara cumplimiento integral.

Avance anterior del **23 de octubre de 2026**, tareas de sesión 1–5:
el autoensayo concurrente de respaldo **aprobó localmente**, con restauración
sin origen, contraseñas nuevas y rechazos de alteraciones. Se corrigió el
montaje `noexec` del auxiliar de prueba y se preparó su ejecución en CI.
[Evidencia y límites](bitacora-trabajo.md#23-de-octubre-de-2026--respaldo-concurrente-validado-y-preparación-de-ci).
Retención Android, recuperación/SMTP y reglas de negocio esperan las
elecciones concretas Q14, Q03/Q04 y Q10–Q13, solicitadas al usuario.
Permanecen 17 tareas globales abiertas y seis P0; no hubo despliegue público.

Revisión anterior de contexto del **23 de octubre de 2026**: `HEAD` y la referencia
local `origin/main` siguen en `0723baf`; no se volvió a consultar el remoto.
Hay cambios locales sin commit en el autoensayo de respaldo concurrente y
su paso de CI. El registro disponible sólo muestra acceso denegado a Docker:
esa ampliación **no está validada**. Se preservan también los cambios de
`backend/bin/`. El avance integrado, las decisiones aprobadas y las
dependencias se consolidan en la [bitácora](bitacora-trabajo.md) y las
[tareas posibles](tareas-criticas-primero.md#tareas-posibles-desde-el-corte-del-23-de-octubre).
No cambia el conteo de 17 tareas abiertas ni los seis P0.

Sincronización anterior del **23 de octubre de 2026**: `git pull origin` avanzó
`main` de `579270f` a `0723baf`, igual que `origin/main`, sin conflictos.
Quedan integradas las PR #13 y #14. Se conservaron los cambios locales
previos de `backend/bin/`; no son una entrega nueva. Se revisaron historial,
actas y prioridades sin repetir pruebas ni comprobar servicios o CI remoto.
Se mantienen 17 tareas abiertas total o parcialmente y seis P0; el servidor
público sigue diferido por indicación del usuario.

Actualización local del **22 de octubre de 2026**, desde `main`/`ad21177`:
[17/17 casos de horarios/importación en navegador, línea base de carga de
50/300 empleados y revisión de imágenes](qa-local-2026-10-22.md).
[Retención Android analizada](retencion-android.md), sin fijar plazo ni purga.
La comprobación del servidor público queda diferida por indicación del usuario.
Corrección posterior del CI de la PR #14: [Keycloak 26.8.1 con Java corregido,
cinco imágenes sin críticas/altas y nueve pruebas de identidad](seguridad-keycloak-2026-10-22.md).
Se retiran las seis excepciones antiguas de pcre2; quedan hallazgos menores
y desconocidos documentados. No acredita despliegue ni aceptación pública.
Se mantienen 17 tareas globales abiertas total o parcialmente y seis P0;
los conteos y versiones siguientes conservan su fecha de comprobación.

El avance y lo que falta para cerrar las tareas críticas de jornada, acuse y
respaldo se detallan en la [Bitácora de trabajo](bitacora-trabajo.md).

El 21 de octubre aprobaron los [33 casos A5 locales](qa-a1-a5-2026-10-21.md),
con sesiones reales, OTP, renovación/salida, acuse, configuración y bloqueos.
Se corrigieron los permisos temporales que impedían servir recursos de
Keycloak y se amplió la instrumentación Android para rechazar un acuse ajeno.
La aceptación del usuario y del ambiente público conserva sus requisitos.

Corte documental anterior: 21 de octubre de 2026, sobre `main`/`907a93a`.
Actualización sobre `4852c66`: [semana/acuse Android visual contra backend
real local aprobados](qa-android-semana-acuse-2026-10-21.md). Servicios
locales levantados, ocho migraciones exitosas y teléfono restaurado al
terminar. La aceptación pública y del usuario conserva sus requisitos.
A1–A5 integradas en `main`/`e4d7683`
mediante la [PR #10](https://github.com/Alsegurarp/fs_asistencias/pull/10),
con sus cuatro trabajos de [CI aprobados](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39504126988).
[Resultado actual](entregas-a1-a5.md): contrato 0.13, reactivación, consulta
personal, recuperación de acuses y cambio obligatorio de contraseña. El
[guion QA](qa-a1-a5.md) conserva sus criterios de repetición y el acta local;
la aceptación del usuario y pública sigue pendiente.
La [verificación local](verificacion-local-2026-10-20.md) repitió backend,
portal, Android, identidad, contrato, seguridad y restauración; ese corte
terminó con el ambiente en ejecución y V008 aplicada. Al comenzar la revisión
del 21, Docker estaba detenido; no se debe inferir disponibilidad actual de
una bitácora anterior. Incluye semana/acuse y herramientas
MF1K Android. El despliegue público y la aceptación con sesión real siguen abiertos.
La [validación de tareas 1 a 6](validacion-tareas-1-a-6.md)
separa resultados comprobados de decisiones y pruebas manuales pendientes.

## Modelo de alojamiento aprobado

Gabriel, Roberto Arregui y Alex Segura aprobaron el 19 de octubre de 2026 que
Zenit opere como SaaS administrado por fastSolution: producción exclusiva del
producto, separada de pruebas, y empresas aisladas lógicamente en el backend y
PostgreSQL. No hay VPS, base ni bucket por cliente por defecto. La modalidad
dedicada se cotiza como Enterprise o se activa por contrato, sector,
residencia, volumen o riesgo.

El servidor compartido publicado sigue sólo con datos ficticios. Antes del
primer dato real faltan proveedor, región y cuenta bajo control de
fastSolution, documentos de privacidad y tratamiento, subprocesadores,
respaldo externo, custodia, restauración y revisión jurídica. La aprobación de
la topología no equivale a autorización de producción.

La revisión actual y el orden de ejecución están en
[Tareas críticas primero](tareas-criticas-primero.md): incluye comprobaciones
del 18, declaración del 19, bloqueos para datos reales y tareas técnicas que pueden iniciarse.

## Qué está hecho

| Pieza | Estado |
| --- | --- |
| Contrato | Versión 0.13, con 62 operaciones. Acuse semanal desde servidor y cambio obligatorio de contraseña; todavía sin congelar |
| Backend | Atiende 62 operaciones; construcción, unitarias y 75 integraciones PostgreSQL aprobadas para A1–A4. Aislamiento, cuenta activa/vinculada y fallos del proveedor comprobados |
| Base | 29 tablas en 8 migraciones, con roles separados para migrar, para atender y para respaldar. V008 conserva bloqueos por persona/corrida. Imagen propia sobre Alpine, sin root ni privilegios, que ordena los textos por código de carácter |
| Identidad | OTP obligatorio; 7 comprobaciones aisladas aprobadas, incluida conservación de credencial OTP y otras acciones al exigir UPDATE_PASSWORD. Cliente técnico preparado sólo en local; SMTP, recuperación y aceptación pública pendientes |
| Entorno local | Levantado de nuevo el 21 conservando volúmenes: backend en 18080, portal en 8081 e identidad en 8082. V008 aplicada; A5 local comprobado. Corregidos permisos tmpfs de identidad; tarjetas simuladas sólo para datos ficticios |
| Simulador de dispositivo | Llena una empresa con personas, dispositivos y marcajes firmados, sin la app |
| Respaldo | El 20, tras V008, el ensayo restauró 131 tablas/1,970 filas idénticas. La recuperación completa con origen apagado y secretos nuevos sigue siendo la del 18: 130 tablas/1.867 filas. [Detalle](recuperacion-servicio.md). Copia externa, custodia, programación y recuperación pública pendientes |
| Vulnerabilidades | El 22 aprobaron localmente las cinco imágenes con 0 críticas/altas y 0 aceptaciones; Keycloak 26.8.1 usa Java 25.0.5.0.2 y UBI mínima actualizada. Se retiran seis excepciones de identidad. Persisten medias/bajas/desconocidas según el [acta](seguridad-keycloak-2026-10-22.md). Portal y herramienta conservan su revisión previa: musl actualizado y curl 8.23.0 sin libssh2. Despliegue/comprobación del servidor pendiente |
| Portal | Catálogos y operación existentes, más reactivación de empresas, Mi asistencia y cambio obligatorio. 162 pruebas y compilación aprobadas el 21; 33 casos A5 locales comprobados. Aceptación del usuario y despliegue/recorrido público pendientes |
| App Android | Captura/cola/sincronización existentes. A3 recupera acuse del servidor y descarta vigencia al reabrir. 13 unitarias, lint e instrumentación FIXTURE aprobados. Recorrido visual de semana/acuse contra backend real local aprobado el 21 en Samsung API 36, con objeción, recuperación y conformidad. Falta aceptación pública/del usuario, expediente y tarjeta física; captura local/HTTPS del 19 conserva su evidencia |
| Conector | No existe |

Lo que el backend ya hace, de punta a punta:

1. Alta de empresas, invitación de personas, roles y bitácora; suspender y
   reactivar una empresa, y soltar la liga de una cuenta perdida, también
   la de quien administra cuando nadie más de su empresa puede.
2. Sedes con geocerca, horarios, padrón, importación por archivo y tarjetas.
3. Enrolamiento de dispositivos y captura de marcajes, con tarjeta simulada.
4. Jornada semanal calculada, incidencias con ajustes, cierre y acuse; cierre
   de toda la empresa como trabajo, y cierre programado.
5. Exportes preparados por un trabajo, con su manifiesto, y fuentes del
   padrón.
6. Cuota de peticiones por persona.

Todo se ha probado con datos ficticios. Nada se ha probado con datos reales.
Desde el 18 de octubre de 2026 hay un ambiente publicado, sólo con datos
ficticios: [Despliegue en el servidor](despliegue-en-servidor.md). El 19 se usó
una cuenta de administración de prueba para validar Android por HTTPS.

## Qué falta para tener el producto

| Qué | Por qué importa |
| --- | --- |
| Completar el portal | Reactivación, consulta personal, cambio obligatorio y A5 local comprobados el 21; horarios/importación en navegador local aprobados el 22. Faltan aceptación del usuario y pública, suspensión y expediente completo según decisiones pendientes |
| Completar y validar la app | Enrolamiento y sincronización comprobados contra backend local y HTTPS publicado con datos ficticios. Semana y acuse con recibo cifrado aprobados visualmente contra backend real local el 21; [alcance y validación](revision-movil-empleado.md). Faltan aceptación pública/del usuario, historial completo desde backend y captura autenticada con tarjetas reales |
| Verificar la tarjeta real | Hoy sólo se acepta la simulada, que no está autenticada. Depende de probar con tarjetas y teléfonos |
| Revisión jurídica | Revisión documental del DOF y LFT realizada el 14 de octubre de 2026; calendario confirmado y brechas identificadas. Faltan dictamen profesional y cambios al cálculo y al acuse. Una búsqueda del 16 de octubre de 2026 en fuentes oficiales no encontró publicadas las disposiciones de la STPS sobre el registro electrónico, que rigen desde enero de 2027; la propia STPS las sigue anunciando en futuro |
| Un ambiente publicado | Desde el 18 de octubre de 2026 Zenit está en <https://zenit.fastsolution.com.mx>, con certificados propios y sólo datos ficticios ([Despliegue en el servidor](despliegue-en-servidor.md)). El 19 pasaron Android y operaciones de administración por HTTPS usando una cuenta de prueba. Siguen SMTP, comprobar todas las cuentas personales, quién opera el servicio, respaldo externo y el recorrido completo del portal |

## Pendientes del backend

### Se pueden hacer ya

| Pendiente | Qué es |
| --- | --- |
| Clases de jOOQ generadas | Hoy las consultas son SQL en texto. Cambia cada consulta y no cambia ningún comportamiento. Se decidió dejarlo para después y hacerlo solo, sin mezclarlo con otra cosa |

El detalle de quién quedó sin cerrar ya está implementado y probado en backend
y portal. Conserva causas e incidencias por corrida y pagina los resultados;
faltan despliegue público y aceptación del usuario; A5 local aprobó detalle
y paginación en navegador el 21. Los históricos anteriores
a V008 conservan sólo sus conteos.

### Esperan una decisión

Suspensión, baja, alcance del supervisor y tipo de marcaje tienen
[propuestas concretas para aprobación](decisiones-de-negocio.md). No se han
cambiado sus comportamientos ni se consideran decisiones cerradas.

| Pendiente | Qué hay que decidir |
| --- | --- |
| Suspensión de una empresa | Hoy también corta la captura de marcajes. Antes del primer cliente hay que decidir si una empresa suspendida conserva la captura, porque el registro de asistencia es obligación suya |
| Obligatoriedad de CI | El workflow por cambio ya está integrado. Los cuatro trabajos de las PR #10 y #11 aprobaron; sólo falta decidir protección de `main` y trabajos obligatorios (Q22) |
| Alcance del supervisor | Cómo se le asignan sus sedes. Hoy ve y atiende lo de toda su empresa |
| Baja de una persona | Si además revoca su tarjeta y cierra su horario |
| Comparar la jornada con el horario | Qué cuenta como retardo, falta y salida anticipada |
| Tipo de marcaje | Si la persona lo declara, el servidor lo deduce, o las dos cosas como hoy |
| Ausencias | Cómo tratar vacaciones e incapacidades, para no cerrar en ceros |
| Otra plantilla de exporte | Según lo que pida la nómina del primer cliente |
| Dónde vive el archivo de un exporte | Hoy en la base, unos minutos; la alternativa es un almacén de objetos |
| Versión 1.0 del contrato | Completar recorridos reales y decisiones de producto/operación; acordar compatibilidad con los consumidores del contrato 0.13 |

### Dependen de algo externo

| Pendiente | De qué depende |
| --- | --- |
| Tarjeta real y entrega de su clave al dispositivo | Prueba con tarjetas y teléfonos reales |
| Cálculo por tipo de jornada | Revisión jurídica |
| Conector para sincronizar el padrón | El sistema del primer cliente |
| Servicio de correo en la identidad | Faltan SMTP/remitente y recuperación de acceso olvidado. El cambio obligatorio al próximo login ya está implementado en A4 para cuentas activas vinculadas, con cliente técnico local; falta aceptación integral y provisión pública. No requiere correo para añadir el requisito ni recupera por sí solo una contraseña olvidada |
| Cuentas personales en la consola de identidad | Antes de cualquier ambiente compartido: hoy hay una cuenta temporal |
| Staging y TLS | Hecho el 18 de octubre de 2026: un ambiente publicado con HTTPS. Falta decidir si habrá un segundo ambiente separado para pruebas |
| Guardar y restaurar una copia cifrada de operación | Consultar con Gabriel quién custodia la clave privada y dónde queda su copia aislada, por indicación de Alexis. El 18 se comprobó una copia local con claves de ensayo, eliminadas al terminar; no sustituye una copia recuperable de operación |
| Destino externo y recuperación completa del servicio | SaaS bajo control de fastSolution con aislamiento lógico por empresa; respaldo externo cifrado de Zenit fuera del dominio de falla de producción. Perfiles de 50/300 empleados y un año consultable. Se conservan copia diaria/30 días y objetivos 24 h/4 h. Faltan destino, custodia, automatización y recuperación pública; SSH mediante Gabriel |
| Cuotas compartidas entre instancias | La dirección real del visitante ya llega al backend a través del borde y del portal, y el límite de activaciones fallidas cuenta a cada visitante por separado. Compartir las cuotas sólo hace falta con más de una instancia |

## Vulnerabilidades conocidas

Actualización del 21, posterior a `b2f7832`: Actions encontró tres críticas y
dos altas en el portal que no aparecían en el corte local previo. Se
actualizó la base a Nginx 1.30.6 por digest y se retiró curl/libcurl sin uso
en el portal. El análisis local web de las 16:31:18 UTC aprobó con 0 críticas,
0 altas, 3 medias y ninguna excepción. Arranque, cabeceras y proxy comprobados;
no se desplegó el servidor público. [Detalle](bitacora-trabajo.md#21-de-octubre-de-2026--corrección-del-análisis-de-seguridad-del-portal).
Los cuatro trabajos de CI del arreglo `f72941e`, incluidas las cinco imágenes,
aprobaron en la [ejecución 39636653675](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39636653675).

Antecedente del 20 de octubre de 2026, sobre las cinco imágenes
reconstruidas. Todas aprobaron; se conservan las seis excepciones de identidad.
Los IDs de las cuatro imágenes en ejecución coinciden con los analizados. Resultados en
`build/security/summary.json`; cómo repetir está en
[Verificaciones automáticas](verificaciones-automaticas.md). Falta identificar
y analizar las imágenes efectivamente publicadas, mediante Gabriel.

| Imagen | Al empezar | Corte del 20 de octubre | Altas y críticas en ese corte |
| --- | --- | --- | --- |
| Backend | 66, con 3 críticas y 18 altas | 15, todas medias | Ninguna |
| Portal | 7, con 2 altas | 4, todas medias | Ninguna |
| Base | 466, con 11 críticas y 118 altas | 4, todas medias | Ninguna |
| Herramientas de respaldo | 20, con 2 críticas y 10 altas | 6: 4 medias y 2 de gravedad desconocida | Ninguna alta o crítica |
| Proveedor de identidad | 64, con 6 altas | 65: 30 medias, 29 bajas y 6 altas exceptuadas | 6 altas, aceptadas por escrito |

Las cinco entradas del resumen local de aquel corte estaban aprobadas. Las correcciones todavía
no se han desplegado al servidor; su aceptación no queda cerrada por este ensayo.

Qué se corrigió:

- **Backend, bibliotecas.** Tomcat embebido tenía 3 críticas y Jackson 5 altas
  y 2 medias, todas con corrección publicada. Se adelantaron las dos
  versiones respecto de las que trae Spring Boot.
- **Backend y portal, paquetes del sistema.** Se subieron los que ya tenían
  corrección en el repositorio de la distribución y la imagen base todavía no
  traía. El 19 se actualizó `libexpat` a partir de 2.9.0-r0 en ambos, y
  `libx11` a partir de 1.8.14-r0 en el portal; pasaron los nuevos análisis.
- **Base.** Pasó de la imagen oficial sobre Debian a una propia, hecha de la
  oficial sobre Alpine (`infra/postgres`). Trae muchos menos paquetes; se
  subieron los dos que tenían corrección; y se retiró la herramienta con la
  que la imagen oficial baja de privilegios al arrancar, que concentraba 34
  de las graves y ya no hace falta, porque el contenedor arranca sin
  privilegios.
- **Herramientas de respaldo.** El paquete de Alpine incluía age compilado con
  Go 1.26.8 y `x/crypto` 0.55.0. Ahora sólo `age` y `age-keygen` se compilan en
  una etapa separada con Go 1.27.2 y `x/crypto` 0.56.0; la imagen final no trae
  el compilador. El hallazgo de gravedad desconocida afecta a `openpgp`, que no
  aparece en el grafo de importación de esos ejecutables.

Qué se aceptó, y por qué:

- **Proveedor de identidad, 6 altas.** Son tres defectos de la biblioteca de
  expresiones regulares del sistema base de esa imagen, que publica el
  proyecto del proveedor. No tienen corrección publicada y no hay una versión
  más nueva del proveedor que la traiga. Se aceptaron por escrito el 11 de
  octubre de 2026, en `.grype.yaml`, y se revisan al cambiar de versión del
  proveedor o, a más tardar, el 11 de enero de 2027.

Las variantes oficiales de la base, analizadas para comparar: sobre Debian 12,
466 hallazgos; sobre Debian 13, 368, con 6 críticas y 119 altas; sobre
Alpine sin tocar, 91, con 3 críticas y 40 altas.

Las medias no detienen el análisis. Se revisan al actualizar cada imagen
base. Un hallazgo dice que una versión tiene un defecto conocido, no que ese
defecto se pueda aprovechar aquí.

## Limitaciones conocidas

- **La tarjeta simulada no está autenticada.** Si se enciende con datos
  reales, quien conozca la huella de una tarjeta marca por su titular. Nace
  apagada.
- **La jornada es una referencia, no un dictamen.** No distingue jornada
  diurna, nocturna ni mixta; no se compara con el horario; atribuye el turno
  al día en que empieza.
- **La verificación del correo es manual.** Quien crea la cuenta marca el
  correo como verificado. Si lo marca sin comprobarlo, esa cuenta puede tomar
  una invitación ajena.
- **Soltar una liga confía en el correo.** Después de soltarla, la primera
  cuenta que entre con ese correo verificado queda ligada, sea la nueva o la
  anterior. La cuenta anterior hay que darla de baja en el proveedor de
  identidad.
- **La base ordena los textos por código de carácter.** Las mayúsculas van
  antes que las minúsculas, y las letras con acento y la eñe, al final. Hoy
  sólo se nota en el orden de las filas de un exporte, que va por
  identificador externo. Una lista que deba ir en orden alfabético del
  español tiene que pedirlo en su consulta, con `COLLATE "es-x-icu"`.
- **Invitar revela si un correo existe.** Un correo que ya pertenece a
  alguien responde un conflicto, sin decir en qué empresa.
- **Las cuotas viven en memoria.** Valen para una sola instancia del backend.
  Detrás del borde y del portal, el backend toma la dirección del visitante
  de `X-Forwarded-For` sólo si la petición viene de una dirección interna;
  el borde la sobrescribe, así que el visitante no la puede fijar. La cuota por
  persona se cuenta después de verificar la credencial: no protege a la
  verificación misma.
- **El cierre programado pasa una vez por semana.** Si esa vez la empresa
  estaba suspendida o el servicio estuvo detenido toda la semana, esa semana
  la cierra una persona.
- **El exporte sale del sistema.** Una vez descargado, el archivo queda fuera
  de control. La protección contra fórmulas en hojas de cálculo no es
  confiable después de guardar y reabrir el archivo.
- **Un marcaje rechazado por sesión vencida se pierde.** Pasadas 72 horas sin
  conexión, la app tiene que abrir otra sesión antes de seguir marcando.
- **No hay respaldo real todavía.** El procedimiento pasó su autoprueba y el
  ensayo con las bases locales, pero no se ha generado una clave de operación
  ni se guarda ninguna copia operativa; faltan custodia, destino concreto y
  automatización. Copia diaria y retención de 30 días ya están aprobadas.
- **No hay notificaciones.** Nadie recibe aviso de una incidencia, un cierre,
  una corrida terminada o un exporte listo: se consulta.
- **No hay totales en las listas.** Se recorren con cursor.

## Sin verificar

- El dictamen jurídico del cálculo y del acuse. La revisión documental
  identificó brechas en [Revisión jurídica](revision-juridica-jornada-acuse.md).
- El formato que pide un sistema de nómina real.
- El recorrido completo del portal público contra Keycloak y el backend real: el usuario
  comprobó acceso, catálogos, incidencias, cierres, descarga y usuarios. Horarios
  e importación aprobaron por API HTTPS el 19; faltan sus pantallas y el acta
  pública por rol del guion A5. La ejecución local de A1–A5 ya tiene acta del 21.
  La app se verificó contra backend local y HTTPS publicado en un Samsung
  SM-S928B (Android API 36), con datos ficticios. Los clientes generados del
  contrato sólo se compilaron.
- La app en un teléfono, con una tarjeta real.
- Carga: una corrida de cierre se probó con 511 personas y un exporte con
  unas decenas de filas, no con más.
- El recorrido completo del navegador detrás del proxy HTTPS: cookies,
  renovación y cierre de sesión. El 19 se usó un token de administración
  preparado por el usuario para el ensayo Android y operaciones API públicas;
  eso no acredita toda la sesión del portal.
- Los trabajos y las cuotas con más de una instancia del backend, fuera de
  las pruebas.
- Los guiones de secretos, de la base, del respaldo y del análisis de
  vulnerabilidades en una máquina con Linux: sólo se probaron con Docker
  sobre Windows.
- El ensayo de respaldo con una base que no quepa en memoria y la recuperación
  del ambiente público en otra máquina, con DNS, TLS y sus accesos. La recuperación
  de bases y servicios locales con secretos nuevos de base pasó el 18.
- Guardar fuera del servidor y restaurar un paquete age de operación: espera
  destino y custodia. El recorrido con las bases locales y claves de ensayo pasó
  el 18; esas claves se eliminaron y no son claves de operación.
- Empezar de cero un entorno que ya existía, en la máquina de otra persona:
  se comprobó que un volumen de la imagen anterior no arranca con la nueva y
  que un entorno nuevo sí, no el cambio en un entorno con uso.
- El ensayo de respaldo mientras el backend escribe, sobre la imagen actual
  de la base: se probó así con la anterior.
- El simulador con la política de descanso marcado, y con más de 8 personas.
- El formato de correo y las cabeceras, contra el contrato.

## Lista consolidada de tareas pendientes

Declaración al 17 de octubre de 2026. Se conserva la numeración de la evaluación
original y el orden de menor a mayor complejidad; este orden no sustituye la
prioridad de [Tareas críticas primero](tareas-criticas-primero.md), revisada el
19 de octubre. Para declarar trabajo se usa la columna Orden de ese documento;
esta tabla conserva la numeración histórica. Las tareas 1, 3, 5 y 6 están completadas
en el alcance de la [validación](validacion-tareas-1-a-6.md). La 5 no incluye
acceso real por HTTPS, y la 6 no incluye recuperación operativa del servicio.

| N.º original | Tarea pendiente | Estado o dependencia para continuar |
| --- | --- | --- |
| 2 | Acordar suspensión de empresa, baja de empleado, alcance del supervisor y tipo de marcaje | Propuestas en [Decisiones de negocio](decisiones-de-negocio.md); falta elección del responsable del producto. No se han cambiado las reglas |
| 4 | Probar horarios e importación con sesión real en el portal | API HTTPS aprobada el 19; A5 local 33/33 el 21 y horarios/importación en navegador local 17/17 el 22, con permisos y aislamiento. Faltan aceptación pública/del usuario e inventario Q17; comprobación pública diferida |
| 7 | Probar enrolamiento, captura simulada, cola sin conexión, sincronización y renovación Android contra el backend local | Completada el 19 también por HTTPS en teléfono: personal y terminal, tres fases por modalidad y limpieza. Autoensayo y guion versionados; no acredita NFC real ni apagar físicamente las radios |
| 8 | Definir e implementar retención de sobres y recibos Android | Análisis y alcance mínimo entregados el 22 en [Retención Android](retencion-android.md). Q14 sigue pendiente: plazos, evidencia en servidor y condiciones de eliminación; no hay purga implementada |
| 9 | Completar configuración de empresa en el portal | Implementación y aceptación técnica local por rol completadas en A5 el 21. Faltan despliegue y aceptación pública/del usuario |
| 10 | Mostrar las personas que no pudieron cerrar y sus causas | Implementada y comprobada en A5 local con detalle y paginación en navegador. Faltan despliegue y aceptación pública/del usuario; históricos anteriores a V008 conservan conteos |
| 11 | Automatizar verificaciones en cada cambio | Workflow integrado en `main` el 19; cuatro trabajos aprobados en `avanceLunes` (ejecución 39301664714). La obligatoriedad de trabajos requiere una decisión adicional |
| 12 | Completar semana y acuse del trabajador | A2/A3 y consulta/acuse web/API local comprobados en A5. Instrumentación y recorrido visual Android contra backend real local aprobados; faltan aceptación pública/del usuario, expediente y criterios jurídicos |
| 13 | Completar pantallas del operador del servicio | Reactivación y permisos/aislamiento comprobados con sesión real en A5 local. Faltan suspensión y aceptación pública/del usuario |
| 14 | Publicar ambiente de pruebas con TLS, SMTP y cuentas personales | Publicado con TLS el 18 de octubre de 2026 ([Despliegue en el servidor](despliegue-en-servidor.md)). Faltan correo, cuentas personales, quién opera el servicio y el acceso con sesión por HTTPS; retirar la cuenta temporal sólo tras verificar las nuevas |
| 15 | Comprobar recuperación completa y automatizar respaldos externos | Recuperación local comprobada. Política diaria/30 días, objetivos 24 h/4 h y atención por fastSolution aprobados; SSH por Gabriel y destino en otro servidor. Faltan custodia, concretar destino, automatizar y comprobar recuperación pública; [detalle](recuperacion-servicio.md) |
| 16 | Validar captura autenticada con tarjetas reales | Definir y probar autenticación y entrega de claves con tarjetas y teléfonos físicos |
| 17 | Aprobar e implementar reglas de jornada y evidencia del acuse | Dictamen profesional, criterios y casos esperados; conservar reglas y cierres históricos |
| 18 | Comparar asistencia con horarios y gestionar ausencias | Definir retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y probar |
| 19 | Validar carga y comportamiento del despliegue | Línea base local 50/300 comprobada el 22: 1,400 marcajes, 350 cierres, 240 consultas y seis exportes. Cinco imágenes analizadas sin críticas/altas ni excepciones tras corregir Keycloak. Faltan Q19, carga sostenida e infraestructura objetivo, IDs/análisis/despliegue públicos y dos IP públicas reales; cuotas compartidas sólo con varias instancias |
| 20 | Construir conector y adaptar exporte a nómina real | Sistema y formato del primer cliente; aceptación del archivo y sincronización |

Siguen diferidos jOOQ generado, notificaciones y un almacén externo para exportes;
no forman parte de las tareas completadas. Las verificaciones adicionales de
Linux, datos grandes, escrituras simultáneas, teléfono, release y otros casos
siguen abiertas donde se indican en **Sin verificar** y en la validación.

### Primer paso por área

| Quién | Primer paso sugerido |
| --- | --- |
| App | Recorrido visual de semana/acuse contra backend real local aprobado el 21. Continuar aceptación pública/del usuario y expediente; tarjeta autenticada y claves conservan sus dependencias |
| Portal | A5 local y horarios/importación local completados. Continuar aceptación pública/del usuario con inventario Q17 cuando se retome el servidor; suspensión espera decisión de producto |
| Backend | Detalle de bloqueos implementado y aceptado técnicamente en A5 local. Faltan despliegue y aceptación pública/del usuario; jOOQ diferido y reglas pendientes de decisión |

El portal ya no depende de la app para tener datos: el simulador deja
jornadas, incidencias de cuatro tipos y semanas que se pueden cerrar.
