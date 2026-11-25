# Portal PHP de auditoría gubernamental

Las empresas que usan Zenit podrán conceder acceso individual de consulta a
auditores de gobierno para revisar registros de asistencia y de jornada.
Cada auditor autorizado podrá ver todos los marcajes, eventos de terminal y
sedes de la empresa que concedió el acceso. Si intervienen varios auditores,
cada uno tendrá su propia cuenta con el mismo alcance.

## Invitación y acceso

- La empresa indica el correo del auditor y puede enviar la invitación desde
  Zenit o copiar el enlace para compartirlo por su cuenta.
- El enlace de activación es de un solo uso, caduca y se vincula al correo
  invitado. Se propone una vigencia de 72 horas para aceptar la invitación.
- El auditor verifica su correo. Si necesita una cuenta, crea su contraseña
  y configura el segundo factor en Keycloak. Si ya tiene cuenta, se identifica
  con ella para aceptar el acceso.
- La empresa puede revocar el acceso. El portal permite consultar y descargar
  información. Los permisos de auditoría impiden modificar eventos y marcajes.
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
- **Eventos de terminal.** Consulta de las acciones que las terminales
  registran en la base de datos. Desde un marcaje se puede abrir el evento
  asociado cuando exista ese vínculo. La consulta de eventos también incluye
  registros que quedaron sin un marcaje asociado.
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

Desde la estación de despliegue, ejecuta `deploy/servidor/desplegar.sh zenit`
con un commit que contenga el portal. El despliegue aplica la migración V025,
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

## Recorrido de prueba

1. Entra al portal de Zenit como administrador de la empresa. En **Usuarios**,
   invita un correo con el rol **Auditoría** y abre su ficha.
2. Selecciona **Generar enlace** y **Copiar enlace**, o **Enviar por correo**
   si el envío ya está configurado. Un enlace nuevo reemplaza al anterior y
   caduca a las 72 horas.
3. Si el correo es nuevo, Zenit crea la cuenta en Keycloak al generar la
   invitación. Keycloak le envía al auditor las acciones para verificar
   su correo, crear su contraseña y configurar OTP. El auditor completa
   esas acciones y luego abre el enlace de la empresa. Si ya tiene una cuenta,
   abre el enlace e inicia sesión con ese correo verificado.
4. Consulta marcajes y descarga evidencia. En una sesión separada de
   administrador, vuelve a **Usuarios** y selecciona **Deshabilitar su
   acceso**. Al volver a consultar en el portal PHP, Zenit debe denegar el
   acceso y las descargas.

Queda pendiente la consulta de acciones de terminal que no estén
representadas por un marcaje. El detalle del marcaje muestra las
resoluciones y ajustes disponibles en sus incidencias asociadas.
