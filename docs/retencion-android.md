# Retención Android: análisis y alcance mínimo

## Contraste de evidencia para continuar — 5 de noviembre de 2026

Revisión sobre `main/2ab9745`, después de integrar la PR #27. No se añade
purga ni se cambia la custodia. El archivo actual permite recuperar datos
del servidor, pero no reproduce todo lo que conserva el teléfono.

| Evidencia | Android | Servidor / expediente formato 1 | Falta para reemplazar la copia local |
| --- | --- | --- | --- |
| Marcaje aceptado o con incidencia | Sobre JWS original y recibo cifrados en Room | `attendance_event.envelope` y `payload_sha256`; ubicación, dispositivo/sesión y referencias incluidos en expediente | Comprobar recuperación del sobre exacto y sus relaciones. No confundir la consulta administrativa con restaurar el recibo local |
| Recibo aceptado | Objeto JSON recibido, serializado y cifrado | El reenvío reconstruye el recibo con los nombres actuales del padrón/sede; no hay colección de recibos originales | Decidir si se exige el recibo original o una reconstrucción identificada como tal, y demostrar su disponibilidad sin credencial vigente del dispositivo anterior |
| Rechazo con clave identificable | Sobre original y recibo, incluidos código/mensaje | `attendance_rejection` conserva clave, dispositivo, tiempos, hash y motivo; el expediente incluye esas columnas, sin sobre original | Archivo recuperable del sobre rechazado y su enlace al recibo. El hash no permite reconstruir el contenido |
| Rechazo sin clave identificable | El lote puede asociar el recibo de clave cero por posición y conservarlo con el sobre local | `CaptureProcessor.process` sólo inserta rechazo si puede obtener `echoKey`; sin clave no se conserva esa fila | Resolver también este caso; añadir sólo una columna al rechazo existente no archivaría los rechazos sin fila |
| Acuse de cierre | `DeviceStore` cifra la respuesta bajo `ack:<deviceId>:<closureId>` | `closure_acknowledgement` conserva tipo, nota, actor, fecha y huella; expediente conserva todas las versiones retenidas | Recuperación histórica comprobada. `/me/attendance` devuelve el cierre vigente, no todos los acuses que pudieron quedar en el teléfono |
| Documento/texto mostrado al acusar | La copia local guarda la respuesta del API, no una versión del texto de la interfaz | No hay texto/documento versionado en el registro del acuse ni en el expediente | Instrumentar su conservación para los acuses futuros tras definir el documento; no inventar texto para acuses anteriores |
| Cierre y reapertura | Consulta/copia correspondiente a la versión recibida | Snapshot textual, hash, versión de regla, totales y reapertura conservados en `week_closure`; el verificador comprueba la huella del snapshot | Aceptación de consulta fuera de Zenit con una entrega real y anclajes obtenidos por canal confiable |

Referencias contrastadas: [cola y transición transaccional](../android/app/src/main/kotlin/mx/fastsolution/zenit/mobile/data/AttendanceRepository.kt),
[DAO sin borrado](../android/app/src/main/kotlin/mx/fastsolution/zenit/mobile/data/PendingAttendanceDao.kt),
[acuse local](../android/app/src/main/kotlin/mx/fastsolution/zenit/mobile/data/DeviceStore.kt),
[captura y recibos](../backend/src/main/kotlin/mx/fastsolution/zenit/capture/Capture.kt),
[consulta semanal](../backend/src/main/kotlin/mx/fastsolution/zenit/workday/Weeks.kt),
[cierre y huella del acuse](../backend/src/main/kotlin/mx/fastsolution/zenit/workday/Closures.kt),
[columnas y límites del archivo](../backend/src/main/kotlin/mx/fastsolution/zenit/dossier/DossierArchive.kt)
y [verificador independiente](../backend/src/dossierVerifier/kotlin/mx/fastsolution/zenit/dossier/DossierVerifier.kt).

**Siguiente desarrollo delimitado:** acordar el destino recuperable de sobres
rechazados, incluidos los que carecen de clave, y la fidelidad requerida del
recibo; definir el documento del acuse y guardar su versión para registros
nuevos. Después probar recuperación con cierre reabierto, acuse antiguo,
dispositivo revocado y acceso sin Zenit. Sólo tras esa garantía y la definición
de disponibilidad de duplicados puede implementarse purga acotada. Los tres
estados pendientes siguen excluidos; no se modifica ni migra Room por esta
revisión. Las copias cifradas necesitan además su clave del Keystore: copiar
los archivos de la app no demuestra que otra instalación pueda descifrarlos.

La revisión es de código y formato. Las pruebas de archivo/verificador se
ejecutan con fixtures ficticias; no acredita extracción de un teléfono,
restauración Android ni aceptación integral E6. Los apartados siguientes
conservan sus fechas y contexto originales.

**Ratificación del 5 de noviembre:** Q14 se contesta con los plazos de la
legislación aplicable documentados en la [revisión legal vigente](revision-juridica-jornada-acuse.md#respuestas-legales-aplicables--5-de-noviembre-de-2026).
No requiere elegir otra vez el mínimo de conservación laboral. Quedan
archivo de evidencia local aún ausente, recuperación comprobada y
disponibilidad de duplicados. E1–E5 y E6 técnica ya están integradas; las
referencias anteriores a un expediente sin implementar son históricas.
Esto no habilita purga ni cierra aceptación integral.

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
