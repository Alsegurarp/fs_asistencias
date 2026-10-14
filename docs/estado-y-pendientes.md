# Estado y pendientes

Qué está hecho, qué falta y qué no se ha verificado. Se actualiza cuando
cambia alguna de las tres cosas.

El avance y lo que falta para cerrar las tareas críticas de jornada, acuse y
respaldo se detallan en la [Bitácora de trabajo](bitacora-trabajo.md).

## Qué está hecho

| Pieza | Estado |
| --- | --- |
| Contrato | Versión 0.11, con 60 operaciones. Completo para el recorrido del producto; todavía sin congelar |
| Backend | Atiende las 60 operaciones. 47 pruebas unitarias y 73 de integración contra PostgreSQL real |
| Base | 28 tablas en 7 migraciones, con roles separados para migrar, para atender y para respaldar. Imagen propia sobre Alpine, sin root ni privilegios, que ordena los textos por código de carácter |
| Identidad | Proveedor de identidad en el entorno local, con segundo factor obligatorio |
| Entorno local | Se levanta con dos comandos, sin credenciales por omisión |
| Simulador de dispositivo | Llena una empresa con personas, dispositivos y marcajes firmados, sin la app |
| Respaldo | Ensayo existente y nuevos modos para guardar paquetes age y restaurarlos sin origen, comparando conteos y huellas de contenido. Nuevos modos preparados; ejecución pendiente por Docker detenido |
| Vulnerabilidades | Inventario y análisis de las cuatro imágenes. Ninguna tiene una alta o crítica sin atender: tres no tienen ninguna y la del proveedor de identidad tiene seis, aceptadas por escrito |
| Portal | Inicio de sesión PKCE, `/me`, sedes, empleados, horarios y asignaciones, importación CSV, tarjetas, incidencias, cierres, exportes y usuarios. 128 pruebas del portal y compilación verificadas. El usuario comprobó acceso, catálogos, incidencias hasta cuatro cierres demo, descarga única y usuarios; falta probar horarios e importación con sesión real y otros recorridos |
| App Android | Enrolamiento, firma ES256 con Keystore, cola cifrada, sincronización por lotes, recibos y renovación. 6 pruebas unitarias y autoensayo en teléfono con servidor HTTP de prueba; debug y release compilan |
| Conector | No existe |

Lo que el backend ya hace, de punta a punta:

1. Alta de empresas, invitación de personas, roles y bitácora; suspender y
   reactivar una empresa, y soltar la liga de una cuenta perdida, también
   la de quien administra cuando nadie más de su empresa puede.
2. Sedes con geocerca, horarios, padrón, importación por archivo y tarjetas.
3. Enrolamiento de dispositivos y captura de marcajes, con tarjeta simulada.
4. Jornada semanal calculada, incidencias con ajustes, cierre y acuse; cierre
   de toda la empresa como trabajo, y cierre programado.
5. Exportes preparados por un trabajo, con su manifiesto, y fuentes del
   padrón.
6. Cuota de peticiones por persona.

Todo se ha probado con datos ficticios. Nada se ha probado con datos reales
ni está publicado.

## Qué falta para tener el producto

| Qué | Por qué importa |
| --- | --- |
| Completar el portal | Ya tiene acceso, padrón, horarios, importación, incidencias, cierres, exportes y usuarios. Faltan configuración de empresa, dispositivos y pantallas de operador y trabajador |
| Completar y validar la app | Enrolamiento y sincronización están implementados. Faltan semana y acuse, el recorrido contra el backend real y la captura autenticada con tarjetas reales |
| Verificar la tarjeta real | Hoy sólo se acepta la simulada, que no está autenticada. Depende de probar con tarjetas y teléfonos |
| Revisión jurídica | Revisión documental del DOF y LFT realizada el 14 de octubre de 2026; calendario confirmado y brechas identificadas. Faltan dictamen profesional y cambios al cálculo y al acuse |
| Un ambiente publicado | No hay staging ni dirección pública. El portal ya admite la URL de identidad al construir su imagen y CSP; falta verificarlo y definir servidor, dominios, TLS, SMTP y cuentas personales |

## Pendientes del backend

### Se pueden hacer ya

| Pendiente | Qué es |
| --- | --- |
| Clases de jOOQ generadas | Hoy las consultas son SQL en texto. Cambia cada consulta y no cambia ningún comportamiento. Se decidió dejarlo para después y hacerlo solo, sin mezclarlo con otra cosa |
| Detalle de quién quedó sin cerrar | Una corrida de cierre dice cuántas personas no cerró y por qué, no cuáles; se buscan por sus incidencias abiertas |

### Esperan una decisión

| Pendiente | Qué hay que decidir |
| --- | --- |
| Suspensión de una empresa | Hoy también corta la captura de marcajes. Antes del primer cliente hay que decidir si una empresa suspendida conserva la captura, porque el registro de asistencia es obligación suya |
| Verificación automática en cada cambio | Dónde corre. Hoy pruebas, contrato, búsqueda de secretos y vulnerabilidades se corren a mano |
| Alcance del supervisor | Cómo se le asignan sus sedes. Hoy ve y atiende lo de toda su empresa |
| Baja de una persona | Si además revoca su tarjeta y cierra su horario |
| Comparar la jornada con el horario | Qué cuenta como retardo, falta y salida anticipada |
| Tipo de marcaje | Si la persona lo declara, el servidor lo deduce, o las dos cosas como hoy |
| Ausencias | Cómo tratar vacaciones e incapacidades, para no cerrar en ceros |
| Otra plantilla de exporte | Según lo que pida la nómina del primer cliente |
| Dónde vive el archivo de un exporte | Hoy en la base, unos minutos; la alternativa es un almacén de objetos |
| Versión 1.0 del contrato | Cuándo deja de cambiar sin aviso: cuando el portal o la app ya lo consuman |

### Dependen de algo externo

| Pendiente | De qué depende |
| --- | --- |
| Tarjeta real y entrega de su clave al dispositivo | Prueba con tarjetas y teléfonos reales |
| Cálculo por tipo de jornada | Revisión jurídica |
| Conector para sincronizar el padrón | El sistema del primer cliente |
| Servicio de correo en la identidad | Un dominio de envío. Sin él no hay verificación automática del correo ni recuperación de contraseña |
| Cuentas personales en la consola de identidad | Antes de cualquier ambiente compartido: hoy hay una cuenta temporal |
| Staging y TLS | Un ambiente publicado |
| Verificar los nuevos respaldos cifrados y la restauración aislada | Docker Desktop funcionando. Código, autoprueba y comandos en [Respaldos cifrados](respaldos-cifrados.md) |
| Destino externo, periodicidad y retención del respaldo; recuperación completa del servicio | Decisiones del ambiente publicado. La copia local cifrada no sustituye la copia fuera de la máquina |
| Cuotas compartidas entre instancias y dirección real del cliente | Cómo se publique el servidor |

## Vulnerabilidades conocidas

Último análisis: 11 de octubre de 2026, con la base de vulnerabilidades de ese
día. Cómo se repite está en
[Entorno local](entorno-local.md#revisar-vulnerabilidades).

| Imagen | Al empezar | Ahora | Altas y críticas que quedan |
| --- | --- | --- | --- |
| Backend | 66, con 3 críticas y 18 altas | 15, todas medias | Ninguna |
| Portal | 7, con 2 altas | 5, todas medias | Ninguna |
| Base | 466, con 11 críticas y 118 altas | 4, todas medias | Ninguna |
| Proveedor de identidad | 64, con 6 altas | Igual | 6 altas, aceptadas por escrito |

El análisis de las cuatro termina sin error.

Qué se corrigió:

- **Backend, bibliotecas.** Tomcat embebido tenía 3 críticas y Jackson 5 altas
  y 2 medias, todas con corrección publicada. Se adelantaron las dos
  versiones respecto de las que trae Spring Boot.
- **Backend y portal, paquetes del sistema.** Se subieron los que ya tenían
  corrección en el repositorio de la distribución y la imagen base todavía no
  traía.
- **Base.** Pasó de la imagen oficial sobre Debian a una propia, hecha de la
  oficial sobre Alpine (`infra/postgres`). Trae muchos menos paquetes; se
  subieron los dos que tenían corrección; y se retiró la herramienta con la
  que la imagen oficial baja de privilegios al arrancar, que concentraba 34
  de las graves y ya no hace falta, porque el contenedor arranca sin
  privilegios.

Qué se aceptó, y por qué:

- **Proveedor de identidad, 6 altas.** Son tres defectos de la biblioteca de
  expresiones regulares del sistema base de esa imagen, que publica el
  proyecto del proveedor. No tienen corrección publicada y no hay una versión
  más nueva del proveedor que la traiga. Se aceptaron por escrito el 11 de
  octubre de 2026, en `.grype.yaml`, y se revisan al cambiar de versión del
  proveedor o, a más tardar, el 11 de enero de 2027.

Las variantes oficiales de la base, analizadas para comparar: sobre Debian 12,
466 hallazgos; sobre Debian 13, 368, con 6 críticas y 119 altas; sobre
Alpine sin tocar, 91, con 3 críticas y 40 altas.

Las medias no detienen el análisis. Se revisan al actualizar cada imagen
base. Un hallazgo dice que una versión tiene un defecto conocido, no que ese
defecto se pueda aprovechar aquí.

## Limitaciones conocidas

- **La tarjeta simulada no está autenticada.** Si se enciende con datos
  reales, quien conozca la huella de una tarjeta marca por su titular. Nace
  apagada.
- **La jornada es una referencia, no un dictamen.** No distingue jornada
  diurna, nocturna ni mixta; no se compara con el horario; atribuye el turno
  al día en que empieza.
- **La verificación del correo es manual.** Quien crea la cuenta marca el
  correo como verificado. Si lo marca sin comprobarlo, esa cuenta puede tomar
  una invitación ajena.
- **Soltar una liga confía en el correo.** Después de soltarla, la primera
  cuenta que entre con ese correo verificado queda ligada, sea la nueva o la
  anterior. La cuenta anterior hay que darla de baja en el proveedor de
  identidad.
- **La base ordena los textos por código de carácter.** Las mayúsculas van
  antes que las minúsculas, y las letras con acento y la eñe, al final. Hoy
  sólo se nota en el orden de las filas de un exporte, que va por
  identificador externo. Una lista que deba ir en orden alfabético del
  español tiene que pedirlo en su consulta, con `COLLATE "es-x-icu"`.
- **Invitar revela si un correo existe.** Un correo que ya pertenece a
  alguien responde un conflicto, sin decir en qué empresa.
- **Las cuotas viven en memoria.** Valen para una sola instancia del backend,
  y detrás de un proxy la dirección que se ve es la del proxy. La cuota por
  persona se cuenta después de verificar la credencial: no protege a la
  verificación misma.
- **El cierre programado pasa una vez por semana.** Si esa vez la empresa
  estaba suspendida o el servicio estuvo detenido toda la semana, esa semana
  la cierra una persona.
- **El exporte sale del sistema.** Una vez descargado, el archivo queda fuera
  de control. La protección contra fórmulas en hojas de cálculo no es
  confiable después de guardar y reabrir el archivo.
- **Un marcaje rechazado por sesión vencida se pierde.** Pasadas 72 horas sin
  conexión, la app tiene que abrir otra sesión antes de seguir marcando.
- **El respaldo cifrado aún no se ejecutó.** El nuevo modo conserva una copia
  local; falta probarlo y definir copia externa, periodicidad y retención.
- **No hay notificaciones.** Nadie recibe aviso de una incidencia, un cierre,
  una corrida terminada o un exporte listo: se consulta.
- **No hay totales en las listas.** Se recorren con cursor.

## Sin verificar

- El dictamen jurídico del cálculo y del acuse. La revisión documental
  identificó brechas en [Revisión jurídica](revision-juridica-jornada-acuse.md).
- El formato que pide un sistema de nómina real.
- El recorrido del portal contra Keycloak y el backend real: ya implementa
  las llamadas, pero sólo se verificaron la compilación y pruebas del cliente.
  La app también implementa las llamadas de dispositivo y se verificó contra un
  servidor de prueba en un Samsung SM-S928B (Android API 36), no contra el
  backend real. Los clientes generados del contrato sólo se compilaron.
- La app en un teléfono, con una tarjeta real.
- Carga: una corrida de cierre se probó con 511 personas y un exporte con
  unas decenas de filas, no con más.
- El comportamiento detrás de un proxy con HTTPS.
- Los trabajos y las cuotas con más de una instancia del backend, fuera de
  las pruebas.
- Los guiones de secretos, de la base, del respaldo y del análisis de
  vulnerabilidades en una máquina con Linux: sólo se probaron con Docker
  sobre Windows.
- El ensayo de respaldo con una base que no quepa en memoria, y una
  restauración sobre un entorno nuevo de verdad, con sus secretos.
- Construcción y autoprueba de los nuevos modos de respaldo age y restauración
  sin origen; comparación de contenido añadida también al ensayo existente.
- Empezar de cero un entorno que ya existía, en la máquina de otra persona:
  se comprobó que un volumen de la imagen anterior no arranca con la nueva y
  que un entorno nuevo sí, no el cambio en un entorno con uso.
- El ensayo de respaldo mientras el backend escribe, sobre la imagen actual
  de la base: se probó así con la anterior.
- El simulador con la política de descanso marcado, y con más de 8 personas.
- El formato de correo y las cabeceras, contra el contrato.

## Por dónde seguir

| Quién | Primer paso sugerido |
| --- | --- |
| App | Verificar enrolamiento y marcajes con tarjeta simulada contra el backend local. Después, semana y acuse; la tarjeta real requiere su prueba externa |
| Portal | Verificar inicio de sesión, sedes, padrón y tarjetas contra el entorno local. Después, ampliar las pantallas operativas; correr antes el simulador |
| Backend | Lo que queda sin esperar a nadie es una mejora interna, las clases de jOOQ generadas, que se dejó para después. Lo demás espera una decisión o a un tercero |

El portal ya no depende de la app para tener datos: el simulador deja
jornadas, incidencias de cuatro tipos y semanas que se pueden cerrar.
