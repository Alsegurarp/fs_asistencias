# Inicio del desarrollo móvil

La app Android registra asistencia mediante NFC. No administra el padrón,
horarios ni tarjetas: eso corresponde al portal. No requiere una cuenta de
Keycloak; RH entrega un código para activar cada teléfono.

## Modalidades

- Personal: registra a su titular, consulta su semana y acusa el cierre.
- Terminal: registra tarjetas en una sede; no consulta una semana personal.

## Primera entrega

Se agregó una pantalla de activación con dirección del servidor y código de
RH. Genera una clave P-256 en Android Keystore, envía su parte pública y una
prueba ES256, comprueba que exista bloqueo de pantalla y conserva la respuesta
del servidor entre aperturas. La clave privada no sale del almacén.

La captura NFC queda deshabilitada: la cola del esqueleto anterior no contiene
sobres firmados compatibles con el contrato. Activar el teléfono todavía no
permite marcar. No se modifican ni se envían los registros locales anteriores.

Si la conexión se pierde después de que el servidor consume el código pero
antes de guardar la respuesta, puede ser necesario solicitar otro código y
resolver la activación con RH. No hay recuperación automática en esta entrega.

## Siguientes entregas

La app compartida contiene el flujo de activación y los estados del teléfono.
En la presentación actual, la interfaz muestra el teléfono ya vinculado y
datos históricos locales; no cambia la activación guardada ni datos del API.
Después de integrar los cambios del equipo, el flujo operativo conserva
enrolamiento, captura firmada y sincronización. La presentación se abre en
una actividad independiente con «Ver presentación del producto», sólo en debug.
Se amplió el diseño con navegación Inicio, Mi semana, Actividad y Dispositivo.
El alcance y su correspondencia con los endpoints están en
[Producto móvil](alcance-producto-movil.md).
Se retiraron los accesos reales por rol y el retorno de Keycloak.
Posteriormente se agregaron recorridos separados de demostración para
marcaje de entrada/salida y Administrador/RH con credenciales opcionales.
Estos recorridos no autentican ni envían datos al servidor.
Las cuentas de prueba se usan desde el portal, fuera del APK.

Para crear las cuatro cuentas demo locales y sus roles, una vez levantados
Keycloak y el backend, ejecutar:

```powershell
.\infra\bootstrap-local-demo.ps1
```

Lee las credenciales de `secrets/demo-users.json`, ignorado por Git, y conserva
las cuentas existentes sin cambiar sus contraseñas.
La empresa `demo-local` y las invitaciones son datos ficticios sembrados con
el rol dueño del esquema; la operación queda registrada en la bitácora.


1. Aserción firmada y apertura de sesión, con manejo de reloj y revocación.
2. Sobre firmado por lectura NFC, consecutivo y persistencia antes de enviar.
3. Sincronización en lotes, recibos e idempotencia; límites sin conexión.
4. Consulta de semana y acuse, exclusivamente en modalidad personal.
5. Pruebas en teléfono y definición de la autenticación de la tarjeta real.

La guía completa está en [Guía Android](guia-app-android.md), y los campos
exactos en [OpenAPI](../contracts/openapi.yaml).

## Verificación y entorno

Desde la raíz, siguiendo la regla de desarrollo en Docker:

```powershell
docker build --file android/Dockerfile android
```

Se verificaron pruebas unitarias, lint y ensamblado del APK dentro de Docker.
Incluye pruebas de conversión de firmas DER a JOSE. La descarga de Gradle
admite reintentos y un límite de 60 segundos. La clave de firma debug se
conserva en una caché de Docker para permitir actualizaciones de la app.
Todavía no se ha probado la activación contra un backend ni un marcaje real.
El APK debug se instaló por ADB inalámbrico y abrió correctamente en el
teléfono. La interfaz compartida presenta el teléfono vinculado y recorridos
de asistencia y Administrador/RH con históricos locales. El código de activación
real queda pendiente de verificar e integrar a ese flujo.

Para el servidor local usa `http://localhost:8080` con la conexión USB descrita
en la guía, o `http://10.0.2.2:8080` en un emulador. HTTP sólo se habilita
para estas direcciones y `127.0.0.1` en la variante de depuración; release
requiere HTTPS. La dirección debe ser la base del servidor, sin `/api/v1`.

También se puede usar la conexión ADB inalámbrica emparejada. Preparar los
túneles con el identificador vigente que muestre `adb devices`:

```powershell
adb -s <telefono> reverse tcp:8080 tcp:18080
adb -s <telefono> reverse tcp:8081 tcp:8081
adb -s <telefono> reverse tcp:8082 tcp:8082
```

La dirección del servidor se introduce al vincular el teléfono. Los túneles sólo sirven
mientras el teléfono esté conectado por ADB y los servicios estén levantados.
En esta instalación se configuró `BACKEND_PORT=18080` en `.env` porque el
puerto 8080 del host está ocupado. La laptop usa `http://localhost:18080`;
el teléfono sigue usando `http://localhost:8080` gracias al túnel. En un
emulador sin túnel la dirección correspondiente sería `http://10.0.2.2:18080`.

Si Docker no arranca porque falta WSL, desde PowerShell **como administrador**:

```powershell
& .\infra\enable-local-docker.ps1
```

Reiniciar Windows manualmente, ejecutar `wsl --update` y abrir Docker Desktop.
Después, desde la raíz del repositorio:

```powershell
docker compose --profile setup run --rm secrets-init
docker compose up --build --detach
```

El entorno local ya se levantó: PostgreSQL y Keycloak saludables, siete
migraciones aplicadas, backend con salud `UP` y portal con respuesta HTTP 200.
Se crearon las cuatro cuentas demo proporcionadas y se comprobaron sus roles
en la empresa ficticia. El acceso del portal conserva el segundo factor del realm.
