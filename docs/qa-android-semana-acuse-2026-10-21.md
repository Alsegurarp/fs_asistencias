# Semana y acuse Android contra backend local — 21 de octubre de 2026

**Recorrido visual aprobado en Samsung SM-S928B, API 36, contra el backend
real local.** Se completaron las dos acciones autorizadas tras la revisión
de avance: levantar el entorno y comprobar semana/acuse desde el teléfono.
Corresponden al entorno local y a parte de la tarea global 15; no cierran las
tareas globales 1 (respaldo externo) y 2 (identidad operativa).

## Entorno

- Código: `main`/`4852c66`; se conservaron los cambios preexistentes de
  `backend/bin/` y de la bitácora. No se modificó código del producto ni APK.
- Se iniciaron los contenedores existentes con `docker compose up --detach`,
  sin borrar volúmenes, recrear bases ni cambiar secretos operativos.
- Backend `http://localhost:18080`: HTTP 200 y salud `UP`; portal
  `http://localhost:8081`: 200; descubrimiento de identidad en
  `http://localhost:8082/realms/zenit`: 200. API `/api/v1/me`: 401 sin sesión.
- PostgreSQL y Keycloak saludables; V001–V008 exitosas y migrador terminado
  con código 0. Los cuatro servicios quedan levantados al finalizar.
- La app usó un túnel ADB temporal hacia el backend. Se retiró al terminar;
  no se cambiaron Wi-Fi, datos móviles ni permisos del teléfono.
- APK instalado SHA-256:
  `F1024E351D455C3D06C998BD3E41E7B68CA4E8025FE76C157FAC0CA2C3B5F9B0`.
  Coincide con el comprobado en A5; no fue necesario compilar o reinstalar.

## Datos y ejecución

Se creó una empresa ficticia aislada, dos identidades ficticias con OTP,
un empleado, una sede y una tarjeta simulada. El arranque de empresa y
administrador siguió el patrón local de `bootstrap-local-demo.ps1`, mediante
el rol migrador y con auditoría; los demás recursos se prepararon por API.
La cuenta administrativa y la de trabajador iniciaron sesión mediante
Keycloak sin desactivar OTP. Credenciales, tokens y claves quedaron en
`secrets/`, fuera de Git.

Un dispositivo simulado firmado preparó dos marcajes aceptados, separados
por ocho horas, para la semana que comienza el `2026-10-14`, zona
`America/Mexico_City`. La empresa usa inicio de semana en miércoles. El
teléfono se vinculó después desde la interfaz operativa, con código de un
uso; esa vinculación reemplazó el dispositivo personal anterior del ensayo.
Los marcajes preparados no acreditan lectura NFC física.

La navegación, consulta y envío se realizaron mediante la interfaz Android,
controlada por ADB, con capturas y jerarquías UI. No se usó el servidor
`FixtureServer` ni las pantallas de presentación.
El verificador de la evidencia aprobó 11 comprobaciones del recorrido,
además de restauración, limpieza y estado final de los servicios.

| Comprobación | Resultado |
| --- | --- |
| Vinculación personal | La interfaz muestra la empresa y empleado ficticios; cero pendientes. |
| Semana vacía | `2026-10-07`: provisional, cero horas y sin opción de acuse. |
| Semana cerrada | Versión 1, 480 minutos, tramo y horas en la zona de la empresa. |
| Revisión y confirmación | Ambos botones deshabilitados antes de revisar; confirmación con semana/versión y cancelación que conserva el comentario. |
| Objeción | Envío desde Android, comentario conservado y recibo real confirmado por API, con referencia SHA-256. |
| Recuperación desde servidor | Se cerró el proceso y retiró exclusivamente el recibo local del cierre ficticio. Al consultar otra vez, Android mostró el mismo acuse del backend. |
| Duplicado | Una sesión real de Trabajador recibe 409 `already_acknowledged`; permanece el acuse original. |
| Reapertura | Android muestra Reabierto, retira el acuse vigente y no ofrece responder. |
| Nuevo cierre | Versión 2 con identificador nuevo, sin heredar acuse; el histórico de versión 1 conserva la objeción. |
| Conformidad | Envío explícito desde Android para versión 2, sin comentario; backend confirma un recibo nuevo. |

## Limpieza y evidencia

Limpieza terminada a las `20:05:05 UTC`: empresa suspendida, tarjeta revocada,
dispositivo del teléfono revocado y dispositivo preparador en estado
`replaced`. Ambas identidades se deshabilitaron y cerraron sus sesiones; se
deshabilitó también el usuario Trabajador del producto. El último
administrador del producto se conserva por su regla de integridad, con su
identidad deshabilitada y la empresa suspendida. Se conservan dos marcajes,
dos versiones de cierre, dos acuses y su auditoría.

Antes de cambiar la vinculación se respaldaron las preferencias cifradas del
teléfono, con cero pendientes. Al terminar se restauraron byte por byte:
SHA-256 `FD2AE25D6186ED952F3E2D430EE2BA5A1A9114BCB90CF04188BC4050F524066C`.
No se desinstaló la app ni se borró su base de marcajes. El túnel ADB de
ensayo quedó retirado.

Evidencia local ignorada por Git: `build/qa-android-week-2026-10-21/`, con
`results.json`, comprobaciones HTTP, restauración del teléfono, jerarquías UI
y capturas de semana vacía, objeción, recuperación, reapertura y conformidad.
Los guiones de esta ejecución quedaron en `build/`; no son un nuevo
autoensayo versionado. Se corrigieron sus comprobaciones de limpieza para
respetar `replaced`, la revocación ya realizada y la protección del último
administrador. Un primer intento de duplicado con el dispositivo reemplazado
recibió 401; el resultado 409 se obtuvo después con la sesión válida del
Trabajador, como recoge la tabla.

SHA-256 de `results.json` después de verificar la evidencia:
`589DB86B28C3E3A7E713A85DDD88B13BC166B072CFC667C65D8365C4C521ECFF`.

## Alcance pendiente

Se completa el recorrido técnico visual local de semana/acuse. Permanecen
la aceptación del usuario y pública, el expediente completo, las reglas y
evidencia jurídicas, y la captura autenticada con tarjeta física. No se
repitieron compilación, suites completas, pruebas con radios apagados ni
despliegue HTTPS. Las 17 tareas globales conservan sus alcances abiertos.
