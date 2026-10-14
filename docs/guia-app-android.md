# Guía de la app Android

Qué tiene que hacer la app para enrolarse, identificarse, marcar, trabajar sin
conexión y mostrar la semana. Antes conviene leer
[Consumir el API](consumir-el-api.md).

Estado: el módulo `android/` implementa enrolamiento con bloqueo de pantalla,
clave P-256 en Android Keystore, aserciones y sobres ES256, captura NFC con
ubicación puntual, cola cifrada y sincronización por lotes con WorkManager.
Guarda los recibos cifrados y muestra el tipo decidido por el servidor; un
rechazo con recibo sale de pendientes y queda disponible para revisión.
Puede renovar la sesión y volver a enrolarse. Semana y acuse todavía no están
implementados.

La variante debug añade el botón «Ver presentación del producto». Abre una
actividad separada con el diseño, los históricos y el panel de Administrador/RH
descritos en [Producto móvil](alcance-producto-movil.md). Sus datos son locales
y no sustituyen la captura, los recibos ni la vinculación del flujo operativo.

Debug y release compilan; pasan 6 pruebas unitarias. El autoensayo pasó en un
Samsung SM-S928B con Android API 36: verifica firmas reales de Keystore,
migración sin pérdida, activación, persistencia, reintentos sin cambiar el
sobre, rechazo de recibos ajenos, recibos aceptados y rechazados, captura
durante una respuesta lenta y reenrolamiento que conserva los pendientes.
Ese ensayo usa un servidor HTTP de prueba y almacenamiento separado de la app;
no sustituye las pruebas contra el backend, una lectura NFC física ni una
muestra real de ubicación. La pantalla inicial también se abrió y revisó en
el teléfono.

La captura `uid_sha256` se habilita sólo en debug. Release exige HTTPS y no
permite marcar mientras la verificación de la tarjeta real siga pendiente.

Ese dispositivo simulado se puede leer y correr: está en
`backend/src/simulator/` y hace, contra el entorno local, la activación, la
aserción y el sobre firmado de cada marcaje. Sirve de referencia mientras la
app no lo haga. Cómo se corre está en
[Entorno local](entorno-local.md#llenar-el-entorno-con-el-simulador-de-dispositivo).

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

RH emite un código en el portal. Tiene la forma `K7M2-9QXD`, vale 15 minutos y
sirve una vez. La persona lo escribe en la app.

```http
POST /api/v1/device-activations
Content-Type: application/json
```

```json
{
  "enrollmentCode": "K7M2-9QXD",
  "publicKey": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" },
  "proof": "<JWS>",
  "device": { "manufacturer": "Ficticia", "model": "Modelo 1", "androidSdk": 34, "appVersion": "0.1.0" },
  "screenLock": true
}
```

- `proof` es un JWS firmado con la clave nueva, con cabecera
  `{"alg":"ES256"}` y carga `{"enrollmentCode":"K7M2-9QXD"}`. Demuestra que
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
