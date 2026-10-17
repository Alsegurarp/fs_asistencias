# Decisiones de negocio pendientes

Estado al 17 de octubre de 2026: propuestas preparadas, pendientes de respuesta
del responsable del producto. No se modificaron reglas, permisos ni datos.
Solicitar las tareas 1 a 6 autoriza preparar este registro; no demuestra que
se haya elegido una de las alternativas siguientes.

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
los ejemplos visuales de Android. Tampoco se decidió el proveedor de integración
continua, formato de nómina del primer cliente, almacenamiento externo de
exportes ni fecha de congelación del contrato.

Las reglas ejecutables vigentes están en [Lógica de negocio](logica-de-negocio.md)
y los bloqueos generales en [Estado y pendientes](estado-y-pendientes.md).
