# Decisiones de negocio

## Portal: lienzo, mapas, correo y soporte — 10 de noviembre de 2026

Tras el recorrido del portal en local, Alexis decide:

- **Tarjetas:** se muestra la columna «Tecnología». Se acepta reponer con otra
  tarjeta del inventario en lugar de «Asignar a otra persona». «Cerrar la
  semana» lleva a Cierres, e «Invitar» y «Generar un reporte» llegan con los
  bloques 3 y 4.
- **Mapas:** OpenStreetMap, con su atribución.
- **Ayuda y soporte:** por ahora, el correo rene.alexis.segura@gmail.com y el
  número 56 3300 1126.
- **SMTP:** el de Brevo que ya usa la landing. La credencial está fuera del
  repositorio, en `secrets/smtp.env`, y en local ya está configurada en el
  Keycloak con un correo de prueba enviado. El remitente es una dirección
  @gmail.com: para producción conviene autenticar `fastsolution.com.mx` en
  Brevo y usar un remitente de ese dominio, porque con un remitente @gmail.com
  los proveedores suelen mandar el correo a spam o rechazarlo.

## Tarjetas del piloto — 10 de noviembre de 2026

Alexis decide hacer el piloto con las tarjetas MIFARE Classic 1K que ya
tiene y comprar DESFire EV3 cuando haya capital (responde Q08). La tarjeta
**no guarda datos de la persona**: sólo un código aleatorio con la firma del
servidor ligada al identificador de la tarjeta, para que una tarjeta perdida
no exponga a nadie. Se acepta el riesgo de que una tarjeta se clone con
equipo especial; lo compensan la geocerca, el lector activado, la revisión
de Supervisión y la revocación en el portal. El diagnóstico de las tarjetas
(Classic 1K con claves de fábrica, probablemente con identificador
cambiable) y el diseño están en
[Tarjetas del piloto](guia-app-android.md#tarjetas-del-piloto-mifare-classic).

## Datos operativos recibidos — 6 de noviembre de 2026

Primer destino: `Cliente-demo`, con IP recibida en el archivo privado de
respuestas. Alexis administra el servidor y es quien realiza operaciones con
elevación; el usuario de despliegue no tiene sudo. Gabriel o Alexis gestionan
DNS y firewall. Se declara la VPS sin aplicaciones/datos, con nginx instalado
y puertos abiertos; conservar nginx hasta inspeccionar cómo integrar Zenit.

IP e identificador ya están aplicados en la configuración privada. Por chat se
confirman `https://zenit.fastsolution.com.mx`, 2 CPU, 8 GB RAM y 50 GB de disco;
las URL existentes ya coinciden con el dominio. Faltan usuario/puerto y acceso
SSH completo, distribución/versión, espacio libre y comprobación del destino,
además de las respuestas de respaldo/identidad/negocio todavía no recibidas.
No se infiere acceso Docker, custodia, permisos adicionales ni otra decisión
de las respuestas de infraestructura. [Recopilación actualizada](datos-para-finalizar-tareas.md).

## Proveedores confirmados — 6 de noviembre de 2026

**Decisión final del usuario:** VPS Hostinger en **United States - Phoenix**
y **el bucket AWS S3 de `bucket.md`, región `us-east-2`**, para respaldo.
Sustituye la referencia intermedia a Firebase/GCS y resuelve la discrepancia
del archivo. El nombre del bucket queda en la configuración local privada;
no se deduce de él ninguna credencial ni autorización de acceso.

Se conserva una instancia privada por cliente,
administración del equipo desarrollador, cifrado, copia diaria, retención de
30 días, RPO 24 h/RTO 4 h y custodia/relevo documentados. VPS y bucket están
en regiones independientes, ambas confirmadas; no falta elegir proveedor.

Faltan IP/dominio de VPS, acceso SSH, identidad AWS autorizada, identificador
de instancia, clave pública age, custodios y ensayo en el destino. La elección
del proveedor no acredita provisión, despliegue ni restauración real.
Los apartados siguientes conservan el historial de decisiones.

## Decisión vigente de alojamiento y operación — 5 de noviembre de 2026

Durante la ejecución el usuario sustituye expresamente el modelo compartido
anterior por **una instancia de Zenit en VPS privada por cliente**. El equipo
desarrollador administra y da soporte; el administrador del cliente conserva
sus propias credenciales de administración. Se mantienen cuentas personales
con MFA y permisos separados, sin compartir la contraseña del cliente.

El respaldo externo será un **bucket compatible con S3 administrado por el
equipo desarrollador**, con aislamiento de prefijos y credenciales técnicas
por instancia. Continúan copia diaria/30 días, RPO 24 h y RTO 4 h. El custodio
es el administrador del cliente; si no asume esa función, el equipo
desarrollador, con entrega y aceptación documentadas. SMTP/remitente se
proveerán después. Faltan proveedor/región/cuenta, dominios, bucket/endpoint,
accesos, personas concretas y ensayo en el destino.

El usuario también aprueba **aplicar las propuestas Q10–Q13**: mantener
captura/sincronización de dispositivos ya enrolados durante suspensión y
bloquear administración/cierres/nuevo enrolamiento; baja con revocación de
tarjeta y fin de horario aplicable, conservando históricos; supervisor sólo
en sedes asignadas; conservar deducción más declaración explícita validada.
Las precisiones de fechas, reactivación e históricos se documentan en la
implementación; no se destruye evidencia por una baja técnica.

La [verificación legal de esta respuesta](revision-juridica-jornada-acuse.md#verificación-del-modelo-vps-por-cliente-y-s3--5-de-noviembre-de-2026)
no identifica incompatibilidad de la topología con la reforma. Su ejecución
debe cumplir registro, conservación y protección de datos; el servicio de
soporte no transfiere automáticamente las obligaciones del empleador.
Este apartado prevalece sobre Q01 y sobre el modelo del 19 de octubre que
se conserva abajo como antecedente.

## Criterio rector ampliado — 5 de noviembre de 2026

Por instrucción del usuario, toda respuesta que pueda obtenerse de la reforma
de 40 horas y la LFT aplicable se contesta con esa norma y su vigencia. Es el
objetivo del proyecto. Los mandatos expresos quedan como requisitos de
desarrollo, sin esperar una elección adicional del equipo. Las
[respuestas legales por pregunta](revision-juridica-jornada-acuse.md#respuestas-legales-aplicables--5-de-noviembre-de-2026)
resuelven los mínimos normativos y dejan identificados los casos de
interpretación, datos del empleador y decisiones técnicas aún necesarios.
No se vuelve a pedir aprobación para elegir si se cumplirá un mínimo legal;
la revisión y aceptación comprobarán su aplicación. Este criterio sustituye
los bloqueos genéricos por falta de dictamen de las notas anteriores y
conserva la revisión específica donde sí exista incertidumbre.

## Primeras resoluciones recibidas el 5 de noviembre de 2026

- **Q01 — Alojamiento:** fastSolution administra una producción exclusiva de
  Zenit con aislamiento lógico por empresa; el servicio estándar no crea una
  VPS por cliente. **Sustituida después por la VPS privada por cliente arriba.**
- **Q02 — Respaldo:** externo diario, retención de 30 días, RPO de 24 h y
  RTO de 4 h. La propuesta semanal queda descartada por incompatibilidad con
  estos objetivos. Faltan destino, custodia, responsables, automatización y
  ensayo en el destino; los objetivos no se registran como comprobados.
- **Q03 — Acceso perdido:** contraseña mediante correo verificado; pérdida
  de OTP mediante los 12 códigos de recuperación de Keycloak y, como último
  recurso, soporte con doble aprobación. Versión de referencia: Keycloak
  26.8.1. Falta configurar, probar y documentar el procedimiento efectivo,
  incluidos los responsables y la evidencia de la doble aprobación.
- **Q04 — Operación:** SMTP provisional antes de definir el nombre comercial;
  cuentas personales con MFA, turnos primario/respaldo y sin credenciales
  compartidas. Faltan proveedor/remitente, provisión, asignación de personas
  y comprobación de correo, acceso y recuperación.
- **Q23 — Comida:** la PR #26 está integrada con motivo, cancelación y siete
  días de aviso hasta la vigencia. Falta ratificar **SUP-025** y aceptar el
  recorrido desplegado; la integración no acredita esas aceptaciones.

Estas respuestas sustituyen las opciones anteriores de Q01–Q04 y precisan
Q23. No cierran tareas operativas ni autorizan el primer uso con datos reales.
El [cuestionario](dudas-producto-para-equipo.md) conserva los recursos y
aceptaciones pendientes por clave.

**Cambio programado de la política de comida, decidido por el equipo el 30 de
octubre y el 1 de noviembre de 2026.** Deja de ser inmediato: entra el primer
día de semana de la empresa dentro de la siguiente quincena, con al menos 7
días de aviso; lo programan quien administra la empresa o quien opera el
servicio, y las personas reciben un aviso. Tres detalles que el equipo no fijó
se construyeron como propuesta y ya están integrados en la PR #26: los 7 días se
cuentan hasta el día en que entra, el cambio lleva motivo y se puede cancelar
antes de entrar. Una empresa mal configurada en su alta también espera esa
fecha. Al 5 de noviembre faltan ratificación de SUP-025 y aceptación
desplegada. Las reglas están en [lógica de negocio](logica-de-negocio.md).

**Acuerdo adicional del 23 de octubre de 2026:**
[expediente empresarial y MFA por descarga](expediente-empresa.md): entrega
legible con versiones/ajustes de una sola empresa, recuperación comprobada
antes de suprimir, permiso específico y autorización nueva de un uso por
usuario/empresa/expediente. El usuario aprueba usar MFA de Keycloak/Red Hat;
no implica que `owner` elimine derechos de trabajadores ni que los permisos
del CSV semanal se extiendan al expediente. La distribución instalada sigue
siendo Keycloak comunitario; el ensayo aislado no habilita aún la descarga.

**Criterio rector confirmado por el usuario el 23 de octubre de 2026:**
el desarrollo debe cumplir la legislación aplicable. Las opciones técnicas
y comerciales se evalúan dentro de esos límites; una implementación o una
prueba aprobada no sustituye demostrar los requisitos jurídicos aplicables.

Actualización del 23 de octubre de 2026: el modelo de alojamiento está
aprobado y el usuario fija la legislación mexicana como criterio de
retención/uso de datos. Las opciones concretas de suspensión, baja,
supervisor y marcaje no quedan elegidas automáticamente por esa referencia.

## Criterio legal recibido el 23 de octubre

Se aplica la [revisión de fuentes oficiales](revision-juridica-jornada-acuse.md#actualización-del-23-de-octubre-de-2026-conservación-y-uso-de-datos),
incluidos registro/exhibición, conservación laboral, protección de datos y
46 horas semanales en 2027. Son límites para cualquier opción de producto:

| Tema | Criterio para resolverlo | Elección que la ley no determina por sí sola |
| --- | --- | --- |
| Suspensión comercial del SaaS | No equivale a suspensión de la relación laboral ni extingue la obligación del empleador de conservar/exhibir registros. No borrar la evidencia por impago o suspensión; concretar su entrega y la continuidad de registro por el empleador | Mantener captura en Zenit durante la suspensión o usar otro mecanismo; la LFT no obliga por sí sola al proveedor SaaS a prestar servicio indefinido. La propuesta de conservar captura sigue disponible, sin activarla por inferencia |
| Baja del empleado | Conservar marcajes, ajustes, cierres y acuses durante sus plazos. La fecha efectiva y las obligaciones pendientes condicionan el borrado; desactivar una credencial no debe destruir el expediente | Revocación irreversible de tarjeta, fin de horarios y tratamiento de asignaciones futuras/reactivación. No derivarlos automáticamente de la fecha de actualización del catálogo |
| Supervisor | Acceso autorizado y adecuado a sus funciones, aislado por empresa y protegido contra usos ajenos a su finalidad | Si su función requiere toda la empresa o sólo ciertas sedes, y quién administra las asignaciones. La ley no define ese mapa organizativo |
| Tipo de marcaje | Preservar lo observado y su trazabilidad; no ocultar tiempo efectivamente registrado ni tratar una deducción como manifestación expresa del trabajador | Declaración explícita, deducción del servidor o ambas. El mecanismo actual conserva ambas; su eficacia probatoria requiere además las condiciones del registro y del acuerdo |

La instrucción recibida orienta estas decisiones y la política documental;
no se registra como aprobación de todas las propuestas de la tabla histórica.
No se cambia el comportamiento vigente mientras falte la opción operativa.
Tampoco se presenta el cálculo actual como cumplimiento integral: conserva
las brechas diarias, descansos y transición de vigencias ya documentadas.

La [recuperación por el empleador y el papel de terceros](revision-juridica-jornada-acuse.md#recuperación-por-el-empleador-y-servicios-de-terceros)
se incorpora al alcance de conservación y salida del SaaS. No requiere
inferir un certificador externo para cada recuperación. El respaldo de toda
la instalación no es el archivo que puede entregarse a un cliente: hace
falta un expediente limitado a su empresa y comprobar su recuperación.

## Modelo de alojamiento aprobado

**Antecedente del 19 de octubre, sustituido el 5 de noviembre por la decisión
vigente de VPS privada por cliente.** No usarlo para aprovisionar nuevas instancias.

Aprobado el 19 de octubre de 2026 por **Gabriel, Roberto Arregui y Alex
Segura**:

1. Zenit se ofrece por defecto como un SaaS administrado por fastSolution.
2. Producción es exclusiva de Zenit, está separada de desarrollo y pruebas y
   queda en una cuenta y bajo un contrato controlados por fastSolution.
3. Las empresas comparten backend y PostgreSQL con aislamiento lógico por
   empresa. No se crea por defecto una VPS, base ni bucket por cliente.
4. Un almacén de objetos se incorpora cuando lo requieran los respaldos o los
   exportes. El respaldo externo es de Zenit como producto, cifrado y fuera del
   dominio de falla de producción; no necesita un bucket por cliente.
5. Una base o un stack dedicados se venden y cotizan como modalidad
   Enterprise cuando lo exijan contrato, sector, residencia, volumen o riesgo.
6. Una instalación administrada por el cliente es una oferta distinta, con
   responsabilidades de soporte, versiones, acceso y recuperación pactadas.
7. El servidor compartido publicado conserva únicamente datos ficticios. Se
   abandona antes del primer dato real y no se convierte en producción por
   obtener otro acuerdo con su dueño.

Esta aprobación define la topología comercial y operativa; no autoriza datos
reales. Antes hacen falta proveedor, región y cuenta, contrato de tratamiento y
subprocesadores, aviso de privacidad, retención, derechos ARCO, respuesta a
incidentes, respaldo externo con custodia y restauración, y revisión jurídica.

## Decisiones todavía pendientes

Solicitar las tareas 1 a 6 autorizó preparar las propuestas siguientes; no
demuestra que se haya elegido una de ellas.

## Criterios para aprobación

| Tema | Comportamiento vigente | Propuesta | Trabajo posterior si se aprueba |
| --- | --- | --- | --- |
| Suspensión de empresa | Bloquea acceso de personas, autenticación de dispositivos, captura, enrolamiento y cierres | Conservar captura y sincronización de dispositivos ya enrolados; bloquear administración y cierres. Mantener bloqueado el nuevo enrolamiento | Separar autorizaciones de captura y administración; probar suspensión/reactivación, cola sin conexión y dispositivos revocados |
| Baja de empleado | La tarjeta deja de marcar, pero no se revoca ni termina el horario | Revocar la tarjeta y terminar la asignación vigente a la fecha de baja, conservando históricos | Acordar fecha efectiva y tratamiento de asignaciones futuras/reactivaciones; aplicar la baja de forma atómica y probar sus efectos |
| Supervisor | Ve y atiende toda su empresa | Limitar a sedes asignadas; sin asignaciones no ve ninguna | Definir administración de asignaciones, empleados sin sede y cambios de sede; filtrar consultas y operaciones en servidor, contrato y portal |
| Tipo de marcaje | El servidor deduce el tipo y admite declaración explícita validada | Conservar ambos mecanismos | Confirmar este comportamiento como decisión del MVP y conservar pruebas de llegada en desorden y descansos |

Alternativa presentada al usuario: conservar los cuatro comportamientos vigentes
como decisiones del MVP. Ninguna alternativa figura todavía como aprobada.
La implementación de cambios no forma parte de esta tarea de definición.

## Otras decisiones que continúan abiertas

Retardos, faltas, salida anticipada, ausencias, reglas de jornada y evidencia del
acuse requieren sus propios criterios. No se fijó una tolerancia a partir de
los ejemplos visuales de Android. GitHub Actions ya está integrado y probado;
sigue pendiente decidir la obligatoriedad de sus trabajos (Q22). Tampoco se
decidieron formato de nómina del primer cliente, almacenamiento externo de
exportes ni fecha de congelación del contrato.

Las reglas ejecutables vigentes están en [Lógica de negocio](logica-de-negocio.md)
y los bloqueos generales en [Estado y pendientes](estado-y-pendientes.md).
