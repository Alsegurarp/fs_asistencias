# Producto móvil de control de asistencia

La app es el punto de registro y consulta de la jornada. La administración de
la organización permanece en el portal. El contrato actual contempla teléfonos
personales y terminales de una sede, con tarjetas NFC.

## Aplicación operativa y presentación

Estado vigente al 21 de octubre de 2026: `WelcomeActivity` ofrece Empleado
y Administración. Empleado abre `MainActivity` con activación, captura,
cola cifrada, sincronización y semana/acuse. Administración abre el portal
HTTPS en `AdministrationActivity`, con login y permisos reales del portal;
la preparación MF1K permanece como herramienta de ejemplo y no prueba
autenticación de asistencia. Véase [Inicio Android](inicio-app-android.md).

Las secciones siguientes describen exclusivamente `PresentationActivity`,
el prototipo debug con datos locales. Sus credenciales vacías y tolerancias
de ejemplo no corresponden al acceso administrativo ni al cálculo operativo.

## Diseño implementado en la presentación

Inicio se resume en dos accesos: Mi asistencia y Administración, más el estado
del teléfono vinculado. Los permisos se revisan en Dispositivo y los pendientes en
Actividad. La identidad usa azul marino `#123566`, con contenedores azul claro
`#E5EDFA`; el indicador de navegación seleccionado usa esos mismos colores.
Los colores de categorías del panel administrativo conservan su significado.

| Pantalla | Qué presenta | Operaciones del API previstas |
| --- | --- | --- |
| Inicio | Estado del dispositivo y registro de entrada, salida y descanso | `POST /device-sessions`, `POST /attendance-events` |
| Mi semana | Horas, jornadas, incidencias, detalle diario y revisión del cierre | `GET /me/attendance`, `POST /week-closures/{closureId}/acknowledgements` |
| Actividad | Pendientes locales y confirmaciones de marcajes | `POST /attendance-events/batch`; recibos de los envíos |
| Dispositivo | Vinculación presentada como activa, NFC y permiso de ubicación | `POST /device-activations` para la futura conexión real |

Todas las rutas llevan el prefijo `/api/v1`. La referencia de campos y permisos
es [OpenAPI](../contracts/openapi.yaml).

La navegación funciona sin activar el teléfono para revisar el diseño.
La presentación ahora incluye datos históricos locales. Mi semana muestra
la semana completa anterior con cinco jornadas de ocho horas, cuatro entradas
puntuales y un retardo. Actividad muestra esas jornadas y cero pendientes.
El detalle de cada empleado genera el historial del mes anterior a partir de
los mismos conteos de su tarjeta: puntuales, retardos, faltas, vacaciones y
justificados. La aceptación u objeción del cierre cambia sólo el estado visual.
No se crean eventos, recibos, cierres ni activaciones en la base real.

Inicio incorpora el botón Checar asistencia. Abre un
recorrido de presentación: lectura de tarjeta para entrada,
estado en turno, horario de ejemplo 08:00–16:00 y lectura para salida con
confirmación final. Las checadas usan la hora local al pulsar «Continuar».
Se puede cancelar una lectura o reiniciar el recorrido. No requiere vincular
el dispositivo, no lee una tarjeta real, no escribe en la cola local ni llama
al backend. Sus datos sólo pertenecen a la vista de demostración.

El contrato no autoriza una semana personal en dispositivos `terminal`.
La navegación contempla esa restricción. El registro real de descansos deberá
ofrecerse sólo cuando la sesión tenga `breakPolicy=marked`; todavía está pendiente.

Dispositivo muestra un teléfono personal vinculado y activo con información
de presentación. No guarda esa vinculación en el repositorio de activaciones.
Se retiraron por petición las etiquetas de prueba de la interfaz; el carácter
de presentación permanece documentado aquí y en el código.
La activación operativa con firma y almacenamiento seguro se comprobó el 19
de octubre de 2026 contra backend local y HTTPS publicado en teléfono, con
datos ficticios y tarjeta simulada. Las pantallas de
presentación no realizan llamadas de sesión, marcaje, semana o acuse.
Actividad no consulta una lista general de eventos: ese endpoint es para roles
del portal, y un dispositivo recibe confirmaciones al enviar sus propios sobres.

## Alcance comercial del conjunto

El portal añade padrón, sedes, horarios, tarjetas, dispositivos, atención de
incidencias, cierres semanales, exportaciones y bitácora. Se agregó al móvil
un prototipo administrativo solicitado para explorar su posible alcance;
todavía no usa las credenciales ni los permisos reales del portal.

## Prototipo de Administrador y RH

Desde Inicio se abre un formulario de correo y contraseña. En este prototipo
se puede continuar con los campos vacíos; nunca autentica ante el API ni
otorga permisos sobre datos reales. Usa empleados y conteos ficticios.

La lista presenta tarjetas por empleado con nombre, número, área y entradas
del periodo. Se puede buscar, abrir el detalle mensual y agregar empleados
a la lista de demostración; el número no se puede repetir. Las altas sólo
se conservan durante esa vista, no se almacenan en la base.

| Categoría | Color sugerido | Significado en el prototipo |
| --- | --- | --- |
| Puntuales | Verde | Entrada hasta 10 minutos después de la hora asignada |
| Retardos | Ámbar | Entrada fuera de esa tolerancia |
| Faltas | Rojo | Días de ejemplo clasificados como ausencia |
| Vacaciones | Azul | Días de ejemplo de vacaciones |
| Justificados | Violeta | Días de ejemplo justificados |

Cada color lleva su etiqueta y conteo. Entradas suma puntuales y retardos;
el divisor suma todos los días clasificados del periodo ficticio, incluidos
los de vacaciones y justificados. Los nuevos empleados empiezan sin datos.

La tolerancia de 10 minutos es una propuesta para el diseño, no una regla
nueva del backend. El contrato actual todavía no ofrece un flujo de
vacaciones y justificaciones: estas categorías no se presentan como
funciones conectadas. La integración futura requerirá inicio de sesión real
y comprobar los roles del servidor, sin permitir credenciales vacías.

El icono de lanzamiento ahora representa una tarjeta con una marca de
verificación, en lugar de la cruz anterior.

## Recorrido de revisión con el equipo

En el APK debug, abrir «Ver presentación del producto» desde la pantalla
operativa. La presentación se ejecuta en `PresentationActivity`, sin instanciar
repositorios de captura ni trabajadores de sincronización. `MainActivity`
conserva el enrolamiento, NFC, firmas, cola y recibos de la implementación real.
La actividad de presentación no se registra en el manifiesto de release.

1. En Inicio, abrir Checar asistencia, elegir Marcar entrada y pulsar Continuar
   en la lectura de tarjeta. Comprobar el estado En turno y la hora de checada.
2. Elegir Marcar salida y Continuar. Revisar la confirmación y reiniciar el
   recorrido si se desea mostrar otra jornada.
3. Abrir Mi semana y Actividad para revisar jornadas anteriores, totales,
   históricos y aceptación u objeción del cierre semanal.
4. Abrir Dispositivo para ver la vinculación presentada como activa y los
   permisos reales del teléfono.
5. En Inicio, abrir Administración y continuar con correo y contraseña vacíos.
   Buscar un empleado, abrir su resumen e historial mensual y agregar otro.

La presentación puede recorrerse sin Docker ni un backend levantado. Sus
datos no se conservan como registros de negocio: las acciones sólo cambian
estado de la vista. Los permisos de ubicación sí los gestiona Android.

## Construir y compartir el APK

Desde la raíz del repositorio, con Docker Desktop funcionando:

```powershell
docker build --file android/Dockerfile --tag zenit-android-local android
New-Item -ItemType Directory -Force -Path android/app/build/outputs/apk/debug
$apkContainer = docker create zenit-android-local
docker cp "${apkContainer}:/workspace/app/build/outputs/apk/debug/app-debug.apk" android/app/build/outputs/apk/debug/Zenit-dev.apk
docker rm $apkContainer
```

El build ejecuta pruebas unitarias, lint y ensamblado. Los tres pasaron para
esta entrega; el APK se instaló en un teléfono Android por ADB inalámbrico.
El APK queda en `android/app/build/outputs/apk/debug/Zenit-dev.apk`, ignorado
por Git. Se comparte como archivo separado; el repositorio conserva fuentes,
documentación y pruebas. La carpeta `secrets/` y `.env` también están ignoradas
y no forman parte del APK ni del código que se sube.

El contrato permite desarrollar la captura sin conexión con límites de sesión,
reintentos sin duplicados y confirmaciones por registro. La autenticación de
la tarjeta real todavía necesita validación con hardware; la tarjeta simulada
sólo sirve para datos de desarrollo. No se presenta esta entrega como una
versión lista para registrar asistencia en producción.
