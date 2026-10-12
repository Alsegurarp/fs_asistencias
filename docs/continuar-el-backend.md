# Continuar el backend

Cómo está hecho el backend y cómo se le agrega algo sin romper sus reglas.
Qué falta está en [Estado y pendientes](estado-y-pendientes.md).

## Con qué está hecho

| Pieza | Versión |
| --- | --- |
| Kotlin y JVM | Kotlin 2.4, JDK 25 |
| Spring Boot | 4.1 |
| Acceso a datos | jOOQ, con SQL escrito en texto |
| Migraciones | Flyway |
| Base | PostgreSQL 18 |
| Identidad | Keycloak 26 |
| Pruebas | JUnit 5, contra PostgreSQL real |

Es un solo servicio. No hay broker, caché ni almacén de objetos: lo que se
hace fuera de una petición va por la tabla de trabajos.

## El código

Todo vive en `backend/src/main/kotlin/mx/fastsolution/zenit/`, un paquete por
tema. Cada archivo junta lo de un tema: sus tipos, su acceso a datos, su
servicio y su controlador.

| Paquete | Qué tiene |
| --- | --- |
| `api` | Lo común: validación de campos (`Checks`), errores (`Problems`), páginas (`Paging`), conflictos de unicidad (`Conflicts`) y correlación |
| `security` | Qué rol entra a qué ruta (`SecurityConfig`), la cuota por persona (`PersonQuota`) y cómo se responde un rechazo |
| `identity` | Quién llama: del token a la persona, su empresa y sus roles (`CurrentPerson`) |
| `tenant`, `user` | Empresas, personas con acceso y roles |
| `site`, `schedule`, `employee`, `card` | Sedes, horarios, padrón con su importación, y tarjetas |
| `device` | Enrolamiento, activación, sesiones y la credencial del dispositivo |
| `capture` | Recibir un marcaje: reglas (`CaptureRules`), valores (`CaptureProperties`) y el proceso |
| `workday` | Cálculo de la semana (`WeekCalculator`), incidencias, cierres, y corridas de cierre con el cierre programado (`ClosureRuns`) |
| `export` | Exportes y su archivo |
| `jobs` | Trabajos durables y quien los atiende |
| `integration` | Fuentes del padrón |
| `audit` | Bitácora |
| `persistence` | Comprobación del esquema al arrancar |
| `system` | Estado del servicio |

El simulador de dispositivo está aparte, en `backend/src/simulator/`. Las
migraciones están en `backend/src/main/resources/db/migration/` y la
configuración en `backend/src/main/resources/application.yml`.

## Reglas que no se rompen

1. **Negar por defecto.** Una ruta que no está abierta en `SecurityConfig`
   responde 401 sin credencial y 403 con ella.
2. **La empresa sale de quien llama.** Se lee de `CurrentPerson` o del
   dispositivo, nunca del cuerpo ni de la ruta. Toda consulta filtra por
   `tenant_id`.
3. **Lo ajeno responde 404.** Nunca 403: no se confirma que algo de otra
   empresa existe.
4. **El rol de la base que atiende no hereda permisos.** Cada migración
   termina con su `GRANT`, sólo con lo que hace falta. La evidencia sólo se
   inserta.
5. **El backend no cambia el esquema.** Lo aplica el servicio `migrate`, con
   otro rol. El backend comprueba al arrancar que esté al día.
6. **Una migración aplicada no se edita.** Un cambio va en un archivo nuevo.
7. **El contrato y el código cambian juntos.** Las pruebas comparan cada
   respuesta con el contrato y las rutas del código con sus operaciones.
8. **Cada control tiene su caso negativo.** Una prueba que sólo comprueba que
   algo funciona no prueba que lo demás esté cerrado.
9. **Nada sensible en registros ni en la bitácora.** Ni tokens, ni correos,
   ni nombres, ni motivos, ni cuerpos completos. De un error se guarda su
   clase, no su mensaje.
10. **Sin secretos en el repositorio.** Es público. Los secretos son archivos
    en `secrets/`, que Git ignora.

## Agregar una ruta

1. **Contrato.** Describir la operación en `contracts/openapi.yaml`: resumen,
   `x-roles`, cuerpos con un ejemplo ficticio y cada respuesta. Subir la
   versión. Validar:

   ```powershell
   docker compose --profile tools run --rm contract-lint
   ```

2. **Base**, si hace falta: una migración nueva `V00N__descripcion.sql`, con
   `tenant_id` en la tabla y en cada llave foránea, y su `GRANT` al final.
3. **Código.** En el paquete del tema: el acceso a datos con jOOQ, el servicio
   con sus reglas y el controlador. Validar la entrada con `Checks`, responder
   errores con `Problems` y dejar rastro con `AuditLog` si es una acción
   administrativa.
4. **Seguridad.** Abrir la ruta en `SecurityConfig` con los mismos roles que
   `x-roles`.
5. **Pruebas**, en la clase de integración del tema:
   - su fila en la matriz de roles, con 401 sin credencial y 403 para quien no
     le toca;
   - su caso con dos empresas: lo ajeno no se ve ni se cambia;
   - sus reglas, con lo que debe fallar;
   - si agregó una tabla, lo que el rol de la base no puede hacer, en
     `DatabaseRolesIT`.
6. **Documentación.** El README y esta carpeta, en el mismo commit.

```powershell
docker compose --profile test run --rm --build backend-it
docker compose --profile test down db-it backend-it
```

## Piezas que ya resuelven lo común

| Para | Usar |
| --- | --- |
| Validar campos y responder todos los errores a la vez | `Checks`: `text`, `oneOf`, `uuid`, `date`, `timeZone`, `email`; al final `done()` |
| Responder un error del contrato | `Problems.notFound()`, `forbidden()`, `conflict(código, detalle)`, `gone(...)`, `validation(campo, código, mensaje)` |
| Traducir una violación de unicidad a un 409 | `Conflicts.uniqueConstraint(e)` |
| Paginar | `Paging.limit`, `Paging.decode` y `Paging.page`, pidiendo una fila de más |
| Saber quién llama | `@AuthenticationPrincipal CurrentPerson`, y `requireTenant()` |
| Dejar rastro | `AuditLog.record(...)`; hay una variante para lo que no hace una persona |
| Evitar dos cambios simultáneos sobre lo mismo | Bloquear la fila al empezar: `lock(...)` con `for update` |
| Hacer algo fuera de la petición | `JobRepository.enqueue` y un `JobHandler` |
| Limitar cuántas veces se hace algo por minuto | `FixedWindowLimiter`; la cuota por persona está en `PersonQuotaFilter` |
| Cerrar la semana de una persona | `WeekCloser.closeOne`, dentro de una transacción; `closeAlone`, en la suya |

Detalles que ahorran tiempo:

- Los cuerpos de petición son clases con propiedades mutables y nulas, no
  clases de datos: así se leen sin configuración extra. Cuando importa
  distinguir un campo nulo de uno ausente, el cuerpo se recibe como mapa, o la
  propiedad lleva un `set` que lo anota.
- En SQL de jOOQ en texto se usa `cast(? as tipo)` y no `::tipo`.
- Un JSON que lleva huella se guarda como `json`, no `jsonb`: `jsonb`
  reordena el texto y la huella ya no se puede volver a calcular.

## Agregar un tipo de trabajo

1. Implementar `JobHandler`: `type`, `handle(job)` y `abandoned(job, error)`.
   `maintain()` es opcional, para tareas periódicas.
2. `handle` debe poder repetirse: si el trabajo ya se hizo, no hace nada.
3. Encolarlo dentro de la misma transacción que crea lo que espera:
   `jobs.enqueue(tenantId, tipo, referencia, intentos)`.
4. El trabajo no lleva datos: apunta a un registro por su identificador.
5. Si el trabajo es largo, que alargue su plazo cada cierto avance con
   `jobs.extend`, y que haga cada paso en su propia transacción: así lo hecho
   no se pierde si se interrumpe. La corrida de cierre es el ejemplo.

En las pruebas los trabajos no corren solos: se llama `jobWorker.drain()`.

## Cambiar una regla de captura o de jornada

- Las reglas de captura están en `CaptureRules.kt` y sus valores en
  `CaptureProperties`. Son funciones sin estado, con pruebas unitarias.
- El cálculo de la semana está en `WeekCalculator.kt`. No toca la base: recibe
  marcajes, ajustes y topes, y devuelve tramos, totales y alertas.
- Los topes laborales son filas de `rule_set`. Cambiar uno es una migración
  que agrega una versión; las semanas cerradas conservan la suya.
- Cambiar una regla cambia la jornada de las semanas que no están cerradas.
  Las cerradas no cambian: están congeladas.

## Dependencias y vulnerabilidades

Las versiones de las bibliotecas las fija Spring Boot. Cuando una de ellas
tiene una vulnerabilidad ya corregida y Spring Boot todavía no la sube, se
adelanta en `backend/build.gradle.kts` con `extra["….version"]`, con un
comentario que dice por qué. Hoy van adelantadas dos: Tomcat y Jackson. Se
retiran cuando una versión de Spring Boot traiga esas o más nuevas.

Lo mismo pasa con los paquetes del sistema de las imágenes: los que tienen
corrección publicada y la imagen base todavía no trae se suben en el
`Dockerfile`, con la versión mínima corregida.

Cómo se revisa está en
[Entorno local](entorno-local.md#revisar-vulnerabilidades).

## El simulador de dispositivo

Vive en `backend/src/simulator/`, en su propio conjunto de fuentes: usa las
mismas bibliotecas que el backend, pero no entra al artefacto que se despliega
ni a las pruebas. Se compila al construir la imagen, para que un error salga
ahí, y se corre con la tarea `simulate`.

Habla con el backend sólo por el API, como lo haría la app. Si el contrato
del marcaje cambia, hay que cambiarlo también aquí: no lo cubren las pruebas.
Qué simula cada persona está en la lista `SCENARIOS`.

## Las pruebas

| Clase | Qué recorre |
| --- | --- |
| `ApiIT` | Identidad, empresas, personas, roles y bitácora |
| `DirectoryIT` | Sedes, horarios, padrón, importación y tarjetas |
| `CaptureIT` | Dispositivos y captura |
| `WorkdayIT` | Jornada, incidencias, cierres y acuses |
| `ClosureRunsIT` | Corridas de cierre y cierre programado |
| `AdministrationIT` | Suspender y reactivar una empresa, y soltar la liga de una cuenta |
| `QuotaIT` | Cuota de peticiones por persona, de punta a punta, con un límite bajo |
| `ExportsIT` | Exportes y fuentes del padrón |
| `JobsIT` | Trabajos: reintento, abandono, plazo y varios procesos a la vez |
| `DatabaseRolesIT` | Lo que el rol de la base no puede hacer |
| `ContractCoverageIT` | Que el contrato y el backend digan lo mismo |

Cada llamada de las pruebas pasa por `ContractCheck`: la respuesta se compara
con el esquema del contrato, y el cuerpo de una petición que el backend
aceptó, también. Si el backend acepta algo que el contrato no describe, la
prueba falla.

- `ApiTestBase` da las llamadas, los tokens de prueba y los ayudantes para
  crear una empresa y sus personas. `CaptureTestBase` simula un dispositivo.
  `WorkdayTestBase` da una semana ya terminada.
- Las pruebas firman sus propios tokens con una clave de prueba; el backend
  los valida igual que los del proveedor de identidad.
- Para comprobar que una prueba de un control sirve, se quita el control a
  propósito y se ve que la prueba falla. Después se restaura.

## Antes de subir cambios

- [ ] Pruebas unitarias y de integración sin fallos.
- [ ] Contrato validado, si cambió.
- [ ] Búsqueda de secretos en el historial, sin hallazgos.
- [ ] Análisis de vulnerabilidades sin altas ni críticas, si cambió una
      dependencia o una imagen.
- [ ] README y esta carpeta al día.
- [ ] Sin contenedores, redes ni volúmenes de prueba olvidados.

```powershell
docker compose --profile tools run --rm contract-lint
docker compose --profile tools run --rm secret-scan
```

## Mensajes de commit

Conventional Commits en español: `tipo(ámbito): qué cambió`, en imperativo y
sin punto final. El cuerpo dice qué entra y por qué, por tema y no por
archivo, y termina con lo que se verificó y lo que no.
