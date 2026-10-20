# Tareas críticas primero

Revisión documental y verificación local: 20 de octubre de 2026, sobre `565dbdd`.
[Pruebas repetidas y ambiente actual](verificacion-local-2026-10-20.md).
Orden por riesgo y bloqueo del producto; los números originales remiten a
[Estado y pendientes](estado-y-pendientes.md#lista-consolidada-de-tareas-pendientes).
Esta revisión declara trabajo pendiente; no aprueba decisiones de negocio ni
modifica el sistema desplegado.

Para declarar y ejecutar trabajo se usa la columna **Orden** de este documento.
Los números entre paréntesis conservan la referencia a la lista histórica;
por ejemplo, identidad es el orden 2 y las decisiones de negocio son el orden 5.

## Progreso verificado

| Área | Evidencia y alcance |
| --- | --- |
| Backend y contrato | Contrato 0.12.0, 61 operaciones. El 20 pasaron construcción, unitarias y 74 pruebas de integración PostgreSQL. También seis comprobaciones de identidad/readiness con Keycloak importado |
| Portal | El 20 pasaron compilación y 151 pruebas. Configuración y personas bloqueadas por corrida disponibles en el ambiente local reconstruido. Horarios/importación por API HTTPS aprobados el 19; siguen pantallas, otras sesiones de rol y suspensión/reactivación |
| Android | El 20 pasaron 13 unitarias, lint (0 errores, 13 advertencias) y APK debug/de instrumentación. Incluye semana/acuse y herramientas MF1K. ADB sin teléfonos; no se repitió instrumentación. Personal/terminal contra backend local y HTTPS conservan la evidencia del 19 |
| Despliegue | El 19 se usó una sesión de administración facilitada por el usuario para `/me`, preparación y limpieza de datos ficticios por HTTPS. Ambos modos Android pasaron contra el servidor publicado. El recorrido completo del navegador sigue abierto; no se accedió por SSH ni se desplegaron cambios |
| Respaldo | Ensayo del 20 tras V008: 131 tablas/1,970 filas idénticas. Recuperación completa con origen apagado y secretos nuevos: evidencia del 18. Copia externa operativa y recuperación pública pendientes |
| Entorno local | Docker y servicios estaban apagados. Ambiente reconstruido conservando volúmenes, V008 aplicada y HTTP comprobado; queda en ejecución. Se retiraron sólo contenedores desechables y se conservaron cambios previos de `backend/bin/` |

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
| 1 | P0 | Respaldo externo y recuperación completa (15) | Datos operativos en infraestructura del cliente; sistema en VPS de fastSolution. Mediano: 50 empleados; grande: 300, cuatro marcajes/día, un año consultable. [S3/GCS y alternativas evaluados](evaluacion-respaldo-anual.md). Se conservan copia diaria/30 días y objetivos 24 h/4 h del servicio. Faltan elegir destino, adaptar bases separadas, custodia, automatización y recuperación pública. SSH mediante Gabriel |
| 2 | P0 | Identidad operativa: cuentas personales, OTP, operador y SMTP (14) | El usuario define seleccionar al empleado en el portal y exigir contraseña nueva al próximo login; [flujo aún sin implementar](preparar-ambiente-compartido.md#recuperación-administrada-desde-el-portal). Falta precisar acceso de quien olvidó su contraseña. Siguen cuentas personales, SMTP, responsable de OTP/recuperación y autorización del operador, altas y recorridos reales. Retirar `arranque` sólo tras comprobar accesos personales |
| 3 | P0 | Aprobar e implementar jornada y evidencia del acuse (17) | Requiere dictamen profesional y criterios de producto. Después implementar casos esperados, texto/evidencia versionados y conservación de cierres históricos; la revisión documental existente no cierra la tarea |
| 4 | P0 | Captura autenticada con tarjetas reales (16) | Herramientas Android MF1K implementadas para ejemplos; pendientes de prueba física. Falta autenticación integrada y custodia de claves: el backend sólo verifica captura simulada. Comprobar captura y rechazo con tarjetas/teléfonos reales |
| 5 | P0 | Resolver suspensión, baja, supervisor y tipo de marcaje (2) | Requiere elección del responsable del producto sobre las propuestas existentes. Implementar sólo cambios aprobados y probar permisos, históricos y captura. Hoy el supervisor abarca toda la empresa y la suspensión también detiene captura |
| 6 | P0 | Acordar uso del servidor compartido para datos reales | Dependencia del responsable del servicio y del dueño del servidor, registrada en la guía de despliegue. Mantener sólo datos ficticios hasta contar con el acuerdo escrito |
| 7 | P1 | Hacer reproducible Android contra backend y corregir la indicación de URL (7) | Completada el 19: `BackendSmoke.kt` y `infra/test-android-backend.ps1`, APK construidos juntos y hashes registrados. Personal y terminal pasaron contra backend local y HTTPS publicado, con datos ficticios y limpieza. Se corrigió la validación Android que rechazaba los códigos de cinco caracteres por grupo. El fallo de transporte se induce sólo en el almacén del ensayo; no acredita apagar radios ni NFC autenticado |
| 8 | P1 | Dirección real y protocolo en la cadena de proxies (parte de 19) | Prueba pública del 19 aprobada: redirección HTTPS, identidad resistente a cabeceras falsas y cuota no eludible rotando IP falsas (10 respuestas 410 y dos 429). Teléfono comprobado por HTTPS bajo Wi-Fi. Por indicación del usuario, la prueba con datos móviles y dos IP públicas queda pendiente para otro desarrollador; [entrega](TareasPendientes.md#entrega-a-otro-desarrollador-prueba-con-datos-móviles-tarea-8) |
| 9 | P1 | Recorridos del portal con sesión real (4 y parte de 14) | Horarios, asignación futura e importación aprobados por API HTTPS el 19, con sesión de administración y limpieza. Sigue pendiente navegador: pantallas, cookies, renovación, cierre de sesión y permisos de otros roles. No hay navegador conectado al control UI |
| 10 | P1 | Retención de sobres y recibos Android (8) | Requiere plazo y criterio de conservación. Después implementar purga acotada con pruebas que preserven pendientes y evidencia necesaria; hoy crece sin purga |
| 11 | P1 | Verificaciones automáticas por cambio (11) | Integrada en `main` el 19. Los cuatro trabajos aprobaron en GitHub para `avanceLunes`, incluido su último commit `4bde26f` (ejecución 39301664714). Corregidos checkout y propiedad de secretos del runner Linux. La obligatoriedad de trabajos requiere una decisión adicional. [Procedimiento y resultados](verificaciones-automaticas.md) |
| 12 | P1 | Actualizar análisis de imágenes y comprobar el despliegue (parte de 19) | Cinco imágenes locales reconstruidas y analizadas el 20, con IDs registrados. Corregidas altas de libexpat en backend/portal y libx11 en portal; ninguna grave nueva sin atender. Siguen seis excepciones de identidad. Faltan IDs del servidor mediante Gabriel, análisis de esas imágenes, despliegue de correcciones y comprobación pública |
| 13 | P2 | Configuración de empresa y administración de dispositivos en portal (9) | Implementación completada localmente. Configuración usa GET/PATCH /tenant y respeta permisos, cambios parciales y desactivación del cierre; nueve pruebas nuevas más navegación. Portal: 151 pruebas y compilación repetidas y aprobadas el 20. Falta despliegue y aceptación de pantallas con sesión real |
| 14 | P2 | Personas que no pudieron cerrar y sus causas (10) | Completada localmente el 19: contrato 0.12, V008, registro transaccional por persona, consulta paginada y detalle en portal. 74 pruebas de integración y 151 del portal aprobadas, incluidos aislamiento, corrida parcial y reintentos. Sin desplegar ni aceptar en navegador real; los históricos anteriores conservan conteos |
| 15 | P2 | Semana y acuse del trabajador (12) | Android ya consulta semana y envía acuse con recibo cifrado local. Falta recorrido real, historial y recuperación desde backend, y completar alcance web. Reglas/evidencia dependen del orden 3 (17 histórico) |
| 16 | P2 | Pantallas de operador del servicio (13) | Alta y lista de empresas ya están, con 3 pruebas. Faltan suspender y reactivar desde el portal y probar aislamiento con el rol real |
| 17 | P2 | Horarios frente a asistencia y gestión de ausencias (18) | Requiere criterios de retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y validar resultados |
| 18 | P2 | Carga, continuidad y operación del despliegue (resto de 19) | Requiere volumen objetivo y número de instancias. Probar trabajos, cierres, exportes y cuotas; resolver actualización del DNS ante IP dinámica y comprobar renovación real de certificados. Cuotas compartidas sólo si habrá varias instancias |
| 19 | P2 | Conector y formato de nómina (20) | Depende del sistema y formato del primer cliente. Cierre con sincronización y archivo aceptados por ese sistema |
| 20 | P2 | Congelar contrato 1.0 | Después de recorridos reales y decisiones pendientes. Acordar compatibilidad y publicación de cambios con los consumidores |

## Hallazgos que cambian la siguiente sesión de trabajo

1. **La prueba Android contra backend ya es reproducible.**
   Resuelto el 19 con fases versionadas de activación, cola y sincronización,
   ejecutadas en procesos separados. `SmokeInstrumentation` distingue resultados
   `BACKEND` y `FIXTURE` y falla ante argumentos incompletos. El guion prepara
   datos ficticios por API, verifica exactamente dos eventos por empleado y
   limpia sólo sus recursos. Los ensayos local y HTTPS pasaron en el teléfono;
   [evidencia](bitacora-trabajo.md#19-de-octubre-de-2026--android-reproducible-contra-backend-local-y-https).
2. **La guía indica una URL incompatible con captura.**
   [Despliegue](despliegue-en-servidor.md) indica la base Android con `/api`.
   `CaptureApi.validateBaseUrl` exige una URL sin ruta y `CaptureApi.post`
   agrega `/api/v1`. La base correspondiente al código actual es
   `https://zenit.fastsolution.com.mx`. Resuelto en la guía de despliegue y en
   la de la app.
3. **Las cuotas de activación comparten la dirección del portal.**
   `Devices.kt` usa `http.remoteAddr` para limitar fallos de activación;
   no se encontró configuración de procesamiento de cabeceras reenviadas en
   backend. `web/nginx.conf` agrega `X-Forwarded-For`, pero no configura confianza
   en el borde, y reemplaza `X-Forwarded-Proto` con su conexión HTTP interna.
   Resuelto en el código con prueba de dos direcciones y comprobación pública
   de cabeceras falsas el 19; falta aislamiento desde dos IP públicas reales.
4. **La retención móvil sigue abierta en el código.**
   `PendingAttendanceDao.kt` conserva sobres y recibos sin purga; el límite
   de diez recibos visibles no limita las filas almacenadas.

## Trabajo técnico que podemos iniciar

La tarea **7 está completada** en el alcance de ensayo con tarjeta simulada.
Las comprobaciones públicas de cabeceras (8) y de horarios/importación por API
(9) ya pasaron. Faltan otra IP real y un navegador conectado para sus recorridos
restantes. Verificaciones automáticas (11) están publicadas en la rama y
los cuatro trabajos aprobaron en GitHub; el workflow ya está integrado en `main`. Configuración (13) está probada
localmente y espera despliegue. El análisis local (12) pasó tras
corregir tres altas; su cierre espera las imágenes del servidor mediante Gabriel.

### Declaración de la tarea 7

- **Resultado:** un autoensayo versionado que use el backend real y pueda
  repetirse con datos ficticios desde el mismo commit que los APK.
- **Alcance:** instrumentación Android, guion de ejecución y preparación/limpieza
  de datos de ensayo, guía y registro de resultados. Reutilizar repositorios,
  firma y almacenamiento existentes; conservar el ensayo con `FixtureServer`.
- **Aceptación:** activar dispositivo personal y terminal, comprobar persistencia
  y código de un uso, capturar con tarjeta simulada, conservar cola sin conexión,
  sincronizar sin duplicados, revisar recibos y renovar sesión. Repetir en teléfono
  por HTTPS para cerrar el recorrido publicado.
- **Dependencias:** backend y datos ficticios preparados, códigos de activación
  válidos y teléfono conectado para la ejecución instrumental.
- **Evidencia de cierre:** commit, variante de APK, entorno y dispositivo,
  resultados de cada caso y limpieza de dispositivos/sesiones de prueba;
  excluir credenciales, códigos vigentes y datos personales de los registros.

Los puntos 13 y 14 ya están implementados y probados localmente.
El punto 16 puede avanzar
con la UI de reactivación; la suspensión debe respetar la decisión pendiente
del punto 5. Ninguna de estas tareas sustituye los bloqueos P0.

### Definiciones necesarias para desbloquear tareas

| Orden | Quién debe aportar la definición | Dato que falta |
| --- | --- | --- |
| 1 | Gabriel como interlocutor técnico y responsable que se designe | Destino de objetos en evaluación, acceso a datos operativos del cliente desde VPS de fastSolution, custodia y segunda copia de clave; adaptar bases separadas, automatizar y ensayar recuperación |
| 2 | Responsable del servicio de identidad | SMTP y encargado de OTP/recuperación del operador; resolver su autorización sin asumir que dispone de buzón |
| 3 | Responsable del producto y revisión jurídica profesional | Criterios de jornada y texto/evidencia del acuse con casos esperados |
| 4 | Equipo que facilite tarjetas y teléfonos | Tecnología de tarjeta, autenticación y entrega de claves para probar captura real |
| 5 | Responsable del producto | Elegir las reglas de suspensión, baja, supervisor y tipo de marcaje en las propuestas existentes |
| 6 | Responsable del servicio y dueño del servidor | Acuerdo escrito para usar el servidor compartido con datos reales |
| 10, 17, 18, 19 | Responsable del producto/servicio y primer cliente, según la tarea | Retención móvil, reglas de asistencia/ausencias, volumen/instancias y sistema/formato de nómina |

Se mantienen diferidos jOOQ generado, notificaciones y almacenamiento externo
de exportes. El aviso de Vite sobre un archivo de más de 500 kB no impidió la
compilación y no se trata como bloqueo crítico sin una medición que lo justifique.

El 19 se ejecutaron backend, portal, Android, identidad, ensayos API HTTPS,
análisis de imágenes y búsqueda de secretos. No se repitieron release Android
ni restauración. No se probó tarjeta física, apagado real de radios ni sesión
completa del portal. Se crearon y desactivaron datos ficticios de ensayo;
no se cambiaron reglas, credenciales humanas ni servicios desplegados.
