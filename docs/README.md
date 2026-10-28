# Documentación de Zenit

Zenit registra la asistencia de las personas de una empresa con una tarjeta
NFC y un teléfono Android, calcula su jornada semanal con reglas laborales que
tienen vigencia, y deja a la empresa atender lo que no cuadra, cerrar la semana
y exportarla.

Esta carpeta explica qué hace el sistema, cómo se usa y cómo se continúa. La
referencia exacta de cada ruta, con sus campos y ejemplos, es el contrato:
[`contracts/openapi.yaml`](../contracts/openapi.yaml). Si algo de aquí
contradice al contrato, manda el contrato.

## Por dónde empezar

| Si vas a… | Lee, en este orden |
| --- | --- |
| Levantar el sistema en tu máquina | [Entorno local](entorno-local.md) y [Recorrido completo](recorrido-completo.md) |
| Tener datos con qué probar el portal | El simulador de dispositivo, en [Entorno local](entorno-local.md#llenar-el-entorno-con-el-simulador-de-dispositivo) |
| Construir la app Android | [Casos de uso](casos-de-uso.md), [Consumir el API](consumir-el-api.md) y [Guía de la app Android](guia-app-android.md) |
| Construir el portal web | [Casos de uso](casos-de-uso.md), [Consumir el API](consumir-el-api.md) y [Guía del portal web](guia-portal-web.md) |
| Continuar el backend | [Lógica de negocio](logica-de-negocio.md), [Continuar el backend](continuar-el-backend.md) y [Estado y pendientes](estado-y-pendientes.md) |
| Entender un término, un estado o una tabla | [Diccionario](diccionario.md) |
| Saber qué falta | [Estado y pendientes](estado-y-pendientes.md) |
| Elegir qué resolver primero | [Tareas críticas primero](tareas-criticas-primero.md) |
| Preparar la sesión de QA y decidir el siguiente desarrollo | [Trabajo ejecutable y preguntas para QA](tareas-ejecutables-y-preguntas-qa.md) |
| Revisar la lógica actual en diagramas | [Flujos PlantUML](flujos/README.md) |
| Desplegar una versión en el servidor | [Instructivo de despliegue](instructivo-de-despliegue.md) |
| Entender cómo está publicado | [Despliegue en el servidor](despliegue-en-servidor.md) |

## Documentos

| Documento | Qué responde |
| --- | --- |
| [Casos de uso](casos-de-uso.md) | Quién hace qué, con qué rutas y qué puede salir mal |
| [Lógica de negocio](logica-de-negocio.md) | Las reglas que el servidor aplica y cuáles son provisionales |
| [Flujos PlantUML](flujos/README.md) | 17 diagramas del estado actual, nacimiento de datos y cobertura de las 62 operaciones |
| [Consumir el API](consumir-el-api.md) | Credenciales, errores, páginas, idempotencia y recomendaciones de uso |
| [Guía de la app Android](guia-app-android.md) | Enrolar, firmar, marcar, trabajar sin conexión y mostrar la semana |
| [Producto móvil](alcance-producto-movil.md) | Pantallas del producto, endpoints y qué funciones están conectadas |
| [Guía del portal web](guia-portal-web.md) | Inicio de sesión, pantallas contra rutas, roles y exportes |
| [Diccionario](diccionario.md) | Glosario, catálogos de valores y diccionario de datos |
| [Entorno local](entorno-local.md) | Levantar, crear cuentas, obtener un token, simular dispositivos, ensayar el respaldo, revisar vulnerabilidades y resolver problemas frecuentes |
| [Verificación local del 20 de octubre](verificacion-local-2026-10-20.md) | Código comprobado, pruebas repetidas, servicios locales y límites de la aceptación |
| [Trabajo local del 22 de octubre](qa-local-2026-10-22.md) | Consolidación, 17 casos de navegador, carga 50/300, seguridad de imágenes y limpieza |
| [Retención Android](retencion-android.md) | Almacenes, evidencia en servidor, protección de pendientes y alcance mínimo después de Q14 |
| [Entregas A1–A5](entregas-a1-a5.md) | Reactivación, semana personal, recuperación de acuse, cambio obligatorio de contraseña y verificación |
| [QA A1–A5](qa-a1-a5.md) | Datos ficticios, matriz de roles y casos con resultados esperados para aceptación manual |
| [QA Android: semana y acuse](qa-android-semana-acuse.md) | Guion reutilizable de 15 casos; distingue el acta local aprobada y las verificaciones restantes |
| [Resultado local de QA del 21](qa-a1-a5-2026-10-21.md) | 33 casos comprobados, login/OTP real, renovación por rol, paginación, corrección de recursos Keycloak y límites frente al ambiente público |
| [Semana/acuse Android real local del 21](qa-android-semana-acuse-2026-10-21.md) | Recorrido visual en teléfono, objeción, recuperación sin copia local, reapertura, conformidad y restauración de la vinculación original |
| [Recorrido completo](recorrido-completo.md) | De una empresa nueva a un exporte, petición por petición |
| [Continuar el backend](continuar-el-backend.md) | Cómo está hecho el código y cómo se agrega una ruta, una tabla o un trabajo |
| [Estado y pendientes](estado-y-pendientes.md) | Qué está hecho, qué falta y qué no se ha verificado |
| [Jerarquía general PlantUML](dbFlow/01-jerarquia.puml) y [relaciones PlantUML](dbFlow/02-relaciones.puml) | Conceptos, entidades y cardinalidades; 34 tablas V001–V010 y fronteras de identidad/Android |
| [Entrega E2/E3 del expediente](entrega-expediente-e2-e3.md) | Implementación local, historia completa, 60 unitarias, 83 integraciones, perfiles anuales y límites |
| [Entrega E4/E5 del expediente](entrega-expediente-e4-e5.md) | MFA por operación, autorización de un uso, portal, configuración efectiva e historia con navegador real |
| [Verificación independiente E6](entrega-expediente-e6.md) | JAR sin conexión a Zenit, integridad/relaciones, consulta de históricos y procedimiento de salida; aceptación pendiente |
| [QA Android del 28](qa-android-2026-10-28.md) | Navegación, captura personal/terminal, cola/sincronización, acuses reales locales, limpieza y límites |
| [Tareas pendientes](TareasPendientes.md) | Resumen de las 17 tareas abiertas, prioridades, dependencias y trabajo disponible; incluye entrega de la prueba móvil a otro desarrollador |
| [Verificación E2–E5 del 27 de octubre](verificacion-e2-e5-2026-10-27.md) | Corte previo a implementar E2/E3; evidencia de integración E1, pendientes y orden de trabajo |
| [Desarrollo disponible al 26 de octubre](tareas-desarrollo-2026-10-26.md) | Corte anterior de código/GitHub/CI, criterios E1–E6, QA Android y bloqueos externos |
| [Contrato y formato del expediente E1](contrato-expediente-e1.md) | Diseño y evidencia originales; actualización E2–E5 con ocho operaciones implementadas en API 0.15.0 |
| [Tareas críticas primero](tareas-criticas-primero.md) | Declaración de las 20 tareas priorizadas, dependencias, criterios de cierre y primer trabajo técnico |
| [Verificaciones automáticas](verificaciones-automaticas.md) | Workflow de GitHub Actions, pruebas por cambio, análisis de imágenes y comprobación del servidor |
| [Validación de cierres](validacion-cierres.md) | Pruebas ejecutadas y guion de aceptación de cierres semanales |
| [Revisión jurídica de jornada y acuse](revision-juridica-jornada-acuse.md) | Fuentes oficiales, brechas del código y decisiones para el dictamen |
| [Respaldos cifrados](respaldos-cifrados.md) | Claves age, copia persistente y restauración sin acceso al origen |
| [Respaldo anual por cliente](evaluacion-respaldo-anual.md) | Arquitectura definida, perfiles de 50/300 empleados, volumen anual y comparación de costos S3/GCS y alternativas |
| [Recuperación del servicio](recuperacion-servicio.md) | Instancia verificada en un volumen separado, contraseñas nuevas y arranque de backend e identidad |
| [Bitácora de trabajo](bitacora-trabajo.md) | Avances, tareas abiertas y requisitos para retomarlas |
| [Evidencia del 19 de octubre](evidencia-avance-2026-10-19.md) | Corte previo a QA: commit, CI, pruebas, decisiones y pendientes para retomar |
| [Preparar el ambiente compartido](preparar-ambiente-compartido.md) | Requisitos del ambiente publicado: TLS, proxy, SMTP y cuentas personales; qué se cumple y qué falta |
| [Despliegue en el servidor](despliegue-en-servidor.md) | Cómo está publicado Zenit, cómo se despliega una versión, certificados, verificación y lo que falta |
| [Instructivo de despliegue](instructivo-de-despliegue.md) | El guion de despliegue de Zenit y la landing: configuración, uso, avance, registros y errores |
| [Validación de tareas 1 a 6](validacion-tareas-1-a-6.md) | Resultados del 17 de octubre de 2026, comandos y pendientes de aceptación |
| [Decisiones de negocio](decisiones-de-negocio.md) | Comportamiento vigente, propuestas y decisiones pendientes del producto |

## Las piezas

| Pieza | Carpeta | Estado |
| --- | --- | --- |
| Backend | `backend/` | API 0.15.0 con 70 operaciones en la entrega E4–E6: permiso, preparación, MFA nuevo y descarga de un uso. 67 unitarias/88 integraciones PostgreSQL aprobadas; incluye simulador y dirección real del visitante detrás del borde |
| Contrato | `contracts/` | OpenAPI 3.1; es la frontera entre el backend, el portal y la app |
| Portal web | `web/` | PKCE, catálogos, horarios/CSV, dispositivos, incidencias, cierres, exportes, usuarios y configuración de empresa; A5 local 33/33 y horarios/CSV en navegador local 17/17 aprobados. Aceptación pública/del usuario pendiente |
| App Android | `android/` | Enrolamiento, firma ES256, cola cifrada, sincronización y recibos. Captura simulada comprobada contra backend local/HTTPS; semana/acuse visual aprobados en teléfono contra backend real local el 21. Faltan aceptación pública/del usuario, expediente y tarjeta autenticada |
| Conector | `connector/` | Vacío; es el futuro agente que sincronice el padrón desde la red de un cliente |
| Infraestructura | `infra/` | Imagen y realm del proveedor de identidad, guiones de la base y ensayo de respaldo |
| Despliegue | `deploy/servidor/` | Borde con certificados propios, Zenit encima de `compose.yaml` y la landing, tal como corren en el servidor compartido, y el guion `desplegar.sh` que los publica |

## Reglas de esta documentación

- Todos los datos de ejemplo son ficticios. Los correos de ejemplo usan el
  dominio reservado `.invalid` o `.example`.
- No lleva nombres de personas, rutas de una máquina en particular, secretos
  ni credenciales.
- Lo que no se ha verificado se dice. Un comando o un fragmento de código que
  no se probó lleva esa nota.
- Cuando cambia una regla o una ruta, cambia este texto en el mismo commit.
