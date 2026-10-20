# Tareas pendientes

Estado actualizado el **19 de octubre de 2026**, sobre `main`, commit
`8a86916`, con la tarea 14 implementada y validada localmente, sin desplegar.
Hay **17 tareas abiertas total o parcialmente**.
La numeración corresponde a la columna **Orden** de
[Tareas críticas primero](tareas-criticas-primero.md), que conserva los criterios
detallados de aceptación y las dependencias.

## Tareas completadas en su alcance

| Orden | Tarea | Evidencia y alcance |
| --- | --- | --- |
| 7 | Android reproducible contra backend | Personal y terminal comprobados en teléfono contra backend local y HTTPS, con tarjeta simulada, cola, sincronización, recibos y renovación. No acredita tarjeta física autenticada ni apagado real de radios |
| 11 | Verificaciones automáticas por cambio | Workflow integrado en `main`. Backend, portal, Android y contrato/seguridad aprobaron en la [ejecución 39303294132](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39303294132). Configurar los trabajos como obligatorios antes de integrar cambios sigue siendo una decisión adicional |
| 14 | Personas que no pudieron cerrar y sus causas | Contrato 0.12, migración V008, registro transaccional por persona, consulta paginada y portal con nombres, causas y enlaces a incidencias. 74 pruebas de integración y 151 del portal aprobadas. Implementación local, sin despliegue ni aceptación con navegador real; las corridas antiguas conservan sólo sus conteos |

## Tareas abiertas

**P0:** necesarias antes de operar con datos reales. **P1:** validación del
piloto y siguiente trabajo técnico. **P2:** completar alcance y aceptación.

| Orden | Prioridad | Tarea pendiente | Qué falta para completarla |
| --- | --- | --- | --- |
| 1 | P0 | Respaldo externo y recuperación completa | Concretar destino externo, custodia de claves y responsables; automatizar copias y comprobar recuperación pública. La restauración local ya pasó |
| 2 | P0 | Identidad operativa, cuentas personales, OTP y SMTP | Completar correo, recuperación del operador, altas y recorridos reales; retirar el acceso temporal después de comprobar los personales |
| 3 | P0 | Jornada y evidencia del acuse | Obtener dictamen profesional y criterios aprobados; implementar reglas, casos esperados y evidencia versionada conservando históricos |
| 4 | P0 | Captura autenticada con tarjetas reales | Definir tecnología, autenticación y entrega de claves; probar captura y rechazo con tarjetas y teléfonos físicos |
| 5 | P0 | Suspensión, baja, supervisor y tipo de marcaje | Elegir las reglas propuestas y después implementar sus efectos sobre permisos, captura e históricos |
| 6 | P0 | Producción administrada para datos reales | El modelo está aprobado: producción exclusiva de Zenit bajo control de fastSolution y aislamiento lógico por empresa. Faltan proveedor, región, cuenta, contratos, respaldo externo, restauración y pruebas. El servidor compartido conserva sólo datos ficticios |
| 8 | P1 | Dirección real y protocolo entre proxies | Comprobar que dos IP públicas reales conservan cuotas independientes en la misma ventana. Las pruebas públicas de HTTPS y cabeceras falsas ya pasaron |
| 9 | P1 | Recorridos del portal con sesión real | Completar pantallas, roles, cookies, renovación y cierre de sesión en navegador. Horarios e importación ya pasaron por API HTTPS |
| 10 | P1 | Retención de sobres y recibos Android | Definir plazo y conservación; implementar purga acotada con pruebas que preserven pendientes y evidencia necesaria |
| 12 | P1 | Imágenes y correcciones del servidor | Obtener IDs y versión desplegada mediante el interlocutor SSH, analizar esas imágenes, desplegar correcciones y verificar públicamente. El análisis local y el de CI ya aprobaron |
| 13 | P2 | Configuración de empresa y dispositivos en portal | Desplegar la implementación y aceptar pantallas y permisos con sesión real. Configuración ya está implementada y probada |
| 15 | P2 | Semana y acuse del trabajador | Integrar datos reales, identidad y permisos. El cierre del acuse depende también de las definiciones de jornada y evidencia del orden 3 |
| 16 | P2 | Pantallas del operador del servicio | Completar suspensión/reactivación y comprobar permisos y aislamiento con sesión real. La suspensión depende de la decisión del orden 5 |
| 17 | P2 | Horarios frente a asistencia y gestión de ausencias | Aprobar criterios de retardos, faltas, salidas anticipadas, vacaciones e incapacidades; después implementar y validar |
| 18 | P2 | Carga, continuidad y operación | Definir volumen e instancias; probar trabajos, cierres, exportes y cuotas, actualización de DNS y renovación real de certificados |
| 19 | P2 | Conector y formato de nómina | Identificar sistema y formato del primer cliente; implementar sincronización y obtener aceptación del archivo exportado |
| 20 | P2 | Congelar contrato 1.0 | Completar recorridos reales y decisiones pendientes; acordar compatibilidad y publicación de cambios con los consumidores |

## Siguiente trabajo que puede iniciarse

La implementación local de la **tarea 14** está completada y validada.
La **tarea 16** puede avanzar con la reactivación de empresas desde el portal,
reutilizando el endpoint existente. La suspensión espera la decisión de la
tarea 5. La consulta semanal del trabajador (15) también puede avanzar;
el cierre del acuse conserva sus dependencias jurídicas y de producto.

Para desbloquear las P1 restantes:

- **8:** el Samsung SM-S928B ya aparece autorizado por ADB; pasaron su
  autoensayo y la comprobación HTTPS con código imposible. Usa Wi-Fi con datos
  móviles desactivados. **La prueba con datos móviles queda pendiente para otro
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
