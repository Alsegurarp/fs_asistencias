# Estado y pendientes

Qué está hecho, qué falta y qué no se ha verificado. Se actualiza cuando
cambia alguna de las tres cosas.

El avance y lo que falta para cerrar las tareas críticas de jornada, acuse y
respaldo se detallan en la [Bitácora de trabajo](bitacora-trabajo.md).

Última revisión: 19 de octubre de 2026; incluye Android local/HTTPS y el detalle
de personas bloqueadas en corridas, implementado localmente sin desplegar.
La [validación de tareas 1 a 6](validacion-tareas-1-a-6.md)
separa resultados comprobados de decisiones y pruebas manuales pendientes.

La revisión actual y el orden de ejecución están en
[Tareas críticas primero](tareas-criticas-primero.md): incluye comprobaciones
del 18, declaración del 19, bloqueos para datos reales y tareas técnicas que pueden iniciarse.

## Qué está hecho

| Pieza | Estado |
| --- | --- |
| Contrato | Versión 0.12, con 61 operaciones. Incluye detalle paginado de bloqueos por corrida; todavía sin congelar |
| Backend | Atiende las 61 operaciones. Construcción, unitarias y 74 de integración contra PostgreSQL real aprobadas nuevamente el 19, incluido el detalle de corridas interrumpidas y sus reintentos |
| Base | 29 tablas en 8 migraciones, con roles separados para migrar, para atender y para respaldar. V008 conserva bloqueos por persona/corrida. Imagen propia sobre Alpine, sin root ni privilegios, que ordena los textos por código de carácter |
| Identidad | Segundo factor obligatorio en `zenit`. El 18 se preparó el realm para conservar OTP y exigir reautenticación al recuperar contraseña, con cuatro comprobaciones locales incluida importación. SMTP y cuentas personales del servidor siguen pendientes; [procedimiento](preparar-ambiente-compartido.md) |
| Entorno local | Se levanta con dos comandos, sin credenciales por omisión |
| Simulador de dispositivo | Llena una empresa con personas, dispositivos y marcajes firmados, sin la app |
| Respaldo | Modos age y autoprueba aprobados. El 18 de octubre pasó recuperación local con origen apagado: 130 tablas/1.867 filas idénticas, contraseñas nuevas de base, backend e identidad funcionales. [Detalle](recuperacion-servicio.md). Copia externa de operación, custodia, programación y recuperación pública pendientes |
| Vulnerabilidades | Inventario y análisis de las cinco imágenes. Ninguna tiene una alta o crítica sin atender: cuatro no tienen ninguna y la del proveedor de identidad tiene seis, aceptadas por escrito |
| Portal | PKCE, `/me`, sedes, empleados, horarios/asignaciones, importación CSV, tarjetas, dispositivos, configuración de empresa, incidencias, cierres, exportes y usuarios; el operador tiene alta/listado de empresas. El 19 pasaron compilación y 151 pruebas. Incluye personas bloqueadas por corrida, causas, paginación y enlaces a incidencias. Horarios e importación también pasaron por API HTTPS con sesión real; sigue pendiente su recorrido de pantallas. Configuración y detalle de bloqueos están implementados y probados localmente, sin desplegar. Llama 42 operaciones distintas, todas presentes en el contrato; nginx y proxy comprobados localmente |
| App Android | Enrolamiento, firma ES256 con Keystore, cola cifrada, sincronización, recibos y renovación. El 19 pasaron 9 pruebas unitarias, lint y APK debug/de instrumentación. Personal y terminal pasaron contra backend local y HTTPS publicado en Samsung SM-S928B (API 36), con cola entre procesos, reenvío sin duplicados y limpieza. El fixture anterior y el rechazo de argumentos incompletos también pasaron. Release no repetido. Sus 3 operaciones existen en el contrato |
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
| Completar el portal | Configuración de empresa ya está implementada y probada localmente. Faltan desplegarla, suspender/reactivar empresas y la pantalla del trabajador; los recorridos del navegador y permisos con sesiones de otros roles siguen abiertos |
| Completar y validar la app | Enrolamiento y sincronización comprobados contra backend local y HTTPS publicado con datos ficticios. Faltan semana y acuse y la captura autenticada con tarjetas reales |
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
faltan despliegue y aceptación en navegador real. Los históricos anteriores
a V008 conservan sólo sus conteos.

### Esperan una decisión

Suspensión, baja, alcance del supervisor y tipo de marcaje tienen
[propuestas concretas para aprobación](decisiones-de-negocio.md). No se han
cambiado sus comportamientos ni se consideran decisiones cerradas.

| Pendiente | Qué hay que decidir |
| --- | --- |
| Suspensión de una empresa | Hoy también corta la captura de marcajes. Antes del primer cliente hay que decidir si una empresa suspendida conserva la captura, porque el registro de asistencia es obligación suya |
| Verificación automática en cada cambio | Workflow integrado en `main` el 19. Los cuatro trabajos aprobaron para el último commit de `avanceLunes` (ejecución 39301664714), incluidos backend/identidad y análisis de las cinco imágenes. La obligatoriedad de trabajos requiere una decisión adicional |
| Alcance del supervisor | Cómo se le asignan sus sedes. Hoy ve y atiende lo de toda su empresa |
| Baja de una persona | Si además revoca su tarjeta y cierra su horario |
| Comparar la jornada con el horario | Qué cuenta como retardo, falta y salida anticipada |
| Tipo de marcaje | Si la persona lo declara, el servidor lo deduce, o las dos cosas como hoy |
| Ausencias | Cómo tratar vacaciones e incapacidades, para no cerrar en ceros |
| Otra plantilla de exporte | Según lo que pida la nómina del primer cliente |
| Dónde vive el archivo de un exporte | Hoy en la base, unos minutos; la alternativa es un almacén de objetos |
| Versión 1.0 del contrato | Cuándo deja de cambiar sin aviso. El portal y la app llaman 45 de las 61 operaciones; falta completar recorridos reales y confirmar las decisiones de esta tabla |

### Dependen de algo externo

| Pendiente | De qué depende |
| --- | --- |
| Tarjeta real y entrega de su clave al dispositivo | Prueba con tarjetas y teléfonos reales |
| Cálculo por tipo de jornada | Revisión jurídica |
| Conector para sincronizar el padrón | El sistema del primer cliente |
| Servicio de correo en la identidad | Un dominio de envío. Sin él no hay verificación automática del correo ni recuperación de contraseña |
| Cuentas personales en la consola de identidad | Antes de cualquier ambiente compartido: hoy hay una cuenta temporal |
| Staging y TLS | Hecho el 18 de octubre de 2026: un ambiente publicado con HTTPS. Falta decidir si habrá un segundo ambiente separado para pruebas |
| Guardar y restaurar una copia cifrada de operación | Consultar con Gabriel quién custodia la clave privada y dónde queda su copia aislada, por indicación de Alexis. El 18 se comprobó una copia local con claves de ensayo, eliminadas al terminar; no sustituye una copia recuperable de operación |
| Destino externo y recuperación completa del servicio | Aprobados copia diaria, retención 30 días, pérdida máxima 24 h y recuperación 4 h; fallos a cargo de fastSolution. Destino en otro servidor por identificar, probablemente mediante VPN; SSH al origen exclusivamente por Gabriel. Faltan custodia, automatización y comprobación de recuperación pública |
| Cuotas compartidas entre instancias | La dirección real del visitante ya llega al backend a través del borde y del portal, y el límite de activaciones fallidas cuenta a cada visitante por separado. Compartir las cuotas sólo hace falta con más de una instancia |

## Vulnerabilidades conocidas

Último análisis local: 19 de octubre de 2026, con la base de ese día. Se detectaron
y corrigieron altas nuevas en backend y portal. IDs y resultados en
`build/security/summary.json`; cómo repetir está en
[Verificaciones automáticas](verificaciones-automaticas.md). Falta identificar
y analizar las imágenes efectivamente publicadas, mediante Gabriel.

| Imagen | Al empezar | Ahora | Altas y críticas que quedan |
| --- | --- | --- | --- |
| Backend | 66, con 3 críticas y 18 altas | 15, todas medias | Ninguna |
| Portal | 7, con 2 altas | 4, todas medias | Ninguna |
| Base | 466, con 11 críticas y 118 altas | 4, todas medias | Ninguna |
| Herramientas de respaldo | 20, con 2 críticas y 10 altas | 6: 4 medias y 2 de gravedad desconocida | Ninguna alta o crítica |
| Proveedor de identidad | 64, con 6 altas | 65: 30 medias, 29 bajas y 6 altas exceptuadas | 6 altas, aceptadas por escrito |

Las cinco entradas del resumen local están aprobadas. Las correcciones todavía
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
- El recorrido completo del portal contra Keycloak y el backend real: el usuario
  comprobó acceso, catálogos, incidencias, cierres, descarga y usuarios. Horarios
  e importación con sesión real siguen pendientes; se preparó su guion.
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
| 4 | Probar horarios e importación con sesión real en el portal | API HTTPS aprobada el 19 con sesión de administración y limpieza. Siguen las pantallas, otros roles, renovación y cierre de sesión; no hay navegador conectado al control UI |
| 7 | Probar enrolamiento, captura simulada, cola sin conexión, sincronización y renovación Android contra el backend local | Completada el 19 también por HTTPS en teléfono: personal y terminal, tres fases por modalidad y limpieza. Autoensayo y guion versionados; no acredita NFC real ni apagar físicamente las radios |
| 8 | Definir e implementar retención de sobres y recibos Android | Acordar qué se conserva y durante cuánto tiempo; proteger pendientes y evidencia |
| 9 | Completar configuración de empresa en el portal | Implementada: consulta para cuatro roles, edición sólo de administración, cambios parciales, cierre automático anulable y conservación ante errores/refrescos. 148 pruebas del portal y compilación aprobadas; falta despliegue y aceptación en navegador |
| 10 | Mostrar las personas que no pudieron cerrar y sus causas | Implementada y validada localmente: causas e incidencias por persona, paginación, aislamiento y conservación en corridas parciales/reintentos. Sin desplegar ni aceptar en navegador real |
| 11 | Automatizar verificaciones en cada cambio | Workflow integrado en `main` el 19; cuatro trabajos aprobados en `avanceLunes` (ejecución 39301664714). La obligatoriedad de trabajos requiere una decisión adicional |
| 12 | Completar semana y acuse del trabajador | Integrar datos reales, identidad y permisos; el texto y evidencia del acuse dependen también de la tarea 17 |
| 13 | Completar pantallas del operador del servicio | Alta y listado de empresas implementados; faltan suspender/reactivar y comprobar permisos y aislamiento con sesión real. La regla de suspensión depende de la decisión de negocio |
| 14 | Publicar ambiente de pruebas con TLS, SMTP y cuentas personales | Publicado con TLS el 18 de octubre de 2026 ([Despliegue en el servidor](despliegue-en-servidor.md)). Faltan correo, cuentas personales, quién opera el servicio y el acceso con sesión por HTTPS; retirar la cuenta temporal sólo tras verificar las nuevas |
| 15 | Comprobar recuperación completa y automatizar respaldos externos | Recuperación local comprobada. Política diaria/30 días, objetivos 24 h/4 h y atención por fastSolution aprobados; SSH por Gabriel y destino en otro servidor. Faltan custodia, concretar destino, automatizar y comprobar recuperación pública; [detalle](recuperacion-servicio.md) |
| 16 | Validar captura autenticada con tarjetas reales | Definir y probar autenticación y entrega de claves con tarjetas y teléfonos físicos |
| 17 | Aprobar e implementar reglas de jornada y evidencia del acuse | Dictamen profesional, criterios y casos esperados; conservar reglas y cierres históricos |
| 18 | Comparar asistencia con horarios y gestionar ausencias | Definir retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y probar |
| 19 | Validar carga y comportamiento del despliegue | Volumen del cliente, proxy, dirección real, trabajos y cuotas; compartir cuotas si habrá varias instancias |
| 20 | Construir conector y adaptar exporte a nómina real | Sistema y formato del primer cliente; aceptación del archivo y sincronización |

Siguen diferidos jOOQ generado, notificaciones y un almacén externo para exportes;
no forman parte de las tareas completadas. Las verificaciones adicionales de
Linux, datos grandes, escrituras simultáneas, teléfono, release y otros casos
siguen abiertas donde se indican en **Sin verificar** y en la validación.

### Primer paso por área

| Quién | Primer paso sugerido |
| --- | --- |
| App | Verificar enrolamiento y marcajes con tarjeta simulada contra el ambiente publicado, como dice [Conectar la app al ambiente publicado](guia-app-android.md#conectar-la-app-al-ambiente-publicado). Después, semana y acuse; la tarjeta real requiere su prueba externa |
| Portal | Completar las pantallas de horarios/importación y Configuración con sesión real; su API y pruebas locales ya pasaron. Después, suspensión/reactivación y trabajador |
| Backend | El detalle de bloqueos por corrida ya está implementado y probado junto con el portal; faltan despliegue y aceptación real. jOOQ generado sigue diferido; las reglas de negocio esperan sus decisiones |

El portal ya no depende de la app para tener datos: el simulador deja
jornadas, incidencias de cuatro tipos y semanas que se pueden cerrar.
