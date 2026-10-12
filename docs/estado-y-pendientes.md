# Estado y pendientes

Qué está hecho, qué falta y qué no se ha verificado. Se actualiza cuando
cambia alguna de las tres cosas.

## Qué está hecho

| Pieza | Estado |
| --- | --- |
| Contrato | Versión 0.9, con 52 operaciones. Completo para el recorrido del producto; todavía sin congelar |
| Backend | Atiende las 52 operaciones. 44 pruebas unitarias y 61 de integración contra PostgreSQL real |
| Base | 27 tablas en 6 migraciones, con roles separados para migrar y para atender |
| Identidad | Proveedor de identidad en el entorno local, con segundo factor obligatorio |
| Entorno local | Se levanta con dos comandos, sin credenciales por omisión |
| Portal | Esqueleto que compila; no inicia sesión ni tiene pantallas |
| App Android | Esqueleto que lee NFC, toma ubicación y guarda en una cola cifrada; no se enrola ni sincroniza |
| Conector | No existe |

Lo que el backend ya hace, de punta a punta:

1. Alta de empresas, invitación de personas, roles y bitácora.
2. Sedes con geocerca, horarios, padrón, importación por archivo y tarjetas.
3. Enrolamiento de dispositivos y captura de marcajes, con tarjeta simulada.
4. Jornada semanal calculada, incidencias con ajustes, cierre y acuse.
5. Exportes preparados por un trabajo, y fuentes del padrón.

Todo se ha probado con datos ficticios. Nada se ha probado con datos reales
ni está publicado.

## Qué falta para tener el producto

| Qué | Por qué importa |
| --- | --- |
| El portal | Sin él, RH no puede configurar, atender incidencias ni cerrar. El API ya existe |
| La app con enrolamiento y sincronización | Sin ella no hay marcajes reales |
| Verificar la tarjeta real | Hoy sólo se acepta la simulada, que no está autenticada. Depende de probar con tarjetas y teléfonos |
| Revisión jurídica | Los topes de jornada y el valor del acuse salen de una lectura de la ley sin revisar |
| Un ambiente publicado | No hay staging ni dirección pública |

## Pendientes del backend

### Se pueden hacer ya

| Pendiente | Qué es |
| --- | --- |
| Simulador de dispositivo | Una forma de generar marcajes en local sin la app, para que el portal tenga datos |
| Ensayo de respaldo y restauración | Respaldar la base, restaurarla en otra y comparar conteos |
| Cierre programado y de más de 500 personas | Como trabajo, ahora que existen |
| Consultar el manifiesto de un exporte | Hoy sólo vive en la base |
| Soltar la liga de una cuenta perdida | Para que la persona vuelva a ligarse con una cuenta nueva |
| Suspender y reactivar una empresa por el API | Hoy el efecto existe, pero el cambio se hace en la base |
| Cuotas por persona | Hoy hay por dispositivo y por intentos de activación |
| Vulnerabilidades de dependencias e imágenes | Falta elegir herramienta y generar el inventario de componentes |
| Limpieza técnica | Clases de jOOQ generadas en lugar de SQL en texto, y una dependencia sin uso |
| Comprobar el cuerpo de las peticiones contra el contrato | Hoy sólo se comprueban las respuestas |

### Esperan una decisión

| Pendiente | Qué hay que decidir |
| --- | --- |
| Verificación automática en cada cambio | Dónde corre. Hoy pruebas, contrato y búsqueda de secretos se corren a mano |
| Alcance del supervisor | Cómo se le asignan sus sedes. Hoy ve y atiende lo de toda su empresa |
| Baja de una persona | Si además revoca su tarjeta y cierra su horario |
| Comparar la jornada con el horario | Qué cuenta como retardo, falta y salida anticipada |
| Tipo de marcaje | Si la persona lo declara, el servidor lo deduce, o las dos cosas como hoy |
| Ausencias | Cómo tratar vacaciones e incapacidades, para no cerrar en ceros |
| Otra plantilla de exporte | Según lo que pida la nómina del primer cliente |
| Dónde vive el archivo de un exporte | Hoy en la base, unos minutos; la alternativa es un almacén de objetos |

### Dependen de algo externo

| Pendiente | De qué depende |
| --- | --- |
| Tarjeta real y entrega de su clave al dispositivo | Prueba con tarjetas y teléfonos reales |
| Cálculo por tipo de jornada | Revisión jurídica |
| Conector para sincronizar el padrón | El sistema del primer cliente |
| Servicio de correo en la identidad | Un dominio de envío. Sin él no hay verificación automática del correo ni recuperación de contraseña |
| Cuentas personales en la consola de identidad | Antes de cualquier ambiente compartido: hoy hay una cuenta temporal |
| Staging, TLS y respaldo fuera de la máquina | Un ambiente publicado |
| Cuotas compartidas entre instancias y dirección real del cliente | Cómo se publique el servidor |

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
- **Invitar revela si un correo existe.** Un correo que ya pertenece a
  alguien responde un conflicto, sin decir en qué empresa.
- **Las cuotas viven en memoria.** Valen para una sola instancia del backend,
  y detrás de un proxy la dirección que se ve es la del proxy.
- **El exporte sale del sistema.** Una vez descargado, el archivo queda fuera
  de control. La protección contra fórmulas en hojas de cálculo no es
  confiable después de guardar y reabrir el archivo.
- **Un marcaje rechazado por sesión vencida se pierde.** Pasadas 72 horas sin
  conexión, la app tiene que abrir otra sesión antes de seguir marcando.
- **No hay notificaciones.** Nadie recibe aviso de una incidencia, un cierre
  o un exporte listo: se consulta.
- **No hay totales en las listas.** Se recorren con cursor.

## Sin verificar

- La lectura jurídica de los topes y de a qué semana pertenece un turno.
- El formato que pide un sistema de nómina real.
- Cualquier cliente contra el servidor: ni el portal ni la app llaman al API
  todavía. Los clientes generados del contrato sólo se compilaron.
- La app en un teléfono, con una tarjeta real.
- Carga, y archivos de exporte de más de unas decenas de filas.
- El comportamiento detrás de un proxy con HTTPS.
- Los trabajos con más de una instancia del backend, fuera de las pruebas.
- Los guiones de secretos y de la base en una máquina con Linux: sólo se
  probaron con Docker sobre Windows.
- El cuerpo de las peticiones contra el contrato, el formato de correo y las
  cabeceras.

## Por dónde seguir

| Quién | Primer paso sugerido |
| --- | --- |
| App | Generar la clave, activar con un código y abrir sesión contra el entorno local; después, firmar y mandar un marcaje con la tarjeta simulada |
| Portal | Inicio de sesión y `GET /me`; después, sedes, padrón y tarjetas, que no dependen de marcajes |
| Backend | El simulador de dispositivo, para que el portal tenga marcajes, incidencias y cierres con qué construir sus pantallas |

El orden importa: el portal puede construir toda la configuración sin la app,
pero para las pantallas de jornada, incidencias y cierre necesita marcajes, y
hoy sólo los produce la app o una prueba.
