# Continuación con agentes — 6 de noviembre de 2026

Trabajo sobre el árbol local basado en `main/5b0a66c`, preservando todos los
cambios anteriores. Participaron tres agentes: portal, Android y evidencia E6;
la coordinación revisó infraestructura y verificó el portal completo.

## Entregado en esta continuación

- **Portal:** el ID y la huella SHA-256 del acuse permiten partir cadenas largas,
  con el mismo `overflowWrap: 'anywhere'` que ya usan expediente y exportes.
  La prueba existente usa una huella completa de 64 caracteres. Se conservan
  los controles previos de cierre vigente y reapertura. No hay cambios de API.
- **AWS:** ejemplo versionado `deploy/servidor/zenit/s3-policy.json.ejemplo` y
  propuestas privadas rellenadas para `Cliente-demo` en
  `secrets/hostinger/s3-policy.json` y `secrets/hostinger/s3-lifecycle.json`.
  JSON, acciones, recursos y prefijo comprobados; sin credenciales nuevas ni
  aplicación remota. La regla debe integrarse con las existentes antes de usarla.
- **Android:** regresión que cancela una espera de vigencia ya activa y comprueba
  que no emita otra actualización. No cambia código de producción ni habilita
  captura release o purga. La verificación Android se detalla abajo.
- **E6:** revisión de productor, aislamiento, autorización/descarga y callers
  de verificación/consulta, sin defecto nuevo confirmado. Un autoensayo Java
  comprobó que Jackson rechaza JSON adicional después de un registro; no se
  añadió una validación redundante ni se cambió el formato del expediente.

## Verificación y límites

| Comprobación | Resultado nuevo de esta continuación |
| --- | --- |
| Portal completo | **218 pruebas en 20 archivos aprobadas**, cero fallos; registro `build/qa-continuacion-20261106/portal-tests.log` |
| Acuse/expediente/flujo de expediente | **27 pruebas dirigidas aprobadas** por el agente portal |
| TypeScript | `npm run lint` aprobado por el agente portal |
| Build | Vite 8.1.0 aprobado; conserva aviso de bundle mayor de 500 kB |
| Propuestas AWS | JSON y campos comprobados localmente; archivos privados ignorados por Git |
| E6/JSON | Autoensayo Java aprobado contra las bibliotecas del JAR; diagnóstico en `build/qa-e6-local/DossierParserCheck.java` |
| Android/helper | **Tres escenarios aprobados** al compilar el helper de producción: vigencia, ausencia de espera futura y cancelación activa. Registro `build/android-policy-cancel-result.log` |
| Android/JUnit | Suite sin red bloqueada antes de ejecutar pruebas al resolver AGP 9.4.1; registro `build/android-cancel-test-20261106.log`. La regresión JUnit nueva sigue sin ejecutarse |
| Android/release | Inspección de fuentes/manifiestos: fixture sólo debug/no exportada y guard de captura conservado; sin APK nuevo ni ensayo físico |
| Docker | Acceso denegado a la tubería del motor; no se ejecutaron integración, respaldo Linux ni análisis de imágenes nuevos |
| Control visual | Tubería nativa inexistente y host del navegador indisponible; sin recorrido manual ni lector de pantalla nuevos |
| Diff | `git diff --check` sin errores de espacios |

Comandos nuevos del portal, desde la raíz salvo donde se indica:

```powershell
node web/node_modules/vitest/vitest.mjs run --config build/continuacion-qa/vitest.config.mjs --configLoader native --pool threads --maxWorkers 2 --reporter dot
# Desde web/:
npm run lint
node node_modules/vite/bin/vite.js build --configLoader native
```

La suite conserva avisos React de actualizaciones fuera de `act`.
El ajuste de texto usa un patrón existente y compila, pero aún requiere
comprobación visual a 320 px. Los ensayos PostgreSQL, MFA, archivo sin red y
Samsung anteriores conservan sus fechas y límites; no se repitieron sin cambios.

El autoensayo Android usa Kotlin 2.4.10 y coroutines 1.10.2 incluidos en
Gradle 9.8, con JDK 25; fuente en `build/android-policy-cancel-check.kt`.
Es una comprobación parcial del helper, no la suite del proyecto ni un APK.
Intento de suite desde `android/`, con caché local y dependencias offline:

```powershell
gradle :app:testDebugUnitTest --offline --no-daemon --console=plain '-Pkotlin.compiler.execution.strategy=in-process'
```

No se cambiaron dependencias para sortear la ausencia de AGP.

## Destino observado desde esta estación

`Resolve-DnsName zenit.fastsolution.com.mx -Type A -DnsOnly` devolvió un
CNAME a `fastsolution.com.mx`, cuya dirección A es distinta de la IP de
Hostinger declarada en privado. **La resolución observada todavía no dirige
el dominio al destino nuevo.** No se modificó DNS ni se retiró el servidor
anterior. La consulta HTTPS al estado del backend fue rechazada desde esta
sesión; no se acreditaron salud ni TLS del destino público.

El perfil SSH local sigue sin `identity` y `known_hosts`; usuario pendiente
y puerto 22 provisional. La distribución/versión, Docker efectivo y espacio
libre de la VPS todavía no se comprobaron. Nginx existente se preserva.

## Las 17 tareas: avance y condición que sigue faltando

| ID | Resultado o siguiente condición de cierre |
| --- | --- |
| 1 | IAM y lifecycle privados preparados. Faltan identidad AWS, clave pública age/custodios, timer y recuperación completa medida en el destino |
| 2 | Se conserva la identidad local ya probada. Faltan SMTP, cuentas/personas, turnos y soporte con doble aprobación ensayado |
| 3 | Referencia del acuse mejorada en portal. Faltan condiciones del empleador, texto/versionado y acuerdo/evidencia del acuse |
| 4 | Captura release permanece protegida. Faltan protocolo, tarjetas auténticas y provisión/custodia de claves |
| 5 | Reglas implementadas previamente; falta aceptación por roles en el destino |
| 6 | Dominio, IP y recursos declarados. Faltan SSH completo, preparación administrativa e integración nginx/DNS/TLS comprobada |
| 8 | Se conserva delegación/aplazamiento. Falta evidencia del desarrollador asignado desde dos IP públicas reales |
| 9 | Portal completo y build aprobados con la corrección nueva. Faltan recorridos por roles, accesibilidad manual y aceptación pública |
| 10 | Sin purga. Faltan custodia recuperable de sobres rechazados, fidelidad de recibos y disponibilidad de duplicados |
| 12 | Sin acceso al destino no hay inventario efectivo ni análisis nuevo de sus imágenes |
| 13 | Regresión de cancelación añadida y tres escenarios del helper aprobados; JUnit nuevo pendiente. Los ensayos visuales previos conservan su alcance. Faltan sesión integrada/reanudación real, SUP-025 y aceptación desplegada |
| 15 | E6 revisada sin cambios redundantes; ensayo real anterior vigente. Faltan documento histórico/evidencia ausente, custodia y aceptación integral/pública |
| 16 | Pantallas de operador existentes; falta aceptación con sesión en el destino |
| 17 | Faltan horarios, reglas operativas y casos del empleador para ausencias/puntualidad |
| 18 | Recursos recibidos: 2 CPU, 8 GB RAM, 50 GB disco. Faltan objetivos concurrentes y carga/continuidad comprobadas en la VPS |
| 19 | Faltan sistema/versión de nómina, contrato de intercambio, muestra ficticia y aceptación del cliente |
| 20 | Faltan alcance/consumidores aceptados y resultados de las dependencias antes de congelar 1.0 |

Se mantienen **17 tareas abiertas total o parcialmente y seis P0**. Esta
continuación entrega cambios locales revisables; no publica commits, concede
permisos AWS, conecta por SSH, despliega, cambia DNS ni elimina datos.
Las respuestas que faltan siguen en [el formulario de cierre](datos-para-finalizar-tareas.md).
