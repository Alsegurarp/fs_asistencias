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
| Dar de alta y listar empresas | Sí | | | | | | |
| Ver la empresa | | Sí | Sí | Sí | Sí | | |
| Cambiar la empresa | | Sí | | | | | |
| Invitar personas y darles roles | | Sí | | | | | |
| Ver sedes, horarios y padrón | | Sí | Sí | Sí | Sí | | |
| Crear y cambiar sedes | | Sí | | | | | |
| Crear horarios, personas, importar | | Sí | Sí | | | | |
| Ver tarjetas y dispositivos | | Sí | Sí | | Sí | | |
| Registrar, asignar y revocar tarjetas | | Sí | Sí | | | | |
| Emitir códigos y revocar dispositivos | | Sí | Sí | | | | |
| Marcar | | | | | | | Sí |
| Ver marcajes, jornadas e incidencias | | Sí | Sí | Sí | Sí | | |
| Asignar y resolver incidencias | | Sí | Sí | Sí | | | |
| Cerrar una semana | | Sí | Sí | | | | |
| Reabrir un cierre | | Sí | | | | | |
| Ver su propia semana y acusar su cierre | | | | | | Sí | Sí, si es personal |
| Exportar | | Sí | Sí | | Sí | | |
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
| Cargar el padrón por archivo | `POST /imports/csv` | Primero valida; con `dryRun=false` aplica |
| Asignar horario | `POST /employees/{employeeId}/schedule-assignments` | Desde una fecha; cierra el anterior el día previo |
| Registrar tarjetas | `POST /cards` | Número impreso y huella; quedan en inventario |
| Asignar una tarjeta | `POST /cards/{cardId}/assignments` | Sólo una del inventario; reemplaza la que la persona tuviera |

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

## 7. Atender una incidencia

Actores: administrador, RH o supervisor.

1. `GET /incidents` lista lo que hay por revisar; filtra por estado, tipo,
   sede y semana.
2. `PATCH /incidents/{incidentId}` la asigna a alguien, o la resuelve con una
   decisión y un motivo:
   - `justified`: hay una razón legítima; la jornada no cambia.
   - `confirmed`: la anomalía es real; la jornada no cambia.
   - `adjusted`: se corrige la jornada agregando, excluyendo o cambiando el
     tipo de un marcaje. El marcaje original no se toca.

Puede salir mal: ya estaba resuelta (409 `incident_already_resolved`); el
ajuste cae en una semana cerrada (409 `week_closed`).

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

## 11. Revisar qué pasó

| Qué | Ruta | Actor |
| --- | --- | --- |
| Marcajes con su evidencia minimizada | `GET /attendance-events` | Administrador, RH, supervisor, auditor |
| Acciones administrativas | `GET /audit-log` | Administrador, auditor |
| Dispositivos enrolados | `GET /devices` | Administrador, RH, auditor |
| De dónde viene el padrón | `GET /integrations/checkpoints` | Administrador, RH |
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
