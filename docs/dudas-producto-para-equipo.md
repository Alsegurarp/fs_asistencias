# Dudas del producto para resolver con el equipo

**Proveedores resueltos el 6 de noviembre:** Q01 usa **Hostinger, United
States - Phoenix** y Q02 **el bucket AWS S3 de `bucket.md`, `us-east-2`**.
El usuario confirma AWS y sustituye la referencia intermedia a Firebase/GCS.
Se conservan copia diaria/30 días, RPO 24 h/RTO 4 h y custodia. Faltan IP/
dominio, acceso SSH e identidad AWS autorizada; no volver a preguntar por
proveedores, regiones ni el identificador del bucket. Faltan también
responsables y ensayo real. [Decisión vigente](decisiones-de-negocio.md#proveedores-confirmados--6-de-noviembre-de-2026).

**Resultado de ejecución del 5 de noviembre:** Q10–Q13 ya no esperan elección:
fueron aprobadas, implementadas y probadas en el árbol integrado. Q03 tiene
recuperación real con 12 códigos de un uso probada en Keycloak local; falta
SMTP y operación excepcional. Q06 tiene límites diarios/semanales implementados,
manteniendo sus condiciones del empleador/evidencia pendientes. El candidato
local es 0.18.0 con V012/V013; se debe inventariar aparte el servidor público.
[Resultado de las 17 tareas y condiciones de cierre](bitacora-trabajo.md#5-de-noviembre-de-2026--ejecución-de-las-17-tareas-por-necesidad-inmediata).
Las alternativas históricas siguientes no reabren las elecciones recibidas.

Revisión del **4 de noviembre de 2026**, sobre `main/645174d` y los cambios
documentales locales; respuestas Q01–Q04 y precisión Q23 recibidas el
**5 de noviembre de 2026**. Este cuestionario distingue decisiones recibidas
de recursos y aceptaciones pendientes. Las opciones restantes sirven para
discutir: ninguna queda aprobada por aparecer aquí.

Se conservan Q01–Q22 para poder cruzar respuestas anteriores. Q23–Q25
recogen asuntos provisionales que estaban fuera de ese listado; no agregan
tres tareas globales. Permanecen 17 tareas abiertas y seis P0. Los números
de tarea corresponden a la columna **Orden** de
[Tareas críticas primero](tareas-criticas-primero.md).

**Criterio adicional del 5 de noviembre:** las preguntas que la reforma de
40 horas y la LFT permitan contestar quedan respondidas con la norma, su
artículo y vigencia. Las [respuestas legales por clave](revision-juridica-jornada-acuse.md#respuestas-legales-aplicables--5-de-noviembre-de-2026)
forman parte de este cuestionario. La columna de pendientes de esa revisión
delimita lo que aún debe aportar el equipo; los mínimos legales no siguen
abiertos a elección. Su implementación y comprobación pueden seguir pendientes.

## Decisiones que ya están tomadas

- **Actualización durante la ejecución del 5 de noviembre:** una instancia
  en VPS privada por cliente, administrada y soportada por el equipo
  desarrollador; el administrador del cliente tiene sus propias credenciales.
  Sustituye al modelo compartido anterior. Se conserva aislamiento interno
  por empresa como control adicional del backend, sin compartir instancias.
- Respaldo diario y retención de copias de 30 días; objetivos de pérdida
  máxima de 24 horas y recuperación en 4 horas. fastSolution atiende fallos;
  falta concretar destino, custodia, personas y comprobar los objetivos.
  La copia externa debe ser diaria; la propuesta semanal queda descartada.
  Destino final del 6 de noviembre: bucket AWS S3 de `bucket.md`, `us-east-2`,
  manejado por el equipo desarrollador; sustituye la referencia a Firebase.
  Custodia: administrador del cliente o equipo desarrollador si no la asume;
  falta identificar personas, entrega, proveedor/bucket y ensayo.
- Recuperación de contraseña por correo verificado; pérdida de OTP con los
  12 códigos de recuperación de Keycloak 26.8.1 y, como último recurso,
  soporte con doble aprobación. SMTP provisional antes del nombre comercial;
  operación con cuentas personales con MFA, turnos primario/respaldo y sin
  credenciales compartidas. Falta provisión y validación operativa.
- Perfiles de referencia de 50 y 300 empleados, cuatro marcajes diarios y
  un año consultable. Falta la concurrencia y el objetivo de rendimiento.
- Expediente de una sola empresa, permiso específico y MFA nuevo por
  descarga, con autorización de un uso. E1–E5 y E6 técnica ya existen.
  El respaldo multiempresa no se entrega como expediente de un cliente.
- El cambio de comida de la PR #26 ya está integrado con motivo, cancelación
  y siete días hasta la vigencia. Q23 conserva ratificación de SUP-025 y
  aceptación del recorrido desplegado.
- Automatización CI ya implementada. Q22 pregunta por protección de ramas.
- Notificaciones generales, jOOQ generado y almacenamiento externo de
  exportes siguen diferidos; no se convierten aquí en requisitos nuevos.

## Infraestructura, respaldo y acceso

### Q01. ¿Dónde va a operar la producción de Zenit?

**Decisión vigente durante la ejecución del 5 de noviembre:** una instancia
en VPS privada por cliente, administrada y soportada por el equipo desarrollador,
con credenciales propias del administrador del cliente. Sustituye la respuesta
anterior de producción compartida.
**Pendiente de provisión:**

Hostinger en United States - Phoenix está elegido. Precisar cuenta controlada por fastSolution, alojamiento
de identidad, red y responsables. Opciones de operación: infraestructura
autogestionada o componentes administrados, manteniendo la instancia privada.
Se necesita un esquema objetivo y responsable de aprovisionamiento.
**Resuelven:** operación/arquitectura. **Desbloquea:** tareas 1 y 6.

### Q02. ¿Cómo se hará el respaldo externo y quién custodia las claves?

**Decidido el 5 de noviembre:** respaldo externo diario, 30 días de retención,
RPO 24 h y RTO 4 h. La propuesta semanal queda descartada por incompatibilidad.
**Pendiente de operación y ensayo:**

El usuario confirma el bucket AWS S3 de `bucket.md`, región `us-east-2`,
manejado por el equipo desarrollador. Falta identidad técnica por prefijo fuera
del dominio de falla de la VPS. El administrador del cliente custodia las
claves; si no lo asume, el equipo desarrollador. Identificar personas, segunda
copia separada, responsable de avisos y ejecutor del ensayo. Mantener
diario/30 días y objetivos 24 h/4 h.
Gabriel es interlocutor SSH; no está designado automáticamente custodio.
**Resuelven:** operación y responsable del servicio. **Desbloquea:** tarea 1.

### Q03. ¿Cómo recupera acceso alguien que olvidó la contraseña o perdió OTP?

**Decidido el 5 de noviembre:** recuperación de contraseña mediante correo
verificado. Para pérdida de OTP, los 12 códigos de recuperación de Keycloak
26.8.1; como último recurso, soporte con doble aprobación.
**Pendiente:** configurar y probar ambos recorridos, precisar verificación
de identidad, responsables, evidencia de las dos aprobaciones y comunicación
de la recuperación. El cambio obligatorio actual conserva OTP y no recupera
por sí solo una contraseña olvidada. La decisión no acredita que los códigos
ya estén habilitados o entregados.
**Resuelven:** producto, identidad y soporte. **Desbloquea:** tarea 2.

### Q04. ¿Qué correo y cuentas operativas se habilitarán?

**Decidido el 5 de noviembre:** SMTP provisional antes del nombre comercial;
cuentas personales con MFA, turnos primario/respaldo y sin credenciales
compartidas. **Pendiente de provisión y asignación:**

El usuario indica que proveedor y remitente SMTP se anexarán en el futuro;
no habilitar verificación/recuperación por correo antes de probar recepción.

Concretar servicio SMTP, remitente/dominio, responsable de configuración,
cuentas personales de administración/operación y quién prueba correo,
contraseña y OTP. La aplicación de clientes/flujos de identidad ya se
integró; falta verificar el ambiente efectivo. Retirar la cuenta temporal
después de comprobar las personales. Entregar secretos por canal seguro,
no en las respuestas de este documento.
**Resuelven:** identidad y operación. **Desbloquea:** tarea 2.

### Q05. ¿Quién autoriza el primer uso con datos reales y con qué evidencia?

Nombrar responsables de privacidad, contratos y revisión jurídica,
operación y aceptación. Acordar evidencia exigida para cuentas, permisos,
respaldo externo, restauración y atención de incidentes, y fecha objetivo
condicionada a cumplirla. El servidor compartido conserva datos ficticios;
no se convierte en producción por completar pruebas técnicas.
**Resuelven:** responsable del producto/servicio y asesoría jurídica.
**Desbloquea:** tarea 6 y aceptación de los P0.

## Reglas del producto y uso cotidiano

### Q06. ¿Qué resultados debe producir el cálculo de jornada?

**Contestado por ley:** aplicar clasificación, límites diarios/semanales,
descansos, extraordinario y transición de vigencias de
[Q06 en la revisión legal](revision-juridica-jornada-acuse.md#q06-jornada-horas-extra-y-vigencias).
**Pendiente de desarrollo/validación:** tabla de entradas/resultados basada
en esas reglas, horario pactado y casos de medianoche/semana/año; resolver
las interpretaciones concretas que se identifiquen. No esperar otra elección
de los límites expresos ni derivarlos de tolerancias visuales de Android.
**Implementan/validan:** backend, producto/RH y QA; asesoría para los casos
de interpretación identificados. **Desbloquea:** tarea 3.

### Q07. ¿Qué revisa y acepta u objeta el trabajador?

**Contestado por ley:** registro, acuerdo de ambas partes, conservación y
prohibición de renuncia conforme a la revisión legal vinculada arriba.
**Pendiente de instrumentación y aceptación:**

Entregar el texto/documento exacto, su versión y un ejemplo. Definir quién
representa al empleador, quién atiende objeciones, plazo/procedimiento de
respuesta y qué se vuelve a presentar tras reabrir y cerrar otra versión.
Opciones de producto: conservar el acuse semanal actual como alcance con
texto/evidencia aprobados, o especificar los cambios necesarios. Las
versiones anteriores se conservan en ambos casos.
**Resuelven:** producto/RH y asesoría jurídica. **Desbloquea:** tareas 3 y 15.

### Q08. ¿Qué tarjeta autenticada usará el primer piloto?

Opciones a evaluar con el equipo de hardware: completar un esquema basado
en las tarjetas MF1K disponibles o seleccionar DESFire EV3 AES, contemplada
en el contrato. Elegir exige definir protocolo, aprovisionamiento,
custodia/rotación y revocación de claves, no sólo el nombre de la tarjeta.
Confirmar quién integra teléfono/backend y prueba compatibilidad.
La captura Android release sigue bloqueada hasta completar esa integración.
**Resuelven:** producto, hardware y seguridad. **Desbloquea:** tarea 4.

**Respuesta del 10 de noviembre de 2026 (Alexis):** el piloto usa las
MIFARE Classic 1K disponibles y se compran DESFire EV3 cuando haya capital.
La tarjeta no guarda datos de la persona: sólo un código aleatorio con la
firma del servidor ligada a su identificador. Riesgo aceptado: una Classic
se puede clonar con equipo especial. Implementado como
`mifare_classic_signed` ([Tarjetas del piloto](guia-app-android.md#tarjetas-del-piloto-mifare-classic)).
DESFire sigue pendiente.

### Q09. ¿Qué material físico y casos reproducibles tendremos para validar?

El teléfono de ensayos ya está documentado; falta confirmar tarjetas
compatibles, modelos Android que se soportarán en el piloto y responsable
de entregarlos/probarlos. Para el fallo de sobrescritura mencionado en las
notas: aportar APK/commit, modelo de tarjeta, pasos, esperado/obtenido y
mensaje exacto. Probar lectura posterior, reemplazo y borrado sin atribuir
una causa todavía no comprobada.
**Resuelven:** hardware y QA. **Desbloquea:** tareas 4 y 15.

### Q10. ¿Qué continúa funcionando al suspender una empresa?

**Implementado y probado localmente:** propuesta B. La aceptación desplegada
sigue pendiente; no se vuelve a pedir elegir A/B.

**Contestado en su parte legal:** la suspensión comercial no elimina las
obligaciones de registro y conservación del empleador. **Pendiente operativo:**

Opciones registradas: A) conservar bloqueo total actual; B) permitir
captura/sincronización de dispositivos existentes y bloquear administración,
cierres y nuevas vinculaciones. Precisar acceso a recibos, consulta y
entrega de históricos durante la suspensión y el canal alternativo si
Zenit deja de registrar. La evidencia no se borra por esta decisión.
**Resuelven:** producto/servicio con revisión jurídica. **Desbloquea:** tareas 5 y 16.

### Q11. ¿Qué efectos debe tener la baja y la reactivación de un empleado?

**Decidido durante la ejecución:** aplicar propuesta B de abajo, con fecha
efectiva y conservación del historial. La reactivación no recupera por sí
sola una tarjeta revocada ni restablece horarios terminados.
Implementación local: fecha no futura obligatoria, fin del horario aplicable;
las asignaciones futuras se conservan. La llegada offline se valida contra
la asignación de tarjeta vigente al ocurrir el evento. Casos cubiertos por
integración; no se elimina la evidencia por llegar después de la baja.

**Contestado en su parte legal:** preservar documentación por el régimen
aplicable a la terminación; la baja técnica no determina por sí sola la
terminación laboral. **Pendiente de comportamiento técnico:**

Opciones: A) mantener la desactivación actual sin revocar tarjeta ni cerrar
horarios; B) revocar tarjeta y terminar asignaciones a la fecha efectiva.
Precisar futuro de horarios ya programados, captura offline que llega
después de la baja y si reactivar requiere nuevas asignaciones/credenciales.
En ambos casos conservar históricos.
**Resuelven:** producto/RH. **Desbloquea:** tarea 5.

### Q12. ¿El supervisor trabaja sobre toda la empresa o sólo sus sedes?

**Decidido durante la ejecución:** opción B, sólo sedes asignadas; sin
asignaciones no ve datos de supervisión. Administración gestiona la
asignación. El alcance adicional de auditor sólo amplía lectura, no escritura.
V012, portal y filtros del servidor implementados; probados antes de paginar
y por ID. Las semanas que incluyan evidencia fuera de alcance se deniegan
completas; el acceso propio como trabajador se conserva. RH no gestiona usuarios.

Opciones: A) alcance actual de toda la empresa; B) sólo sedes asignadas.
Para B: indicar quién administra asignaciones y qué ve de empleados sin
sede o trasladados. Acordar también acceso a históricos tras un traslado.
**Resuelven:** producto/RH. **Desbloquea:** tarea 5.

### Q13. ¿Cómo se elige entrada, salida o descanso al registrar?

**Decidido durante la ejecución:** opción A, conservar deducción más
declaración explícita validada.

Opciones: A) conservar deducción del servidor más declaración explícita
validada; B) exigir siempre selección explícita; C) sólo deducción.
Entregar ejemplos de doble lectura, descanso omitido, orden de llegada
distinto del orden de captura y corrección posterior. Se conserva lo
observado y su trazabilidad cualquiera que sea la elección.
**Resuelven:** producto/RH y equipo móvil/backend. **Desbloquea:** tarea 5.

### Q14. ¿Qué evidencia se conserva y cuándo puede eliminarse del teléfono?

**Contestado por ley:** el archivo del empleador sigue los plazos e
impedimentos de [Q14 en la revisión legal](revision-juridica-jornada-acuse.md#q06q14q15q23-reglas-complementarias-de-la-lft).
No se vuelve a pedir un plazo libre para la conservación legal.
**Pendiente técnico/operativo:** separar ese archivo de duplicados locales.
Para los duplicados locales aceptados, aceptados con incidencia, rechazados
y acuses, precisar disponibilidad operativa, desde qué
fecha se cuenta, lugar de conservación, acceso histórico e impedimentos de
borrado. Los estados pendientes quedan excluidos. Resolver si se amplía el
archivo del servidor para incluir sobres originales rechazados y evidencia
local ausente del expediente, o se define otra custodia comprobable.
Opciones de ejecución: mantenerlos hasta completar esa garantía o purgar
sólo duplicados cuya recuperación se haya demostrado. No se propone un
número de días sin la definición correspondiente.
**Resuelven:** producto, asesoría jurídica, móvil y backend.
**Desbloquea:** tarea 10 y aceptación integral E6.

### Q15. ¿Cómo se determinan puntualidad y ausencias frente al horario?

**Contestado por ley:** mínimos de vacaciones y tratamiento legal de
ausencias/incapacidad según la revisión; no equiparar automáticamente falta
de marcaje a falta injustificada. **Pendiente del empleador y desarrollo:**
horario pactado, retardos, salida anticipada, tolerancias/redondeos válidos,
quién solicita/aprueba y efectos en semana/nómina. Incluir
qué ocurre cuando no hay marcajes: hoy puede cerrarse en ceros, sin un flujo
completo de ausencia. Opciones de alcance: comparación informativa para
revisión humana o reglas aprobadas que produzcan resultados operativos;
las tolerancias y consecuencias requieren casos explícitos.
**Resuelven:** producto/RH y asesoría laboral. **Desbloquea:** tarea 17.

### Q16. ¿El primer piloto exige registrar sin tarjeta o sin teléfono propio?

Opciones: A) mantener teléfono personal con tarjeta y terminal compartida
con tarjeta; B) añadir un mecanismo alternativo definido por el equipo.
Para B: indicar cómo acredita a la persona, quién lo habilita y qué evidencia
produce. Poder instalar Android sin NFC no habilita otra forma de marcar.
**Resuelven:** producto y cliente piloto. **Desbloquea:** alcance de tarea 4.

## QA, operación e integraciones

### Q17. ¿Dónde y quién acepta el recorrido completo?

Identificar ambiente, commit, migraciones aplicadas —la base revisada llega
a V011— e imágenes desplegadas. Designar quién obtiene el inventario por
el interlocutor SSH, cuentas ficticias por rol/empresa, navegador/teléfono
y responsable de aceptación. Incluir accesibilidad manual, cambio de comida
en teléfono y expediente fuera de Zenit con sus límites. E6 técnica existe;
falta quién acepta recuperación/conservación y las diferencias de evidencia
que deban resolverse mediante Q07/Q14.
**Resuelven:** QA, producto y operación. **Desbloquea:** tareas 9, 12, 13, 15 y 16.

### Q18. ¿Quién hará la prueba de cuotas desde dos IP públicas y cuándo?

Está entregada a otro desarrollador y diferida por indicación del usuario.
Confirmar responsable, disponibilidad de red móvil y fecha cuando se retome;
no repetirla sólo con dos dispositivos bajo el mismo Wi-Fi. La evidencia
debe cubrir ambas conexiones durante la misma ventana de cuota.
**Resuelven:** QA y desarrollador asignado. **Desbloquea:** tarea 8.

### Q19. ¿Qué carga, tiempos de respuesta y continuidad debemos garantizar?

Además de los perfiles 50/300, precisar empresas/dispositivos simultáneos,
hora pico, instancias, tiempo de respuesta aceptable y porcentaje de errores.
Confirmar si las cuotas actuales sirven al uso esperado, y responsables de
DNS, certificados y respuesta a fallos. Entregar objetivos medibles; una
línea base local no demuestra capacidad del destino de producción.
**Resuelven:** producto, operación y arquitectura. **Desbloquea:** tarea 18.

### Q20. ¿Con qué nómina se integra y qué archivo/protocolo acepta?

Precisar sistema y versión del primer cliente. Opciones según su interfaz:
archivo CSV, API o conector saliente; no se elige protocolo sin especificación.
Entregar un ejemplo ficticio aceptado con identificadores, columnas,
fechas, unidades, codificación y reglas de correcciones/reintentos.
Determinar si sólo exporta resultados o también sincroniza el padrón,
qué sistema es origen de cada dato y quién acepta la integración.
**Resuelven:** cliente piloto, producto e integraciones. **Desbloquea:** tarea 19.

### Q21. ¿Qué funciones y consumidores definen la versión 1.0?

Entregar lista de funciones obligatorias y diferidas del primer piloto,
consumidores del API y responsables de aceptación. Acordar compatibilidad,
versionado y comunicación de cambios. La administración actual usa el
portal integrado en Android; no se presupone sustituirlo por pantallas
nativas ni convertir la presentación debug en requisito nuevo.
**Resuelven:** producto y responsables de consumidores. **Desbloquea:** tarea 20.

### Q22. ¿Se protegerá main exigiendo PR y los cuatro trabajos de CI?

Opciones: A) conservar la política actual; B) exigir PR y checks aprobados;
C) añadir también revisión humana obligatoria. Precisar quién configura
protecciones, revisa y tramita excepciones. Ejecutar CI ya está resuelto;
esta respuesta define colaboración y controles de integración.
**Resuelven:** responsables del repositorio. **Desbloquea:** decisión adicional de tarea 11.

## Precisiones encontradas fuera del cuestionario anterior

### Q23. ¿Quedan ratificados los detalles implementados del cambio de comida?

**Precisión recibida el 5 de noviembre:** la PR #26 ya está integrada con
motivo, cancelación y siete días de aviso hasta la vigencia.
**Pendiente:** ratificar SUP-025 y aceptar el recorrido desplegado, incluido
portal/teléfono. La integración no se registra como ratificación ni aceptación
desplegada. Una empresa mal configurada también espera la fecha programada;
no se reabre la decisión de programar el cambio.
El cómputo de comida se sujeta a los mínimos legales ya contestados en
Q06; motivo, siete días y cancelación son decisiones del producto y no se
atribuyen como mandatos de la reforma.
**Resuelven:** producto y responsables de la PR. **Afecta:** tarea 13 y aceptación del cambio.

### Q24. ¿Se aceptan las reglas actuales de ubicación e incidencias?

Hoy se conserva con incidencia lo que está fuera de sede o tiene ubicación
dudosa/simulada/ausente; una persona sin sede no recibe incidencia de
ubicación. Opciones: A) conservar esta política para el piloto; B) definir
qué casos deben rechazarse o exigir revisión distinta. Entregar una matriz
para teléfono personal/terminal, radio/precisión y prioridad de atención de
incidencias. Estas reglas figuran como provisionales, sin una elección nueva.
**Resuelven:** producto/RH y móvil/backend. **Afecta:** captura, incidencias y aceptación de tarea 9.

### Q25. ¿El cierre automático conserva la ejecución única actual?

Hoy es opcional por empresa, pasa una vez por semana y deja sin cerrar a
quienes tienen incidencias o tramos abiertos; después interviene una persona.
Opciones: A) conservar ese flujo; B) requerir reintentos automáticos tras
resolver bloqueos, definiendo cuándo y hasta cuándo. No se presupone añadir
notificaciones generales, que están diferidas. La semana sin marcajes y el
acuse de una nueva versión se resuelven con Q15 y Q07, respectivamente.
**Resuelven:** producto/RH. **Afecta:** cierre y aceptación de tareas 9 y 15.

## Cómo devolver respuestas

Se puede responder por clave, sin resolver todo en una sola reunión. Para
empezar desarrollo conviene priorizar Q08/Q09 (captura real), Q03/Q04
(provisión y validación del acceso decidido), Q06/Q07/Q14/Q15 (reglas y
evidencia), Q10–Q13 (operación cotidiana) y los recursos pendientes de
Q01/Q02/Q05 (producción/respaldo). Q17 asigna entorno y aceptación de los
recorridos. Los frentes pueden avanzar en paralelo según sus responsables.

```text
Qxx:
Decisión u opción elegida:
Responsable de aprobar:
Responsable de implementar/proveer:
Ejemplo o caso esperado:
Entorno/versión, si aplica:
Dependencias y fecha objetivo:
Estado: decidido / requiere investigación / diferido
```

## Fuentes y límites de la revisión

Se cruzaron [decisiones de negocio](decisiones-de-negocio.md),
[preguntas Q01–Q22](tareas-ejecutables-y-preguntas-qa.md),
[tareas y contexto actual](TareasPendientes.md),
[bitácora](bitacora-trabajo.md), [reglas provisionales](logica-de-negocio.md),
[retención Android](retencion-android.md),
[recuperación del servicio](recuperacion-servicio.md),
[alcance móvil](alcance-producto-movil.md), [guía Android](guia-app-android.md),
[E6 y límites de evidencia](entrega-expediente-e6.md) y
[flujo del producto](flujo-del-producto-y-pendientes.md).

También se consultaron la [issue #18](https://github.com/Alsegurarp/fs_asistencias/issues/18)
y los comentarios de la [PR #26](https://github.com/Alsegurarp/fs_asistencias/pull/26).
La issue conserva casillas anteriores a la implementación; eso es seguimiento
desactualizado, no prueba de que falte desarrollar E1–E5. No había comentarios
en #26 que aclararan Q23 al revisar el 4 de noviembre. Las respuestas del
usuario del 5 de noviembre actualizan Q01–Q04 y Q23 en este documento y en
[decisiones de negocio](decisiones-de-negocio.md#resoluciones-recibidas-el-5-de-noviembre-de-2026).
No se consultaron conversaciones privadas fuera
de las fuentes disponibles ni se enviaron mensajes al equipo. La actualización
legal del 5 de noviembre contesta los mandatos verificables con fuentes
oficiales; la revisión profesional queda para interpretaciones concretas,
regímenes especiales y condiciones particulares, no para volver a elegir
los mínimos legales expresos.
