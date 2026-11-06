# QA Android física — 5 de noviembre de 2026

**Resultado:** 15 unitarias, lint y ambos APK actuales aprobados. Autoensayo
en Samsung SM-S928B con **Android 17/API 37**, app debug 0.1.0/1, target 36:
`OK: FIXTURE`, código de instrumentación -1. Tras iniciar el usuario el
entorno Docker aislado, aprobó también el flujo **personal contra backend
real**, incluido el acuse de dos versiones de cierre y su huella SHA-256.
**Terminal también aprobado** tras reconectar USB: cola conservada,
sincronización idempotente y semana personal denegada con 403. Accesos
ficticios retirados y archivos operativos del teléfono idénticos al final.

## Fuente, compilación y conservación

Base `4d8c6aa`, árbol Android `16f8c58e4a047c1505bdece98f3d24b00fc3841c`,
sin cambios locales en Android. La mejora local del verificador E6 es
independiente y no se presenta como probada por este autoensayo del teléfono.

Gradle 9.6.0/JDK 25 y SDK ya instalado, compilación sin red con salida
aislada en `build/android-check/`: `testDebugUnitTest`, `lintDebug`,
`assembleDebug` y `assembleDebugAndroidTest`. **15 pruebas sin fallos ni
omisiones; lint: 0 errores y 7 advertencias**. No se agregaron dependencias
ni se cambió configuración versionada para compilar.

Se preservaron ambos APK instalados y se verificó que los nuevos conservan
sus certificados. Actualización mediante `adb install -r`, sin desinstalar
ni borrar datos. SHA-256 de los APK nuevos instalados:

| APK | SHA-256 |
| --- | --- |
| App debug | `3c02b9d180fa2bf51d1f3f435c3fe7b417b16d1e0ee3810517f909e9169f99a0` |
| Instrumentación debug | `b8bcff634bc22c0bfb05267f869c87ceb27ff38fa9e4523acb69e608b85cba5c` |

Se compararon antes y después las huellas de `capture_device.xml`,
`attendance-offline.db` y su WAL: **los tres archivos operativos permanecen
idénticos**. El autoensayo usa almacenamiento protegido del dispositivo
separado del almacén normal de la app. Se repitió la comparación al terminar
ambos modos contra backend real, con el mismo resultado. El túnel ADB
añadido para ese recorrido se retiró; la lista final de túneles está vacía.

## Qué se ejecutó

Primero aprobó el autoensayo instalado, como línea base tras la actualización
del sistema del teléfono. Después se repitió con app e instrumentación
compiladas de las fuentes actuales; no se sustituye esa segunda ejecución
por un resultado histórico.

La instrumentación comprueba Keystore ES256 no exportable, migración sin
pérdida, activación, cola cifrada, reintento idéntico, rechazo de recibos
ajenos, recibos aceptados/rechazados, captura durante sincronización lenta y
reenrolamiento conservando pendientes. Incluye consulta y acuse, recuperación
desde HTTP de ensayo y límites de terminal. Ese servidor HTTP vive en la
fixture; no es el backend de Zenit.

## Backend real local

El acceso al motor Docker desde esta sesión continúa denegado, aunque el
usuario puede operarlo desde su terminal. Él inició `zenit-android-check`
con PostgreSQL, Keycloak y backend saludables y migración finalizada. Al
detectar el puerto 38082 ocupado se usaron **48080/48082**, sin detener el
entorno existente. Salud HTTP `UP` e issuer
`http://localhost:48082/realms/zenit` comprobados desde esta sesión.

Se creó una empresa ficticia con padrón, tarjetas **simuladas**, dos códigos
de vinculación, cuentas y cliente de identidad temporales. No se modificó
la política global de identidad. El teléfono accedió por un túnel ADB
dinámico exclusivo del ensayo al puerto 48080; cada fase usa un proceso
nuevo y el almacén protegido aislado.

**Personal aprobado:** activación con ES256 no exportable, código de un uso
(reutilización 410), tres capturas cifradas con transporte interrumpido,
persistencia sin cambiar los sobres y sin renovar sesión con pendientes.
Tras 61 segundos entre entrada y salida, sincronización con dos aceptados y
una tarjeta desconocida rechazada; repetición idempotente sin duplicados y
renovación de sesión. Consulta semanal, objeción, recuperación sin copia
local y duplicado 409; reapertura, cierre versión 2 y conformidad también
recuperada. El servidor confirmó exactamente dos marcajes personales,
versión 1 reabierta con objeción y versión 2 con conformidad. Las dos huellas
del acuse se recalcularon independientemente con cierre, contenido, fecha y
dispositivo: coinciden.

La semana cerrada es la anterior, **2026-10-26**, sin marcajes; comprueba
versiones/acuses, no el cálculo sobre los eventos capturados esta semana.
El JAR de backend montado tiene SHA-256
`968e5522c13673c7f6c2d97faec601407ba906e04a8d1545ac26a8d91293bd2d`.
No se atribuye a este recorrido la ejecución del nuevo verificador E6 ni de
la suite completa de integración PostgreSQL.

**Terminal aprobado:** activación previa aprobada. La desconexión USB
impidió recoger el resultado final de la fase de cola; al reconectar, una
copia local de su base aislada confirmó **tres filas `pending_signed`**.
Se continuó sin borrar ni volver a capturar. Sincronización aprobada desde
otro proceso: dos aceptados y tarjeta desconocida rechazada, cola vacía,
recibos conservados, repetición con los mismos eventos y renovación de
sesión. La instrumentación también comprobó el rechazo local de semana
personal y el **403 del backend** para una petición firmada de terminal.
Ambas fases finales devolvieron `OK: BACKEND` y código -1. No se atribuye
una salida instrumental final a la fase de cola cuyo transporte se perdió.

**Cierre del ensayo:** la API confirmó exactamente dos marcajes por modo,
sin duplicados, y los dos acuses con sus versiones y huellas. Se revocaron
todos los dispositivos de esta fixture (cero activos), se suspendió sólo su
empresa y se eliminaron las cuentas y el cliente de identidad temporales
creados por este ensayo. Se retiraron las credenciales del archivo privado
de estado y el túnel ADB propio. La vinculación, base operativa y WAL del
teléfono conservaron exactamente sus tres SHA-256 originales. Los servicios
Docker iniciados por el usuario permanecen disponibles.

Evidencia adicional local: `android-live-personal-*.log`,
`android-live-terminal-activate.log`, `android-live-terminal-sync.log`,
`android-live-terminal-week.log`, `android-live-personal-evidence.json`,
`android-live-evidence.json` y `android-data-after-live.txt`.
El estado privado permanece en `secrets/`, ignorado por Git, sin las
contraseñas, secretos OTP ni tokens temporales.

## Comprobación inicial de Docker y límites

Se revisaron `desktop-linux` y las tuberías `dockerDesktopLinuxEngine` y
`docker_engine`: acceso denegado. No se infiere que Docker esté apagado.
No había backend/identidad escuchando en los puertos locales habituales
revisados (8080/8081/8082, 18080, 38080/38082 y 5432).

Esa comprobación precede al arranque manual y al recorrido real descrito
arriba. No se reconstruyeron imágenes desde esta sesión. No se probó tarjeta
NFC autenticada, apagado físico de radios, aviso visual de comida sin red,
servidor público ni aceptación integral. Esas comprobaciones conservan sus
requisitos.

Evidencia local ignorada por Git en `build/continuacion-qa/`:
`android-build.log`, `android-installed-fixture.log`,
`android-current-fixture.log`, `android-data-before.txt`,
`android-data-after-current.txt`, `android-apks/apks.json` y
`android-evidence.json`. Los APK anteriores también se preservan allí.
