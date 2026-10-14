# Preparar el ambiente compartido

Estado al 14 de octubre de 2026: preparación iniciada, sin publicar.
No están confirmados servidor, dominios ni servicio de correo. No usar
`compose.yaml` como publicación directa: su configuración sigue siendo local.

## Avance en el repositorio

La imagen del portal recibe `IDENTITY_URL` desde Compose como argumento
`VITE_IDENTITY_URL`. Esa misma dirección se incorpora al cliente de acceso y
a `connect-src` de la política CSP de nginx durante la construcción. El
valor local por omisión sigue siendo `http://localhost:8082`.

Una vez elegidas las direcciones, poner `PORTAL_URL` e `IDENTITY_URL` en la
configuración privada del servidor. Cambiar la dirección de identidad exige
reconstruir el portal: no basta con reiniciar el contenedor. El backend ya
usa esa dirección para el emisor y Keycloak para su hostname y los retornos
del cliente del portal.

Se comprobó la resolución de Compose con un dominio ficticio HTTPS y con la
dirección local: portal, Keycloak y emisor coinciden. La imagen se construyó
con la dirección local y con una ficticia HTTPS; en ambos casos la CSP de
nginx y el cliente contienen la misma dirección y la otra no aparece. Siguen
pendientes nginx en ejecución y el recorrido de acceso por HTTPS.

## Datos necesarios para continuar

| Dato | Para qué se necesita |
| --- | --- |
| Servidor/proveedor y responsable de acceso | Elegir el proxy y la configuración real de despliegue |
| Dominios del portal y de identidad | DNS, certificados, emisor, retornos y CSP |
| Forma de emitir y renovar certificados | Evitar un ambiente cuyo TLS deje de funcionar |
| SMTP: proveedor, host, puerto, remitente y método de autenticación | Verificación de correo y recuperación de contraseña |
| Administradores personales y responsable de recuperación | Sustituir la cuenta temporal sin perder acceso |

Entregar credenciales SMTP mediante un almacén de secretos; no incluirlas en
esta documentación, en el realm exportado ni en un commit.

## TLS y proxy

Con el servidor confirmado, configurar TLS y un acceso interno restringido
al proxy. La [guía oficial de Keycloak](https://www.keycloak.org/server/reverseproxy)
requiere elegir el modo TLS y las cabeceras de proxy, sobrescribir las
cabeceras recibidas y restringir acceso directo al servicio. No publicar el
puerto de administración de salud 9000. Resolver las URL públicas según la
[configuración de hostname](https://www.keycloak.org/server/hostname).

Pendientes concretos del proyecto: cerrar los puertos directos de backend e
identidad al exterior, configurar el proxy seleccionado y comprobar acceso,
redirecciones, cookies y rechazos de cabeceras falsificadas. La cuota por
dirección todavía ve el proxy: resolver cómo se obtiene la dirección real
antes de considerar verificada esa protección.

## Correo y cuentas personales

Procedimiento a ejecutar en el ambiente elegido, siguiendo la
[guía de administración de Keycloak](https://www.keycloak.org/docs/latest/server_admin/index.html):

1. Configurar SMTP en el realm `zenit`, probar la conexión y recepción.
2. Activar Verify Email y Forgot Password. Las cuentas nuevas deben empezar
   con el correo sin verificar. No marcarlo manualmente sin comprobarlo.
3. Revisar Reset Credentials para que recuperar contraseña no elimine el
   segundo factor; probar la recuperación manteniendo OTP.
4. Crear cuentas personales de administración en `master`, asignar sólo los
   permisos necesarios y exigir cambio de contraseña y configuración OTP.
   Comprobar segundo factor al volver a entrar a la consola.
5. Entrar con las cuentas nuevas en una sesión independiente. Retirar
   `arranque` después de comprobar el acceso y el procedimiento de recuperación.

El realm del repositorio conserva SMTP vacío, `verifyEmail=false` y
`resetPasswordAllowed=false`. Encenderlos sin correo funcional bloquearía
usuarios. El segundo factor del realm `zenit` no demuestra que la consola
de administración de `master` tenga la misma protección.

El importador de Keycloak no actualiza automáticamente un realm que ya
existe. Configurar y verificar el realm activo; cambiar el JSON y reiniciar
no sustituye ese paso.

## Condiciones para cerrar la tarea

- Dominio y certificado válidos, renovación comprobada y servicios internos
  inaccesibles desde el exterior.
- Portal construido con las URL definitivas; acceso PKCE, renovación y cierre
  de sesión probados por HTTPS con el backend real.
- Verificación de correo y recuperación comprobadas; OTP conservado y cuenta
  con correo no verificado rechazada por el API.
- Consola protegida, cuentas personales funcionales y cuenta temporal retirada.
- Secretos fuera del repositorio y resultados registrados en la bitácora.

Sin esos resultados el ambiente continúa pendiente, aunque la configuración
compile o Compose sea válido.
