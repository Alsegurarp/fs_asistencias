# Validación de cierres semanales

Validación ejecutada el 12 de octubre de 2026, con datos ficticios.

## Actualización del 19 de octubre: detalle de bloqueos por corrida

Contrato 0.12 y migración V008: consulta paginada de personas, causas e
incidencias, con detalle conservado ante interrupciones y actualizado por
reintentos. Las corridas antiguas conservan sus conteos sin detalle nominal.

Pasaron compilación y 151 pruebas del portal, construcción/unitarias del
backend y 74 pruebas de integración PostgreSQL, incluido aislamiento de
empresa y recuperación de una corrida parcial. Contrato, ejemplos y sintaxis
de los diagramas validados. Evidencias: `build/task14-web-tests.log`,
`build/task14-web-build.log`, `build/task14-backend-it.log` y
`build/task14-contract.log`. Sin despliegue ni nueva aceptación en navegador.

## Resultado automático del 12 de octubre

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| `pnpm build` en `web/` | Correcto | TypeScript y bundle de producción |
| `pnpm test` en `web/` | 85 pruebas aprobadas | Incluye formularios de cierre, permisos, selección, bloqueos, reapertura, corridas y conservación ante errores. Las respuestas de API del portal se simulan |
| `docker compose --profile test run --rm --build backend-it` | 73 pruebas aprobadas | Backend real por HTTP, PostgreSQL desechable, contratos, permisos y aislamiento entre empresas. La identidad usa claves de prueba |

La suite del backend comprueba, entre otros casos: cierre con personas
bloqueadas, preservación del cálculo al reabrir, versiones, reintentos,
corridas interrumpidas, más de 500 empleados y cierre programado.
El resultado de esa ejecución queda en `build/closure-backend-it.log`, que
Git ignora.

Las pruebas de formularios detectaron y corrigieron una sede opcional
marcada como obligatoria en el selector compartido. Una selección de sede
vacía permite ahora cerrar empleados elegidos o pedir una corrida de toda
la empresa. La asignación de tarjeta conserva su empleado obligatorio.

Estas comprobaciones no sustituyen el recorrido del navegador contra
Keycloak y el backend con una cuenta de prueba real.

## Entorno local

Se generaron los secretos faltantes y se levantaron PostgreSQL, migraciones,
backend y Keycloak. En esta máquina Windows rechazó publicar el puerto 8080;
la configuración local `.env`, no versionada, usa `BACKEND_PORT=18080`.
El portal de Docker sigue enviando `/api` al backend por su puerto interno.

| Servicio | Dirección local |
| --- | --- |
| Portal | `http://localhost:8081` |
| Salud del API | `http://localhost:18080/actuator/health` |
| API | `http://localhost:18080/api/v1` |
| Identidad | `http://localhost:8082/realms/zenit` |

La lista de operadores nace vacía. Para el recorrido manual hacen falta
una empresa, cuentas invitadas y verificadas, y datos ficticios de una
semana terminada. Preparación: [Entorno local](entorno-local.md) y
[Recorrido completo](recorrido-completo.md). No se deshabilita el segundo
factor ni se agregan credenciales al repositorio.

## Guion de aceptación

1. Entrar como RH y abrir Cierres. Consultar una semana terminada y comprobar
   los nombres, versiones y estados. Cambiar empleado y cargar otra página.
2. Elegir un empleado listo y otro con incidencia abierta. Confirmar el
   cierre directo: el listo queda cerrado y el otro aparece bloqueado.
3. Abrir la incidencia desde el bloqueo. Verificar que se conserva la semana
   correcta, resolverla y volver a cerrar. Repetir la solicitud y comprobar
   que no se crea otra versión de un cierre vigente.
4. Solicitar cerrar una semana no terminada. Comprobar el rechazo y que la
   fecha y selección se mantienen.
5. Entrar como administrador, abrir un cierre y reabrir con motivo. Verificar
   que los totales de la versión anterior se conservan. Corregir la jornada
   y cerrar otra vez: aparece una versión nueva.
6. Pedir una corrida de toda la empresa y otra por sede. Comprobar el estado,
   avance, conteos y parada del seguimiento al terminar. Navegar desde sus
   bloqueos hacia las incidencias individuales y las de la semana y sede correctas.
   Cargar otra página de personas bloqueadas y comprobar cada causa. Las
   corridas antiguas conservan sus conteos y explican la ausencia de detalle.
7. Si una corrida falla, verificar que lo ya cerrado permanece y solicitar
   otra con el mismo alcance. Ante un error de cuota o red, el seguimiento
   se pausa y ofrece reintento.
8. Entrar como supervisor y auditor: ambos consultan, sin controles de
   cierre ni reapertura. RH cierra pero no reabre; sólo el administrador
   reabre. Verificar también que una empresa no accede a cierres ajenos.
9. Consultar un cierre programado y uno con acuse: se identifican el origen,
   conformidad u objeción y el texto del trabajador.

## Límites actuales

- Las corridas anteriores a V008 no tienen detalle nominal registrado;
  las nuevas lo ofrecen por páginas, también si se interrumpieron.
- Un tramo abierto nacido de un ajuste puede carecer de incidencia ligada;
  requiere revisar ese ajuste y no se corrige automáticamente desde Cierres.
- El detalle muestra el resumen congelado de la versión consultada. El API
  de cierres no entrega sus tramos históricos completos.
