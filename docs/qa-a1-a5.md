# Guion de aceptación A1–A5

Preparado el 20 de octubre de 2026. Contrato 0.13, 62 operaciones.
Ejecución local del 21 de octubre: **33/33 casos comprobados** mediante
navegador automatizado, API real e instrumentación Android según el caso;
[acta y límites](qa-a1-a5-2026-10-21.md). La aceptación del usuario y del
ambiente público sigue pendiente. Este documento conserva las acciones y
resultados esperados para repetir el recorrido.
El entorno publicado conserva la dependencia Q17 del
[cuestionario](tareas-ejecutables-y-preguntas-qa.md).

## Preparación y datos ficticios

1. Registrar commit, URL, IDs de imágenes y migración V008 del entorno elegido.
   Usar un ambiente de pruebas; confirmar que acepta tarjetas simuladas.
2. Crear exclusivamente dos empresas ficticias, `QA-A` y `QA-B`, con zona
   `America/Mexico_City`, y una sede en cada una. Mantener sus IDs en el acta.
3. Preparar en cada empresa los roles de la tabla siguiente. Las cuentas y
   OTP viven en Keycloak; vincular cada usuario desde el portal con correo
   verificado. Entregar accesos por el canal seguro del equipo, nunca en el acta.
4. Preparar dos empleados por empresa (`QA-A-001`, `QA-A-002`, `QA-B-001`,
   `QA-B-002`), tarjetas simuladas y dispositivos personales. Vincular el
   trabajador A con A-001 y el trabajador B con B-001. Preparar además una
   cuenta Trabajador de A sin vínculo al padrón y una cuenta invitada sin
   primer ingreso. No reutilizar identidades de personas reales.
5. En QA-A preparar una semana provisional, otra cerrada sin acuse y una
   cerrada con acuse de objeción emitido por otro dispositivo o por API.
   Usar el simulador documentado en [Entorno local](entorno-local.md#llenar-el-entorno-con-el-simulador-de-dispositivo)
   sobre estas empresas aisladas. `SIM_PEOPLE=2` y `SIM_FINISHED_WEEK=true`
   permiten preparar una semana terminada con marcajes recientes; el
   simulador cambia el inicio semanal de su empresa de prueba. Anotar los
   empleados que realmente cree y vincular las cuentas a esos IDs si se usa
   esta opción. No asumir IDs ni editar tablas para forzar un cierre.
6. Cerrar la semana desde el portal con administración/RH; para el acuse
   usar Android personal o el endpoint existente
   `POST /week-closures/{closureId}/acknowledgements` con el trabajador
   vinculado. Una respuesta 201 debe conservarse como evidencia sin tokens.
7. Preparar QA-B como suspendida mediante el operador y el endpoint existente,
   con motivo `Preparación del ensayo QA`. Así A1 puede reactivarla sin añadir
   una pantalla de suspensión ni decidir su política futura.

| Cuenta ficticia | Empresa | Empleado | Resultado permitido |
| --- | --- | --- | --- |
| `operador-qa@example.invalid` | Ninguna | Ninguno | Alta/listado y reactivación de empresas; sin datos internos |
| `admin-a@example.invalid` | A | Opcional | Administración de A y cambio obligatorio de sus cuentas activas vinculadas |
| `rh-a@example.invalid` | A | Opcional | Catálogos operativos, dispositivos, incidencias, cierres y exportes; sin administrar usuarios |
| `supervisor-a@example.invalid` | A | Opcional | Consulta/atención según permisos actuales de toda A; sin usuarios ni exportes |
| `auditor-a@example.invalid` | A | Opcional | Consulta permitida; sin mutaciones |
| `trabajador-a@example.invalid` | A | A-001 | Sólo consulta y acuse propios |
| `sin-padron-a@example.invalid` | A | Sin vínculo | Sin consulta personal, respuesta 403 y orientación para solicitar vínculo |
| `admin-b@example.invalid`, `trabajador-b@example.invalid` | B | B-001 para trabajador | Mismos límites dentro de B; sin datos de A |

Un rol administrativo sólo ve Mi asistencia si también tiene el rol
Trabajador. La invitación no crea la cuenta ni envía correo automáticamente.

## Preparar el cambio obligatorio en local

Desde la raíz, con Keycloak local en 8082 y los secretos locales existentes:

```powershell
node infra/keycloak/prepare-local-password-admin.mjs
```

El guion sólo utiliza `http://localhost:8082`, prepara
`zenit-password-admin`, verifica el alcance y guarda su secreto en
`secrets/identity-admin/identity_admin_client_secret`. No imprime secretos ni
modifica cuentas humanas. Se puede repetir; rechaza una configuración de
cliente que difiera de la esperada. Requiere la cuenta de arranque local.

Configurar `IDENTITY_ADMIN_URL=http://keycloak:8082` en `.env` y reconstruir
el backend. Compose monta ese directorio de secretos sólo en backend; vacío
o sin credencial válida, la acción responde 503. No habilitar la URL pública
de administración ni usar esta herramienta local para el servidor publicado.

El cliente sólo tiene `manage-users` de `realm-management`, con alcance
explícito y sin flujo de navegador ni acceso por contraseña. Ese permiso puede
administrar usuarios del realm: su secreto debe custodiarse como credencial
privilegiada. El backend limita la acción a la empresa, sujeto y correo
vinculados y sólo envía `requiredActions`. No se asigna `realm-admin` ni
`manage-clients`. [API oficial de Keycloak](https://www.keycloak.org/docs-api/26.8.0/rest-api/index.html).

## Casos de aceptación

Los resultados de la ejecución local están en el acta enlazada arriba;
los recorridos del servidor público conservan su aceptación pendiente. Para probar
una ruta oculta usar un cliente HTTP con la sesión del rol indicado; ocultar
un botón no acredita protección del backend.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| A1-01 | Operador abre Empresas | Ve metadatos y Reactivar sólo en empresas suspendidas |
| A1-02 | Abre Reactivar QA-B y cancela | No hay POST ni cambio de estado |
| A1-03 | Motivo de menos de 10 caracteres | No puede confirmar; límite máximo 500 |
| A1-04 | Confirma con motivo válido | Un POST, QA-B activa, listado actualizado y `tenant.reactivated` en su auditoría |
| A1-05 | Otro operador ya reactivó antes de confirmar | HTTP 409, motivo conservado y error visible; no éxito falso |
| A1-06 | Rol de empresa intenta reactivar directamente | HTTP 403; sin cambio de estado |
| A2-01 | Trabajador A abre Mi asistencia | Consulta `/me/attendance`; no envía un ID de empleado elegido por el cliente |
| A2-02 | Cambia la fecha y consulta | Muestra inicio de semana normalizado, zona, tramos, totales, alertas y conteo de incidencias de A-001 |
| A2-03 | Semana vacía/provisional/tramo abierto | Estados claros, sin excepción; cálculo informativo, sin declaración de cumplimiento jurídico |
| A2-04 | Trabajador sin padrón consulta | HTTP 403; orientación para revisar acceso/vínculo y sin datos de otro trabajador |
| A2-05 | Trabajador A agrega `employeeId` de B al query | Sigue obteniendo sólo A-001; no obtiene datos de B |
| A2-06 | Sólo RH o auditor abre portal | Sin Mi asistencia; permisos administrativos actuales conservados |
| A2-07 | Cierra sesión A y entra B | No aparece información de A, incluso con navegación atrás y caché previa |
| A3-01 | Cierre vigente sin acuse | `acknowledgement: null`; no se inventa recibo |
| A3-02 | Envía objeción desde cuenta o dispositivo A y consulta desde otro dispositivo A | Mismo ID, cierre, tipo, comentario, fecha y huella entregados por el servidor |
| A3-03 | Consulta el mismo cierre desde web | Ve el acuse del servidor; la pantalla web es de consulta, sin enviar nuevos acuses |
| A3-04 | Intenta responder otra vez al mismo cierre | HTTP 409; al consultar se recupera el acuse existente |
| A3-05 | Administración reabre el cierre acusado | Consulta semanal muestra reabierto y acuse nulo; no presenta el recibo local como vigente |
| A3-06 | Vuelve a cerrar | Nueva versión sin acuse; el anterior permanece en su versión histórica |
| A3-07 | Otra persona/empresa consulta el cierre ajeno o una terminal consulta semana personal | Sin datos ajenos; cierre ajeno 404 y terminal personal 403 |
| A3-08 | Android recibe acuse cuyo `closureId` no coincide | Rechaza la respuesta y no muestra ese recibo |
| A4-01 | Administrador A elige cuenta activa vinculada de A | Ve advertencias y confirmación; no hay campo de contraseña ni envío de correo |
| A4-02 | Cancela o no confirma | Sin POST ni requisito añadido |
| A4-03 | Confirma | POST `/users/{userId}/password-change`, HTTP 204 y éxito visible; auditoría `user.password_change_required` sin secretos |
| A4-04 | Verifica la cuenta ficticia en identidad | `UPDATE_PASSWORD` añadido una sola vez; demás acciones y credencial OTP conservadas |
| A4-05 | Cuenta ficticia sale y vuelve a ingresar | Debe completar contraseña nueva; confirmar acceso posterior con OTP según el flujo. Las sesiones ya emitidas no se revocan con esta acción |
| A4-06 | RH, supervisor, auditor, trabajador u operador llama directamente | HTTP 403; sin contacto administrativo efectivo ni cambios |
| A4-07 | Administrador A apunta a usuario de B | HTTP 404, sin revelar o modificar su identidad |
| A4-08 | Cuenta invitada sin vínculo / vinculada deshabilitada | HTTP 409; el portal no ofrece el botón |
| A4-09 | Sin integración o proveedor rechaza/no responde | HTTP 503; error genérico, sin éxito ni auditoría de confirmación; no reintenta automáticamente |
| A4-10 | Cuenta ya perdió contraseña u OTP | No tratar el requisito como recuperación: registrar Q03/Q04 para operación |
| A5-01 | Cookies/sesión de identidad, renovación y cierre de sesión por rol | Acceso y salida completos, sin conservar datos de la cuenta anterior; registrar entorno y pasos |
| A5-02 | Configuración de empresa y detalle de bloqueos | Lectura/escritura según rol, causas y páginas correctas, sin acceso entre empresas |

Si una petición de contraseña termina con error de transporte, el proveedor
puede haber aplicado la acción antes de perderse la respuesta. Operación debe
comprobarla; la repetición es idempotente respecto del requisito, pero no
existe una transacción común entre Keycloak y la auditoría PostgreSQL.

## Evidencia, cierre y limpieza

Por caso guardar: ID, fecha UTC, entorno/commit, rol, pasos, esperado,
obtenido, aprobado/fallido y evidencia sin secretos. En fallos HTTP incluir
`correlationId`; en Android, variante/APK, modelo y versión del sistema.

Al terminar, revocar únicamente dispositivos de ensayo, deshabilitar cuentas
ficticias y dejar empresas de QA identificadas, sin borrar históricos o
volúmenes. No retirar OTP ni la cuenta de arranque hasta comprobar accesos
personales de operación. La identidad desechable de las pruebas automáticas
se retira por su Compose separado.

El guion A5 y su ejecución local ya tienen acta del 21 de octubre. La
aceptación del usuario y del servidor público permanece pendiente. A1–A4 pueden
estar técnicamente implementadas y probadas sin cerrar las tareas globales
2, 9, 13, 15 y 16, que conservan las preguntas de producto y operación.
