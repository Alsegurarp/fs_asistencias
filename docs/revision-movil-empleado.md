# Revisión móvil del empleado

Implementación: 19 de octubre de 2026. Alcance: app Android operativa y su
cliente HTTP. No cambia reglas legales, contratos API, backend ni portal web.
Se conservaron los cambios de trabajo existentes en el repositorio.

## Cambios

- Consulta autenticada `GET /me/attendance?week=` con la clave del dispositivo.
- Sólo modalidad personal; no requiere lectura NFC ni ubicación para consultar.
- NFC declarado opcional para permitir instalar en teléfonos sin lector; se
  informa que la captura necesita un método alternativo autorizado por RH.
- Fecha seleccionable, tramos de trabajo y descanso, horas en la zona de la
  empresa, totales informativos, alertas y conteo de incidencias abiertas.
- Identificador, estado y versión del cierre. Una semana provisional no permite acuse.
- Conformidad u objeción con comentario opcional de hasta 500 caracteres,
  revisión explícita y confirmación antes de enviar al endpoint existente.
- Aviso de marcajes pendientes; no permite conformidad mientras los haya.
- No se reintentan acuses automáticamente tras errores de red. Se distingue
  un envío confirmado de una respuesta que requiere comprobación con RH.
- Recibo cifrado por dispositivo y cierre, recuperable al volver a consultar.
- Copia compartible del resumen y recibo local mediante selector Android.
- Etiqueta «Deducir tipo al leer tarjeta» en lugar de «Automático»: no representa
  asistencia por entrar a la zona.

## Pendientes fuera del móvil

### Administración del servicio y de empresas

El portal ya permite crear empresas y emitir códigos de vinculación personal
por empleado o de terminal por sede. No hay que crear otra asignación sólo
para habilitar consulta y acuse: se utiliza la vinculación personal existente.

Queda configurar por empresa/grupo los métodos de asistencia permitidos y
su alternativa sin NFC/celular, si se aprueba ese alcance; requiere modelo y
autorización backend. La pantalla del desarrollador no puede imponerlo sola.
La configuración de empresa ya está implementada y probada localmente; falta
desplegarla y aceptar sus pantallas. Sigue pendiente la operación de suspensión
desde el portal. Resolver continuidad de captura
y acceso a evidencia cuando termina o se suspende el servicio.

### Backend y producto

- Resuelto localmente en A3: la consulta semanal devuelve el acuse vigente
  desde servidor y Android lo recupera sin depender de su copia local.
  Reapertura y nueva versión no heredan el acuse anterior. Falta aceptar el
  recorrido real con teléfono; [guion](qa-a1-a5.md).
- Exponer marcajes originales, ajustes y sus motivos, historial y seguimiento
  de objeciones para que el trabajador pueda revisar el expediente completo.
- Definir evidencia del acuerdo de ambas partes, texto versionado, copia del
  documento exacto revisado e identidad; el acuse actual no certifica cumplimiento.
- Corregir cálculo diario/semanal, clasificación de jornadas y pausas computables.
- Implementar captura alternativa autorizada sin tarjeta; autenticación de
  tarjetas reales, puntos NFC fijos y nuevas modalidades requieren backend.
- Cerrar conservación documental, privacidad, contratos y recuperación externa.
- Validar alcance y excepciones contra disposiciones de STPS y criterio jurídico.

Referencias del proyecto: [revisión documental](revision-juridica-jornada-acuse.md),
[estado](estado-y-pendientes.md) y [guía Android](guia-app-android.md).

## Verificación

El autoensayo Android incorpora consulta GET con aserción real, formato de
hora de la empresa, tramo abierto, envío de objeción, recuperación cifrada del
acuse tras recrear el repositorio, conflicto 409 y rechazo local en terminal.
Resultado del 19 de octubre de 2026: compilación Docker aprobada, 9 pruebas
unitarias sin fallos, lint aprobado y APK debug y de instrumentación compilados.
Los nuevos casos del recorrido están en el autoensayo de instrumentación:
se compilaron, pero no se ejecutaron porque `adb devices` no mostró teléfonos.
Tampoco se probó este recorrido contra el backend publicado. No se repitió release.

Artefactos y resultados: `build/android-employee-review/` en la raíz del
repositorio: `app-debug.apk`, `app-debug-androidTest.apk`, `test-results/` y
`lint-results-debug.html`. SHA-256 del APK debug:
`2E744F28CDA2956F9B87AB2822F4240C5E87EDB3129CA429E351492B8EF4FE5B`.

La primera compilación se canceló y otra falló por competencia sobre la caché
Gradle. Se detuvo el proceso anterior y se configuró `sharing=locked` en Docker;
la compilación final terminó correctamente. No se modificaron servicios ni datos.
