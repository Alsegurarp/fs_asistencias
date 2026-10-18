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
| Revisar la lógica actual en diagramas | [Flujos PlantUML](flujos/README.md) |
| Desplegar una versión en el servidor | [Instructivo de despliegue](instructivo-de-despliegue.md) |
| Entender cómo está publicado | [Despliegue en el servidor](despliegue-en-servidor.md) |

## Documentos

| Documento | Qué responde |
| --- | --- |
| [Casos de uso](casos-de-uso.md) | Quién hace qué, con qué rutas y qué puede salir mal |
| [Lógica de negocio](logica-de-negocio.md) | Las reglas que el servidor aplica y cuáles son provisionales |
| [Flujos PlantUML](flujos/README.md) | 17 diagramas del estado actual, nacimiento de datos y cobertura de las 60 operaciones |
| [Consumir el API](consumir-el-api.md) | Credenciales, errores, páginas, idempotencia y recomendaciones de uso |
| [Guía de la app Android](guia-app-android.md) | Enrolar, firmar, marcar, trabajar sin conexión y mostrar la semana |
| [Producto móvil](alcance-producto-movil.md) | Pantallas del producto, endpoints y qué funciones están conectadas |
| [Guía del portal web](guia-portal-web.md) | Inicio de sesión, pantallas contra rutas, roles y exportes |
| [Diccionario](diccionario.md) | Glosario, catálogos de valores y diccionario de datos |
| [Entorno local](entorno-local.md) | Levantar, crear cuentas, obtener un token, simular dispositivos, ensayar el respaldo, revisar vulnerabilidades y resolver problemas frecuentes |
| [Recorrido completo](recorrido-completo.md) | De una empresa nueva a un exporte, petición por petición |
| [Continuar el backend](continuar-el-backend.md) | Cómo está hecho el código y cómo se agrega una ruta, una tabla o un trabajo |
| [Estado y pendientes](estado-y-pendientes.md) | Qué está hecho, qué falta y qué no se ha verificado |
| [Validación de cierres](validacion-cierres.md) | Pruebas ejecutadas y guion de aceptación de cierres semanales |
| [Revisión jurídica de jornada y acuse](revision-juridica-jornada-acuse.md) | Fuentes oficiales, brechas del código y decisiones para el dictamen |
| [Respaldos cifrados](respaldos-cifrados.md) | Claves age, copia persistente y restauración sin acceso al origen |
| [Recuperación del servicio](recuperacion-servicio.md) | Instancia verificada en un volumen separado, contraseñas nuevas y arranque de backend e identidad |
| [Bitácora de trabajo](bitacora-trabajo.md) | Avances, tareas abiertas y requisitos para retomarlas |
| [Preparar el ambiente compartido](preparar-ambiente-compartido.md) | Requisitos del ambiente publicado: TLS, proxy, SMTP y cuentas personales; qué se cumple y qué falta |
| [Despliegue en el servidor](despliegue-en-servidor.md) | Cómo está publicado Zenit, cómo se despliega una versión, certificados, verificación y lo que falta |
| [Instructivo de despliegue](instructivo-de-despliegue.md) | El guion de despliegue de Zenit y la landing: configuración, uso, avance, registros y errores |
| [Validación de tareas 1 a 6](validacion-tareas-1-a-6.md) | Resultados del 17 de octubre de 2026, comandos y pendientes de aceptación |
| [Decisiones de negocio](decisiones-de-negocio.md) | Comportamiento vigente, propuestas y decisiones pendientes del producto |

## Las piezas

| Pieza | Carpeta | Estado |
| --- | --- | --- |
| Backend | `backend/` | Atiende las 60 operaciones del contrato, con pruebas contra PostgreSQL real. Incluye el simulador de dispositivo |
| Contrato | `contracts/` | OpenAPI 3.1; es la frontera entre el backend, el portal y la app |
| Portal web | `web/` | PKCE, sedes, empleados, horarios, importación CSV, tarjetas, incidencias, cierres, exportes y usuarios; horarios/importación con sesión real pendientes |
| App Android | `android/` | Enrolamiento, firma ES256, cola cifrada, sincronización y recibos. Verificada en un teléfono con servidor de prueba; falta el recorrido contra el backend y las tarjetas reales |
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
