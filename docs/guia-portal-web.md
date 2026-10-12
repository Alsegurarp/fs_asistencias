# Guía del portal web

Qué tiene que hacer el portal: iniciar sesión, saber qué mostrar a cada rol y
contra qué ruta va cada pantalla. Antes conviene leer
[Consumir el API](consumir-el-api.md) y [Casos de uso](casos-de-uso.md).

Estado: el módulo `web/` es un esqueleto con React, TypeScript, Vite y MUI que
compila y consulta el estado del API. Todavía no inicia sesión ni tiene
pantallas. Nada de esta guía se ha probado desde el portal.

## Inicio de sesión

El portal no pide ni guarda contraseñas: manda a la persona al proveedor de
identidad y recibe un token. Es el flujo de código de autorización con PKCE,
que cualquier librería de OpenID Connect para navegador implementa.

| Dato | Valor en local |
| --- | --- |
| Emisor | `http://localhost:8082/realms/zenit` |
| Cliente | `zenit-portal` |
| Retorno | Una ruta del propio portal, por ejemplo `http://localhost:8081/retorno` |
| Alcance | `openid` |
| PKCE | `S256`, obligatorio |

La librería descubre el resto del emisor, en
`/.well-known/openid-configuration`.

Lo que hay que cuidar:

- El token de acceso vive 5 minutos. Renovarlo antes de que venza, con el
  token de renovación, sin que la persona lo note.
- Guardar los tokens en memoria. No en `localStorage`: cualquier script de la
  página podría leerlos.
- En su primera entrada, el proveedor le pide a la persona cambiar su
  contraseña temporal y configurar un segundo factor. Eso ocurre en las
  páginas del proveedor; el portal sólo espera el retorno.
- Al cerrar sesión, cerrarla también en el proveedor, con su ruta de fin de
  sesión.

Cada llamada al API lleva `Authorization: Bearer <token de acceso>`.

## Después de entrar

Lo primero es `GET /api/v1/me`:

| Respuesta | Qué mostrar |
| --- | --- |
| `tenant` nulo y sin roles | La cuenta existe pero nadie la ha invitado: una pantalla que lo explique |
| Rol `operador_saas` | Alta y lista de empresas; nada de los datos de una empresa |
| Roles de empresa | El menú que corresponde a sus roles, con el nombre de la empresa |

Una persona puede tener varios roles: el menú es la unión de lo que cada uno
permite. `tenant.breakPolicy` y `tenant.timeZone` se usan en todo el portal.

## Pantallas contra rutas

Las rutas van sin el prefijo `/api/v1`.

### Operador

| Pantalla | Rutas |
| --- | --- |
| Empresas | `GET /tenants`, `POST /tenants` |

### Empresa y acceso (administrador)

| Pantalla | Rutas |
| --- | --- |
| Datos de la empresa | `GET /tenant`, `PATCH /tenant` |
| Personas con acceso | `GET /users`, `POST /users`, `GET /users/{userId}`, `PATCH /users/{userId}` |
| Bitácora | `GET /audit-log` |

Al dar de alta una empresa hay que pedir su política de descanso: si la comida
se marca o no se considera. Al invitar a un trabajador, ligarlo a su fila del
padrón con `employeeId`; sin esa liga no podrá ver su semana en el portal.

### Configuración (administrador y RH)

| Pantalla | Rutas |
| --- | --- |
| Sedes | `GET /sites`, `POST /sites`, `GET /sites/{siteId}`, `PATCH /sites/{siteId}` |
| Horarios | `GET /schedules`, `POST /schedules`, `GET /schedules/{scheduleId}` |
| Padrón | `GET /employees`, `POST /employees`, `GET /employees/{employeeId}`, `PATCH /employees/{employeeId}` |
| Asignar horario | `POST /employees/{employeeId}/schedule-assignments` |
| Cargar padrón | `POST /imports/csv`, `GET /imports/{importId}` |
| Tarjetas | `GET /cards`, `POST /cards`, `POST /cards/{cardId}/assignments`, `POST /cards/{cardId}/revocation` |
| Dispositivos | `GET /devices`, `POST /device-enrollments`, `POST /devices/{deviceId}/revocation` |
| De dónde viene el padrón | `GET /integrations/checkpoints` |

Notas:

- Las sedes sólo las crea y cambia el administrador.
- Un horario no se edita: la pantalla ofrece crear otro, no modificar.
- La carga del padrón tiene dos pasos. Primero se sube el archivo sin
  `dryRun`, que sólo valida y devuelve cada fila rechazada con su línea; se
  muestra el resultado, y sólo si la persona confirma se sube otra vez con
  `dryRun=false`. Cada subida lleva su propia `Idempotency-Key`.
- El código de enrolamiento sólo aparece en la respuesta de
  `POST /device-enrollments`. Mostrarlo en grande, con su vencimiento; no se
  puede volver a consultar.
- La huella de una tarjeta se captura al registrarla y no vuelve en ninguna
  respuesta.

### Operación (administrador, RH, supervisor, auditor)

| Pantalla | Rutas |
| --- | --- |
| Marcajes | `GET /attendance-events` |
| Semana de una persona | `GET /employees/{employeeId}/attendance?week=` |
| Incidencias | `GET /incidents`, `GET /incidents/{incidentId}`, `PATCH /incidents/{incidentId}` |
| Cierres | `GET /week-closures`, `POST /week-closures`, `GET /week-closures/{closureId}`, `POST /week-closures/{closureId}/reopen` |
| Reglas laborales | `GET /rule-sets` |
| Exportes | `POST /exports`, `GET /exports/{exportId}`, `GET /exports/{exportId}/download` |

Notas:

- El auditor sólo lee: no ve los botones de resolver, cerrar ni reabrir.
  Exportar sí puede.
- El supervisor resuelve incidencias pero no cierra semanas.
- Sólo el administrador reabre un cierre, y debe escribir el motivo.
- La lista de marcajes trae el veredicto de ubicación y la precisión, nunca
  la coordenada.

### Trabajador

| Pantalla | Rutas |
| --- | --- |
| Mi semana | `GET /me/attendance?week=` |
| Mi cierre | `GET /week-closures/{closureId}`, `POST /week-closures/{closureId}/acknowledgements` |

Si la cuenta no está ligada a una fila del padrón, `GET /me/attendance`
responde 403: explicar que falta que su empresa lo ligue.

## La semana

La respuesta de la semana ya viene calculada. El portal la dibuja; no suma.

- `segments`: tramos de trabajo y de descanso, con inicio, fin y minutos. Uno
  con `endAt` nulo está abierto: mostrarlo como «sin salida».
- `totals`: minutos trabajados, de descanso, ordinarios y extraordinarios.
- `alerts`: avisos con gravedad `info`, `warning` o `critical`. Mostrar su
  `message`. Pueden aparecer códigos nuevos.
- `openIncidentIds`: lo que falta revisar de esa semana.
- `closure`: nulo si no se ha cerrado. Con estado `closed`, lo que se ve es lo
  congelado; con `reopened`, se está viendo el cálculo de ahora.

Mostrar siempre un aviso de que el cálculo es una referencia: sus topes no
tienen revisión jurídica.

## Incidencias

1. Lista con filtros: estado, tipo, sede y semana.
2. Detalle: tipo, gravedad, persona, sede, marcaje y, si ya se atendió, quién y
   por qué.
3. Resolver, con `PATCH /incidents/{incidentId}`:

```json
{ "resolution": { "decision": "justified", "reason": "El teléfono estuvo sin señal durante el turno." } }
```

```json
{
  "resolution": {
    "decision": "adjusted",
    "reason": "Olvidó marcar la salida; la confirma su supervisor.",
    "adjustment": { "kind": "add_event", "eventType": "clock_out", "occurredAt": "2026-10-05T21:00:00Z" }
  }
}
```

- El motivo es obligatorio, de 10 a 500 caracteres.
- Asignar es `{ "assigneeUserId": "<id>" }`; quitar la asignación,
  `{ "assigneeUserId": null }`.
- 409 `incident_already_resolved`: alguien más la resolvió; recargar.
- 409 `week_closed`: la semana está cerrada; hay que reabrirla antes de
  ajustar.

## Cierre

1. Elegir la semana y, opcionalmente, una sede.
2. `POST /week-closures`. La respuesta separa `closed` y `blocked`.
3. Para cada bloqueado, llevar a lo que falta: sus incidencias vienen en
   `incidentIds`.
4. Repetir el cierre: no duplica nada.

Un 422 con el error `week_not_finished` quiere decir que la semana todavía no
termina.

## Exportes

Pedir, esperar y descargar:

```ts
// Sin probar: ilustra el orden de las llamadas.
async function exportar(api: string, token: string, semana: string): Promise<Blob> {
  const cabeceras = { Authorization: `Bearer ${token}` };
  const clave = crypto.randomUUID(); // una por intención; se conserva al reintentar
  const pedido = await fetch(`${api}/exports`, {
    method: "POST",
    headers: { ...cabeceras, "Content-Type": "application/json", "Idempotency-Key": clave },
    body: JSON.stringify({ weekStart: semana, format: "csv" }),
  }).then((r) => r.json());

  let exporte = pedido;
  while (exporte.status === "queued") {
    await new Promise((listo) => setTimeout(listo, 2000));
    exporte = await fetch(`${api}/exports/${pedido.id}`, { headers: cabeceras }).then((r) => r.json());
  }
  if (exporte.status !== "ready") throw new Error(`Exporte ${exporte.status}`);

  // downloadUrl es relativa al servidor del API.
  const archivo = await fetch(new URL(exporte.downloadUrl, api), { headers: cabeceras });
  if (!archivo.ok) throw new Error(`Descarga ${archivo.status}`);
  return archivo.blob();
}
```

- La descarga pide la credencial: no se puede abrir el enlace en otra pestaña
  ni ponerlo en un `<a href>`. Se descarga con `fetch` y se entrega al
  navegador como archivo.
- El archivo se descarga una sola vez y vale quince minutos. Para tenerlo otra
  vez se pide otro exporte.
- 422 con el error `no_closed_weeks`: esa semana, o esa sede, no tiene cierres
  vigentes.
- `failed`: no se pudo preparar; pedirlo otra vez.
- El archivo es un CSV en UTF-8 que una hoja de cálculo abre con sus acentos.

## Listas

Todas las listas son paginadas con cursor. Usar «cargar más» o desplazamiento
continuo, no números de página: el API no da el total.

## Errores en pantalla

- 422: marcar cada campo con su `errors[].message`.
- 409: mostrar el motivo según `code` y recargar.
- 403: no debería ocurrir si el menú respeta los roles; si ocurre, avisar y
  volver a pedir `GET /me`, porque los roles pudieron cambiar.
- En cualquier error, dejar a la vista el `correlationId`.

## Lista de comprobación

- [ ] Los tokens viven en memoria y se renuevan solos.
- [ ] El menú sale de los roles de `GET /me`.
- [ ] Las fechas se muestran en la zona de la empresa.
- [ ] La carga del padrón valida antes de aplicar.
- [ ] El código de enrolamiento se muestra una vez, con su vencimiento.
- [ ] Resolver una incidencia exige motivo.
- [ ] El exporte se descarga con credencial, no con un enlace.
- [ ] Ninguna pantalla recalcula lo que el servidor ya calculó.
