# Decisiones de negocio

Estado al 19 de octubre de 2026: el modelo de alojamiento está aprobado. Las
reglas de suspensión, baja, supervisor y tipo de marcaje siguen pendientes.

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
