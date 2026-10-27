# Tareas críticas primero

**Corte vigente: 26 de octubre de 2026.** Consultar el
[listado verificado para desarrollo](tareas-desarrollo-2026-10-26.md).
PR #15/#16 ya integradas y cuatro trabajos de CI de main/5d7b783 aprobados;
no repetir esas integraciones. E1 entrega el
[contrato/formato candidato y sus pruebas](contrato-expediente-e1.md).
Continuar E2 → E3/E4 → E5; E6 conserva aceptación/Q07/Q14.
Docker disponible para las pruebas E1; no hay endpoints nuevos implementados.
Los cortes siguientes son históricos; permanecen 17 tareas abiertas y seis P0.

Actualización posterior del **23 de octubre de 2026**: el usuario aprueba
[las metas del expediente por empresa y MFA por descarga](expediente-empresa.md).
MFA con SSO validado en identidad aislada: 10/10 pruebas, sin omisiones.
Siguiente trabajo: completar permiso específico, expediente íntegro y
autorización nueva de un solo uso; paso de CI preparado aún sin publicar.
Requiere comprobación de recuperación/consulta antes de cualquier supresión;
no habilita purga Android ni resuelve las elecciones comerciales pendientes.

El trabajo se desglosa en [E1–E6](expediente-empresa.md#tareas-declaradas-para-implementación),
en ese orden salvo E3/E4 después de su contrato común. No cambia el conteo
de tareas globales ni sustituye los bloqueos P0.

Último corte del **23 de octubre de 2026**: autoensayo concurrente aprobado
en local y CI de la [PR #15](https://github.com/Alsegurarp/fs_asistencias/pull/15),
todavía en borrador y sin integrar. La base legal indicada por el usuario
para retención/uso y reglas se registra en la
[revisión actualizada](revision-juridica-jornada-acuse.md); la ley no elige
las opciones técnicas/comerciales que allí continúan pendientes.

Avance anterior del **23 de octubre de 2026**: autoensayo concurrente de
respaldo aprobado localmente; paso de CI preparado con el comando corregido.
Retención, identidad y reglas esperan elecciones Q14, Q03/Q04 y Q10–Q13.
[Evidencia](bitacora-trabajo.md#23-de-octubre-de-2026--respaldo-concurrente-validado-y-preparación-de-ci).

Sincronización del **23 de octubre de 2026**: `main` actualizado con
`git pull origin` a `0723baf`, con PR #13/#14 integradas y cambios locales
de `backend/bin/` conservados. Revisión documental, sin nuevas pruebas ni
comprobación del servidor o CI remoto. Permanecen 17 tareas abiertas y seis
P0; se conserva el aplazamiento del servidor público.

Actualización del **22 de octubre de 2026**: [17 casos de navegador local,
carga 50/300 y seguridad de imágenes](qa-local-2026-10-22.md) y
[análisis de retención Android](retencion-android.md). El recorrido local de
horarios/importación está aprobado; Q14 y Q19 conservan sus decisiones.
El servidor público quedó diferido por el usuario. Los cortes anteriores
siguientes no sustituyen esta actualización; permanecen 17 tareas abiertas.

Revisión documental y verificación local: 20 de octubre de 2026, sobre `565dbdd`.
[Pruebas repetidas y ambiente actual](verificacion-local-2026-10-20.md).
Actualización posterior: [A1–A5 integradas en main/e4d7683](entregas-a1-a5.md),
con nuevas pantallas, contrato 0.13 y [guion de QA](qa-a1-a5.md).
Los cuatro trabajos de [CI de la PR #10](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39504126988)
aprobaron. La confirmación de funcionamiento del usuario queda registrada
en la bitácora. El 21 se ejecutaron y documentaron los
[33 casos A5 en local](qa-a1-a5-2026-10-21.md); la aceptación del usuario y
del entorno público conserva sus requisitos. Los conteos del 20 siguientes
se mantienen como evidencia de sus versiones.
Orden por riesgo y bloqueo del producto; los números originales remiten a
[Estado y pendientes](estado-y-pendientes.md#lista-consolidada-de-tareas-pendientes).
Esta revisión declara trabajo pendiente y no modifica el sistema desplegado.
El modelo de alojamiento sí quedó aprobado el 19 de octubre de 2026, sin
autorizar todavía datos reales.

Para declarar y ejecutar trabajo se usa la columna **Orden** de este documento.
Los números entre paréntesis conservan la referencia a la lista histórica;
por ejemplo, identidad es el orden 2 y las decisiones de negocio son el orden 5.

## Tareas posibles desde el corte del 23 de octubre

La revisión conserva `main`/`0723baf` y el servidor público diferido. Esta
lista propone subtareas de las prioridades existentes; no aumenta las 17
tareas globales abiertas ni autoriza cambios de reglas. A1–A5, los 17 casos
locales de horarios/importación y la línea base 50/300 ya están entregados.

| Secuencia sugerida | Trabajo concreto | Dependencia y resultado esperado |
| --- | --- | --- |
| 1 | Validar el autoensayo local de respaldo con escrituras concurrentes (orden 1) | Completada localmente el 23 a las 16:47 UTC: escrituras posteriores a ambas instantáneas, restauración sin origen y rechazos previstos aprobados. Se corrigió el montaje noexec del auxiliar. No cierra el respaldo externo operativo |
| 2 | Preparar la integración del autoensayo y su paso de CI (órdenes 1/11) | Preparada en PR #15, commit ffa8306, con cuatro trabajos de CI aprobados y backend/bin excluido. PR en borrador, sin integrar ni desplegar; no sustituye respaldo externo |
| 3 | Definir y después implementar retención Android (orden 10) | Base legal recibida el 23 y documentada: archivo laboral y copia Android tienen funciones distintas. Faltan archivo/recuperación íntegros, impedimentos de borrado y disponibilidad de duplicados locales; no habilitar purga por antigüedad sin ellos |
| 3a | Expediente empresarial y MFA por operación (órdenes 2/3/10/15) | Metas aprobadas el 23: [alcance y aceptación](expediente-empresa.md). MFA aislado aprobado dentro de 10/10 pruebas de identidad; paso de CI preparado. Pendientes permiso específico, autorización por usuario/empresa/expediente y archivo verificable fuera de Zenit. No heredar permisos amplios del CSV ni entregar respaldo multiempresa |
| 4 | Completar identidad operativa y recuperación de acceso (orden 2) | Q03/Q04: procedimiento de acceso perdido, SMTP/remitente, cuentas personales y credencial técnica. Comprobar correo, contraseña y OTP; A4 ya entrega el cambio obligatorio local |
| 5 | Aprobar las reglas de suspensión, baja, supervisor y marcaje (orden 5) | El usuario fija la ley como criterio; límites de conservación, finalidad y exhibición documentados. Las opciones técnicas/comerciales Q10–Q13 que la ley no elige por sí sola continúan abiertas; no declarar todas las propuestas aprobadas |
| 6 | Concretar respaldo externo y producción administrada (órdenes 1/6) | Q01/Q02/Q05: proveedor, región/cuenta, destino, custodia y responsables. Después automatizar y ensayar recuperación fuera del dominio de falla; conservar la topología SaaS aprobada |
| 7 | Completar aceptación pública e inventario de imágenes (órdenes 9/12/13/14/15/16) | Cuando el usuario retome el servidor y se resuelva Q17: identificar commit, V008 e imágenes, desplegar correcciones y registrar resultados por rol y en Android |
| 8 | Probar tarjeta física y captura autenticada (orden 4) | Q08/Q09: tecnología, tarjetas y provisión/custodia de claves. Ensayar lectura/escritura/borrado y captura/rechazo reales; la tarjeta simulada no cierra esta tarea |
| 9 | Completar jornada, acuse y ausencias (órdenes 3/15/17) | Q06/Q07/Q15: dictamen, texto/evidencia versionados y casos esperados aprobados. Implementar conservando cierres históricos |
| 10 | Ampliar pruebas de capacidad y continuidad (orden 18) | Q19: volumen concurrente, infraestructura y criterios de aceptación. Medir carga sostenida, trabajos, cuotas, DNS y renovación de certificados; las ráfagas locales previas no garantizan capacidad |
| 11 | Conector, nómina y contrato 1.0 (órdenes 19/20) | Q20/Q21: sistema/formato del primer cliente y consumidores del contrato. Cerrar con sincronización y archivo aceptados, y compatibilidad acordada |

La prueba de dos IP públicas (orden 8) sigue asignada a otro desarrollador
y diferida. Q22 permite decidir protección de `main` y trabajos obligatorios;
no reabre la automatización ya integrada. jOOQ generado, notificaciones y
almacén externo de exportes conservan su aplazamiento.

## Progreso verificado

| Área | Evidencia y alcance |
| --- | --- |
| Backend y contrato | Contrato 0.13, 62 operaciones. A1–A4: construcción, unitarias y 75 integraciones PostgreSQL; 7 comprobaciones de identidad aislada aprobadas |
| Portal | 162 pruebas y compilación aprobadas; reactivación, consulta personal y cambio obligatorio implementados y levantados localmente. Sesiones reales y despliegue público pendientes |
| Android | El 20 se repiten construcción, 13 unitarias y lint (0 errores, 13 advertencias). Samsung SM-S928B autorizado, API 36: instrumentación FIXTURE aprobada, incluidos semana/acuse, recuperación desde servidor simulado y reapertura. Actualización sin borrar datos. Backend real/HTTPS conserva la evidencia del 19; no acredita el nuevo recorrido contra ese servidor ni tarjeta física |
| Despliegue | El 19 se usó una sesión de administración facilitada por el usuario para `/me`, preparación y limpieza de datos ficticios por HTTPS. Ambos modos Android pasaron contra el servidor publicado. El recorrido completo del navegador sigue abierto; no se accedió por SSH ni se desplegaron cambios |
| Respaldo | Ensayo del 20 tras V008: 131 tablas/1,970 filas idénticas. Recuperación completa con origen apagado y secretos nuevos: evidencia del 18. Copia externa operativa y recuperación pública pendientes |
| Entorno local | El corte del 20 terminó reconstruido, con V008 y HTTP comprobados. Al comenzar el 21 Docker estaba detenido; la disponibilidad se comprueba en cada sesión. Se conservan volúmenes y cambios previos de `backend/bin/` |

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
| 1 | P0 | Respaldo externo y recuperación completa (15) | SaaS administrado por fastSolution con aislamiento lógico por empresa. Mediano: 50 empleados; grande: 300, cuatro marcajes/día, un año consultable. Respaldo externo cifrado de Zenit, fuera del dominio de falla de producción. Se conservan copia diaria/30 días y objetivos 24 h/4 h. Faltan destino, custodia, automatización y recuperación pública; bases dedicadas sólo Enterprise. SSH mediante Gabriel |
| 2 | P0 | Identidad operativa: cuentas personales, OTP, operador y SMTP (14) | A4 entrega cambio obligatorio para cuentas activas vinculadas y cliente técnico local, sin alterar OTP. Faltan Q03/Q04: recuperación, SMTP, cuentas personales y provisión/aceptación pública |
| 3 | P0 | Aprobar e implementar jornada y evidencia del acuse (17) | Requiere dictamen profesional y criterios de producto. Después implementar casos esperados, texto/evidencia versionados y conservación de cierres históricos; la revisión documental existente no cierra la tarea |
| 4 | P0 | Captura autenticada con tarjetas reales (16) | Herramientas Android MF1K implementadas para ejemplos; pendientes de prueba física. Falta autenticación integrada y custodia de claves: el backend sólo verifica captura simulada. Comprobar captura y rechazo con tarjetas/teléfonos reales |
| 5 | P0 | Resolver suspensión, baja, supervisor y tipo de marcaje (2) | Requiere elección del responsable del producto sobre las propuestas existentes. Implementar sólo cambios aprobados y probar permisos, históricos y captura. Hoy el supervisor abarca toda la empresa y la suspensión también detiene captura |
| 6 | P0 | Aprovisionar producción administrada para datos reales | Modelo aprobado por Gabriel, Roberto Arregui y Alex Segura: producción exclusiva de Zenit, separada de pruebas y bajo control de fastSolution; aislamiento lógico por empresa. Faltan proveedor, región, cuenta, contratos, respaldo externo, restauración y pruebas. El servidor compartido conserva sólo datos ficticios |
| 7 | P1 | Hacer reproducible Android contra backend y corregir la indicación de URL (7) | Completada el 19: `BackendSmoke.kt` y `infra/test-android-backend.ps1`, APK construidos juntos y hashes registrados. Personal y terminal pasaron contra backend local y HTTPS publicado, con datos ficticios y limpieza. Se corrigió la validación Android que rechazaba los códigos de cinco caracteres por grupo. El fallo de transporte se induce sólo en el almacén del ensayo; no acredita apagar radios ni NFC autenticado |
| 8 | P1 | Dirección real y protocolo en la cadena de proxies (parte de 19) | Prueba pública del 19 aprobada: redirección HTTPS, identidad resistente a cabeceras falsas y cuota no eludible rotando IP falsas (10 respuestas 410 y dos 429). Teléfono comprobado por HTTPS bajo Wi-Fi. Por indicación del usuario, la prueba con datos móviles y dos IP públicas queda pendiente para otro desarrollador; [entrega](TareasPendientes.md#entrega-a-otro-desarrollador-prueba-con-datos-móviles-tarea-8) |
| 9 | P1 | Recorridos del portal con sesión real (4 y parte de 14) | A5 local 33/33 el 21; horarios/importación en navegador local 17/17 el 22. API HTTPS del 19 conserva su evidencia. Faltan aceptación pública/del usuario e inventario Q17 |
| 10 | P1 | Retención de sobres y recibos Android (8) | Requiere plazo y criterio de conservación. Después implementar purga acotada con pruebas que preserven pendientes y evidencia necesaria; hoy crece sin purga |
| 11 | P1 | Verificaciones automáticas por cambio (11) | Integrada en `main`. Los cuatro trabajos aprobaron en GitHub para `565dbdd` en la ejecución 39472077601 del 20 de octubre. La obligatoriedad de trabajos requiere una decisión adicional. [Procedimiento y resultados](verificaciones-automaticas.md) |
| 12 | P1 | Actualizar análisis de imágenes y comprobar el despliegue (parte de 19) | Cinco imágenes locales analizadas el 22 sin críticas/altas ni excepciones, tras corregir Keycloak 26.8.1 con Java 25.0.5.0.2 y retirar las seis excepciones de identidad; [acta y límites](seguridad-keycloak-2026-10-22.md). Faltan IDs del servidor mediante Gabriel, análisis de esas imágenes, despliegue y comprobación pública, actualmente diferidos |
| 13 | P2 | Configuración de empresa y administración de dispositivos en portal (9) | Implementación y aceptación técnica local por rol completadas en A5 el 21. Configuración GET/PATCH /tenant y permisos de dispositivos comprobados; faltan despliegue y aceptación pública/del usuario |
| 14 | P2 | Personas que no pudieron cerrar y sus causas (10) | Implementación completada el 19: contrato 0.12 y V008, con 74 integraciones/151 pruebas web en ese corte. A5 local del 21 comprueba detalle y paginación en navegador; falta despliegue y aceptación pública/del usuario. Históricos anteriores conservan conteos |
| 15 | P2 | Semana y acuse del trabajador (12) | A2/A3, A5 e instrumentación aprobados; recorrido visual Android contra backend real local aprobado el 21. Faltan aceptación pública/del usuario, expediente y definiciones jurídicas/evidencia del orden 3 |
| 16 | P2 | Pantallas de operador del servicio (13) | Reactivación y permisos/aislamiento comprobados con sesión real en A5 local del 21. Faltan suspensión según orden 5 y aceptación pública/del usuario |
| 17 | P2 | Horarios frente a asistencia y gestión de ausencias (18) | Requiere criterios de retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y validar resultados |
| 18 | P2 | Carga, continuidad y operación del despliegue (resto de 19) | Línea base local 50/300 aprobada el 22 con captura, consultas, cierres y exportes; no acredita capacidad sostenida ni nivel de servicio. Faltan Q19, pruebas en infraestructura objetivo, continuidad, actualización del DNS ante IP dinámica y renovación real de certificados. Cuotas compartidas sólo si habrá varias instancias |
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
(9) ya pasaron. A5 y horarios/importación también aprobaron en navegador local;
faltan otra IP pública real y aceptación pública/del usuario cuando se retome
el servidor. Verificaciones automáticas (11) están publicadas en la rama y
los cuatro trabajos aprobaron en GitHub; el workflow ya está integrado en `main`. Configuración (13) está probada
localmente y espera despliegue. El análisis local (12) pasó el 22 para las cinco
imágenes sin críticas/altas ni excepciones; su cierre espera las imágenes del
servidor mediante Gabriel. La línea base local de carga ya está medida;
la aceptación de capacidad conserva Q19.

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

Los puntos 13 y 14 ya están implementados y probados. La reactivación del
punto 16 y la consulta/recuperación de acuse del 15 están integradas en
`main`; no se deben volver a implementar. La suspensión espera la decisión
del punto 5. Ninguna de estas entregas sustituye los bloqueos P0.

Para continuar después de la PR #10:

1. A5 local completado el 21: 33 casos con sesiones reales, aislamiento,
   renovación y salida. Repetir en el ambiente público y obtener aceptación
   del usuario; Q17 requiere versión, imágenes y accesos de ensayo. Las
   pantallas de horarios/importación fuera de A5 aprobaron localmente el 22.
2. Cambio obligatorio portal/backend/Keycloak comprobado localmente el 21:
   contraseña nueva, OTP conservado y token anterior todavía aceptado.
   La provisión pública conserva Q04 y el acceso olvidado espera Q03.
3. El teléfono de Q09 ya está conectado; instrumentación y [recorrido visual
   de semana/acuse contra backend real local](qa-android-semana-acuse-2026-10-21.md)
   aprobaron. Faltan aceptación pública/del usuario y expediente. La tarjeta
   autenticada conserva Q08; no está acreditada
   por el simulador ni por la herramienta MF1K de ejemplo.
4. Incorporar las respuestas Q01–Q22 antes de cambiar reglas, retención,
   respaldo externo o nómina. Se puede medir una línea base local de carga
   con datos ficticios; los criterios de aceptación requieren Q19.

### Definiciones necesarias para desbloquear tareas

| Orden | Quién debe aportar la definición | Dato que falta |
| --- | --- | --- |
| 1 | Gabriel como interlocutor técnico y responsable que se designe | Destino externo de Zenit fuera del dominio de falla de producción, custodia y segunda copia de clave; automatizar y ensayar recuperación del SaaS aprobado |
| 2 | Responsable del servicio de identidad | SMTP y encargado de OTP/recuperación del operador; resolver su autorización sin asumir que dispone de buzón |
| 3 | Responsable del producto y revisión jurídica profesional | Criterios de jornada y texto/evidencia del acuse con casos esperados |
| 4 | Equipo que facilite tarjetas y teléfonos | Tecnología de tarjeta, autenticación y entrega de claves para probar captura real |
| 5 | Responsable del producto | Elegir las reglas de suspensión, baja, supervisor y tipo de marcaje en las propuestas existentes |
| 6 | fastSolution, operación y revisión jurídica | Proveedor, región, cuenta, contrato de tratamiento y subprocesadores; respaldo externo, custodia y restauración antes del primer dato real |
| 10, 17, 18, 19 | Responsable del producto/servicio y primer cliente, según la tarea | Retención móvil, reglas de asistencia/ausencias, volumen/instancias y sistema/formato de nómina |

Se mantienen diferidos jOOQ generado, notificaciones y almacenamiento externo
de exportes. El aviso de Vite sobre un archivo de más de 500 kB no impidió la
compilación y no se trata como bloqueo crítico sin una medición que lo justifique.

El 19 se ejecutaron backend, portal, Android, identidad, ensayos API HTTPS,
análisis de imágenes y búsqueda de secretos. No se repitieron release Android
ni restauración. No se probó tarjeta física, apagado real de radios ni sesión
completa del portal. Se crearon y desactivaron datos ficticios de ensayo;
no se cambiaron reglas, credenciales humanas ni servicios desplegados.
