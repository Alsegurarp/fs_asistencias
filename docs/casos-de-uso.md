# Casos de uso

Quién usa Zenit, qué hace cada quien y con qué rutas. Las rutas van sin el
prefijo `/api/v1`. El detalle de cada campo está en el contrato.

## Quién participa

| Actor | Quién es | Cómo se identifica |
| --- | --- | --- |
| Operador del servicio (`operador_saas`) | Quien opera Zenit. Da de alta empresas y no entra a los datos de ninguna | Cuenta en el proveedor de identidad cuyo correo está en la lista de operadores |
| Administrador de la empresa (`admin_empresa`) | Quien configura la empresa, invita a su gente y reabre cierres | Cuenta, invitada por el operador |
| Recursos humanos (`rh`) | Quien lleva el padrón, las tarjetas, los dispositivos y cierra la semana | Cuenta, invitada por el administrador |
| Supervisor (`supervisor`) | Quien revisa jornadas y atiende incidencias | Cuenta, invitada |
| Auditor (`auditor`) | Quien consulta, exporta y lee la bitácora, sin cambiar nada | Cuenta, invitada |
| Trabajador (`trabajador`) | Quien marca, ve su semana y acusa su cierre | Su teléfono personal enrolado, o una cuenta ligada a su fila del padrón |
| Dispositivo | El teléfono personal de un trabajador o la terminal de una sede | Su propia clave: no tiene cuenta ni contraseña |

Una persona puede tener varios roles y pertenece a una sola empresa. La empresa
y los roles salen de la base, nunca del token ni de la petición.

## Mapa de permisos

| Qué | Operador | Administrador | RH | Supervisor | Auditor | Trabajador | Dispositivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dar de alta, listar, suspender y reactivar empresas | Sí | | | | | | |
| Consultar el uso mensual de una empresa, sólo conteos | Sí | | | | | | |
| Soltar la liga de quien administra una empresa | Sí | | | | | | |
| Ver la empresa | | Sí | Sí | Sí | Sí | | |
| Cambiar la empresa y su cierre programado | | Sí | | | | | |
| Invitar personas, darles roles y soltar su liga | | Sí | | | | | |
| Ver sedes, horarios y padrón | | Sí | Sí | Sí | Sí | | |
| Crear y cambiar sedes | | Sí | | | | | |
| Crear horarios, personas, importar | | Sí | Sí | | | | |
| Ver tarjetas y dispositivos | | Sí | Sí | | Sí | | |
| Registrar, asignar y revocar tarjetas | | Sí | Sí | | | | |
| Emitir códigos y revocar dispositivos | | Sí | Sí | | | | |
| Marcar | | | | | | | Sí |
| Ver marcajes, jornadas e incidencias | | Sí | Sí | Sí | Sí | | |
| Asignar y resolver incidencias | | Sí | Sí | Sí | | | |
| Cerrar una semana, directo o con una corrida | | Sí | Sí | | | | |
| Ver las corridas de cierre | | Sí | Sí | Sí | Sí | | |
| Reabrir un cierre | | Sí | | | | | |
| Ver su propia semana y acusar su cierre | | | | | | Sí | Sí, si es personal |
| Exportar y leer el manifiesto | | Sí | Sí | | Sí | | |
| Leer la bitácora | | Sí | | | Sí | | |

Hoy un supervisor ve y atiende lo de toda su empresa, no sólo lo de sus sedes.

## 1. Dar de alta una empresa

Actor: operador.

1. `POST /tenants` con nombre, identificador corto, zona horaria, día en que
   empieza la semana, política de descanso y el correo de quien la
   administrará.
2. Esa persona queda invitada. La primera vez que entra con ese correo
   verificado queda ligada como administradora.

Puede salir mal: el identificador corto ya existe (409 `slug_taken`); el
correo ya pertenece a alguien (409 `email_unavailable`); quien llama no es
operador (403).

## 2. Entrar por primera vez

Actor: cualquier persona invitada.

1. Alguien con acceso a la consola de identidad crea su cuenta con el mismo
   correo de la invitación, marcado como verificado.
2. La persona entra, cambia su contraseña temporal y configura su segundo
   factor.
3. `GET /me` devuelve su empresa y sus roles. En esa primera llamada la cuenta
   queda ligada a su invitación.

Un correo sin verificar no liga a nadie, y una invitación ya ligada no la toma
otra cuenta.

## 3. Configurar la empresa

Actores: administrador y RH.

| Paso | Ruta | Notas |
| --- | --- | --- |
| Invitar a la gente | `POST /users` | Correo y roles; puede ligarse con una fila del padrón |
| Crear sedes | `POST /sites` | Coordenada y radio de la geocerca, de 20 a 2000 metros |
| Crear horarios | `POST /schedules` | Con vigencia; no se editan, se crea otro |
| Dar de alta personas | `POST /employees` | Identificador externo único en la empresa |
| Cargar el padrón por archivo | `POST /imports/csv` | Primero valida; con `dryRun=false` aplica. Una revisión del historial se aplica volviendo a subir el mismo archivo con `reviewedImportId` |
| Ver las cargas anteriores | `GET /imports` | Archivo, quién lo subió, conteos y si una revisión ya se aplicó |
| Asignar horario | `POST /employees/{employeeId}/schedule-assignments` | Desde una fecha; cierra el anterior el día previo |
| Registrar tarjetas | `POST /cards` | Número impreso y huella; quedan en inventario |
| Asignar una tarjeta | `POST /cards/{cardId}/assignments` | Sólo una del inventario; reemplaza la que la persona tuviera |
| Buscar y contar personas, tarjetas y lectores | `GET /employees`, `/cards`, `/devices` con `q`, y sus `/summary` | Por fragmento, sin acentos; filtros y conteos en el servidor |

## 4. Enrolar un dispositivo

Actores: administrador o RH, y el dispositivo.

1. `POST /device-enrollments` emite un código de un solo uso, que vale 15
   minutos. La modalidad queda fija: `personal`, ligado a una persona, o
   `terminal`, ligado a una sede.
2. La persona escribe el código en la app.
3. La app genera su clave y llama `POST /device-activations`, sin credencial:
   la autoriza el código y la prueba de que posee la clave.
4. El servidor responde con el identificador del dispositivo y su primera
   sesión.

Puede salir mal: código usado, vencido o inexistente (410 `enrollment_gone`);
teléfono sin bloqueo de pantalla o prueba que no corresponde a la clave (422).
El teléfono nuevo de una persona cierra el anterior.

## 5. Marcar

Actor: el dispositivo, cuando alguien acerca su tarjeta.

1. La app lee la tarjeta y toma la ubicación.
2. Firma un sobre con el marcaje y lo manda con `POST /attendance-events`.
3. El servidor responde con un recibo: guardado, guardado con incidencia o
   rechazado con su motivo.

Sin conexión, la app guarda los sobres y los manda después con
`POST /attendance-events/batch`: recibe un recibo por sobre.

| Lo que pasa | Resultado |
| --- | --- |
| Todo cuadra | Se guarda (`accepted`) |
| Fuera de la geocerca, ubicación dudosa, hora rara, lectura repetida, marca que llega tarde | Se guarda con incidencia (`accepted_with_incident`) |
| Tarjeta desconocida, revocada o ajena, firma o sesión que no corresponden, marcaje de más de 72 horas | Se rechaza con recibo (`rejected`) y no se reintenta |

## 6. Ver la jornada

| Actor | Ruta |
| --- | --- |
| Administrador, RH, supervisor, auditor | `GET /employees/{employeeId}/attendance?week=` |
| Trabajador, con su cuenta o su teléfono personal | `GET /me/attendance?week=` |

Devuelve los tramos de trabajo y de descanso, los totales, las alertas, las
incidencias abiertas y, si la semana está cerrada, cuál cierre.

Para ver a toda la empresa de una vez, sin una llamada por persona:

| Actor | Ruta | Para qué |
| --- | --- | --- |
| Administrador, RH, supervisor, auditor | `GET /attendance/weeks?week=` | La tabla de asistencia: totales, alertas, incidencias y estado de hoy de cada persona, por páginas, con filtro por sede y por lo que requiere atención |
| Administrador, RH, supervisor, auditor | `GET /attendance/summary?date=` | Los números del panel: quién marcó ese día, quién está en turno, horas de la semana, salidas faltantes, incidencias, cierres y acuses de la semana anterior y lectores sin señal |

El detalle de una persona, con sus tramos, sigue siendo
`GET /employees/{employeeId}/attendance`.

## 7. Atender una incidencia

Actores: administrador, RH o supervisor.

1. `GET /incidents` lista lo que hay por revisar; filtra por estado, tipo,
   sede, semana, severidad, asignación y si bloquea un cierre, y ordena por
   apertura, severidad o resolución. `GET /incidents/summary` da los
   conteos de las pestañas y los filtros.
2. `GET /incidents/{incidentId}/assignees` dice a quién se puede asignar:
   sólo a quien puede resolverla.
3. `PATCH /incidents/{incidentId}` la asigna a alguien, o la resuelve con una
   decisión y un motivo:
   - `justified`: hay una razón legítima; la jornada no cambia.
   - `confirmed`: la anomalía es real; la jornada no cambia.
   - `adjusted`: se corrige la jornada agregando, excluyendo o cambiando el
     tipo de un marcaje. El marcaje original no se toca.

Puede salir mal: ya estaba resuelta (409 `incident_already_resolved`); el
ajuste cae en una semana cerrada (409 `week_closed`); se asigna a quien no
puede resolverla (422, con el error `assignee_cannot_resolve`).

## 8. Cerrar la semana

Actores: administrador o RH.

1. `POST /week-closures` con cualquier fecha de la semana; opcionalmente una
   sede o una lista de personas.
2. La respuesta separa a quién se cerró (`closed`) de a quién no (`blocked`),
   con el motivo: incidencias abiertas o un tramo sin cerrar.
3. Se atiende lo pendiente y se vuelve a cerrar: quien ya estaba cerrado no
   cambia.

Puede salir mal: la semana todavía no termina (422, con el error `week_not_finished`).

Reabrir (`POST /week-closures/{closureId}/reopen`) es sólo del administrador
y pide motivo. La versión cerrada se conserva; el siguiente cierre crea otra.

Para revisar una semana: `GET /week-closures?week=` filtra por sede, estado
y acuse, con el nombre de la persona y de quien cerró;
`GET /week-closures/summary?week=` cuenta cerrados, reabiertos, bloqueados y
acuses; las personas bloqueadas, con lo que falta, salen de
`GET /incidents?week=&blocksClosure=true`.

### Cuando son muchas personas: la corrida de cierre

El cierre directo admite hasta 500 personas, porque responde en la misma
petición. Para toda la empresa, o para una sede grande:

1. `POST /week-closure-runs` con cualquier fecha de la semana y,
   opcionalmente, una sede. Responde 202 con la corrida en `queued`.
2. `GET /week-closure-runs/{runId}` hasta verla en `done`. Trae cuántas
   personas entraron, cuántas quedaron cerradas y cuántas no, por motivo.
3. A quienes no se cerraron se les encuentra con `GET /incidents` pidiendo las
   abiertas de esa semana. Se atienden y se pide otra corrida.

Cada persona se cierra por separado: lo ya cerrado sigue cerrado aunque la
corrida se interrumpa. Mientras una corrida de esa semana y ese alcance no
termina, pedirla otra vez devuelve la misma.

### Que la semana se cierre sola

Quien administra la empresa lo enciende con `PATCH /tenant` y
`autoCloseAfterHours`: cuántas horas después del fin de la semana cierra el
sistema. En nulo, que es como nace, sólo cierra una persona.

El sistema pasa una vez por semana y cierra a quien no tiene nada pendiente.
A los demás los cierra después una persona, como siempre. Un cierre hecho por
el sistema no tiene persona en `closedBy`, y en la bitácora queda a nombre del
sistema.

## 9. Acusar el cierre

Actor: el trabajador.

1. Ve su semana cerrada con `GET /me/attendance`; ahí viene el identificador
   del cierre.
2. `POST /week-closures/{closureId}/acknowledgements` con `agreed` u
   `objected` y, si quiere, una nota.

Una vez por versión de cierre. El cierre de otra persona responde 404.

## 10. Exportar

Actores: administrador, RH o auditor.

1. `POST /exports` con la semana y, si se quiere, una sede.
2. `GET /exports/{exportId}` hasta que el estado sea `ready`.
3. `GET /exports/{exportId}/download`, con la credencial, una sola vez.

Sólo entran los cierres vigentes. El archivo vale quince minutos.

Para comprobar después un archivo guardado, `GET /exports/{exportId}/manifest`
entrega el manifiesto: la huella del archivo y, por cada fila, el cierre del
que salió con su huella. Sigue disponible cuando el archivo ya se descargó o
venció.

`GET /exports` es el historial: quién pidió cada exporte, quién lo descargó y
su estado. Del expediente de la empresa, `GET /dossiers` da las copias propias
de quien tiene el permiso.

## 11. Revisar qué pasó

| Qué | Ruta | Actor |
| --- | --- | --- |
| Marcajes con su evidencia minimizada | `GET /attendance-events` | Administrador, RH, supervisor, auditor |
| Acciones administrativas, con el nombre de quien actuó y de lo que tocó; por periodo, persona, objeto o grupo, y su cuenta | `GET /audit-log`, `GET /audit-log/summary` | Administrador, auditor |
| Quién tiene acceso, con su rol, estado y permiso de expediente | `GET /users`, `GET /users/summary` | Administrador |
| Dispositivos enrolados, también los que no tienen señal | `GET /devices`, `GET /devices/summary` | Administrador, RH, auditor |
| De dónde viene el padrón | `GET /integrations/checkpoints` | Administrador, RH |
| Corridas de cierre, también las del sistema | `GET /week-closure-runs` | Administrador, RH, supervisor, auditor |
| Reglas laborales y su vigencia | `GET /rule-sets` | Administrador, RH, supervisor, auditor |

## 12. Dar de baja

| Qué | Ruta | Efecto |
| --- | --- | --- |
| Una persona | `PATCH /employees/{employeeId}` con `status` o `employmentEnd` | Su tarjeta deja de marcar; no se revoca sola |
| Una tarjeta | `POST /cards/{cardId}/revocation` | Revocada, perdida o dañada; no vuelve a asignarse |
| Un dispositivo | `POST /devices/{deviceId}/revocation` | Su clave deja de servir; sus marcajes se conservan |
| El acceso de alguien al portal | `PATCH /users/{userId}` con `disabled` | Pierde el acceso sin borrarse |
| Una sede | `PATCH /sites/{siteId}` con `status` | Se desactiva |

Nada de esto se borra: todo se desactiva, se revoca o se da de baja.

## 13. Recuperar a una persona que perdió su cuenta

Actor: administrador.

Una persona queda ligada a la cuenta con la que entró por primera vez. Si esa
cuenta se pierde y la persona vuelve con otra del mismo correo, la cuenta
nueva no entra: la liga sigue apuntando a la anterior.

1. `POST /users/{userId}/unlink`. La persona vuelve a quedar invitada, con
   sus mismos roles y su misma fila del padrón.
2. La siguiente vez que entra con ese correo verificado, queda ligada a su
   cuenta nueva.

Soltar la liga no quita el acceso: si la cuenta anterior todavía existe con
ese correo, vuelve a ligarse al entrar. Para quitar el acceso está
`disabled`, en `PATCH /users/{userId}`.

Puede salir mal: la persona no está ligada a ninguna cuenta (409
`user_not_linked`).

### Si quien perdió su cuenta es la única administradora

Nadie de su empresa puede soltar su liga. Lo hace quien opera el servicio:

1. `POST /tenants/{tenantId}/administrators/unlink` con el correo de esa
   persona y un motivo de al menos diez caracteres.
2. Responde 204, sin ningún dato de la persona. Queda en la bitácora de la
   empresa quién lo hizo, que fue desde la operación del servicio, y por qué.
3. La persona entra con su cuenta nueva y queda ligada, con sus mismos roles.

Sólo vale para quien tiene el rol de administrar esa empresa. Con el correo
de cualquier otra persona, de otra empresa o que no existe, responde 404 sin
decir cuál de los tres.

Si quien administraba dejó la empresa, o la invitación del alta llegó a un
correo equivocado, quien opera el servicio invita a otra persona:

1. `POST /tenants/{tenantId}/administrators` con su correo y un motivo de al
   menos diez caracteres.
2. Responde 201 con el correo, `invited` y sin fecha de entrada. Queda en la
   bitácora de la empresa, con el motivo y que fue desde la operación.
3. La persona entra con ese correo verificado y administra la empresa; desde
   ahí invita al resto.

Puede salir mal: alguien ya administra la empresa con su cuenta (409
`administrator_linked`; esa persona invita), o el correo es de quien opera
el servicio o ya pertenece a alguien (409 `email_unavailable`, sin decir de
quién).

## 14. Suspender una empresa

Actor: operador.

1. `POST /tenants/{tenantId}/suspension` con un motivo de al menos diez
   caracteres.
2. La empresa queda cerrada para su gente y para sus dispositivos: sus
   personas dejan de tener roles, sus dispositivos dejan de autenticarse y sus
   códigos de enrolamiento dejan de canjearse. No se borra nada.
3. `POST /tenants/{tenantId}/reactivation`, también con motivo, devuelve todo
   como estaba.

Las dos acciones quedan en la bitácora de la empresa, con su motivo. Junto
con soltar la liga de quien administra y consultar el uso del mes, son las
únicas rutas que llevan la empresa en la dirección, porque quien opera el
servicio no pertenece a ninguna.

Puede salir mal: ya estaba suspendida (409 `tenant_not_active`), o no lo
estaba al reactivarla (409 `tenant_not_suspended`).

## 15. Consultar el uso de una empresa para facturar

Actor: operador.

1. `GET /tenants/{tenantId}/usage?month=AAAA-MM`. El mes se corta en la zona
   horaria de la empresa.
2. Responde sólo conteos, sin datos de personas: personas que marcaron,
   personas con relación laboral vigente en el mes, tarjetas asignadas,
   teléfonos y terminales activos, y marcajes.
3. `complete` dice si el mes ya terminó. Un mes terminado da siempre lo mismo,
   porque cada conteo sale de datos que guardan su historia; el mes en curso
   va creciendo.

Qué conteo se cobra lo decide el precio, no el servicio. En el portal está en
Empresas → «Uso de …».

Puede salir mal: el mes no tiene la forma `AAAA-MM` (422, error
`invalid_month`) o todavía no empieza (422, `future_month`). Una persona dada
de baja sin fecha de fin sigue contando como vigente.

## 16. Revisar las empresas y su uso desde la consola

Actor: operador.

1. `GET /tenants` con `q` (nombre o identificador), `status` y
   `administration` (`linked`, `pending`, `none`). Cada empresa trae quién la
   administra, si ya entró y cuándo. `GET /tenants/summary` da los conteos de
   las pestañas.
2. `GET /tenants/usage?month=AAAA-MM`, con la misma búsqueda y estado, da el
   uso del mes de todas las empresas que ya existían en él, por páginas, cada
   una cortada en su zona. `GET /tenants/usage/summary` da los totales.
3. El portal arma el CSV recorriendo las páginas: sólo lleva conteos.

Puede salir mal: un filtro que no es uno de sus valores (422), un texto de
más de 100 caracteres (422, `too_long`), o un mes que todavía no empieza en
ninguna zona (422, `future_month`).
