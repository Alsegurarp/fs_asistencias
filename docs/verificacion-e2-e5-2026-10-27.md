# Verificación de pendientes E2–E5 — 27 de octubre de 2026

**Corte histórico, anterior a la implementación E2/E3.** La
[entrega posterior](entrega-expediente-e2-e3.md) registra E2/E3 implementadas,
pruebas aprobadas y compatibilidad del modelo PlantUML. El estado siguiente
conserva la evidencia de la revisión inicial.

E1 está integrada. E2, E3, E4 y E5 siguen pendientes de implementación;
pueden desarrollarse con el entorno existente y datos ficticios, en el orden
**E2 → E3/E4 → E5**. No requieren resolver SMTP, tarjetas reales ni producción.
E6 conserva su alcance separado de recuperación independiente y aceptación.

## Base comprobada

- La [PR #19](https://github.com/Alsegurarp/fs_asistencias/pull/19) está
  integrada en `main`, commit `f4104e16b25833f4a042646e8b1319542a969288`.
  GitHub registra la integración el 27 de octubre a las 05:24 UTC
  (26 de octubre, 23:24 en Ciudad de México).
- El [CI de la PR, ejecución 40454604478](https://github.com/Alsegurarp/fs_asistencias/actions/runs/40454604478),
  terminó correctamente en sus cuatro trabajos: backend, portal, Android y
  contrato/seguridad. Se comprobó también el éxito del paso de identidad.
  Es evidencia de la entrega E1; no acredita capacidades futuras de E2–E5
  ni se presenta como una ejecución de CI del commit de integración.
- `git fetch origin` actualizó las referencias. La rama local sigue siendo
  `feat/expediente-e1-contrato`, en `afdd8f5`; su árbol versionado coincide
  con `origin/main/f4104e1`. No se cambió de rama ni se integraron cambios.
- La [issue #18](https://github.com/Alsegurarp/fs_asistencias/issues/18)
  continúa abierta y aún tiene E1–E6 sin marcar. Su lista está atrasada
  respecto a la integración de E1. No se modificó la issue.
- Docker respondió a `docker compose ps --format json` fuera del aislamiento;
  no hay servicios activos de este proyecto. No se levantaron servicios ni
  se ejecutaron nuevas pruebas locales en esta revisión.
- Se conservaron las modificaciones y archivos no seguidos previos de
  `backend/bin/`. No sustituyen implementación en `backend/src/`.

## Trabajo necesario para completar cada entrega

| Tarea | Evidencia actual y cambio necesario | Verificación para cerrarla |
| --- | --- | --- |
| E2 — permiso y aislamiento | No hay permiso de expediente ni migración en las fuentes; las migraciones llegan a V008. Añadir concesión/revocación explícitas y auditadas, consulta propia y comprobación de cuenta, vínculo y empresa en cada operación. Reutilizar `CurrentPerson`, `IdentityResolver`, usuarios y auditoría; abrir sólo las rutas necesarias en `SecurityConfig`. Ningún rol concede el permiso automáticamente | Empresa/usuario ajenos, operador/dispositivo, ausencia de permiso, cuenta deshabilitada, cambio de vínculo/cuenta y revocación con archivo preparado. Conceder de nuevo no revive desafíos/autorizaciones anteriores |
| E3 — archivo íntegro | No hay preparador de expediente; `ExportJob` produce el CSV semanal en memoria y sirve sólo como patrón. Añadir persistencia, trabajo e instantánea PostgreSQL coherente; producir el ZIP formato 1 con las 23 colecciones explícitas, instrucciones y manifiesto con conteos/SHA-256, preservando históricos y evidencia original. Leer/escribir por lotes y limpiar archivos temporales | Escrituras concurrentes sin mezclar instantáneas, aislamiento, exclusión de secretos, históricos/reaperturas/ajustes/acuses, idempotencia, fallos/reintentos, caducidad/limpieza y perfiles de 50/300 empleados durante un año sin cargar el archivo completo en memoria |
| E4 — MFA por descarga | Existe sólo el ensayo aislado `infra/keycloak/dossier-mfa.test.mjs`; el realm efectivo usa `browser`, y `CurrentPerson` no conserva una prueba ligada a la operación. Versionar el flujo efectivo de OTP nuevo y cliente/retorno fijos; crear desafío con state/nonce y PKCE S256, canjear código OIDC, validar identidad/nivel/correlación y emitir/consumir autorización atómicamente | OTP incorrecto/consumido, SSO y acceso normal con MFA, nivel reducido, token renovado con ACR 2, desafío ajeno/vencido/consumido, cambio de expediente/cuenta, revocación y dos descargas concurrentes: sólo una entrega |
| E5 — portal | `Workspace`, `api` y `auth` no tienen recorrido de expediente. Añadir administración explícita del permiso, acción visible sólo con permiso, solicitud/estado, retorno OIDC correlacionado y descarga; reutilizar componentes y patrones de consultas existentes | Roles con/sin permiso, PKCE/state/nonce, accesibilidad, cancelación, vencimiento, interrupción, cambio de cuenta y errores sin reutilizar autorizaciones; regresión del CSV semanal |

El contrato normativo es [dossier.openapi.yaml](../contracts/dossier.openapi.yaml),
con el [formato 1](../contracts/dossier-format.schema.yaml) y las
[reglas E1](contrato-expediente-e1.md). Las ocho operaciones siguen siendo
candidatas: no aparecen en el contrato activo 0.13.0 ni en backend/portal.
Se promoverán al API vigente cuando existan sus implementaciones y pruebas;
también habrá que adaptar `DossierContractTest`, que hoy exige su ausencia,
y la cobertura de rutas/respuestas del contrato activo.

## Secuencia y límites

1. Partir de `main/f4104e1` conservando los cambios previos; implementar E2
   con migración nueva, permisos SQL y pruebas de aislamiento.
2. Completar E3 y E4 sobre ese permiso. La aceptación de descarga necesita
   ambas: un archivo preparado no acredita MFA y ACR 2 no acredita OTP nuevo.
3. Completar E5 y probar el recorrido integrado, incluido el CSV semanal.
4. Registrar por entrega commit/PR, entorno, resultados y límites; actualizar
   el contrato y el seguimiento sólo con evidencia de implementación.

Caducidades ya fijadas por E1: expediente 24 horas, desafío hasta 5 minutos
y autorización hasta 60 segundos, siempre limitados por el vencimiento del
expediente. La autorización se consume antes de transmitir; una interrupción
requiere nueva solicitud y MFA. No se amplían los permisos del CSV semanal.

Esta revisión no implementa ni marca completas E2–E5. No comprobó servidor
público, teléfono ni nuevas pruebas de producto. Se mantiene el conteo
documentado de 17 pendientes globales y seis P0; no es una nueva auditoría
de todos ellos. Q07/Q14 y la aceptación de E6 siguen abiertas; no se habilita
purga ni supresión de datos.
