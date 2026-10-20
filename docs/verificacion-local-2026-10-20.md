# Verificación del ambiente local — 20 de octubre de 2026

Código verificado: `main`, commit `565dbdda2561b823cf4e4bce22cb45222d1966a6`.
Se conservaron los cambios preexistentes bajo `backend/bin/`. Esta revisión
actualiza la evidencia local; no acredita despliegue público, QA del usuario
ni aceptación para operar con datos reales.

## Estado del ambiente

Al comenzar, Docker Desktop estaba detenido y los cinco servicios locales
estaban apagados. Se inició Docker, se reconstruyeron las imágenes del código
actual y se levantó el ambiente conservando los volúmenes y secretos existentes.

La base local estaba en V007. El servicio `migrate` aplicó V008 y terminó con
código 0; se comprobaron las ocho migraciones exitosas. Quedan en ejecución
backend, portal, PostgreSQL y Keycloak, los dos últimos saludables. Los IDs de
las cuatro imágenes en ejecución coinciden con los del análisis de seguridad.
La identidad aislada y PostgreSQL de integración se retiraron al terminar.

| Servicio | Dirección local | Comprobación |
| --- | --- | --- |
| Backend | `http://localhost:18080/actuator/health` | HTTP 200, estado `UP` |
| Portal | `http://localhost:8081` | HTTP 200 y JavaScript servido correctamente |
| Identidad | `http://localhost:8082/realms/zenit/.well-known/openid-configuration` | HTTP 200 y emisor local correcto |
| API protegida | `/api/v1/me`, directo y por el portal | HTTP 401 esperado sin credenciales |

La CSP del portal permite la identidad local. El backend usa 18080 por la
configuración existente de `.env`, en lugar del puerto 8080 por omisión.
`CAPTURE_SIMULATED_CARDS=true` sigue habilitado para pruebas ficticias.

## Resultados repetidos

| Área | Resultado del 20 de octubre |
| --- | --- |
| Backend | Construcción, unitarias y clases del simulador aprobadas; 74 pruebas de integración PostgreSQL aprobadas |
| Portal | Compilación aprobada; 151 pruebas en 15 archivos aprobadas, ejecutadas sin red |
| Android | 13 unitarias aprobadas, sin omisiones ni fallos; lint con 0 errores y 13 advertencias; APK debug y de instrumentación compilados |
| Identidad aislada | 6 comprobaciones aprobadas, sin omisiones: importación, OTP, PKCE, recuperación y readiness HTTP 200/503 |
| Contrato | OpenAPI 0.12.0 y ejemplos válidos; 61 operaciones |
| Secretos | 57 commits examinados; sin hallazgos |
| Imágenes | Backend, portal, base, identidad y respaldo reconstruidos y analizados; ninguna alta o crítica sin atender |
| Respaldo tras V008 | Restauración desechable de 131 tablas y 1,970 filas con contenido idéntico al origen, en 6 segundos |

El respaldo posterior a V008 incluye 30 tablas/213 filas de la base del
producto y 101 tablas/1,757 filas de identidad. Los conteos incluyen tablas
técnicas, como el historial de Flyway. El ensayo anterior a la migración
también pasó: 130 tablas/1,980 filas. Son cortes distintos de bases activas.
Ninguno conserva una copia operativa ni sustituye recuperación completa con
el origen apagado y secretos nuevos, cuyo último ensayo es el del 18.

| Imagen | Medias | Bajas | Desconocidas | Excepciones previas |
| --- | --- | --- | --- | --- |
| Backend | 15 | 0 | 0 | 0 |
| Portal | 4 | 0 | 0 | 0 |
| Base | 4 | 0 | 0 | 0 |
| Identidad | 30 | 29 | 0 | 6 altas aceptadas en `.grype.yaml` |
| Respaldo | 4 | 0 | 2 | 0 |

El portal mantiene la advertencia de Vite por un archivo mayor de 500 kB.
Gradle del backend informa usos obsoletos incompatibles con Gradle 10.
Estas advertencias no impidieron las verificaciones y no se corrigieron en
esta revisión.

## Avance funcional y pendientes

- Semana y acuse Android ya usan los endpoints existentes y conservan un
  recibo local cifrado. Falta el recorrido real, recuperar acuses desde otro
  dispositivo, historial completo y cerrar las reglas/evidencia del acuse.
- Android ya incluye bienvenida, administración mediante portal HTTPS y
  lectura/carga/borrado MF1K con datos de ejemplo. No demuestra captura
  autenticada: el backend todavía sólo verifica el esquema simulado.
- Configuración de empresa y personas bloqueadas por corrida están en el
  portal local reconstruido, y V008 está aplicada. Falta aceptar sus pantallas
  y permisos con sesiones reales, y comprobar el despliegue público.
- El operador todavía sólo tiene alta y listado de empresas en el portal.
  Suspensión/reactivación y cambio obligatorio de contraseña siguen pendientes.
- `adb devices -l` no mostró teléfonos. No se instaló APK ni se ejecutó
  instrumentación, NFC, login/OTP integrado o semana/acuse en teléfono.
- No se repitieron sesión completa del navegador, pruebas públicas de proxies,
  release Android, recuperación completa ni pruebas de carga. La prueba con
  datos móviles conserva su entrega a otro desarrollador.

Se mantienen **17 tareas abiertas total o parcialmente**, incluidos los seis
P0. Sus prioridades y decisiones están en [Tareas pendientes](TareasPendientes.md).

## GitHub Actions antes de publicar la documentación

Por solicitud del usuario se ejecutó manualmente `Verificaciones` sobre
`main`/`565dbdda2561b823cf4e4bce22cb45222d1966a6`, antes del push de estos
documentos. Los cuatro trabajos aprobaron: backend, portal, Android y
contrato/seguridad. [Ejecución 39472077601](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39472077601).

El resultado acredita ese código en CI. El push de documentación dispara
otra ejecución, que corresponde a su nuevo commit. No acredita un despliegue
ni los recorridos manuales pendientes. El registro local está en
`build/actions-pre-push-2026-10-20.log` y los trabajos en
`build/actions-39472077601.json`.

## Evidencia local y repetición

Los registros están bajo `build/`, excluido de Git. Prefijo de esta ejecución:
`verificacion-local-2026-10-20-`.

| Sufijo | Evidencia |
| --- | --- |
| `backend.log` | Construcción, unitarias e integración |
| `web-build.log`, `web-tests.log` | Compilación y 151 pruebas del portal |
| `android.log`, `android-artifacts/` | Construcción, XML de unitarias, lint y APK |
| `identidad.log` | Las 6 comprobaciones con Keycloak aislado |
| `contrato.log`, `secretos.log` | Contrato y revisión del historial |
| `imagenes-build.log`, `seguridad.log` | Construcción y aprobación de las cinco imágenes |
| `arranque.log`, `inventario.json` | Arranque, V008, IDs, fechas y resultados de seguridad |
| `http.json` | Las 6 comprobaciones HTTP aprobadas |
| `respaldo-v008.log` | Comparación íntegra posterior a V008 |
| `limpieza.log` | Retirada de los contenedores desechables |

Los informes detallados de seguridad están en `build/security/`, con IDs y
fechas en `summary.json`. Las huellas de los registros y de los dos APK están
en `build/verificacion-local-2026-10-20-huellas.json`.

| APK extraído de la imagen comprobada | SHA-256 |
| --- | --- |
| `app-debug.apk` | `A15BFF33F631E6373733E6279089DBE8335CA44E218CA871F315A3349829B73C` |
| `app-debug-androidTest.apk` | `F356F50ED0038B49FB05CE73955B190F56F742CEE661896F7E30AB281B582633` |

Para repetir, se usaron las recetas del [workflow](../.github/workflows/verificaciones.yml):
`backend-it`, `contract-lint`, `secret-scan`, construcción del portal y
`pnpm test` en su imagen sin red, y construcción de `android/Dockerfile`.
Se ejecutaron además `infra/check-images.ps1`, `backup-rehearsal` y los tests
Node de identidad con `infra/keycloak/compose.test.yaml` y secretos aislados.
El [entorno local](entorno-local.md) y las [verificaciones automáticas](verificaciones-automaticas.md)
conservan los procedimientos.
