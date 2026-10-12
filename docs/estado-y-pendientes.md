# Estado y pendientes

Qué está hecho, qué falta y qué no se ha verificado. Se actualiza cuando
cambia alguna de las tres cosas.

## Qué está hecho

| Pieza | Estado |
| --- | --- |
| Contrato | Versión 0.10, con 59 operaciones. Completo para el recorrido del producto; todavía sin congelar |
| Backend | Atiende las 59 operaciones. 47 pruebas unitarias y 71 de integración contra PostgreSQL real |
| Base | 28 tablas en 7 migraciones, con roles separados para migrar, para atender y para respaldar |
| Identidad | Proveedor de identidad en el entorno local, con segundo factor obligatorio |
| Entorno local | Se levanta con dos comandos, sin credenciales por omisión |
| Simulador de dispositivo | Llena una empresa con personas, dispositivos y marcajes firmados, sin la app |
| Respaldo | Ensayo que respalda, restaura en una instancia desechable y compara conteos. No guarda el respaldo |
| Vulnerabilidades | Inventario y análisis de las cuatro imágenes. Las del backend y del portal, sin altas ni críticas |
| Portal | Esqueleto que compila; no inicia sesión ni tiene pantallas |
| App Android | Esqueleto que lee NFC, toma ubicación y guarda en una cola cifrada; no se enrola ni sincroniza |
| Conector | No existe |

Lo que el backend ya hace, de punta a punta:

1. Alta de empresas, invitación de personas, roles y bitácora; suspender y
   reactivar una empresa, y soltar la liga de una cuenta perdida.
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
| El portal | Sin él, RH no puede configurar, atender incidencias ni cerrar. El API ya existe, y el simulador da datos con qué construirlo |
| La app con enrolamiento y sincronización | Sin ella no hay marcajes reales |
| Verificar la tarjeta real | Hoy sólo se acepta la simulada, que no está autenticada. Depende de probar con tarjetas y teléfonos |
| Revisión jurídica | Los topes de jornada y el valor del acuse salen de una lectura de la ley sin revisar |
| Un ambiente publicado | No hay staging ni dirección pública |

## Pendientes del backend

### Se pueden hacer ya

| Pendiente | Qué es |
| --- | --- |
| Clases de jOOQ generadas | Hoy las consultas son SQL en texto. Cambia cada consulta y no cambia ningún comportamiento: conviene hacerlo solo, sin mezclarlo con otra cosa |
| Operador sin administrador | Si la única persona que administra una empresa pierde su cuenta, nadie de la empresa puede soltar su liga. Falta una forma de hacerlo para quien opera el servicio |
| Detalle de quién quedó sin cerrar | Una corrida de cierre dice cuántas personas no cerró y por qué, no cuáles; se buscan por sus incidencias abiertas |

### Esperan una decisión

| Pendiente | Qué hay que decidir |
| --- | --- |
| Vulnerabilidades de las imágenes que no son nuestras | Aceptar, por escrito, las de la imagen del proveedor de identidad y la de la base, o cambiar de imagen. Ver «Vulnerabilidades conocidas» |
| Variante de la imagen de la base | La variante sobre Alpine trae la quinta parte de hallazgos. Cambia la ordenación de textos y obliga a recrear el volumen: es barato ahora y caro con datos |
| Cierre programado | Si pasa una vez por semana y cierra sólo a quien no tiene pendientes, como hoy; si insiste, o si avisa |
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
| Guardar el respaldo: dónde, cifrado, cuánto tiempo y la copia fuera de la máquina | Un ambiente publicado. El ensayo ya existe |
| Cuotas compartidas entre instancias y dirección real del cliente | Cómo se publique el servidor |

## Vulnerabilidades conocidas

Último análisis: 11 de octubre de 2026, con la base de vulnerabilidades de ese
día. Cómo se repite está en
[Entorno local](entorno-local.md#revisar-vulnerabilidades).

| Imagen | Antes | Ahora | Altas y críticas que quedan |
| --- | --- | --- | --- |
| Backend | 66, con 3 críticas y 18 altas | 15, todas medias | Ninguna |
| Portal | 7, con 2 altas | 5, todas medias | Ninguna |
| Proveedor de identidad | 64, con 6 altas | Igual | 6 altas, de un paquete del sistema de la imagen que publica el proyecto del proveedor; sin corrección publicada |
| Base | 466, con 11 críticas y 118 altas | Igual | Las 129. De ellas, 95 son de paquetes del sistema de la imagen oficial: 45 marcadas por su distribución como «no se corregirá» y 50 todavía sin corrección. Las otras 34 son de la herramienta con la que la imagen baja de privilegios al arrancar |

Qué se corrigió:

- **Backend, bibliotecas.** Tomcat embebido tenía 3 críticas y Jackson 5 altas
  y 2 medias, todas con corrección publicada. Se adelantaron las dos
  versiones respecto de las que trae Spring Boot.
- **Backend y portal, paquetes del sistema.** Se subieron los que ya tenían
  corrección en el repositorio de la distribución y la imagen base todavía no
  traía.

Qué queda y por qué:

- **Proveedor de identidad y base.** Son imágenes de terceros, fijadas por
  versión y digest. Sus hallazgos no se arreglan desde este repositorio: se
  aceptan por escrito, uno por uno o por paquete, o se cambia de imagen.
  Mientras nadie decida, el análisis de esas dos imágenes termina con error, a
  propósito.
- **La base sobre Alpine**, analizada sólo para comparar, trae 91 hallazgos en
  lugar de 466: 3 críticas y 40 altas. Las 3 críticas y 31 de las altas son
  de la misma herramienta de arranque, que viene igual en las dos variantes.
  Las otras 9 altas son de dos paquetes del sistema que en el backend se
  corrigieron subiéndolos.
- **Las medias** no detienen el análisis. Se revisan al actualizar cada
  imagen base.

Un hallazgo dice que una versión tiene un defecto conocido, no que ese
defecto se pueda aprovechar aquí. Ninguno de los que quedan se ha estudiado
caso por caso.

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
- **El respaldo no se guarda.** El ensayo prueba que se puede restaurar; no
  deja una copia.
- **No hay notificaciones.** Nadie recibe aviso de una incidencia, un cierre,
  una corrida terminada o un exporte listo: se consulta.
- **No hay totales en las listas.** Se recorren con cursor.

## Sin verificar

- La lectura jurídica de los topes y de a qué semana pertenece un turno.
- El formato que pide un sistema de nómina real.
- Cualquier cliente contra el servidor: ni el portal ni la app llaman al API
  todavía. Los clientes generados del contrato sólo se compilaron.
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
- Pasar un entorno que ya existía a esta versión siguiendo los tres pasos
  completos: se probó crear el rol de respaldo en una base que no lo tenía,
  no el camino entero desde la versión anterior.
- El simulador con la política de descanso marcado, y con más de 8 personas.
- El formato de correo y las cabeceras, contra el contrato.

## Por dónde seguir

| Quién | Primer paso sugerido |
| --- | --- |
| App | Generar la clave, activar con un código y abrir sesión contra el entorno local; después, firmar y mandar un marcaje con la tarjeta simulada |
| Portal | Inicio de sesión y `GET /me`; después, sedes, padrón y tarjetas. Para jornada, incidencias y cierre, correr antes el simulador |
| Backend | Decidir qué se hace con las vulnerabilidades de las imágenes de terceros; después, las clases de jOOQ generadas |

El portal ya no depende de la app para tener datos: el simulador deja
jornadas, incidencias de cuatro tipos y semanas que se pueden cerrar.
