# Android — comida visual sin conexión, 6 de noviembre de 2026

**Resultado local aprobado en Samsung SM-S928B, Android 17/API 37.**
Base `5b0a66c`, con la corrección temporal local descrita en
[el acta anterior](qa-android-2026-11-06.md). Esta comprobación añade el
recorrido visual que aquélla dejaba pendiente; no sustituye la aceptación
del ambiente desplegado.

## Pantalla y aislamiento

Se añadió una Activity de ensayo sólo en `src/debug`, sin exportar ni acceso
desde la navegación. Renderiza **`OperationalScreen` de producto**, sin copiar
su interfaz. Una sesión ficticia vive sólo en memoria; los valores de política
y aviso usan `BreakPolicySchedule.updates` y los lectores existentes de
`AttendanceRepository`. No instancia `AttendanceViewModel`, abre Room o
`DeviceStore`, programa WorkManager, hace llamadas HTTP ni crea claves.
Las acciones ajenas al selector no realizan operaciones.

La instrumentación `visual=true` abre esa pantalla, actúa sobre el árbol
accesible real y guarda capturas del dispositivo. No se usaron cuentas,
tarjetas ni datos operativos. El manifiesto release generado se comprobó:
**no contiene la Activity de ensayo**.

## Casos comprobados

| Sentido | Antes de vigencia | Después, sin otra operación de captura ni cambio de sesión |
| --- | --- | --- |
| `not_considered` → `marked` | Aviso visible de que se marcará comida; selector con deducción, entrada y salida | Aviso retirado; selector incorpora inicio y fin de descanso |
| `marked` → `not_considered` | Aviso visible de que se dejará de marcar; selector incluye comida; se selecciona inicio de descanso | Aviso retirado; se limpia la selección anterior, vuelve la deducción y desaparecen ambas opciones de descanso |

Se inspeccionaron capturas reales del aviso, selectores antes/después y
selección anterior/retirada. Los controles y el texto permanecen dentro de
pantalla y los diálogos muestran las opciones esperadas. La transición usa
una vigencia ficticia de 15 segundos para observarla sin cambiar el reloj.
`effectiveOn` se fija al 16 de noviembre sólo para comprobar el texto de
fecha: esta fixture no acredita la programación por API ni el aviso de siete
días de una sesión real.

La primera ejecución completó el recorrido con conectividad habitual. Se
repitió completo **sin red activa**: datos móviles ya estaban desactivados
(`0`); se desactivó Wi-Fi y Android declaró `Active default network: none`
antes y después del ensayo. No había túneles ADB. Las nueve capturas de esta
repetición y sus SHA-256 están conservadas. Ambas ejecuciones finales
devolvieron `OK: VISUAL` e `INSTRUMENTATION_CODE: -1`.

Wi-Fi se restauró a su estado original (`1`) mediante `finally`, los datos
móviles siguieron en `0` y Android recuperó su red activa. No se cambió modo
avión, Bluetooth, reloj, permisos ni configuración NFC. Vinculación, base Room
y WAL operativos conservaron exactamente sus tres SHA-256 originales,
incluida la comprobación posterior a detener la app. Ambos APK mantienen el
certificado de los instalados y se actualizaron sin desinstalar.

## Validación y evidencia

17 unitarias Android aprobadas, cero fallos/errores/omisiones; lint aprobado
con cero errores y 11 avisos de configuración/código ajenos a la fixture.
APK debug/instrumentación y manifiesto release generados correctamente con
Gradle 9.6.0/JDK 25 y caché de dependencias sin red. La revisión final de
instrumentación y lint también aprobó. `git diff --check` sin errores.

Evidencia local ignorada por Git en `build/qa-android-visual-20261106/`:

- `build.log`, `build-final.log` y `release-manifest.log`.
- `fixture.log`, `offline-fixture.log` y `device-evidence.json`.
- `offline-network-before.txt`, `offline-network-after.txt` y
  `offline-restoration.json`.
- `data-before.txt`, `data-after.txt`, los APK y sus certificados comparados.
- Nueve PNG en `offline-screenshots/` y `offline-screenshot-hashes.json`.

Los intentos iniciales fallidos por búsqueda accesible de Compose y espera
de ventana no se cuentan como aprobados. Se corrigió sólo el ensayo para
recorrer los nodos y esperar la ventana; el recorrido final sí completó las
aserciones y capturas.

## Alcance restante

Queda comprobado el recorrido visual aislado de comida sin conectividad,
incluida la limpieza de selección. No se acredita el recorrido integrado de
`AttendanceViewModel` con una sesión emitida por backend, su reanudación tras
reposo/reinicio, el aviso normativo completo, lector de pantalla audible, NFC
autenticada, aceptación pública o ratificación de SUP-025. Es avance parcial
de la tarea 13; no cierra la tarea global ni modifica su prioridad.

No se publicó, desplegó ni habilitó captura release o purga.
