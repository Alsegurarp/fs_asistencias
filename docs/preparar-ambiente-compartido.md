# Preparar el ambiente compartido

Estado al 18 de octubre de 2026: publicado en <https://zenit.fastsolution.com.mx>
con datos ficticios. Cómo está montado y cómo se despliega está en
[Despliegue en el servidor](despliegue-en-servidor.md); aquí queda lo que el
ambiente debe cumplir y qué falta. Siguen pendientes SMTP, las cuentas
personales y el recorrido de acceso con sesión.

La tarea **2** de [Tareas críticas primero](tareas-criticas-primero.md) corresponde
a identidad operativa. La tarea 2 de la lista histórica de complejidad corresponde
a decisiones de negocio: son numeraciones distintas.

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
`/api/v1/system/status`. El servidor, dominio y certificados ya existen;
sigue pendiente el recorrido de acceso autenticado por HTTPS.
La comprobación se repitió el 17 de octubre de 2026; véase [la validación](validacion-tareas-1-a-6.md).

## Datos necesarios para continuar

| Dato | Para qué se necesita | Al 18 de octubre de 2026 |
| --- | --- | --- |
| Servidor/proveedor y responsable de acceso | Elegir el proxy y la configuración real de despliegue | Resuelto: servidor compartido y borde propio. SSH exclusivamente mediante Gabriel |
| Dominios del portal y de identidad | DNS, certificados, emisor, retornos y CSP | Resuelto: `zenit.fastsolution.com.mx`, con la identidad en `/id` |
| Forma de emitir y renovar certificados | Evitar un ambiente cuyo TLS deje de funcionar | Resuelto con lego y validación HTTP; la renovación es automática, pero la primera real toca a mediados de diciembre |
| SMTP: proveedor, host, puerto, remitente y método de autenticación | Verificación de correo y recuperación de contraseña | Pendiente; Alexis confirma que el correo se está tramitando |
| Administradores personales y responsable de recuperación | Sustituir la cuenta temporal sin perder acceso | Roberto Arregui, Gabriel Hidalgo y Alexis Segura; los tres correos confirmados en el plan privado local. Alta remota y pruebas pendientes |
| Operadores de Zenit | Dar de alta empresas con el permiso `operador_saas` | Sólo `operation-zenit@fastsolution.com.mx`, identificador sin buzón; contraseña local generada. Autorización, encargado de OTP/recuperación y alta remota pendientes |

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

## Recuperación administrada desde el portal

El 19 de octubre el usuario define que la recuperación se administra en la
plataforma web: visualizar empleados y declarar para la cuenta seleccionada
que en su próximo login debe establecer una contraseña nueva.

A4 implementa localmente la acción sobre cuentas activas vinculadas: contrato,
backend, portal e integración administrativa con Keycloak. Sólo administra
cuentas de la misma empresa; conserva OTP y otras acciones requeridas. El
cliente técnico se preparó sólo en local, con secreto fuera de Git y alcance
explícito. [Implementación y evidencia](entregas-a1-a5.md).
Faltan provisión/aceptación en servidor público y recorrido real de ingreso
y contraseña/OTP en navegador; [guion](qa-a1-a5.md).

Para un empleado sin cuenta vinculada hay que resolver primero esa vinculación.
También queda por definir cómo obtiene acceso quien olvidó la contraseña:
el cambio obligatorio al próximo login no resuelve por sí solo la autenticación
previa. No se ha elegido contraseña temporal ni enlace por correo. Conservar
OTP y no registrar contraseñas en bitácoras o registros técnicos.

Esta implementación local no cierra los
pendientes de cuentas personales, OTP o recuperación del operador. El
procedimiento de correo siguiente corresponde al flujo por enlace cuando
se habilite; no sustituye la acción administrativa solicitada en el portal.

## Correo y cuentas personales

Gabriel debe ejecutar los cambios remotos por su acceso SSH autorizado y abrir
el túnel a la consola descrito en [Despliegue](despliegue-en-servidor.md).
Las cuentas se crean en el realm activo, con las identidades que se confirmen.

Los correos personales confirmados se conservan en
`secrets/zenit-identity-plan.json`, excluido de Git. La contraseña temporal del
operador está en `secrets/zenit-operator-credential.json`, protegido localmente;
no está aplicada en Keycloak. La cuenta del operador **no tiene buzón**, por lo
que no se le debe aplicar por inferencia la verificación/recuperación por correo
del procedimiento general. El backend actual requiere correo verificado para
operar; la adaptación de esa identidad interna queda por resolver antes del alta.

La petición de acceso de superadmins a web/móvil y datos reales no se considera
un permiso ya existente. Alexis indica revisar primero los
[flujos actuales](flujos/README.md) y diferir su implementación si no está definida.

| Acceso | Dónde se concede | Qué permite |
| --- | --- | --- |
| Administración técnica de Keycloak | Cuenta personal en `master`, permisos administrativos necesarios | Administrar identidad; no asigna automáticamente un rol de empresa ni de operador de Zenit |
| Operación de Zenit | Cuenta personal en `zenit`, correo verificado incluido en `operator_emails` | Alta y operación de empresas; no accede a sus datos internos |
| Administración de una empresa | Cuenta en `zenit` y asignación/invitación `admin_empresa` en backend | Administrar sólo su empresa; no administrar Keycloak ni operar el servicio |

Procedimiento a ejecutar en el ambiente elegido, siguiendo la
[guía de administración de Keycloak](https://www.keycloak.org/docs/latest/server_admin/index.html):

1. Confirmar personas/correos, responsable de recuperación, proveedor SMTP y
   remitente verificado. La credencial de la landing no implica autorización
   ni configuración de correo para Keycloak. No versionar credenciales.
2. En Realm settings → Email de `zenit`, configurar host, puerto, remitente,
   autenticación y TLS según el proveedor. Probar conexión **y recepción** con
   un buzón controlado del responsable. La opción de prueba envía un mensaje;
   usar el destinatario acordado, sin envíos a clientes. La consola necesita
   un correo de destinatario válido en la cuenta que realiza esa prueba.
3. En Authentication → Flows del realm activo, revisar el flujo ligado a
   Reset credentials. Si la consola no permite editarlo, duplicarlo y ligar
   la copia como Reset credentials. Desactivar el subflujo
   `Reset - Conditional OTP`; en la configuración de `Send Reset Email`, poner
   `Force login after reset=true`. Conservar obligatorios la selección de
   usuario, correo de recuperación y cambio de contraseña. Leer de nuevo el
   flujo activo y comprobar las opciones antes de habilitar recuperación.
4. Con correo recibido y el flujo comprobado, activar Verify Email y Forgot
   Password. Crear las cuentas de `zenit` con correo sin verificar y acciones
   `UPDATE_PASSWORD` y `CONFIGURE_TOTP`. Cada titular confirma su correo y
   configura su propio autenticador. No marcarlo verificado para evitar el paso.
5. Probar con una cuenta controlada que ya tiene OTP: pedir recuperación,
   recibir el enlace, cambiar contraseña y volver a iniciar sesión. Debe pedir
   el OTP existente, rechazar contraseña anterior y OTP incorrecto, y no
   permitir entrar sólo mediante el enlace del correo. Confirmar también que
   el enlace usado no se puede reutilizar. Si falla, no dar la recuperación por
   validada; conservar un acceso administrativo independiente para corregirla.
6. Crear las cuentas personales de administración confirmadas en `master`.
   Usar contraseña temporal entregada por canal seguro, acciones
   `UPDATE_PASSWORD` y `CONFIGURE_TOTP`, y asignar sólo los permisos necesarios.
   Cada titular termina ambas acciones y comprueba un segundo inicio en una
   sesión independiente; contraseña sin OTP no debe dar acceso a la consola.
   No habilitar recuperación por correo en `master` sin configurar y probar
   también allí SMTP y la conservación del OTP en su flujo de recuperación.
7. En el servidor, poner únicamente los correos aprobados de operadores en
   `/opt/.fastsolution/zenit/secretos/operator_emails`, uno por línea. Mantener
   el archivo protegido. Recrear el backend con su Compose de servidor para
   que vuelva a leerlo. Cada operador usa su cuenta personal de `zenit`, correo
   verificado y OTP; no se le concede administración de Keycloak por este motivo.
8. Probar `/api/v1/me`: el operador obtiene `operador_saas` y ninguna empresa;
   una cuenta sin verificar no recibe el rol ni toma una invitación. En las
   pruebas existentes `/me` responde 200 sin roles para esa cuenta y las rutas
   de empresa/operador responden 403. Probar acceso del operador a su función
   y rechazo a datos internos de empresas; comprobar también una cuenta con
   invitación `admin_empresa` en su propia empresa.
9. Con acceso personal y procedimiento de recuperación comprobados, deshabilitar
   `arranque`, comprobar nuevamente acceso y recuperación, y retirarla al cerrar
   la transición. No borrar ni desactivar la única cuenta que permite administrar.

El realm del repositorio conserva SMTP vacío, `verifyEmail=false` y
`resetPasswordAllowed=false`. Encenderlos sin correo funcional bloquearía
usuarios. El segundo factor del realm `zenit` no demuestra que la consola
de administración de `master` tenga la misma protección.

El importador de Keycloak no actualiza automáticamente un realm que ya
existe. Configurar y verificar el realm activo; cambiar el JSON y reiniciar
no sustituye ese paso.

## Corrección y comprobación local del 18 de octubre de 2026

El realm versionado ahora desactiva `Reset - Conditional OTP` y configura
`force-login=true` en el correo de recuperación. Esto prepara el comportamiento
seguro antes de habilitar correo, siguiendo las opciones de
[Keycloak](https://www.keycloak.org/docs/latest/server_admin/index.html).
SMTP continúa vacío, con verificación y recuperación desactivadas; no se cambió
el realm del servidor ni se crearon cuentas personales.

Pasaron cuatro pruebas: recorrido activo de recuperación sin reinicio OTP,
reautenticación, OTP por defecto/PKCE del portal y condiciones del correo,
incluida la importación y lectura administrativa en Keycloak 26.8.0 con una base
nueva de prueba. No se enviaron correos ni se verificó todavía el recorrido real
de contraseña/OTP en navegador. La lectura del flujo importado no sustituye eso.

Prueba estática, sin dependencias nuevas:

```powershell
node --test infra/keycloak/realm.test.mjs
```

Para incluir la comprobación contra una instancia aislada con base en memoria:

```powershell
$env:IDENTITY_TEST_SECRETOS = Join-Path (Get-Location) 'secrets/identity-check'
$identidad = @('compose', '-f', 'compose.yaml', '-f', 'infra/keycloak/compose.test.yaml')
New-Item -ItemType Directory -Path $env:IDENTITY_TEST_SECRETOS -Force | Out-Null
docker @identidad --profile setup run --rm --build secrets-init
docker @identidad up --detach --build --wait --wait-timeout 240 db keycloak
node --test infra/keycloak/realm.test.mjs
docker @identidad stop
Remove-Item Env:IDENTITY_TEST_SECRETOS
```

Comprobar cada código de salida. El proyecto es `zenit-identity-check`, con
puerto local 38082 y secretos propios ignorados por Git; no usar secretos ni
datos del servidor publicado. Al detener la base en memoria se pierden sus
datos de prueba. Sin `IDENTITY_TEST_SECRETOS` la prueba de importación se omite.

## Condiciones para cerrar la tarea

- Dominio y certificado válidos, renovación comprobada y servicios internos
  inaccesibles desde el exterior.
- Portal construido con las URL definitivas; acceso PKCE, renovación y cierre
  de sesión probados por HTTPS con el backend real.
- Verificación de correo y recuperación comprobadas; OTP conservado,
  reautenticación exigida y cuenta sin correo verificado sin acceso a datos
  ni funciones de operador del API.
- Consola protegida, cuentas personales funcionales y cuenta temporal retirada.
- Secretos fuera del repositorio y resultados registrados en la bitácora.

Sin esos resultados el ambiente continúa pendiente, aunque la configuración
compile o Compose sea válido.

Al 18 de octubre de 2026 se cumplen el dominio, los certificados, los
servicios internos cerrados al exterior, el portal construido con sus URL
definitivas, la consola fuera de la dirección pública y los secretos fuera
del repositorio. Falta todo lo que necesita una sesión real, el correo y las
cuentas personales.
