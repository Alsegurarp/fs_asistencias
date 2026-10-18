# Preparar el ambiente compartido

Estado al 18 de octubre de 2026: publicado en <https://zenit.fastsolution.com.mx>
con datos ficticios. Cómo está montado y cómo se despliega está en
[Despliegue en el servidor](despliegue-en-servidor.md); aquí queda lo que el
ambiente debe cumplir y qué falta. Siguen pendientes SMTP, las cuentas
personales y el recorrido de acceso con sesión.

`compose.yaml` sola sigue siendo la configuración local. En el servidor se le
aplica encima `deploy/servidor/zenit/compose.yaml`, con las direcciones
públicas de `deploy/servidor/zenit/servidor.env`.

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
nginx y el cliente contienen la misma dirección y la otra no aparece. Con el
entorno local completo, nginx respondió `200` en la raíz con la CSP y las
cabeceras esperadas, y su proxy devolvió el estado del backend en
`/api/v1/system/status`. Sigue pendiente el recorrido de acceso por HTTPS,
que necesita servidor, dominios y certificados.
La comprobación se repitió el 17 de octubre de 2026; véase [la validación](validacion-tareas-1-a-6.md).

## Datos necesarios para continuar

| Dato | Para qué se necesita | Al 18 de octubre de 2026 |
| --- | --- | --- |
| Servidor/proveedor y responsable de acceso | Elegir el proxy y la configuración real de despliegue | Resuelto: servidor compartido, con un borde propio detrás de una pasarela por nombre |
| Dominios del portal y de identidad | DNS, certificados, emisor, retornos y CSP | Resuelto: `zenit.fastsolution.com.mx`, con la identidad en `/id` |
| Forma de emitir y renovar certificados | Evitar un ambiente cuyo TLS deje de funcionar | Resuelto con lego y validación HTTP; la renovación es automática, pero la primera real toca a mediados de diciembre |
| SMTP: proveedor, host, puerto, remitente y método de autenticación | Verificación de correo y recuperación de contraseña | Pendiente |
| Administradores personales y responsable de recuperación | Sustituir la cuenta temporal sin perder acceso | Pendiente |

Entregar credenciales SMTP mediante un almacén de secretos; no incluirlas en
esta documentación, en el realm exportado ni en un commit.

## TLS y proxy

Con el servidor confirmado, configurar TLS y un acceso interno restringido
al proxy. La [guía oficial de Keycloak](https://www.keycloak.org/server/reverseproxy)
requiere elegir el modo TLS y las cabeceras de proxy, sobrescribir las
cabeceras recibidas y restringir acceso directo al servicio. No publicar el
puerto de administración de salud 9000. Resolver las URL públicas según la
[configuración de hostname](https://www.keycloak.org/server/hostname).

Hecho el 18 de octubre de 2026: el backend y el portal no publican puertos;
la identidad sólo publica su consola en la interfaz local del servidor y el
puerto 9000 no sale. El borde sobrescribe las cabeceras `X-Forwarded-*` y la
identidad sólo las acepta desde la red del borde (`proxy-headers=xforwarded`
con `proxy-trusted-addresses`): con cabeceras falsificadas desde fuera, el
emisor anunciado no cambia. Faltan las cookies y las redirecciones de una
sesión real, y la cuota por dirección del backend, que todavía ve la
dirección del portal y no la del visitante.

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

Al 18 de octubre de 2026 se cumplen el dominio, los certificados, los
servicios internos cerrados al exterior, el portal construido con sus URL
definitivas, la consola fuera de la dirección pública y los secretos fuera
del repositorio. Falta todo lo que necesita una sesión real, el correo y las
cuentas personales.
