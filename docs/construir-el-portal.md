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
| 1 | Operación: Asistencia → Incidencias → Cierres → Panel con avisos y primeros pasos | OPE-01 a 12, CTA-03, EST-08, EST-09, TEL-01, TEL-02, TEL-07 a 10 | `Incidents`, `Closures` | Integrado (PR #38 a #42) y desplegado |
| 2 | Padrón: Personal y horarios → Importar → Dispositivos y tarjetas, con el buscador | PAD-01 a 12, CTA-05, EST-07 | `Directory` (personas y tarjetas), `Schedules`, `Imports`, `Devices` | Integrado (PR #43 a #47; a `main` con la #48) y desplegado |
| 3 | Empresa: Configuración, sedes, comida y reglas → Usuarios y permisos, con Mi perfil | EMP-01 a 08, CTA-01, TEL-11 | `TenantSettings`, `BreakPolicyChange`, `Users`, sedes de `Directory` | Integrado (PR #50) y desplegado |
| 4 | Reportes: nómina, expediente y bitácora con vista previa del PDF | REP-01 a 09 | `Exports`, `Dossiers` | Integrado (PR #51 a #53) y desplegado ([detalle](#bloque-4-reportes)) |
| 5 | Consola de operación; puede ir en paralelo desde el bloque 0 | CON-01 a 08 | `Tenants` | Hecho, sin cambios al API ([detalle](#bloque-5-consola-de-operación)) |
| 6 | Antes del piloto: pantallas de acceso con la marca en Keycloak y portal instalable | ACC-01 a 06, TEL-03 a 05, EST-06 | Tema genérico de Keycloak | Acceso integrado (PR #64 y #65); ACC-06 y el portal instalable hechos en `feat/mvp-segun-el-lienzo` ([acceso](#bloque-6-acceso-con-marca), [instalable](#portal-instalable)) |

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
`https://tile.openstreetmap.org` en `img-src`. El portal manda
`Referrer-Policy: no-referrer`, y OpenStreetMap bloquea con un 403 («Access
blocked») los mosaicos que llegan sin `Referer` (su política de uso, 3.1): por
eso sólo la capa de mosaicos lleva `referrerPolicy:
'strict-origin-when-cross-origin'`, que manda el origen sin la ruta.
Diferencias con el lienzo:

- **«Programó Mariana Ortiz»:** Desde el MVP según el lienzo (contrato 0.37.0) el cambio guarda quién lo programó y Configuración lo muestra; los programados antes no tienen nombre.
- **«Sede activa»:** Desde el MVP según el lienzo (contrato 0.37.0) es el interruptor del lienzo y se guarda en el acto.
- **Columna «Acciones»:** Desde el MVP según el lienzo (contrato 0.37.0) lleva «Editar» (o «Ver» para quien sólo consulta); un clic en la fila sigue abriendo la sede.
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
- **Mi perfil:** Desde el MVP según el lienzo (contrato 0.37.0) el alcance de Supervisión nombra sus sedes (`sites` en `/me`) y el segundo factor dice «Activo · app de autenticación», porque el acceso lo exige en cada ingreso; el portal no consulta la cuenta en el servicio de identidad, cuyo cliente técnico sólo puede pedir una contraseña nueva. «Cambiar» y «Reconfigurar» abren la consola de cuenta de Keycloak en otra pestaña. «Zenit en este equipo» ofrece instalar el portal.
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

- **PDF:** sale de la impresión del navegador. Desde el MVP según el lienzo (contrato 0.37.0) la vista previa va por páginas, como el lienzo: «Página 1 de 2» con anterior y siguiente; cada página corta antes de una fila o un bloque.
- **Columnas:** Desde el MVP según el lienzo (contrato 0.37.0) «Horario» siempre, y «Días trabajados» e «Incidencias resueltas» como en el lienzo (`daysWorked`, `scheduleName` y `resolvedIncidents` en cada cierre). Un cierre anterior a 0.26.0 no guardó sus días y dice «—». «Tiempo trabajado» sigue disponible, apagado como en el lienzo, y «Comida» es el descanso registrado de la semana.
- **Semanas:** se ofrecen las cinco últimas que ya terminaron. Desde el MVP según el lienzo (contrato 0.37.0) dicen «39 de 42 cerradas», con `people` del resumen, y las bloqueadas aparte.
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

- **Copias anteriores y descargas:** Desde el MVP según el lienzo (contrato 0.37.0) Administración ve todas las copias de la empresa con quién las pidió y cuándo se descargaron (`GET /dossier-history`), sin identificadores ni huellas: consultar o descargar una copia sigue siendo sólo de quien la pidió. Los demás roles ven sólo las suyas.
- **Quién puede descargarlo:** sólo lo ve Administración, porque sale de `GET /users`.
- **La carátula** se ve en cuanto la copia está lista, no sólo después de confirmar la identidad, y se imprime desde el navegador.
- **Huellas:** del manifiesto y del ZIP, completas en la carátula y abreviadas en pantalla.

### Bloque 5: consola de operación

Hecho el 12 de noviembre en `feat/portal-consola-operacion`, con las rutas de
la consola que ya existían (contrato 0.23.0) y sin cambios al API. Es de
quien opera el servicio: no ve datos de las personas de ninguna empresa.

| Pantalla | Dirección | Qué hace |
| --- | --- | --- |
| CON-01 Empresas | `/empresas` | Cifras del servicio, búsqueda, vistas con su conteo y la tabla; `?vista=`, `?q=` |
| CON-02 y CON-03 Ficha de la empresa | `?empresa=<id>` | Configuración, quién la administra, uso del mes y acciones; suspendida: qué implica y reactivarla |
| CON-04 Uso del mes | `/empresas/uso` | Conteos por empresa con su total, mes a mes, y el CSV; `?mes=AAAA-MM`, `?q=` |
| CON-05 Alta | `?alta=1` | Da de alta e invita a quien la administrará; al terminar abre su ficha |
| CON-06 Comida, CON-07 Soltar, CON-08 Suspender | `?accion=comida`, `soltar`, `suspender` | Cada una pide su motivo, que queda en la bitácora de la empresa |
| Invitar otra administración | `?accion=invitar` | Sólo cuando nadie la administra con su cuenta |

Archivos: `Tenants.tsx` (Empresas), `TenantForms.tsx` (ficha y ventanas),
`TenantUsage.tsx` (Uso del mes) y `tenantsModel.ts` (tipos, textos y CSV).

Lo que cambia respecto al lienzo:

- **Quién administra** es una columna de la tabla y una parte de la ficha,
  con el correo y si ya entró; el lienzo no lo dibuja.
- **Vistas:** Todas, Activas, Suspendidas y «Con cambio de comida», como el lienzo (desde el mvp según el lienzo (contrato 0.37.0), `breakPolicyChange=scheduled`), más «Invitación sin usar» y «Sin quien administre» cuando hay alguna.
- **«Marcaron en el mes»** sale de `GET /tenants/usage` con la misma página de la lista, que pagina igual. Con una vista por administración o por cambio de comida la columna no se muestra, porque esa ruta no tiene esos filtros.
- **La ficha suspendida** desde el mvp según el lienzo (contrato 0.37.0) dice cuándo, quién y por qué se suspendió (`suspension`); una suspendida antes de esa versión no lo trae y está en la bitácora.
- **El mes en curso** de las cifras y de Uso del mes se corta con la hora del
  centro de México; cada conteo sigue cortándose en la zona de su empresa.
- **El CSV** lo arma el portal recorriendo las páginas; un nombre que empieza
  como fórmula se escribe con apóstrofo.
- **La búsqueda de empresas y el alta** desde el mvp según el lienzo (contrato 0.37.0) están en la barra superior, como el lienzo; la tecla «/» enfoca la búsqueda.

### Bloque 6: acceso con marca

Las pantallas de acceso las sirve Keycloak, no el portal: el tema `zenit`
vive en `infra/keycloak/themes/zenit/login/` y viaja en la imagen de
identidad. La primera versión (PR #64) sólo traía estilos y textos; desde
la PR #65 las pantallas que el lienzo dibuja tienen su propia plantilla,
para quedar iguales a él. ACC-06, «Confirma que eres tú» antes de descargar
el expediente, usa las mismas plantillas: el cliente del expediente pide la
contraseña y después un código nuevo, aunque la sesión del portal siga
abierta, y las dos pantallas llevan la etiqueta, el título, la cuenta y
«Cancelar y volver a Zenit» del lienzo. El flujo no cambió; el lienzo junta
contraseña y código en una pantalla y Keycloak los pide en dos.

| Archivo | Qué lleva |
| --- | --- |
| `theme.properties` | Hereda del tema `keycloak.v2`, agrega `css/zenit.css` y `js/zenit.js`; sin modo oscuro |
| `login.ftl` | ACC-01 Ingreso y, en la misma página, ACC-05 «¿No puedes entrar?» |
| `login-otp.ftl` | ACC-02 Código |
| `login-config-totp.ftl` | ACC-03 Configurar el segundo factor |
| `login-update-password.ftl` | ACC-04 Crear contraseña |
| `select-authenticator.ftl` | Elegir entre la app y un código de recuperación |
| `zenit.ftl`, `footer.ftl` | Piezas compartidas (contraseña con su botón, errores) y la nota bajo la tarjeta en teléfono |
| `resources/css/zenit.css` | El marco de dos mitades, la tarjeta en teléfono y las clases `za-` de las plantillas |
| `resources/js/zenit.js` | Ver la contraseña, elegir la app del código y marcar los requisitos al escribir |
| `resources/img/` | El logotipo y las palomitas del panel de marca |
| `messages/messages_es.properties` | Los textos; lo que no está ahí sale de la traducción de Keycloak |

El marco (`template.ftl`) y las demás páginas se heredan de Keycloak: códigos
de recuperación, errores y avisos sólo reciben estilos. El panel de marca
viaja en el texto `loginTitleHtml`, que Keycloak sanea: sólo admite etiquetas
de texto con su clase.

**Al subir la versión de Keycloak** hay que comparar las cinco plantillas
propias con las suyas del tema `keycloak.v2` (están en
`org.keycloak.keycloak-themes-<versión>.jar`, carpeta
`theme/keycloak.v2/login/`) y traer los campos o pasos nuevos.
`realm.test.mjs` comprueba que cada plantilla conserve los campos que
Keycloak espera, y las pruebas de identidad recorren ingreso, código, cambio
de contraseña y códigos de recuperación con la imagen construida.

El realm versionado lleva `loginTheme: zenit`. Un realm que ya existe no lo
toma solo: `deploy/servidor/zenit/identidad.mjs` lo pone en cada despliegue
y comprueba que la página de inicio de sesión cargue la hoja del tema. Si
alguien eligió otro tema en la consola, se detiene sin pisarlo.

Lo que cambia respecto al lienzo, y por qué:

- **El código** es un solo campo dibujado como seis casillas. Así se puede
  pegar y el teléfono lo llena solo, que seis campos sueltos no permiten.
- **«¿No puedes entrar?»** se abre dentro de la página de ingreso. «Perdí mi
  teléfono» explica el camino (entrar y elegir «Perdí acceso a mi app»),
  porque el código de recuperación se pide después de la contraseña.
  «Olvidé mi contraseña» manda el enlace por correo sólo si el realm lo
  permite; mientras siga apagado dice que lo pida a quien administra su
  empresa.
- **Crear contraseña** no lleva la etiqueta «Invitación de… · empresa» ni
  saluda por nombre: Keycloak no conoce a quien invitó ni la empresa. Los
  requisitos salen de la política del realm.
- **Configurar el segundo factor** muestra la clave junto al código para
  escanear, como el lienzo; si la política dejara de ser la habitual
  (SHA1, 6 dígitos, 30 segundos) agrega los datos que la app pide. El nombre
  del teléfono sólo se pide cuando la cuenta ya tiene otra app ligada.
  «Primer ingreso» y «Después crearás tu contraseña» no salen al
  reconfigurar desde el perfil.
- **Códigos de recuperación** no está en el lienzo: conserva la página de
  Keycloak con los estilos de Zenit.
- **La tarjeta «Asistencia de hoy 38 / 42»** del panel de marca es un
  adorno con el dato de ejemplo del lienzo, no una cifra real.
- **Ícono de la pestaña:** el portal ya tiene el suyo, con el logotipo del lienzo; las pantallas de acceso conservan el de Keycloak hasta tener los íconos de la marca.

Para verlo en local sin reconstruir la imagen, montar
`infra/keycloak/themes` en `/opt/keycloak/themes` y arrancar Keycloak con
`KC_SPI_THEME_CACHE_THEMES=false` y `KC_SPI_THEME_CACHE_TEMPLATES=false`.

### Portal instalable

TEL-03 y EST-06. El portal se instala en el teléfono o en la computadora y
abre sin red lo último que se consultó, sin escribir nada sin conexión.

| Archivo | Qué lleva |
| --- | --- |
| `web/public/manifest.webmanifest` | Nombre, colores y los íconos |
| `web/public/icons/`, `web/public/favicon.svg` | Íconos con el logotipo del lienzo; se cambian cuando haya marca definitiva |
| `web/public/sw.js` | El service worker: guarda la página y sus archivos al instalarse; las consultas al API van primero a la red y, sin red, responden con lo último guardado |
| `web/src/offline.ts` | Registro del service worker, estado de la red, hora de los datos y la instalación |
| `web/src/Install.tsx` | «En línea · datos de las…» e «Instalar Zenit» al pie del menú, el aviso «Sin conexión», la píldora del teléfono, la invitación a instalar (TEL-03) y «Zenit en este equipo» en Mi perfil |

Reglas:

- **Sólo lectura.** Lo que escribe (resolver, cerrar, exportar) no se guarda
  ni se encola: sin red falla y lo dice. La cola sin conexión sigue siendo
  sólo de la app NFC.
- **No se guarda** el expediente, sus autorizaciones ni los archivos que se
  descargan.
- **Lo guardado se borra** al cerrar sesión y cuando entra otra cuenta en el
  mismo navegador.
- **Abrir sin red** muestra «Sin conexión»: para entrar, Zenit confirma la
  cuenta con el servicio de identidad. Lo que ya estaba abierto se sigue
  viendo sin señal.
- **«Instalar»** sólo aparece cuando el navegador ofrece instalarlo; si no,
  Mi perfil explica cómo hacerlo desde su menú. «Ahora no» en la invitación
  del teléfono no vuelve a insistir en ese navegador.
- `nginx.conf` sirve `sw.js` sin caché, para que una versión nueva llegue en
  la siguiente visita.

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
| `/mi-asistencia` | Ya no existe: lleva al inicio |
| `/empresas`, `/empresas/uso` | Consola de operación: Empresas y Uso del mes |
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
| ~~«En línea · datos de las…», «Instalar Zenit» y sin conexión~~ | **Hecho:** portal instalable ([detalle](#portal-instalable)) |
| ~~Empresa suspendida (EST-02)~~ | **Hecho (contrato 0.36.0):** `/me` trae `access` (`active`, `suspended`, `none`) y, sólo con la empresa suspendida y el acceso vigente, `suspendedTenantName`; `App.tsx` muestra `CompanySuspended` de `States.tsx` |
| ~~Pantallas de acceso con la marca (ACC-01 a 05)~~ | **Hecho:** tema `zenit` de Keycloak ([detalle](#bloque-6-acceso-con-marca)) |
| ~~ACC-06 «Confirma que eres tú» al descargar el expediente~~ | **Hecho:** plantillas del tema ([detalle](#bloque-6-acceso-con-marca)) |

Diferencias deliberadas con el lienzo:

- **Mi asistencia** desde el mvp según el lienzo (contrato 0.37.0) salió del portal, porque el lienzo no la tiene: el trabajador consulta su semana y acusa sus cierres en la app. `/mi-asistencia` lleva al inicio, y quien sólo es trabajador ve que su asistencia está en la app.
- **Marcajes de la ficha.** Desde el MVP según el lienzo (contrato 0.37.0) dicen «Terminal Bodega Norte · tarjeta T-0031», como el lienzo, con `cardLabel` de cada marcaje.
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
- **Panel: «Hoy · Esta semana».** Desde el MVP según el lienzo (contrato 0.37.0) el conmutador del lienzo cambia la primera tarjeta entre la asistencia de hoy y lo trabajado en la semana en curso (`?periodo=semana`).
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
- **Personas: estado en un selector.** Como el lienzo vigente, que también lo pone en un selector junto a la sede.
- **Personas: «Alta reciente»** es quien ingresó en las últimas dos semanas;
  quien ingresa después de hoy dice «Ingresa …».
- **Ficha: la tarjeta** dice desde cuándo la tiene sólo a quien consulta tarjetas (Administración, RH y Auditoría); desde el mvp según el lienzo (contrato 0.37.0) «Ver tarjeta» abre el detalle de esa tarjeta.
- **Alta: la fecha de ingreso** es obligatoria en el API; el formulario la
  llena con hoy. La tarjeta se elige sólo si quien da de alta gestiona
  tarjetas.
- **Horarios: crear abre una ventana**, no un panel lateral: es la regla del
  lienzo para crear algo. Un horario no se edita: se crea otro y se asigna
  desde una fecha.
- **Importar: «Importar CSV»** abre el modal sobre Importaciones
  (`?importar=archivo`), también desde Personas, para que al terminar se vea
  el historial.
- **Importar: aplicar una revisión del historial.** Desde el MVP según el lienzo (contrato 0.37.0) «Revisar y aplicar» la aplica directo si el archivo se revisó en esta visita, como el lienzo. Tras recargar la página pide elegirlo otra vez: el servidor no guarda el archivo y comprueba que sea el mismo por su huella.
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
