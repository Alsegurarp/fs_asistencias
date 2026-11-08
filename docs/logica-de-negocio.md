# Lógica de negocio

Las reglas que el servidor aplica. Quien construye la app o el portal no las
vuelve a implementar: las conoce para explicar al usuario lo que el servidor
decidió.

Lo marcado como **provisional** se construyó con un supuesto razonable y puede
cambiar cuando el equipo o la asesoría jurídica lo decidan. Está reunido al
final.

Las propuestas de suspensión, baja, alcance del supervisor y tipo de marcaje
fueron aprobadas durante la ejecución del 5 de noviembre de 2026 y están
implementadas en el repositorio (API candidata 0.18.0, V012/V013).
Se registran en [Decisiones de negocio](decisiones-de-negocio.md).

## Principios

1. **El servidor decide.** El dispositivo declara lo que vio; el servidor
   decide el tipo de marcaje, el veredicto de ubicación y si hay incidencia.
2. **La evidencia no se edita.** Un marcaje se guarda tal como llegó, firmado.
   Corregir la jornada agrega un ajuste aparte; no cambia el marcaje.
3. **Lo dudoso se acepta y se revisa.** Un marcaje raro no se pierde: se
   guarda con una incidencia que una persona atiende. Sólo se rechaza lo que
   no puede atribuirse a nadie.
4. **Nada sanciona solo.** Las incidencias y las alertas informan. Quien
   decide es una persona, con su motivo.
5. **Cada empresa ve sólo lo suyo.** Lo de otra empresa responde 404, como si
   no existiera.
6. **Nada se borra.** Se desactiva, se revoca, se da de baja o se reabre. Lo
   único que se quita es un rol, y queda en la bitácora.

## Empresas, personas y acceso

- Una persona pertenece a una sola empresa. Su correo y su cuenta no se
  repiten entre empresas.
- El token dice quién es la persona. Su empresa y sus roles salen de la base
  en cada petición: un rol que se quita deja de valer de inmediato.
- Se entra por invitación a un correo. La primera vez que alguien entra con
  ese correo verificado queda ligado a la invitación.
- Los operadores son una lista de correos que vive en un secreto del
  servidor. Mientras esté vacía, nadie puede dar de alta una empresa.
- Una empresa no puede quedarse sin nadie que la administre: quitar el rol o
  el acceso a su último administrador responde 409 `last_admin`.
- Una empresa suspendida queda cerrada para gestión, consultas personales,
  acuses y nuevas vinculaciones: sus personas dejan de tener roles y sus
  códigos de enrolamiento dejan de canjearse. Sus dispositivos activos ya
  vinculados conservan renovación de sesión, captura y sincronización. El cierre
  programado deja de pasar y una corrida de cierre pendiente termina como
  fallida. No se borra ni se cambia nada más: al reactivarla, todo sigue como
  estaba. La suspende y la reactiva quien opera el servicio, con un motivo
  que queda en la bitácora de la empresa.
- La liga entre una persona y su cuenta se puede soltar. La persona vuelve a
  quedar invitada, con sus roles y su fila del padrón, y se liga otra vez al
  entrar con ese correo verificado. Soltarla no quita el acceso: la cuenta
  anterior, si todavía existe, también puede volver a ligarse. Quien estaba
  sin acceso sigue sin acceso.
- Cada persona tiene una cuota de peticiones por minuto, sumando todas sus
  sesiones. Al pasarla recibe 429 en cualquier ruta, sin que la petición
  llegue a ejecutarse. Los dispositivos tienen la suya aparte, en la captura.
- Una cuenta de trabajador se liga con una sola fila del padrón, y una fila
  con una sola cuenta. La liga quien administra.

## Padrón, sedes, horarios y tarjetas

- Una persona es única por su identificador externo dentro de la empresa.
- Una sede tiene una geocerca circular: una coordenada y un radio de 20 a
  2000 metros.
- Un horario no se edita. Para cambiarlo se crea otro con su vigencia y se
  asigna desde una fecha; asignarlo cierra el anterior el día previo.
- Importación por archivo: primero valida y reporta cada fila rechazada con
  su línea; sólo con `dryRun=false` aplica. Repetir el archivo no duplica a
  nadie. El archivo no se guarda: quedan su nombre, su huella y los conteos.
- El historial de importaciones (`GET /imports`) va de la más reciente a la
  más antigua, con el nombre del archivo y de quien lo subió. Aplicar una
  revisión anterior pide volver a subir el archivo con `reviewedImportId`: el
  servidor compara su huella con la de la revisión y lo rechaza si cambió
  (`review_mismatch`). Cada revisión se aplica una sola vez, también con dos
  peticiones a la par, y la revisión aplicada apunta a la importación que la
  aplicó (`appliedByImportId`).
- Una tarjeta entra al inventario con su número impreso y su huella. La
  huella no sale en ninguna respuesta.
- Sólo se asigna una tarjeta del inventario. La que ya tuvo titular no pasa a
  otra persona. Asignar una segunda tarjeta a alguien reemplaza la anterior en
  la misma operación.
- Dar de baja exige fecha efectiva no futura, revoca la tarjeta y termina el
  horario aplicable; conserva las asignaciones históricas y futuras. No se
  puede borrar la fecha mientras siga inactiva. Reactivar no recupera tarjeta
  revocada ni horarios terminados: requieren nuevas asignaciones.
- Una evidencia offline anterior a la baja puede sincronizar si su asignación
  histórica de tarjeta y fecha eran válidas; la revocación no autoriza marcas
  nuevas. Se conserva también el recibo de un rechazo.
- El supervisor sólo consulta/atiende sedes asignadas por administración; sin
  asignaciones no obtiene datos de supervisión. Una semana que mezcla evidencia
  ajena a esas sedes se deniega completa, sin entregar totales parciales.
  Administración/RH conservan su alcance; combinar auditor y supervisor permite
  lectura global de auditor, pero no amplía escrituras de supervisión.

### Búsqueda y filtros del padrón

Personas, tarjetas y lectores se buscan y filtran en el servidor, antes de
paginar, con el alcance por sede de supervisión:

| Lista | `q` busca en | Otros filtros | Conteos |
| --- | --- | --- | --- |
| Personas | nombre e identificador externo | estado, sede, horario vigente, sin tarjeta | `GET /employees/summary`: por estado, por horario, sin tarjeta y sin horario |
| Tarjetas | etiqueta, y nombre y número de quien la tuvo por última vez | varios estados a la vez | `GET /cards/summary`: por estado |
| Lectores | etiqueta, modelo y nombre de la persona del teléfono | modo, varios estados, sin señal | `GET /devices/summary`: activos, sin señal, revocados y reemplazados |

`q` busca por fragmento y sin distinguir mayúsculas ni acentos del español,
con la función `search_key` de la base; un `%` o un `_` se buscan tal cual.
Los conteos de estado no aplican el filtro de estado, para rotular cada
opción. Un lector está **sin señal** si está activo y no tuvo contacto en las
últimas 24 horas, o nunca: el mismo umbral del panel (`DeviceSignal`).

Cada persona trae la etiqueta de su tarjeta vigente; cada tarjeta, a quien la
tiene hoy y a quien la tuvo por última vez, con nombre y número, aunque ya
esté perdida o revocada; cada teléfono personal, el nombre de su persona.

El buscador del portal combina las tres listas con `q` y un límite corto: tres
llamadas fijas, nunca una por resultado. Supervisión sólo busca personas,
porque tarjetas y lectores no son de su rol.

**Medición** con 5 000 personas, 5 000 tarjetas y 2 000 importaciones, en
contenedor local: cada lista de 50 y cada conteo de tarjetas, lectores e
importaciones respondió en menos de 25 ms; buscar personas, en 10 a 40 ms
(40 cuando ninguna coincide y se revisan todas), y sus conteos con búsqueda en
unos 65 ms. Si una empresa pasa de unas 10 000 personas, el siguiente paso es
guardar el texto de búsqueda en una columna calculada con índice de
trigramas.

## Dispositivos

- Un dispositivo no tiene cuenta. Se enrola con un código de un solo uso que
  vale 15 minutos, y registra su propia clave P-256.
- La modalidad se fija al emitir el código y no cambia:
  - `personal`: ligado a una persona; sólo acepta la tarjeta de su titular.
  - `terminal`: ligado a una sede; acepta cualquier tarjeta activa de su
    empresa.
- Una persona tiene un teléfono personal activo a la vez: el nuevo reemplaza
  al anterior.
- Cada petición del dispositivo lleva una aserción que firma él mismo, con
  vida de hasta dos minutos. El servidor tolera un minuto de desfase de reloj.
- Revocar un dispositivo invalida su clave y conserva sus marcajes.

## Captura

### Qué se rechaza

Un rechazo viene con recibo, queda guardado y no se reintenta: reenviar el
mismo sobre devuelve el mismo rechazo.

| Código | Cuándo |
| --- | --- |
| `payload_invalid` | El sobre no es un JWS válido o su carga no cumple el contrato: campos de más, tipos distintos, zona horaria desconocida |
| `signature_invalid` | El sobre no está firmado por este dispositivo |
| `session_invalid` | La sesión no es de este dispositivo, el consecutivo ya se usó, o la sesión excedió lo que vale sin conexión |
| `too_old` | El marcaje tiene más de 72 horas |
| `card_unknown` | La tarjeta no está registrada, no tiene titular, es de otra empresa, o su esquema todavía no se verifica |
| `card_revoked` | La tarjeta ya no está activa, o su titular está dado de baja |
| `card_not_owner` | Un teléfono personal leyó la tarjeta de otra persona |

### Sesión y trabajo sin conexión

- Abrir una sesión cierra la anterior. Cada marcaje lleva un consecutivo que
  empieza en 1 y no se repite dentro de la sesión.
- Una sesión vale 72 horas o 1000 marcajes sin conexión. Un marcaje observado
  después de ese plazo, o con un consecutivo mayor, se rechaza.

### Qué tipo de marcaje es

**Provisional.** El dispositivo puede declarar el tipo; si no lo declara, el
servidor lo deduce de la marca anterior de esa persona.

| Política de la empresa | Sin declarar, la secuencia es |
| --- | --- |
| `not_considered`: la comida no se considera | entrada, salida, entrada, salida… |
| `marked`: la comida se marca | entrada, inicio de descanso, fin de descanso, salida |

- Una declaración válida corrige lo deducido. Donde la comida no se considera,
  declarar un descanso no cuenta.
- Dos lecturas de la misma persona en menos de un minuto son una sola marca:
  la segunda se guarda con la incidencia `duplicate` y no abre ni cierra nada.
- Después de 16 horas sin marcar, la siguiente marca empieza una jornada
  nueva y la anterior queda sin salida.
- Lo que no cuadra con la secuencia se guarda con la incidencia
  `missing_pair`.

### Cambio de la política de comida

La política no cambia al instante: cambiarla a mitad de semana convertiría
una entrada y una salida ya hechas en inicio y fin de comida, movería horas y
abriría incidencias que nadie causó.

- La programan quien administra la empresa o quien opera el servicio, con un
  motivo de 10 a 500 caracteres. La fecha no se elige: entra el primer día de
  semana de la empresa dentro de la siguiente quincena (del 1 al 15 o del 16
  al fin de mes), con al menos 7 días de aviso contados hasta ese día; si no
  alcanzan, pasa a la quincena que sigue. Con semana desde el lunes,
  programada el viernes 30 de octubre de 2026 entra el lunes 16 de noviembre;
  el martes 10 de noviembre, el lunes 7 de diciembre; el viernes 27 de
  noviembre, el lunes 7 de diciembre.
- Hay a lo más un cambio pendiente, y nunca hacia la política que ya tiene.
  Se puede cancelar antes de que entre; uno que ya entró se corrige
  programando otro.
- La política de una fecha es la del último cambio no cancelado que ya entró;
  sin ninguno, la del alta. Cada marca usa la del día en que se hizo, aunque
  llegue después sin red, y cada semana la de su primer día. Como el cambio
  entra en un inicio de semana, ninguna semana mezcla dos políticas.
- Mientras está pendiente, el portal y la app avisan a las personas, y el
  inicio de semana de la empresa no se puede cambiar (409
  `break_policy_change_pending`).
- Programar y cancelar quedan en la bitácora de la empresa, y el historial de
  cambios viaja en el expediente de la empresa (`break_policy_change`).

### Ubicación

Una terminal se evalúa contra su sede; un teléfono personal, contra la sede de
su titular.

| Situación | Veredicto | Incidencia |
| --- | --- | --- |
| Dentro del radio | `inside` | Ninguna |
| Fuera del radio, con precisión mejor que el radio | `outside` | `foreign_site` |
| Precisión peor que el radio, o ubicación simulada | `inconclusive` | `location_inconclusive` |
| Sin ubicación | `not_evaluated` | `location_inconclusive` |
| La persona no tiene sede | `not_evaluated` | Ninguna |

Quien marca en la terminal de una sede que no es la suya también abre
`foreign_site`. La coordenada se guarda y no sale en ninguna lista: el portal
recibe el veredicto y la precisión.

### Tiempo

| Situación | Incidencia |
| --- | --- |
| El marcaje llega más de 24 horas después de ocurrido | `late_sync` |
| El marcaje llega cuando la semana de esa persona ya está cerrada | `late_sync` |
| La hora del dispositivo va más de 5 minutos adelante de la del servidor | `clock_anomaly` |
| Entre dos marcas de una sesión, el reloj de pared y el reloj monotónico del teléfono difieren más de 5 minutos | `clock_anomaly` |

### Repetir un envío

La misma clave de idempotencia devuelve el mismo recibo, sin guardar nada
nuevo. La misma clave con otro sobre responde 409.

## Jornada

La semana de una persona no se guarda: se calcula de sus marcajes cada vez que
se pide, hasta que se cierra.

- Los marcajes se leen en el orden en que ocurrieron y su tipo se vuelve a
  deducir con la misma regla de captura. Por eso el tipo que muestra un tramo
  puede diferir del que el marcaje recibió al llegar, si llegó en desorden.
- Un **tramo** va de un marcaje al siguiente que lo cierra: de trabajo
  (`work`) o de descanso (`break`). El descanso no cuenta como trabajo.
- Un tramo sin el marcaje que lo cierra queda abierto y no suma.
- La semana empieza el día que la empresa eligió, en su zona horaria.
- **Provisional:** un turno pertenece al día y a la semana en que empieza,
  aunque termine después.
- **Provisional:** se aplican las reglas vigentes en el último día de la
  semana.

### Topes

Los topes son filas con vigencia y fuente, no constantes del código. La tabla
nace con el calendario de reducción de la jornada en México.

| Año | Jornada semanal ordinaria | Tiempo extraordinario semanal |
| --- | --- | --- |
| 2026 | 48 horas | 9 horas |
| 2027 | 46 horas | 9 horas |
| 2028 | 44 horas | 10 horas |
| 2029 | 42 horas | 11 horas |
| 2030 en adelante | 40 horas | 12 horas |

El máximo diario combinado, ordinario más extraordinario, es de 12 horas.

La implementación del 5 de noviembre carga topes diarios diurno/nocturno/mixto,
clasifica el periodo nocturno real (desde 3.5 h nocturnas se trata como nocturno)
y cuenta extra diaria y semanal sin duplicar minutos. V013 agrega versiones
de regla desde el 1 de mayo de 2026 para los límites de distribución: cuatro
horas extra diarias y cuatro días semanales. Los cierres previos conservan
sus reglas y snapshot. Siguen pendientes horario contractual, computabilidad
de comida, menores y transiciones de vigencia; no es liquidación de nómina.

### Totales y alertas

- `workedMinutes`: suma de los tramos de trabajo cerrados.
- `overtimeMinutes`: exceso por máximo diario según el tipo de jornada más
  exceso semanal de tiempo ordinario, sin volver a contar la extra diaria.
- `ordinaryMinutes`: lo trabajado menos lo extraordinario.
- `breakMinutes`: suma de los tramos de descanso.

| Alerta | Gravedad | Cuándo |
| --- | --- | --- |
| `open_segment` | `warning` | Hay un tramo sin cerrar |
| `weekly_overtime` | `info` | Hay extra por máximo diario o semanal |
| `daily_ordinary_limit_exceeded` | `info` | Jornada sobre su máximo diario ordinario |
| `daily_overtime_limit_exceeded` | `critical` | Extra por encima del máximo diario de la regla vigente |
| `overtime_days_limit_exceeded` | `critical` | Se supera el número de días con extra de la regla |
| `weekly_total_overtime_limit_exceeded` | `critical` | Se supera el tope semanal y sus cuatro horas adicionales |
| `break_computability_unverified` | `warning` | Falta acreditar si la pausa registrada debe contarse como trabajo |
| `weekly_overtime_limit_exceeded` | `critical` | El tiempo extraordinario pasa de su tope semanal |
| `daily_combined_limit_exceeded` | `critical` | Los turnos que empiezan un día suman más de 12 horas |

El cálculo distingue jornada diurna, nocturna y mixta. La comparación con
horario asignado y la gestión de vacaciones/incapacidades siguen pendientes:
no hay todavía retardos ni faltas operativas. Un descanso no reinicia la
jornada ni cambia su atribución de día/semana al cruzar medianoche.

### Asistencia de la empresa

La tabla de asistencia (`GET /attendance/weeks`) y los totales del panel
(`GET /attendance/summary`) usan el mismo cálculo que la semana de una
persona: no pueden dar números distintos.

- **Quién entra a la semana:** las personas activas y las que marcaron esa
  semana, igual que en un cierre. El orden es el del padrón.
- **Semana cerrada:** se toma lo que congeló el cierre, no se recalcula.
- **Turno en curso:** el último tramo abierto, si empezó hace menos de la
  separación entre turnos (16 horas por omisión). La persona está `on_shift`
  o, si es un descanso, `on_break`.
- **Falta la salida:** un tramo abierto que ya no es el turno en curso. Cuenta
  en `week.missingExit` y pone a la persona en «requiere revisión».
- **Requiere revisión** (`attention=alerts`): una incidencia abierta en la
  semana, una alerta `warning` o `critical`, o un tramo con salida faltante.
  La alerta `open_segment` del turno en curso no cuenta: sólo dice que la
  persona todavía no sale.
- **Hoy:** sólo existe en la semana que contiene el día de hoy de la empresa.
  `no_entry` quiere decir que hoy no marcó y no está en turno; no compara
  contra su horario, porque la comparación con el horario sigue pendiente.
- **Supervisión:** sólo ve a las personas de sus sedes, y no ve la semana de
  quien marcó esa semana en una sede ajena, como en los cierres. Los totales
  del panel cuentan a las mismas personas que ve en la tabla.
- **Lectores sin señal:** activos que no han dado señal en 24 horas. El panel
  no los cuenta para quien no consulta dispositivos.

El cálculo lee marcajes, ajustes, incidencias y cierres de hasta 200 personas
por consulta. Con 300 personas y una semana completa, medido en el entorno de
pruebas el 7 de noviembre de 2026: una página de 50 en unos 30 ms, una de 200
en unos 50 ms y los totales del panel en unos 90 ms. No hay caché: cuando una
empresa crezca al punto de que eso no alcance, el siguiente paso es guardar
los totales de la semana al recibir cada marcaje, no recalcularlos.

## Incidencias

Una incidencia nace abierta cuando un marcaje tiene algo que revisar.

| Tipo | Gravedad con la que nace |
| --- | --- |
| `clock_anomaly` | Alta |
| `missing_pair`, `location_inconclusive`, `foreign_site` | Media |
| `duplicate`, `late_sync`, `outside_window` | Baja |

Hoy nada abre `outside_window`: está reservada para cuando la jornada se
compare con el horario.

Atenderla:

- Se asigna sólo a quien puede resolverla, o a nadie: una persona con acceso
  vigente y con rol de administración o RH, o de supervisión con la sede de
  la incidencia entre sus sedes. Sin sede, sólo administración o RH.
  `GET /incidents/{incidentId}/assignees` da exactamente esa lista, con nombre
  y roles y sin correo, para que RH y supervisión asignen sin leer los
  usuarios. Asignar guarda quién y cuándo; quitar la asignación lo borra.
- Se resuelve con una decisión y un motivo de 10 a 500 caracteres:
  `justified`, `confirmed` o `adjusted`.
- `adjusted` lleva un ajuste, y cada clase trae lo suyo y nada más:

  | Clase | Lleva | Efecto |
  | --- | --- | --- |
  | `add_event` | `eventType` y `occurredAt` | Agrega un marcaje que faltó |
  | `exclude_event` | `eventId` | Deja fuera del cálculo un marcaje |
  | `retype_event` | `eventId` y `eventType` | Cambia el tipo de un marcaje |

- El marcaje de un ajuste tiene que ser de la misma persona de la incidencia.
- Lo resuelto no se reasigna ni se vuelve a decidir.
- Una semana cerrada no admite ajustes: primero se reabre.

Cada ajuste sube en uno la versión de los tramos de esa semana.

### Bloquear un cierre

Una incidencia **bloquea un cierre** (`blocksClosure`) mientras sigue
abierta, su semana ya terminó y esa persona no tiene esa semana cerrada: es
lo que impide cerrarla. La semana es la de la empresa, en su zona y con su
día de inicio vigente, así que se calcula al consultar con la función
`week_start_of` de la base. Una abierta de la semana en curso todavía no
bloquea, porque esa semana aún no se puede cerrar; una abierta en una semana
ya cerrada tampoco, porque para corregirla hay que reabrir.

### Lista y conteos de incidencias

Todo filtro se aplica en el servidor, antes de paginar y con el alcance por
sede de supervisión: estado, tipo, sede, semana, severidad, asignación
(`me`, `unassigned`, `assigned`) y `blocksClosure`. El orden lo elige
`sort`: `opened` (de la más antigua a la más reciente), `severity` (la más
grave primero) o `resolved` (la resuelta más recientemente primero, sólo con
`status=resolved`). Un cursor vale sólo para el orden con el que se pidió.

`GET /incidents/summary` da los conteos de la pantalla en dos consultas, con
el mismo alcance y los filtros de contexto (tipo, sede y semana): abiertas,
sin asignar, mías, por severidad y las que bloquean; resueltas en total y en
la semana en curso.

Cada incidencia trae los nombres de la persona, de quien la tiene asignada,
de quien la asignó y de quien la resolvió, y la hora del marcaje que la
abrió (`occurredAt`). El historial completo de una incidencia sigue en la
bitácora, que sólo ven administración y auditoría.

**Medición** con 30 000 incidencias (847 abiertas), 300 personas, un año de
cierres y 50 000 acciones en la bitácora, en contenedor local: cada lista de
50 y cada conteo de incidencias y de cierres respondió en menos de 30 ms de
mediana, y la bitácora de 200 con nombres en 13 ms.

## Cierre semanal

- Sólo se cierra una semana que ya terminó, en la zona horaria de la empresa.
- Sin sede ni lista, entran las personas activas y las que marcaron esa
  semana. **Provisional:** quien no marcó se cierra en ceros.
- No se cierra a quien tiene una incidencia abierta o un tramo sin cerrar. A
  un tramo sin cerrar que no tiene incidencia, el cierre le abre una
  `missing_pair`, para que haya algo que resolver.
- Cerrar congela el cálculo completo de la persona, con su huella y con la
  versión de reglas usada. Una semana cerrada se entrega tal como se congeló.
- Cerrar otra vez no crea nada: devuelve los mismos cierres.
- El cierre directo responde en la misma petición y admite hasta 500
  personas. Para más, o para no esperar, se pide una corrida de cierre: un
  trabajo cierra a cada persona por separado, sin tope. Lo que ya se cerró
  sigue cerrado aunque la corrida se interrumpa, y un nuevo intento retoma lo
  que faltó. Sólo hay una corrida en curso por semana y alcance.
- **Cierre programado.** Una empresa puede pedir que el sistema cierre cada
  semana cierto número de horas después de que termina. Nace apagado. El
  sistema pasa una vez por semana, cierra a quien no tiene nada pendiente y
  no vuelve a pasar: a los demás los cierra una persona. Un cierre del
  sistema no tiene persona que lo haya cerrado. Al encenderlo, la última
  semana terminada se cierra en la siguiente revisión si ya pasó el plazo.
- Reabrir pide motivo y conserva la versión cerrada. El siguiente cierre crea
  la versión siguiente.
- Un marcaje que llega de una semana cerrada se guarda y abre una incidencia;
  el cierre no cambia solo.
- La lista de cierres de una semana filtra en el servidor por sede de la
  persona, estado (`closed`, `reopened`) y acuse (`agreed`, `objected` o
  `none`, sin acuse), y trae el nombre de la persona y de quien cerró.
  `GET /week-closures/summary` cuenta cerrados, reabiertos, personas
  bloqueadas y acuses de los cierres vigentes. Las personas bloqueadas salen
  de las incidencias que bloquean: su lista es
  `GET /incidents?week=…&blocksClosure=true`.

## Acuse del trabajador

- El trabajador dice si está conforme (`agreed`) o lo objeta (`objected`),
  con una nota opcional.
- Uno por versión de cierre. Si la semana se reabre y se vuelve a cerrar, la
  versión nueva nace sin acuse y la anterior conserva el suyo.
- Sólo el del propio trabajador: el cierre de otra persona no existe para él.
- Un cierre reabierto no se puede acusar.

El acuse es una manifestación registrada sobre el resumen; la huella la
calcula el servidor. No se acredita automáticamente una firma avanzada ni
el acuerdo exigido para el registro electrónico. Véase la
[revisión documental del acuse](revision-juridica-jornada-acuse.md#acuse-evidencia-disponible-y-lo-que-falta).

## Exportes

- Sólo exportan cierres vigentes. Quien no está cerrado no entra al archivo.
- Pedirlo lo encola; lo prepara un trabajo. Si entre pedirlo y prepararlo los
  cierres se reabrieron, queda como `failed`.
- El archivo se puede descargar durante quince minutos, una sola vez y con
  credencial. Después se descarta. Quedan la huella del archivo y la del
  manifiesto.
- El manifiesto declara la huella del archivo y la de cada cierre que entró:
  liga lo exportado con lo cerrado. Se guarda una vez y se puede leer siempre,
  también cuando el archivo ya no existe. Se entrega byte por byte como se
  guardó, de modo que su propia huella se puede volver a calcular.
- **Provisional:** la plantilla del archivo trae una fila por cierre con sus
  totales. No trae el detalle por día.

## Bitácora

Las acciones administrativas quedan en una bitácora que sólo se agrega: altas,
invitaciones, cambios de rol, sedes, horarios, tarjetas, dispositivos,
incidencias, cierres, corridas de cierre, acuses, exportes, y la suspensión o
reactivación de la empresa. Dice quién, qué y cuándo, con un
identificador de correlación. Lo que hace el sistema por su cuenta, como un
cierre programado, queda a nombre del sistema. No guarda notas ni cuerpos
completos. De los motivos guarda tres: el de revocar un dispositivo, el de
reabrir un cierre y el de suspender o reactivar una empresa.

Toda incidencia que se abre queda como `incident.opened`: a nombre del
sistema si la detectó la captura, o de quien cerró si salió al cerrar.

La bitácora no guarda nombres. Al consultarla, cada entrada trae el nombre de
quien actuó y de lo que tocó (`displayName`), leídos en lote con la página: a
lo más una consulta por tipo presente. Una incidencia y un cierre se nombran
por la persona a la que pertenecen; lo que no tiene nombre, como la empresa o
un exporte, va en nulo.

## Lo provisional, reunido

| Regla | Qué podría cambiar |
| --- | --- |
| Reparto de incidencias de ubicación | Qué se considera fuera y qué dudoso |
| Reglas del último día de la semana; turno del día en que empieza | Prorratear la semana que cruza de año o el turno que cruza la medianoche |
| Sin comparación con el horario pactado | Retardos, faltas, vacaciones e incapacidades; el tipo y los máximos diarios ya se calculan |
| Se descuenta una pausa registrada cuya computabilidad falta confirmar | Incorporar si la persona puede salir del lugar de trabajo conforme al artículo 64 |
| Quien no marcó se cierra en ceros | Ausencias justificadas |
| El cierre programado pasa una vez por semana y cierra sólo a quien no tiene pendientes | Que insista, que avise, o que no exista |
| Cuota por persona de 600 peticiones por minuto | El número, según el uso real del portal |
| Gravedad de la incidencia según su tipo | El orden de atención |
| Plantilla del exporte | Lo que pida la nómina del cliente |
| Tarjeta simulada | Se sustituye por la verificación de la tarjeta real |
