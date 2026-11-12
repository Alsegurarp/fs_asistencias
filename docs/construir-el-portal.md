# Construir el portal

El portal sigue el [lienzo aprobado](https://claude.ai/artifact/6nguqVzZ7N9rtHX2LDScvq)
el 7 de noviembre: 81 pantallas con código por sección (ACC, CTA, OPE, PAD,
EMP, REP, EST, TEL y CON). El backend que piden ya está en `main` y en el
ambiente publicado (contrato 0.23.0; la búsqueda de Asistencia lo sube a 0.24.0, la de Incidencias a 0.25.0, los días de la semana a 0.26.0, las horas del Panel a 0.27.0, los horarios de una persona a 0.28.0 y el desglose de cada importación a 0.29.0). Este documento dice en qué orden se
construye, cómo está armado el marco y qué reglas evitan que dos personas
hagan lo mismo.

## Orden

Cada bloque entra por PR y se despliega en el ambiente publicado al
integrarse con CI en verde. Mientras una sección no se reconstruye, sus
pantallas anteriores se muestran dentro del marco nuevo, en su dirección: el
ambiente nunca pierde una función.

| Bloque | Qué entra | Pantallas del lienzo | Pantalla anterior que se retira | Estado |
| --- | --- | --- | --- | --- |
| 0 | Marco: colores, tipografía, direcciones, barra superior, menú lateral, barra inferior de teléfono, menú de la cuenta y estados | CTA-02, EST-01, EST-03, EST-04, EST-05, TEL-06, ACC-07 | Las pestañas de `Workspace` | Integrado (PR #37) y desplegado |
| 1 | Operación: Asistencia → Incidencias → Cierres → Panel con avisos y primeros pasos | OPE-01 a 12, CTA-03, EST-08, EST-09, TEL-01, TEL-02, TEL-07 a 10 | `Incidents`, `Closures` | Asistencia (PR #38), Incidencias (PR #39) y la fase 6 del backend (PR #40) integradas y desplegadas; Cierres integrado (PR #41), con su despliegue sin confirmar; Panel con la campana integrado (PR #42) |
| 2 | Padrón: Personal y horarios → Importar → Dispositivos y tarjetas, con el buscador | PAD-01 a 12, CTA-05, EST-07 | `Directory` (personas y tarjetas), `Schedules`, `Imports`, `Devices` | Personal y horarios (PR #43) e Importar (PR #44) integrados; Dispositivos y tarjetas (PR #46) y el buscador con el menú Crear (PR #47) integrados en la rama de la #45; llegan a `main` con la PR #48 |
| 3 | Empresa: Configuración, sedes, comida y reglas → Usuarios y permisos, con Mi perfil | EMP-01 a 08, CTA-01, TEL-11 | `TenantSettings`, `BreakPolicyChange`, `Users`, sedes de `Directory` | Configuración, y Usuarios y roles con Mi perfil, integrados (PR #50) |
| 4 | Reportes: nómina, expediente y bitácora con vista previa del PDF | REP-01 a 09 | `Exports`, `Dossiers` | Inicio y nómina (`feat/portal-reportes`), la bitácora (`feat/portal-bitacora`) y el expediente (`feat/portal-expediente`) en revisión, cada una sobre la anterior ([detalle](#bloque-4-reportes)) |
| 5 | Consola de operación; puede ir en paralelo desde el bloque 0 | CON-01 a 08 | `Tenants` | Pendiente |
| 6 | Antes del piloto: pantallas de acceso con la marca en Keycloak y portal instalable | ACC-01 a 06, TEL-03 a 05, EST-06 | Tema genérico de Keycloak | Pendiente |

El bloque 1 entra en cuatro PR, una por pantalla y en ese orden: Asistencia
(OPE-02, OPE-07, OPE-08, EST-09, TEL-07, TEL-08), Incidencias (OPE-03,
OPE-05, OPE-06, EST-08, TEL-02, TEL-09), Cierres y Panel. Entre Incidencias y
Cierres va la fase 6 del backend: los días de la semana con su tiempo
ordinario y extra, que Cierres y el reporte de nómina también muestran. El
Panel (OPE-01, OPE-12, TEL-01) entra con la campana de avisos (CTA-03). El
menú Crear (CTA-04) entra en el bloque 2, cuando existan las ventanas que
abre; hoy sólo existiría «Cerrar la semana».

El bloque 2 entra en tres PR: Personal y horarios (PAD-01, PAD-03, PAD-07,
PAD-08, PAD-10, EST-07), Importar (PAD-04 a 06 y PAD-09) y Dispositivos y
tarjetas (PAD-02, PAD-11, PAD-12), que trae el buscador (CTA-05) y el menú
Crear (CTA-04) cuando ya existen las ventanas que abren.

## Lo que sigue: Dispositivos y tarjetas, y Empresa

Revisado el 9 de noviembre contra el lienzo y el contrato 0.29.0. Cada
apartado dice qué pantallas entran, qué rutas ya existen, qué le falta al
API y qué depende de una decisión o de algo externo. Lo que se necesita de
Alexis está al final, en [Qué se necesita para probar y
avanzar](#qué-se-necesita-para-probar-y-avanzar).

### Bloque 2, última PR: Dispositivos y tarjetas

**Estado del 10 de noviembre:** Lectores, Tarjetas y Registrar tarjeta
están hechos en `feat/portal-dispositivos`, con `GET /cards/{cardId}`
(contrato 0.31.0). Para no hacer una PR enorme, el buscador (CTA-05) y el
menú Crear (CTA-04), que tocan la barra superior, van en la PR siguiente.
Las diferencias con el lienzo quedaron así:

- **«Asignar a otra persona»:** no existe; se respeta la regla vigente. El detalle ofrece «Reponer con otra del inventario» y revocar.
- **«Tecnología»:** se muestra desde el contrato 0.32.0, a pedido del responsable del producto (10 nov): «Huella manual» para la que se registró escribiendo la huella y «MIFARE Classic firmada» para la del piloto. Las tarjetas ya registradas se clasifican por su versión de clave (V020).
- **«Cerrar la semana»** lleva a Cierres con la confirmación abierta; aceptado el 10 nov. «Invitar» y «Generar un reporte» llegan con los bloques 3 y 4.
- **Huella:** se escribe a mano, sólo para la tarjeta simulada. Las del piloto las prepara una terminal.

Detalle original del plan:

Rama `feat/portal-dispositivos`. Retira `Devices.tsx`, las tarjetas de
`Directory.tsx` (con lo que `Directory` queda sólo con sedes hasta el
bloque 3) y sus pruebas.

| Pantalla | Qué es | Rutas que ya existen |
| --- | --- | --- |
| PAD-02 Lectores | Lectores con sus cifras (activos, sin señal más de 24 h, revocados o reemplazados), modelo, fecha de activación, sede o persona, versión de la app, última señal y revocar. «Activar lector» abre el panel con terminal de sede o teléfono personal, la sede o la persona, el nombre y el código de un solo uso con su vencimiento | `GET /devices?mode=&status=&silent=&q=`, `GET /devices/summary`, `POST /devices/{id}/revocation`, `POST /device-enrollments` |
| PAD-11 Tarjetas | Pestañas por estado (todas, activas, en inventario, perdidas o dañadas, revocadas, reemplazadas), quién la tiene y desde cuándo; el detalle con su historial, la última lectura, asignar y revocar como revocada, perdida o dañada | `GET /cards?status=&q=`, `GET /cards/summary`, `POST /cards/{id}/assignments`, `POST /cards/{id}/revocation` |
| PAD-12 Registrar tarjeta | Etiqueta, huella y, si se quiere, asignarla en el mismo paso a una persona sin tarjeta | `POST /cards`, `POST /cards/{id}/assignments`, `GET /employees?withoutCard=true` |
| CTA-05 Buscador | Personas, tarjetas y lectores desde la barra superior; Enter abre el primero y Esc cierra | `GET /employees?q=`, `GET /cards?q=`, `GET /devices?q=`, con pocos resultados de cada una |
| CTA-04 Menú Crear | Dar de alta, crear horario, activar lector, registrar tarjeta y cerrar la semana, según el rol; cada opción abre su ventana sobre la página actual. «Invitar» llega con el bloque 3 y «Generar un reporte» con el bloque 4 | Las de cada ventana |

Lo que le falta al API (contrato 0.31.0, en la misma PR; la 0.30.0 la
tomaron las tarjetas del piloto):

- **Detalle de una tarjeta.** El lienzo muestra quién la registró, su
  historial de asignaciones y su última lectura con el lector. Hoy no hay
  `GET /cards/{cardId}`: la lista sólo trae la asignación actual y la última.
  Propuesta: `GET /cards/{cardId}` con `createdByName`, `assignments` (todas,
  con desde y hasta) y `lastRead` (cuándo y en qué lector), con los mismos
  roles que la lista.

Diferencias con el lienzo que hay que confirmar:

- **«Asignar a otra persona» una tarjeta que ya tuvo titular.** La regla
  vigente dice que una tarjeta que ya tuvo titular no pasa a otra persona: se
  revoca y se asigna otra del inventario. Propuesta: respetar la regla y que
  el detalle ofrezca «Reponer con otra del inventario».
- **«Tecnología: Cifrada».** El API no guarda la tecnología; `keyVersion`
  sólo existe en la tarjeta real. Propuesta: no mostrar la columna hasta que
  exista la tarjeta real.
- **Registrar la huella desde el navegador.** El navegador no lee la
  tarjeta: la huella se escribe a mano, como hoy. Sirve para la tarjeta
  simulada. Las tarjetas del piloto se registran desde una terminal
  («Preparar una tarjeta», 10 de noviembre) y llegan al inventario con
  etiqueta `ZC-`; el portal sólo las asigna. Conviene que PAD-12 lo diga.

Prueba en el entorno aislado: el simulador de lectores (`device-sim`)
activa lectores, manda marcajes con tarjetas simuladas y deja un lector sin
señal; no hace falta un teléfono.

### Bloque 3: Empresa

**Estado del 10 de noviembre:** Configuración (EMP-01, 02, 03, 07 y 08) está
hecha en `feat/portal-configuracion`, con las cifras de cada sede en
`GET /sites` (contrato 0.33.0, índices V021). Retira `TenantSettings` y
`Directory`; `ErrorNotice` y `EntitySelect`, que todavía usan Usuarios,
Reportes y Mi asistencia, pasan a `legacy.tsx`. `BreakPolicyChange` se queda
para la Consola. `/configuracion/sedes` lleva a `/configuracion`. El mapa es
OpenStreetMap con Leaflet 1.9.4, en un archivo aparte que sólo baja al abrir
Configuración; la política de seguridad del portal admite
`https://tile.openstreetmap.org` en `img-src`. Diferencias con el lienzo:

- **«Programó Mariana Ortiz»:** el API no guarda quién programó el cambio de comida; se muestra sólo la fecha.
- **«Sede activa»:** en lugar del interruptor, el pie del panel tiene «Desactivar sede» o «Reactivar sede», que se guardan en el acto.
- **Columna «Acciones»:** no hay botón «Editar»; un clic en la fila abre la sede, como en las demás tablas.
- **Fecha de entrada del cambio de comida:** el portal la calcula con la misma regla del servidor para mostrarla antes de programar; la que vale es la que devuelve el servidor.

**Estado del 11 de noviembre:** Usuarios y roles (EMP-04, 05 y 06) y Mi
perfil (CTA-01 y TEL-11) están hechos en `feat/portal-usuarios`, sin cambios
al API: la lista, sus pestañas por rol, la búsqueda y las cifras salen de
`GET /users` y `GET /users/summary`. Retira la pantalla anterior de `Users`.
Mi perfil y Ayuda y soporte se abren desde el menú de la cuenta sobre
cualquier pantalla (`?perfil=1`, `?ayuda=1`) y, en teléfono, desde «Más».
El menú Crear suma «Invitar a alguien del equipo». Diferencias con el lienzo:

- **Invitar no manda correo** (el API no lo hace): el subtítulo dice «Entra con su correo, una contraseña y su segundo factor», el botón es «Invitar» y no «Enviar invitación», y la ventana pide compartir la dirección del portal.
- **Expediente al invitar:** no está en la ventana. El servidor sólo concede el permiso a una cuenta activa y ya ligada; se concede después en «Editar acceso».
- **Rol Trabajador:** se agrega a los roles, con su fila del padrón, porque es lo que deja a una persona ver su asistencia en el portal. La pestaña «Trabajador» sólo aparece si alguien lo tiene.
- **Nombre:** «Editar acceso» deja cambiar el nombre, que el lienzo no muestra.
- **Habilitar:** a quien está deshabilitado, el panel le ofrece «Habilitar su acceso» en lugar de «Deshabilitar su acceso».
- **Permisos por rol:** «Personal, horarios, tarjetas y lectores» se parte en «Personal y horarios» (Supervisión consulta los de sus sedes) y «Tarjetas y lectores» (Supervisión no los ve), y se agrega «Importar el padrón», como los aplica el servidor.
- **Mi perfil:** el alcance de Supervisión dice «Las sedes que te asignaron», sin nombrarlas, porque `/me` no trae sus sedes. El segundo factor dice «App de autenticación» sin «Activo»: el portal no sabe si ya lo configuró. «Cambiar» y «Reconfigurar» abren la consola de cuenta de Keycloak en otra pestaña. «Zenit en este equipo» e «Instalar» llegan con el bloque 6.
- **Cifra «Supervisión con sedes»:** cuenta a Supervisión de cualquier estado contra quienes, con acceso vigente, no tienen sedes.

Dos PR: Configuración con sedes, comida y reglas (EMP-01, 02, 03, 07, 08) y
Usuarios y roles con Mi perfil (EMP-04, 05, 06, CTA-01, TEL-11). Retira
`TenantSettings`, `BreakPolicyChange`, `Users` y lo que queda de
`Directory`.

| Pantalla | Qué es | Rutas que ya existen |
| --- | --- | --- |
| EMP-01 Configuración | Nombre, zona horaria, inicio de semana y cierre automático; cifras de sedes, personas y lectores; política de comida y reglas; sedes con su zona en un mapa | `GET/PATCH /tenant`, `GET /sites`, `GET /rule-sets` |
| EMP-07 Editar sede | Nombre, zona horaria, punto en el mapa (arrastrable), latitud, longitud, radio, activa | `GET/POST/PATCH /sites` |
| EMP-02 y 08 Comida | Ver el cambio programado y cancelarlo; programar otro con motivo | `POST /tenant/break-policy-changes`, `…/{id}/cancellation` |
| EMP-03 Reglas | Topes por año y reglas por día, de consulta | `GET /rule-sets` |
| EMP-04 Usuarios | Cifras, pestañas por rol, estado, cuenta vinculada, expediente; el panel «Editar acceso» con rol, sedes de Supervisión, permiso de expediente, pedir contraseña nueva, soltar la liga y deshabilitar | `GET /users`, `GET /users/summary`, `PATCH /users/{id}`, `POST /users/{id}/password-change`, `POST /users/{id}/unlink`, `PUT /users/{id}/dossier-permission` |
| EMP-05 Invitar | Nombre, correo, rol, sedes y permiso de expediente | `POST /users` |
| EMP-06 Permisos por rol | Tabla de consulta | Ninguna: es texto fijo |
| CTA-01 y TEL-11 Mi perfil | Datos de la cuenta y su seguridad | `GET /me`; contraseña y segundo factor en la consola de cuenta de Keycloak |

Lo que le falta al API o al ambiente:

- **Cifras por sede**: terminales y personas de cada sede en la tabla de
  Configuración. Hoy se pueden sacar consultando sede por sede, lo que rompe
  la regla 4. Propuesta: `people` y `devices` en cada sede de `GET /sites`.
- **El correo de la invitación.** «Recibe un correo y entra con contraseña y
  segundo factor» necesita SMTP en Keycloak, que sigue pendiente. Sin correo
  la invitación queda creada y la persona entra con el enlace que se le
  comparta por otro medio.
- **El mapa.** Hace falta un proveedor de mapas. La política de seguridad
  del portal sólo permite contenido propio; el mapa necesita permitir sus
  mosaicos.

### Bloque 4: Reportes

Tres PR, decididas el 11 de noviembre: inicio con nómina, bitácora y
expediente. **El PDF lo imprime el portal**: la vista previa se arma con
los datos del API y «Descargar PDF» abre la impresión del navegador, donde
se elige «Guardar como PDF». El archivo oficial para nómina sigue siendo el
CSV del servidor, con su huella, su plazo y su registro en la bitácora; la
hoja impresa no queda registrada ni lleva huella propia.

**Estado del 11 de noviembre:** el inicio (REP-01) y el reporte para nómina
(REP-02 a 04) están hechos en `feat/portal-reportes`, sin cambios al API.
Retira `Exports`; `saveFile` pasa a `files.ts` y `EntitySelect` sale de
`legacy.tsx`. `ReportSheet.tsx` es la hoja de vista previa con su copia
para imprimir, y la usará también la bitácora. Diferencias con el lienzo:

- **PDF:** sale de la impresión del navegador. La vista previa es una hoja continua; los saltos de página los pone la impresión, así que no hay «Página 1 de 2» ni «Anterior» y «Siguiente» de páginas.
- **Columnas:** los cierres no traen días trabajados, horario ni incidencias resueltas, así que esas columnas no están. Se agrega «Tiempo trabajado», y «Comida» es el descanso registrado de la semana.
- **Semanas:** se ofrecen las cinco últimas que ya terminaron, cada una con sus cerradas y bloqueadas en el alcance elegido; «39 de 42» queda como «39 cerradas · 3 bloqueadas», porque el resumen no trae cuántas personas tenía la semana.
- **Línea de firma:** dos líneas, «Elaboró» y «Autoriza la nómina».
- **Generados recientemente:** por ahora sólo los exportes de nómina; el expediente se suma con su PR. La bitácora no aparece ahí porque su hoja y su CSV los arma el portal y no quedan registrados.

**Bitácora (REP-07 y 08)**, en `feat/portal-bitacora`, sin cambios al API:
`/reportes/bitacora` con los filtros del servidor en la dirección y la vista
previa en `?vista=previa`. Cada acción se dice en una frase
(`auditModel.ts`), la misma que usa ahora «Actividad reciente» del Panel.
Los nombres de los roles pasan a `roles.ts`. Diferencias con el lienzo:

- **«Persona u objeto»** es «Persona»: busca en el padrón y filtra lo que se le hizo a esa persona (`targetType=employee`). Las incidencias y los cierres de la persona no entran, porque su objeto es la incidencia o el cierre.
- **El CSV y el PDF los arma el portal** con la lista completa, hasta 4,000 acciones; con más, pide acotar el periodo o filtrar por acción. No quedan registrados como descarga.
- **Periodo inicial:** los últimos 30 días, hasta hoy.

**Expediente (REP-05 y 06)**, en `feat/portal-expediente`, sin cambios al
API ni al flujo de verificación (`dossierFlow.ts` no cambia). Tres pasos:
preparar la copia, confirmar la identidad y descargar el ZIP una vez. «Qué
incluye esta copia» y la carátula salen del manifiesto. Las copias propias
se suman a «Generados recientemente». Retira la pantalla anterior de
`Dossiers`, que no usaba el marco. Diferencias con el lienzo:

- **Copias anteriores y descargas:** son sólo las de quien consulta, porque `GET /dossiers` no devuelve las de otras personas; las demás están en la bitácora. Por eso no hay columna «Pidió» ni «Descargas anteriores» de otros.
- **Quién puede descargarlo:** sólo lo ve Administración, porque sale de `GET /users`.
- **La carátula** se ve en cuanto la copia está lista, no sólo después de confirmar la identidad, y se imprime desde el navegador.
- **Huellas:** del manifiesto y del ZIP, completas en la carátula y abreviadas en pantalla.

### Qué se necesita para probar y avanzar

Para empezar Dispositivos y tarjetas no hace falta nada más: se prueba con
el entorno aislado y el simulador. Lo que sigue destraba el resto o lo
lleva al ambiente publicado.

**Para seguir con el desarrollo**

| Qué | Para qué | Bloquea |
| --- | --- | --- |
| Decidir «Asignar a otra persona» (propuesta: respetar la regla vigente) | El detalle de una tarjeta | Dispositivos y tarjetas |
| Decidir cómo se registra una tarjeta real: escribiendo la huella, leyéndola con la app o con un lector de escritorio | PAD-12 con tarjeta real | Sólo la tarjeta real; con la simulada se avanza |
| ~~Proveedor de mapas~~ **Resuelto el 10 nov:** OpenStreetMap, con su atribución; la política de seguridad se abre a sus mosaicos | El mapa de sedes | — |
| ~~Datos de SMTP~~ **Resuelto el 10 nov:** Brevo, con la credencial en `secrets/smtp.env` y configurado en el Keycloak local. Para producción falta un remitente del dominio propio | Que la invitación llegue por correo y se recupere una contraseña olvidada | Producción, por el remitente |
| ~~Canal de «Ayuda y soporte»~~ **Resuelto el 10 nov:** correo rene.alexis.segura@gmail.com y número 56 3300 1126 | El menú de la cuenta | — |

**Para probar en el ambiente publicado**

| Qué | Para qué |
| --- | --- |
| Confirmar si ya se desplegó `main` en <https://zenit.fastsolution.com.mx> o autorizar el despliegue (`deploy/servidor/desplegar.sh`, que no se ha corrido) | Desde Cierres (PR #41) hasta Importar (PR #44) no hay despliegue registrado. Importar trae la migración V018 |
| Acceso por SSH al servidor, o que lo corra Gabriel | Desplegar y ver los registros |
| Cuentas de prueba por rol en el ambiente publicado (Administración, RH, Supervisión, Auditoría), con su segundo factor | El recorrido del portal público por rol |
| Un teléfono Android con la app instalada y NFC | Activar un lector de verdad y marcar con la tarjeta simulada |
| Tarjetas reales (DESFire EV3) y su clave | Verificar la tarjeta real; hoy sólo se acepta la simulada |

**Para cerrar cada PR**

1. Abrir la PR con el enlace que dejo al subir la rama e integrarla con CI
   en verde.
2. Confirmar las diferencias con el lienzo anotadas en la PR (regla 6).
3. Decir si se despliega: no se despliega sin esa confirmación.

## Reglas para no duplicar

1. Quien tome un bloque lo avisa al equipo y abre `feat/portal-<bloque>`
   antes de escribir código. Una persona lleva un bloque a la vez.
2. `design.ts`, `theme.ts`, `Shell.tsx`, `sections.ts`, `ui.tsx` y el
   cliente del API sólo cambian en el bloque 0 o en una PR chica avisada
   antes. Una pieza nueva de `ui.tsx` entra con la primera pantalla que la
   usa, y las demás la reusan.
3. Cada PR de sección borra la pantalla anterior que reemplaza y sus pruebas.
   Nunca conviven dos versiones de la misma pantalla.
4. Listas, filtros, búsquedas y conteos salen del servidor, con las rutas del
   contrato. No se filtra en el navegador lo ya cargado ni se pide una ruta
   por fila.
5. Cada pantalla sale lista para teléfono en su misma PR.
6. Si al construir algo del lienzo tiene que cambiar, se anota en la PR y se
   confirma antes de integrarla.

## Cómo está armado el marco

| Pieza | Archivo |
| --- | --- |
| Valores del lienzo: colores, degradados, vidrio, sombras, ancho de teléfono | `web/src/design.ts` |
| Tema de MUI con esos valores; botón principal con degradado y forma de píldora | `web/src/theme.ts` |
| Menú, direcciones, pestañas y roles de cada pantalla | `web/src/sections.ts` |
| Barra superior, menú lateral, barra inferior, menú de la cuenta, encabezado de página y envoltura de pantallas anteriores | `web/src/Shell.tsx` |
| Rutas, falta de permiso (EST-03) y página no encontrada (EST-04) | `web/src/Portal.tsx` |
| «Más» en teléfono (TEL-06) | `web/src/More.tsx` |
| Sesión terminada (ACC-07), cuenta sin empresa (EST-01), error (EST-05) y carga | `web/src/States.tsx`, `web/src/App.tsx` |
| Íconos y marca de dos ondas | `web/src/Icons.tsx` |
| Ventana para crear algo (`Modal`), con encabezado azul, formulario y pie | `web/src/ui.tsx` |
| Piezas de las secciones: etiquetas de estado, filtros de un toque, búsqueda, sede, semana, tabla con paginador, filas de espera, avisos, ficha lateral (de persona o de registro, con pie de acciones), conmutador de vista, pestañas de estado y texto para lectores de pantalla (`visuallyHidden`) | `web/src/ui.tsx` |
| Pendientes junto a una sección del menú, como las incidencias abiertas | `counts` de `Shell`, que llena `Portal.tsx` |
| Campana de avisos (CTA-03) y lo que comparte con el Panel | `web/src/Notices.tsx` (`bell` de `Shell`); los avisos se arman en `web/src/panelModel.ts` |
| Piezas de las pantallas anteriores que todavía se usan (`RecordName`, `WeekSummary`) | `web/src/legacy.tsx` |
| Listas cortas pedidas completas (sedes, horarios) | `web/src/lists.ts` |

- **Sesión.** Sin sesión, el portal va directo al inicio de sesión del
  servicio de identidad (ACC-01) y vuelve a la misma dirección; un enlace
  directo sobrevive al inicio de sesión. Al salir, o si la sesión vence, se
  muestra «Tu sesión terminó» en `/sesion-terminada`.
- **Inter** se sirve desde el propio portal (`@fontsource/inter` 5.3.0, pesos
  400 a 700): la CSP sólo admite fuentes de `'self'`.
- **Menú por rol.** Una sección aparece si el rol puede abrir al menos una de
  sus pantallas; sus pestañas son las que el rol puede abrir. Una dirección
  sin permiso muestra EST-03 con los roles que sí la ven, calculados con
  `permissions()`; el servidor sigue autorizando cada operación.
- **Pantallas anteriores.** `LegacyScreen` las pone en un panel blanco y baja
  sus títulos a h2 y h3, para que la página tenga un solo h1. Se retira
  cuando la última sección se reconstruya.
- **Teléfono** (hasta 860 px): sin menú lateral; barra inferior con hasta
  cuatro secciones, o tres y «Más».
- **El menú lateral** se oculta con el botón de la barra superior y se
  recuerda en el navegador; los grupos se pliegan.

### Direcciones

| Dirección | Pantalla |
| --- | --- |
| `/` | La primera sección del rol: el Panel para Administración, RH, Supervisión y Auditoría |
| `/panel` | Panel; una empresa sin personal ve ahí sus primeros pasos (OPE-12) a Administración |
| `/asistencia` | Asistencia; lo elegido va en la dirección: `semana`, `sede`, `filtro` (`alertas`, `extra`, `sin-entrada`, `en-turno`), `q`, `persona` y `ficha` (`marcajes`, `cierres`) |
| `/incidencias` | Incidencias; en la dirección: `estado` (`resueltas`), `vista` (`tablero`), `q`, `tipo`, `sede`, `semana`, `mias`, `alta`, `bloquean` e `incidencia`, la que está abierta. Cierres y Asistencia llegan con `semana` e `incidencia` |
| `/cierres` | Cierres; en la dirección: `semana`, `sede`, `pestana` (`bloqueadas`, `reabiertas`), `acuse` (`conformes`, `objecion`, `sin-acuse`) y `cierre`, el que está abierto: un enlace con `cierre` abre ese cierre aunque no esté en la página |
| `/personal` | Personas; en la dirección: `estado` (`bajas`, `todas`), `horario`, `sin-tarjeta`, `sede`, `q` y `persona`, la ficha abierta |
| `/personal/horarios` | Horarios; `vigencia=historicos` |
| `/personal/importaciones` | Importaciones; `importar=archivo` abre el modal de importar e `importar=<id>`, una importación del historial |
| `/personal/fuentes` | Fuentes del padrón, para Administración y RH |
| `/dispositivos`, `/dispositivos/tarjetas` | Dispositivos y tarjetas |
| `/configuracion`, `/configuracion/sedes` | Configuración |
| `/usuarios` | Usuarios y roles |
| `/reportes`, `/reportes/expediente` | Reportes y expediente |
| `/dossier/callback` | Regreso de la verificación del expediente; está registrada en Keycloak y no se cambia |
| `/mi-asistencia` | Mi asistencia, desde el menú de la cuenta |
| `/empresas` | Consola de operación |
| `/mas` | Más, en teléfono |
| `/sesion-terminada` | Tu sesión terminó |

## Reconstruir una sección

1. Abrir la rama del bloque y avisar.
2. Construir las pantallas nuevas con `design.ts` y el tema; los títulos de
   página con `PageHeader`.
3. En `sections.ts`, cambiar las pantallas de la sección por las nuevas.
4. Borrar la pantalla anterior y sus pruebas; las nuevas llevan el caso
   negativo por rol y la revisión automática de accesibilidad.
5. Revisarla a 1440 y a 390 px con una sesión real.
6. Actualizar este documento y la [guía del portal](guia-portal-web.md).

## Lo que el marco todavía no tiene

| Falta | Llega con |
| --- | --- |
| Cierres de una persona más allá de seis semanas: `GET /week-closures` pide la semana, y la ficha consulta las seis últimas en seis llamadas fijas | Una ruta de cierres por persona, si se necesita más historia |
| Historial completo de una incidencia: la incidencia trae su apertura, su asignación actual y su resolución; lo demás está en la bitácora, que sólo ven Administración y Auditoría | Bitácora en Reportes (bloque 4) |
| Buscador (CTA-05) | Dispositivos y tarjetas |
| Menú Crear (CTA-04) | Dispositivos y tarjetas, con las ventanas de alta de persona, horario, tarjeta y lector; «Invitar» llegó con el bloque 3 y «Generar un reporte» llega con el 4 |
| «En línea · datos de las…», «Instalar Zenit» y sin conexión | Bloque 6 |
| ~~Empresa suspendida (EST-02)~~ | **Hecho (contrato 0.36.0):** `/me` trae `access` (`active`, `suspended`, `none`) y, sólo con la empresa suspendida y el acceso vigente, `suspendedTenantName`; `App.tsx` muestra `CompanySuspended` de `States.tsx` |
| Pantallas de acceso con la marca (ACC-01 a 06) | Bloque 6 |

Diferencias deliberadas con el lienzo:

- **Mi asistencia** no está en el lienzo. Se conserva en el menú de la cuenta
  y es el inicio de quien sólo tiene el rol de trabajador, hasta decidir si
  el portal la mantiene.
- **El panel de marca** del lienzo muestra una cifra de ejemplo («Asistencia
  de hoy 38 / 42»). El portal no la muestra: antes de entrar no hay datos
  reales.
- **Marcajes de la ficha.** El lienzo dice «Terminal Bodega Norte · tarjeta
  T-0031». El marcaje no guarda con qué tarjeta se hizo y Supervisión no lee
  los lectores: la ficha dice «Terminal de *sede*» o «Teléfono personal», sin
  tarjeta.
- **Atención en Asistencia.** Además de «Extra 3 de 4 días», como en el
  lienzo, la columna muestra los topes rebasados, el tramo sin salida que ya
  no es el turno de hoy y cada incidencia abierta, que abre Incidencias. Una
  semana cerrada antes del contrato 0.26.0 no guardó sus días: ahí dice
  «Tiempo extra» y la ficha muestra lo trabajado de cada día.
- **Días sin marcas.** Un día con horario que ya pasó y no tiene marcas dice
  «Sin marcas · programado …»; el lienzo no tiene ese caso.
- **Incidencias: semana elegida.** Cuando se llega desde Cierres con una
  semana, aparece un filtro «Semana …» que se quita con un toque; el lienzo
  no lo tiene.
- **Incidencias: «Ver su semana»** también está en una abierta, junto a las
  marcas del día, y lleva a la ficha de la persona en Asistencia.
- **Incidencias: «Mías»** no aparece para Auditoría, que no se asigna
  incidencias.
- **El historial de una resuelta** se arma con lo que guarda la incidencia:
  abierta, asignada, resuelta y, si hubo ajuste, semana recalculada.
- **Cierres: sin cerrar personas elegidas.** El portal cierra sólo por
  corrida, de toda la empresa o de una sede, y la corrida deja fuera a quien
  tenga algo abierto. Así hay un solo camino para cerrar y no un tope de 500
  personas por petición.
- **Cierres: quién pidió la corrida** se muestra con su nombre, sin su rol.
- **Cierres: bloqueadas** salen de las incidencias abiertas que bloquean el
  cierre, agrupadas por persona. Un tramo sin salida aparece cuando una
  corrida lo vuelve incidencia «Falta la marca que cierra».
- **Cierres: nombres repetidos.** Dos bloqueadas que se llaman igual llevan
  su sede; en las cerradas va el número de empleado junto al nombre.
- **Cierres en Supervisión.** Supervisión sólo ve las corridas de su sede;
  si la última fue de toda la empresa, el banner lo dice en lugar de «Sin
  corridas».
- **Panel: sin «Hoy · Esta semana».** El lienzo tiene ese conmutador sin
  decir qué cambia; el Panel muestra hoy y la semana en curso a la vez.
- **Panel: «sin salida»** cuenta a quien tiene un tramo sin cerrar en la
  semana que ya no es su turno, no sólo el de ayer.
- **Panel: horas de la semana.** Salen de `mostHours` del resumen (contrato
  0.27.0), del mismo cálculo que la tabla: ordenar la tabla por horas
  obligaría a calcular a todas las personas en cada página.
- **Panel: actividad reciente** dice quién actuó, sin su rol, y no tiene el
  enlace «Bitácora» hasta que exista en Reportes (bloque 4). La sincronización
  de marcajes no se registra en la bitácora, así que no aparece.
- **Panel: lo que pide atención** son las cuatro incidencias abiertas más
  graves y, agrupadas, las objeciones y bloqueadas de la semana anterior y
  los lectores sin señal.
- **Primeros pasos** sólo los ve Administración; «Descargar la plantilla»
  lleva a Importaciones, donde está la plantilla, y no hay «Ayuda y soporte».
- **Campana.** «Marcar como vistos» se recuerda en el navegador: los avisos
  no se guardan en el servidor. Un aviso cuya cifra cambia vuelve a contar.
  La campana es de quien ve la operación de la empresa; quien sólo es
  trabajador sigue viendo el aviso de la comida arriba de su pantalla.
- **Personas: estado en un selector.** El lienzo pone «Activas · Dadas de
  baja · Todas» como pestañas; van en un selector junto a la sede para que
  los filtros de horario quepan en una fila.
- **Personas: «Alta reciente»** es quien ingresó en las últimas dos semanas;
  quien ingresa después de hoy dice «Ingresa …».
- **Ficha: la tarjeta** dice desde cuándo la tiene sólo a quien consulta
  tarjetas (Administración, RH y Auditoría); «Ver tarjeta» lleva a la lista
  de tarjetas hasta que exista su detalle (PAD-11).
- **Alta: la fecha de ingreso** es obligatoria en el API; el formulario la
  llena con hoy. La tarjeta se elige sólo si quien da de alta gestiona
  tarjetas.
- **Horarios: crear abre una ventana**, no un panel lateral: es la regla del
  lienzo para crear algo. Un horario no se edita: se crea otro y se asigna
  desde una fecha.
- **Importar: «Importar CSV»** abre el modal sobre Importaciones
  (`?importar=archivo`), también desde Personas, para que al terminar se vea
  el historial.
- **Importar: aplicar una revisión del historial** pide elegir otra vez el
  archivo: el servidor no lo guarda y comprueba que sea el mismo por su
  huella. El lienzo lleva de «Revisar y aplicar» directo a revisar.
- **Importar: la huella** es la de las filas aplicadas (`manifestHash`), no
  la del archivo, y así lo dice; el lienzo dice «Huella del archivo». Las
  importaciones anteriores al contrato 0.29.0 no dicen altas, con cambios y
  sin cambios, sólo cuántas se aplicaron.
- **Importar: la tabla de errores** muestra las primeras 100 filas; las
  demás están en «Descargar errores», que también se ofrece al revisar.
- **Importaciones: «Revisado y aplicado»** es el estado de una revisión que
  ya se aplicó; la aplicación aparece en su propia fila como «Aplicado».
- **Fuentes del padrón** muestra el último punto tal como lo guarda la
  fuente. Los cambios recientes salen de la bitácora y sólo los ve
  Administración; «Detalle completo en la bitácora» llega con Reportes.

## Verificar

```powershell
docker build --target build --tag zenit-web-check web
docker run --rm --network none zenit-web-check pnpm test
```

Las pruebas del marco están en `Portal.test.tsx` y `States.test.tsx`; las de
Asistencia, en `Attendance.test.tsx` y `attendanceModel.test.ts`; las del
Panel y la campana, en `Panel.test.tsx` y `panelModel.test.ts`; las de
Personal y horarios, en `Personnel.test.tsx` y `personnelModel.test.ts`; las de
Importar, en `Imports.test.tsx` y `importsModel.test.ts`; las de
Incidencias, en `Incidents.test.tsx`; las de Cierres, en `Closures.test.tsx` y
`closureModel.test.ts`; el
contraste de los colores del lienzo, en `accessibility.test.ts`.
