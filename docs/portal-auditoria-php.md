# Portal PHP de auditoría gubernamental

Las empresas que usan Zenit podrán conceder acceso individual de consulta a
auditores de gobierno para revisar registros de asistencia y de jornada.
Cada auditor autorizado podrá ver todos los marcajes, eventos de terminal y
sedes de la empresa que concedió el acceso. Si intervienen varios auditores,
cada uno tendrá su propia cuenta con el mismo alcance.

## Invitación y acceso

- La empresa indica el correo del auditor y puede enviar la invitación desde
  Zenit o copiar el enlace para compartirlo por su cuenta.
- El enlace de activación se vincula al correo invitado, es de un solo uso
  y caduca a las 72 horas.
- El auditor verifica su correo. Si necesita una cuenta, crea su contraseña
  y configura el segundo factor en Keycloak. Si ya tiene cuenta, se identifica
  con ella para aceptar el acceso.
- La empresa puede revocar el acceso. El portal permite consultar y descargar
  información. Los permisos de auditoría impiden modificar eventos y marcajes.
- La invitación de **Auditor externo** tiene un rol exclusivo. Al aceptarla
  se concede también el expediente empresarial, con la verificación
  adicional de Zenit para descargarlo. Revocar el acceso retira ambos
  permisos. Una nueva auditoría requiere otra invitación.
- La arquitectura reutiliza el realm de Zenit con un cliente OpenID Connect
  propio para PHP. El envío puede usar Brevo. El remitente definitivo del
  dominio está pendiente de confirmar.

## Consultas y descargas

- **Asistencias.** Filtros por empleado, rango de fechas y sede. Cada filtro
  funciona de forma individual y en cualquier combinación.
- **Jornada.** Resumen semanal por empleado con horas trabajadas, ordinarias
  y extra y días con incidencias. El detalle diario muestra entradas, salidas,
  descansos registrados y totales. Los días con marcajes faltantes se
  identifican como incompletos.
- **Trazabilidad.** El detalle del marcaje muestra fecha, hora, sede y
  terminal de origen. Cuando exista una corrección, muestra el registro
  original, el ajuste, quién lo realizó, cuándo y por qué.
- **Eventos de terminal.** Desde un marcaje se puede abrir el evento
  asociado y consultar las resoluciones y ajustes de sus incidencias.
  La consulta de acciones de terminal sin marcaje sigue pendiente.
- **Descargas.** La evidencia se puede descargar en PDF y CSV, con el alcance
  de empresa y los filtros aplicados a la consulta.

## Integración y despliegue

El portal es una aplicación PHP compartida, desplegada en la nube detrás de
NGINX. Consulta la API de Zenit, cuyo backend en Spring determina la empresa
autorizada para el auditor y comprueba los permisos de solo lectura en cada
listado, detalle y descarga. La integración parte del despliegue compartido
de Zenit, que identifica a cada empresa mediante su `tenant_id`.

La entrega incluye desplegar el portal. La validación debe comprobar el alta
por invitación, el segundo factor, la revocación, los filtros individuales
y combinados y las descargas. Con dos empresas de prueba se verificará que
el auditor solo puede acceder a sus datos autorizados y que su acceso
rechaza las operaciones de escritura.

## Despliegue en el servidor compartido

El portal se publica en `https://zenit.fastsolution.com.mx/auditoria/` con
el certificado de Zenit. La composición del servidor añade PHP-FPM y su NGINX.
El backend de Zenit y el canje de tokens se alcanzan por la red de Docker.

La primera versión está en el commit `805f943`. Incluye el portal PHP, las
opciones de invitación de **Usuarios**, la API de alta y consulta, la
migración V025 y la configuración de NGINX y Keycloak. La migración V026
distingue las nuevas invitaciones externas de los accesos de auditoría ya
existentes. El [instructivo de
despliegue](instructivo-de-despliegue.md) describe los requisitos de la
estación y cómo se exporta el commit.

Desde esa estación, ejecuta `bash deploy/servidor/desplegar.sh zenit <commit>`
con la revisión que vaya a publicarse. El despliegue aplica las migraciones,
registra los dos clientes de Keycloak, les configura PKCE y la audiencia al
cliente web, y guarda el secreto del cliente técnico para el backend. El
paso de identidad verifica que la cuenta técnica puede consultar usuarios.
El paso final comprueba la página, el script de invitación y la redirección
de inicio de sesión por HTTPS.

El correo de activación de Keycloak requiere SMTP. Usa la opción
`--credencial /ruta/privada/smtp.env` del [despliegue de Zenit](despliegue-en-servidor.md#correo-de-la-identidad)
si el archivo aún no está en el servidor. Para habilitar **Enviar por
correo**, añade `AUDIT_BREVO_API_KEY` a ese archivo privado. Se utiliza
`SMTP_FROM` como remitente verificado de ambas notificaciones. El despliegue
guarda la clave y el remitente fuera del árbol de código y recrea el backend
si cambian. **Generar enlace** funciona sin la clave API de Brevo. El alta
de un auditor nuevo sí requiere el correo de activación de Keycloak.

El script anota fecha, commit y resultado en
`/opt/.fastsolution/zenit/despliegues.log` y deja el registro detallado en
`build/despliegue/registros/` en la estación. Antes del primer despliegue,
confirma que haya un respaldo recuperable de las bases de Zenit y Keycloak.
Una vez aplicada una migración, volver al commit anterior también exige planificar
la vuelta del esquema. Flyway valida el historial al arrancar. Consulta el
[procedimiento de reversión](despliegue-en-servidor.md#revertir).

## Estado de verificación

Se verificaron en Docker la ruta y el retorno de inicio de sesión a través
de NGINX, la generación de PDF y CSV, y el aislamiento, el uso único de la
invitación y la revocación contra PostgreSQL. La prueba de alta automática
usó un Keycloak simulado. El despliegue publicado, la entrega real de correo
y el recorrido completo con doble factor quedan pendientes de verificar.

## Recorrido de prueba

1. Entra al portal de Zenit como administrador de la empresa. En **Usuarios
   → Invitar**, selecciona **Auditor externo** e indica el correo.
2. En ese mismo formulario, elige **Generar enlace** o **Enviar por correo**.
   Si generas el enlace, puedes copiarlo desde la confirmación. Un enlace
   nuevo reemplaza al anterior y caduca a las 72 horas.
3. Si el correo es nuevo, Zenit crea la cuenta en Keycloak al generar la
   invitación. Keycloak le envía al auditor las acciones para verificar
   su correo, crear su contraseña y configurar OTP. El auditor completa
   esas acciones y luego abre el enlace de la empresa. Si ya tiene una cuenta,
   abre el enlace e inicia sesión con ese correo verificado.
4. Consulta marcajes, descarga PDF y CSV, y abre **Expediente de la empresa**
   para comprobar su verificación adicional. En una sesión separada de
   administrador, abre **Usuarios → Editar acceso → Revocar acceso de
   auditoría**. Verifica que se bloqueen las consultas, las descargas y el
   expediente.
5. Para otra auditoría, vuelve a invitar el mismo correo como **Auditor
   externo** desde la misma empresa. El auditor recupera el acceso cuando
   acepta el enlace nuevo.

## Ayuda con la invitación y el acceso

Si aparece un aviso en Zenit, comparte el código con soporte. En **Usuarios**,
el botón **Copiar código** copia el texto que aparece en el aviso, como
`Error 700`. En el portal de auditoría, puedes seleccionar y copiar el código.

Si soporte necesita localizar tu intento, indica la hora aproximada y el
ambiente. Mantén privadas las contraseñas, los códigos de inicio de sesión,
los QR y los enlaces de invitación.
