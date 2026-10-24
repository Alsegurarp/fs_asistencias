# Retención Android: análisis y alcance mínimo

## Criterio recibido el 23 de octubre de 2026

El usuario establece como base la legislación mexicana y la reforma de
jornada. La [revisión oficial actualizada](revision-juridica-jornada-acuse.md#actualización-del-23-de-octubre-de-2026-conservación-y-uso-de-datos)
separa las obligaciones del empleador de la copia del teléfono:

- El archivo laboral debe cubrir el último año de controles y el año
  posterior a la terminación de la relación conforme al artículo 804 LFT.
  Una fila de más de un año no queda liberada automáticamente. Si faltan
  fecha efectiva de terminación o información sobre impedimentos de borrado,
  no puede darse por vencida su conservación sólo por antigüedad.
- Los registros que correspondan a nóminas/listas de raya para seguridad
  social tienen además el plazo del artículo 15 II LSS. No se extiende esa
  clasificación automáticamente a todos los datos del teléfono.
- El servidor o archivo del empleador debe conservar evidencia íntegra,
  accesible y reproducible. Un respaldo que rota a 30 días no es el archivo
  de conservación laboral. El cambio de tope a 46 horas en 2027 tampoco
  acorta el plazo documental ni autoriza borrar versiones anteriores.
- La finalidad, acceso y posterior bloqueo/supresión deben atender la
  LFPDPPP. Conservar sin límite y sin finalidad no es la política definitiva.

**Resultado aplicable ahora:** no activar una purga ciega Android. Pendientes,
rechazos y acuses históricos conservan su protección; la recuperación actual
no permite reemplazar toda esa evidencia local. Para eliminar duplicados
procesados falta comprobar su archivo completo y elegir la disponibilidad
operativa de la copia local. La LFT no fija para esa caché un número de días
que permita deducirlo del máximo de jornada semanal.

Q14 ya tiene una base normativa recibida del usuario; continúan abiertos el
archivo/recuperación de evidencia y el plazo operativo de duplicados locales.
No se añadió migración, fecha artificial ni borrado mientras dependan de ello.

La [precisión sobre recuperación y terceros](revision-juridica-jornada-acuse.md#recuperación-por-el-empleador-y-servicios-de-terceros)
distingue la entrega al empleador, la restauración del servicio y la
certificación de documentos. No hay una exigencia general de que un tercero
habilite cada recuperación; el expediente completo por empresa sigue sin
implementarse y el respaldo multiempresa no se entrega a un cliente.

## Actualización de expediente y MFA del 23 de octubre

El usuario aprueba [las metas del expediente por empresa](expediente-empresa.md),
con permiso específico y autorización nueva por descarga respaldada por MFA.
La comprobación de identidad no demuestra conservación ni recuperación de
sobres/recibos. Completar ese archivo y comprobar su consulta fuera de Zenit
es un paso previo a suprimir al terminar el servicio; no fija por sí solo un
plazo de caché móvil. Se conservan Q14 y los límites de rechazos/acuses
descritos abajo; la prueba aislada de MFA no habilita ninguna purga.

## Análisis inicial del 22 de octubre

Revisión de código del 22 de octubre de 2026, desde `main`/`ad21177`.
Completa el análisis solicitado, no implementa ni habilita una purga.
La tarea global 10 conserva la decisión Q14: plazos por tipo de evidencia,
conservación en servidor y condiciones de eliminación. No se eligió un plazo.

## Qué se acumula actualmente

| Almacén | Contenido y comportamiento |
| --- | --- |
| Room, `attendance-offline.db`, versión 2 | `pending_attendance_event` conserva el sobre firmado cifrado, IV, fecha de captura, estado y, al completar, recibo cifrado e IV. `complete` cambia sólo filas `pending_signed`, dentro de una transacción de sincronización. No hay borrado. |
| Estados pendientes | `pending_signed` es la cola actual. `pending` y `previous_device` conservan marcajes anteriores que no se deben reenviar automáticamente desde la nueva vinculación. La antigüedad no demuestra que hayan sido atendidos. |
| Estados procesados | `accepted`, `accepted_with_incident` y `rejected` conservan sobre y recibo. El límite de diez recibos de `observeReceipts` sólo afecta a la consulta visible; las demás filas permanecen. |
| Preferencias `capture_device` | Registro del dispositivo, aviso y acuses cifrados bajo `ack:<deviceId>:<closureId>`. Cada nueva versión/dispositivo puede añadir otra clave. No hay purga de acuses. |
| Android Keystore | AES-GCM cifra ambos almacenes. Borrar su clave dejaría ilegibles tanto pendientes como recibos; no es un mecanismo de retención. Las claves de firma también quedan fuera del alcance de esta purga. |

La app tiene copia de seguridad automática deshabilitada. Desinstalar,
borrar datos o reemplazar la base no es una solución de retención: puede
perder marcajes pendientes y claves necesarias para descifrarlos.

## Qué conserva el servidor y qué no sustituye todavía

`attendance_event` conserva el sobre firmado original, su hash, identidad,
sesión y consecutivo. `location_evidence` conserva la ubicación por separado.
`attendance_rejection` conserva motivo, tiempos y hash, pero **no el sobre
rechazado completo**. No debe asumirse que eliminarlo del teléfono conserva
la misma evidencia en el servidor.

El reenvío idempotente recupera un recibo a partir de registros del servidor,
pero requiere conservar el sobre y una autenticación de dispositivo válida.
El recibo aceptado reconstruye nombre de empleado/sede desde los catálogos
actuales; no equivale necesariamente a una copia idéntica del recibo local.
La lista administrativa de marcajes tampoco entrega el recibo completo de
cada rechazo para restaurarlo al teléfono.

La consulta personal recupera el acuse del **cierre vigente**. La reapertura
retira su vigencia y un cierre nuevo no hereda el anterior. El backend
conserva el histórico, pero esa consulta no ofrece todo el expediente de
acuses de versiones anteriores. Android usa además la copia local con
servidores antiguos que omiten `acknowledgement`. Su eliminación requiere
decidir compatibilidad y acceso al histórico, no sólo un número de días.

## Implementación mínima después de Q14

1. Recibir días y condiciones para aceptados, aceptados con incidencia,
   rechazados y acuses. Definir expresamente si un rechazo necesita conservar
   el sobre original fuera del teléfono y qué acceso histórico se garantiza.
2. Añadir una fecha de procesamiento local a la entidad Room y una migración
   nueva. `capturedAtEpochMillis` mide captura, no el tiempo desde la recepción
   del recibo. Las filas antiguas sin fecha conocida se conservan hasta tener
   un criterio explícito; no se inventa su antigüedad.
3. Ejecutar una eliminación acotada de estados procesados con recibo íntegro,
   fecha válida y plazo vencido. Nunca seleccionar `pending_signed`,
   `pending` o `previous_device`, aunque sean antiguos. Mantener validación
   completa del lote antes de `complete`, transacciones y coordinación con
   la sincronización/revinculación; un error de red no habilita la purga.
4. Tratar los acuses por separado en `DeviceStore`, sólo cuando Q14 permita
   retirarlos y se haya comprobado su recuperación/histórico aplicable.
   No borrar registro, avisos, claves criptográficas ni toda la preferencia.
5. Reutilizar WorkManager y la infraestructura Room existente. No hacen falta
   dependencias, un servicio nuevo ni un ajuste público antes de definir la
   política. El espacio ocupado debe medirse después de implementar; un
   `DELETE` de SQLite no implica reducir inmediatamente el archivo físico.

Archivos afectados al implementar: `PendingAttendanceEvent.kt`,
`PendingAttendanceDao.kt`, `AttendanceDatabase.kt` y su esquema exportado,
`AttendanceRepository.kt`, `AttendanceSyncWorker.kt`, `DeviceStore.kt` y la
instrumentación de `SmokeInstrumentation`. La interfaz sólo necesita cambios
si la política altera la disponibilidad de recibos/históricos para el usuario.

## Comprobación necesaria al implementar

Con una base Room de ensayo: conservar los tres estados pendientes, filas
sin recibo, sin fecha o con fecha futura; probar cada estado procesado antes,
en y después del vencimiento; migrar desde versión 2 sin pérdida; interrumpir
sincronización y repetir sin perder pendientes ni duplicar eventos; probar
revinculación, recibos de dispositivo anterior y acuses de otra versión.
Comprobar que el acceso al servidor acordado en Q14 recupera la evidencia
necesaria antes de permitir su eliminación local.

Esta sesión inspeccionó código y esquema. No cambió código Android, no tocó
el teléfono ni ejecutó un ensayo de borrado. Sigue vigente el `shortcut:`
documentado en el DAO hasta recibir y aplicar la política.
