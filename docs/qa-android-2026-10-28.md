# QA Android local — 28 de octubre de 2026

**Resultado:** construcción, autoensayo, navegación visual y recorrido técnico
con backend real local aprobados en Samsung **SM-S928B**, Android 16/API 36,
app debug **0.1.0/1**. No acredita NFC autenticado ni aceptación pública.
La rama de entrega es `feat/expediente-e4-e6-qa`.
Código funcional `0a1f9a2`, publicado en la
[PR #22](https://github.com/Alsegurarp/fs_asistencias/pull/22) contra main;
sin integrar ni desplegar al publicar.

## Entorno y conservación

APK e instrumentación construidos con `android/Dockerfile`; **13 unitarias
aprobadas, lint y ambos APK correctos**. Se firmaron dentro de Docker con la
clave debug existente y se instalaron mediante `adb install -r`, sin
desinstalar, borrar datos ni cambiar la vinculación original de la app.

SHA-256 de los APK instalados:

- App: `dd7635e0e3ef0744ccff66da43d560c7454751283dfcaf33b3a50815799f2ac1`.
- Instrumentación final:
  `b8bcff634bc22c0bfb05267f869c87ceb27ff38fa9e4523acb69e608b85cba5c`.

El backend de prueba es `http://127.0.0.1:38080`, mediante `adb reverse`,
en el entorno ficticio separado `zenit-e4-e5-check`; la tarjeta simulada está
habilitada sólo allí. Instrumentación usa almacenamiento protegido del
dispositivo distinto del almacén normal de la app. Los datos, credenciales,
códigos y capturas del ensayo no se versionan.

La conexión USB se perdió y volvió durante la sesión. Se restableció el
túnel tras reconectar; esto no se presenta como prueba con radios apagadas
ni con dos IP públicas. El dispositivo volvió a aparecer autorizado.

## Comprobaciones

| Caso | Resultado |
| --- | --- |
| Autoensayo aislado | `OK: FIXTURE`, código -1: Keystore ES256 no exportable, migración sin pérdida, activación, cola cifrada, reintento idéntico, recibos, captura concurrente y reenrolamiento sin borrado; incluye semana/acuse con HTTP de ensayo y límites de terminal |
| Inicio y selección de acceso | Mi asistencia y Administración accesibles, textos formales y controles legibles |
| Navegación operativa del 26 | Inicio, Mi semana, Actividad y Dispositivo comprobados por jerarquía y capturas; navegación inferior visible y estados diferenciados |
| Vinculación original | Conserva empresa/vínculo y recibos previos, sin pendientes visibles. Sesión original vencida; Mi semana informa que no pudo consultar su servidor. Se comprobó ese manejo del error, no una consulta exitosa de esa vinculación |
| Estado del teléfono | NFC disponible, ubicación ya permitida y renovación de sesión indicada; no se modificaron permisos del sistema |
| Administración integrada | WebView muestra el portal público y su acceso de inicio de sesión. Sin autenticación ni cambios públicos; no acepta los recorridos públicos completos |
| Personal: activación | Código de un uso, firma/clave no exportable y rechazo al reutilizar código; `OK: BACKEND personal activate` |
| Personal: cola | Tres sobres cifrados, transporte interrumpido sólo en el ensayo, mismos IDs/bytes conservados y recuperación en otro proceso; `OK: BACKEND personal queue` |
| Personal: sincronización | Dos marcajes aceptados, tarjeta desconocida rechazada, recibos conservados, reenvío idempotente sin duplicados y sesión renovada; `OK: BACKEND personal sync` |
| Semana y objeción reales locales | Consulta de semana/cierre por aserción de dispositivo; objeción con huella SHA-256, copia local eliminada sólo en el ensayo, recuperación desde servidor y segundo acuse rechazado con 409 |
| Reapertura y conformidad | Cierre versión 1 conserva objeción al reabrir; versión 2 recibe conformidad, recuperación sin copia local y rechazo de duplicado. Confirmado también mediante API administrativa de QA |
| Terminal: activación/sincronización | Activación de un uso y sincronización de tres pendientes entre procesos; dos aceptados, uno rechazado, idempotencia y renovación aprobadas |
| Reconexión USB | Una sincronización terminal falló por túnel perdido; se repuso `adb reverse` y los tres pendientes conservados se sincronizaron correctamente |
| Terminal: semana personal | Rechazo local y **403 del backend real** al intentar consultar `/me/attendance`; `OK: BACKEND terminal week` |

La semana cerrada del ensayo es **2026-10-19**, sin marcajes previos en esa
empresa ficticia: los cierres tienen cero minutos. Los cuatro marcajes
aceptados del teléfono corresponden a la semana actual. Este caso comprueba
protocolo, vínculo, versiones y acuses; no reemplaza las pruebas de cálculo
de jornada ni la historia visual con horas del acta del 21.

La nueva fase reutilizable `week` de `BackendSmoke.kt` permite repetir la
consulta/acuse con `date`, `closureId` y `ackType`, o comprobar el rechazo
terminal. Ejecuta aserciones de la respuesta contractual, huella, recuperación
y duplicado. No añade funciones al producto ni permite saltarse credenciales.

## Cierre y evidencia

Al terminar se verificaron de nuevo las dos versiones y sus acuses mediante
el API de QA, se revocaron los dispositivos ficticios, se suspendió la
empresa de ensayo y se eliminó su cliente temporal de identidad. Cero
dispositivos QA activos; cierre de esa comprobación: **21:54:14 UTC**.
Se retiró el túnel USB añadido. La vinculación original no se sustituyó.

Evidencia local ignorada por Git: `build/e4-e6-android-qa/` (capturas, XML y
`server-evidence.json`), `build/e4-e6-android-*.log`, resultados de la
construcción en `build/e4-e6-android-release-tests/` y APK firmados de esta
sesión. Los intentos fallidos se conservan separados de los resultados finales.
Los logs vacíos por la pérdida de conexión no se contabilizan como aprobados.

No se verificaron autenticidad NFC real, apagado físico de radios, dos IP
públicas, nueva aceptación visual de un cierre real con horas, login público
ni aceptación del usuario/jurídica. Esas tareas conservan sus dependencias;
no se cambia la retención ni se purga evidencia Android.
