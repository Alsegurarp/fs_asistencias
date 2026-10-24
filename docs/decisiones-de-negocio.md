# Decisiones de negocio

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
