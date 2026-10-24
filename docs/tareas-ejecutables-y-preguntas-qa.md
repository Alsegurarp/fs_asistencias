# Trabajo ejecutable y preguntas para QA

Contexto aprobado después del corte legal del 23:
[expediente por empresa, permiso específico y MFA por descarga](expediente-empresa.md).
La prueba aislada del segundo factor por operación aprobó dentro de 10/10
pruebas de identidad; su paso de CI queda preparado localmente. Las preguntas
no reabren esas metas; Q07 conserva texto/valor del
acuse y aprobación jurídica, Q14 conserva condiciones de purga y recuperación
de evidencia local, Q03/Q04 conservan recuperación/SMTP/cuentas.

Por solicitud del usuario se declaran las
[tareas E1–E6 de implementación](expediente-empresa.md#tareas-declaradas-para-implementación),
con entregas, dependencias, área responsable y criterios de cierre: contrato,
permiso, archivo, MFA/autorización, portal y recuperación independiente.
Todas siguen abiertas y no aumentan el conteo global. El ensayo MFA aprobado
no se registra como implementación de las descargas.

Último corte del 23: cuatro trabajos de CI aprobados para `ffa8306` en la
[PR #15](https://github.com/Alsegurarp/fs_asistencias/pull/15), todavía en
borrador. Para Q14/Q10–Q13 el usuario aporta el criterio legal mexicano;
[respuesta normativa y límites técnicos](revision-juridica-jornada-acuse.md).
Esto no elige automáticamente plazos de caché, recuperación aún inexistente
ni opciones comerciales. Q03/Q04 siguen sin completar.

Avance anterior del 23: el autoensayo concurrente de respaldo aprobó
localmente y su comando corregido se añadió al workflow; [evidencia](bitacora-trabajo.md#23-de-octubre-de-2026--respaldo-concurrente-validado-y-preparación-de-ci).
Se solicitaron al usuario Q14, Q03/Q04 y Q10–Q13 para continuar las tareas de
sesión 3–5 sin fijar plazos, métodos de recuperación ni reglas por inferencia.

La [revisión anterior del 23 de octubre](bitacora-trabajo.md#23-de-octubre-de-2026--contexto-consolidado-y-siguientes-tareas)
consolida el contexto de `main`/`0723baf` y añade
[tareas posibles](tareas-criticas-primero.md#tareas-posibles-desde-el-corte-del-23-de-octubre).
El autoensayo concurrente de respaldo y su paso de CI están modificados
localmente, sin resultado aprobado; el registro sólo muestra acceso denegado
a Docker. Las preguntas siguientes conservan sus IDs y dependencias.

Actualización del 22: [trabajo local 1–5](qa-local-2026-10-22.md) y
[análisis de retención Android](retencion-android.md) entregados. Horarios e
importación en navegador local aprobaron 17/17; la línea base 50/300 no fija
objetivos de capacidad. Q14 y Q19 siguen abiertas y el servidor público
quedó diferido. Las declaraciones originales siguientes conservan su corte.

Revisión documental: 21 de octubre de 2026, sobre `main`/`907a93a`. Los números de tarea
son la columna **Orden** de [Tareas críticas primero](tareas-criticas-primero.md).
Este documento declara alcance; no inicia nuevas funcionalidades ni aprueba
reglas pendientes. Las respuestas se incorporarán conservando estos IDs.

Actualización posterior: el usuario autorizó A1–A5. Las cinco entregas locales
están implementadas/preparadas; [resultado y verificaciones](entregas-a1-a5.md)
y [33 casos de aceptación](qa-a1-a5.md). La declaración original de A1–A5
se conserva más abajo como alcance ya entregado. Las 22
preguntas conservan sus IDs para las tareas globales y el entorno público.
Al preparar la PR se incorporó `origin/main`/`ef23c20`: Q01 y Q05 se ajustan
al modelo SaaS aprobado el 19; ya no se consulta de nuevo esa decisión.
La [PR #10](https://github.com/Alsegurarp/fs_asistencias/pull/10) ya está
integrada en `main`/`e4d7683`, con sus cuatro trabajos de CI aprobados.
El siguiente paso está en [Tareas críticas primero](tareas-criticas-primero.md#trabajo-técnico-que-podemos-iniciar).
Al integrar la PR no se habían recibido respuestas adicionales ni el acta
de los 33 casos. La disponibilidad del teléfono se actualiza a continuación.
Después, el 21, se ejecutaron los [33 casos A5 locales](qa-a1-a5-2026-10-21.md),
con sesiones reales, OTP, renovación y salida. La aceptación del usuario y
el ambiente público conservan sus requisitos; la tabla distingue esos alcances.

## Posibilidad de cierre con la evidencia disponible

Corte posterior a la PR #10, 20 de octubre de 2026. El usuario confirma un
teléfono conectado y `adb devices -l` muestra un Samsung SM-S928B autorizado,
API 36. La falta de teléfono ya no bloquea la instrumentación. El resultado
de su ejecución se registra en la bitácora; disponer de ADB no acredita una
tarjeta física, una segunda IP pública ni el login/OTP del navegador.
La instrumentación `FIXTURE` ya aprobó, incluidos semana/acuse y recuperación
desde servidor HTTP simulado; 13 unitarias y lint sin errores. Después aprobó
el [recorrido visual contra backend real local](qa-android-semana-acuse-2026-10-21.md)
el 21; no se probó una tarjeta física ni se aceptó el entorno público.

**Ninguna de las 17 tareas puede declararse cerrada por leer las bitácoras.**
Las tareas 9 y 13 ya tienen aceptación técnica local dentro de A5; falta
comprobar el entorno publicado y la aceptación del usuario. La 9 conserva
aceptación pública de horarios/importación, ya aprobados localmente el 22
fuera de A5. La 15 ya tiene aprobado el ensayo instrumental con HTTP
simulado y recorrido visual contra backend real local; conserva aceptación
pública/del usuario, expediente y criterios de jornada/evidencia. No se
vuelve a implementar A1–A5 ni se repiten decisiones ya aprobadas del SaaS.

| Orden | Trabajo que puede avanzarse ahora | Duda o recurso para el cierre completo |
| --- | --- | --- |
| 1 | Reutilizar el respaldo/restauración local comprobados | Q01/Q02: proveedor, región/cuenta, destino externo, responsables y custodia; después automatizar y ensayar allí |
| 2 | A4 aceptado técnicamente en local el 21, incluido nuevo ingreso y OTP | Q03/Q04: recuperación de contraseña/OTP perdidos, SMTP/remitente, cuentas operativas y provisión pública |
| 3 | Conservar pruebas del cálculo y de versiones históricas | Q06/Q07: dictamen, resultados esperados aprobados y documento exacto/versionado del acuse |
| 4 | Usar el teléfono para instrumentación; ensayar MF1K cuando haya tarjeta | Q08/Q09: tecnología de asistencia, tarjetas compatibles, custodia/provisión de claves y reproducción del fallo físico; Q16 si se exige alternativa |
| 5 | Mantener los comportamientos vigentes y sus pruebas | Q10–Q13: suspensión total o captura permitida; revocación/horarios al dar baja; alcance del supervisor; tipo de marcaje del MVP |
| 6 | Usar la topología SaaS ya aprobada para preparar producción | Q01/Q05: proveedor, región/cuenta, responsables, contratos, privacidad y aceptación operativa antes del primer dato real |
| 8 | Reutilizar el procedimiento público ya preparado | Q18: dos conexiones con IP públicas distintas y responsable/fecha. La prueba móvil sigue diferida a otro desarrollador por indicación previa |
| 9 | A5 local 33/33 y horarios/importación local 17/17; continuar aceptación pública cuando se retome | Q17: entorno/commit, acceso de ensayo y acta pública; la evidencia local no acredita su despliegue |
| 10 | Revisar almacenamiento y proteger los pendientes | Q14: días por tipo de sobre/recibo/acuse, evidencia que conserva servidor y condiciones de purga |
| 12 | Conservar CI e inventario local como antecedentes | Q17: Gabriel debe aportar commit, migraciones e IDs del servidor; analizar, corregir/desplegar y comprobar esas imágenes |
| 13 | Configuración y permisos de dispositivos comprobados en A5 local | Q17: confirmar versión y aceptación pública y del usuario |
| 15 | Semana/acuse visual contra backend real local e instrumentación FIXTURE aprobados | Q07/Q17: aceptación pública/del usuario, expediente completo y texto/evidencia aprobados; las reglas conservan Q06 y tarjeta física Q09 |
| 16 | Aceptar alta/listado y reactivación ya implementados | Q10/Q17: política de suspensión aprobada y aceptación del portal con operador y roles ajenos |
| 17 | Usar horarios/asignaciones ya existentes sin inventar tolerancias | Q15/Q06: tolerancias/redondeos, solicitud y aprobación de ausencias, evidencia y efecto en semana/nómina |
| 18 | Medir línea base local con datos ficticios | Q19: empresas/dispositivos concurrentes, instancias, latencia/error aceptables y responsables de DNS/certificados; después probar destino |
| 19 | Conservar exportes actuales como base | Q20: sistema/versión de nómina, formato de ejemplo ficticio, identificadores, correcciones/reintentos y responsable de aceptación |
| 20 | Mantener contrato 0.13 y sus verificaciones | Q21: consumidores, alcance obligatorio de 1.0 y política de compatibilidad; cerrar dependencias anteriores |

Prioridad para respuestas: Q17 permite continuar la aceptación de 9/13 y
precisar el despliegue de 12; Q10–Q13 desbloquean reglas y suspensión;
Q14 permite implementar retención. Q06/Q07 requieren aprobación profesional.
Q22 es adicional: no reabre la tarea 11 ni forma parte de las 17 abiertas.

## Avance comprobado vigente

- Código local y remoto comprobados el 21 en `main`/`907a93a`, con PR #10 y
  #11 integradas. Los cuatro trabajos de la
  [PR #11](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39510565196)
  aprobaron; ese resultado no acredita despliegue público.
- A1–A4: construcción/unitarias y 75 integraciones PostgreSQL, 162 pruebas
  del portal, 13 unitarias Android y lint, 7 comprobaciones de identidad y
  contrato aprobados. El 21 se repitieron las 162 pruebas web y su compilación.
- V008 aplicada y restauración de 131 tablas/1,970 filas idénticas en el
  corte del 20. Al comenzar el 21 Docker estaba detenido; el encendido del
  ambiente se verifica al ejecutar QA, no se infiere de aquel corte.
- El portal implementa reactivación y consulta personal; backend, web y
  Android recuperan el acuse vigente del servidor. Android incluye bienvenida,
  administración integrada y herramientas MF1K de ejemplo.
- Samsung SM-S928B autorizado por ADB, confirmado el 21. Instrumentación
  FIXTURE de semana/acuse aprobada el 20 con HTTP simulado. Faltan captura
  autenticada real, aceptación por caso y versión del servidor público.
- A5 local: 33/33 casos comprobados el 21, con acta por caso. Corregidos
  permisos tmpfs de Keycloak; siete pruebas aisladas salud/realm aprobadas,
  incluida la nueva prueba de recursos. Android rechaza acuses de cierre ajeno
  en la instrumentación ampliada, aprobada en teléfono.
- Se mantienen 17 tareas abiertas total o parcialmente y los seis P0.
  No hay evidencia nueva que permita cerrar íntegramente una de esas tareas.

## A1–A5: alcance original ya entregado

La tabla conserva los criterios de implementación originales, ya cumplidos
en A1–A4 y preparados en A5. No es trabajo por volver a implementar.
El despliegue y la ejecución de la aceptación de cada tarea conservan sus
requisitos. El trabajo actual es ejecutar el guion A5 y registrar resultados.

| ID | Tarea de origen | Entrega concreta y criterio de terminación |
| --- | --- | --- |
| A1 | 16 | Reactivar empresas desde el portal del operador. Reutilizar `POST /tenants/{tenantId}/reactivation`, motivo y auditoría existentes; confirmación, errores, actualización de listado y pruebas de permisos/conflictos. La suspensión conserva Q10 |
| A2 | 15 | Mostrar la semana del trabajador en el portal con `/me/attendance`, usando su vínculo actual con el padrón. Fecha, tramos, totales, alertas y estado del cierre; probar falta de vínculo y aislamiento. Mostrar los cálculos actuales sin cambiar reglas ni presentar cumplimiento jurídico |
| A3 | 15 | Recuperar el acuse vigente desde el servidor para el trabajador autenticado y consumirlo en Android/web. Reutilizar el acuse ya persistido y limitar la consulta a su empresa, empleado y versión de cierre. Probar otro dispositivo, ausencia de acuse, reapertura y rechazo de acceso ajeno. No reconstruir el expediente completo ni cambiar su valor jurídico |
| A4 | 2 | Exigir cambio de contraseña al próximo ingreso para una cuenta ya vinculada, desde la administración de su empresa. Contrato, backend, integración de identidad, portal y pruebas aisladas; conservar OTP y no modificar la contraseña directamente. Preparar credencial técnica con permisos mínimos para ensayo. Activación en el servidor depende de Q03/Q04; no resuelve contraseña olvidada |
| A5 | 9, 13, 14, 16 | Preparar el guion de aceptación con datos ficticios y resultados esperados por rol: administración, RH, supervisor, auditor, trabajador y operador; incluir aislamiento entre empresas. Se puede completar el guion con el contrato actual. Ejecutarlo y aceptar el servidor requiere Q17 |

El orden original fue A1, A2, A3, A4; A5 sirve de guion para sus
aceptaciones. Son subtareas delimitadas, no cinco nuevas tareas globales.
Ninguna requiere elegir proveedor de respaldo, tolerancias de asistencia o
tecnología NFC. La obligatoriedad de CI se trata aparte en Q22.

## Preguntas para la sesión con los desarrolladores

Para cada respuesta: indicar decisión o resultado, responsable, entorno y
evidencia; si falta decidir, señalar quién y para cuándo. Usar datos ficticios
y referencias al canal seguro de accesos; no incluir contraseñas, tokens ni
claves privadas en las respuestas.

### Infraestructura e identidad

1. **Q01 — Infraestructura del SaaS (1).** El modelo aprobado usa producción
   exclusiva de Zenit bajo control de fastSolution, con backend y PostgreSQL
   compartidos y aislamiento lógico por empresa. ¿Qué proveedor, región y
   cuenta se usarán, dónde vivirá identidad y qué esquema de red/accesos se
   implementará? Entregar el esquema objetivo conforme a
   [la decisión aprobada](decisiones-de-negocio.md#modelo-de-alojamiento-aprobado).
2. **Q02 — Operación de respaldos (1).** ¿Qué destino externo se elige, quién
   custodia la clave y su segunda copia, y quién habilita transferencia,
   programación y avisos? Ya están aprobados diario/30 días y objetivos
   24 h/4 h; falta probarlos en el modelo elegido.
3. **Q03 — Acceso perdido (2).** Si el empleado olvidó su contraseña,
   ¿recibirá enlace de recuperación o credencial temporal? ¿Cómo se verifica
   su identidad, quién lo atiende y qué procedimiento aplica si perdió OTP?
   El cambio obligatorio por sí solo no recupera acceso; el flujo actual
   conserva OTP.
4. **Q04 — Identidad operativa (2).** ¿Qué servicio SMTP/remitente estará
   disponible y quién provisionará la credencial técnica de backend y las
   cuentas personales de administración/operación? ¿Quién ejecutará y
   registrará las pruebas de correo, contraseña y OTP antes de retirar la
   cuenta temporal de arranque?
5. **Q05 — Habilitación de producción (6).** El servidor compartido conserva
   sólo datos ficticios y se abandona antes del primer dato real. ¿Quiénes
   aprovisionarán producción bajo control de fastSolution y entregarán los
   contratos de tratamiento/subprocesadores, privacidad, retención, respuesta
   a incidentes y revisión jurídica? ¿Quién aceptará el respaldo externo,
   custodia y restauración, y con qué evidencia y fecha?

### Producto, jornada y credenciales

6. **Q06 — Jornada (3).** ¿Quién aportará el dictamen profesional y la tabla
   aprobada de resultados esperados para jornadas, extras, descansos, turnos
   nocturnos y cruces de día/semana? Los desarrolladores deben identificar
   responsable y casos; su respuesta técnica no sustituye el dictamen.
7. **Q07 — Acuse y expediente (3, 15).** ¿Qué texto/documento exacto revisa el
   trabajador, cómo se versiona, quién representa al empleador y cuánto se
   conserva? ¿Qué ve el trabajador de ajustes y objeciones, quién responde y
   qué debe ocurrir cuando se reabre un cierre ya acusado? Entregar ejemplos
   de aceptación y responsable de aprobación jurídica.
8. **Q08 — Tarjetas para asistencia (4).** Las herramientas actuales usan
   MF1K; el contrato también contempla DESFire EV3 AES y el backend sólo
   verifica el esquema simulado. ¿Qué tecnología se aprueba para captura
   autenticada y cómo se provisionan, custodian y revocan sus claves?
9. **Q09 — Pruebas físicas Android (4, 15).** El teléfono ya está disponible
   por ADB (Samsung SM-S928B, API 36). ¿Qué tarjetas compatibles se facilitarán
   para la prueba física? Login/OTP y semana/acuse requieren sus recorridos.
   Sobre el fallo de sobrescritura: ¿qué APK, modelo de
   tarjeta, pasos y mensaje exacto lo reproducen? Confirmar lectura posterior
   a carga y borrado sin atribuir una causa todavía no comprobada.
10. **Q10 — Suspensión de empresas (5, 16).** ¿Se aprueba conservar captura y
    sincronización de dispositivos ya vinculados, bloqueando administración,
    cierres y nuevas vinculaciones, o se conserva el bloqueo total actual?
    ¿Qué acceso se mantiene a recibos e históricos durante la suspensión?
11. **Q11 — Baja de empleados (5).** ¿Debe revocar tarjetas y terminar horarios
    automáticamente? Precisar fecha efectiva, asignaciones futuras y qué se
    recupera o requiere nueva asignación al reactivar a la persona.
12. **Q12 — Supervisor (5).** ¿Conserva alcance sobre toda la empresa o se
    limita a sedes asignadas? Si se limita, ¿quién administra esas asignaciones
    y qué ocurre sin sede o al cambiar de sede?
13. **Q13 — Tipo de marcaje (5).** ¿Se confirma para el MVP la deducción del
    servidor junto con la declaración explícita validada, como funciona hoy?
    Si cambia, entregar la secuencia esperada para descansos y marcajes fuera
    de orden.
14. **Q14 — Retención Android (10).** ¿Cuántos días se conservan sobres y
    recibos procesados, incluidos rechazos y acuses? ¿El servidor conservará
    la evidencia necesaria para permitir borrarlos del teléfono? Los marcajes
    pendientes quedan fuera de la purga.
15. **Q15 — Horarios y ausencias (17).** ¿Qué tolerancias, redondeos y reglas
    se aprueban para retardo, falta, salida anticipada, vacaciones e
    incapacidad? ¿Quién solicita/aprueba, qué evidencia adjunta y cómo afecta
    el resultado semanal y de nómina? Entregar ejemplos con resultado esperado.
16. **Q16 — Alternativa sin NFC (alcance móvil/4).** ¿Es requisito del primer
    piloto marcar sin tarjeta o sin teléfono personal? Si lo es, ¿qué método
    se acepta, quién lo autoriza por empresa y cómo se acredita al empleado?
    La app permite instalar sin NFC, pero eso no habilita otro método.

### QA, despliegue e integraciones

17. **Q17 — Entorno y aceptación (9, 12, 13, 14, 16).** ¿Qué commit, V008 e
    IDs de imágenes ejecuta el servidor de QA? ¿Quién, mediante el interlocutor
    SSH del proyecto, actualizará y entregará ese inventario? ¿Qué entorno,
    cuentas ficticias por rol y navegador se usarán para probar pantallas,
    aislamiento entre empresas, renovación y cierre de sesión? Registrar
    fallos con pasos, esperado/obtenido y evidencia.
18. **Q18 — Dos IP públicas (8).** La prueba móvil está entregada a otro
    desarrollador. ¿Quién la ejecutará y cuándo? Entregar evidencia de cuotas
    independientes en la misma ventana desde computadora y red móvil,
    siguiendo [el procedimiento](TareasPendientes.md#entrega-a-otro-desarrollador-prueba-con-datos-móviles-tarea-8).
19. **Q19 — Carga y continuidad (18).** Ya se conocen perfiles de 50/300
    empleados y cuatro marcajes diarios. ¿Cuántas empresas y dispositivos
    coincidirán en hora pico, cuántas instancias atenderán y qué tiempos y
    tasa de errores se aceptan? ¿Quién comprobará renovación de certificados
    y actualización de DNS? Sin objetivos puede medirse una línea base local,
    pero no aceptar capacidad de operación.
20. **Q20 — Nómina (19).** ¿Cuál es el sistema/versión del primer cliente y
    cómo se intercambian datos? Entregar especificación y ejemplo ficticio
    aceptable: identificadores, columnas, fechas, unidades, codificación,
    separador y tratamiento de correcciones/reintentos. Identificar quién
    aceptará el archivo y el conector.
21. **Q21 — Contrato 1.0 (20).** ¿Qué consumidores y responsables deben aceptar
    el contrato, qué funciones son obligatorias para 1.0 y qué política de
    compatibilidad/versionado se acuerda? El congelamiento espera decisiones
    y recorridos anteriores.
22. **Q22 — CI obligatorio (11, adicional).** ¿Se desea exigir los cuatro
    trabajos antes de integrar cambios y trabajar mediante pull requests?
    ¿Quién administrará la protección de `main`? Ejecutar y aprobar el
    workflow ya está resuelto; esta es una decisión adicional de colaboración.

## Qué desbloquea cada respuesta

| Tarea abierta | Respuestas o recursos que faltan para cerrarla completa |
| --- | --- |
| 1 | Q01, Q02 y recuperación en infraestructura destino |
| 2 | Q03, Q04; A4 sólo completa el cambio obligatorio local |
| 3 | Q06, Q07 y aprobación profesional |
| 4 | Q08, Q09; Q16 si la alternativa se exige en el piloto |
| 5 | Q10, Q11, Q12, Q13 |
| 6 | Q05 |
| 8 | Q18 y segunda conexión pública real |
| 9 | Q17 y sesión real de navegador |
| 10 | Q14 |
| 12 | Q17 e imágenes/actuación del servidor |
| 13 | Q17 y aceptación de pantallas/permisos |
| 15 | A2, A3, Q07, Q09 y Q17; expediente completo conserva Q06/Q07 |
| 16 | A1, Q10 y Q17 |
| 17 | Q15 y criterios de jornada aplicables de Q06 |
| 18 | Q19 y pruebas en el entorno objetivo |
| 19 | Q20 |
| 20 | Q21 y cierre de dependencias anteriores |

Formato sugerido para devolver respuestas:

```text
Qxx:
Respuesta o decisión:
Responsable:
Entorno/versión:
Evidencia o ejemplo ficticio:
Pendiente y fecha, si aplica:
```
