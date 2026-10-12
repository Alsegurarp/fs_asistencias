# Diccionario

Tres partes: el glosario, que dice cómo se llama cada cosa en el negocio, en el
API y en la base; los catálogos de valores y códigos; y el diccionario de
datos, tabla por tabla.

## Glosario

| Término | En el API | En la base | Qué es |
| --- | --- | --- | --- |
| Empresa | `tenant` | `tenant` | Cada cliente del servicio. Todo dato pertenece a una |
| Suspensión | `suspension`, `reactivation` | `tenant.status` | Cerrar una empresa para su gente y sus dispositivos, sin borrar nada |
| Operador | rol `operador_saas` | Lista de correos en un secreto | Quien opera Zenit; da de alta empresas |
| Persona con acceso | `user` | `tenant_user` | Quien entra al portal: tiene correo, roles y estado |
| Liga | `linkedAt`, `unlink` | `tenant_user.subject` | La unión entre una persona con acceso y su cuenta en el proveedor de identidad |
| Cuota | 429 `rate_limited` | No se guarda | Cuántas peticiones por minuto se le aceptan a una persona o a un dispositivo |
| Rol | `roles` | `tenant_user_role` | Lo que una persona puede hacer en su empresa |
| Padrón | `employees` | `employee` | Las personas cuya asistencia se registra. No es lo mismo que una persona con acceso |
| Identificador externo | `externalId` | `external_id` | El número de empleado que usa la empresa; único dentro de ella |
| Sede | `site` | `site` | Lugar de trabajo, con su geocerca |
| Geocerca | `latitude`, `longitude`, `radiusMeters` | `latitude`, `longitude`, `radius_m` | Círculo dentro del cual un marcaje cuenta como hecho en la sede |
| Horario | `schedule` | `schedule`, `schedule_day` | Entrada, salida y descanso esperados por día, con vigencia |
| Tarjeta | `card` | `card` | La tarjeta NFC que identifica a una persona al marcar |
| Huella de la tarjeta | `fingerprint` | `fingerprint` | Lo que identifica a la tarjeta al leerla. Entra al registrarla y no vuelve a salir |
| Dispositivo | `device` | `device` | Teléfono enrolado: personal o terminal |
| Modalidad | `mode` | `mode` | `personal`, de una persona; `terminal`, de una sede |
| Código de enrolamiento | `code` | `device_enrollment.code_sha256` | Código de un solo uso para activar un dispositivo. Sólo se guarda su huella |
| Aserción | `Authorization` | No se guarda | Credencial que el dispositivo firma en cada petición |
| Sesión | `sessionId` | `device_session` | Periodo de captura de un dispositivo, con su consecutivo |
| Marcaje | `attendance event` | `attendance_event` | Una lectura de tarjeta: entrada, salida o descanso |
| Sobre | `envelope` | `attendance_event.envelope` | El marcaje firmado por el dispositivo, tal como llegó |
| Recibo | `receipt` | Se arma de lo guardado | Lo que el servidor contesta por cada sobre |
| Rechazo | `rejection` | `attendance_rejection` | Un sobre que no se aceptó, con su motivo |
| Veredicto de ubicación | `locationVerdict` | `location_verdict` | Si el marcaje cayó dentro de la geocerca |
| Incidencia | `incident` | `incident` | Algo de un marcaje que una persona debe revisar |
| Ajuste | `adjustment` | `adjustment` | Corrección de la jornada que no toca el marcaje |
| Jornada | `attendance` | No se guarda | Lo trabajado por una persona, calculado de sus marcajes |
| Tramo | `segment` | Dentro del cierre | Intervalo de trabajo o de descanso entre dos marcajes |
| Reglas laborales | `rule set` | `rule_set` | Los topes de jornada, con vigencia y fuente |
| Tiempo extraordinario | `overtimeMinutes` | `overtime_minutes` | Lo que excede el tope semanal ordinario |
| Cierre | `week closure` | `week_closure` | El cálculo de la semana de una persona, congelado |
| Corrida de cierre | `week closure run` | `week_closure_run` | Trabajo que cierra la semana de toda la empresa o de una sede, persona por persona |
| Cierre programado | `autoCloseAfterHours` | `tenant.auto_close_after_hours` | Que el sistema cierre la semana por su cuenta, cierto número de horas después de que termina |
| Acuse | `acknowledgement` | `closure_acknowledgement` | Conformidad u objeción del trabajador con su cierre |
| Exporte | `export` | `export` | Archivo con los cierres vigentes de una semana |
| Manifiesto | `manifest`, `manifestHash` | `export.manifest` | Declaración de qué entró al exporte y de dónde salió |
| Huella | `hash`, `fileHash`, `evidenceHash` | Columnas `char(64)` | SHA-256 en hexadecimal: prueba que algo no cambió |
| Trabajo | No se expone | `job` | Tarea que se atiende fuera de la petición, con reintento |
| Fuente del padrón | `integration checkpoint` | `integration_source`, `integration_checkpoint` | De dónde viene el padrón y hasta dónde se sincronizó |
| Bitácora | `audit log` | `audit_log` | Registro de acciones administrativas; sólo se agrega |
| Correlación | `correlationId` | `correlation_id` | Identificador de una petición, para encontrarla en los registros |
| Política de descanso | `breakPolicy` | `break_policy` | Si la empresa marca la comida o no la considera |

## Catálogos

### Roles

| Valor | Quién |
| --- | --- |
| `operador_saas` | Opera el servicio. No se asigna: sale de la lista de operadores |
| `admin_empresa` | Administra la empresa |
| `rh` | Recursos humanos |
| `supervisor` | Revisa jornadas y atiende incidencias |
| `auditor` | Consulta y exporta |
| `trabajador` | Ve su semana y acusa su cierre |
| `conector` | Reservado para la sincronización del padrón; todavía no se usa |

### Estados

| De qué | Valores |
| --- | --- |
| Empresa | `active`, `suspended` |
| Persona con acceso | `invited`: no ha entrado · `active`: ligada a su cuenta · `disabled`: sin acceso |
| Persona del padrón | `active`, `inactive` |
| Sede | `active`, `inactive` |
| Tarjeta | `inventory`: registrada · `active`: asignada y en uso · `replaced`: sustituida por otra · `revoked`, `lost`, `damaged`: fuera de uso. `assigned` está reservado |
| Código de enrolamiento | `pending`, `used`, `expired` |
| Dispositivo | `active` · `revoked`: dado de baja · `replaced`: sustituido por el teléfono nuevo de la persona |
| Importación | `ready`: validada · `applied`: aplicada · `failed`: el archivo no se pudo leer. `validating` está reservado |
| Marcaje | `accepted`, `accepted_with_incident`; en el recibo además `rejected` |
| Incidencia | `open`, `resolved` |
| Cierre | `closed`, `reopened` |
| Exporte | `queued`: en preparación · `ready`: se puede descargar · `expired`: descargado o vencido · `failed`: no se pudo preparar |
| Corrida de cierre | `queued`: encolada · `running`: cerrando · `done`: terminó · `failed`: no terminó; lo ya cerrado sigue cerrado |
| Fuente del padrón | `active`, `paused`, `error` |
| Trabajo | `queued`, `running`, `done`, `failed` |

### Otros valores

| De qué | Valores |
| --- | --- |
| Día de la semana | `monday` a `sunday` |
| Política de descanso | `not_considered`, `marked` |
| Tipo de marcaje | `clock_in`, `clock_out`, `break_start`, `break_end` |
| Modalidad | `personal`, `terminal` |
| Veredicto de ubicación | `inside`, `outside`, `inconclusive`, `not_evaluated` |
| Ubicación no disponible | `permission_denied`, `disabled`, `timeout` |
| Esquema de tarjeta | `desfire_ev3_aes`, `uid_sha256` |
| Tipo de incidencia | `duplicate`, `missing_pair`, `outside_window`, `location_inconclusive`, `clock_anomaly`, `foreign_site`, `late_sync` |
| Gravedad de incidencia | `low`, `medium`, `high` |
| Decisión de una incidencia | `justified`, `confirmed`, `adjusted` |
| Clase de ajuste | `add_event`, `exclude_event`, `retype_event` |
| Tramo | `work`, `break` |
| Gravedad de alerta | `info`, `warning`, `critical` |
| Alerta | `open_segment`, `weekly_overtime`, `weekly_overtime_limit_exceeded`, `daily_combined_limit_exceeded` |
| Motivo de bloqueo de un cierre | `open_incidents`, `open_segment` |
| Acuse | `agreed`, `objected` |
| Motivo de baja de una tarjeta | `revoked`, `lost`, `damaged` |
| Origen de una persona del padrón | `manual`, `csv`, `api`, `connector` |
| Tipo de fuente del padrón | `csv`, `api`, `connector` |
| Formato de exporte | `csv` |
| Origen de una corrida de cierre | `requested`: la pidió una persona · `scheduled`: la abrió el cierre programado |
| Por qué falló una corrida de cierre | `job_abandoned`: agotó sus intentos · `tenant_not_active`: la empresa se suspendió antes |

### Códigos de error

El campo `code` de un error. En un 422 el `code` es `validation` y el motivo de
cada campo viene en `errors[].code`.

| Estado | `code` | Cuándo |
| --- | --- | --- |
| 401 | `unauthorized` | Falta la credencial, venció o no sirve en esa ruta |
| 403 | `forbidden` | El rol no lo permite |
| 404 | `not_found` | No existe o es de otra empresa |
| 409 | `slug_taken` | Ya hay una empresa con ese identificador corto |
| 409 | `email_unavailable` | Ese correo ya pertenece a alguien |
| 409 | `last_admin` | La empresa se quedaría sin quien la administre |
| 409 | `user_not_linked` | La persona no está ligada a ninguna cuenta |
| 409 | `tenant_not_active` | La empresa ya está suspendida |
| 409 | `tenant_not_suspended` | La empresa no está suspendida |
| 409 | `employee_already_linked` | Esa fila del padrón ya está ligada a otra cuenta |
| 409 | `external_id_taken` | Ya hay una persona con ese identificador externo |
| 409 | `employee_inactive` | La persona está dada de baja |
| 409 | `card_taken` | Ya hay una tarjeta con ese número o esa huella |
| 409 | `card_not_assignable` | La tarjeta no está en el inventario |
| 409 | `card_not_revocable` | La tarjeta ya estaba fuera de uso |
| 409 | `device_not_active` | El dispositivo ya estaba revocado o reemplazado |
| 409 | `idempotency_conflict` | La misma clave de idempotencia con otro contenido |
| 409 | `incident_already_resolved` | La incidencia ya se resolvió |
| 409 | `week_closed` | El ajuste cae en una semana cerrada |
| 409 | `closure_not_closed` | Ese cierre está reabierto |
| 409 | `already_acknowledged` | Ese cierre ya tiene acuse |
| 409 | `export_not_ready` | El exporte todavía se prepara |
| 410 | `enrollment_gone` | El código ya se usó, venció o no existe |
| 410 | `export_expired` | El exporte ya se descargó o venció |
| 410 | `export_failed` | El exporte no se pudo preparar |
| 422 | `validation` | El cuerpo o un parámetro no es válido |
| 429 | `rate_limited` | La persona, el dispositivo o la dirección pasó su cuota |
| 500 | `internal_error` | Falla del servidor |

Motivos frecuentes dentro de un 422, en `errors[].code`: `required`,
`invalid_value`, `invalid_identifier`, `invalid_date`, `invalid_date_time`,
`invalid_time_zone`, `invalid_email`, `too_long`, `too_short`, `too_many`,
`out_of_range`, `not_allowed`, `empty_update`, `unknown_field`,
`unreadable_body`, `key_mismatch`, `week_not_finished`, `no_closed_weeks`,
`no_rules_for_date`, `duplicate_day`, `site_not_found`, `site_inactive`,
`schedule_not_found`,
`employee_not_found`, `user_not_found`, `event_not_found`,
`screen_lock_required`, `invalid_proof` y `key_already_registered`. La lista
no es cerrada.

### Códigos de rechazo de un marcaje

Vienen en `rejection.code` del recibo, con estado 200.

| Código | Cuándo |
| --- | --- |
| `payload_invalid` | El sobre no cumple el contrato |
| `signature_invalid` | No lo firmó este dispositivo |
| `session_invalid` | Sesión ajena o vencida, o consecutivo repetido |
| `too_old` | Más de 72 horas |
| `card_unknown` | Tarjeta no registrada, sin titular o con un esquema que no se verifica |
| `card_revoked` | Tarjeta fuera de uso o titular dado de baja |
| `card_not_owner` | Tarjeta de otra persona en un teléfono personal |

### Acciones de la bitácora

`tenant.created`, `tenant.updated`, `tenant.suspended`, `tenant.reactivated`,
`user.invited`, `user.linked`, `user.unlinked`,
`user.updated`, `user.roles_changed`, `user.disabled`, `user.enabled`,
`site.created`, `site.updated`, `schedule.created`, `employee.created`,
`employee.updated`, `employee.deactivated`, `employee.reactivated`,
`employee.schedule_assigned`, `import.ready`,
`import.applied`, `import.failed`, `card.registered`, `card.assigned`,
`card.revoked`, `device.enrollment_created`, `device.activated`,
`device.revoked`, `incident.opened`, `incident.assigned`, `incident.resolved`,
`week.closed`, `week.reopened`, `week.acknowledged`,
`week.closure_run_requested`, `week.closure_run_finished`,
`week.closure_run_failed`, `export.requested`,
`export.ready`, `export.failed` y `export.downloaded`.

### Límites

| Qué | Valor |
| --- | --- |
| Elementos por página | 1 a 200; 50 por omisión |
| Radio de una geocerca | 20 a 2000 metros |
| Archivo del padrón | Hasta 1 MB y 5000 filas, en UTF-8 |
| Vigencia de un código de enrolamiento | 15 minutos |
| Vida de una aserción de dispositivo | Hasta 120 segundos; desfase tolerado, 60 |
| Versión mínima de Android | SDK 28 |
| Sesión sin conexión | 72 horas o 1000 marcajes |
| Antigüedad máxima de un marcaje | 72 horas |
| Marca tardía | Más de 24 horas |
| Lectura repetida | Menos de 60 segundos |
| Jornada nueva | Tras 16 horas sin marcar |
| Hora adelantada | Más de 5 minutos |
| Sobres por lote | 1 a 100 |
| Motivo de una resolución o de una reapertura | 10 a 500 caracteres |
| Nota de un acuse | Hasta 500 caracteres |
| Personas por cierre directo | Hasta 500; más, con una corrida de cierre, que no tiene tope |
| Cierre programado | De 1 a 168 horas después del fin de la semana; apagado por omisión |
| Motivo de una suspensión o reactivación | 10 a 500 caracteres |
| Vigencia de un exporte listo | 15 minutos |
| Intentos de un trabajo | 5 |
| Intentos fallidos de activación | 10 por minuto y por dirección |
| Peticiones de un dispositivo | 240 por minuto |
| Peticiones de una persona | 600 por minuto, sumando sus sesiones |
| Token de acceso de una persona | 5 minutos |

## Diccionario de datos

Base PostgreSQL. Toda tabla de una empresa lleva `tenant_id`, y sus llaves
foráneas lo incluyen: un registro no puede apuntar a datos de otra empresa.
Las columnas marcadas con `?` admiten nulo.

El backend atiende con un rol que no es dueño de las tablas. La columna
«Escritura» dice qué puede hacer ese rol. No puede borrar en ninguna tabla,
con una excepción: quitarle un rol a una persona borra esa fila, y queda en la
bitácora.

Hay un tercer rol, `zenit_backup`, que sólo lee las dos bases. Lo usa el
ensayo de respaldo; no escribe, no cambia el esquema y no es dueño de nada.

### Empresa y acceso

| Tabla | Columnas | Escritura |
| --- | --- | --- |
| `tenant` | `id`, `slug` único, `name`, `status`, `time_zone`, `week_starts_on`, `break_policy`, `created_at`, `auto_close_after_hours?` cierre programado | Insertar y actualizar |
| `tenant_user` | `tenant_id`, `id`, `email` único en toda la instancia, `subject?` identificador de la cuenta, `display_name`, `status`, `created_at`, `linked_at?` primera entrada, `employee_id?` su fila del padrón | Insertar y actualizar |
| `tenant_user_role` | `tenant_id`, `user_id`, `role`, `granted_at`, `granted_by` | Insertar y quitar un rol |
| `audit_log` | `id`, `tenant_id?`, `at`, `actor_type` (`user`, `device`, `system`), `actor_id?`, `action`, `target_type`, `target_id?`, `correlation_id`, `metadata` | Sólo insertar |

### Padrón y configuración

| Tabla | Columnas | Escritura |
| --- | --- | --- |
| `site` | `tenant_id`, `id`, `name`, `time_zone`, `latitude`, `longitude`, `radius_m`, `status`, `created_at` | Insertar y actualizar |
| `schedule` | `tenant_id`, `id`, `name`, `time_zone`, `valid_from`, `valid_to?`, `created_at` | Sólo insertar |
| `schedule_day` | `tenant_id`, `schedule_id`, `day_of_week`, `start_time`, `end_time`, `break_minutes` | Sólo insertar |
| `employee` | `tenant_id`, `id`, `external_id` único por empresa, `display_name`, `status`, `site_id?`, `employment_start`, `employment_end?`, `source`, `created_at`, `updated_at` | Insertar y actualizar |
| `schedule_assignment` | `tenant_id`, `id`, `employee_id`, `schedule_id`, `valid_from`, `valid_to?`, `created_at` | Insertar y cerrar la vigencia |
| `employee_import` | `tenant_id`, `id`, `idempotency_key`, `content_sha256` huella del archivo, `dry_run`, `status`, `template_version`, `total`, `accepted`, `rejected`, `errors` filas rechazadas, `manifest_hash?`, `created_by`, `created_at` | Sólo insertar |
| `card` | `tenant_id`, `id`, `label` número impreso, `fingerprint`, `status`, `key_version?`, `created_at`, `updated_at` | Insertar y actualizar |
| `card_assignment` | `tenant_id`, `id`, `card_id`, `employee_id`, `since`, `until?`, `replaced_card_id?` | Insertar y cerrar |
| `integration_source` | `tenant_id`, `id`, `type`, `status`, `created_at` | Insertar; actualizar el estado |
| `integration_checkpoint` | `tenant_id`, `source_id`, `sync_cursor?` último punto, `source_version?`, `updated_at` | Insertar; mover el punto |

### Dispositivos y captura

| Tabla | Columnas | Escritura |
| --- | --- | --- |
| `device_enrollment` | `tenant_id`, `id`, `mode`, `employee_id?`, `site_id?`, `label?`, `code_sha256` huella del código, `status`, `expires_at`, `created_by`, `created_at`, `used_at?` | Insertar; marcar usado |
| `device` | `tenant_id`, `id`, `mode`, `status`, `employee_id?`, `site_id?`, `label?`, `public_jwk` clave pública, `key_thumbprint` única, `manufacturer`, `model`, `android_sdk`, `app_version`, `enrolled_at`, `last_seen_at?`, `revoked_at?` | Insertar; actualizar estado y última vez visto |
| `device_session` | `tenant_id`, `id`, `device_id`, `app_version`, `started_at`, `ended_at?` | Insertar; cerrar |
| `attendance_event` | `tenant_id`, `id`, `idempotency_key` única por empresa, `event_type` tipo decidido, `declared_type?` tipo declarado, `outcome`, `observed_at`, `received_at`, `time_zone`, `elapsed_realtime_ms?`, `device_id`, `device_mode`, `session_id`, `sequence` único por sesión, `employee_id`, `card_id`, `card_scheme`, `site_id?`, `location_verdict`, `accuracy_m?`, `envelope` el sobre firmado, `payload_sha256` | Sólo insertar |
| `location_evidence` | `tenant_id`, `event_id`, `latitude`, `longitude`, `accuracy_m`, `captured_at`, `provider?`, `mock?` | Sólo insertar |
| `attendance_rejection` | `tenant_id`, `id`, `idempotency_key`, `device_id`, `code`, `message`, `observed_at?`, `received_at`, `payload_sha256` | Sólo insertar |

### Jornada, incidencias y cierre

| Tabla | Columnas | Escritura |
| --- | --- | --- |
| `rule_set` | `id`, `jurisdiction`, `version`, `valid_from`, `valid_to?`, `weekly_ordinary_max_minutes`, `parameters` demás topes, `sources`, `created_at` | Sólo leer |
| `incident` | `tenant_id`, `id`, `event_id`, `employee_id`, `site_id?`, `type`, `severity`, `status`, `created_at`, `assignee_user_id?`, `resolution_decision?`, `resolution_reason?`, `adjustment_id?`, `resolved_by?`, `resolved_at?` | Insertar; actualizar sólo su atención |
| `adjustment` | `tenant_id`, `id`, `employee_id`, `kind`, `event_id?`, `event_type?`, `occurred_at?`, `reason`, `created_by`, `created_at` | Sólo insertar |
| `week_closure` | `tenant_id`, `id`, `employee_id`, `week_start`, `version`, `status`, `rule_set_id`, `rule_set_version`, `worked_minutes`, `break_minutes`, `ordinary_minutes`, `overtime_minutes`, `snapshot` el cálculo congelado, `hash`, `closed_at`, `closed_by?` nulo si lo cerró el sistema, `reopened_at?`, `reopened_by?`, `reopen_reason?` | Insertar; actualizar sólo la reapertura |
| `closure_acknowledgement` | `tenant_id`, `id`, `closure_id` único, `employee_id`, `type`, `note?`, `at`, `actor_type` (`user`, `device`), `actor_id`, `evidence_hash` | Sólo insertar |
| `week_closure_run` | `tenant_id`, `id`, `week_start`, `site_id?`, `origin`, `status`, `requested_by?` nulo si la abrió el sistema, `total?`, `closed`, `blocked_open_incidents`, `blocked_open_segment`, `failure?`, `created_at`, `started_at?`, `finished_at?` | Insertar; actualizar sólo su avance |

### Exportes y trabajos

| Tabla | Columnas | Escritura |
| --- | --- | --- |
| `export` | `tenant_id`, `id`, `idempotency_key`, `request_sha256` huella de lo pedido, `week_start`, `site_id?`, `format`, `template_version`, `time_zone`, `rule_set_id`, `rule_set_version`, `status`, `row_count?`, `manifest?`, `manifest_hash?`, `file_hash?`, `content?` el archivo mientras se puede descargar, `failure?`, `requested_by`, `created_at`, `ready_at?`, `expires_at?`, `downloaded_at?`, `downloaded_by?` | Insertar; actualizar sólo su resultado |
| `job` | `id`, `tenant_id?`, `type`, `reference_id` registro al que apunta, `status`, `attempts`, `max_attempts`, `next_run_at`, `lease_until?` hasta cuándo lo tiene un proceso, `last_error?` clase del error, `created_at`, `finished_at?` | Insertar; actualizar sólo su avance |

`flyway_schema_history` es el historial de migraciones; lo administra la
herramienta de migraciones y el backend sólo lo lee.

### Lo que la base impide por sí misma

- Borrar una fila con el rol que atiende, salvo la de un rol que se quita.
- Corregir un marcaje, una coordenada, un rechazo, un ajuste, un acuse o una
  entrada de la bitácora.
- Cambiar lo que un cierre congeló, o lo que se pidió en un exporte o en una
  corrida de cierre.
- Que un registro apunte a algo de otra empresa.
- Que una incidencia quede resuelta sin decisión, motivo, autor y hora.
- Que un exporte quede listo sin archivo, manifiesto y vencimiento, o vencido
  con el archivo todavía guardado.
- Que una persona tenga dos cierres vigentes de la misma semana, o un cierre
  dos acuses.
- Que haya dos corridas de cierre en curso para la misma semana y el mismo
  alcance, o dos corridas del cierre programado para la misma semana.
- Que una empresa pida el cierre programado fuera de 1 a 168 horas.
