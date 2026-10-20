# Guía de la app Android

Qué tiene que hacer la app para enrolarse, identificarse, marcar, trabajar sin
conexión y mostrar la semana. Antes conviene leer
[Consumir el API](consumir-el-api.md).

Estado: el módulo `android/` implementa enrolamiento con bloqueo de pantalla,
clave P-256 en Android Keystore, aserciones y sobres ES256, captura NFC con
ubicación puntual, cola cifrada y sincronización por lotes con WorkManager.
Guarda los recibos cifrados y muestra el tipo decidido por el servidor; un
rechazo con recibo sale de pendientes y queda disponible para revisión.
Puede renovar la sesión y volver a enrolarse. En modalidad personal permite
consultar una semana del servidor y responder al cierre con conformidad u
objeción. Véase la sección 8 y [Revisión móvil del empleado](revision-movil-empleado.md).

La variante debug ofrece «Explorar presentación · datos de ejemplo». Abre una
actividad separada con el diseño, los históricos y el panel de Administrador/RH
descritos en [Producto móvil](alcance-producto-movil.md). Sus datos son locales
y no sustituyen la captura, los recibos ni la vinculación del flujo operativo.

En la presentación, entrar a Administración y elegir «Tarjetas NFC · Leer,
escribir y borrar», o abrir un empleado y «Administrar tarjeta NFC». El diseño
permite consultar una tarjeta de ejemplo, seleccionar al empleado, preparar
número y contenido, confirmar su reemplazo y simular el borrado. Cada acción
indica que es una demostración: no lee ni escribe tarjetas físicas ni llama al
backend. Los cambios viven sólo mientras está abierta esa pantalla; el borrado
no representa una revocación. El modelo, capacidad, protocolo de grabación y
conexión con el backend están pendientes de confirmar con el equipo.

La presentación separa los espacios: el empleado navega por Inicio, Mi semana,
Actividad y Dispositivo. Administración / RH tiene su propia barra con Resumen,
Empleados, Tarjetas y Cuenta; el acceso de demostración no muestra barra inferior.
Resumen reúne las cifras del equipo y accesos rápidos. Cuenta permite regresar
al perfil personal o cerrar la sesión de demostración. Estos perfiles y sus
permisos son visuales; no representan autenticación ni autorización del backend.

El 17 de octubre de 2026 pasaron 9 pruebas unitarias, lint y compilación debug
dentro de Docker. Release tiene una compilación anterior comprobada, no repetida
en esa revisión. El autoensayo pasó en un
Samsung SM-S928B con Android API 36: verifica firmas reales de Keystore,
migración sin pérdida, activación, persistencia, reintentos sin cambiar el
sobre, rechazo de recibos ajenos, recibos aceptados y rechazados, captura
durante una respuesta lenta y reenrolamiento que conserva los pendientes.
Ese ensayo usa un servidor HTTP de prueba y almacenamiento separado de la app;
no sustituye las pruebas contra el backend, una lectura NFC física ni una
muestra real de ubicación. La pantalla inicial también se abrió y revisó en
el teléfono.

El 19 de octubre de 2026 pasaron 9 pruebas unitarias, lint y ambos APK debug
(app e instrumentación) con Gradle local. En el mismo Samsung pasaron personal
y terminal contra backend local y `https://zenit.fastsolution.com.mx`, con tres
procesos por modalidad: activación, cola y sincronización. En cada entorno
quedaron exactamente dos marcajes por empleado, sin duplicados; se comprobaron
rechazos, recibos y renovación. Se revocaron los dispositivos y tarjetas del
ensayo y se desactivaron sus empleados y sede. El fixture original y el rechazo
de argumentos incompletos también pasaron. Evidencia en
[Bitácora](bitacora-trabajo.md#19-de-octubre-de-2026--android-reproducible-contra-backend-local-y-https).

La captura `uid_sha256` se habilita sólo en debug. Release exige HTTPS y no
permite marcar mientras la verificación de la tarjeta real siga pendiente.

Ese dispositivo simulado se puede leer y correr: está en
`backend/src/simulator/` y hace, contra el entorno local, la activación, la
aserción y el sobre firmado de cada marcaje. Sirve de referencia mientras la
app no lo haga. Cómo se corre está en
[Entorno local](entorno-local.md#llenar-el-entorno-con-el-simulador-de-dispositivo).

## Acceso y consulta de tarjetas

La bienvenida aparece una vez por instalación o al borrar los datos. Después
se elige Administración o Empleado. Administración integra el portal HTTPS
publicado dentro de la app y conserva su autenticación y permisos; Empleado
abre vinculación mediante código de RH. La dirección publicada viene
preseleccionada. No se incluyen cuentas ni contraseñas personales en el código.

«Consultar tarjeta» muestra nombre, puesto, horario e ID leídos físicamente
de la credencial Zenit, sin registrar asistencia ni modificarla. No muestra
UID, huellas, tecnologías, memoria, sectores o claves. Requiere tarjeta MF1K
compatible, soporte MIFARE Classic del teléfono y la configuración de acceso
de fábrica usada actualmente. No implementa autenticación DESFire.

La presentación visual sigue disponible en debug con datos de ejemplo y sin
pedir credenciales. La captura de asistencia por UID conserva su restricción
a debug y datos ficticios; la verificación autenticada sigue pendiente.

## El recorrido

```text
código de enrolamiento ──► activación ──► sesión ──► marcajes ──► semana y acuse
   (lo da RH)              (una vez)     (al abrir)  (uno o lote)   (si es personal)
```

| Paso | Ruta | Credencial |
| --- | --- | --- |
| Activar el dispositivo | `POST /device-activations` | Ninguna: el código y la prueba de la clave |
| Abrir sesión | `POST /device-sessions` | Aserción del dispositivo |
| Marcar | `POST /attendance-events` | Aserción del dispositivo |
| Mandar lo guardado sin conexión | `POST /attendance-events/batch` | Aserción del dispositivo |
| Ver la semana propia | `GET /me/attendance?week=` | Aserción, sólo en modalidad `personal` |
| Acusar el cierre | `POST /week-closures/{closureId}/acknowledgements` | Aserción, sólo en modalidad `personal` |

La app no usa cuentas ni contraseñas, y no habla con el proveedor de
identidad.

## 1. La clave del dispositivo

- Una clave EC en la curva P-256, generada en el propio teléfono y guardada en
  su almacén de claves. La parte privada nunca sale.
- Se usa para tres firmas, todas ES256: la prueba de activación, la aserción
  de cada petición y el sobre de cada marcaje.
- La parte pública viaja una sola vez, como JWK, al activar:

```json
{ "kty": "EC", "crv": "P-256", "x": "<base64url>", "y": "<base64url>" }
```

Una clave que trae su parte privada (`d`) se rechaza.

### Cuidado con el formato de la firma

Un JWS con ES256 lleva la firma como `R` y `S` de 32 bytes cada uno,
concatenados: 64 bytes. El almacén de claves de Android entrega la firma en
DER, que es otro formato y mide distinto. Hay que convertirla, o usar una
librería JOSE que lo haga. Una firma en DER se rechaza como firma inválida.

## 2. Activar

RH emite un código en el portal. Tiene la forma `K7M2X-9QXDW`, vale 15 minutos y
sirve una vez. La persona lo escribe en la app.

```http
POST /api/v1/device-activations
Content-Type: application/json
```

```json
{
  "enrollmentCode": "K7M2X-9QXDW",
  "publicKey": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" },
  "proof": "<JWS>",
  "device": { "manufacturer": "Ficticia", "model": "Modelo 1", "androidSdk": 34, "appVersion": "0.1.0" },
  "screenLock": true
}
```

- `proof` es un JWS firmado con la clave nueva, con cabecera
  `{"alg":"ES256"}` y carga `{"enrollmentCode":"K7M2X-9QXDW"}`. Demuestra que
  la app posee la clave que registra.
- `screenLock` dice si el teléfono tiene bloqueo de pantalla. Sin bloqueo no
  se activa.
- `androidSdk` debe ser 28 o mayor.

La respuesta, 201:

```json
{
  "deviceId": "1c3e5a7b-9d1f-4a3c-8e5b-7d9f1a3c5e7b",
  "mode": "personal",
  "tenant": { "name": "Panificadora Ejemplo", "timeZone": "America/Mexico_City" },
  "employee": { "id": "5a7c9e1b-3d5f-4b6a-8c0e-2a4c6e8b0d12", "displayName": "Persona Uno" },
  "site": null,
  "audience": "zenit-capture",
  "session": {
    "sessionId": "9b1d3f5a-7c9e-4b1d-8f3a-5c7e9b1d3f5a",
    "startedAt": "2026-10-05T12:59:40Z",
    "serverTime": "2026-10-05T12:59:40Z",
    "breakPolicy": "not_considered",
    "tokenMaxAgeSeconds": 120,
    "locationReuseSeconds": 30,
    "offlinePolicy": { "maxAgeHours": 72, "maxEvents": 1000 }
  }
}
```

Guardar `deviceId`, `mode`, `audience` y la sesión. En modalidad `terminal`
viene `site` y `employee` es nulo.

| Respuesta | Causa | Qué mostrar |
| --- | --- | --- |
| 410 `enrollment_gone` | El código ya se usó, venció o no existe; no dice cuál | Pedir otro código |
| 422, campo `screenLock`, `screen_lock_required` | El teléfono no tiene bloqueo de pantalla | Pedir que lo active |
| 422, campo `proof`, `invalid_proof` | La prueba no corresponde a la clave o al código | Error de la app: revisar la firma |
| 422, campo `publicKey`, `key_already_registered` | Esa clave ya es de otro dispositivo | Generar una clave nueva |
| 429 | Demasiados intentos fallidos desde esa red | Esperar un minuto |

## 3. Identificarse en cada petición

Cada petición lleva `Authorization: Bearer <aserción>`. La aserción es un JWT
que la app firma con su clave; el servidor no emite ningún token.

Cabecera:

```json
{ "alg": "ES256", "kid": "<deviceId>" }
```

Carga:

```json
{
  "iss": "<deviceId>",
  "sub": "<deviceId>",
  "aud": "zenit-capture",
  "iat": 1791205180,
  "exp": 1791205240
}
```

- `aud` es el valor de `audience` que llegó al activar.
- De `iat` a `exp` no pueden pasar más de `tokenMaxAgeSeconds`; un minuto es
  buen valor. Se firma una nueva para cada petición o se reutiliza mientras no
  venza.
- El servidor tolera un minuto de desfase de reloj. Con el reloj del teléfono
  más movido que eso, responde 401; ese 401 trae `serverTime` para avisar al
  usuario que corrija la hora.

Un 401 también significa dispositivo revocado o reemplazado: si la hora está
bien, hay que volver a enrolar.

## 4. Abrir sesión

Al abrir la app, o cuando la sesión anterior ya no sirve:

```http
POST /api/v1/device-sessions
Authorization: Bearer <aserción>
Content-Type: application/json

{ "appVersion": "0.1.0" }
```

Devuelve una sesión como la de la activación. Abrir una cierra la anterior.

- `breakPolicy` dice si la empresa marca la comida. Sólo con `marked` la app
  ofrece inicio y fin de descanso; con `not_considered` sólo hay entrada y
  salida.
- `offlinePolicy` dice cuánto vale la sesión sin conexión: 72 horas o 1000
  marcajes. Pasado cualquiera de los dos, hay que abrir otra antes de seguir
  marcando.
- `locationReuseSeconds` dice cuánto puede una terminal reutilizar la misma
  muestra de ubicación entre lecturas seguidas.
- Cada sesión lleva su propio consecutivo de marcajes, que empieza en 1.

## 5. Marcar

Cada marcaje es un **sobre**: un JWS firmado con la clave del dispositivo. El
servidor lo guarda tal como llega; por eso lo que se firma es lo que queda
como evidencia.

Cabecera del sobre:

```json
{ "alg": "ES256", "kid": "<deviceId>" }
```

Carga del sobre:

```json
{
  "envelopeVersion": 1,
  "idempotencyKey": "2d4f6a8c-0e2b-4d6f-8a0c-2e4b6d8f0a2c",
  "sessionId": "9b1d3f5a-7c9e-4b1d-8f3a-5c7e9b1d3f5a",
  "sequence": 1,
  "observedAt": "2026-10-05T13:00:00Z",
  "timeZone": "America/Mexico_City",
  "elapsedRealtimeMs": 86400000,
  "declaredType": "clock_in",
  "card": { "scheme": "uid_sha256", "proof": "<huella de la tarjeta>" },
  "location": {
    "latitude": 19.432608,
    "longitude": -99.133209,
    "accuracyMeters": 12,
    "capturedAt": "2026-10-05T12:59:58Z",
    "provider": "fused",
    "mock": false
  },
  "app": { "version": "0.1.0" }
}
```

| Campo | Notas |
| --- | --- |
| `idempotencyKey` | UUID que la app genera una vez por lectura y conserva en la cola. Es lo que evita duplicados |
| `sequence` | Consecutivo dentro de la sesión, desde 1, sin repetir |
| `observedAt` | El instante de la lectura, no el del envío |
| `timeZone` | Zona IANA del teléfono |
| `elapsedRealtimeMs` | Opcional. El reloj monotónico del teléfono; sirve para detectar que se movió la hora |
| `declaredType` | Opcional. Lo que la persona eligió; si no va, el servidor lo deduce |
| `card` | Esquema y prueba de la tarjeta. Ver «La tarjeta» abajo |
| `location` | Obligatorio que el campo exista. Si no hay ubicación va en nulo, con `locationUnavailableReason`: `permission_denied`, `disabled` o `timeout` |
| `integrityToken` | Opcional; reservado |

Un campo de más en la carga hace que se rechace con `payload_invalid`.

El envío:

```http
POST /api/v1/attendance-events
Authorization: Bearer <aserción>
Idempotency-Key: 2d4f6a8c-0e2b-4d6f-8a0c-2e4b6d8f0a2c
Content-Type: application/json

{ "envelope": "<JWS del sobre>" }
```

La cabecera `Idempotency-Key` lleva la misma clave que va firmada dentro del
sobre.

### El recibo

| Estado | Significa |
| --- | --- |
| 201 | El marcaje quedó guardado |
| 200 | Es una repetición de una clave ya vista, o un rechazo con recibo |

```json
{
  "eventId": "8b0d2f4a-6c8e-4a0c-9e2b-4d6f8a0c2e4b",
  "idempotencyKey": "2d4f6a8c-0e2b-4d6f-8a0c-2e4b6d8f0a2c",
  "outcome": "accepted",
  "type": "clock_in",
  "observedAt": "2026-10-05T13:00:00Z",
  "receivedAt": "2026-10-05T13:00:01Z",
  "employee": { "displayName": "Persona Uno" },
  "site": { "id": "3b1f9a52-6c0d-4e7a-8f21-9d4c5b6a7e80", "name": "Sucursal Centro" },
  "locationVerdict": "inside",
  "incident": null,
  "rejection": null
}
```

Qué hacer según `outcome`:

| `outcome` | La app | Sacar de la cola |
| --- | --- | --- |
| `accepted` | Confirma con el nombre y el tipo que decidió el servidor | Sí |
| `accepted_with_incident` | Confirma igual; puede avisar que quedó para revisión | Sí |
| `rejected` | Muestra el motivo de `rejection.code` | Sí: un rechazo no se reintenta |

Mostrar el `type` del recibo, no el declarado: el servidor decide.

### Rechazos

| `rejection.code` | Qué decirle a la persona |
| --- | --- |
| `card_unknown` | La tarjeta no está registrada. Avisar a RH |
| `card_revoked` | La tarjeta ya no está activa, o la persona está dada de baja |
| `card_not_owner` | Este teléfono sólo acepta la tarjeta de su titular |
| `session_invalid` | La sesión ya no sirve. Abrir otra; el marcaje rechazado no se recupera con la misma clave |
| `too_old` | El marcaje tiene más de 72 horas y ya no se acepta |
| `signature_invalid` | Error de la app o dispositivo revocado |
| `payload_invalid` | Error de la app: el sobre no cumple el contrato |

Otros estados: 401, la aserción no sirve; 409, esa clave ya se usó con otro
sobre; 422, la cabecera y la clave firmada no coinciden; 429, demasiadas
peticiones.

## 6. Sin conexión

Al leer la tarjeta: generar la clave de idempotencia, tomar la ubicación,
armar y firmar el sobre, y guardarlo en la cola. Todo antes de intentar
enviarlo.

Con conexión, mandar lo pendiente en orden:

```http
POST /api/v1/attendance-events/batch
Authorization: Bearer <aserción>
Content-Type: application/json

{ "envelopes": ["<JWS>", "<JWS>"] }
```

- La respuesta trae `receipts`, uno por sobre y en el mismo orden. Cada uno
  se trata como el recibo de un marcaje suelto.
- Si la petición falla entera, por red o por 5xx, se reenvía el mismo lote:
  las claves de idempotencia hacen que nada se duplique.

Límites: de 1 a 100 sobres por lote; una sesión vale 72 horas o 1000
marcajes; un marcaje de más de 72 horas se rechaza. Un marcaje que llega más
de 24 horas tarde se guarda con la incidencia `late_sync`.

El orden importa poco para el resultado final: la jornada vuelve a leer los
marcajes por su hora. Pero mandar en orden evita incidencias de más al
recibirlos.

## 7. La tarjeta

El campo `card` lleva un esquema y una prueba.

| Esquema | Estado |
| --- | --- |
| `desfire_ev3_aes` | El de la tarjeta real. El servidor todavía no lo verifica y lo rechaza con `card_unknown`. Su formato depende de la prueba con tarjetas y teléfonos reales |
| `uid_sha256` | Tarjeta simulada, para desarrollar. No está autenticada. La prueba es la misma huella con la que se registró la tarjeta en el portal |

La tarjeta simulada nace apagada: sólo se acepta donde el servidor tiene
`CAPTURE_SIMULATED_CARDS=true`. Es para datos ficticios; nunca basta para
aceptar un marcaje real.

## 8. Semana y acuse, en modalidad personal

Implementado en la pantalla operativa «Mi semana · registros del servidor»:
fecha de consulta, tramos en la zona horaria de la empresa, totales informativos,
alertas, número de incidencias abiertas y cierre con versión. No usa datos de
la presentación. Requiere conexión y no necesita NFC ni permiso de ubicación
para consultar o responder. Los pendientes locales se avisan por separado y
bloquean conformidad hasta sincronizar; no bloquean reportar una diferencia.

Antes de enviar, el empleado confirma haber revisado el resumen y confirma
tipo, comentario y versión en un diálogo. No se preselecciona conformidad.
El texto aclara que no renuncia a derechos ni confirma pago de salarios.
El recibo confirmado se guarda cifrado, separado por dispositivo y cierre,
y se recupera al consultar esa versión. Un fallo de envío no se reintenta
automáticamente: se avisa que puede haberse guardado y se pide verificar con RH.
El servidor resuelve conflictos por cierre reabierto o ya acusado (409).

«Compartir copia del resumen» abre el selector Android por acción expresa;
no manda información automáticamente a RH ni al gobierno. La copia incluye
lo mostrado y el acuse local si existe; no es el expediente probatorio completo.
La consulta personal actual no devuelve acuses de otras instalaciones, ajustes
detallados ni respuestas de RH. No se presenta la ausencia de acuse local como
ausencia de acuse en el servidor. La semana consultada no se conserva sin conexión.

Un teléfono personal puede mostrar a su titular su semana y dejarlo acusar su
cierre, con la misma aserción con que marca. Una terminal recibe 403.

```http
GET /api/v1/me/attendance?week=2026-10-05
Authorization: Bearer <aserción>
```

`week` admite cualquier fecha de la semana. La respuesta trae tramos, totales,
alertas, incidencias abiertas y, si está cerrada, `closure` con su
identificador y su versión.

Para acusar:

```http
POST /api/v1/week-closures/<closure.id>/acknowledgements
Authorization: Bearer <aserción>
Content-Type: application/json

{ "type": "objected", "note": "El martes salí una hora después." }
```

`type` es `agreed` u `objected`; la nota es opcional, hasta 500 caracteres.
Una vez por versión de cierre: repetirlo responde 409
`already_acknowledged`.

## Conectar la app al ambiente publicado

El ambiente publicado sólo tiene datos ficticios y acepta la tarjeta
simulada. Sirve para recorrer la app contra el backend real por HTTPS, desde
cualquier red, sin levantar nada en la máquina.

| Dato | Valor |
| --- | --- |
| Dirección del servidor en la app | `https://zenit.fastsolution.com.mx`, sin ruta: la app agrega `/api/v1` |
| Portal | <https://zenit.fastsolution.com.mx> |
| Tarjeta | Esquema `uid_sha256`, la tarjeta simulada |

### 1. Entrar al portal

Quien opera el servicio crea una empresa de prueba y entrega una cuenta de
administración con contraseña temporal. En el primer ingreso se cambia la
contraseña y se configura el segundo factor con una aplicación de
autenticación. No hay correo del sistema: si se pierde la contraseña, se pide
a quien opera el servicio.

### 2. Preparar la empresa

En el portal, como administración:

1. **Sedes:** una sede con las coordenadas del lugar donde se va a probar y un
   radio razonable, por ejemplo 200 metros. Si se marca lejos de la sede, el
   marcaje se acepta con una incidencia de ubicación.
2. **Empleados:** la persona que va a marcar, con esa sede.
3. **Tarjetas:** registrar la tarjeta con su huella (abajo) y asignarla a la
   persona. Una tarjeta sin titular se rechaza con `card_unknown`.

La huella de la tarjeta simulada es el SHA-256 de los bytes de su
identificador, en hexadecimal y minúsculas: lo mismo que calcula
`TagEvidenceHasher` con `Tag.getId()`. Lo más fiable es que la app de
depuración la muestre al leer la tarjeta. Mientras no lo haga, se calcula a
partir del número de serie que muestra una app de lectura NFC, quitando los
dos puntos. Con la terminal que instala Git:

```bash
printf '%s' 04A1B2C3D4E5F6 | xxd -r -p | sha256sum
```

Sin verificar: que el orden de los bytes que muestra cada app de lectura NFC
sea el mismo de `Tag.getId()`. Si la huella calculada así no reconoce la
tarjeta, compararla con la que calcula la app.

### 3. Activar el teléfono

En el portal, **Dispositivos → Emitir código**: modalidad personal para un
teléfono de una persona, o terminal para una sede. El código vale una sola
vez y pocos minutos, y sólo se muestra al emitirlo. En la app, escribir la
dirección del servidor y el código. Desde **Dispositivos** también se revoca
un teléfono; para volver a usarlo hace falta un código nuevo.

### 4. Marcar y revisar

Acercar la tarjeta. El recibo dice si el servidor aceptó, aceptó con
incidencia o rechazó, y por qué (sección 5). Lo marcado se ve en el portal,
en Incidencias y Cierres, y en el teléfono personal con la semana y el acuse
(sección 8).

| Respuesta | Qué significa | Qué hacer |
| --- | --- | --- |
| 410 `enrollment_gone` al activar | El código ya se usó, venció o no existe | Emitir otro |
| 429 `rate_limited` al activar | Diez activaciones fallidas en un minuto desde la misma dirección | Esperar un minuto |
| `card_unknown` en el recibo | Tarjeta no registrada, sin titular o con otra huella | Revisar la huella y la asignación |
| `card_not_owner` en el recibo | Teléfono personal con una tarjeta que no es de su titular | Usar la tarjeta de esa persona |

## Probar en local

1. Levantar el entorno con la tarjeta simulada encendida:
   [Entorno local](entorno-local.md).
2. Los puertos sólo se publican en la máquina que corre el entorno. Con el
   teléfono conectado por USB:

   ```powershell
   adb reverse tcp:8080 tcp:8080
   ```

   Así la app llega al backend en `http://localhost:8080`.
3. Crear en el portal, o con peticiones directas, una persona, una tarjeta
   asignada y un código de enrolamiento:
   [Recorrido completo](recorrido-completo.md).
4. En la app debug, indicar `http://localhost:8080` y el código emitido por RH.
   Activar, conceder ubicación y acercar la tarjeta; la confirmación definitiva
   aparece en «Últimos recibos», no al guardarla en la cola.

La base local pasa de versión 1 a 2 sin borrar filas. Los registros anteriores
sin firma se conservan fuera de sincronización. Para volver a enrolarse con
pendientes hay que sincronizarlos primero o confirmar en la app que se
conserven sin enviarlos: los sobres de un dispositivo anterior no se firman
de nuevo con otra clave. Los recibos mostrados pertenecen al dispositivo
activo y sus fechas usan la zona de la empresa.

No se purgan los sobres ni los recibos locales; la política de retención queda
pendiente antes de usar terminales de forma continua. Abrir otra sesión se hace
con «Renovar sesión», sin pendientes ni una sincronización en curso. Mientras
la sesión siga vigente se conserva al abrir la app, también sin conexión.

### Repetir las comprobaciones

Desde `android/`:

```powershell
.\gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest :app:testDebugUnitTest :app:assembleRelease --console=plain
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
$smokeResult = adb shell am instrument -w mx.fastsolution.zenit.test/mx.fastsolution.zenit.mobile.testing.SmokeInstrumentation
$smokeResult
if ($smokeResult -notmatch '^OK:') { throw 'Falló el autoensayo en el teléfono' }
```

El teléfono debe estar autorizado por ADB y tener bloqueo de pantalla. Si hay
más de un dispositivo conectado, agregar `-s <serial>` a cada orden de ADB.
El autoensayo reinicia sólo su almacén de pruebas, separado del de la app.

### Ensayo reproducible contra el backend

Desde la raíz, usar [el guion versionado](../infra/test-android-backend.ps1).
Requiere PowerShell 7, Java/SDK de Android, ADB autorizado, bloqueo de pantalla
y una empresa con datos ficticios. El backend debe aceptar tarjetas simuladas.
La sesión de `SIM_TOKEN` o del archivo `TokenPath` debe tener rol `admin_empresa`, porque el guion crea
y desactiva una sede propia. Obtener un token reciente como se explica en
[Entorno local](entorno-local.md#obtener-un-token-para-probar); no guardarlo
en el guion ni en registros.

```powershell
$env:SIM_TOKEN = '<token vigente de administración de una empresa de prueba>'
try {
    .\infra\test-android-backend.ps1 -BaseUrl http://localhost:18080 -Serial <serial-adb> -FictitiousData
} finally {
    Remove-Item Env:SIM_TOKEN -ErrorAction SilentlyContinue
}
```

El guion compila ambos APK desde las fuentes actuales, ejecuta pruebas y lint,
instala con `adb install -r` y crea sede, dos empleados, tarjetas y códigos
de un uso. No desinstala la app si hay una firma incompatible. Para HTTP usa
un túnel ADB de puerto dinámico que elimina al terminar, sin reemplazar otros.

Cada modalidad, personal y terminal, ejecuta tres procesos de instrumentación:
activación, cola y sincronización. Verifica claves no exportables, persistencia,
código consumido, dos marcajes aceptados y un rechazo de tarjeta desconocida,
reenvío idéntico sin duplicar eventos y renovación. Espera 61 segundos entre
entrada y salida para respetar la ventana de doble lectura del backend.
La fase de cola interrumpe sólo su transporte hacia el servidor y restaura la
URL al terminar: comprueba conservación ante error de red y entre procesos;
no apaga las radios ni cambia las redes del teléfono. El ensayo usa bytes de
tarjeta ficticios y no acredita una lectura NFC física ni ubicación real.

El resultado debe decir `OK: BACKEND` para las seis fases. Sin argumentos,
la instrumentación conserva el ensayo HTTP simulado y responde `OK: FIXTURE`.
Argumentos de backend incompletos producen un fallo, sin recurrir al fixture.

En `finally` se revocan sólo dispositivos con las etiquetas únicas de esa
ejecución y tarjetas del ensayo; se desactivan sus empleados y sede. Se conservan
marcajes y auditoría. Los códigos no consumidos vencen normalmente a los 15
minutos. `build/android-<id>.log` registra commit, cambios locales, hashes de
ambos APK, fases e identificadores de limpieza; excluye token, códigos y sobres.
Un fallo de limpieza impide declarar éxito y deja los identificadores para
completarla con una sesión vigente; el token del portal dura cinco minutos.

Para repetir por HTTPS con un token en un archivo local ignorado por Git:

```powershell
.\infra\test-android-backend.ps1 -BaseUrl https://zenit.fastsolution.com.mx -Serial <serial-adb> -TokenPath secrets/android-development-token.txt -FictitiousData
```

El archivo admite el JWT solo o con el prefijo `Bearer `. Se vuelve a leer en
cada petición, de modo que se puede reemplazar por uno renovado de la misma
cuenta y empresa durante el ensayo. Se exigen cuatro minutos de vigencia antes
de crear datos para dejar margen a ambos modos y su limpieza. No necesita
túnel ADB. El recorrido publicado pasó el 19 de octubre de 2026.

## Lista de comprobación

- [ ] La clave privada nunca sale del almacén de claves.
- [ ] La firma va como `R` y `S` de 32 bytes, no en DER.
- [ ] La clave de idempotencia se genera al leer la tarjeta y se guarda con el
      sobre.
- [ ] El sobre se firma y se guarda antes de intentar enviarlo.
- [ ] Un rechazo con recibo sale de la cola y no se reintenta.
- [ ] La app muestra el tipo que decidió el servidor.
- [ ] El descanso sólo se ofrece cuando la sesión dice `marked`.
- [ ] Un 401 con la hora bien lleva a volver a enrolar; con la hora mal, a
      corregirla.
- [ ] Ni la aserción ni el sobre aparecen en los registros de la app.

## Administración integrada y tarjetas MF1K

Administración integra el portal publicado mediante WebView, con navegación
limitada al host HTTPS de Zenit, sin interfaz JavaScript nativa, acceso a
archivos ni contenido mixto. El login, OTP y los recorridos administrativos
en esta vista siguen pendientes de validación manual.

«Preparar tarjetas» muestra dos empleados de ejemplo locales, listos para cargar:

| ID | Nombre completo | Puesto | Horario |
| --- | --- | --- | --- |
| EJ-001 | Mariana Torres Hernández | Coordinadora de operaciones | Lunes a viernes, 08:00–16:00 |
| EJ-002 | Diego Ramírez López | Auxiliar de almacén | Lunes a viernes, 09:00–17:00 |

El cliente no aprueba solicitudes en esta pantalla. El flujo acordado es:
cliente solicita, equipo operador aprueba y cliente recibe empleados listos
para cargar. Los ejemplos no crean empleados, horarios ni aprobaciones en el
servidor. Ese circuito requiere contrato, permisos y persistencia backend.

### Cargar y consultar

Selecciona un empleado, pulsa «Cargar tarjeta», revisa sus datos y confirma.
Acerca la tarjeta y mantenla inmóvil. Si ya se consultó una tarjeta en esa
vista, se exige el mismo UID internamente. La pantalla muestra espera,
detección/lectura, escritura y verificación, con indicador de actividad.
Después de 20 segundos sin detección se cancela la confirmación y se informa
que no se detectó tarjeta; hay que confirmar de nuevo. Salir cancela la espera.

La escritura física sólo se confirma tras releer y comparar todos los bytes.
La lista distingue «Listo para cargar» de una carga verificada en este teléfono.
«Leer tarjeta y validar datos» abre una consulta física posterior, independiente
de los datos de la lista. Muestra sólo los datos del empleado y estados de
operación: área vacía, carga incompleta o imposibilidad de lectura. No presenta
identificadores técnicos ni respuestas JSON sin interpretar.

### Borrar para reutilizar

Primero acerca la tarjeta a la pantalla de empleados para identificarla.
Pulsa «Borrar datos Zenit», revisa la advertencia, confirma y acerca la misma
tarjeta. El borrado elimina el área reservada, incluso datos ajenos cuando
se confirma expresamente. Sólo después de verificar que quedó vacía se
elimina la asignación local y se permite cargar otro empleado. No da de baja
al empleado ni revoca o elimina asignaciones del servidor.

La carga ordinaria rechaza datos desconocidos y tarjetas asignadas localmente
a otro empleado; informa que se necesita borrado explícito para reutilizarlas.
Un fallo de clave, permisos o compatibilidad no se resuelve borrando: la
operación se detiene y se muestra un mensaje sencillo para solicitar ayuda.

### Alcance técnico y límites

La implementación usa `MifareClassic` con la clave A de fábrica, gestionada
internamente. Otra clave requiere configuración técnica posterior; no se
buscan ni recuperan claves. Se autentican y leen todos los bloques previstos
antes de modificar datos. Se requiere Classic de 1 KB y soporte del teléfono.

Formato privado, no NDEF: 24 bloques de datos de los sectores 1 a 8, 384 bytes,
cabecera versionada de 16 bytes con longitud y CRC32, JSON UTF-8 y relleno cero.
Nunca se escriben sector 0, trailers, claves ni permisos. La sobrescritura
reemplaza esa área sin borrar antes. El borrado escribe ceros sólo en esa área,
no en todo el chip. Una cabecera provisional permite reconocer una operación
incompleta; la escritura de múltiples bloques no es atómica. Si se retira la
tarjeta, no se informa éxito y hay que volver a consultar/reintentar.

El contenido puede copiarse: CRC32 detecta daños, no acredita autenticidad, y
la clave de fábrica no protege datos personales. No hay asociación de estas
credenciales con empleados del servidor ni captura autenticada de asistencia.
El bloqueo local de reasignación no sustituye autorización backend.

### Verificación del 20 de octubre de 2026

APK debug y APK de instrumentación compilados; lint aprobado y 13 pruebas
unitarias sin fallos. Cuatro pruebas del formato cubren UTF-8, capacidad en
bytes, relleno, exclusión de sector 0/trailers y detección de daños o escritura
incompleta. La versión final se instaló por Wi-Fi en Samsung SM-S928B sin borrar
datos. No se ejecutó instrumentación en esta revisión ni se repitió release.

El usuario reportó que no pudo sobrescribir una tarjeta; se añadió borrado
explícito y se aclaró el bloqueo de reasignación local. No se da por determinada
la causa física ni por validado el borrado. Siguen pendientes login/OTP dentro
de WebView, lectura/escritura/borrado con tarjetas y semana/acuse contra backend
publicado. La instalación y las pruebas unitarias no cierran esos recorridos.
