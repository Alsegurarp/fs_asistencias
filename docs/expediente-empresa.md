# Expediente recuperable por empresa

**Seguimiento verificado el 28 de octubre:** E1–E3 integradas en
`main/fa2396d` mediante PR #19/#20; cuatro trabajos del
[CI de main aprobados](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40554372464).
E4–E6 siguen pendientes; la descarga permanece cerrada. La tabla E1–E6
conserva sus criterios de cierre; las declaraciones antiguas de E2/E3
pendientes corresponden a cortes anteriores. Consultar el
[orden de trabajo actual](TareasPendientes.md#trabajo-priorizado-con-el-contexto-del-28-de-octubre).
Sin despliegue acreditado ni autorización de purga.

**Entrega local del 27 de octubre:** [E2/E3 implementadas y probadas](entrega-expediente-e2-e3.md).
Permiso explícito y preparación íntegra por bloques en API 0.14.0; 60
unitarias y 83 integraciones aprobadas, con concurrencia y perfiles 50/300.
La descarga permanece cerrada hasta E4; portal E5 y recuperación/aceptación E6
siguen pendientes. [PR #20](https://github.com/Alsegurarp/fs_asistencias/pull/20)
abierta, sin integrar/desplegar. Los acuerdos y criterios siguientes mantienen su alcance.

Acuerdo del usuario del **23 de octubre de 2026**. Da continuidad a las
tareas de evidencia/conservación, identidad y retención Android; no añade
una tarea global ni declara cerradas las existentes.

**Seguimiento del 26 de octubre:** las PR #15/#16 están integradas y los
cuatro trabajos de [CI de main/5d7b783](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40311310435)
aprobaron, incluido el paso de identidad con el ensayo MFA. La
[issue #18](https://github.com/Alsegurarp/fs_asistencias/issues/18) conserva
el seguimiento E1–E6. E1 ya entrega un
[contrato/formato candidato validado](contrato-expediente-e1.md), con ocho
pruebas nuevas aprobadas; E2–E6 siguen pendientes. Véase el
[listado de desarrollo](tareas-desarrollo-2026-10-26.md).
Las referencias posteriores a CI sin publicar describen el corte del 23;
la funcionalidad operativa de expediente sigue sin implementar.

## Metas acordadas

1. Permitir al empleador autorizado obtener el expediente de su empresa.
2. Entregar registros legibles, versiones, ajustes, objeciones y elementos
   para comprobar su integridad, conservando los históricos existentes.
3. Comprobar conservación y consulta fuera de Zenit antes de suprimir datos
   al terminar el servicio. Descargar un archivo no demuestra que ya pueda
   consultarse ni autoriza por sí solo el borrado.
4. Aislar cada entrega por empresa. El respaldo operativo multiempresa sirve
   para recuperar el servicio; no se entrega a un cliente.
5. Exigir permiso específico y una autorización nueva por descarga, limitada
   al usuario, su empresa y el expediente concreto, con caducidad, un solo
   uso y auditoría.
6. Usar MFA de Keycloak/Red Hat para acreditar la identidad y volver a pedir
   el segundo factor al autorizar una descarga sensible.

Según el servicio y contrato, el empleador normalmente será el responsable
del tratamiento y fastSolution el encargado. El concepto de propietario u
`owner` no elimina los derechos de las personas trabajadoras sobre sus datos.
La consulta y entrega a la persona trabajadora conservan su propio alcance;
el permiso de expediente empresarial no reemplaza esos derechos.
Base jurídica y límites ya revisados en
[conservación y recuperación](revision-juridica-jornada-acuse.md#recuperación-por-el-empleador-y-servicios-de-terceros).

## Punto de partida comprobado en el código

| Pieza | Estado y consecuencia |
| --- | --- |
| Exportes semanales | `ExportService` filtra por empresa, conserva manifiesto/huellas y consume el archivo una sola vez. `SecurityConfig` permite a administración, RH y auditoría descargar un exporte de otra persona de la misma empresa; `ExportsIT` lo prueba. No reutilizar esa autorización para el expediente completo |
| Identidad | `web/src/auth.ts` renueva tokens; no solicita una nueva verificación por descarga. El validador del backend verifica vigencia, emisor, audiencia y sujeto, sin acreditar MFA reciente |
| Principal de la API | `PersonAuthenticationConverter` resuelve empresa/roles desde la base. `CurrentPerson` no conserva `acr`, contexto de autenticación ni una prueba ligada a la operación. El permiso debe seguir resolviéndose en Zenit, no confiar en un rol enviado por el navegador |
| Distribución | `infra/keycloak/Dockerfile` usa Keycloak comunitario 26.8.1 sobre UBI de Red Hat con Java corregido. No es Red Hat build of Keycloak ni acredita su soporte comercial. Usar esa distribución requiere seleccionarla y validarla por separado |
| Evidencia disponible | Existen sobres aceptados, rechazos, incidencias, ajustes, cierres versionados, acuses e historial de auditoría. El servidor no conserva el sobre original completo de cada rechazo; una exportación no puede reconstruirlo |
| Android | Conserva pendientes, sobres/recibos procesados y acuses locales. No hay purga; la nueva meta no fija un plazo de caché ni hace prescindibles esas copias |

## Controles por riesgo

| Riesgo | Control que corresponde |
| --- | --- |
| Contraseña/cuenta comprometida | MFA obligatorio, alta y recuperación del factor con un procedimiento verificado. No equiparar recuperar contraseña con restablecer OTP |
| Sesión o token robados | Segundo factor nuevo por operación; comprobar prueba firmada y consumir una autorización breve ligada al expediente. Renovar el token no demuestra otra verificación |
| Persona autorizada que extrae indebidamente | Permiso específico, finalidad/alcance, acceso al expediente concreto y auditoría. El MFA no impide por sí solo que quien tiene acceso copie información |

No conceder acceso implícito por tener `admin_empresa`, `rh`, `auditor` u
operación SaaS. La futura asignación del permiso debe quedar explícita y
auditada; probar también su revocación después de preparar el archivo.
No cambiar el comportamiento aprobado de los CSV semanales.

## Secuencia de implementación

1. **MFA por operación:** comprobar en identidad aislada que LoA 2 con OTP y
   `loa-max-age=0` obliga a interactuar incluso con SSO. Contrastar el nivel
   firmado, OTP inválido/consumido, reducción del nivel solicitado y renovación.
   La prueba se versiona en `infra/keycloak/dossier-mfa.test.mjs` y se añade al
   trabajo de identidad de CI. Su realm y cuenta son desechables; no cambia
   el flujo de acceso del realm `zenit`.
2. **Permiso y preparación:** ampliar contrato, persistencia y API para
   preparar un expediente de una sola empresa y fijar una instantánea
   coherente. Registrar solicitante, alcance, versión de formato, fecha de
   corte y huellas; conservar el acceso exclusivo del destinatario autorizado.
3. **Autorización y descarga:** crear un desafío del servidor ligado al
   solicitante y expediente. Hacer la verificación en Keycloak con
   Authorization Code, PKCE S256, `state` y `nonce`. Comprobar en servidor
   firma, emisor, audiencia, sujeto, nivel alcanzado y su vinculación al desafío;
   la elevación sola no concede permiso. Emitir una autorización breve y
   consumirla atómicamente con la descarga. No poner tokens de descarga en
   URLs, logs ni auditoría. Revalidar empresa, usuario activo y permiso.
4. **Archivo consultable y verificación:** entregar formato documentado y
   legible, datos y manifiesto con inventario, conteos y SHA-256 por archivo.
   Comprobarlo fuera de Zenit, incluyendo versiones reabiertas, ajustes y
   objeciones. Registrar aceptación de recuperación y tratar la supresión
   como procedimiento separado sujeto a obligaciones de conservación.

Las ventanas de caducidad del desafío/autorización se concretarán en la
implementación y sus pruebas; no heredar sin revisión los 15 minutos del CSV.
Para evitar repetir todo el expediente en memoria, la preparación y entrega
deben poder procesar los perfiles de 50/300 empleados durante un año. Reusar
trabajos y auditoría existentes; no introducir otro servicio ni un almacén
externo sólo para este diseño.

La solicitud OIDC puede alterarse en el navegador. Keycloak documenta
`Max Age=0` para elevar el nivel sólo en esa autenticación y recomienda
comprobar el nivel devuelto. Es una propiedad del proveedor, no una
autorización de negocio ni garantía de un solo uso del token emitido.
[Keycloak 26.8.1, autenticación reforzada](https://www.keycloak.org/docs/26.8.1/server_admin/#_step-up-flow),
[Red Hat build of Keycloak, configuración de autenticación](https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/26.4/html/server_administration_guide/configuring-authentication_server_administration_guide).
No usar sólo `iat`, renovación de token, `auth_time` o un `acr` aislado como
prueba de autorización nueva por expediente: demostrar su correlación y
rechazar reutilización entre operaciones.

**Validación local del 23 de octubre:** la suite de identidad aprobó 10/10,
sin omisiones, incluida la prueba nueva. Sobre la misma sesión SSO pidió OTP
otra vez, rechazó código incorrecto/consumido y elevación silenciosa, y firmó
ACR 1 al solicitar el nivel inferior. Al renovar el token de nivel 2 antes
de reducir el nivel, conservó ACR 2 y `auth_time` sin otra interacción OTP.
Esto refuerza la necesidad del desafío y autorización propios del servidor;
no se debe aceptar cualquier token ACR 2 como una descarga nueva.
La prueba comprueba firma, emisor, audiencia y vigencia de los JWT, y
correlación de `state`/`nonce` en el canje con PKCE. Es viabilidad de identidad,
no aceptación de una descarga empresarial implementada. La distribución
Red Hat build of Keycloak no fue ejecutada. CI remoto pendiente de publicación.

## Contenido y límites que debe declarar la entrega

Incluir configuración de empresa, sedes, empleados y asignaciones de horarios;
marcajes y sobres originales disponibles, ubicación pertinente y rechazos;
incidencias y ajustes con sus motivos/actores; todas las versiones de cierres
y acuses; reglas de cálculo referenciadas, y auditoría pertinente a la evidencia.
Conservar identificadores y referencias que permitan seguir cada relación.
Un documento de lectura debe explicar formato, zona horaria, estados,
versiones, huellas y limitaciones conocidas.

Usar lista explícita de campos y relaciones por empresa. No exportar tablas
por descubrimiento automático ni mezclar el volcado de identidad, otras
empresas, contraseñas, secretos OTP, credenciales técnicas, claves privadas,
códigos de enrolamiento o tokens/sesiones vigentes. Las claves públicas que
permitan verificar sobres firmados sí pueden ser evidencia necesaria.

Las huellas permiten detectar cambios respecto del manifiesto conservado;
no acreditan por sí solas autoría, firma avanzada o certificación legal.
No presentar un rechazo sin sobre como si incluyera el original ni afirmar
que el archivo recupera evidencia que hoy sólo existe en Android.

## Tareas declaradas para implementación

Declaradas por solicitud del usuario el **23 de octubre de 2026**. Son
subtareas de los órdenes globales 2/3/10/15, no seis pendientes globales
nuevos. E1 entrega el contrato candidato y formato de archivo con pruebas;
su integración en main se registra con la PR. E2–E6 siguen abiertas.
El ensayo MFA ya aprobado es una prueba de
viabilidad y no implementa ninguna de estas entregas. Los responsables de
la tabla indican el área de trabajo; no se han asignado personas ni fechas.

| ID | Entrega y área | Dependencias | Criterio de cierre |
| --- | --- | --- | --- |
| E1 | Contrato y formato del expediente — backend/contrato | Metas y límites de este documento | Declarar operaciones, estados, errores, destinatario, alcance, fecha de corte, versión, campos/relaciones incluidos y exclusiones de secretos. Definir caducidad de archivo, desafío y autorización, comportamiento ante interrupción/reintento y compatibilidad con el contrato actual. Incluir ejemplos ficticios y validar el contrato; no modificar el CSV semanal |
| E2 | Permiso específico y aislamiento — backend/persistencia | E1 | Implementar concesión/revocación explícitas y auditadas, sin herencia automática de administración/RH/auditoría/operador. Derivar empresa y usuario de la identidad resuelta en servidor. Revalidar permiso/vínculo/cuenta en cada operación y probar denegaciones entre empresas y usuarios, incluida revocación tras preparar el archivo |
| E3 | Preparación del archivo íntegro — backend/trabajos | E1, E2 | Reutilizar trabajos y auditoría para obtener una instantánea coherente de una empresa, con históricos de cierres, acuses, ajustes y evidencia disponible. Generar formato legible, instrucciones y manifiesto con conteos/huellas; declarar evidencia ausente. Probar preparación concurrente con escrituras, caducidad y limpieza de temporales, exclusión de secretos/otros clientes y perfiles 50/300 durante un año sin cargar todo el expediente en memoria |
| E4 | MFA y autorización de un solo uso — identidad/backend | E1, E2; E3 para la aceptación de descarga | Vincular la verificación nueva a un desafío del servidor, solicitante, empresa y expediente; verificar la respuesta OIDC y emitir/consumir la autorización atómicamente. Probar SSO, OTP incorrecto/consumido, nivel reducido, token renovado con ACR 2, desafío ajeno/vencido, cambio de expediente, revocación y dos descargas concurrentes. Una misma prueba no habilita otra operación; no registrar credenciales. Versionar la configuración efectiva de identidad y comprobar que el acceso normal mantiene MFA |
| E5 | Solicitud y descarga en el portal — portal | E1–E4 | Mostrar la acción sólo a quien tenga el permiso, solicitar/preparar el expediente y conducir la verificación nueva con PKCE S256, state y nonce. Conservar la correlación al volver de identidad; manejar cancelación, vencimiento, cambio de cuenta, errores e interrupción sin reutilizar autorizaciones. Probar el recorrido por rol, accesibilidad y que las pantallas del CSV semanal conserven su comportamiento |
| E6 | Recuperación independiente y aceptación — QA/operación | E3–E5; Q07/Q14 para cerrar evidencia y retención | Verificar y consultar la entrega sin conexión a Zenit; detectar archivo truncado, alteración de datos/manifiesto y contaminación entre empresas. Probar versiones reabiertas, ajustes, objeciones, trazabilidad y límites de rechazos sin sobre. Registrar versión/entorno/evidencia y aceptación de conservación/consulta. Documentar el procedimiento de salida; cualquier supresión conserva sus obligaciones, impedimentos y decisiones pendientes, sin activar purga Android automáticamente |

Orden de ejecución: E1, E2, E3/E4, E5, E6. E3 y E4 pueden desarrollarse
después de fijar su contrato común; la descarga completa exige ambas.
La integración de la prueba MFA en CI se acepta sobre el commit publicado,
separadamente de las verificaciones locales del 23.

Para cerrar cada tarea: registrar commit/PR, resultado de sus pruebas,
entorno, límites pendientes y evidencia de aceptación; una pantalla terminada
no cierra por sí sola permisos, archivo ni recuperación.

## Criterios de cierre y seguimiento

| Caso | Resultado exigido |
| --- | --- |
| Administración/RH/auditoría sin permiso específico | Denegado, aunque puedan descargar el CSV semanal |
| Usuario distinto de la misma empresa | No puede consultar, autorizar ni descargar el expediente ajeno por herencia de los permisos semanales |
| Otra empresa u operador SaaS | Sin datos, metadatos ni archivo del cliente |
| SSO sin verificación nueva, nivel reducido o token renovado | No obtiene una nueva autorización de descarga |
| OTP incorrecto/consumido o desafío ajeno/vencido | Denegado, sin consumir una autorización legítima de otra operación |
| Autorización reutilizada, dos descargas concurrentes o cambio de expediente | A lo sumo una entrega para el expediente y usuario autorizados |
| Usuario deshabilitado, permiso revocado o vínculo cambiado | Denegado aunque el archivo estuviera preparado |
| Versión reabierta, ajuste y objeción | Histórico conservado e identificable, sin mezclar versiones |
| Archivo truncado, contenido/manifiesto alterado o dato de otra empresa | Verificación falla; no habilita supresión |
| Consulta sin conexión a Zenit | Archivo verificable y legible con las instrucciones entregadas |

La tarea global 10 y Q14 siguen esperando plazos/condiciones y conservación
de evidencia local; Q03/Q04 conservan recuperación/SMTP/cuentas. Las reglas
Q10–Q13, jornada/acuse y dictamen tampoco se eligen por este acuerdo.
El expediente, el permiso y la descarga de negocio siguen pendientes hasta
implementar y aprobar los pasos 2–4. No se autoriza purga por completar el
ensayo del paso 1.
