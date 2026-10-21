# Entregas A1–A5 — 20 de octubre de 2026

Implementación local sobre `1984be3`, autorizada por el usuario después de la
declaración de tareas. No se cambiaron las decisiones pendientes de jornada,
suspensión, baja, supervisor, retención o NFC. No se desplegó el servidor
público. Se incorporaron los avances de `origin/main`/`ef23c20`, incluido
el modelo SaaS aprobado. La [PR #10](https://github.com/Alsegurarp/fs_asistencias/pull/10)
está integrada en `main`/`e4d7683`; sus cuatro trabajos de
[CI aprobaron](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39504126988).
El usuario confirmó funcionamiento. El 21 se documentaron
[33/33 casos locales](qa-a1-a5-2026-10-21.md); siguen pendientes su aceptación
y el entorno público. Los resultados siguientes conservan el corte de implementación.

## Resultado

| Entrega | Implementación y alcance completado |
| --- | --- |
| A1 | Operador reactiva empresas suspendidas desde el portal con confirmación y motivo de 10–500 caracteres. Reutiliza endpoint, auditoría y conflictos existentes; roles ajenos no consultan la pantalla |
| A2 | Mi asistencia para el rol Trabajador: fecha, semana propia, zona, tramos, totales, alertas, incidencias y cierre. Reutiliza el resumen existente; sin nuevo cálculo ni acceso a otros empleados. Cuenta sin vínculo recibe orientación tras 403 |
| A3 | La consulta semanal entrega `acknowledgement` del cierre vigente. Web/Android recuperan el recibo del servidor, aunque se haya emitido desde otra sesión. Reapertura devuelve nulo; nueva versión no hereda acuse. Android usa copia local sólo con servidores anteriores que omitan el campo y rechaza un recibo de otro cierre |
| A4 | Administración exige contraseña nueva al próximo ingreso de una cuenta activa vinculada. Nuevo endpoint protegido por empresa/rol, confirmación en portal, integración técnica y auditoría. Conserva OTP y otras acciones; sin contraseña temporal, correo ni revocación de sesiones. Cliente técnico preparado y habilitado sólo en local |
| A5 | [Guion QA](qa-a1-a5.md) con datos ficticios, roles y 33 casos. Preparación y ejecución local completadas el 21 con acta; aceptación del usuario y pública pendientes |

Contrato **0.13.0, 62 operaciones**. El único endpoint nuevo es
`POST /users/{userId}/password-change`; el acuse se incorpora a la consulta
semanal existente. No se añadió dependencia ni migración. Los históricos y
las huellas de cierres permanecen en sus versiones existentes.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Backend | Construcción, unitarias y 75 pruebas de integración PostgreSQL aprobadas; cobertura de las 62 operaciones y esquemas |
| Portal | Compilación y 162 pruebas en 16 archivos aprobadas |
| Android | 13 unitarias, lint y ambos APK comprobados de nuevo. Samsung SM-S928B API 36: instrumentación FIXTURE aprobada, incluidos semana/acuse, recuperación sin copia local y reapertura. HTTP simulado; recorrido real/visual y tarjeta física pendientes |
| Identidad | 7 comprobaciones aisladas aprobadas. El nuevo ensayo verifica UPDATE_PASSWORD, acciones previas y el mismo ID de credencial OTP; niega administración de realm/clientes. Se repitió con alcance explícito y `fullScopeAllowed=false` |
| Contrato | OpenAPI y ejemplos válidos |
| Imágenes modificadas | Backend y portal reconstruidos y aprobados por el análisis de vulnerabilidades; sin altas o críticas sin atender |
| Arranque local | Backend `UP`, portal HTTP 200 con las acciones nuevas en su JavaScript, rutas personales/contraseña con 401 sin credencial. Secreto técnico montado sólo en backend y URL interna comprobados |

En el corte de implementación, la integración de backend se probó con proveedor HTTP aislado, errores y
aislamiento entre empresas. La prueba de Keycloak real usa un cliente y una
cuenta ficticios separados y los elimina al terminar. Ese corte no acreditaba
el recorrido completo portal/backend/Keycloak de contraseña/OTP en navegador;
se comprobó después, en A4-05 del acta local del 21.

Se conservaron las advertencias previas de Gradle, Vite y lint; no impidieron
las comprobaciones. La única corrección pendiente no es de compilación, sino
la aceptación manual y las decisiones de las tareas globales.

## Ambiente y credencial local

Portal: `http://localhost:8081`; backend: `http://localhost:18080`; identidad:
`http://localhost:8082`. Se reconstruyeron backend/portal sin borrar volúmenes
ni cambiar contraseñas o OTP de cuentas humanas. El esquema sigue en V008.

`infra/keycloak/prepare-local-password-admin.mjs` crea/verifica el cliente
confidencial `zenit-password-admin` sin flujos interactivos. Asigna y limita
el alcance al rol `manage-users` del realm, y guarda el secreto en
`secrets/identity-admin/identity_admin_client_secret`, ignorado por Git.
Se habilitó `IDENTITY_ADMIN_URL=http://keycloak:8082` sólo en `.env` local.
En configuraciones nuevas la URL queda vacía y la acción responde 503.

`manage-users` es una credencial privilegiada de realm. Sólo backend la
recibe y valida el sujeto/correo contra el usuario de la empresa antes de
actualizar `requiredActions`; el portal no recibe el secreto. No se habilita
administración pública. Ver [preparación y alcance](qa-a1-a5.md#preparar-el-cambio-obligatorio-en-local).

Keycloak no ofrece una operación CAS para la lista de acciones requeridas:
se conservan las leídas al preparar la actualización. Coordinar modificaciones
administrativas externas simultáneas. Tampoco hay transacción distribuida
entre el proveedor y auditoría: un error de transporte no permite afirmar que
la acción no ocurrió. Se responde 503 sin éxito falso ni reintento automático.

## Evidencias y pendientes

Registros locales, excluidos de Git:

- `build/a1-a4-backend.log`, `a1-a4-web-tests.log`, `a1-a4-web-build.log`.
- `build/a3-android.log` y artefactos extraídos bajo `build/a3-android-artifacts/`.
- `build/a4-identidad.log`, `a4-identidad-permisos.log`, `a4-cliente-local.log`.
- `build/a1-a4-contrato.log`, `a1-a4-imagenes.log` y `build/security/summary.json`.
- `build/a1-a4-arranque-local.log`, `a1-a4-http.json`, `a1-a5-diagramas.log`.
- `build/reanudacion-android-build.log`, `reanudacion-android-fixture.log`,
  `reanudacion-android-evidence.json` y `reanudacion-android-artifacts/`.

Las pruebas de roles, vínculo, 404 entre empresas, 409 por estado y 503 del
proveedor están en backend y portal. La instrumentación Android incluye
recuperación sin copia local, reapertura y nulo explícito del servidor.

El recorrido local por rol y el login/OTP real de A4 aprobaron el 21, con
renovación y salida. Permanecen abiertos la aceptación del usuario y pública,
el recorrido visual Android contra backend real/tarjetas físicas, recuperación de contraseña olvidada,
SMTP/cuentas operativas, despliegue público y las preguntas Q01–Q22.
Las 17 tareas globales no cambian de cantidad por cerrar estas cinco entregas
integradas. La nueva prueba de identidad aprobó dentro del workflow de la PR,
junto con backend, portal, Android y contrato/seguridad. CI no sustituye
la aceptación manual por caso ni las pruebas físicas.
