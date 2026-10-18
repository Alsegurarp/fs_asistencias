# Despliegue en el servidor compartido

Estado al 18 de octubre de 2026: Zenit está publicado en
<https://zenit.fastsolution.com.mx> con datos ficticios y sin cuentas de
personas todavía. La landing de fastSolution corre en
<https://fastsolution.com.mx> desde el mismo día; su formulario envía por
Brevo y necesita un remitente verificado (`SMTP_FROM`) para que los mensajes
salgan.

Es un servidor que presta un tercero. Sólo admite datos ficticios hasta que
exista un acuerdo por escrito con su dueño; no se cargan datos de personas
reales.

El acceso SSH al servidor de Zenit se realiza únicamente por el usuario Gabriel
del proyecto. Las intervenciones remotas se coordinan con él; este registro no
incluye credenciales ni habilita cuentas adicionales.

## Cómo llega una petición

```text
visitante ── 443 ──> borde del anfitrión
                     lee el nombre pedido (SNI) sin descifrar
                     │
                     ├─ fastsolution.com.mx, www., zenit. ──> 127.0.0.1:19443
                     │                                        borde de fastSolution
                     │                                        (TLS con certificados propios)
                     │                                        ├─ fastsolution.com.mx ──> landing:3000
                     │                                        ├─ www. ──> 301 a fastsolution.com.mx
                     │                                        └─ zenit. ──> portal e identidad
                     └─ cualquier otro nombre ──> servicios del anfitrión

visitante ── 80 ──> borde del anfitrión ──> 127.0.0.1:19080 (borde de fastSolution)
                    validación de certificados y redirección a HTTPS
```

El 443 lo escucha el borde del anfitrión porque sólo un proceso puede hacerlo.
Para los nombres de fastSolution sólo lee el nombre y entrega la conexión
cifrada, sin abrirla, con el protocolo PROXY, que lleva la dirección real del
visitante. Todo lo demás (TLS, certificados, cabeceras, límites y reparto) lo
decide el borde de fastSolution, en su propia red Docker,
`fastsolution-entrada` (172.30.88.0/24).

Un nombre nuevo bajo `fastsolution.com.mx` necesita dos cosas fuera de este
repositorio: su registro DNS y que el anfitrión lo agregue al mapa de su 443 y
a su bloque del 80.

## Direcciones de Zenit

| Ruta pública | Destino | Nota |
| --- | --- | --- |
| `/` | Portal (`web`) | Su nginx reenvía `/api/` al backend |
| `/api/` | Backend, por el portal | Lo usa también la app Android |
| `/id/realms/zenit/…` | Proveedor de identidad | Emisor `https://zenit.fastsolution.com.mx/id/realms/zenit` |
| `/id/resources/…` | Proveedor de identidad | Hojas de estilo y scripts de las páginas de acceso |
| `/id/realms/master/…`, `/id/admin/…`, `/id/health/…` y el resto de `/id/` | Nada: 404 | La administración no se publica |

La identidad sirve en la raíz dentro de su contenedor y su nombre público es
la URL completa con `/id`; el borde quita `/id` antes de reenviar. La consola
de administración se usa por túnel SSH al puerto local 19082 del servidor,
abriendo <http://127.0.0.1:19082/admin/> en la estación: el realm `master`
anuncia esa dirección, y la cuenta temporal de arranque es la única que
existe.

La app Android usa `https://zenit.fastsolution.com.mx/api` como dirección
del API.

## Qué hay en el servidor

| Ruta | Contenido |
| --- | --- |
| `/opt/.fastsolution/borde/` | Copia de `deploy/servidor/borde/`, más `estado/`: certificados y cuenta ACME (`lego/`) y retos de validación (`acme/`), del usuario 101 de los contenedores |
| `/opt/.fastsolution/zenit/fuente/` | Árbol de este repositorio en el commit desplegado; `.version-desplegada` dice cuál |
| `/opt/.fastsolution/zenit/secretos/` | Secretos generados en el servidor (directorio 0700, archivos 0444); nunca salen de ahí |
| `/opt/.fastsolution/landing/fuente/` | Árbol del repositorio de la landing en el commit desplegado |
| `/opt/.fastsolution/landing/secretos/smtp.env` | Credencial del correo del formulario (0600) |

`/opt/.fastsolution` es 0750: otras cuentas del servidor no entran. Ningún
servicio publica puertos hacia fuera; en la interfaz local sólo están el borde
(19080 y 19443) y la consola de identidad (19082).

| Proyecto Compose | Servicios |
| --- | --- |
| `fastsolution-borde` | `borde` (nginx 1.30.6 sin privilegios) y `certificados` (lego 5.5.2) |
| `fastsolution-zenit` | `db`, `migrate`, `keycloak`, `backend` y `web` |
| `fastsolution-landing` | `landing` |

Todos se reinician solos, tienen tope de memoria y de registros, corren sin
capacidades de Linux y con el sistema de archivos de sólo lectura.

## Desplegar una versión nueva de Zenit

La forma normal es el guion de despliegue, con una sola orden desde la
estación: `bash deploy/servidor/desplegar.sh zenit`. Lo explica el
[instructivo de despliegue](instructivo-de-despliegue.md). Lo que sigue es lo
que el guion hace en el servidor, por si hay que hacerlo a mano.

Sobre el árbol exportado de un commit (con `git -c core.autocrlf=false
archive`, para que los guiones conserven LF) copiado a
`/opt/.fastsolution/zenit/fuente/`:

```bash
F=/opt/.fastsolution/zenit/fuente
Z="docker compose --project-directory $F -f $F/compose.yaml \
  -f $F/deploy/servidor/zenit/compose.yaml \
  --env-file $F/deploy/servidor/zenit/servidor.env"
# Los contenedores leen el árbol montado: directorios 755 y archivos 644.
find $F -type d -exec chmod 755 {} + ; find $F -type f -exec chmod 644 {} +
find $F -name '*.sh' -exec chmod 755 {} +
$Z build
$Z up -d
$Z ps
```

`deploy/servidor/zenit/compose.yaml` se aplica encima de `compose.yaml`: no
repite imágenes ni endurecimiento, sólo cambia lo del servidor. Las
direcciones públicas están en `deploy/servidor/zenit/servidor.env`. Cambiar
`IDENTITY_URL` exige reconstruir el portal.

Los secretos se generaron una sola vez, en el servidor:
`$Z --profile setup run --rm secrets-init`. Volver a correrlo no cambia los
que ya existen.

El realm `zenit` se importó al crear la base. Cambiar el JSON del realm no
cambia el realm en marcha; se cambia en la consola.

## Desplegar una versión nueva de la landing

Con el guion: `bash deploy/servidor/desplegar.sh landing`, y
`--credencial <smtp.env>` para subir además la credencial de correo. A mano,
sobre el árbol exportado de su repositorio, copiado a
`/opt/.fastsolution/landing/fuente/`:

```bash
cd /opt/.fastsolution/landing
LANDING_VERSION=<commit> docker compose --env-file servidor.env up -d --build
```

`compose.yaml` y `servidor.env` de esa carpeta son copia de
`deploy/servidor/landing/`. El servidor de la landing no arranca sin
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS` en `secretos/smtp.env`.
El correo sale por Brevo (`smtp-relay.brevo.com`, puerto 587). Su login SMTP,
`...@smtp-brevo.com`, sólo autentica: no es un remitente válido y Brevo
rechaza un mensaje que lo use como `From`. Por eso `SMTP_FROM` lleva un
remitente verificado en Brevo o una dirección de un dominio autenticado ahí.
Si la cuenta de Brevo bloquea las direcciones IP no autorizadas, un cambio de
la IP del servidor detiene el envío hasta autorizar la nueva.

## Certificados

Cada nombre tiene su certificado de Let's Encrypt (ECDSA P-256): uno para
`fastsolution.com.mx` con `www`, y otro para `zenit.fastsolution.com.mx`. El
servicio `certificados` corre `lego run` cada doce horas: pide uno nuevo sólo
cuando falta o le queda un tercio de vida, y el borde recarga cada seis horas.

Para agregar un nombre a un certificado o uno nuevo, se cambia `CERTIFICADOS`
en `deploy/servidor/borde/compose.yaml` y se emite a mano la primera vez:

```bash
cd /opt/.fastsolution/borde
docker compose --env-file servidor.env run --rm --no-deps --entrypoint lego \
  certificados run --no-random-sleep --cert.name <nombre> --domains <nombre>[,<otro>]
```

El borde no arranca si un bloque apunta a un certificado que no existe: el
bloque nuevo se copia después de emitirlo.

## Verificado el 18 de octubre de 2026

| Qué | Resultado |
| --- | --- |
| Certificados | Emitidos por Let's Encrypt, vencen el 16 de enero de 2027; el ciclo de renovación revisa y espera |
| Portal | `200` en la raíz, con CSP que sólo permite `'self'` y la identidad |
| API | `200` en `/api/v1/system/status`; `401` en `/api/v1/me` sin token |
| Identidad | Descubrimiento con el emisor público; la página de acceso carga con el retorno del portal y rechaza (`400`) un retorno ajeno |
| Administración | `404` por la dirección pública para `master`, `/id/admin/`, la salud y la raíz de `/id/`; la consola carga por túnel |
| Landing | Corre sobre el commit `6d00456`: raíz `200`, `www` redirige con la ruta y la consulta, y un contacto inválido responde `400`. Desde el servidor, el login de Brevo conecta y autentica; todavía no se envió ningún mensaje |
| Dirección real | El borde registra la dirección del visitante, no la del anfitrión |
| Límites | Probados con la misma configuración en local, no en el servidor: el formulario de contacto acepta 3 envíos seguidos por dirección y responde `429` después. Zenit está configurado con ráfagas de 80 y 20 por segundo por dirección, sin prueba de carga |
| Vulnerabilidades | Borde, certificados y landing (con el `Dockerfile` corregido) sin altas ni críticas en Grype. Las imágenes de Zenit se construyeron en el servidor con los mismos `Dockerfile` que en local; no se volvieron a analizar en este despliegue |

## Revertir

- Zenit: volver a copiar el árbol del commit anterior y repetir `build` y
  `up -d`. Las migraciones no se revierten solas: una versión que agregó una
  migración necesita su propio plan de vuelta.
- Borde: volver a copiar `conf.d/` anterior y `docker compose exec borde nginx
  -s reload`; probar antes con `nginx -t`.

## Lo que falta

| Qué | Para qué |
| --- | --- |
| Remitente verificado de la landing (`SMTP_FROM`) y su cambio de código | Que su formulario envíe: con Brevo, usar el login SMTP como remitente hace que rechace el mensaje. Lo mejor es autenticar `fastsolution.com.mx` en Brevo, con registros en su DNS |
| Cuentas personales en la consola de identidad, con segundo factor | Retirar la cuenta temporal de arranque después de comprobarlas |
| Correos de quien opera el servicio (`operator_emails`) | Nadie puede dar de alta una empresa mientras esté vacío |
| Servicio de correo en la identidad | Verificación de correo y recuperación de contraseña |
| Respaldo fuera del servidor | No hay copia operativa; con datos ficticios no se pierde nada que importe |
| Recorrido autenticado del portal y de la app por HTTPS | Nada se ha recorrido con sesión en este ambiente |
| Cuota por dirección real en el backend | El backend ve la dirección del portal, no la del visitante |
| Pipeline | Hoy se despliega a mano desde un árbol exportado |
| IP del servidor | Es dinámica y el registro `A` de `fastsolution.com.mx` es fijo: si cambia, los tres nombres dejan de responder hasta corregirlo |
| Correo del dominio | El registro MX apunta al mismo servidor, que no recibe correo |
