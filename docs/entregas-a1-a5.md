# Entregas locales A1–A5 — 20 de octubre de 2026

Implementación local sobre `1984be3`, autorizada por el usuario después de la
declaración de tareas. No se cambiaron las decisiones pendientes de jornada,
suspensión, baja, supervisor, retención o NFC. No se desplegó el servidor
público. Para la PR se incorporan los avances de `origin/main`/`ef23c20`,
incluido el modelo SaaS aprobado; se conservan las pruebas locales de este
corte y la nueva ejecución de CI comprobará la integración propuesta.

## Resultado

| Entrega | Implementación y alcance completado |
| --- | --- |
| A1 | Operador reactiva empresas suspendidas desde el portal con confirmación y motivo de 10–500 caracteres. Reutiliza endpoint, auditoría y conflictos existentes; roles ajenos no consultan la pantalla |
| A2 | Mi asistencia para el rol Trabajador: fecha, semana propia, zona, tramos, totales, alertas, incidencias y cierre. Reutiliza el resumen existente; sin nuevo cálculo ni acceso a otros empleados. Cuenta sin vínculo recibe orientación tras 403 |
| A3 | La consulta semanal entrega `acknowledgement` del cierre vigente. Web/Android recuperan el recibo del servidor, aunque se haya emitido desde otra sesión. Reapertura devuelve nulo; nueva versión no hereda acuse. Android usa copia local sólo con servidores anteriores que omitan el campo y rechaza un recibo de otro cierre |
| A4 | Administración exige contraseña nueva al próximo ingreso de una cuenta activa vinculada. Nuevo endpoint protegido por empresa/rol, confirmación en portal, integración técnica y auditoría. Conserva OTP y otras acciones; sin contraseña temporal, correo ni revocación de sesiones. Cliente técnico preparado y habilitado sólo en local |
| A5 | [Guion QA](qa-a1-a5.md) con datos ficticios, matriz de roles y 33 casos con resultados esperados y limpieza. Preparación terminada; sesión manual pendiente |

Contrato **0.13.0, 62 operaciones**. El único endpoint nuevo es
`POST /users/{userId}/password-change`; el acuse se incorpora a la consulta
semanal existente. No se añadió dependencia ni migración. Los históricos y
las huellas de cierres permanecen en sus versiones existentes.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Backend | Construcción, unitarias y 75 pruebas de integración PostgreSQL aprobadas; cobertura de las 62 operaciones y esquemas |
| Portal | Compilación y 162 pruebas en 16 archivos aprobadas |
| Android | 13 unitarias, lint y APK debug/de instrumentación compilados; los nuevos casos de instrumentación no se ejecutaron por falta de teléfono |
| Identidad | 7 comprobaciones aisladas aprobadas. El nuevo ensayo verifica UPDATE_PASSWORD, acciones previas y el mismo ID de credencial OTP; niega administración de realm/clientes. Se repitió con alcance explícito y `fullScopeAllowed=false` |
| Contrato | OpenAPI y ejemplos válidos |
| Imágenes modificadas | Backend y portal reconstruidos y aprobados por el análisis de vulnerabilidades; sin altas o críticas sin atender |
| Arranque local | Backend `UP`, portal HTTP 200 con las acciones nuevas en su JavaScript, rutas personales/contraseña con 401 sin credencial. Secreto técnico montado sólo en backend y URL interna comprobados |

La integración de backend se probó con proveedor HTTP aislado, errores y
aislamiento entre empresas. La prueba de Keycloak real usa un cliente y una
cuenta ficticios separados y los elimina al terminar. No acredita todavía el
recorrido completo portal/backend/Keycloak de contraseña/OTP en navegador.

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

Las pruebas de roles, vínculo, 404 entre empresas, 409 por estado y 503 del
proveedor están en backend y portal. La instrumentación Android incluye
recuperación sin copia local, reapertura y nulo explícito del servidor.

Permanecen abiertos el recorrido manual por rol, login/OTP real de A4,
instrumentación/tarjetas físicas, recuperación de contraseña olvidada,
SMTP/cuentas operativas, despliegue público y las preguntas Q01–Q22.
Las 17 tareas globales no cambian de cantidad por cerrar estas cinco entregas
locales. GitHub Actions de `1984be3` corresponde al código previo; la nueva
prueba de identidad está incorporada al workflow de la PR. Los resultados de
esa ejecución deben consultarse en la PR; no sustituyen la aceptación manual.
