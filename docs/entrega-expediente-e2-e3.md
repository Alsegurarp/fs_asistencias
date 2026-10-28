# E2/E3 — Permiso y preparación del expediente empresarial

**Seguimiento del 28 de octubre:** la
[PR #20](https://github.com/Alsegurarp/fs_asistencias/pull/20) ya se integró
en `main/fa2396d`; cuatro trabajos de CI aprobados tanto en la
[PR](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40541212345)
como en [main](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40554372464).
Se recontaron los XML locales: 60 unitarias y 83 integraciones sin fallos,
errores u omisiones. No se repitieron pruebas ni se acredita despliegue.
El acta siguiente conserva el estado y los límites del momento de entrega.

Entrega local del 27 de octubre de 2026, en
`feat/expediente-e2-e3`, sobre el árbol E1 integrado mediante PR #19.
E2 y E3 quedan implementadas y verificadas en su alcance técnico.
E4 (MFA/autorización/descarga), E5 (portal) y E6 conservan sus pendientes.
Publicada en la [PR #20](https://github.com/Alsegurarp/fs_asistencias/pull/20)
contra `main`, abierta y sin integrar. Commit funcional
`15fa11cfcbf40155c4834ea09eebc252d629dd98`; el seguimiento posterior sólo
actualiza documentación. [CI de la PR](https://github.com/Alsegurarp/fs_asistencias/pull/20/checks)
en curso al publicar, sin atribuirle aprobación. No se desplegó en el servidor público.

## Qué se implementó

- Permiso `dossier_download` explícito, sin herencia de roles. La
  concesión/revocación es idempotente y auditada, y se liga al subject y fecha
  de vínculo de la cuenta activa. Sólo administración de esa empresa lo gestiona.
- Cada operación revalida empresa, cuenta, roles y permiso contra PostgreSQL.
  La solicitud fija propietario, subject y vínculo; otro usuario de la misma
  empresa tampoco puede consultarla. Desvincular/revincular no transfiere el
  permiso ni permite acceder a un expediente de la cuenta anterior.
- V009 añade `dossier_permission`, `dossier`, `dossier_chunk` y una versión
  de acceso en `tenant_user`. El permiso cambia de versión al conceder/revocar;
  los cambios de cuenta/estado/vínculo incrementan la versión de acceso.
  Son datos para invalidar las futuras pruebas E4, no una implementación de MFA.
- Solicitud idempotente por empresa/usuario/UUID. Un solo trabajo prepara
  el ZIP formato 1, con las 23 colecciones explícitas, históricos, ajustes,
  acuses, evidencia disponible, instrucciones y manifiesto original.
- Instantánea PostgreSQL `REPEATABLE READ`, cursor de 256 filas y ZIP escrito
  en bloques de hasta 65 536 bytes. No se genera un ByteArray del archivo
  completo ni se escriben temporales del expediente en disco del backend.
  El almacenamiento por bloques comparte la transacción: un fallo revierte
  también todos los bloques incompletos.
- Publicación atómica de archivo, manifiesto y SHA-256. Caduca exactamente
  24 horas después de crearse; el mantenimiento elimina los bloques vencidos
  y conserva manifiesto/huellas si se generaron. No elimina evidencia de origen.
- El API vigente pasa a 0.14.0 con cinco operaciones nuevas y respuestas
  `Cache-Control: no-store`. Las otras tres operaciones candidatas siguen
  cerradas hasta E4. Los CSV semanales conservan rutas y permisos.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/v1/me/dossier-permission` | Permiso explícito propio |
| PUT | `/api/v1/users/{userId}/dossier-permission` | Concesión/revocación por administración |
| POST | `/api/v1/dossiers` | Solicitud; 202 y estado inicial |
| GET | `/api/v1/dossiers/{dossierId}` | Estado, vencimiento y huellas propias |
| GET | `/api/v1/dossiers/{dossierId}/manifest` | Bytes originales del manifiesto propio |

Los cuerpos se ajustan al contrato: un booleano como texto, campos extra,
versiones incorrectas y UUID de idempotencia no canónicos se rechazan.
El número JSON `1.0`, equivalente a 1 según JSON Schema, conserva el formato 1.

## Pruebas finales

| Comprobación | Resultado |
| --- | --- |
| Build backend, simulador y unitarias | **60 pruebas, 0 fallos, 0 errores, 0 omitidas**; cuatro nuevas `DossierArchiveTest` |
| Integración completa con PostgreSQL real | **83 pruebas, 0 fallos, 0 errores, 0 omitidas**; ocho nuevas historias `DossiersIT` |
| Contrato activo y candidato | Ambos válidos con el lint existente; cobertura exacta de rutas y respuestas aprobada |
| Cobertura de contrato | 2 087 respuestas y 866 cuerpos de petición comprobados en 67 operaciones |
| Regresión | Suite existente completa, incluidos CSV semanal, jornada, identidad, cuotas y roles SQL |

Las unitarias verifican columnas cerradas de las 23 colecciones, orden por
colección, archivo/UTF-8/inventario, conteos, SHA-256, límites de bloques y
exclusión de propiedades privadas de JWK y metadata no permitida.

Las integraciones usan HTTP, tokens JWT firmados y JWKS de ensayo, resolución
real de identidad/roles, PostgreSQL y trabajador reales. No sustituyen una
prueba de MFA E4 con Keycloak ni un recorrido visual E5.

### Historia de Ana: de la concesión a la revocación

1. Administración registra sede, personas, tarjetas y dispositivos ficticios;
   llegan marcajes reales del simulador de captura firmado.
2. Se resuelve una incidencia con motivo y ajuste. Un cierre recibe objeción,
   se reabre y una nueva versión recibe conformidad. Una corrida conserva el
   bloqueo de otra persona que tiene un tramo abierto.
3. Ana, con rol RH, intenta solicitar expediente: **403** sin permiso.
   Administración se lo concede explícitamente y repetir la concesión no
   duplica la auditoría.
4. Ana solicita el expediente: **202 queued**. Repetir la clave devuelve la
   misma solicitud y deja un solo trabajo. El manifiesto todavía responde **409**.
5. El trabajador prepara el archivo: **ready**. Se comprueban ZIP, esquema de
   cada registro, empresa, conteos, huellas y conservación byte a byte de
   sobres/snapshots, así como cierres reabiertos, ajustes y ambos acuses.
6. Un compañero con permiso y otro administrador de otra empresa reciben
   **404** al consultar el expediente de Ana.
7. Administración revoca el permiso: Ana recibe **403** al consultar, pedir
   otro expediente o recuperar el manifiesto ya preparado. La versión del
   permiso aumenta; conceder otra vez no reutiliza su versión anterior.
8. La ruta de descarga sigue **403**: no se introduce un acceso que omita E4.

### Otras historias comprobadas

| Historia | Resultado comprobado |
| --- | --- |
| Roles y credenciales | Ninguno de los cinco roles hereda permiso; todos pueden recibirlo explícitamente. Sólo administración concede/revoca. Operador y dispositivo no entran. Invitar no equivale a vincular una cuenta |
| Cambio de cuenta | Deshabilitar o suspender bloquea acceso. Cambiar el subject/vínculo exige nueva concesión y solicitud; el usuario anterior no recupera el archivo |
| Concurrencia | Seis solicitudes simultáneas con la misma clave dejan una solicitud/trabajo. Una escritura confirmada durante la preparación en dos colecciones queda fuera de ambas en el mismo corte |
| Caducidad y errores | Caducado en cola no genera archivo. Caducado listo elimina bloques, conserva manifiesto y audita una sola vez. Un fallo no publica bloques parciales; un reintento válido toma otra instantánea y publica una sola vez |
| Integridad SQL | FK rechazan permisos/bloques de empresa ajena. El rol de aplicación no puede cambiar el destinatario, borrar solicitudes ni eliminar evidencia original |

### Perfiles anuales

Cada perfil conserva dos marcajes diarios durante 365 días. Los datos de
capacidad se cargan por SQL con sobres **ficticios** identificados como tales;
miden preparación/lectura, no autenticidad de captura ni hardware NFC.

| Empleados | Marcajes | ZIP final (bytes) | Preparar y verificar localmente |
| --- | --- | --- | --- |
| 50 | 36 500 | 6 343 631 | 2 557 ms |
| 300 | 219 000 | 41 298 742 | 15 517 ms |

Se recorrieron todas las líneas sin cargar el ZIP completo, comparando empresa
y conteos de las 23 colecciones. Todos los bloques quedaron dentro del límite
de 64 KiB. Los tiempos incluyen preparación y lectura/verificación local del
ZIP de prueba; no son objetivos ni medidas de producción ni una medición de
memoria máxima del proceso. La base desechable en tmpfs usa ahora un límite
de 2 GiB para conservar esos datos; el límite del servicio de producción no cambió.

## Reproducción y evidencia

```powershell
docker compose --profile tools run --rm contract-lint
docker compose --profile test run --rm --build backend-it
```

La segunda orden construye backend/simulador, ejecuta unitarias y después
la integración completa, incluidos los perfiles. Usa exclusivamente `db-it`;
se requieren los secretos locales de ensayo ya empleados por esta suite.

Evidencia local ignorada por Git: `build/e2-e3-final-results/test/`,
`build/e2-e3-final-results/integrationTest/`,
`build/e2-e3-integration-final.log` y `build/e2-e3-contract-final.log`.
Los dos directorios contienen los XML finales; los resultados anteriores
fallidos se conservan por separado y no se presentan como validación final.
Se retiraron el contenedor de validación y la base desechable `db-it` después
de recuperar esa evidencia; sus datos eran exclusivamente ficticios.

Se corrigieron durante las pruebas las conversiones SQL de timestamptz y
las coerciones escalares de Jackson en los dos cuerpos nuevos; no se relajó
el contrato ni se cambió globalmente el comportamiento de los otros endpoints.

## Modelo del proyecto y límites

- [Jerarquía general en PlantUML](dbFlow/01-jerarquia.puml).
- [Entidades, relaciones y cardinalidades en PlantUML](dbFlow/02-relaciones.puml).

Los diagramas cubren las 32 tablas de negocio V001–V009 y distinguen Keycloak,
persistencia Android, referencias lógicas y claves foráneas.
Ambos pasaron la comprobación de sintaxis y se renderizaron con PlantUML
1.2026.8; las vistas SVG quedan en `build/dbFlow/`. Se comprobaron las 32
tablas en los dos diagramas, 235 enlaces locales en 11 documentos y el diff
en el corte inicial de validación.

### Corrección de compatibilidad de `02-relaciones.puml`

Se reprodujo la excepción con **PlantUML 1.2025.10**, empleado por la extensión
**Plan UML 0.0.8**. La sintaxis era válida, pero `left to right direction`
provocaba `java.lang.IllegalStateException` en `smetana.core.JUtils.qsort`,
durante `mincross.restore_best`. La comprobación inicial sólo con 1.2026.8
no detectaba ese fallo; retirar el trazado ortogonal tampoco lo resolvía.

Se conserva Smetana y la orientación vertical predeterminada, sin añadir una
dependencia de Graphviz ni modificar la configuración del editor. Se verificó
el archivo corregido con **1.2025.10 y 1.2026.8**, tanto en SVG como en PNG,
con las **32 entidades y 52 relaciones originales** y sus cardinalidades.
El comentario del `.puml` documenta por qué no debe forzarse la orientación
horizontal en ese grafo.

El proceso 1.2025.10 devolvía código cero aun al imprimir la excepción: la
validación incluyó stderr y el contenido del SVG, además de la revisión
visual del PNG. Los resultados de 1.2025.10 están en `build/dbFlow-2025/`;
los de 1.2026.8, en `build/dbFlow/`. Son resultados locales ignorados por Git.
Esta corrección sólo afecta al diagrama; las 60/83 pruebas de negocio
conservan la evidencia de la implementación E2/E3 sin atribuirles otra ejecución.

Antes de preparar la PR se compararon por SHA-256 los **90 archivos de
`backend/src/`** con la imagen que aprobó esas pruebas: coinciden byte por
byte. Se comprobaron además **281 enlaces locales/anclas de 14 documentos**,
el diff y el renderizado de ambos modelos, con la comprobación adicional de
1.2025.10 para el diagrama de relaciones. No se repitieron pruebas de negocio
por los cambios posteriores de documentación.

No se implementaron E4/E5/E6, descarga ni purga. Se conserva el formato 1 y
sus limitaciones de evidencia ausente. No se verificaron servidor público,
teléfono, aceptación jurídica ni CI remoto de estos cambios. Los cambios
previos/generados de `backend/bin/` quedan fuera de esta entrega. Esta entrega
local no cierra los 17 pendientes globales ni los seis P0 documentados.
