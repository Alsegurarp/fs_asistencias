# Consumir el API

Lo que es común a la app y al portal: credenciales, formato de errores,
páginas, idempotencia y recomendaciones. La referencia de cada ruta es
[`contracts/openapi.yaml`](../contracts/openapi.yaml).

## Lo básico

- Todas las rutas empiezan con `/api/v1`. En local: `http://localhost:8080`.
- Cuerpos en JSON, con `Content-Type: application/json`. La única excepción es
  la carga del padrón, que es `multipart/form-data`.
- Identificadores UUID. Instantes en RFC 3339 y UTC, como
  `2026-10-05T13:00:00Z`. Fechas locales como `2026-10-05`. Duraciones en
  minutos.
- Los valores enumerados y los códigos van en minúsculas con guion bajo.
- Un cuerpo con un campo que el contrato no describe se rechaza con 422.
- La empresa nunca se manda: sale de la credencial.

## Dos credenciales

| Quién | Credencial | Dónde sirve |
| --- | --- | --- |
| Una persona | Token de acceso del proveedor de identidad | Todas las rutas, menos las del dispositivo |
| Un dispositivo | Aserción que firma con su propia clave | Abrir sesión, marcar y mandar el lote |

Las dos viajan igual: `Authorization: Bearer <credencial>`. Cada una sólo sirve
en sus rutas; en las del otro responde 401. Dos rutas admiten cualquiera de las
dos, porque son del propio trabajador: `GET /me/attendance` y
`POST /week-closures/{closureId}/acknowledgements`.

`POST /device-activations` no lleva credencial: la autoriza el código de
enrolamiento. `GET /system/status` tampoco.

### Token de una persona

Lo emite el proveedor de identidad, con el flujo de código de autorización y
PKCE. El backend no ve contraseñas.

| Dato | Valor en local |
| --- | --- |
| Emisor | `http://localhost:8082/realms/zenit` |
| Autorización | `http://localhost:8082/realms/zenit/protocol/openid-connect/auth` |
| Token | `http://localhost:8082/realms/zenit/protocol/openid-connect/token` |
| Cliente | `zenit-portal`, público, con PKCE `S256` obligatorio |
| Retorno permitido | Cualquier ruta bajo la dirección del portal, `http://localhost:8081/*` |
| Alcance | `openid` |
| Audiencia del token | `zenit-api` |
| Vida del token de acceso | 5 minutos |

El token se renueva con su token de renovación antes de que venza. La sesión
termina tras 30 minutos sin actividad.

El backend acepta un token si su firma, su vigencia, su emisor y su audiencia
son correctos. Un rechazo no dice el motivo.

Cómo obtener uno a mano para probar está en
[Entorno local](entorno-local.md#obtener-un-token-para-probar).

### Aserción de un dispositivo

La describe paso a paso la [Guía de la app Android](guia-app-android.md).

## Saber quién soy

`GET /me` devuelve la persona, sus roles y su empresa. Es lo primero que llama
el portal después de iniciar sesión, y decide qué pantallas mostrar.

```json
{
  "userId": "a3c5e7b9-1d3f-4b5a-9c7e-1b3d5f7a9c1e",
  "displayName": "Persona de Recursos Humanos",
  "roles": ["rh"],
  "tenant": {
    "id": "7f2c1d9e-4b3a-4c5d-8e6f-0a1b2c3d4e5f",
    "name": "Panificadora Ejemplo",
    "timeZone": "America/Mexico_City",
    "weekStartsOn": "monday",
    "breakPolicy": "not_considered"
  },
  "employeeId": null
}
```

Una cuenta que todavía no pertenece a ninguna empresa recibe `tenant` nulo y
sin roles. `employeeId` trae la fila del padrón de quien también es
trabajador.

## Errores

Todo error llega como `application/problem+json`:

```json
{
  "type": "https://zenit.invalid/problems/validation",
  "title": "Datos no válidos",
  "status": 422,
  "code": "validation",
  "correlationId": "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
  "errors": [
    { "field": "radiusMeters", "code": "out_of_range", "message": "Debe estar entre 20 y 2000." }
  ]
}
```

- `code` es estable: es lo que el cliente compara. `title`, `detail` y
  `message` son para leer y pueden cambiar de redacción.
- `correlationId` identifica la petición en los registros del servidor. Hay
  que mostrarlo o guardarlo cuando algo falla: es lo que permite encontrarla.
- `errors` viene en los 422 y dice qué campo falló y por qué.

| Estado | Qué significa | Qué hacer |
| --- | --- | --- |
| 401 | Falta la credencial, venció o no sirve en esa ruta | Renovar el token e intentar una vez; si persiste, volver a iniciar sesión. Trae `serverTime` |
| 403 | La persona no tiene un rol que permita eso | No reintentar; ocultar la acción |
| 404 | No existe, o es de otra empresa | No reintentar |
| 409 | El estado actual no lo permite; `code` dice por qué | Recargar el recurso y mostrar el motivo |
| 410 | Ya no está disponible: un código gastado, un exporte descargado o vencido | Pedirlo otra vez |
| 422 | El cuerpo, un filtro, el cursor o el límite no son válidos | Corregir lo que dice `errors` |
| 429 | Demasiadas peticiones | Esperar y reintentar con pausa creciente |
| 5xx | Falla del servidor | Reintentar con pausa creciente; guardar el `correlationId` |

Un 404 no distingue «no existe» de «es de otra empresa», a propósito.

Los códigos de 409 y 410 están en el [Diccionario](diccionario.md#códigos-de-error).

## Listas y páginas

Las listas se recorren con cursor:

```http
GET /api/v1/employees?limit=50
GET /api/v1/employees?limit=50&cursor=<nextCursor de la respuesta anterior>
```

- `limit` va de 1 a 200; por omisión, 50.
- La respuesta trae `items` y `nextCursor`. Cuando `nextCursor` es nulo, no hay
  más.
- El cursor es opaco: no se construye ni se interpreta. Uno inválido responde
  422.
- Los filtros se mandan igual en cada página.

## Idempotencia

Tres operaciones piden la cabecera `Idempotency-Key` con un UUID que genera el
cliente: marcar, cargar el padrón y pedir un exporte.

- La misma clave con el mismo contenido devuelve el mismo resultado, sin
  repetir el efecto. Sirve para reintentar sin miedo cuando se cae la red.
- La misma clave con otro contenido responde 409 `idempotency_conflict`.
- La clave se genera una vez por intención del usuario y se conserva entre
  reintentos. Generar una nueva en cada reintento anula su propósito.

Cerrar una semana no lleva clave, pero también es repetible: quien ya está
cerrado no cambia.

## Fechas y zonas horarias

- El servidor responde instantes en UTC. Mostrarlos en la zona de la empresa,
  que viene en `tenant.timeZone`, no en la del navegador.
- Donde se pide una semana, sirve cualquier fecha de esa semana: el servidor
  la ajusta al día en que la empresa empieza su semana. La respuesta trae el
  inicio real en `weekStart`.
- Un turno que cruza la medianoche pertenece al día en que empezó.

## Generar un cliente

El contrato se probó generando un cliente Kotlin y los tipos de TypeScript, y
los dos compilan. Ninguno se ha ejecutado contra el servidor.

```powershell
# Tipos de TypeScript
docker run --rm -v "${PWD}/contracts:/spec:ro" -v "${PWD}/web/src/api:/out" -w /out node:24.21.0-alpine3.24 npx --yes openapi-typescript@7.13.0 /spec/openapi.yaml -o schema.d.ts

# Cliente Kotlin, con Retrofit y kotlinx.serialization
docker run --rm -v "${PWD}/contracts:/spec:ro" -v "${PWD}/salida:/out" openapitools/openapi-generator-cli:v7.26.0 generate -i /spec/openapi.yaml -g kotlin -o /out --library jvm-retrofit2 --additional-properties=serializationLibrary=kotlinx_serialization,packageName=mx.fastsolution.zenit.api
```

En Kotlin hay que excluir `infrastructure/ApiClient.kt` con un archivo
`.openapi-generator-ignore`: el contrato declara dos credenciales de tipo
bearer y el generador duplica su ayudante. No hace falta, porque la app firma
su propia aserción con un interceptor.

Las carpetas de salida de esos comandos son un ejemplo: cada aplicación decide
dónde guarda lo generado. Las dos herramientas se corrieron con esas versiones
y esas opciones desde una terminal de tipo Unix; la forma exacta de escribir
las rutas en PowerShell no se probó.

## Recomendaciones de uso

- **Comparar por `code`, nunca por el texto.** Los textos cambian.
- **Tolerar lo que no se conoce.** Un campo nuevo en una respuesta, o un
  código de alerta nuevo, no debe romper al cliente. El contrato puede crecer.
- **No decidir en el cliente lo que decide el servidor.** El tipo de marcaje,
  el veredicto de ubicación y los totales de la jornada los da el servidor.
  Mostrar lo que responde, no recalcularlo.
- **No suponer el estado después de escribir.** Tras un 409, volver a leer el
  recurso.
- **Reintentar sólo lo que se puede.** Lecturas, y escrituras con clave de
  idempotencia. Un rechazo de marcaje con recibo no se reintenta nunca.
- **Pausa creciente y con tope** en 429 y 5xx.
- **Guardar el `correlationId`** de cada error junto a lo que el usuario
  estaba haciendo.
- **No registrar credenciales.** Ni el token, ni la aserción, ni el sobre
  completo de un marcaje en los registros del cliente.
- **Ocultar por rol, y aun así esperar el 403.** El portal oculta lo que la
  persona no puede hacer, pero la autoridad es el servidor.
- **Mostrar los instantes en la zona de la empresa.**

## Qué cambia sin aviso y qué no

El contrato va en la versión 0.9: está completo para el recorrido del
producto, pero todavía no está congelado.

- No se quita ni se renombra un campo, un valor o una ruta sin subir la
  versión y avisar.
- Sí pueden agregarse rutas, campos opcionales, códigos de alerta y códigos de
  error.
- Las pruebas del backend comparan cada respuesta con el contrato: lo que el
  contrato dice es lo que el servidor responde.
