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
| `db` | PostgreSQL, con la base del producto y la del proveedor de identidad | No publica ninguno |
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

## Ajustes

Copiar `.env.example` a `.env` es opcional. Sólo hace falta para cambiar algo:

| Variable | Por omisión | Para qué |
| --- | --- | --- |
| `BIND_ADDRESS` | `127.0.0.1` | En qué interfaz se publican los puertos |
| `BACKEND_PORT`, `WEB_PORT`, `KEYCLOAK_PORT` | 8080, 8081, 8082 | Los puertos |
| `PORTAL_URL`, `IDENTITY_URL` | Las direcciones locales | Cómo se anuncian el portal y la identidad |
| `CAPTURE_SIMULATED_CARDS` | `false` | Aceptar la tarjeta simulada. Sólo con datos ficticios |
| `EXPORTS_TTL_MINUTES` | 15 | Cuánto se puede descargar un exporte listo |
| `JOBS_ENABLED` | `true` | Que este backend atienda los trabajos encolados |

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
| `keycloak_admin_password` | La cuenta temporal `arranque` de la consola de identidad |
| `keycloak.conf` | Configuración generada del proveedor de identidad |
| `operator_emails` | Los correos de quienes operan el servicio, uno por línea. Nace vacío |

Sin su archivo, el servicio que lo necesita no arranca. No hay valores por
omisión.

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

El portal todavía no inicia sesión, así que para llamar al API a mano hay que
obtener un token. El proveedor sólo acepta el flujo de código de autorización
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

No hay datos sembrados: el entorno nace vacío. El
[Recorrido completo](recorrido-completo.md) lleva de una empresa nueva a un
exporte, petición por petición.

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
