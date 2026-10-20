# Flujos actuales de Zenit

Actualización A1–A4 del 20: los flujos 03 y 09 incorporan cambio obligatorio
de contraseña y acuse semanal desde servidor. La cobertura refleja las 62
operaciones del contrato 0.13. El corte siguiente corresponde a los demás
diagramas y conserva su evidencia histórica.

Corte: **18 de octubre de 2026**, fuentes del commit `5f36b5c` más los cambios
locales de esta sesión. Los diagramas describen la implementación existente;
no conceden permisos nuevos ni equivalen a una validación de producción.
En particular, incluyen el ajuste local de recuperación de identidad y el
modo de recuperación de respaldos; ambos siguen pendientes de aplicación
operativa en el servidor.

La empresa, el empleado y la cuenta de acceso son objetos distintos:

- **Empresa:** nace en `POST /api/v1/tenants`, mediante un operador autorizado.
  En la misma transacción queda invitado su primer administrador.
- **Empleado:** nace en `POST /api/v1/employees` o al aplicar una importación
  CSV, dentro de la empresa. No recibe cuenta ni contraseña automáticamente.
- **Cuenta de acceso:** nace por separado en Keycloak; su invitación en Zenit
  se liga al primer acceso con correo verificado. Puede vincularse a un empleado.
- **Evento de asistencia:** primero es un sobre firmado en la cola Android;
  nace como `attendance_event` del servidor cuando el API lo acepta.

## Orden de lectura y fuentes

Todos los `.puml` son independientes y no descargan includes ni temas remotos.
Las rutas de negocio llevan el prefijo `/api/v1`, omitido en los diagramas
para facilitar la lectura.

| Archivo | Qué aclara | Código principal contrastado |
| --- | --- | --- |
| [00 Recorrido general](00-recorrido-general.puml) | De la primera empresa al cierre y exporte | Servicios de cada área y [contrato](../../contracts/openapi.yaml) |
| [01 Arquitectura](01-arquitectura.puml) | Componentes, credenciales, redes y canales | [Compose](../../compose.yaml), [borde](../../deploy/servidor/borde/conf.d/20-zenit.fastsolution.com.mx.conf), [seguridad](../../backend/src/main/kotlin/mx/fastsolution/zenit/security/SecurityConfig.kt) |
| [02 Identidad y permisos](02-identidad-y-permisos.puml) | Login, operador, invitación y aislamiento | [IdentityResolver](../../backend/src/main/kotlin/mx/fastsolution/zenit/identity/IdentityResolver.kt), [roles](../../backend/src/main/kotlin/mx/fastsolution/zenit/identity/Role.kt), [realm](../../infra/keycloak/realm/zenit-realm.json) |
| [03 Empresa y usuarios](03-empresa-y-usuarios.puml) | Alta, primer administrador, invitaciones, baja de acceso y suspensión | [TenantService](../../backend/src/main/kotlin/mx/fastsolution/zenit/tenant/TenantService.kt), [UserService](../../backend/src/main/kotlin/mx/fastsolution/zenit/user/UserService.kt) |
| [04 Empleados e importación](04-empleados-e-importacion.puml) | Nacimiento del padrón, CSV, idempotencia y checkpoints | [Employees](../../backend/src/main/kotlin/mx/fastsolution/zenit/employee/Employees.kt), [Imports](../../backend/src/main/kotlin/mx/fastsolution/zenit/employee/Imports.kt), [Sources](../../backend/src/main/kotlin/mx/fastsolution/zenit/integration/Sources.kt) |
| [05 Sedes, horarios y tarjetas](05-sedes-horarios-tarjetas.puml) | Catálogos, vigencias, asignaciones y reemplazos | [Sites](../../backend/src/main/kotlin/mx/fastsolution/zenit/site/Sites.kt), [Schedules](../../backend/src/main/kotlin/mx/fastsolution/zenit/schedule/Schedules.kt), [Cards](../../backend/src/main/kotlin/mx/fastsolution/zenit/card/Cards.kt) |
| [06 Enrolamiento y dispositivo](06-enrolamiento-y-dispositivo.puml) | Código, clave del teléfono, sesiones y revocación | [Devices](../../backend/src/main/kotlin/mx/fastsolution/zenit/device/Devices.kt), [DeviceAuth](../../backend/src/main/kotlin/mx/fastsolution/zenit/device/DeviceAuth.kt) |
| [07 Captura móvil y cola](07-captura-movil-y-cola.puml) | NFC, firma, cifrado, offline, lotes y recibos | [AttendanceRepository](../../android/app/src/main/kotlin/mx/fastsolution/zenit/mobile/data/AttendanceRepository.kt), [SyncWorker](../../android/app/src/main/kotlin/mx/fastsolution/zenit/mobile/data/AttendanceSyncWorker.kt) |
| [08 Captura en backend](08-captura-en-backend.puml) | Dónde nace el evento, rechazo e incidencias | [Capture](../../backend/src/main/kotlin/mx/fastsolution/zenit/capture/Capture.kt), [CaptureRules](../../backend/src/main/kotlin/mx/fastsolution/zenit/capture/CaptureRules.kt), [umbrales](../../backend/src/main/kotlin/mx/fastsolution/zenit/capture/CaptureProperties.kt) |
| [09 Jornada semanal](09-jornada-semanal.puml) | Recalcular frente a entregar un cierre congelado | [Weeks](../../backend/src/main/kotlin/mx/fastsolution/zenit/workday/Weeks.kt), [WeekCalculator](../../backend/src/main/kotlin/mx/fastsolution/zenit/workday/WeekCalculator.kt) |
| [10 Incidencias y ajustes](10-incidencias-y-ajustes.puml) | Asignación, resolución humana y cambios sin editar evidencia | [Incidents](../../backend/src/main/kotlin/mx/fastsolution/zenit/workday/Incidents.kt) |
| [11 Cierres y corridas](11-cierres-y-corridas.puml) | Cierre directo, trabajo por persona y programación | [Closures](../../backend/src/main/kotlin/mx/fastsolution/zenit/workday/Closures.kt), [ClosureRuns](../../backend/src/main/kotlin/mx/fastsolution/zenit/workday/ClosureRuns.kt) |
| [12 Reapertura y acuse](12-reapertura-y-acuse.puml) | Versiones conservadas y manifestación del trabajador | [Closures](../../backend/src/main/kotlin/mx/fastsolution/zenit/workday/Closures.kt) |
| [13 Exportes y trabajos](13-exportes-y-trabajos.puml) | Cola, reintentos, CSV, manifiesto y descarga única | [Exports](../../backend/src/main/kotlin/mx/fastsolution/zenit/export/Exports.kt), [Jobs](../../backend/src/main/kotlin/mx/fastsolution/zenit/jobs/Jobs.kt) |
| [14 Modelo de datos](14-modelo-de-datos.puml) | Relaciones principales de las 29 tablas del producto | [Migraciones V001 a V008](../../backend/src/main/resources/db/migration/) |
| [15 Canales y alcance UI](15-canales-y-alcance-ui.puml) | Qué se conecta y qué es presentación o interfaz pendiente | [Workspace](../../web/src/Workspace.tsx), [MainActivity](../../android/app/src/main/kotlin/mx/fastsolution/zenit/mobile/MainActivity.kt), [producto móvil](../alcance-producto-movil.md) |
| [16 Operación, auditoría y respaldo](16-operacion-auditoria-y-respaldo.puml) | Roles de base, arranque y recuperación preparada | [SchemaConfig](../../backend/src/main/kotlin/mx/fastsolution/zenit/persistence/SchemaConfig.kt), [AuditLog](../../backend/src/main/kotlin/mx/fastsolution/zenit/audit/AuditLog.kt), [respaldo](../../infra/postgres/backup/rehearse.sh) |

La [cobertura de las 61 operaciones](cobertura-api.md) relaciona cada método y
ruta del contrato con su diagrama y los roles declarados. La cobertura indica
que la capacidad se documentó; no significa que tenga pantalla ni prueba manual.
`GET /me` también admite una identidad válida aún sin roles y devuelve su falta
de acceso; la autenticación de dispositivo sólo se admite en las rutas que la
declaran y no concede permisos de administración de empresa.

## Límites que explican el progreso actual

1. **No existe superadmin de producto.** Un `admin` de Keycloak `master`
   administra identidad. El API Zenit no convierte ese permiso en acceso a
   empresas: obtiene sus roles del producto y una sola empresa por persona.
   No hay selector global de empresas ni acceso transversal implementado.
2. **El operador no administra datos internos de empresas.** Puede dar de alta,
   suspender/reactivar y ayudar a desligar una cuenta administradora. La UI web
   de operador todavía muestra un aviso; esas operaciones existen por API.
3. **Empleado y usuario no son sinónimos.** Puede haber padrón sin cuentas de
   acceso y usuarios administrativos que no sean empleados. Crear uno no crea otro.
4. **El móvil tiene dos recorridos.** `MainActivity` usa activación, NFC, firmas,
   Room y sincronización reales. `PresentationActivity`, disponible en debug,
   muestra semana, acuse y Administración/RH con datos ficticios y estado de vista.
   El formulario de esa presentación no autentica contra Keycloak.
5. **La captura no está lista para tarjeta real.** Android bloquea esa captura
   en release y el backend sólo verifica la tarjeta simulada si se habilita
   expresamente. No se considera captura autenticada de producción.
6. **Lo laboral pendiente no se presenta como implementado.** No hay cálculo
   por tipo de jornada, comparación de horarios, retardos, faltas ni ausencias.
   El cálculo agrupa tramos por su inicio y conserva la regla vigente al final
   de semana. Las categorías del prototipo móvil no cambian esas reglas.
7. **Correo y altas del equipo siguen pendientes.** SMTP se está tramitando;
   los tres superadmins están declarados para alta, no provisionados en servidor.
   El operador interno sin buzón todavía no cumple el mecanismo actual de correo
   verificado. La alternativa de autorización por identificador interno se propuso,
   pero no se implementó al priorizar esta revisión de flujos.

Por indicación de Alexis, el acceso futuro de superadmins a ambas plataformas
y a datos reales queda diferido mientras se revisa esta lógica; no se amplían
permisos ni se habilita suplantación durante esta documentación.

## Visualizar y comprobar

Se validaron y renderizaron los **17 diagramas** con PlantUML 1.2026.8.
Los SVG/PNG de revisión se generan en `build/flujos/`, ignorado por Git;
los `.puml` son la fuente mantenida en el repositorio.

Con Java y un JAR oficial de [PlantUML](https://plantuml.com/starting):

```powershell
java '-Djava.awt.headless=true' -jar build/tools/plantuml-1.2026.8.jar -charset UTF-8 -checkonly 'docs/flujos/*.puml'
New-Item -ItemType Directory -Path build/flujos -Force | Out-Null
java '-Djava.awt.headless=true' -jar build/tools/plantuml-1.2026.8.jar -charset UTF-8 -tsvg -o (Resolve-Path build/flujos).Path 'docs/flujos/*.puml'
```

El JAR de validación se descargó del repositorio oficial a `build/tools/`, sin
agregar dependencias al backend, portal ni móvil. Los diagramas de arquitectura,
datos y canales usan Smetana para no exigir una instalación propia de Graphviz.
Cambiar un flujo exige revisar su fuente, contrato, permisos y consumidores;
esta documentación no modifica su comportamiento.
