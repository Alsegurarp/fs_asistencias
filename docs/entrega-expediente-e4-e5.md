# E4/E5 — Verificación nueva y portal del expediente

**Seguimiento del 28 de octubre:** la PR #21 está integrada en la rama E2/E3,
no en `main/fa2396d`: se integró después de la PR #20. La rama
`feat/expediente-e4-e6-qa` incorpora esa entrega para publicarla junto con
[E6 técnica](entrega-expediente-e6.md) y QA Android contra main. La repetición
local aprobó 67 unitarias/88 integraciones, 189 pruebas web y ocho pruebas
de identidad real sin omisiones (no se repitieron las tres pruebas auxiliares
de imagen/readiness en esa batería). El JAR E6 se ejecutó sin red. El acta
siguiente conserva los resultados y el estado de publicación del 27;
la historia visual de Chrome de ese día no se atribuye a otra ejecución.

Entrega técnica local del **27 de octubre de 2026**, en
`feat/expediente-e4-e5`, sobre la entrega E2/E3 `15c538f`. Implementa las
ocho operaciones del expediente en **OpenAPI 0.15.0**, conservando formato 1
y los permisos del CSV semanal. E6 sigue pendiente; descargar no autoriza
borrado del servidor ni purga Android. No hay despliegue público de esta entrega.

Publicada en la [PR #21](https://github.com/Alsegurarp/fs_asistencias/pull/21),
abierta y sin borrador, con commit funcional
`ba953047b24185534707e5fb77703abfd7ef5e08`. Base
`feat/expediente-e2-e3`, porque la PR #20 sigue abierta; el diff sólo incluye
E4/E5. Después de integrar #20, cambiar la base de #21 a `main` antes de
integrarla. [CI remoto](https://github.com/Alsegurarp/fs_asistencias/pull/21/checks)
en curso al publicar; no se acredita su éxito con las pruebas locales.

## Implementación

V010 incorpora `dossier_challenge` y `dossier_authorization`. Las FK incluyen
empresa, expediente y solicitante; una autorización sólo procede de un desafío.
State, nonce y autorización opaca se guardan como SHA-256; el verificador PKCE
no se persiste en servidor. El desafío dura hasta cinco minutos y la
autorización hasta 60 segundos, limitados por las 24 horas del expediente.

Cada operación revalida empresa, cuenta, vínculo, solicitante y permiso
explícito. Las versiones de permiso, cuenta y empresa impiden revivir una
prueba al revocar/conceder, deshabilitar/reactivar o suspender/reactivar. Otro
desafío invalida los anteriores de ese expediente. Un canje fallido o de
resultado incierto consume el desafío y exige otro.

El backend canjea únicamente un código OIDC con PKCE S256, cliente y retorno
configurados. Valida firma/JWKS, issuer, audiencia, sujeto, nonce, ACR 2,
emisión, expiración y cliente autorizado. Un token normal o renovado no se
admite como sustituto del código. El consumo transaccional de autorización y
expediente ocurre antes de transmitir; la segunda descarga recibe 410.

La entrega copia los bloques SQL a un temporal privado, sin reunir el ZIP en
memoria. La copia independiente evita que el mantenimiento SQL trunque una
respuesta en curso. Se elimina al terminar o interrumpirse; el mantenimiento
reintenta fallos y retira huérfanos. La respuesta usa `no-store`, nombre UUID
y no admite Range. Una interrupción después del consumo requiere otro expediente.

El portal permite a administración conceder/revocar desde **Usuarios**, con
confirmación explícita. **Expediente empresarial** aparece por permiso propio,
independientemente del rol. Incluye solicitud idempotente, seguimiento,
vencimiento, huellas, manifiesto, verificación y descarga por POST. Conserva
temporalmente state/verificador/código OIDC en `sessionStorage` para el retorno;
los elimina antes del canje. La autorización de descarga sólo vive en memoria.
Salir, cambiar de cuenta, cancelar o perder la respuesta exige otra verificación.

El callback del cliente dedicado se captura antes de inicializar Keycloak JS.
Después se restablece la sesión normal del portal mediante `check-sso`; el
usuario pulsa **Continuar con la descarga verificada**. Así el código del
expediente no se canjea como código del portal ni se consume dos veces por
el montaje de React StrictMode.

## Configuración efectiva de identidad

El [realm versionado](../infra/keycloak/realm/zenit-realm.json) incorpora
`zenit-dossier` y los flujos `dossier-browser`, `dossier-auth`,
`dossier-password` y `dossier-otp`. El retorno es exactamente
`${ZENIT_PORTAL_URL}/dossier/callback`; sin comodines, acceso por contraseña,
grants implícitos ni cuenta de servicio. PKCE S256 obligatorio, ACR mínimo 2,
mapa ACR/LoA `{"1":1,"2":2}` y nivel OTP con edad máxima cero.

El flujo normal `browser` conserva MFA. La primera entrada al cliente dedicado
puede pedir nuevamente contraseña aunque exista SSO del portal: ese flujo
normal no registra el nivel LoA del cliente nuevo. Las operaciones siguientes
siguen exigiendo OTP nuevo aun con SSO. Pedir ACR esencial 1 se rechaza; pedir
`acr_values=1` tampoco reduce el mínimo 2. Esta política y su mapa son
necesarios para impedir que el cliente cree una sesión sólo con contraseña.
Referencia: [administración de Keycloak 26.8.1](https://www.keycloak.org/docs/26.8.1/server_admin/).

`compose.yaml` fija el retorno a `${PORTAL_URL}/dossier/callback` y el canje
interno a `http://keycloak:8082/realms/zenit/protocol/openid-connect/token`.
Fuera de Compose, configurar `DOSSIER_REDIRECT_URI` y `DOSSIER_TOKEN_URI`
junto al issuer/JWKS de identidad; el cliente del portal y el retorno deben
corresponder al mismo origen. El perfil `migrate` no inicializa OIDC ni sus rutas.

**Realm existente:** Keycloak omite la importación si `zenit` ya existe.
Reiniciar no actualiza clientes ni flujos. En el servidor compartido lo hace
el paso `identidad` del despliegue
([despliegue](despliegue-en-servidor.md#desplegar-una-versión-nueva-de-zenit)).
En cualquier otro entorno, su administrador debe aplicar los cuatro flujos y
sus dos configuraciones de autenticador desde el export, crear el cliente
dedicado y vincular su override `browser` al ID real del flujo importado.
Comprobar retorno
exacto, mapa/mínimo ACR, S256 y OTP edad cero mediante API administrativa y
ejecutar el ensayo MFA. No sustituir el realm completo ni eliminar cuentas.
El ensayo local aplicó la configuración sólo a su realm ficticio.

## Pruebas y evidencia

| Comprobación | Resultado local |
| --- | --- |
| Backend unitario | 64 aprobadas; incluye PKCE, strings estrictos, temporales y perfil de migración |
| Backend con PostgreSQL real | 88 aprobadas; incluye cinco historias nuevas E4 y regresión E2/E3/CSV |
| Portal | 189 aprobadas en 18 archivos; compilación TypeScript/Vite aprobada |
| Identidad real Keycloak 26.8.1 | 11 aprobadas, ninguna omitida; importa los flujos versionados en un realm desechable |
| Contratos | Ambos OpenAPI válidos con el linter del proyecto |
| Modelos | 34 entidades y 55 relaciones; SVG con PlantUML 1.2025.10 y 1.2026.8, sin excepción de Smetana |
| Navegador Chrome real | Cuatro comprobaciones de la historia siguiente aprobadas |

Las integraciones prueban firma/emisor/audiencia/sujeto/nonce/nivel incorrectos,
state/PKCE alterados, caducidad, canje fallido/no repetible, acceso ajeno,
revocación/restauración y concurrencia: un canje y una entrega. El OIDC de esas
integraciones usa un proveedor HTTP de prueba y JWT realmente firmado; la
batería de identidad y el navegador usan Keycloak real. El portal comprueba
los cinco roles con/sin permiso, confirmación de concesión/revocación,
cancelación/expiración/cambio de cuenta, pérdida de respuesta y CSV sin cambios.

### Historia comprobada en navegador

Entorno desechable `zenit-e4-e5-check`, PostgreSQL separado, cuentas
`example.invalid`, backend 38080, portal 38081 e identidad 38082. Ejecución
del 27 a las **17:16:31–17:17:02 UTC**:

1. El operador crea una empresa ficticia; su administradora inicia sesión con
   contraseña y OTP. Sin concesión explícita no aparece la pestaña del expediente.
2. La administradora confirma su permiso en Usuarios, solicita el archivo y
   observa `Listo`, vencimiento y SHA-256.
3. Abre la verificación teniendo SSO. Introduce contraseña cuando se solicita;
   un OTP incorrecto no devuelve código. Introduce un OTP nuevo, retorna al
   portal y continúa la descarga verificada. Se guarda el ZIP íntegro y se
   eliminan las dos entradas temporales de `sessionStorage`.
4. El expediente queda `downloaded`; repetir devuelve 410. Revocar desde
   Usuarios retira la pestaña. SHA-256 del ZIP descargado:
   `23887d413521fb783e32aaf69668201f6a13e65e616cc320de0aca79115abe3e`.

Evidencia local ignorada por Git: `build/e4-e5-qa/results.json`, capturas
`01-ready.png`, `02-fresh-otp.png`, `03-downloaded.png`, ZIP ficticio y logs
`build/e4-e5-identity.log`, `build/e4-e5-web-test-results.log`,
`build/e4-e5-contract-lint.log`, y la ejecución final del backend en
`build/e4-e5-release-integration.log`. Los XML del backend están en
`build/e4-e5-final-results/`; los logs del ensayo no distribuyen credenciales.
Las pruebas permanentes viven en `backend/src/test/`, `web/src/*.test.*` e
`infra/keycloak/*.test.mjs`.

Los 96 archivos de fuentes/recursos del backend coinciden por SHA-256 con el
contenedor que aprobó la ejecución final: 64/88 pruebas, cero fallos, errores
u omisiones. El diff preparado pasó el análisis de secretos sin hallazgos;
253 enlaces locales de los documentos modificados apuntan a destinos existentes.
El entorno de QA y la base `db-it` quedaron detenidos y retirados después de
guardar los resultados; se conservan la evidencia local y los secretos ficticios
ignorados por Git.

Para repetir las suites, usar las órdenes Docker existentes de
[verificaciones automáticas](verificaciones-automaticas.md). Para la batería
de identidad usar sus secretos aislados en `IDENTITY_TEST_SECRETOS`; si el portal
del ensayo usa otro puerto, declarar `IDENTITY_TEST_PORTAL_URL` con su retorno
normal permitido. El guion de navegador anterior también sirve como aceptación
manual. Los modelos mantenidos siguen siendo los [`.puml`](dbFlow/README.md).

E6 debe comprobar consulta y recuperación independiente, alteración/truncamiento
y aceptación del responsable; conserva Q07/Q14. No se atribuyen a esta entrega
CI remoto, despliegue, prueba de teléfono ni aceptación jurídica/pública. Los
cambios previos/generados de `backend/bin/` se conservan fuera de su alcance.
