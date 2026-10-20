# Evaluación de respaldo anual por cliente

Fecha: 19 de octubre de 2026. Evaluación técnica y de costos; no constituye
contratación, despliegue ni aprobación de nuevas políticas de borrado.

## Arquitectura y perfiles definidos por el usuario

- La infraestructura del cliente aloja únicamente sus datos operativos.
- El sistema de fastSolution vive en un VPS de fastSolution.
- El destino externo de los respaldos sigue en evaluación: S3, GCS u otra opción.
- Perfil mediano: 50 empleados. Perfil grande: 300 empleados.
- Para dimensionar: cinco días por semana, 52 semanas y entrada, salida,
  inicio y fin de un descanso: cuatro marcajes por empleado/día.
- Se requiere conservar un año de datos de asistencia para consultas.

Los cuatro marcajes suponen un descanso diario. Más descansos o turnos
requieren ajustar el cálculo. Los 260 días son un supuesto de volumen, no
una regla para rechazar marcajes fuera de esos días.

## Propuesta

Conservar al menos doce meses consultables en PostgreSQL del cliente y
respaldar esa base en almacenamiento de objetos externo. El VPS del sistema
consulta la base mediante una conexión privada autenticada y cifrada.

Un archivo de respaldo permite recuperar la base; por sí solo no permite
consultar asistencia desde las pantallas actuales. Para estos volúmenes,
mantener el año en PostgreSQL evita desarrollar un segundo motor de consulta
sobre archivos. [PostgreSQL distingue volcados, copias de archivos y archivado continuo](https://www.postgresql.org/docs/current/backup.html).

Recomendación inicial: **S3 Standard**, o **GCS Standard si fastSolution ya
opera en Google Cloud**. Para estos tamaños, simplificar operación y probar
restauraciones aporta más que pasar copias a clases de archivo. Backblaze B2
es una alternativa de menor tarifa para respaldos si se desea usar un destino
compatible con S3 fuera de AWS. El proveedor sigue sin elegirse.

## Dimensionamiento

Marcajes/año = empleados × 5 × 52 × 4 = empleados × 1,040.

Reserva preliminar de 2–8 KiB por marcaje con datos asociados. Es un supuesto
presupuestario, no una medición del producto ni una cota garantizada del tamaño
de la base. El esquema guarda sobre firmado, identificadores, fechas y evidencia
de ubicación, además de índices y datos relacionados.

| Perfil | Empleados | Marcajes/año | Estimación del conjunto anual |
| --- | ---: | ---: | ---: |
| Mediano | 50 | 52,000 | 0.10–0.40 GiB |
| Grande | 300 | 312,000 | 0.60–2.38 GiB |

1 GiB = 1,073,741,824 bytes. No se presupuestan fotos o archivos adjuntos.
El tamaño real debe medirse con registros representativos, índices, incidencias,
ajustes, cierres y exportes. WAL, identidad, bitácoras generales, archivos
temporales y crecimiento ajeno a asistencia deben dimensionarse aparte.
Un volcado comprimido puede ocupar menos; no se cuenta ese ahorro sin medirlo.

## Tarifas de referencia

USD, antes de impuestos, solicitudes, transferencias, descuentos y cuotas
gratuitas. S3: referencia de región de EE. UU.; GCS: Iowa `us-central1`.
La región definitiva y la unidad facturada del proveedor cambian la comparación.

| Destino | Tarifa publicada de almacenamiento | Consideración |
| --- | --- | --- |
| Amazon S3 Standard | USD 0.023 por GiB/mes | También factura solicitudes y transferencias según uso |
| GCS Standard regional | Aproximadamente USD 0.020 por GiB/mes | También factura operaciones y transferencia de salida |
| Cloudflare R2 Standard | USD 0.015 por GB/mes | Sin cargo de salida de R2 a Internet; operaciones y redondeos aplican |
| Backblaze B2 | USD 6.95 por TB/mes | Salida incluida hasta 3× almacenamiento medio; excedente USD 0.01/GB |

Fuentes: [tarifas S3](https://aws.amazon.com/s3/pricing/) y
[ejemplo oficial de S3 Standard](https://aws.amazon.com/blogs/storage/run-spark-31-faster-and-optimize-compute-costs-with-amazon-s3-express-one-zone-on-amazon-emr/),
[GCS](https://cloud.google.com/storage/pricing?hl=en),
[R2](https://developers.cloudflare.com/r2/pricing/) y
[B2](https://www.backblaze.com/cloud-storage/pricing).

GCS publica USD 0.000027397/GiB-hora para Standard en Iowa, equivalente a
aproximadamente USD 0.020 usando 730 horas. S3 factura su GB de almacenamiento
como unidad binaria. Para B2 y R2 se usan GB/TB decimales en esta aproximación;
confirmar las unidades de facturación al cotizar. No se depende de cuotas
gratuitas compartidas por cuenta para calcular un precio por cliente.

## Un año de datos y varias fechas de recuperación

Conservar un año de información no exige guardar 365 copias completas del año.
El año consultable reside en PostgreSQL. La cantidad de copias determina
cuántas fechas anteriores se pueden recuperar.

Para comparar proveedores se modelan **30 copias diarias y 12 mensuales**,
hasta 42 copias completas distintas del conjunto anual. Las doce mensuales
son una propuesta adicional, no una política aprobada. Las fechas mensuales
no dan recuperación a cualquier día de hace un año.

Supuesto conservador para este ejemplo: cada copia ocupa lo mismo que el
extremo de 8 KiB/marcaje anterior. No representa todavía un respaldo medido.

| Perfil | Hasta 42 copias | S3 Standard/mes | GCS Standard/mes | R2 Standard/mes | B2/mes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mediano, 50 empleados | 16.66 GiB | USD 0.38 | USD 0.33 | USD 0.27 | USD 0.12 |
| Grande, 300 empleados | 99.98 GiB | USD 2.30 | USD 2.00 | USD 1.62 | USD 0.75 |

Son costos aproximados de almacenamiento al alcanzar ese conjunto de copias,
sin transferencias, operaciones, versiones, soft delete, identidades, WAL,
VPS, disco del cliente, administración ni soporte. No son cuotas comerciales
ni costos totales del servicio. La ocupación crece gradualmente durante el
primer año. Sin las doce mensuales, sólo 30 diarias ocupan menos.

Con volcados completos diarios del extremo alto del perfil grande, se
subirían aproximadamente 71.4 GiB/mes desde el cliente. Medir tiempo de copia,
ancho de banda y restauración. Si esas magnitudes crecen, considerar
[pgBackRest](https://pgbackrest.org/user-guide.html), que admite respaldos
completos, diferenciales e incrementales y repositorios S3/GCS; no es necesario
incorporarlo antes de medir el procedimiento existente.

## Operación propuesta

1. Generar una copia consistente de la base operativa del cliente y cifrarla
   antes de enviarla; reutilizar age y las comprobaciones de restauración
   existentes cuando se adapte el procedimiento a bases separadas.
2. Guardar las copias de cada cliente con permisos y custodia separados.
   fastSolution debe poder ejecutar y supervisar el respaldo, y el cliente
   debe tener un procedimiento definido para recuperar sus datos. Precisar
   titularidad de cuenta/bucket y entrega o custodia de claves.
3. Conservar también una copia independiente del almacenamiento externo,
   con permisos separados y protegida de borrado propagado. Guardar origen y
   respaldo en el mismo disco no resuelve la pérdida de esa máquina.
4. Mantener la política diaria/30 días y objetivos 24 h/4 h existentes;
   evaluar doce mensuales si se necesitan puntos de recuperación más antiguos.
5. Verificar integridad, alertar si falla la copia y ensayar periódicamente
   restauración en un destino aislado, incluido tiempo de descarga.
6. Respaldar por separado identidad y configuración necesarias para recuperar
   el servicio de fastSolution. No entregar a un cliente paquetes que incluyan
   datos o identidad de otras empresas.

Configurar protección contra borrado según el proveedor y las necesidades
operativas. [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
y [GCS Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock)
ofrecen mecanismos de retención que requieren diseño cuidadoso antes de fijar
plazos. Versiones y objetos retenidos también ocupan espacio.
[GCS soft delete](https://docs.cloud.google.com/storage/docs/soft-delete)
conserva y factura objetos eliminados durante su plazo configurado.

Para estos tamaños empezaría con Standard. Las clases frías incorporan
condiciones y costos de acceso; [GCS](https://docs.cloud.google.com/storage/docs/storage-classes)
tiene duraciones mínimas de 30/90/365 días para Nearline/Coldline/Archive.
En AWS, Flexible Retrieval y Deep Archive requieren restauración previa;
[sus tiempos](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects-retrieval-options.html)
deben compararse con el objetivo actual de recuperar en cuatro horas.

## Alcance pendiente en Zenit

El backend actual usa una sola `spring.datasource`, configurada con
`DB_HOST`, `DB_PORT` y `DB_NAME`. No existe selección de base remota por cliente.
La arquitectura solicitada requiere decidir cómo se despliega y aísla el
backend por cliente o cómo se adapta el acceso a varias bases; también cómo
se respaldan identidad y metadatos del servicio.

El ensayo de recuperación actual recupera una instalación completa con las
bases de producto e identidad. No acredita el modelo distribuido nuevo.
P0-01 sigue abierta hasta elegir destino y responsables, adaptar el despliegue,
automatizar copias separadas y comprobar recuperación. No se crean buckets,
contratan servicios, cambian conexiones ni habilitan políticas de borrado
como parte de esta evaluación.
