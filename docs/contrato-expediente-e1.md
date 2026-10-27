# E1 — Contrato y formato del expediente empresarial

**Actualización local E2–E5 del 27 de octubre:** el API vigente 0.15.0
incorpora las ocho operaciones, incluido desafío, canje OIDC y descarga de
un uso. [E4/E5 verificadas](entrega-expediente-e4-e5.md) añaden el portal y
el cliente efectivo con OTP nuevo por operación. El formato 1 no cambia.
El contenido siguiente conserva el diseño y la evidencia originales de E1;
véase el [modelo actual](dbFlow/README.md). E6 sigue pendiente.

Contrato candidato `0.14.0-draft.1`, formato de archivo **1**, del 26 de
octubre de 2026. Implementa la definición E1 de la
[issue #18](https://github.com/Alsegurarp/fs_asistencias/issues/18), según las
[metas aprobadas](expediente-empresa.md). Las operaciones siguen pendientes
de implementación en E2–E5; no se habilita la descarga ni se cambia el API activo.

## Artefactos normativos y compatibilidad

- [Contrato candidato](../contracts/dossier.openapi.yaml): ocho operaciones,
  cuerpos, estados, errores, permiso y verificación por operación.
- [Esquema de formato 1](../contracts/dossier-format.schema.yaml): manifiesto,
  23 tipos de registro y lista cerrada de campos; datos adicionales se rechazan.
- [Manifiesto ficticio](../contracts/examples/dossier-v1/manifest.json),
  [registros](../contracts/examples/dossier-v1/records.ndjson) e
  [instrucciones](../contracts/examples/dossier-v1/README.txt): ejemplo íntegro
  de una empresa sin marcajes. Las huellas corresponden a sus bytes reales.

`contracts/openapi.yaml` sigue en 0.13.0: sus 62 operaciones, CSV, permisos y
consumidores no cambian. El candidato se integra por operaciones cuando su
implementación y seguridad existan, respetando la prueba de igualdad entre
rutas backend y contrato. El prefijo sigue siendo `/api/v1`. No hay endpoints
nuevos atendidos por esta entrega ni ampliación de permisos por rol.

El número de contrato candidato identifica esta revisión de diseño. Un cambio
de columnas, semántica de registros, codificación o inventario exige otra
versión de formato; no se reinterpreta un archivo 1 con reglas nuevas.
Los lectores rechazan versiones desconocidas; los archivos antiguos conservan
su versión y las instrucciones para consultarlos. Añadir implementación al
API no reescribe archivos, acuses ni cierres existentes.

## Operaciones y destinatario

| Método y ruta | Resultado | Autorización |
| --- | --- | --- |
| GET /me/dossier-permission | Estado explícito propio | Usuario activo de empresa; ningún rol implica enabled=true |
| PUT /users/{userId}/dossier-permission | Concesión/revocación explícita auditada | Administración de esa empresa. Puede asignarse a sí misma mediante esta acción explícita. Conceder exige destino activo/vinculado; revocar no |
| POST /dossiers | Solicitud asíncrona; 202 | Permiso dossier_download explícito |
| GET /dossiers/{dossierId} | Estado y huellas; 200 | Permiso vigente y solicitante propietario |
| GET /dossiers/{dossierId}/manifest | Bytes originales del manifiesto; 200 | Mismo permiso/propietario; no requiere nuevo MFA |
| POST /dossiers/{dossierId}/challenges | Inicio de MFA nuevo; 201 | Mismo permiso/propietario; archivo ready |
| POST /dossiers/{dossierId}/authorizations | Autorización opaca; 201 | Desafío y OIDC nuevos, correlacionados y consumidos |
| POST /dossiers/{dossierId}/download | ZIP; 200 | Bearer de sesión y autorización de un uso en el cuerpo JSON |

Empresa, usuario y vínculo salen del servidor. El expediente se vincula también
al subject OIDC resuelto, sin exportarlo; cambiar ese vínculo exige otra
solicitud, aunque se conserve el mismo userId. No se admiten filtros de
empresa, sede, persona o fechas: `all_retained` incluye todos los datos
conservados de esa empresa hasta la instantánea. `requestedBy` fija el
destinatario; otra persona de la misma empresa tampoco puede acceder por
tener administración/RH/auditoría. Operador SaaS, conector y credenciales de
dispositivo no son solicitantes. Las reglas actuales de empresa/cuenta activa
siguen vigentes; E1 no elige una política nueva de suspensión o baja.

Revocar permiso, deshabilitar/desvincular cuenta o cambiar empresa impide
consultar, autorizar y descargar, aunque el archivo esté listo. Desafíos y
autorizaciones anteriores quedan invalidados; no reviven al conceder permiso
otra vez. Se auditan concesión/revocación, solicitud, preparación, autorización,
consumo, vencimiento y fallos con identificadores/huellas, sin credenciales.

## Estados, caducidad y reintentos

| Estado | Transiciones admitidas | Datos disponibles |
| --- | --- | --- |
| queued | preparing, failed, expired | Identidad, alcance y plazo; sin instantánea/huellas |
| preparing | ready, failed, expired | snapshotAt; todavía sin archivo publicable |
| ready | downloaded, expired | snapshotAt, readyAt y ambas huellas; manifiesto recuperable |
| failed | Terminal; nueva solicitud con nueva clave | failureCode=preparation_failed; sin archivo/huellas |
| expired | Terminal | Si hubo archivo listo, conservar huellas/manifiesto; limpiar archivo/temporales |
| downloaded | Terminal, aun si falla la transmisión | Conservar huellas/manifiesto; archivo inaccesible para nuevas peticiones |

- **Expediente:** 24 horas desde createdAt, incluyendo cola y preparación.
  En el instante exacto del vencimiento ya no se puede autorizar/descargar.
  No es un plazo de conservación laboral ni de datos Android.
- **Desafío:** mínimo de creación + 300 segundos y vencimiento del expediente.
- **Autorización:** mínimo de emisión + 60 segundos y vencimiento del expediente.
  Valores aleatorios de 32 bytes en base64url sin relleno; guardar su huella,
  no el valor en claro. Todo se transmite con TLS y Cache-Control: no-store.

POST /dossiers usa Idempotency-Key UUID, aislada por empresa y solicitante.
Misma clave/cuerpo devuelve la misma solicitud sin repetir el trabajo;
otro cuerpo responde 409. Una solicitud fallida/vencida/consumida necesita
clave nueva. El trabajo puede reintentarse mientras no caduque, con temporales
privados; un reintento completo fija otra instantánea y descarta la incompleta.
Sólo publica archivo/manifest/huellas de una preparación íntegra.

El portal genera PKCE S256. El servidor construye la URL OIDC con cliente y
redirect_uri fijos, state/nonce aleatorios y el flujo que exige OTP nuevo
incluso con SSO. El retorno del portal verifica state; el backend verifica la
misma correlación y canjea el código con codeVerifier. Valida firma, emisor,
audiencia, sujeto, vigencia, nonce y nivel alcanzado contra el desafío.
No acepta un JWT/ACR 2 cualquiera ni un token renovado como otra autorización.
E4 deberá probar la configuración efectiva del flujo, además de validar tokens.

Un desafío nuevo invalida el anterior y sus autorizaciones no consumidas.
El canje consume el desafío/emite autorización atómicamente; perder la respuesta
requiere nuevo desafío, nunca reutilizar el código OIDC. La descarga consume
autorización y cambia ready a downloaded antes de enviar bytes. Como máximo
una petición concurrente obtiene la entrega. Range/resume no se admiten.
Interrumpir la transmisión puede dejar un ZIP incompleto y el permiso de
descarga consumido: se solicita otro expediente y se repite MFA. El archivo
temporal se limpia al cerrar la transmisión, con reintento de limpieza si falla;
no queda accesible. Estas transacciones y controles se implementan en E2–E4.

## Errores y precedencia

Usar el esquema Problem del contrato vigente, con correlationId. Primero
autenticar y comprobar permiso/vínculo; después resolver propiedad, estado y
prueba de operación. No consultar existencia ajena para construir mensajes.

| HTTP / code | Condición |
| --- | --- |
| 401 / unauthorized | Credencial ausente o no válida |
| 403 / forbidden | Rol o permiso/vínculo insuficiente |
| 404 / not_found | Recurso ajeno o inexistente, incluidos desafíos de otra persona/empresa/expediente |
| 409 / user_not_linked, user_not_active | Concesión a cuenta no vinculada o inactiva |
| 409 / idempotency_conflict | Misma clave con otro contenido |
| 409 / dossier_not_ready | Preparación no lista; manifiesto nunca generado; solicitud fallida |
| 409 / challenge_consumed | Repetición de un canje ya consumido |
| 410 / dossier_expired, dossier_downloaded | Archivo vencido o ya consumido; se comprueba antes de reutilizar autorización |
| 410 / challenge_expired, authorization_expired | Prueba propia vencida/invalida por nuevo desafío o revocación |
| 403 / verification_failed | Prueba OIDC/autorización inválida; no revelar el detalle criptográfico |
| 422 / validation | Campos desconocidos, versión no soportada, UUID o PKCE inválido |
| 429 / rate_limited | Cuota de la persona excedida |
| 503 / identity_unavailable | Proveedor de identidad no disponible al canjear; no se emite autorización. Iniciar otro desafío al recuperarse |

GET estado sigue devolviendo 200 en estados terminales. GET manifiesto devuelve
200 después de descargar/vencer sólo si fue generado; de otro modo 409.

## Formato 1 del archivo

ZIP sin cifrado de aplicación ni ejecutables, con exactamente tres entradas
regulares en raíz: `manifest.json`, `README.txt` y `records.ndjson`. Nunca
directorios, rutas absolutas, `..`, enlaces o nombres duplicados. Se entrega
por TLS al solicitante, que debe custodiar los datos descargados.
Para 50/300 empleados y un año, E3 debe escribir/leer por lotes sin cargar el
expediente completo en memoria. No reutilizar el ByteArray del CSV como diseño
de un archivo anual. Una instantánea PostgreSQL coherente cubre todas las
colecciones; snapshotAt describe ese corte, no un filtro por fecha de captura.

Los tres archivos usan UTF-8 sin BOM y LF final. Un objeto JSON por línea en
records.ndjson, con `kind`, `tenantId` y `data`; el esquema de formato fija
los 23 tipos, sus campos, tipos y nulabilidad. Todos los campos listados son
obligatorios; el nulo explícito conserva la ausencia. No se descubren tablas
ni columnas automáticamente y no se usa SELECT *. La versión 1 ordena registros
por kind y luego por la llave descrita abajo, comparando UUID/texto en orden
ordinal y fechas ISO. Un orden no representa antigüedad de negocio.

El manifiesto declara empresa, solicitante, expediente, formato, alcance,
snapshotAt, generatedAt, zona IANA, conteos de las 23 colecciones (cero incluido),
tamaño y SHA-256 de README.txt/records.ndjson, y limitaciones. No contiene filas
de empleados ni autorreferencia de su huella. manifestSha256 se calcula sobre
los bytes originales del manifiesto y fileSha256 sobre el ZIP final; el API
los conserva para compararlos por un canal autorizado. El manifiesto se guarda
sin reserializar y también se incorpora byte por byte al ZIP.

`snapshot` de un cierre y `envelope` de un marcaje son cadenas con el texto
original: después de decodificar la cadena JSON, sus bytes UTF-8 deben ser los
originales. No reformatear JSON ni recalcular evidencia histórica con reglas
nuevas. Los números siguen los tipos fuente; enteros grandes se leen con
precisión entera, sin convertirlos a Number de JavaScript para verificar datos.

### Colecciones, llaves y relaciones

El esquema es la lista normativa de campos; los nombres data conservan los de
la fuente PostgreSQL V001–V008. tenant_id se representa como tenantId del
registro; en tenant.id debe coincidir. Todas las relaciones se resuelven dentro
de esa misma empresa, también cuando el origen guarda sólo un UUID.

| Colección / llave en data | Referencias y alcance |
| --- | --- |
| tenant / id | Una empresa; configuración y auto_close_after_hours |
| tenant_user / id; tenant_user_role / user_id,role | Identificadores/nombres para interpretar actores, vínculo employee_id y roles. Sin email ni subject OIDC |
| site / id | Sedes/geocercas, incluidas inactivas |
| schedule / id; schedule_day / schedule_id,day_of_week | Versiones de horario y días; conservar vigencias |
| employee / id | Sede opcional y periodos laborales, incluidas bajas |
| schedule_assignment / id | employee_id, schedule_id; incluir asignaciones históricas y futuras conservadas |
| card / id; card_assignment / id | Tarjetas, versiones de clave (sin clave) y vínculos employee_id/card_id/replaced_card_id históricos |
| device / id; device_session / id | employee_id/site_id y sesiones referenciadas por marcajes. Sólo JWK pública EC P-256 con campos permitidos, nunca d/clave privada |
| attendance_event / id | employee_id, card_id, site_id, device_id, session_id; sobre original y payload_sha256 |
| location_evidence / event_id | Coordenada y precisión del marcaje correspondiente |
| attendance_rejection / id | device_id y huella disponibles; no tiene sobre original |
| incident / id | employee_id/event_id/site_id, responsable, resolución y adjustment_id |
| adjustment / id | employee_id/event_id, intención, autor y motivo; nunca sustituir marcajes |
| rule_set / id | Reglas públicas publicadas y fuentes, incluidas las referenciadas por cierres; envoltura tenantId del destinatario |
| week_closure / id | employee_id/rule_set_id, todos los estados/versiones, snapshot/hash y datos de cierre/reapertura |
| closure_acknowledgement / id | closure_id/employee_id, actor y tipo/nota/huella; cada acuse conserva su versión de cierre |
| week_closure_run / id; week_closure_run_blocked / run_id,employee_id | Sede/solicitante de la corrida y causas/incidencias registradas; no inventar detalle de corridas antiguas |
| audit_log / id | Actor, objetivo y correlación; sólo filas con tenant_id del destinatario. UUID de actores/objetivos históricos pueden estar desvinculados: conservarlos y explicar su ausencia |

Exportar la metadata de auditoría sólo con las propiedades del esquema Metadata;
conservar los motivos de negocio en su propia evidencia. Omitir claves no
permitidas y declarar audit_metadata_filtered. No exportar filas globales de
auditoría (tenant_id nulo), aunque mencionen una empresa en texto.

No incluir contraseñas/hashes de contraseña, secretos OTP, cuentas de Keycloak,
credenciales técnicas, claves privadas/de tarjetas, enrolamientos/códigos,
tokens/sesiones OIDC, IP personales, respaldos multiempresa, tablas de trabajo,
desafíos ni autorizaciones de descarga. Las sesiones de dispositivo del esquema
son evidencia de captura con ID, versión y tiempos; no sesiones OIDC ni tokens.
La falta de email/subject no impide seguir los actores por su ID archivado.

### Verificación y límites

El lector comprueba inventario exacto, esquema, tamaños y huellas byte por byte;
cuenta líneas por kind; compara todos los tenantId; comprueba llaves únicas y
referencias, con la excepción documentada de actores/objetivos históricos
desvinculados. Una referencia rota de evidencia se reporta y evita presentar el
archivo como íntegro. Valida zona horaria y fechas; no ejecuta contenido de
texto como fórmulas o código. Los datos se consultan como JSON, no como CSV.

Limitaciones obligatorias según la evidencia actual: sobres originales de
rechazos no disponibles, posible evidencia sólo en Android, texto histórico
del acuse no guardado y metadata filtrada. La existencia de un acuse/huella no
permite reconstruir texto firmado que no se persistió ni afirmar firma avanzada.
Si existen rechazos, su huella no convierte un sobre ausente en recuperado.

Cambiar datos y manifiesto juntos puede superar una comparación interna:
comparar manifestSha256 y fileSha256 contra las huellas del canal autorizado.
Las huellas no equivalen a firma avanzada, sello de tiempo o certificación.
Este formato permite conservar lo disponible; E6 debe demostrar consulta
independiente y declarar faltantes. Q07/Q14 y sus aceptaciones siguen abiertas.
Descargar/verificar no autoriza supresión de servidor ni purga Android.

## Pruebas y criterio de cierre de E1

`DossierContractTest` reutiliza YAMLMapper y el validador JSON Schema ya
instalados. Corre en :backend:test y por tanto en el build y CI existentes.
Valida ejemplos inline/externos y referencias al contrato actual, exclusión
de rutas candidatas del API vigente, cuerpos cerrados/PKCE, estados, errores
de manifiesto, exclusión de secretos, huellas/conteos del fixture y destinatario.
Las reglas entre filas y transacciones reales quedan para E2–E6; una prueba
de esquema no acredita aislamiento operativo ni MFA/descarga implementados.

```powershell
docker compose --profile tools run --rm contract-lint
docker build --target build --tag zenit-e1-check .
docker compose --profile test run --rm --build backend-it
```

Resultado local del 26: ambos contratos válidos; build backend/simulador y
56 pruebas unitarias correctas (8 nuevas de E1, sin omisiones); 75 integraciones
PostgreSQL correctas, incluidas cobertura de contrato y exportes. E1 completada
en su alcance técnico; publicación y límites en [bitácora](bitacora-trabajo.md).
Estos resultados no se heredan a implementaciones posteriores.
