# Recorrido completo

De una empresa nueva a un exporte, petición por petición. Sirve para conocer
el API y para dejar datos de prueba en el entorno local.

Las llamadas son las mismas que hacen las pruebas contra el entorno levantado.
Los comandos `curl` de abajo son esas llamadas escritas a mano: no se
ejecutaron tal cual.

## Antes de empezar

1. El entorno levantado, con `CAPTURE_SIMULATED_CARDS=true`:
   [Entorno local](entorno-local.md).
2. Dos cuentas en el proveedor de identidad: la operadora, cuyo correo está
   en `secrets/operator_emails`, y la que va a administrar la empresa.
3. Un token de cada una:
   [Obtener un token](entorno-local.md#obtener-un-token-para-probar).

En la terminal:

```bash
API=http://localhost:8080/api/v1
OPERADORA="<token de la operadora>"
ADMIN="<token de la administradora>"
```

Los tokens duran 5 minutos: hay que renovarlos durante el recorrido.

## 1. Dar de alta la empresa

```bash
curl -s "$API/tenants" -H "Authorization: Bearer $OPERADORA" -H "Content-Type: application/json" -d '{
  "name": "Panificadora Ejemplo",
  "slug": "panificadora-ejemplo",
  "timeZone": "America/Mexico_City",
  "weekStartsOn": "monday",
  "breakPolicy": "not_considered",
  "firstAdminEmail": "administradora@panificadora.example"
}'
```

`firstAdminEmail` es el correo de la cuenta de la administradora. Queda
invitada.

**Para poder cerrar una semana hoy mismo**, poner en `weekStartsOn` el día de
hoy, en inglés y en minúsculas. Así la semana anterior acaba de terminar y
todavía admite los marcajes de ayer. Con `monday` habría que esperar al lunes.

## 2. La administradora entra

```bash
curl -s "$API/me" -H "Authorization: Bearer $ADMIN"
```

En esta primera llamada su cuenta queda ligada a la invitación. La respuesta
ya trae la empresa y el rol `admin_empresa`.

## 3. Una sede

```bash
curl -s "$API/sites" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{
  "name": "Sucursal Centro",
  "timeZone": "America/Mexico_City",
  "latitude": 19.432608,
  "longitude": -99.133209,
  "radiusMeters": 80
}'
```

Guardar el `id`: es `SEDE` en lo que sigue.

## 4. Una persona del padrón

```bash
curl -s "$API/employees" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{
  "externalId": "E-001",
  "displayName": "Persona Uno",
  "siteId": "'"$SEDE"'",
  "employmentStart": "2026-01-05"
}'
```

Guardar el `id`: es `PERSONA`.

Para cargar muchas de una vez, un archivo con este encabezado:

```csv
external_id,display_name,employment_start,site_name
E-002,Persona Dos,2026-01-05,Sucursal Centro
```

```bash
# Sólo valida:
curl -s "$API/imports/csv" -H "Authorization: Bearer $ADMIN" -H "Idempotency-Key: <un UUID nuevo>" -F file=@padron.csv
# Aplica:
curl -s "$API/imports/csv" -H "Authorization: Bearer $ADMIN" -H "Idempotency-Key: <un UUID nuevo>" -F file=@padron.csv -F dryRun=false
```

## 5. Su tarjeta

```bash
curl -s "$API/cards" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{
  "label": "ZN-000001",
  "fingerprint": "3f5a7c9e1b3d4f5a8c7e9b1d3f5a7c9e"
}'
```

`label` es el número impreso. `fingerprint` es la huella con la que la app
reconoce la tarjeta; con la tarjeta simulada, es lo que la app manda como
prueba. Guardar el `id`: es `TARJETA`.

```bash
curl -s "$API/cards/$TARJETA/assignments" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{ "employeeId": "'"$PERSONA"'" }'
```

## 6. Un código para su teléfono

```bash
curl -s "$API/device-enrollments" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{ "mode": "personal", "employeeId": "'"$PERSONA"'" }'
```

La respuesta trae `code`, que sólo aparece aquí. Vale 15 minutos y una vez.

Para una terminal: `{ "mode": "terminal", "siteId": "<sede>", "label": "Recepción" }`.

## 7. Activar y marcar

Lo hace la app, no una persona: cada paso va firmado con la clave del
dispositivo. Está descrito en la
[Guía de la app Android](guia-app-android.md).

Mientras la app no lo haga, lo hace el simulador de dispositivo: da de alta
una sede, personas y tarjetas, activa sus teléfonos y manda marcajes firmados.
Sustituye los pasos 3 a 7 de este recorrido. Cómo se corre está en
[Entorno local](entorno-local.md#llenar-el-entorno-con-el-simulador-de-dispositivo).

Quien quiera ver cada paso en código tiene dos referencias que sí se
ejecutan: el propio simulador, en `backend/src/simulator/`, y la prueba
`backend/src/test/kotlin/mx/fastsolution/zenit/CaptureTestBase.kt`. Las dos
generan una clave, se activan, firman su aserción y firman cada sobre.

Lo que sigue supone que la persona ya tiene marcajes.

## 8. Ver los marcajes y la semana

```bash
curl -s "$API/attendance-events?from=2026-10-01T00:00:00Z&to=2026-10-31T00:00:00Z" -H "Authorization: Bearer $ADMIN"
curl -s "$API/employees/$PERSONA/attendance?week=2026-10-05" -H "Authorization: Bearer $ADMIN"
```

`week` admite cualquier fecha de la semana.

## 9. Atender las incidencias

```bash
curl -s "$API/incidents?status=open" -H "Authorization: Bearer $ADMIN"

curl -s -X PATCH "$API/incidents/$INCIDENCIA" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{
  "resolution": { "decision": "justified", "reason": "Entró por la puerta de la otra calle." }
}'
```

Para agregar una salida que faltó:

```bash
curl -s -X PATCH "$API/incidents/$INCIDENCIA" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{
  "resolution": {
    "decision": "adjusted",
    "reason": "Olvidó marcar la salida; la confirma su supervisor.",
    "adjustment": { "kind": "add_event", "eventType": "clock_out", "occurredAt": "2026-10-05T21:00:00Z" }
  }
}'
```

## 10. Cerrar la semana

```bash
curl -s "$API/week-closures" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{ "weekStart": "2026-10-05" }'
```

La respuesta separa `closed` de `blocked`. A quien quedó bloqueado se le
atiende lo pendiente y se repite la llamada.

Si responde 422 con el error `week_not_finished`, la semana todavía no
termina: ver la nota del paso 1.

Para toda la empresa, sin esperar la respuesta y sin tope de personas, se pide
una corrida y se consulta hasta que termina:

```bash
curl -s "$API/week-closure-runs" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{ "weekStart": "2026-10-05" }'
curl -s "$API/week-closure-runs/$CORRIDA" -H "Authorization: Bearer $ADMIN"
```

`CORRIDA` es el `id` de la primera respuesta. Al terminar dice cuántas
personas cerró y cuántas no, por motivo.

## 11. El acuse del trabajador

Con el teléfono personal de la persona, o con su cuenta ligada a su fila del
padrón. Para ligar una cuenta:

```bash
curl -s "$API/users" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{
  "email": "trabajadora@panificadora.example",
  "roles": ["trabajador"],
  "employeeId": "'"$PERSONA"'"
}'
```

Con el token de esa cuenta:

```bash
curl -s "$API/me/attendance?week=2026-10-05" -H "Authorization: Bearer $TRABAJADORA"
curl -s "$API/week-closures/$CIERRE/acknowledgements" -H "Authorization: Bearer $TRABAJADORA" -H "Content-Type: application/json" \
  -d '{ "type": "agreed" }'
```

El identificador del cierre viene en `closure.id` de la semana.

## 12. Exportar

```bash
curl -s "$API/exports" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: <un UUID nuevo>" -d '{ "weekStart": "2026-10-05", "format": "csv" }'
```

Guardar el `id`: es `EXPORTE`. Consultarlo hasta que `status` sea `ready`;
suele tardar un par de segundos.

```bash
curl -s "$API/exports/$EXPORTE" -H "Authorization: Bearer $ADMIN"
curl -s "$API/exports/$EXPORTE/download" -H "Authorization: Bearer $ADMIN" -o semana.csv
```

La descarga sirve una vez. La huella del archivo descargado tiene que
coincidir con `fileHash`:

```bash
sha256sum semana.csv
```

El manifiesto dice qué entró al archivo y de qué cierre salió cada fila. Se
puede pedir cuantas veces haga falta, también después de descargar:

```bash
curl -s "$API/exports/$EXPORTE/manifest" -H "Authorization: Bearer $ADMIN" -o manifiesto.json
sha256sum manifiesto.json
```

Esa huella tiene que coincidir con `manifestHash` del exporte, y el
`fileSha256` que trae adentro, con la del archivo.

## 13. Qué quedó registrado

```bash
curl -s "$API/audit-log?limit=50" -H "Authorization: Bearer $ADMIN"
```

Cada alta, asignación, resolución, cierre y descarga está ahí, con quién la
hizo.

## Si algo responde distinto

| Respuesta | Revisar |
| --- | --- |
| 401 | El token venció: dura 5 minutos |
| 403 | El rol de esa cuenta; para dar de alta la empresa, la lista de operadores |
| 404 | El identificador, o que el recurso sea de esa empresa |
| 409 | El `code` de la respuesta dice el motivo |
| 422 | El campo y el motivo vienen en `errors` |
| 429 | Demasiadas peticiones en un minuto: esperar |

Los códigos están en el [Diccionario](diccionario.md#códigos-de-error).
