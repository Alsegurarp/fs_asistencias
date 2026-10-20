# Evidencia de avance — 19 de octubre de 2026

**Estado: en espera de la QA del usuario prevista para hoy.** Se retoma el
trabajo cuando se reciban sus resultados. No se considera realizada ni
aprobada esa QA y no se despliegan cambios para este corte.

## Versión publicada y verificaciones

- Rama: `main`. Commit publicado y confirmado en remoto:
  [`8a86916326fcd9d27a978401abbc287ed0018a80`](https://github.com/Alsegurarp/fs_asistencias/commit/8a86916326fcd9d27a978401abbc287ed0018a80).
- GitHub Actions:
  [ejecución 39365266093](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39365266093).
  Se volvió a consultar su resultado al guardar esta evidencia.

| Trabajo de CI | Resultado para ese commit |
| --- | --- |
| Backend | Aprobado |
| Portal | Aprobado |
| Android | Aprobado |
| Contrato y seguridad | Aprobado |

El código publicado no acredita que el servidor de la QA ya ejecute esa
versión. La versión efectivamente desplegada y la aplicación de V008 siguen
por confirmar para interpretar los resultados del recorrido.

## Avance comprobado

- Tarea 14: personas bloqueadas por corrida, causas, incidencias y consulta
  paginada en contrato/backend/portal. Registro transaccional por persona,
  conservación ante interrupción y actualización al reintentar. Una corrida
  terminada conserva su detalle aunque otra cierre después a esas personas.
- Contrato 0.12.0 con 61 operaciones y migración V008. Los históricos anteriores
  conservan sus conteos y no se reconstruye su detalle nominal.
- Verificación local: construcción y unitarias del backend, 74 pruebas de
  integración PostgreSQL, compilación y 151 pruebas del portal, contrato y
  ejemplos válidos. Diagramas de cierres y modelo de datos validados.
- Samsung SM-S928B: autoensayo aprobado y respuesta HTTPS
  `410/enrollment_gone` con código imposible. La independencia de cuotas
  entre dos IP públicas no se dio por demostrada.
- La prueba con datos móviles queda pendiente para otro desarrollador,
  por indicación del usuario. [Entrega y aceptación](TareasPendientes.md#entrega-a-otro-desarrollador-prueba-con-datos-móviles-tarea-8).

## Definiciones guardadas después del push

Estas definiciones y su evaluación están guardadas en el espacio de trabajo;
no forman parte del commit publicado indicado arriba.

- Los datos operativos viven en infraestructura del cliente; el sistema
  vive en un VPS de fastSolution. Falta adaptar el backend, que actualmente
  usa una sola fuente de datos, y probar el despliegue distribuido.
- Mediano: 50 empleados; grande: 300. Entrada, salida e inicio/fin de un
  descanso, cinco días por 52 semanas: 52,000 y 312,000 marcajes/año.
  Se requiere un año de asistencia consultable.
- [Evaluación del respaldo anual](evaluacion-respaldo-anual.md): propone
  conservarlo en PostgreSQL y enviar respaldos cifrados a objetos externos.
  S3/GCS y alternativas evaluados; proveedor no elegido ni contratado.
  Las doce copias mensuales adicionales son propuesta, no política aprobada.
  Tamaños y costos estimados, sin medir un respaldo representativo real.
- P0-02: el usuario define selección del empleado desde el portal y cambio
  obligatorio de contraseña al próximo login. No está implementado. Falta
  definir cómo obtiene acceso quien ya olvidó su contraseña; cuentas
  personales, OTP, SMTP y recuperación del operador conservan sus pendientes.

## Pendientes al retomar

1. Recibir resultados de QA e identificar versión, entorno y roles probados.
   Registrar cada fallo con pasos, resultado esperado/obtenido y evidencia
   sin contraseñas, tokens ni datos personales innecesarios.
2. Priorizar los fallos comprobados y contrastarlos con el código publicado;
   no interpretar una función sin desplegar como una validación aprobada.
3. Continuar las [17 tareas abiertas](TareasPendientes.md), conservando los
   seis P0 y la entrega móvil a otro desarrollador. Las tareas 7, 11 y 14
   están completadas en su alcance documentado, no toda su aceptación operativa.

## Archivos locales de evidencia

Los registros bajo `build/` están excluidos de Git. Sus huellas permiten
identificar las copias locales usadas en este corte; el resumen y los enlaces
de CI anteriores son la referencia para consultar el avance desde otro equipo.

| Archivo local | SHA-256 |
| --- | --- |
| `build/task14-backend-it.log` | `6E7F846E950F5D7C9CC3C6A3049082EABD84AAED5EF2ED96C60F808F689284E3` |
| `build/task14-web-tests.log` | `952443FA14B49EC3A3B180B13D8B90502A8BAA7800C70220BB7442D7D1D60007` |
| `build/task14-web-build.log` | `6D06C06F8050C0E23FDAA6BF2A4E89E1BBBA710941566DC1F52A828B42E63415` |
| `build/task14-contract.log` | `D2E482E282E0C51E751827A0A6CCDD37B9883D68CB86353B2243249F2AA41FDC` |
| `build/device-recheck-fixture.log` | `BAAD7695FDC875D838D79CB660490095A8D6621C871137C38C0C5F59909EBD6F` |
| `build/device-recheck-proxy-baseline.json` | `84DA7CE3661C6569A647439DA97085C8B55760EE335AAD99EF13DA7271AEABA3` |

Este cierre sólo guarda evidencia y documentación. No modifica cuentas,
contraseñas, bases operativas, políticas de borrado ni servicios desplegados.
