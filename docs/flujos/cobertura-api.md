# Cobertura del API en los flujos

Corte: 19 de octubre de 2026. Las 61 operaciones de contracts/openapi.yaml (versión 0.12.0).
Las rutas de esta tabla incluyen el prefijo /api/v1. Los roles se toman del contrato;
la autorización efectiva también se aplica en SecurityConfig y los servicios.

| Método y ruta | operationId | Flujo principal | Roles / credencial |
| --- | --- | --- | --- |
| GET /api/v1/system/status | getSystemStatus | [16](16-operacion-auditoria-y-respaldo.puml) | Pública |
| GET /api/v1/me | getCurrentUser | [02](02-identidad-y-permisos.puml) | operador_saas, admin_empresa, rh, supervisor, trabajador, auditor |
| GET /api/v1/tenants | listTenants | [03](03-empresa-y-usuarios.puml) | operador_saas |
| POST /api/v1/tenants | createTenant | [03](03-empresa-y-usuarios.puml) | operador_saas |
| POST /api/v1/tenants/{tenantId}/suspension | suspendTenant | [03](03-empresa-y-usuarios.puml) | operador_saas |
| POST /api/v1/tenants/{tenantId}/reactivation | reactivateTenant | [03](03-empresa-y-usuarios.puml) | operador_saas |
| POST /api/v1/tenants/{tenantId}/administrators/unlink | unlinkTenantAdministrator | [03](03-empresa-y-usuarios.puml) | operador_saas |
| GET /api/v1/tenant | getTenant | [03](03-empresa-y-usuarios.puml) | admin_empresa, rh, supervisor, auditor |
| PATCH /api/v1/tenant | updateTenant | [03](03-empresa-y-usuarios.puml) | admin_empresa |
| GET /api/v1/users | listUsers | [03](03-empresa-y-usuarios.puml) | admin_empresa |
| POST /api/v1/users | inviteUser | [03](03-empresa-y-usuarios.puml) | admin_empresa |
| GET /api/v1/users/{userId} | getUser | [03](03-empresa-y-usuarios.puml) | admin_empresa |
| PATCH /api/v1/users/{userId} | updateUser | [03](03-empresa-y-usuarios.puml) | admin_empresa |
| POST /api/v1/users/{userId}/unlink | unlinkUser | [03](03-empresa-y-usuarios.puml) | admin_empresa |
| GET /api/v1/sites | listSites | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/sites | createSite | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa |
| GET /api/v1/sites/{siteId} | getSite | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh, supervisor, auditor |
| PATCH /api/v1/sites/{siteId} | updateSite | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa |
| GET /api/v1/schedules | listSchedules | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/schedules | createSchedule | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh |
| GET /api/v1/schedules/{scheduleId} | getSchedule | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh, supervisor, auditor |
| GET /api/v1/employees | listEmployees | [04](04-empleados-e-importacion.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/employees | createEmployee | [04](04-empleados-e-importacion.puml) | admin_empresa, rh |
| GET /api/v1/employees/{employeeId} | getEmployee | [04](04-empleados-e-importacion.puml) | admin_empresa, rh, supervisor, auditor |
| PATCH /api/v1/employees/{employeeId} | updateEmployee | [04](04-empleados-e-importacion.puml) | admin_empresa, rh |
| POST /api/v1/employees/{employeeId}/schedule-assignments | assignSchedule | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh |
| GET /api/v1/employees/{employeeId}/attendance | getEmployeeWeek | [09](09-jornada-semanal.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/imports/csv | importEmployeesCsv | [04](04-empleados-e-importacion.puml) | admin_empresa, rh |
| GET /api/v1/imports/{importId} | getImport | [04](04-empleados-e-importacion.puml) | admin_empresa, rh |
| GET /api/v1/cards | listCards | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh, auditor |
| POST /api/v1/cards | registerCard | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh |
| POST /api/v1/cards/{cardId}/assignments | assignCard | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh |
| POST /api/v1/cards/{cardId}/revocation | revokeCard | [05](05-sedes-horarios-tarjetas.puml) | admin_empresa, rh |
| POST /api/v1/device-enrollments | createDeviceEnrollment | [06](06-enrolamiento-y-dispositivo.puml) | admin_empresa, rh |
| POST /api/v1/device-activations | activateDevice | [06](06-enrolamiento-y-dispositivo.puml) | Código de un uso y prueba de posesión |
| GET /api/v1/devices | listDevices | [06](06-enrolamiento-y-dispositivo.puml) | admin_empresa, rh, auditor |
| POST /api/v1/devices/{deviceId}/revocation | revokeDevice | [06](06-enrolamiento-y-dispositivo.puml) | admin_empresa, rh |
| POST /api/v1/device-sessions | openDeviceSession | [06](06-enrolamiento-y-dispositivo.puml) | Dispositivo: aserción ES256 |
| GET /api/v1/attendance-events | listAttendanceEvents | [08](08-captura-en-backend.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/attendance-events | submitAttendanceEvent | [08](08-captura-en-backend.puml) | Dispositivo: aserción ES256 |
| POST /api/v1/attendance-events/batch | submitAttendanceBatch | [08](08-captura-en-backend.puml) | Dispositivo: aserción ES256 |
| GET /api/v1/me/attendance | getMyWeek | [09](09-jornada-semanal.puml) | trabajador o dispositivo personal |
| GET /api/v1/incidents | listIncidents | [10](10-incidencias-y-ajustes.puml) | admin_empresa, rh, supervisor, auditor |
| GET /api/v1/incidents/{incidentId} | getIncident | [10](10-incidencias-y-ajustes.puml) | admin_empresa, rh, supervisor, auditor |
| PATCH /api/v1/incidents/{incidentId} | updateIncident | [10](10-incidencias-y-ajustes.puml) | admin_empresa, rh, supervisor |
| GET /api/v1/week-closures | listWeekClosures | [11](11-cierres-y-corridas.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/week-closures | closeWeek | [11](11-cierres-y-corridas.puml) | admin_empresa, rh |
| GET /api/v1/week-closures/{closureId} | getWeekClosure | [11](11-cierres-y-corridas.puml) | admin_empresa, rh, supervisor, auditor, trabajador |
| POST /api/v1/week-closures/{closureId}/reopen | reopenWeekClosure | [12](12-reapertura-y-acuse.puml) | admin_empresa |
| POST /api/v1/week-closures/{closureId}/acknowledgements | acknowledgeWeekClosure | [12](12-reapertura-y-acuse.puml) | trabajador o dispositivo personal |
| GET /api/v1/week-closure-runs | listWeekClosureRuns | [11](11-cierres-y-corridas.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/week-closure-runs | requestWeekClosureRun | [11](11-cierres-y-corridas.puml) | admin_empresa, rh |
| GET /api/v1/week-closure-runs/{runId} | getWeekClosureRun | [11](11-cierres-y-corridas.puml) | admin_empresa, rh, supervisor, auditor |
| GET /api/v1/week-closure-runs/{runId}/blocked | listWeekClosureRunBlocked | [11](11-cierres-y-corridas.puml) | admin_empresa, rh, supervisor, auditor |
| GET /api/v1/rule-sets | listRuleSets | [09](09-jornada-semanal.puml) | admin_empresa, rh, supervisor, auditor |
| POST /api/v1/exports | createExport | [13](13-exportes-y-trabajos.puml) | admin_empresa, rh, auditor |
| GET /api/v1/exports/{exportId} | getExport | [13](13-exportes-y-trabajos.puml) | admin_empresa, rh, auditor |
| GET /api/v1/exports/{exportId}/download | downloadExport | [13](13-exportes-y-trabajos.puml) | admin_empresa, rh, auditor |
| GET /api/v1/exports/{exportId}/manifest | getExportManifest | [13](13-exportes-y-trabajos.puml) | admin_empresa, rh, auditor |
| GET /api/v1/audit-log | listAuditEntries | [16](16-operacion-auditoria-y-respaldo.puml) | admin_empresa, auditor |
| GET /api/v1/integrations/checkpoints | listIntegrationCheckpoints | [04](04-empleados-e-importacion.puml) | admin_empresa, rh |
