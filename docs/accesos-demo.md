# Accesos locales de demostración

Portal: <http://localhost:8081>. Empresa: **Zenit Demo**.

| Usuario | Rol | Uso |
| --- | --- | --- |
| `demo.admin_empresa@zenit.example` | Administración | Catálogos, incidencias, cierres y reapertura |
| `demo.rh@zenit.example` | RH | Resolver incidencias y cerrar semanas |
| `demo.supervisor@zenit.example` | Supervisión | Consultar cierres y resolver incidencias |
| `demo.auditor@zenit.example` | Auditoría | Consultar sin modificar |

Las contraseñas temporales están únicamente en `secrets/demo-accesos.md`,
excluido de Git. En el primer ingreso cada cuenta debe cambiar su contraseña
y configurar el segundo factor con una aplicación de autenticación.
El dominio `.example` es ficticio: estas cuentas no reciben correo.

Estas cuentas pertenecen sólo al entorno Docker local. Se cargaron estos
catálogos ficticios directamente en la base local, con una transacción y una
entrada de auditoría `demo.directory_seeded`; esto no verifica el alta por el portal.

- Sede activa **Sede Demo Centro**, zona `America/Mexico_City`, coordenadas
  de ejemplo `19.432608, -99.133209` y radio de 200 metros.
- Empleados activos `DEMO-001` Ana Demo, `DEMO-002` Bruno Demo,
  `DEMO-003` Carla Demo y `DEMO-004` Diego Demo, asignados a esa sede,
  con fecha de alta `2026-10-01`.
- Tarjetas ficticias `DEMO-TARJETA-001` a `DEMO-TARJETA-004`, activas y
  asignadas al empleado del mismo número desde `2026-10-01`.

Las huellas son sintéticas: no corresponden a tarjetas NFC físicas.
La captura con tarjeta simulada requiere su configuración explícita.
Se cargaron **siete marcajes ficticios** del viernes `2026-10-09` para la
semana del `2026-10-05` al `2026-10-11`, conservando el inicio en lunes:

| Empleado | Jornada | Incidencia abierta |
| --- | --- | --- |
| Ana Demo | 09:00–17:00, 8 horas | Ninguna |
| Bruno Demo | 09:00–17:00, 8 horas | Ninguna |
| Carla Demo | 09:00–17:00, 8 horas | `foreign_site` en la entrada |
| Diego Demo | Entrada 09:00 sin salida | `missing_pair` |

Las horas son de `America/Mexico_City`. La carga directa es una fixture local,
no evidencia de captura firmada: el sobre identifica `synthetic: true`.
Su dispositivo ficticio está revocado y la sesión cerrada, por lo que no
permite enviar nuevos marcajes. No se activó la captura simulada global.
La carga dejó auditoría `demo.attendance_seeded` y no creó cierres.

Para probar: seleccionar `2026-10-05` en Cierres y cerrar los cuatro empleados.
Ana y Bruno deberían cerrar; Carla y Diego deberían aparecer bloqueados.
Desde Incidencias, justificar la ubicación de Carla con un motivo ficticio
y corregir Diego agregando una salida el `2026-10-09` a las `17:00` locales
(`2026-10-09T23:00:00Z`), con motivo. Después volver a cerrar los bloqueados.
Estos resultados se esperan por el diseño del cálculo; quedan por comprobar
desde la sesión real del portal.
Consultar [el guion de validación](validacion-cierres.md).
