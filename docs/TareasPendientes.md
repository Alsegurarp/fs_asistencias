# Tareas pendientes

**Avance local del 27 de octubre: E2/E3 completadas en alcance técnico.**
[Permiso y preparación del expediente](entrega-expediente-e2-e3.md), con
60 unitarias y 83 integraciones aprobadas, incluidos historia completa,
concurrencia y perfiles anuales 50/300. Continúan E4 → E5 y después E6.
La descarga sigue cerrada; PR en preparación, sin despliegue. El diagrama
de relaciones ya es compatible con PlantUML 1.2025.10 y 1.2026.8. Los cortes
siguientes son históricos y no sustituyen esta entrega.

**Revisión anterior del 27 de octubre, previa a E2/E3.** Véase la
[verificación E2–E5](verificacion-e2-e5-2026-10-27.md): E1 integrada mediante
PR #19, CI de la PR aprobado en sus cuatro trabajos; E2–E5 pendientes de
implementación en el orden **E2 → E3/E4 → E5**. Docker disponible, servicios
detenidos; sin pruebas locales nuevas. E6 conserva recuperación/aceptación y
Q07/Q14. Los cortes siguientes son históricos.

**Corte anterior: 26 de octubre de 2026.** Véase el
[listado verificado para desarrollo](tareas-desarrollo-2026-10-26.md): E1
entregada como [contrato/formato candidato](contrato-expediente-e1.md), con
ocho pruebas nuevas aprobadas. E2 es el siguiente desarrollo; E3–E5 conservan
sus dependencias internas y E6 su cierre
integral condicionado. PR #15/#16 integradas; cuatro trabajos de CI aprobados
para la base main/5d7b783. Docker disponible para la validación de E1. Se mantienen
17 tareas globales abiertas y seis P0. Los cortes siguientes son históricos.

Entrega E1 publicada en `b5aff1f` mediante la
[PR #19](https://github.com/Alsegurarp/fs_asistencias/pull/19), abierta y sin
integrar. Validación local: 56 unitarias (ocho nuevas), 75 integraciones y
ambos contratos válidos; secretos sin hallazgos. CI remoto en curso al corte
del 26 a las 23:15 de Ciudad de México. La
[bitácora](bitacora-trabajo.md#tarea-realizada-y-trabajo-restante) registra
la entrega, evidencia y lista E2–E6 por dependencia.

Actualización posterior del **23 de octubre de 2026**: metas de expediente
empresarial/MFA aprobadas y ensayo aislado de identidad 10/10 sin omisiones.
Se declaran [E1–E6 para implementación](expediente-empresa.md#tareas-declaradas-para-implementación):
contrato, permiso, archivo íntegro, autorización por descarga, portal y
recuperación independiente. Todas abiertas; la prueba no habilita todavía
expedientes ni purga. Son subtareas de órdenes existentes y se conservan
17 tareas globales abiertas y seis P0.

Último corte del **23 de octubre de 2026**: las tareas de sesión 1/2 tienen
validación local y cuatro trabajos de CI aprobados para `ffa8306` en la
[PR #15](https://github.com/Alsegurarp/fs_asistencias/pull/15), aún en borrador
y sin integrar en `main`. La base legal de 3/5 fue indicada por el usuario
y [documentada](revision-juridica-jornada-acuse.md); faltan las capacidades y
opciones operativas allí señaladas. Identidad conserva Q03/Q04. El conteo
global y los requisitos para datos reales permanecen abiertos.

Avance anterior del **23 de octubre de 2026**: respaldo concurrente
aprobado localmente y paso de CI preparado; [evidencia y límites](bitacora-trabajo.md#23-de-octubre-de-2026--respaldo-concurrente-validado-y-preparación-de-ci).
Las tareas de sesión 3–5 requieren respuestas Q14, Q03/Q04 y Q10–Q13.
No cambia el conteo global ni se habilita el uso con datos reales.

Revisión anterior del **23 de octubre de 2026**, sobre `main`/`0723baf`, con PR #13/#14
integradas según el historial local. El autoensayo concurrente de respaldo y
su paso de CI tienen cambios locales sin commit; el único registro del 23
muestra acceso denegado a Docker y no acredita su validación. La
[lista de tareas posibles](tareas-criticas-primero.md#tareas-posibles-desde-el-corte-del-23-de-octubre)
separa ese siguiente trabajo de las decisiones y recursos externos.
Permanecen 17 tareas abiertas y seis P0; el servidor público sigue diferido.

Actualización del **22 de octubre de 2026**, desde `main`/`ad21177`:
[horarios/importación local 17/17, carga 50/300 y revisión de imágenes](qa-local-2026-10-22.md).
El [análisis de retención Android](retencion-android.md) está entregado;
su implementación conserva Q14. El servidor público queda diferido.
Se mantienen 17 tareas abiertas total o parcialmente; el corte siguiente es histórico.

Estado documental revisado el **21 de octubre de 2026**, sobre `main`/`907a93a`:
A1–A5 integradas mediante la [PR #10](https://github.com/Alsegurarp/fs_asistencias/pull/10),
con los cuatro trabajos de [CI aprobados](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39504126988).
Las [entregas y verificaciones](entregas-a1-a5.md) actualizan el avance técnico;
el [guion de QA](qa-a1-a5.md) conserva la aceptación manual pendiente.
Incluye los avances Android de semana/acuse, bienvenida, administración
integrada y herramientas MF1K. La [verificación local del 20](verificacion-local-2026-10-20.md)
actualiza la evidencia técnica; la QA funcional del usuario y la aceptación
del ambiente publicado conservan sus pendientes. El [corte del 19](evidencia-avance-2026-10-19.md)
se conserva como antecedente.
Hay **17 tareas abiertas total o parcialmente**.
El [recorrido visual Android de semana/acuse](qa-android-semana-acuse-2026-10-21.md)
aprobó contra backend real local el 21: objeción, recuperación sin copia
local, reapertura, versión nueva y conformidad. Entorno local levantado;
teléfono restaurado y recursos ficticios deshabilitados al terminar.
El 21 se ejecutaron los [33 casos A5 en local](qa-a1-a5-2026-10-21.md),
incluidos login/OTP real, renovación/salida, configuración y bloqueos por rol.
Eso completa la aceptación técnica local de ese guion; no cierra el
inventario/despliegue público ni la aceptación del usuario de las tareas globales.
La [declaración de trabajo ejecutable y preguntas para QA](tareas-ejecutables-y-preguntas-qa.md)
revisada sobre `1984be3` identifica cinco entregas locales y las 22 preguntas
que desbloquean decisiones, recursos y aceptación. Los cuatro trabajos de
[Actions para ese commit](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39472918113)
aprobaron. Las entregas integradas no equivalen al cierre completo de sus tareas.
La numeración corresponde a la columna **Orden** de
[Tareas críticas primero](tareas-criticas-primero.md), que conserva los criterios
detallados de aceptación y las dependencias.

## Tareas completadas en su alcance

| Orden | Tarea | Evidencia y alcance |
| --- | --- | --- |
| 7 | Android reproducible contra backend | Personal y terminal comprobados en teléfono contra backend local y HTTPS, con tarjeta simulada, cola, sincronización, recibos y renovación. No acredita tarjeta física autenticada ni apagado real de radios |
| 11 | Verificaciones automáticas por cambio | Workflow integrado en `main`. Backend, portal, Android y contrato/seguridad aprobaron para `8a86916` en la [ejecución 39365266093](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39365266093). Configurar los trabajos como obligatorios antes de integrar cambios sigue siendo una decisión adicional |
| 14 | Personas que no pudieron cerrar y sus causas | Contrato 0.12, V008, registro transaccional, consulta paginada y portal con nombres/causas/incidencias. Corte original: 74 integraciones y 151 pruebas web; CI para `8a86916`. Navegador y paginación aceptados en A5 local el 21; despliegue y aceptación pública/del usuario pendientes. Corridas antiguas conservan sólo conteos |

## Tareas abiertas

**P0:** necesarias antes de operar con datos reales. **P1:** validación del
piloto y siguiente trabajo técnico. **P2:** completar alcance y aceptación.

| Orden | Prioridad | Tarea pendiente | Qué falta para completarla |
| --- | --- | --- | --- |
| 1 | P0 | Respaldo externo y recuperación completa | Modelo SaaS aprobado: backend/PostgreSQL compartidos con aislamiento lógico por empresa y respaldo externo de Zenit, cifrado y fuera del dominio de falla de producción. Perfiles de 50/300 empleados, cuatro marcajes diarios y un año consultable. Faltan destino, custodia, automatización y ensayo de recuperación; bases dedicadas sólo en modalidad Enterprise |
| 2 | P0 | Identidad operativa, cuentas personales, OTP y SMTP | A4 implementa y prueba el cambio obligatorio para cuentas activas vinculadas; cliente técnico preparado sólo en local. Falta provisión/aceptación pública, recuperación de acceso olvidado, cuentas personales, SMTP y recuperación del operador |
| 3 | P0 | Jornada y evidencia del acuse | Obtener dictamen profesional y criterios aprobados; implementar reglas, casos esperados y evidencia versionada conservando históricos |
| 4 | P0 | Captura autenticada con tarjetas reales | Android ya incluye lectura, carga y borrado de credenciales MF1K de ejemplo. Falta validación física y autenticación integrada de asistencia: el backend sólo verifica el esquema simulado; definir tecnología y custodia de claves |
| 5 | P0 | Suspensión, baja, supervisor y tipo de marcaje | Elegir las reglas propuestas y después implementar sus efectos sobre permisos, captura e históricos |
| 6 | P0 | Producción administrada para datos reales | El modelo está aprobado: producción exclusiva de Zenit bajo control de fastSolution y aislamiento lógico por empresa. Faltan proveedor, región, cuenta, contratos, respaldo externo, restauración y pruebas. El servidor compartido conserva sólo datos ficticios |
| 8 | P1 | Dirección real y protocolo entre proxies | Comprobar que dos IP públicas reales conservan cuotas independientes en la misma ventana. Las pruebas públicas de HTTPS y cabeceras falsas ya pasaron |
| 9 | P1 | Recorridos del portal con sesión real | A5 local aprobado el 21; horarios/importación y permisos en navegador local 17/17 el 22. Faltan inventario/versión, recorrido público y aceptación del usuario; API HTTPS del 19 conserva su evidencia |
| 10 | P1 | Retención de sobres y recibos Android | Análisis de Room, acuses y evidencia en servidor entregado el 22. Definir plazo y conservación en Q14; después implementar purga acotada con protección de pendientes |
| 12 | P1 | Imágenes y correcciones del servidor | Obtener IDs y versión desplegada mediante el interlocutor SSH, analizar esas imágenes, desplegar correcciones y verificar públicamente. El análisis local y el de CI ya aprobaron |
| 13 | P2 | Configuración de empresa y dispositivos en portal | Pantallas y permisos aceptados técnicamente en A5 local el 21. Faltan inventario/despliegue y aceptación pública y del usuario |
| 15 | P2 | Semana y acuse del trabajador | A2/A3, A5 local e instrumentación aprobados. Recorrido visual Android contra backend real local aprobado el 21, con objeción, recuperación, reapertura y conformidad. Faltan aceptación pública/del usuario y expediente; evidencia/reglas dependen del orden 3 |
| 16 | P2 | Pantallas del operador del servicio | A1 y sesión real del operador comprobados en A5 local. Faltan aceptación pública/del usuario y suspensión, que depende de la decisión del orden 5 |
| 17 | P2 | Horarios frente a asistencia y gestión de ausencias | Aprobar criterios de retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y validar |
| 18 | P2 | Carga, continuidad y operación | Línea base local 50/300 del 22: 1,400 marcajes, 350 cierres y seis exportes verificados. Faltan objetivos Q19, carga sostenida/destino, continuidad, DNS y renovación real de certificados |
| 19 | P2 | Conector y formato de nómina | Identificar sistema y formato del primer cliente; implementar sincronización y obtener aceptación del archivo exportado |
| 20 | P2 | Congelar contrato 1.0 | Completar recorridos reales y decisiones pendientes; acordar compatibilidad y publicación de cambios con los consumidores |

## Definiciones recibidas para P0-01 y P0-02

**P0-01 — respaldo.** La [decisión de alojamiento del 19](decisiones-de-negocio.md#modelo-de-alojamiento-aprobado)
sustituye la propuesta previa de bases en infraestructura de cada cliente:
fastSolution administra el SaaS de Zenit con aislamiento lógico por empresa.
El respaldo externo corresponde al producto y no requiere un bucket por
cliente. Faltan destino, transferencia, custodia de claves, responsables,
automatización y restauración. Las instalaciones del cliente son otra oferta.
La política diaria/30 días y los objetivos 24 h/4 h registrados para el
servicio no sustituyen concretar ese modelo ni ensayar su recuperación.

El respaldo actual contiene todas las empresas y la identidad de una
instalación. No es una copia individual que pueda entregarse a cualquier
cliente. Perfiles declarados: 50 empleados para mediano y 300 para grande;
entrada, inicio/fin de un descanso y salida, cinco días por 52 semanas:
52,000 y 312,000 marcajes/año. Se requiere un año de datos consultables.
La [evaluación de costos](evaluacion-respaldo-anual.md) propone conservarlo en
PostgreSQL y separar las copias de recuperación. Proveedor y copias mensuales
adicionales no están elegidos. Ver [Recuperación](recuperacion-servicio.md#definición-recibida-para-el-modelo-de-respaldo).

**P0-02 — contraseña.** El usuario define un flujo administrado en el portal
web: visualizar empleados, seleccionar su cuenta y declarar que al próximo
login debe establecer una contraseña nueva. A4 ya implementa esa acción para
cuentas activas vinculadas, en contrato, backend y portal, con pruebas de
permisos, aislamiento y conservación OTP. La integración se habilitó sólo
en local; el servidor público conserva Q04 y su aceptación pendiente.

Marcar cambio obligatorio no resuelve por sí solo el acceso de quien ya
olvidó su contraseña. Falta definir cómo se autentica para establecer la
nueva. No se ha elegido contraseña temporal ni enlace por correo. SMTP,
cuentas personales, OTP y recuperación del operador siguen pendientes en sus
propios alcances. Ver [Identidad](preparar-ambiente-compartido.md#recuperación-administrada-desde-el-portal).

Ambas tareas siguen abiertas: A4 sí entrega la implementación local del
cambio obligatorio; no acredita recuperación de acceso olvidado ni respaldo
externo operativo.

## Siguiente trabajo que puede iniciarse

La implementación local de la **tarea 14** está completada y validada.
A1 ya completa la reactivación local de la **tarea 16**; la suspensión espera
la decisión de la tarea 5. A2/A3 añaden consulta personal web y recuperación
de acuse desde servidor. A4 y los 33 casos A5 aprobaron en local el 21.
El recorrido visual Android de semana/acuse contra backend real local aprobó
el 21; horarios/importación en navegador local aprobaron el 22. Faltan el
recorrido público, expediente completo y
las dependencias jurídicas y operativas de las tareas globales.

Para desbloquear las P1 restantes:

- **8:** el Samsung SM-S928B pasó el autoensayo y la comprobación HTTPS el 19,
  bajo Wi-Fi. El teléfono vuelve a estar autorizado por ADB y la nueva
  instrumentación con HTTP simulado aprobó el 20. Esto no demuestra dos IP
  públicas distintas. **La prueba con datos móviles queda pendiente para otro
  desarrollador, por indicación del usuario.** Ver el procedimiento siguiente.
- **9:** A5 y horarios/importación ya tienen actas locales con navegador real.
  Continuar el recorrido público cuando se retome, con inventario y accesos.
- **10:** definir cuántos días conservar sobres y recibos procesados y si habrá
  conservación externa. Los pendientes no deben purgarse.
- **12:** coordinar inventario, despliegue y comprobación con el interlocutor
  autorizado para SSH.

## Entrega a otro desarrollador: prueba con datos móviles (tarea 8)

**Estado: pendiente, diferida por el usuario.** No se da por demostrada la
independencia de cuotas entre dos IP públicas reales.

1. Disponer de teléfono autorizado por ADB, datos móviles disponibles y APK
   de app/instrumentación correspondientes al mismo código. Confirmar que el
   teléfono sale por la red móvil y la computadora por otra IP pública.
2. Dejar expirar cualquier cuota previa (un minuto) y ejecutar desde la raíz
   `node infra/test-public-proxy.mjs`. Debe registrar diez respuestas 410 y
   después 429. Usa un código imposible; no crea dispositivos.
3. Antes de vencer esa misma ventana, ejecutar en el teléfono:
   `adb -s SERIAL shell am instrument -w -r -e baseUrl https://zenit.fastsolution.com.mx -e phase proxy mx.fastsolution.zenit.test/mx.fastsolution.zenit.mobile.testing.SmokeInstrumentation`.
   Debe informar `OK: BACKEND proxy` e `INSTRUMENTATION_CODE: -1`, que
   comprueban `410/enrollment_gone` desde la segunda conexión.
4. Confirmar que la computadora sigue recibiendo 429 al terminar el ensayo
   del teléfono, registrar horarios UTC y ambas salidas sin publicar IP
   personales. Restaurar los ajustes de conexión originales del teléfono.

Evidencia previa disponible en `build/public-proxy-check.json`,
`build/device-recheck-proxy-phone.log` y `build/device-recheck-proxy-baseline.json`.
Estos archivos locales no sustituyen registrar la nueva ejecución y sus
resultados en la bitácora. El fallo del teléfono bajo Wi-Fi no mostró el
estado HTTP recibido y no acredita una segunda salida independiente.

Este documento registra el estado comprobado y las dependencias; no acredita
un nuevo despliegue ni una nueva revisión del servidor. Los P0 permanecen
abiertos antes del uso con datos reales. Las evidencias están en la
[bitácora de trabajo](bitacora-trabajo.md).
