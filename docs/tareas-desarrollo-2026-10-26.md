# Tareas disponibles para desarrollo — 26 de octubre de 2026

**Entrega local posterior del 27:** [E2/E3 implementadas y verificadas](entrega-expediente-e2-e3.md),
con 60 unitarias, 83 integraciones y perfiles 50/300 aprobados; API 0.14.0.
E4/E5/E6 siguen pendientes. El texto siguiente conserva los cortes anteriores.

**Actualización del 27 de octubre:** la
[verificación E2–E5](verificacion-e2-e5-2026-10-27.md) sustituye el estado de
integración/CI de este corte: PR #19 integrada en `main/f4104e1` y cuatro
trabajos de CI de la PR aprobados. E2–E5 siguen sin implementar; Docker
responde, sin servicios del proyecto activos. El contenido siguiente conserva
la evidencia del 26 y los criterios de desarrollo.

Revisión solicitada de pendientes, código fuente, historial y GitHub. Base:
`main`, commit `5d7b7833447ca7ccf5ec7b74cb7c650fa24dbe66`, coincidente con la
referencia local `origin/main`. No se hizo pull, despliegue ni cambio de código.

**Avance posterior de esta misma fecha:** E1 entrega el
[contrato/formato candidato y sus pruebas](contrato-expediente-e1.md), sin
habilitar endpoints. El siguiente desarrollo es E2. E3–E5 pueden completarse después, con
dependencias internas y datos ficticios. E6 puede completar su verificación
técnica después de esas entregas, pero conserva aceptación y decisiones
externas. Ninguna de estas subtareas cierra por sí sola un pendiente global.
Se mantienen **17 tareas globales abiertas total o parcialmente y seis P0**.

E1 publicada en `b5aff1f`, [PR #19 abierta](https://github.com/Alsegurarp/fs_asistencias/pull/19)
y sin integrar. Validación local aprobada: 56 unitarias (ocho nuevas), 75
integraciones, lint de ambos contratos y secretos sin hallazgos. CI remoto
en curso al corte del 26 a las 23:15 de Ciudad de México; véase
[entrega y pendientes en bitácora](bitacora-trabajo.md#tarea-realizada-y-trabajo-restante).

## Estado verificado que sustituye los cortes anteriores

| Comprobación | Resultado al 26 de octubre |
| --- | --- |
| Integración de respaldo concurrente y MFA | GitHub confirma integradas las [PR #15](https://github.com/Alsegurarp/fs_asistencias/pull/15) y [#16](https://github.com/Alsegurarp/fs_asistencias/pull/16). No queda pendiente volver a integrarlas |
| CI de la base main/5d7b783 | [Verificaciones 40311310435](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40311310435), evento push en main: backend, portal, Android y contrato/seguridad completados con éxito. Incluye identidad, respaldo aislado e inventario/análisis de cinco imágenes; no sustituye CI de la PR #19 |
| Expediente empresarial | La [issue #18](https://github.com/Alsegurarp/fs_asistencias/issues/18) está abierta con E1–E6 sin marcar. No hay operaciones de expediente en OpenAPI 0.13.0 ni implementación de negocio en backend/portal. La prueba MFA no entrega esta funcionalidad |
| Android del día 26 | Navegación por secciones, resumen semanal/calendario, accesos, administración y lenguaje formal ya están en main. CI compila app/instrumentación, ejecuta pruebas unitarias y lint; no demuestra el recorrido visual de estas pantallas en un teléfono |
| Seguridad del día 26 | Las actualizaciones de brotli/libcurl ya están en main y su paso de CI aprobó. Queda separado el inventario, actualización y aceptación del servidor público |
| Entorno local | `docker compose ps --format json` no pudo conectar: no existe la tubería dockerDesktopLinuxEngine en esta sesión. Antes de ejecutar pruebas locales hay que iniciar Docker y comprobar los servicios; no se atribuye disponibilidad actual a las actas antiguas |
| Cambios previos | Existen cambios ajenos a esta revisión en backend/bin. Se conservaron; no son evidencia de nuevas capacidades en backend/src |

## Lista de desarrollo ejecutable

Los IDs E1–E6 y sus criterios completos proceden de
[Expediente por empresa](expediente-empresa.md#tareas-declaradas-para-implementación).
Las áreas indican responsabilidad técnica; no se han asignado personas ni fechas.
Docker estuvo disponible fuera del aislamiento para las pruebas E1. El fallo
de conexión de la tabla anterior describe la revisión inicial, no su validación posterior.

| Orden / ID | Área y entrega | Cuándo puede iniciarse | Criterio mínimo para completarla |
| --- | --- | --- | --- |
| 1 / E1 | Contrato y formato del expediente — entregada en rama candidata | Definición y pruebas completadas; integración en main mediante PR | Ocho operaciones propuestas, formato 1 con 23 tipos de registro, errores/estados, campos/relaciones, caducidades y reintentos documentados; fixture con huellas reales y ocho pruebas nuevas aprobadas. El API vigente y CSV no cambian |
| 2 / E2 | Backend y persistencia: permiso específico y aislamiento | Siguiente desarrollo; E1 ya disponible, sin proveedor o tarjeta nuevos | Concesión/revocación explícitas y auditadas; empresa/usuario resueltos por servidor. Probar acceso ajeno, falta de permiso, cambio de vínculo/cuenta y revocación tras preparar el archivo. Sin herencia automática de administración, RH, auditoría u operador |
| 3 / E3 | Backend y trabajos: preparación del archivo íntegro | Después de E1/E2 | Instantánea coherente de una empresa, versiones históricas, ajustes/acuses y evidencia disponible. Archivo legible con instrucciones, inventario, conteos y SHA-256. Probar escrituras concurrentes, aislamiento, caducidad/limpieza y perfiles 50/300 durante un año, sin cargar todo el archivo en memoria |
| 4 / E4 | Identidad y backend: MFA nuevo y autorización de un uso | Después de E1/E2; E3 requerido para aceptar la descarga real | Desafío ligado a solicitante/empresa/expediente, verificación OIDC y consumo atómico. Probar OTP incorrecto/consumido, SSO, nivel reducido, token renovado, desafío ajeno/vencido, revocación y descargas concurrentes. Versionar configuración efectiva y conservar MFA del acceso normal |
| 5 / E5 | Portal: solicitud, estado, verificación y descarga | Después de E1–E4 | Acción sólo con permiso; recorrido accesible con PKCE S256, state y nonce. Manejar cancelación, vencimiento, interrupción y cambio de cuenta sin reutilizar autorizaciones; comprobar roles y regresión del CSV semanal |
| 6 / E6, parte técnica | QA/operación: recuperación y consulta independiente | Después de E3–E5 | Consultar/verificar sin conexión a Zenit; rechazar truncamiento, alteración de datos/manifiesto y datos ajenos. Incluir versiones reabiertas, ajustes, objeciones y límites de evidencia ausente; documentar salida. El cierre integral sigue condicionado por Q07/Q14 y aceptación del responsable |

Secuencia restante: **E2 → E3/E4 → E5 → E6**. E3 y E4 comparten contrato y
permisos; la descarga completa requiere ambas. E1–E5 tienen alcance técnico
desarrollable con el entorno existente, una vez disponible Docker. Esto no
resuelve SMTP/recuperación de acceso, reglas laborales ni habilitación pública.

### Piezas existentes que debe reutilizar el desarrollo

| Entrega | Código y verificaciones que debe alcanzar |
| --- | --- |
| E1, entregada | contracts/dossier.openapi.yaml, dossier-format.schema.yaml, ejemplos ficticios y documentación de formato; pruebas DossierContractTest y lint. contracts/openapi.yaml permanece vigente en 0.13.0; promover operaciones sólo al implementarlas |
| E2 | identity/CurrentPerson.kt, identity/IdentityResolver.kt, security/SecurityConfig.kt, usuarios, auditoría y migraciones nuevas en backend/src/main/resources/db/migration. Reutilizar los patrones de pruebas de aislamiento y permisos de ExportsIT y DatabaseRolesIT |
| E3 | export/Exports.kt y jobs/Jobs.kt como patrones de trabajos, manifiestos y vencimiento; entidades de asistencia, incidencias, cierres/acuses versionados y reglas. Conservar aislamiento y procesar por lotes; el ByteArray del CSV actual no resuelve el tamaño anual del expediente |
| E4 | infra/keycloak/dossier-mfa.test.mjs como evidencia de viabilidad, configuración versionada de identidad y seguridad backend. El principal actual no conserva prueba de MFA ligada a la operación; un ACR 2 renovado no demuestra un OTP nuevo |
| E5 | web/src/auth.ts, web/src/Exports.tsx y sus pruebas como patrones; revisar navegación y permisos. Las autorizaciones del CSV semanal no se amplían al expediente |
| E6 | Pruebas de integración, archivos ficticios producidos por E3 y documentación de consulta/verificación. Declarar rechazos cuyo sobre original no existe en servidor; no reconstruir evidencia ausente |

Las rutas Kotlin de la tabla son relativas a
backend/src/main/kotlin/mx/fastsolution/zenit. Antes de cada cambio, revisar
los llamadores, contrato, pruebas y fixtures concretos. No hace falta una
dependencia, servicio o almacén externo nuevo para este alcance.

## Validación local disponible al disponer de teléfono

**QA Android posterior a los cambios del 26 — tarea global 15 y regresión
de navegación.** Puede prepararse ahora y ejecutarse con Docker y un teléfono
de ensayo autorizado. La conexión actual del teléfono no se verificó en esta
revisión; no se declara esta ejecución lista ni aprobada.

- Validar secciones operativas, accesos y administración, y el resumen semanal,
  calendario, detalles y confirmación de respuesta del cierre.
- Ejecutar los casos afectados del [guion Android](qa-android-semana-acuse.md),
  especialmente M03–M05 y M11–M15: calendario, pendientes, reconexión,
  compartir, permisos, terminal y texto grande. Añadir la pérdida de respuesta
  y el conflicto 409 con condiciones controladas del propio guion.
- Registrar commit/hash de APK, modelo/Android, versión de backend, casos y
  evidencia. Conservar datos existentes y restituir configuración/vínculo.
  El acta del 21 corresponde a la interfaz anterior y mantiene su alcance.

Esta validación no requiere decidir SMTP ni tecnología de tarjeta. La captura
NFC autenticada conserva sus propias dependencias físicas y de claves.

## Pendientes que todavía no pueden cerrarse íntegramente

| Órdenes globales | Qué impide cerrarlos actualmente | Desbloqueo necesario |
| --- | --- | --- |
| 1 / 6: respaldo externo y producción | Falta destino externo, custodia, responsables e infraestructura de producción | Q01/Q02/Q05; después automatizar y probar recuperación fuera del dominio de falla |
| 2: identidad operativa | Cambio obligatorio ya existe; acceso perdido, SMTP y cuentas operativas siguen abiertos | Q03/Q04 y recursos seguros; verificar correo, recuperación de contraseña/OTP y operador |
| 3 / 15 / 17: jornada, acuse y ausencias | Faltan resultados esperados aprobados, texto/evidencia y criterios de ausencias | Q06/Q07/Q15 y revisión profesional; conservar versiones históricas |
| 4: tarjetas reales | Las herramientas MF1K no implementan autenticación real de asistencia en backend | Q08/Q09: tecnología, tarjetas y provisión/custodia de claves; ensayar lectura/escritura/borrado y captura/rechazo reales |
| 5 / 16: suspensión, baja y supervisor | Las alternativas operativas no están elegidas | Q10–Q13; implementar sus efectos sólo después de concretar esas decisiones |
| 10: retención Android | No hay política aprobada de plazos/condiciones ni recuperación de toda la evidencia local necesaria | Q14 y recuperación/consulta comprobadas. No purgar pendientes ni derivar una antigüedad arbitraria de la conservación laboral |
| 9 / 12 / 13 / 14 / 15 / 16: servidor y aceptación | Trabajo público diferido; no se conocen aquí versión, migraciones e imágenes efectivamente desplegadas | Q17, inventario/acceso mediante el interlocutor autorizado y aceptación pública/del usuario |
| 8: independencia de cuotas por IP | Falta prueba simultánea con dos IP públicas reales | Q18 y dos conexiones; se conserva la entrega a otro desarrollador indicada por el usuario |
| 18: capacidad y continuidad | La línea base local no fija objetivos ni prueba infraestructura objetivo, DNS o renovación real | Q19 y entorno objetivo; después carga sostenida y ensayos de continuidad |
| 19 / 20: nómina y contrato 1.0 | Faltan sistema/formato del cliente, aceptación y acuerdo de compatibilidad | Q20/Q21 y cierre de recorridos/decisiones. Q22 sigue separado para obligatoriedad de CI |

## Cierre de esta revisión

Se consolidó este listado y se enlazó desde los documentos de seguimiento.
No se crean tareas globales nuevas ni se vuelven a proponer A1–A5, respaldo
concurrente, integración MFA o mejoras Android ya entregadas.

Para cerrar una futura entrega: commit/PR, entorno y pruebas pertinentes,
evidencia de aceptación y límites explícitos. La revisión actual comprobó
código, referencias e información de GitHub; no ejecutó nuevas pruebas de
producto ni controló el teléfono o verificó el servidor público. No se
modificaron reglas, permisos, datos o recursos externos.
