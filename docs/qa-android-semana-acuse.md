# Aceptación visual Android: semana y acuse

Guion reutilizable de la tarea 15. Complementa [QA A1–A5](qa-a1-a5.md).
El recorrido técnico visual contra backend real local ya aprobó el 21 de
octubre de 2026; véase el [acta y su alcance](qa-android-semana-acuse-2026-10-21.md).
Este guion no es un acta nueva ni implica repetir lo aprobado. Permanecen
la aceptación pública/del usuario y los casos adicionales sin evidencia.
El trabajo público está diferido según [Tareas pendientes](TareasPendientes.md):
antes de retomarlo, confirmar versión desplegada y accesos de prueba.

## Preparación

1. Conectar teléfono con bloqueo de pantalla y autorizar depuración USB.
   `adb devices` debe mostrarlo como `device`.
2. Preparar empresas, empleados y semanas ficticios según
   [QA A1–A5](qa-a1-a5.md#preparación-y-datos-ficticios).
   RH necesita acceso al portal para cerrar y reabrir semanas.
3. Registrar commit y SHA-256 del APK, modelo, Android, variante, URL y versión
   del backend. Los servicios levantados no acreditan que ejecuten HEAD.
4. Conservar datos existentes: no desinstalar ni borrar almacenamiento.
   Usar teléfono de prueba o sincronizar pendientes antes de cambiar de vínculo.
5. Para el backend local de esta instalación:

   ```powershell
   adb -s <SERIAL> reverse tcp:8080 tcp:18080
   adb -s <SERIAL> reverse tcp:8081 tcp:8081
   adb -s <SERIAL> reverse tcp:8082 tcp:8082
   ```

   Vincular en debug a `http://localhost:8080`, sin `/api/v1`.
   Para el ambiente publicado usar `https://zenit.fastsolution.com.mx`.
   Registrar ambos resultados por separado.

## Casos

Abrir **Empleado**, el flujo operativo; la presentación debug no sirve como
evidencia. Para cada ejecución registrar su entorno y resultados propios.
El acta local acredita vinculación, semana vacía/cerrada, revisión y
confirmación, objeción, recuperación, reapertura, nueva versión y conformidad.
No atribuir aprobación a los 15 casos completos por esa evidencia: fecha
mediante calendario, pendientes, pérdida de conexión, compartir, permisos y texto grande
requieren sus resultados específicos; la restricción de terminal conserva
la evidencia separada de A5/instrumentación.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| M01 | Vincular teléfono personal con código de RH | Empresa y titular correctos; consulta disponible |
| M02 | Consultar semana provisional | Inicio normalizado, zona, tramos, totales, alertas e incidencias; sin acuse |
| M03 | Cambiar de semana con las flechas y elegir una fecha en el calendario | Consulta el rango correcto sin escribir una fecha; durante la carga no permite otra consulta |
| M04 | Consultar cierre sin acuse y abrir Responder al cierre | Resumen legible, detalles desplegables y versión consultable; revisión explícita y confirmación antes de enviar |
| M05 | Revisar cierre con marcajes pendientes | Aviso; conformidad deshabilitada; permite objeción tras revisar |
| M06 | Enviar objeción con comentario | Acuse confirmado con ID, fecha y huella; nueva consulta conserva el mismo recibo |
| M07 | Cerrar y abrir la app; consultar | Recupera acuse del servidor; no ofrece responder otra vez |
| M08 | RH reabre; consultar | Reabierto y sin presentar acuse anterior como vigente |
| M09 | RH vuelve a cerrar; consultar | Nueva versión sin heredar acuse; permite revisar y responder |
| M10 | En otro cierre, sin pendientes, enviar conformidad | Revisión, confirmación y recibo confirmado |
| M11 | Consultar sin conexión y recuperarla | Error claro; permite nueva consulta al reconectar sin inventar registros |
| M12 | Compartir resumen acusado | Selector Android; semana y acuse vigentes, sin credenciales |
| M13 | Apagar NFC y quitar permiso de ubicación | Consulta y acuse siguen disponibles |
| M14 | Abrir dispositivo terminal de prueba | No ofrece semana ni acuse personal |
| M15 | Usar texto grande y teclado abierto | Controles y resultados legibles y alcanzables mediante desplazamiento |

La pérdida de respuesta al enviar y el conflicto 409 requieren condiciones
controladas. No repetir acuses a ciegas ni provocar cortes en el servicio
compartido. La app debe pedir comprobación y permitir consultar lo guardado.
La instrumentación existente cubre respuestas simuladas; registrar aparte los
ensayos contra backend real.

## Acta

- Fecha y responsable:
- Commit / SHA-256 APK / variante:
- Modelo / Android:
- URL / versión backend / migración:
- Empresa y empleado ficticios:
- Semana / cierre / versión:
- Casos aprobados, fallidos y no ejecutados:
- Evidencias sin códigos de activación, tokens ni claves:
- Diferencias visuales y reproducción:
- Limpieza de datos de prueba y restitución de ajustes del teléfono:

Este guion no acredita tarjeta física autenticada ni cierra por sí solo la
tarea 15: conserva sus dependencias de expediente, aceptación pública/del
usuario y evidencia jurídica en [Tareas pendientes](TareasPendientes.md).
