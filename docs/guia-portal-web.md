# Guía del portal web

Qué tiene que hacer el portal: iniciar sesión, saber qué mostrar a cada rol y
contra qué ruta va cada pantalla. Antes conviene leer
[Consumir el API](consumir-el-api.md) y [Casos de uso](casos-de-uso.md).

Estado: el módulo `web/` implementa inicio de sesión con el adaptador oficial
`keycloak-js`, PKCE S256, tokens en memoria, renovación y cierre de sesión.
Consulta `/me` y ofrece sedes (alta y edición), empleados (alta y edición) y
tarjetas (registro, asignación y revocación), con permisos por rol y listas
con cursor. Incluye estados de carga, errores de campos y referencia de
correlación. La compilación y las pruebas del cliente pasan; todavía falta
probar el recorrido completo contra Keycloak y el backend real.

La navegación de Incidencias, Cierres y Exportes respeta los roles de `/me`.
Incidencias ya tiene listado, filtros, detalle, semana del empleado,
asignación y resolución con los tres tipos de ajuste. Cierres ya permite
consultar, cerrar, reabrir y seguir corridas; Exportes permite solicitar CSV,
consultar su preparación y descargar archivo y manifiesto.
El supervisor ve Incidencias y Cierres;
el auditor también ve Exportes. El administrador y RH ven las tres secciones.
Los permisos de resolver, cerrar y reabrir se distinguen en `permissions()`;
el servidor sigue siendo quien autoriza cada operación.

El cliente compartido de `web/src/api.ts` admite una clave de idempotencia
como cuarto argumento: `api('/exports', 'POST', pedido, clave)`. Quien crea
la solicitud genera la clave una vez y conserva ese valor al reintentar.
`apiDownload('/exports/<id>/download')` devuelve el `blob` y el nombre del
archivo indicado por el servidor, sin interpretar el CSV como JSON. Ambos
caminos renuevan la credencial y conservan los errores de campos y la
referencia de correlación; las descargas no se reintentan automáticamente.
Las peticiones autenticadas no admiten redirecciones ni caché HTTP.

Para desarrollar el portal fuera de Docker: `cd web`, `pnpm install` y
`pnpm dev`. Usa `http://localhost:8081`, la misma dirección de retorno que el
realm local permite, y envía `/api` a `http://localhost:8080`. El proveedor
de identidad sigue en `http://localhost:8082`. Al recargar la página se vuelve
a pulsar «Iniciar sesión»: los tokens no se guardan; Keycloak conserva su
sesión y decide si hace falta pedir credenciales otra vez.

`VITE_IDENTITY_URL` permite cambiar la dirección de identidad en desarrollo.
Para otro ambiente, también debe ajustarse el origen permitido en `connect-src`
de `web/nginx.conf`, el realm y las direcciones del backend; la configuración
de Docker actual está preparada para el entorno local.

Comprobaciones del portal: `pnpm build` y `pnpm test` desde `web/`.

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
| Suspender y reactivar | `POST /tenants/{tenantId}/suspension`, `POST /tenants/{tenantId}/reactivation` |

Suspender y reactivar piden un motivo, que queda en la bitácora de la empresa.
Conviene pedir confirmación: al suspender, toda su gente y sus dispositivos
pierden el acceso en ese momento.

### Empresa y acceso (administrador)

| Pantalla | Rutas |
| --- | --- |
| Datos de la empresa | `GET /tenant`, `PATCH /tenant` |
| Personas con acceso | `GET /users`, `POST /users`, `GET /users/{userId}`, `PATCH /users/{userId}`, `POST /users/{userId}/unlink` |
| Bitácora | `GET /audit-log` |

Al dar de alta una empresa hay que pedir su política de descanso: si la comida
se marca o no se considera. Al invitar a un trabajador, ligarlo a su fila del
padrón con `employeeId`; sin esa liga no podrá ver su semana en el portal.

En los datos de la empresa va el cierre programado, `autoCloseAfterHours`:
un interruptor y un número de horas, de 1 a 168. Apagado se manda `null`.
Explicar ahí que el sistema pasa una sola vez por semana y que cierra sólo a
quien no tiene nada pendiente.

«Soltar la liga» (`unlink`) es para la persona que perdió su cuenta y volvió
con otra del mismo correo. No es la forma de quitarle el acceso a alguien:
para eso está `disabled`. Conviene decirlo en la propia pantalla.

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
| Corridas de cierre | `POST /week-closure-runs`, `GET /week-closure-runs`, `GET /week-closure-runs/{runId}` |
| Reglas laborales | `GET /rule-sets` |
| Exportes | `POST /exports`, `GET /exports/{exportId}`, `GET /exports/{exportId}/download`, `GET /exports/{exportId}/manifest` |

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

Implementado en `web/src/Incidents.tsx`. Las listas usan cursor y los filtros
por estado, tipo, sede y fecha de la semana reinician la paginación. Se
consultan los nombres de empleado y sede; las fechas se muestran en la zona
de la empresa, sin recalcular los totales de jornada del backend.

El detalle permite elegir la semana: la fecha de apertura de una incidencia
no necesariamente es la del marcaje, especialmente en sincronización tardía.
La semana consultada muestra los tramos, alertas, totales e incidencias
pendientes. Los marcajes se cargan por páginas; si el relacionado no aparece,
se indica que hay que cargar más o elegir otra semana. Los ajustes de excluir
y cambiar tipo sólo seleccionan marcajes reales cargados de ese empleado,
sin utilizar identificadores sintéticos de ajustes anteriores.

Administrador, RH y supervisor pueden autoasignarse y quitar la asignación;
el administrador puede elegir otra persona con acceso vigente. RH, supervisor
y auditor no consultan `/users`, porque esa ruta sólo admite administradores.
Un responsable ajeno se muestra como «Otra persona de la empresa» cuando no
se tiene permiso de consultar su nombre.

Al agregar un marcaje se introduce la hora en la zona de la empresa y se envía
el instante UTC. Una hora inexistente por cambio horario no se admite; si
se repite, hay que elegir la primera o segunda ocurrencia. La resolución
conserva el motivo ante errores y muestra la referencia de correlación. Si
otra persona ya resolvió, se recarga el detalle y se retiran los controles;
si la semana está cerrada, se pide que el administrador la reabra. Resolver
actualiza la lista y vuelve a consultar la semana del empleado.

Una incidencia abierta de marcaje faltante, con un tramo de trabajo sin salida,
muestra **Agregar salida faltante** antes del resumen semanal. El botón prepara
«Ajustar jornada → Agregar marcaje → Salida» y enfoca la fecha y hora; no
inventa la hora ni guarda sin motivo. Justificar o confirmar una incidencia
no agrega la salida y puede dejar la semana bloqueada.

Verificado con pruebas de formularios y eventos React en jsdom, además de
pruebas de payloads y zonas horarias. El PMO verifica el recorrido contra el
backend real; estas pruebas usan respuestas simuladas.

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

Implementado en `web/src/Closures.tsx`. La consulta usa una fecha de la semana
y, opcionalmente, un empleado, con cursor. El API no filtra esta lista por
sede: la sede sirve para filtrar la selección de empleados y para definir
el alcance de una corrida. Se muestran todas las versiones, incluidas las
reabiertas; el detalle conserva los totales de esa versión, sus reglas,
huella, autor y acuse. Un autor nulo se identifica como cierre programado.

Administrador y RH pueden cerrar; supervisor y auditor sólo consultan.
Sólo el administrador puede reabrir, con motivo de 10 a 500 caracteres. Una
selección vacía no se envía, para que nunca se interprete como cerrar toda la
empresa. El cierre directo admite de 1 a 500 empleados; una sede es opcional.
Los campos y el cierre del diálogo se deshabilitan durante la petición.
Los errores conservan la selección y muestran la referencia de correlación.

El resultado separa cierres vigentes y bloqueados. Cada incidencia ligada a
un bloqueo abre su detalle con la semana correspondiente en Incidencias.
Si el tramo procede de un ajuste sin marcaje original, puede no haber una
incidencia ligada: el portal lo explica y no inventa una corrección.

1. Elegir la semana y, opcionalmente, una sede.
2. `POST /week-closures`. La respuesta separa `closed` y `blocked`.
3. Para cada bloqueado, llevar a lo que falta: sus incidencias vienen en
   `incidentIds`.
4. Repetir el cierre: no duplica nada.

Un 422 con el error `week_not_finished` quiere decir que la semana todavía no
termina.

### Toda la empresa: la corrida de cierre

La pantalla lista las corridas de la semana, con origen, sede, estado y
conteos. El detalle sigue las pendientes cada cinco segundos y se detiene
al terminar, fallar o recibir un error; un error permite reintentar el
seguimiento. Al terminar se actualizan cierres, incidencias y jornadas.
Una corrida fallida permite solicitar otra con la misma semana y sede.
Los bloqueos enlazan las incidencias abiertas de ese alcance: el API entrega
conteos, no una lista nominal de empleados bloqueados.

La validación ejecutada y el guion de aceptación están en
[Validación de cierres](validacion-cierres.md).

`POST /week-closures` responde en la misma petición y admite hasta 500
personas. Para cerrar a toda la empresa conviene la corrida, que no tiene
tope y no hace esperar a la pantalla:

1. `POST /week-closure-runs` con la semana y, opcionalmente, una sede.
   Responde 202 con la corrida en `queued`.
2. Consultar `GET /week-closure-runs/{runId}` cada pocos segundos hasta `done`
   o `failed`. Mientras corre, `closed` y `blocked` avanzan por tandas: sirven
   para una barra de avance sobre `total`.
3. Al terminar, mostrar cuántas se cerraron y cuántas no. Para ver cuáles
   faltan: `GET /incidents?status=open&week=`.

- Mientras una corrida de esa semana y ese alcance no termina, pedirla otra
  vez devuelve la misma: el botón se puede oprimir dos veces sin daño.
- `failed` no deshace nada: lo que alcanzó a cerrar sigue cerrado. Se pide
  otra.
- `GET /week-closure-runs?week=` lista las corridas de una semana, también las
  que abrió el cierre programado, con `origin` en `scheduled`.
- Un cierre hecho por el sistema trae `closedBy` en nulo: mostrar «cierre
  programado» donde iría el nombre de quien cerró.

## Exportes

La pantalla implementada permite elegir una fecha de la semana y una sede
opcional, y solicitar un CSV. Conserva la clave de idempotencia al reintentar
un fallo; cambia la clave al modificar el pedido o tras una solicitud exitosa.
Consulta el estado cada cinco segundos mientras está en cola. Si la consulta
falla, pausa y ofrece **Actualizar estado**. Sólo habilita **Descargar CSV**
cuando está listo y descarga por el cliente autenticado, sin abrir una URL
con credenciales. Se puede solicitar otro archivo con **Solicitar CSV**.

Después de descargar, el backend informa `expired`, que se presenta como
«No disponible (usado o vencido)». El manifiesto sigue disponible y se guarda
como JSON. La pantalla muestra el SHA-256 informado por el servidor, pero
no comprueba automáticamente la huella del archivo ni del manifiesto.
No hay historial: el API no lista exportes y al abandonar la pestaña se
pierde la referencia del pedido en pantalla. No se persisten tokens ni archivos.

Verificación: 93 pruebas del portal y compilación correctas; pendiente el
recorrido manual de descarga con la sesión real. Para la demo, elegir
`2026-10-05`, dejar todas las sedes y comprobar cuatro filas en el CSV.

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
- El manifiesto (`GET /exports/{exportId}/manifest`) sigue disponible después
  de descargar. Sirve para comprobar un archivo guardado: su `fileSha256` debe
  ser el SHA-256 del archivo. Si la pantalla comprueba la huella del propio
  manifiesto contra `manifestHash`, debe calcularla sobre los bytes de la
  respuesta, sin pasarla antes por `JSON.parse`.
- El archivo es un CSV en UTF-8 que una hoja de cálculo abre con sus acentos.

## Listas

Todas las listas son paginadas con cursor. Usar «cargar más» o desplazamiento
continuo, no números de página: el API no da el total.

## Errores en pantalla

- 422: marcar cada campo con su `errors[].message`.
- 409: mostrar el motivo según `code` y recargar.
- 403: no debería ocurrir si el menú respeta los roles; si ocurre, avisar y
  volver a pedir `GET /me`, porque los roles pudieron cambiar.
- 429: la persona pasó su cuota de peticiones por minuto. Esperar y reintentar
  con pausa creciente; no reintentar en ciclo cerrado. Una pantalla que
  consulta el avance de algo debe hacerlo cada varios segundos, no sin pausa.
- En cualquier error, dejar a la vista el `correlationId`.

## Lista de comprobación

- [ ] Los tokens viven en memoria y se renuevan solos.
- [ ] El menú sale de los roles de `GET /me`.
- [ ] Las fechas se muestran en la zona de la empresa.
- [ ] La carga del padrón valida antes de aplicar.
- [ ] El código de enrolamiento se muestra una vez, con su vencimiento.
- [ ] Resolver una incidencia exige motivo.
- [ ] El exporte se descarga con credencial, no con un enlace.
- [ ] Cerrar a toda la empresa usa la corrida de cierre y muestra su avance.
- [ ] Un cierre sin `closedBy` se muestra como hecho por el cierre programado.
- [ ] Soltar la liga de una cuenta explica que no quita el acceso.
- [ ] Suspender una empresa pide motivo y confirmación.
- [ ] Ninguna pantalla recalcula lo que el servidor ya calculó.
