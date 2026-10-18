# Tareas críticas primero

Revisión: 18 de octubre de 2026, sobre el commit `5f36b5c`.
Orden por riesgo y bloqueo del producto; los números originales remiten a
[Estado y pendientes](estado-y-pendientes.md#lista-consolidada-de-tareas-pendientes).
Esta revisión declara trabajo pendiente; no aprueba decisiones de negocio ni
modifica el sistema desplegado.

## Progreso verificado

| Área | Evidencia y alcance |
| --- | --- |
| Backend y contrato | Contrato 0.11.0, 60 operaciones implementadas. Los registros del 17 de octubre muestran construcción e integración correctas; la validación documenta 47 pruebas unitarias y 73 de integración. No se repitieron hoy |
| Portal | Hoy pasaron 128/128 pruebas en el árbol local y en la imagen existente `zenit-web-check`; `pnpm build` también pasó. Implementa padrón, horarios, importación, tarjetas, incidencias, cierres, exportes y usuarios |
| Android | Implementa firma, activación, cola cifrada, sincronización y renovación. Construcción y pruebas del 17 registradas. Hay evidencia local adicional de activación contra backend, pero su reproducción con el código versionado tiene una discrepancia descrita abajo |
| Despliegue | Hoy respondieron HTTP 200 el portal público, `/api/v1/system/status` y el descubrimiento de identidad en `zenit.fastsolution.com.mx`. El API anunció `status=ok`. Esto no comprueba una sesión autenticada |
| Respaldo | Ensayo del 17: 130 tablas y 1.772 filas con contenido idéntico. La autoprueba está documentada; no demuestra copia externa operativa ni recuperación completa |
| Entorno local | Docker disponible, sin servicios activos del proyecto al consultar `docker compose ps`. No se arrancaron aplicaciones ni se tocaron sus datos |

El producto tiene una base funcional y un ambiente de demostración publicado.
Continúa pendiente su aceptación para uso con personas y datos reales. No se
asigna un porcentaje global: implementar una operación, probarla de forma
aislada y aceptar el recorrido completo son avances distintos.

## Pendientes en orden de prioridad

**P0:** cerrar antes de operar con datos reales. **P1:** siguiente trabajo
técnico y validación del piloto. **P2:** completar alcance y aceptación del
cliente. «Ahora» significa que puede avanzarse desde el repositorio;
una prueba en servidor o teléfono conserva ese requisito para su cierre.

| Orden | Prioridad | Tarea | Posibilidad de resolver y criterio de cierre |
| --- | --- | --- | --- |
| 1 | P0 | Respaldo externo y recuperación completa (15) | En curso: recuperación local comprobada; [evidencia](recuperacion-servicio.md). Aprobados copia diaria, retención 30 días, pérdida máxima 24 h y recuperación 4 h; fallos a cargo de fastSolution. SSH exclusivamente mediante Gabriel; destino en otro servidor por concretar, probablemente mediante VPN. Faltan custodia, automatización y recuperación pública |
| 2 | P0 | Identidad operativa: cuentas personales, OTP, operador y SMTP (14) | En curso: realm preparado para conservar OTP y exigir reautenticación tras recuperar contraseña; cuatro comprobaciones, incluida importación real, pasaron en local. [Procedimiento](preparar-ambiente-compartido.md#correo-y-cuentas-personales) preparado para Gabriel. Faltan identidades/correos, SMTP, ejecución remota y recorridos reales; retirar `arranque` sólo tras comprobar accesos personales |
| 3 | P0 | Aprobar e implementar jornada y evidencia del acuse (17) | Requiere dictamen profesional y criterios de producto. Después implementar casos esperados, texto/evidencia versionados y conservación de cierres históricos; la revisión documental existente no cierra la tarea |
| 4 | P0 | Captura autenticada con tarjetas reales (16) | Requiere tarjetas, teléfonos y definición de autenticación/entrega de claves. Comprobar captura y rechazo de tarjetas no válidas. La tarjeta simulada sólo sirve para datos ficticios |
| 5 | P0 | Resolver suspensión, baja, supervisor y tipo de marcaje (2) | Requiere elección del responsable del producto sobre las propuestas existentes. Implementar sólo cambios aprobados y probar permisos, históricos y captura. Hoy el supervisor abarca toda la empresa y la suspensión también detiene captura |
| 6 | P0 | Acordar uso del servidor compartido para datos reales | Dependencia del responsable del servicio y del dueño del servidor, registrada en la guía de despliegue. Mantener sólo datos ficticios hasta contar con el acuerdo escrito |
| 7 | P1 | Hacer reproducible Android contra backend y corregir la indicación de URL (7) | Ahora: versionar el autoensayo que realmente use el backend y alinear la guía con la URL base sin `/api`. Cierre: APK construido desde el mismo commit, activación personal/terminal, captura, cola sin conexión, sincronización, recibos y renovación contra backend; repetir por HTTPS en teléfono |
| 8 | P1 | Dirección real y protocolo en la cadena de proxies (parte de 19) | Ahora: revisar borde → portal → backend. Confiar sólo en proxies previstos y conservar HTTPS. Probar que fallos de activación desde una IP no consuman la cuota de otra y que cabeceras externas falsas no eludan el límite |
| 9 | P1 | Recorridos del portal con sesión real (4 y parte de 14) | Guion existente. Requiere navegador, cuentas y entorno activo con datos ficticios. Probar horarios, asignaciones e importación; en HTTPS comprobar acceso, renovación, cierre de sesión y permisos de cada rol |
| 10 | P1 | Retención de sobres y recibos Android (8) | Requiere plazo y criterio de conservación. Después implementar purga acotada con pruebas que preserven pendientes y evidencia necesaria; hoy crece sin purga |
| 11 | P1 | Verificaciones automáticas por cambio (11) | Ahora puede prepararse con los comandos existentes; falta acordar dónde se ejecutará y habilitarlo. Cierre: pruebas, contrato, secretos y vulnerabilidades corriendo en cada cambio, con fallos visibles |
| 12 | P1 | Actualizar análisis de imágenes y comprobar el despliegue (parte de 19) | Ahora pueden repetirse los análisis; para cerrar hay que identificar y analizar las imágenes efectivamente desplegadas. El análisis de Zenit documentado es del 14; las seis altas de identidad tienen aceptación histórica, no una reevaluación de hoy |
| 13 | P2 | Configuración de empresa y administración de dispositivos en portal (9) | Ahora: reutilizar API existente, probar permisos y operaciones reales. No depende de cambiar reglas laborales |
| 14 | P2 | Personas que no pudieron cerrar y sus causas (10) | Ahora: ampliar contrato/backend y mostrar el detalle en portal, conservando aislamiento de empresa y pruebas de corrida parcial. Hoy sólo hay conteos y motivos |
| 15 | P2 | Semana y acuse del trabajador (12) | La consulta con datos reales puede avanzar ahora; requiere identidad y permisos. El cierre del acuse depende también de la tarea 17. Las pantallas de presentación móvil no cuentan como integración |
| 16 | P2 | Pantallas de operador del servicio (13) | Ahora: conectar administración de empresas con el rol existente y probar aislamiento. Hoy el portal informa que se implementará después |
| 17 | P2 | Horarios frente a asistencia y gestión de ausencias (18) | Requiere criterios de retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y validar resultados |
| 18 | P2 | Carga, continuidad y operación del despliegue (resto de 19) | Requiere volumen objetivo y número de instancias. Probar trabajos, cierres, exportes y cuotas; resolver actualización del DNS ante IP dinámica y comprobar renovación real de certificados. Cuotas compartidas sólo si habrá varias instancias |
| 19 | P2 | Conector y formato de nómina (20) | Depende del sistema y formato del primer cliente. Cierre con sincronización y archivo aceptados por ese sistema |
| 20 | P2 | Congelar contrato 1.0 | Después de recorridos reales y decisiones pendientes. Acordar compatibilidad y publicación de cambios con los consumidores |

## Hallazgos que cambian la siguiente sesión de trabajo

1. **La prueba Android contra backend no es reproducible con el runner actual.**
   Los archivos locales `build/enrolamiento-telefono-personal.log` y
   `build/enrolamiento-telefono-terminal.log`, del 17, reportan activación real,
   persistencia, renovación y código de un uso; la limpieza registra ambos
   dispositivos revocados y cero sesiones abiertas. Sin embargo, el guion local
   `build/test-enrollment-phone.ps1` pasa `baseUrl`, `code` y `mode` a
   `SmokeInstrumentation`, y el archivo versionado ignora esos argumentos y
   ejecuta siempre su `FixtureServer`. No se da por cerrado el recorrido real
   a partir de esos registros; falta conservar y ejecutar su implementación.
2. **La guía indica una URL incompatible con captura.**
   [Despliegue](despliegue-en-servidor.md) indica la base Android con `/api`.
   `CaptureApi.validateBaseUrl` exige una URL sin ruta y `CaptureApi.post`
   agrega `/api/v1`. La base correspondiente al código actual es
   `https://zenit.fastsolution.com.mx`. Falta alinear guía y flujo de activación.
3. **Las cuotas de activación comparten la dirección del portal.**
   `Devices.kt` usa `http.remoteAddr` para limitar fallos de activación;
   no se encontró configuración de procesamiento de cabeceras reenviadas en
   backend. `web/nginx.conf` agrega `X-Forwarded-For`, pero no configura confianza
   en el borde, y reemplaza `X-Forwarded-Proto` con su conexión HTTP interna.
   Falta la prueba de toda la cadena con dos direcciones y cabeceras falsas.
4. **La retención móvil sigue abierta en el código.**
   `PendingAttendanceDao.kt` conserva sobres y recibos sin purga; el límite
   de diez recibos visibles no limita las filas almacenadas.

## Trabajo técnico que podemos iniciar

Secuencia recomendada: **7 → 8 → 9 → 11**. Primero hacer fiable y reproducible
el recorrido Android, después corregir la cadena de proxies y comprobar sesiones
reales; preparar las verificaciones automáticas con esos recorridos claros.
Los puntos 13, 14 y 16 también pueden implementarse sin esperar tarjetas ni
dictamen. Los P0 siguen siendo los bloqueos de lanzamiento aunque requieran
respuestas externas.

Se mantienen diferidos jOOQ generado, notificaciones y almacenamiento externo
de exportes. El aviso de Vite sobre un archivo de más de 500 kB no impidió la
compilación y no se trata como bloqueo crítico sin una medición que lo justifique.

No repetidos en esta revisión: backend, Android, restauración, escaneo de
vulnerabilidades ni recorridos autenticados. No se accedió por SSH al servidor
ni se verificó hardware. No se modificaron reglas, código de aplicación,
secretos, datos ni servicios desplegados.
