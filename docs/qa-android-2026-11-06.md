# Android — vigencia de comida sin servidor, 6 de noviembre de 2026

Base sincronizada con `origin/main/5b0a66c`, que incluye la PR #29.
Los cambios locales previos de la bitácora se conservaron. Se revisaron los
17 pendientes con dos agentes: E6/evidencia y comida Android. No se volvió
a desarrollar la integridad de acuses que ya está integrada.

## Defecto y corrección

`AttendanceViewModel.state` recalculaba la política de comida y su aviso
sólo al recibir cambios de registro, cola, recibos o una operación. Con la
pantalla abierta sin actividad podía mantener la política anterior después
de su vigencia, aunque `AttendanceRepository.capture()` ya aplicaba la nueva.

El registro observado ahora emite al comenzar y al llegar `effectiveAt`.
La espera se cancela al cambiar la sesión o dejar de observar la pantalla;
al volver se relee el estado. No hay sondeo periódico ni petición de red.
Se conserva la validación de captura y el formato de sesión. El selector
existente recibe el nuevo estado y conserva su limpieza de tipos de comida
cuando dejan de admitirse. No cambian backend, contrato, datos ni claves.

## Comprobaciones nuevas

- **17 unitarias aprobadas**, cero fallos, errores u omisiones; dos nuevas
  comprueban la transición temporal sin otra operación y la ausencia de
  espera adicional cuando no hay cambio futuro.
- **Lint y APK debug/instrumentación aprobados:** cero errores y 11 avisos
  en configuración o código ajeno a esta corrección. No se actualizaron
  dependencias. Gradle 9.6.0/JDK 25 con dependencias locales sin red;
  compilación completada pese al aviso de acceso al daemon de Kotlin.
- **Samsung SM-S928B, Android 17/API 37:** ambos APK actualizados con el
  mismo certificado que los instalados, sin desinstalar. Autoensayo final
  `OK: FIXTURE` y `INSTRUMENTATION_CODE: -1`.
- La instrumentación usa el almacén protegido separado del operativo.
  Después de cerrar su servidor HTTP conserva una sesión ficticia apuntada
  a un puerto sin servicio. Para ambos sentidos de comida observa la
  política anterior y aviso, espera la vigencia de prueba de un segundo
  sin otra escritura, y comprueba la política nueva y retirada del aviso.
- Vinculación operativa, base Room y WAL conservaron exactamente sus tres
  SHA-256 anteriores. No se añadió túnel ADB ni se cambiaron las radios.

Evidencia local ignorada por Git: `build/qa-android-20261106/`, con registro
de compilación, `fixture.log`, `data-before.txt`, `data-after.txt`, APK previos
y actualizados y `device-evidence.json`. Los resultados unitarios/lint están
en `build/android-check/app/`.

## Límites y siguiente trabajo

La prueba física acredita temporizador y política/aviso desde sesión local;
**no es un recorrido visual de Compose**, ni simula una programación válida
por API con siete días de aviso. No se probó reloj adelantado manualmente,
apagado físico de radios, tarjeta NFC autenticada ni servidor público.
La tarea 13 avanza parcialmente; siguen 17 tareas abiertas y seis P0.

Docker Desktop se inició y respondió fuera del sandbox, sin contenedores en
ejecución; no se levantaron backend/identidad. El siguiente ensayo E6 sigue
siendo crear y descargar con MFA un expediente ficticio nuevo con cierres
reabierto/vigente y acuses objetado/conforme, ejecutar el JAR actualizado sin
red con las dos huellas del API y consultar ambos históricos. Después quedan
recorrido visual de comida y accesibilidad con sesión real. Provisión
VPS/S3, SMTP diferido, custodia de tarjetas y aceptación conservan sus
dependencias. No hubo commit, publicación, despliegue ni purga.
