# Entorno local

Cómo levantar Zenit en una máquina, crear las primeras cuentas, obtener un
token para probar y resolver lo que suele fallar.

## Qué se necesita

- Docker con Compose.
- Git.
- Un editor.

Nada más. No se instalan Java, Node, Gradle, PostgreSQL ni ninguna otra
herramienta del proyecto en la máquina: todo corre en contenedores.

## Primera vez

```powershell
docker compose --profile setup run --rm secrets-init
docker compose up --build --detach
docker compose ps
```

El primer comando genera los secretos locales en `secrets/`, que Git ignora.
Se puede repetir: sólo crea los que falten. El segundo construye y levanta.

Cuando termina:

| Qué | Dirección |
| --- | --- |
| API | `http://localhost:8080/api/v1` |
| Salud del API | `http://localhost:8080/actuator/health` |
| Portal | `http://localhost:8081` |
| Proveedor de identidad | `http://localhost:8082/realms/zenit` |
| Consola de identidad | `http://localhost:8082/admin` |

Es normal ver el servicio `migrate` como `Exited (0)`: aplica las migraciones
de la base y termina. El backend espera a que acabe bien.

## Los servicios

| Servicio | Qué es | Puerto |
| --- | --- | --- |
| `db` | PostgreSQL, con la base del producto y la del proveedor de identidad. Su imagen se construye de `infra/postgres` | No publica ninguno |
| `migrate` | Aplica las migraciones con el rol dueño del esquema y termina | Ninguno |
| `keycloak` | Proveedor de identidad | 8082 |
| `backend` | El API | 8080 |
| `web` | El portal | 8081 |

Los puertos sólo se publican en `127.0.0.1`: no se alcanzan desde otra
máquina de la red.

Herramientas que no se levantan solas:

| Comando | Para qué |
| --- | --- |
| `docker compose --profile setup run --rm secrets-init` | Generar los secretos que falten |
| `docker compose --profile test run --rm --build backend-it` | Pruebas de integración contra una base desechable |
| `docker compose --profile test down db-it backend-it` | Retirar esa base |
| `docker compose --profile tools run --rm contract-lint` | Validar el contrato y sus ejemplos |
| `docker compose --profile tools run --rm secret-scan` | Buscar secretos en todo el historial de Git |
| `docker compose --profile tools run --rm device-sim` | Llenar el entorno con personas, dispositivos y marcajes simulados |
| `docker compose --profile ops run --rm backup-rehearsal` | Ensayar el respaldo y la restauración de las dos bases |
| `docker compose --profile tools run --rm sbom` | Inventario de lo que lleva una imagen |
| `docker compose --profile tools run --rm vuln-scan` | Vulnerabilidades conocidas de ese inventario |

Cada una tiene su sección más abajo.

## Ajustes

Copiar `.env.example` a `.env` es opcional. Sólo hace falta para cambiar algo:

| Variable | Por omisión | Para qué |
| --- | --- | --- |
| `BIND_ADDRESS` | `127.0.0.1` | En qué interfaz se publican los puertos |
| `BACKEND_PORT`, `WEB_PORT`, `KEYCLOAK_PORT` | 8080, 8081, 8082 | Los puertos |
| `PORTAL_URL`, `IDENTITY_URL` | Las direcciones locales | Cómo se anuncian el portal y la identidad; `IDENTITY_URL` también se incorpora al portal y su CSP al construir la imagen |
| `CAPTURE_SIMULATED_CARDS` | `false` | Aceptar la tarjeta simulada. Sólo con datos ficticios |
| `EXPORTS_TTL_MINUTES` | 15 | Cuánto se puede descargar un exporte listo |
| `JOBS_ENABLED` | `true` | Que este backend atienda los trabajos encolados |
| `API_PERSON_REQUESTS_PER_MINUTE` | 600 | Peticiones por minuto que se le aceptan a una persona |
| `CLOSURES_SCHEDULE_CHECK_SECONDS` | 60 | Cada cuánto se revisa si alguna empresa tiene una semana que ya debe cerrarse sola |

Después de cambiar `.env`: `docker compose up --detach`.

## Los secretos

Viven en `secrets/`, un archivo por secreto. Git los ignora y nunca se
comparten ni se pegan en un chat o en un reporte de error.

| Archivo | Qué es |
| --- | --- |
| `db_admin_password` | Administrador de la instancia de la base; sólo la inicializa |
| `db_migrator_password` | Dueño del esquema; lo usa `migrate` |
| `db_app_password` | El rol con el que atiende el backend |
| `keycloak_db_password` | El rol del proveedor de identidad en su propia base |
| `db_backup_password` | El rol que sólo lee, con el que se ensaya el respaldo |
| `keycloak_admin_password` | La cuenta temporal `arranque` de la consola de identidad |
| `keycloak.conf` | Configuración generada del proveedor de identidad |
| `operator_emails` | Los correos de quienes operan el servicio, uno por línea. Nace vacío |

Sin su archivo, el servicio que lo necesita no arranca. No hay valores por
omisión.

### Si el entorno ya existía

La base cambió de imagen y de forma de ordenar los textos, y eso sólo se
aplica al crear su volumen. Un entorno anterior se empieza de cero, una vez:

```powershell
docker compose down --volumes
docker compose --profile setup run --rm secrets-init
docker compose up --build --detach
```

Se pierden los datos locales y las cuentas del proveedor de identidad, que
son de prueba. Los secretos que ya existían se conservan; el segundo comando
sólo genera el que falte. Después hay que volver a crear las cuentas y, si
hace falta, correr el simulador.

Un volumen creado con la imagen anterior no sirve con la nueva: la base no
arranca y su registro dice `Permission denied`.

## Crear las primeras cuentas

El backend no crea cuentas: viven en el proveedor de identidad. En local se
crean a mano.

### 1. Declarar al operador

Escribir en `secrets/operator_emails` el correo de quien va a dar de alta
empresas, y recrear el backend para que lo lea:

```powershell
docker compose up --detach --force-recreate backend
```

Mientras ese archivo esté vacío, nadie puede dar de alta una empresa.

### 2. Crear una cuenta

1. Abrir `http://localhost:8082/admin` y entrar con el usuario `arranque` y
   la contraseña de `secrets/keycloak_admin_password`.
2. Elegir el realm `zenit`.
3. Crear un usuario con el correo como nombre de usuario y como correo, con
   nombre y apellido, y con **correo verificado** encendido.
4. En sus credenciales, ponerle una contraseña marcada como temporal.

Los pasos de la consola no se probaron a mano: las pruebas crean las cuentas
por la API de administración, con esos mismos datos.

Sin el correo verificado, la cuenta no se liga a ninguna invitación.

### 3. Entrar por primera vez

La primera vez, el proveedor pide cambiar la contraseña temporal y configurar
un segundo factor con una app de autenticación. Es obligatorio para toda
cuenta nueva.

Cinco intentos fallidos bloquean la cuenta por un tiempo.

## Obtener un token para probar

El portal ya inicia sesión. Para llamar al API a mano se puede obtener un
token aparte. El proveedor sólo acepta el flujo de código de autorización
con PKCE: no hay concesión directa con usuario y contraseña.

Con la terminal que instala Git, o cualquiera de tipo Unix:

```bash
verificador=$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')
reto=$(printf '%s' "$verificador" | openssl dgst -sha256 -binary | openssl base64 | tr '+/' '-_' | tr -d '=\n')
echo "http://localhost:8082/realms/zenit/protocol/openid-connect/auth?client_id=zenit-portal&response_type=code&scope=openid&redirect_uri=http://localhost:8081/retorno&code_challenge=$reto&code_challenge_method=S256"
```

1. Abrir en el navegador la dirección que imprime e iniciar sesión.
2. El navegador termina en `http://localhost:8081/retorno?…&code=…`. Copiar
   el valor de `code` de la barra de direcciones.
3. Canjearlo, en la misma terminal:

```bash
curl -s http://localhost:8082/realms/zenit/protocol/openid-connect/token \
  -d grant_type=authorization_code -d client_id=zenit-portal \
  -d redirect_uri=http://localhost:8081/retorno \
  -d code_verifier="$verificador" -d code="<el código copiado>"
```

La respuesta trae `access_token`, que es el que se manda al API, y
`refresh_token`. Un código sirve una sola vez.

```bash
curl -s http://localhost:8080/api/v1/me -H "Authorization: Bearer <access_token>"
```

El token de acceso dura 5 minutos. Para renovarlo sin volver a entrar:

```bash
curl -s http://localhost:8082/realms/zenit/protocol/openid-connect/token \
  -d grant_type=refresh_token -d client_id=zenit-portal -d refresh_token="<refresh_token>"
```

Un cliente HTTP con soporte de OAuth 2.0 hace lo mismo sin comandos, con
estos datos: tipo «código de autorización con PKCE», la dirección de
autorización y la de token de arriba, cliente `zenit-portal`, sin secreto,
alcance `openid` y retorno `http://localhost:8081/retorno`.

Estos comandos se comprobaron completos: el reto, el inicio de sesión en un
navegador, el canje, la llamada al API y la renovación.

## Cargar datos de prueba

No hay datos sembrados: el entorno nace vacío. Hay dos caminos:

- El [Recorrido completo](recorrido-completo.md) lleva de una empresa nueva a
  un exporte, petición por petición.
- El simulador de dispositivo, que sigue, llena una empresa que ya existe con
  personas, tarjetas, dispositivos y marcajes.

## Llenar el entorno con el simulador de dispositivo

El simulador hace por el API lo que harían una persona de la empresa y la
app: da de alta una sede, personas y tarjetas, activa un teléfono por persona
y una terminal, y manda marcajes firmados de las últimas horas. Sirve para que
el portal tenga jornadas, incidencias y cierres con qué construir sus
pantallas sin esperar a la app.

Necesita tres cosas:

1. La tarjeta simulada encendida: `CAPTURE_SIMULATED_CARDS=true` en `.env` y
   `docker compose up --detach`.
2. Una empresa dada de alta y la cuenta de quien la administra.
3. Un token de acceso de esa cuenta, obtenido como dice «Obtener un token
   para probar». Dura cinco minutos: hay que correr el simulador en cuanto se
   obtiene.

```bash
SIM_TOKEN="<access_token>" docker compose --profile tools run --rm device-sim
```

En PowerShell, la variable se pone antes con `$env:SIM_TOKEN = "<access_token>"`.

| Variable | Por omisión | Para qué |
| --- | --- | --- |
| `SIM_TOKEN` | Ninguno | Token de una persona con el rol `admin_empresa` |
| `SIM_PEOPLE` | 8 | Cuántas personas crea, de 1 a 50 |
| `SIM_FINISHED_WEEK` | `true` | Mueve el inicio de semana de la empresa al día de hoy |

Lo que le pasa a cada persona se repite cada siete:

| Persona | Qué simula | Qué deja |
| --- | --- | --- |
| 1 | Jornada de 8 horas, desde su teléfono | Una semana que se puede cerrar |
| 2 | Jornada de 8 horas, en la terminal de la sede | Una semana que se puede cerrar |
| 3 | Entrada fuera de la geocerca | Una incidencia `foreign_site` |
| 4 | Entrada sin salida | Un tramo abierto; al cerrar, una incidencia `missing_pair` |
| 5 | Lectura repetida a los 20 segundos | Una incidencia `duplicate` |
| 6 | Jornada de 11 horas | Tiempo extra y sus alertas |
| 7 | Jornada de hace dos días que llega tarde | Dos incidencias `late_sync` |

Al terminar imprime la sede, cada persona con su identificador, el resultado
de cada marcaje y las dos consultas con las que se ven. No imprime nada
secreto: las claves de los dispositivos se generan en memoria y se descartan.

Cosas que hay que saber:

- **Mueve el inicio de semana.** Una semana sólo se cierra cuando ya terminó,
  y un marcaje sólo se acepta si tiene menos de tres días. Para que lo marcado
  se pueda cerrar, el simulador pone el inicio de semana de la empresa en el
  día de hoy: así lo de ayer queda en una semana terminada. Con
  `SIM_FINISHED_WEEK=false` no lo toca, y la semana no se podrá cerrar hasta
  que termine.
- **Cada corrida agrega.** Crea otra sede y otras personas; no reutiliza las
  de la corrida anterior ni borra nada.
- **Los dispositivos no se pueden volver a usar.** Sus claves no se guardan.
- **Los marcajes son de las últimas 24 horas**, salvo los de la persona 7.
  En los últimos minutos del día caen en el día de hoy, y el simulador lo
  avisa.

Se corrió completo contra el entorno local, con una cuenta del proveedor de
identidad: 8 personas y 16 marcajes, con los resultados de la tabla. La forma
de PowerShell no se probó.

## Probar la captura sin tarjetas reales

La verificación de la tarjeta real todavía no existe. Para desarrollar la app
se usa la tarjeta simulada, que nace apagada:

1. En `.env`: `CAPTURE_SIMULATED_CARDS=true`.
2. `docker compose up --detach`.

Con ella, la prueba de la tarjeta es la misma huella con la que se registró.
No está autenticada: es sólo para datos ficticios.

Para que un teléfono conectado por USB alcance el API:

```powershell
adb reverse tcp:8080 tcp:8080
```

## Correr las pruebas

```powershell
docker compose --profile test run --rm --build backend-it
docker compose --profile test down db-it backend-it
```

Las pruebas unitarias corren al construir la imagen; las de integración, con
el primer comando, contra una base PostgreSQL desechable. No tocan el entorno
levantado. Cada respuesta que reciben se compara con el contrato.

Antes de subir cambios:

```powershell
docker compose --profile tools run --rm contract-lint
docker compose --profile tools run --rm secret-scan
```

El repositorio es público: el segundo comando busca secretos en todo el
historial.

## Ensayar el respaldo y la restauración

Para conservar una copia cifrada y restaurarla en un contenedor nuevo sin
acceso al origen, ver [Respaldos cifrados](respaldos-cifrados.md). Los modos
nuevos y la comparación de contenido pasaron la autoprueba aislada el 17 de
octubre de 2026. Falta comprobar una copia de operación y la recuperación completa.

Un respaldo que nunca se ha restaurado no es un respaldo. Este ensayo lo
comprueba de punta a punta, con el entorno levantado:

```powershell
docker compose --profile ops run --rm backup-rehearsal
```

Qué hace, por cada una de las dos bases, la del producto y la del proveedor
de identidad:

1. Entra con el rol `zenit_backup`, que sólo lee.
2. Toma una instantánea, respalda con ella y cuenta las filas de cada tabla
   dentro de esa misma instantánea.
3. Levanta una instancia de PostgreSQL desechable dentro del propio
   contenedor, sin puerto de red, y restaura ahí el respaldo.
4. Vuelve a contar y compara además una huella SHA-256 del contenido de cada
   tabla; una modificación que conserve el conteo también debe detectarse.

Como el conteo y el respaldo ven la misma instantánea, la comparación es
exacta aunque el backend siga escribiendo mientras tanto.

Termina con `ENSAYO CORRECTO` y el total de tablas y filas, o con `ENSAYO
FALLIDO` y la diferencia. No conserva nada: el respaldo, la instancia y los
conteos viven en memoria y desaparecen con el contenedor. No imprime datos,
sólo nombres de tabla, conteos y huellas.

Para comprobar que la comparación sirve, hay un modo de control que estropea
la restauración a propósito, borrando una fila. Debe fallar:

```bash
BACKUP_TAMPER=true docker compose --profile ops run --rm backup-rehearsal
```

Límites de este ensayo:

- **El modo de ensayo no guarda el respaldo.** El nuevo modo `backup` guarda
  un paquete cifrado local; la retención y copia externa siguen pendientes.
- **Restaura en memoria.** Sirve mientras la base quepa en la memoria del
  contenedor, que es el caso en local.
- **Las contraseñas de los roles no van en el respaldo.** Al restaurar en un
  entorno nuevo las ponen los secretos y la inicialización de la base.
- **La comparación de contenido usa memoria por tabla.** Antes de tablas de
  millones de filas hay que verificar por lotes.

Una base sin tablas también hace fallar el ensayo: no habría nada que
comprobar.

Se corrió 16 veces con la imagen anterior de la base, 12 de ellas mientras el
backend escribía: 130 tablas iguales en todas, con el total de filas
creciendo de una corrida a la siguiente. Con la imagen actual se repitió 4
veces, sin escrituras a la vez. En las dos, el modo de control falló como
debe. Esas ejecuciones verificaron la versión que comparaba sólo conteos;
el 17 de octubre de 2026 se repitió con comparación de contenido: 130 tablas
y 1.772 filas idénticas, sin escrituras simultáneas provocadas por la prueba.

## Revisar vulnerabilidades

Dos herramientas, las dos con la imagen fijada. La primera hace el
inventario de lo que lleva una imagen; la segunda busca en ese inventario
vulnerabilidades conocidas.

La imagen se exporta antes a un archivo, para no darle a la herramienta el
control de Docker:

```bash
mkdir -p build/security
docker compose build backend
docker save fastsolution-zenit-backend -o build/security/backend.tar
docker compose --profile tools run --rm sbom
docker compose --profile tools run --rm vuln-scan
```

- `sbom` no usa la red. Deja el inventario en
  `build/security/backend.cdx.json`, en formato CycloneDX.
- `vuln-scan` sale a Internet sólo para bajar su base de vulnerabilidades, que
  guarda en `build/security/db/`. No manda nada del proyecto. Imprime la
  lista, deja el detalle en `build/security/backend.vulns.json` y **termina
  con error si hay alguna vulnerabilidad alta o crítica**.

`build/` no entra a Git ni a las imágenes.

Para otra imagen se cambia el nombre del archivo con `SCAN_TARGET`:

```bash
docker save fastsolution-zenit-web -o build/security/web.tar
SCAN_TARGET=web docker compose --profile tools run --rm sbom
SCAN_TARGET=web docker compose --profile tools run --rm vuln-scan
```

Las cuatro imágenes del entorno son `fastsolution-zenit-backend`,
`fastsolution-zenit-web`, `fastsolution-zenit-keycloak` y
`fastsolution-zenit-db`.

Cuando aparece un hallazgo alto o crítico:

1. Si es de una biblioteca del backend, subir su versión en
   `backend/build.gradle.kts`.
2. Si es de un paquete del sistema con corrección publicada, subirlo en el
   `Dockerfile` de esa imagen, o actualizar la imagen base.
3. Si no tiene corrección, o no aplica, una persona decide aceptarlo y lo
   anota en `.grype.yaml` con el motivo y la fecha de revisión. Aceptar no es
   corregir. Hoy hay seis aceptados, todos de la imagen del proveedor de
   identidad: el archivo dice por qué y cuándo se revisan.

Conviene correrlo antes de publicar una versión y cada cierto tiempo aunque
nada cambie: la lista de vulnerabilidades conocidas crece sola.

El estado del último análisis está en
[Estado y pendientes](estado-y-pendientes.md#vulnerabilidades-conocidas). Los
comandos se corrieron con Docker sobre Windows; en una máquina con Linux la
carpeta `build/security` puede quedar con archivos de otro dueño.

## Ver qué pasa

```powershell
docker compose logs --follow backend
docker compose logs keycloak
docker compose exec db psql -U zenit_admin -d zenit
```

Cada error del API trae un `correlationId`: con él se encuentra la petición en
los registros del backend. Los registros no llevan tokens, correos ni nombres.

## Empezar de cero

```powershell
docker compose down --volumes
```

Y borrar el contenido de `secrets/`. Después, repetir «Primera vez». Borra la
base, las cuentas y las claves del proveedor de identidad.

## Problemas frecuentes

| Síntoma | Causa | Qué hacer |
| --- | --- | --- |
| El backend no arranca y el registro habla del esquema | Falta aplicar una migración | `docker compose up --detach`: `migrate` corre primero |
| El backend o la base no arrancan tras clonar | Faltan los secretos | Correr `secrets-init` |
| `403` al dar de alta una empresa | El correo no está en `secrets/operator_emails`, o no se recreó el backend | Escribirlo y recrear el backend |
| La cuenta entra pero `GET /me` no trae empresa | El correo no está verificado, o nadie invitó a ese correo | Verificarlo en la consola; invitarlo |
| `401` con un token que servía | Venció: dura 5 minutos | Renovarlo |
| `503` del proveedor de identidad al arrancar | Dice que está sano unos segundos antes de terminar de cargar el realm | Esperar y reintentar |
| Un cambio en el archivo del realm no se nota | El realm sólo se importa cuando no existe | Empezar de cero |
| Un marcaje responde `card_unknown` con la tarjeta bien registrada | La tarjeta simulada está apagada | Encenderla en `.env` |
| `docker build` de Android falla al invocar `gradlew` | El archivo llegó con fin de línea de Windows | El repositorio ya lo fija; volver a clonar o renormalizar |
| Puerto ocupado | Otro programa usa 8080, 8081 u 8082 | Cambiarlo en `.env` |
| Las pruebas fallan con «no cumple el contrato» | Una respuesta cambió sin cambiar el contrato | Cambiar los dos en el mismo commit |
| Las pruebas fallan con «aceptó un cuerpo que el contrato no admite» | El backend acepta algo que el contrato no describe | Describirlo en el contrato o dejar de aceptarlo |
| `429` con `rate_limited` | La persona pasó su cuota de peticiones por minuto | Esperar un minuto; en local se puede subir en `.env` |
| El simulador dice que el backend no reconoce la tarjeta simulada | La tarjeta simulada está apagada | Encenderla en `.env` |
| El simulador responde `401` al empezar | El token venció: dura 5 minutos | Obtener otro y correrlo enseguida |
| El ensayo de respaldo dice que el rol `zenit_backup` no puede entrar | El entorno se creó antes de que existiera ese rol | Los pasos de «Si el entorno ya existía» |
| `vuln-scan` termina con error | Encontró una vulnerabilidad alta o crítica | Los pasos de «Revisar vulnerabilidades» |
| La base no arranca y su registro dice `Permission denied` | El volumen se creó con la imagen anterior de la base | Los pasos de «Si el entorno ya existía» |
| El registro de la base dice `no usable system locales were found` | Es normal: la imagen no trae idiomas del sistema y la base no los usa | Nada |
