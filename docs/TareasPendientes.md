# Tareas pendientes

Estado revisado el **20 de octubre de 2026**, con A1–A5 locales sobre `1984be3`.
Las [entregas y verificaciones](entregas-a1-a5.md) actualizan el avance técnico;
el [guion de QA](qa-a1-a5.md) conserva la aceptación manual pendiente.
Incluye los avances Android de semana/acuse, bienvenida, administración
integrada y herramientas MF1K. La [verificación local del 20](verificacion-local-2026-10-20.md)
actualiza la evidencia técnica; la QA funcional del usuario y la aceptación
del ambiente publicado conservan sus pendientes. El [corte del 19](evidencia-avance-2026-10-19.md)
se conserva como antecedente.
Hay **17 tareas abiertas total o parcialmente**.
La [declaración de trabajo ejecutable y preguntas para QA](tareas-ejecutables-y-preguntas-qa.md)
revisada sobre `1984be3` identifica cinco entregas locales y las 22 preguntas
que desbloquean decisiones, recursos y aceptación. Los cuatro trabajos de
[Actions para ese commit](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39472918113)
aprobaron. Las entregas locales no equivalen al cierre completo de sus tareas.
La numeración corresponde a la columna **Orden** de
[Tareas críticas primero](tareas-criticas-primero.md), que conserva los criterios
detallados de aceptación y las dependencias.

## Tareas completadas en su alcance

| Orden | Tarea | Evidencia y alcance |
| --- | --- | --- |
| 7 | Android reproducible contra backend | Personal y terminal comprobados en teléfono contra backend local y HTTPS, con tarjeta simulada, cola, sincronización, recibos y renovación. No acredita tarjeta física autenticada ni apagado real de radios |
| 11 | Verificaciones automáticas por cambio | Workflow integrado en `main`. Backend, portal, Android y contrato/seguridad aprobaron para `8a86916` en la [ejecución 39365266093](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39365266093). Configurar los trabajos como obligatorios antes de integrar cambios sigue siendo una decisión adicional |
| 14 | Personas que no pudieron cerrar y sus causas | Contrato 0.12, migración V008, registro transaccional por persona, consulta paginada y portal con nombres, causas y enlaces a incidencias. 74 pruebas de integración y 151 del portal aprobadas; CI aprobado para `8a86916`. Implementación publicada, sin despliegue ni aceptación con navegador real; las corridas antiguas conservan sólo sus conteos |

## Tareas abiertas

**P0:** necesarias antes de operar con datos reales. **P1:** validación del
piloto y siguiente trabajo técnico. **P2:** completar alcance y aceptación.

| Orden | Prioridad | Tarea pendiente | Qué falta para completarla |
| --- | --- | --- | --- |
| 1 | P0 | Respaldo externo y recuperación completa | Definido: datos operativos en infraestructura del cliente y sistema en VPS de fastSolution; perfiles de 50/300 empleados, cuatro marcajes diarios y un año consultable. [Evaluación de S3/GCS y alternativas](evaluacion-respaldo-anual.md) disponible. Faltan elegir destino, custodia, adaptar bases separadas, automatizar y ensayar recuperación |
| 2 | P0 | Identidad operativa, cuentas personales, OTP y SMTP | A4 implementa y prueba el cambio obligatorio para cuentas activas vinculadas; cliente técnico preparado sólo en local. Falta provisión/aceptación pública, recuperación de acceso olvidado, cuentas personales, SMTP y recuperación del operador |
| 3 | P0 | Jornada y evidencia del acuse | Obtener dictamen profesional y criterios aprobados; implementar reglas, casos esperados y evidencia versionada conservando históricos |
| 4 | P0 | Captura autenticada con tarjetas reales | Android ya incluye lectura, carga y borrado de credenciales MF1K de ejemplo. Falta validación física y autenticación integrada de asistencia: el backend sólo verifica el esquema simulado; definir tecnología y custodia de claves |
| 5 | P0 | Suspensión, baja, supervisor y tipo de marcaje | Elegir las reglas propuestas y después implementar sus efectos sobre permisos, captura e históricos |
| 6 | P0 | Uso del servidor compartido con datos reales | Formalizar el acuerdo entre el responsable del servicio y el dueño del servidor |
| 8 | P1 | Dirección real y protocolo entre proxies | Comprobar que dos IP públicas reales conservan cuotas independientes en la misma ventana. Las pruebas públicas de HTTPS y cabeceras falsas ya pasaron |
| 9 | P1 | Recorridos del portal con sesión real | Completar pantallas, roles, cookies, renovación y cierre de sesión en navegador. Horarios e importación ya pasaron por API HTTPS |
| 10 | P1 | Retención de sobres y recibos Android | Definir plazo y conservación; implementar purga acotada con pruebas que preserven pendientes y evidencia necesaria |
| 12 | P1 | Imágenes y correcciones del servidor | Obtener IDs y versión desplegada mediante el interlocutor SSH, analizar esas imágenes, desplegar correcciones y verificar públicamente. El análisis local y el de CI ya aprobaron |
| 13 | P2 | Configuración de empresa y dispositivos en portal | Desplegar la implementación y aceptar pantallas y permisos con sesión real. Configuración ya está implementada y probada |
| 15 | P2 | Semana y acuse del trabajador | A2 añade consulta web y A3 recupera el acuse desde servidor en web/Android, con pruebas. Faltan aceptación real y expediente completo; evidencia y reglas dependen del orden 3 |
| 16 | P2 | Pantallas del operador del servicio | A1 implementa y prueba reactivación con motivo desde portal. Faltan aceptación con sesión real y suspensión, que depende de la decisión del orden 5 |
| 17 | P2 | Horarios frente a asistencia y gestión de ausencias | Aprobar criterios de retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y validar |
| 18 | P2 | Carga, continuidad y operación | Definir volumen e instancias; probar trabajos, cierres, exportes y cuotas, actualización de DNS y renovación real de certificados |
| 19 | P2 | Conector y formato de nómina | Identificar sistema y formato del primer cliente; implementar sincronización y obtener aceptación del archivo exportado |
| 20 | P2 | Congelar contrato 1.0 | Completar recorridos reales y decisiones pendientes; acordar compatibilidad y publicación de cambios con los consumidores |

## Definiciones recibidas para P0-01 y P0-02

**P0-01 — respaldo.** El usuario indica respaldo por ambas partes, con
responsabilidad principal de fastSolution sobre la información de sus clientes.
El tercero no tiene la información del cliente. El usuario precisa que la
infraestructura del cliente aloja únicamente sus datos operativos y el sistema
vive en un VPS de fastSolution. El destino externo sigue en evaluación.
Quedan por precisar obligaciones, conectividad, adaptación de bases separadas,
destinos, transferencia y custodia de claves.
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

Ambas tareas siguen abiertas; estas respuestas definen requisitos, no una
implementación ni una recuperación comprobadas.

## Siguiente trabajo que puede iniciarse

La implementación local de la **tarea 14** está completada y validada.
A1 ya completa la reactivación local de la **tarea 16**; la suspensión espera
la decisión de la tarea 5. A2/A3 añaden consulta personal web y recuperación
de acuse desde servidor. A4 entrega el cambio obligatorio local y A5 el
guion de aceptación. Faltan los recorridos reales, el expediente completo y
las dependencias jurídicas y operativas de las tareas globales.

Para desbloquear las P1 restantes:

- **8:** el Samsung SM-S928B pasó el autoensayo y la comprobación HTTPS el 19,
  bajo Wi-Fi. El 20 `adb devices -l` no muestra dispositivos; hace falta
  reconectar y autorizar el teléfono. **La prueba con datos móviles queda pendiente para otro
  desarrollador, por indicación del usuario.** Ver el procedimiento siguiente.
- **9:** disponer de un navegador accesible para completar el recorrido real.
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
