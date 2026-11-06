# Datos y decisiones para finalizar las tareas

Preparado el **6 de noviembre de 2026**. Responde en la columna **Tu respuesta**.
Este es el formulario vigente para recopilar lo que falta; conserva los IDs de
las [17 tareas abiertas](TareasPendientes.md#resolución-por-frente--6-de-noviembre-de-2026).

**Respuestas parciales recibidas el 6 de noviembre:** se leyó el archivo privado
`D:/Code/fs_asistencia/secrets-respuestas-cierre.md`. Identifica `Cliente-demo`,
la IP y responsables del bloque 1. Por chat se completaron dominio
`https://zenit.fastsolution.com.mx`, 2 CPU, 8 GB RAM y 50 GB de disco.
Se completaron IP en el perfil SSH e
identificador de instancia en la configuración privada del respaldo. Los bloques
2–13 conservan lo pendiente, salvo ese identificador; no se infieren otras decisiones.

Si algo no existe todavía, escribe **«No disponible; responsable: …; fecha: …»**.
Si necesitas que prepare una propuesta, escribe **«Propón una solución»** e indica
quién la resolverá. Una respuesta vacía no se considera aprobación. Marcar algo
como diferido permite continuar con otras tareas, pero deja esa tarea abierta.

**No escribas contraseñas, claves privadas, tokens, códigos OTP ni datos reales
de trabajadores en este documento.** Indica la ruta privada donde ya se encuentran.
`docs/` puede publicarse en Git. Si las respuestas contienen información interna,
guarda una copia contestada en `secrets/respuestas-cierre.md`, ignorada por Git.
Usa datos ficticios para horarios, marcajes, empleados y archivos de nómina.

## Lo que ya está decidido y no tienes que volver a contestar

- Una VPS privada por cliente, administrada por el equipo desarrollador.
- Hostinger, región **United States - Phoenix**.
- Bucket AWS S3 identificado en `bucket.md`, región **us-east-2**. Su nombre y
  región ya coinciden con `secrets/hostinger/respaldo.env`.
- Respaldo externo cifrado diario, copias de 30 días, pérdida máxima objetivo de
  24 horas y recuperación objetivo de 4 horas.
- Custodia por el administrador del cliente; si no la asume, por el equipo
  desarrollador. Falta identificar a las personas y su relevo.
- Cuentas personales con MFA; contraseña por correo verificado, pérdida de OTP
  con 12 códigos de recuperación y soporte con doble aprobación como último recurso.
- Suspensión, baja, supervisores por sedes y selección/deducción de marcaje ya
  fueron decididas e implementadas. Falta su aceptación en el destino.
- Expediente por empresa, permiso específico y MFA nuevo por descarga; consulta
  independiente sin Zenit. Ya existe su implementación técnica.
- Aplicar los requisitos normativos documentados; no se pide volver a elegirlos.

## 1. VPS, dominio y acceso SSH — tareas 6 y 12

**Necesito el destino concreto y un acceso que permita prepararlo y comprobarlo.**

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Alias del primer cliente/instancia que instalaremos | RECIBIDO: `Cliente-demo`; usado también como identificador del respaldo |
| IP pública de la VPS, o ruta privada donde la declaraste | RECIBIDA en el archivo privado de respuestas; aplicada a `secrets/hostinger-ssh/config` |
| Dominio completo para Zenit, por ejemplo `asistencia.ejemplo.com` | RECIBIDO por chat: `https://zenit.fastsolution.com.mx`; sin barra final para la configuración. Coincide con `PORTAL_URL`; identidad en `/id` |
| Responsable de crear/cambiar los registros DNS y cómo coordinarlo | Gabriel o Alexis; falta canal de coordinación. Consulta local del 6 de noviembre todavía resuelve al servidor anterior, no a la VPS declarada; sin cambios DNS |
| Sistema operativo y versión de la VPS | PARCIAL: Linux confirmado y cadena de kernel Linux/Ubuntu recibida; falta nombre y versión de distribución de `/etc/os-release` |
| CPU, RAM y disco contratados; espacio libre si ya tiene servicios | RECIBIDO por chat: 2 CPU, 8 GB RAM, 50 GB de disco total. Espacio libre y recursos efectivos pendientes de comprobar |
| ¿La VPS está vacía? Si contiene servicios/datos, indicar cuáles deben preservarse | Sin aplicaciones/datos declarados; nginx existente con puertos abiertos. Preservarlo e inspeccionar su configuración antes de integrar Zenit |
| Responsable del servidor y disponibilidad para resolver incidencias de acceso | Alexis: lunes a viernes 07:00–20:00; fines de semana todo el día. Falta zona horaria |
| Usuario y puerto SSH; indicar si tiene `sudo` o acceso a Docker | PARCIAL: usuario exclusivo de despliegue sin sudo; elevación sólo por Alexis. Faltan nombre, puerto y acceso efectivo a Docker |
| ¿Está completa la carpeta SSH privada con los tres archivos descritos abajo? | NO: se mencionan `authorized_keys` y `known_hosts`, sin ubicación. Localmente sólo se observa `config`; faltan `identity` y `known_hosts` en la carpeta del perfil |
| ¿Quién gestiona firewall/red y deja disponibles HTTP/HTTPS en el destino? | Alexis o Gabriel; puertos abiertos según respuesta, todavía sin comprobar |

Archivos privados necesarios en `secrets/hostinger-ssh/`:

- `config`: alias `zenit-hostinger`, con `HostName`, `User` y `Port` reales.
- `identity`: clave privada SSH ya autorizada en la VPS; no pegarla aquí.
- `known_hosts`: clave pública del servidor verificada por quien administra el
  acceso; no sustituir esa verificación por aceptar cualquier host.

La IP ya está completada. `User` tiene `USUARIO_DESPLIEGUE_PENDIENTE`, sin usar
el `root` del ejemplo, y el puerto 22 continúa provisional hasta confirmarlo.
Faltan `identity` y `known_hosts`. `authorized_keys` permite al servidor reconocer
claves públicas de usuarios; no sustituye la clave privada del cliente SSH.
No necesitas proporcionar contraseñas de Hostinger si ese acceso SSH es suficiente.
El dominio confirmado coincide con la configuración existente; queda comprobar
DNS, certificados e integración con nginx en la nueva VPS.
[Configuración existente](instructivo-de-despliegue.md#datos-de-hostinger--6-de-noviembre-de-2026).

### Preparación que requiere Alexis antes del despliegue

- Confirmar usuario/puerto y entregar por archivo privado el acceso SSH ya
  autorizado y la identificación verificada del servidor.
- Coordinar DNS para el dominio confirmado. Permitir inspeccionar la configuración
  relevante de nginx: puertos, sitio, certificados y cómo reenvía las conexiones.
  No se presupone que use la pasarela TLS/PROXY del servidor compartido anterior.
- Comprobar Docker y Compose y si el usuario de despliegue puede ejecutarlos con
  sus permisos actuales. Si no puede, acordar la ejecución administrativa por
  Alexis; no se concede sudo ni acceso adicional automáticamente.
- Preparar las rutas de instalación, secretos, respaldos y servicios del sistema
  cuando se concrete la integración, con los permisos adecuados al procedimiento.

Para precisar sistema y recursos se pueden devolver las salidas de estas
consultas de lectura en el archivo privado; no requieren sudo:

```bash
cat /etc/os-release
nproc
free -h
df -h /
docker version
docker compose version
```

Si un comando no está disponible o deniega acceso, basta registrar el error.

## 2. Respaldo AWS, claves y recuperación — tarea 1

**Necesito acceso al bucket ya elegido, identidad de la instancia y custodios.**

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Identificador estable de la instancia, sin espacios; ejemplo `cliente-piloto` | COMPLETADO: `Cliente-demo`, tomado del alias recibido y aplicado a `ZENIT_INSTANCE_ID` |
| Responsable de configurar la identidad técnica AWS y los permisos del prefijo de esa instancia | PENDIENTE |
| Dónde estará disponible el acceso AWS: perfil `zenit-respaldo` configurado en el servidor o ruta/canal privado equivalente | PENDIENTE |
| Responsable de revisar/aplicar la retención del prefijo sin reemplazar reglas de otros clientes | PENDIENTE |
| ¿El bucket tiene versionado, Object Lock o cifrado KMS? Indicar configuración conocida o quién permitirá inspeccionarla | PENDIENTE |
| Custodio titular de la clave de descifrado, por nombre o alias | PENDIENTE |
| Custodio de relevo y lugar de la segunda copia, separado de VPS/bucket; sólo referencia, sin secreto | PENDIENTE |
| ¿Existe una clave age de esta instalación? Si existe, indicar la ruta privada de su pública y dónde se custodia la privada | PENDIENTE |
| Si no existe: persona que recibirá la clave nueva y custodiará su segunda copia | PENDIENTE |
| Responsable primario y suplente de vigilar copias fallidas o con más de 24 horas | PENDIENTE |
| Canal operativo de avisos que ya se puede utilizar y responsable de atenderlos | PENDIENTE |
| Destino separado disponible para ensayar la restauración, o responsable de habilitarlo | PENDIENTE |

**Preparado localmente:** propuestas `secrets/hostinger/s3-policy.json` y
`secrets/hostinger/s3-lifecycle.json`, rellenadas con el bucket confirmado y
`Cliente-demo`; campos comprobados, sin aplicar permisos ni retención remotos.
Siguen pendientes los responsables y acceso indicados en la tabla.

No hace falta entregar una cuenta AWS administradora. La identidad técnica se
limita al acceso descrito en la [guía de respaldo](respaldos-cifrados.md).
No generaré otra clave si ya existe una necesaria para abrir respaldos anteriores.
Con estos recursos faltará ejecutar copia, descarga, restauración de ambas bases,
arranque completo y medición de los objetivos; las respuestas no prueban esos pasos.

## 3. Correo, cuentas y recuperación excepcional — tarea 2

**SMTP estaba diferido; para cerrar identidad sí debe quedar disponible.**

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Proveedor SMTP provisional, servidor, puerto y modo TLS indicado por el proveedor | PENDIENTE |
| Remitente y nombre visible; indicar si el dominio ya está verificado | PENDIENTE |
| Ruta privada de credenciales SMTP, sin escribirlas aquí | PENDIENTE |
| Buzón de prueba accesible para comprobar recepción y recuperación; puede indicarse en la copia privada | PENDIENTE |
| Responsable de la configuración SMTP y de los registros DNS de correo necesarios | PENDIENTE |
| Personas/alias para operador del servicio y administrador del cliente; correos en la copia privada | PENDIENTE |
| Turno/responsable primario y suplente de soporte | PENDIENTE |
| Dos personas distintas que aprobarán una recuperación excepcional | PENDIENTE |
| Cómo verificará soporte la identidad de quien perdió el acceso | PENDIENTE |
| Dónde se registran las dos aprobaciones y cómo se comunica el resultado al titular | PENDIENTE |

Cada titular configurará su propio segundo factor. No necesito sus contraseñas,
semillas OTP ni códigos de recuperación. La cuenta temporal se retira después de
comprobar las personales.

## 4. Condiciones del empleador y casos de jornada — tarea 3

**Necesito las condiciones del primer cliente que la norma no proporciona.**
La [base normativa ya documentada](revision-juridica-jornada-acuse.md) se conserva;
no se pide autorizar excepciones a ella ni redactar el algoritmo.

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Responsable de RH/producto que confirmará los horarios y casos del cliente | PENDIENTE |
| Zona horaria, día de inicio de semana y sedes del piloto | PENDIENTE |
| Horarios pactados por tipo de turno: días, entrada, salida y descanso | PENDIENTE |
| Durante cada descanso/comida: ¿la persona puede salir del lugar de trabajo y disponer de ese tiempo? Indicar diferencias por turno | PENDIENTE |
| Condiciones contractuales más favorables o regímenes especiales que deba contemplar el piloto; usar resumen ficticio | PENDIENTE |
| ¿El piloto incluye menores de edad u otros grupos con condiciones particulares? Indicar categorías, sin datos personales | PENDIENTE |
| Ejemplo de turno que cruce medianoche, cambio de semana o año, si existe en el cliente; indicar horario pactado y resultado esperado conocido | PENDIENTE |
| Persona que resolverá las interpretaciones concretas que no puedan determinarse con esas condiciones y las fuentes normativas | PENDIENTE |

Puedes entregar los horarios en una tabla o archivo ficticio e indicar su ruta.
Ejemplo de formato: `turno | días | entrada | salida | descanso | puede salir | vigencia`.
Si no conoces un resultado de cálculo, indica «por verificar»; lo convertiré en
un caso explícito para resolverlo, sin inventar la condición del empleador.

## 5. Texto del acuse y evidencia recuperable — tareas 3, 10 y 15

**Necesito qué documento se presenta y cómo se conservará la evidencia que falta.**

| Dato o decisión que debes completar | Tu respuesta |
| --- | --- |
| Texto exacto o ruta del documento que verá el trabajador al expresar conformidad u objeción; si no existe, indicar quién revisará una propuesta | PENDIENTE |
| Versión inicial y fecha de entrada en vigor del documento, o quién las definirá con el texto final | PENDIENTE |
| Persona/rol que representa al empleador y cómo quedará identificado en el proceso | PENDIENTE |
| Responsable de atender objeciones, plazo de respuesta y canal de seguimiento | PENDIENTE |
| Qué debe volver a revisar el trabajador tras corregir, reabrir y cerrar otra versión | PENDIENTE |
| Destino de sobres rechazados, incluso sin clave identificable: ampliar archivo del servidor y expediente, o indicar otra custodia recuperable concreta | PENDIENTE |
| Recibos: ¿se requiere conservar el JSON original recibido o basta reconstrucción identificada como tal? | PENDIENTE |
| Quién conservará el expediente descargado, su verificador y referencias de integridad fuera del servicio | PENDIENTE |
| Copia local Android: mantener sin purga por ahora, o implementar purga de duplicados después de demostrar recuperación íntegra | PENDIENTE |
| Si se pide purga: tiempo de disponibilidad local y evento desde el que se cuenta, para cada tipo de duplicado | PENDIENTE |
| Quién registra impedimentos de borrado por incidencias/reclamaciones y quién puede levantarlos | PENDIENTE |
| Responsable de aceptar la consulta de evidencia histórica fuera de Zenit | PENDIENTE |

Los plazos del archivo laboral ya documentados no se vuelven a elegir aquí.
La purga no alcanzará pendientes ni evidencia sin recuperación demostrada.
El texto histórico que nunca se guardó no puede reconstruirse como si fuera
auténtico; habrá que documentar esa ausencia. [Brechas concretas](retencion-android.md#contraste-de-evidencia-para-continuar--5-de-noviembre-de-2026).

## 6. Tarjetas auténticas y teléfonos — tarea 4

**Necesito material físico y especificación suficiente para autenticar tarjetas.**

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Fabricante y modelo exacto de la tarjeta, o responsable que los identificará antes de decidir | PENDIENTE |
| Ruta de ficha técnica/documentación y contacto del proveedor/integrador, si existe | PENDIENTE |
| Protocolo de autenticación y provisión disponible; si falta, indicar quién decidirá tras una propuesta técnica | PENDIENTE |
| Responsable de entregar tarjetas de prueba compatibles y fecha de disponibilidad | PENDIENTE |
| Responsable de generar, custodiar, rotar y revocar sus claves; ubicación privada del material existente | PENDIENTE |
| Teléfonos/modelos Android que se deben soportar, con versión Android y NFC disponible | PENDIENTE |
| ¿Se utilizará el Samsung SM-S928B ya ensayado? ¿Qué terminal compartida se probará? | PENDIENTE |
| ¿El piloto mantiene tarjeta en teléfono personal y en terminal compartida, o necesita otro mecanismo de identificación? Describirlo si aplica | PENDIENTE |
| Persona disponible para pruebas físicas y horarios de acceso al material | PENDIENTE |

Si sólo se dispone de tarjetas de ejemplo, indícalo. Leer el UID no demuestra
autenticación. La captura release seguirá protegida hasta integrar y probar el
protocolo real; no se cerrará retirando únicamente la comprobación de debug.

## 7. Puntualidad, ausencias, vacaciones e incapacidades — tarea 17

**Necesito las reglas operativas del cliente y ejemplos ficticios de sus resultados.**

| Dato o decisión que debes completar | Tu respuesta |
| --- | --- |
| Alcance inicial: comparación informativa con revisión humana, o resultados operativos definidos por reglas del cliente | PENDIENTE |
| Tolerancias por turno para retardo y salida anticipada; indicar expresamente si son cero | PENDIENTE |
| Redondeos autorizados en el proceso del cliente, si existen, y su aplicación esperada sin perder las marcas originales | PENDIENTE |
| Cómo se clasifica una jornada sin marcas y quién revisa antes de determinar la causa | PENDIENTE |
| Quién solicita, aprueba, cancela y corrige vacaciones, permisos e incapacidades | PENDIENTE |
| Evidencia requerida para cada caso y quién puede consultarla; usar documentos ficticios | PENDIENTE |
| Efecto esperado en jornada/semana y dato que debe recibir nómina; indicar reglas aún no definidas | PENDIENTE |
| Calendario y excepciones del piloto, o ruta de archivo ficticio | PENDIENTE |
| Responsable que aceptará los casos de asistencia y ausencias | PENDIENTE |

Entrega al menos un ejemplo ficticio de cada caso aplicable: puntual, retardo,
salida anticipada, ausencia sin resolver, permiso, vacaciones e incapacidad.
Formato: `horario | marcas/solicitud | clasificación esperada | efecto esperado`.

## 8. Precisiones del comportamiento existente — tareas 9, 13 y 15

**Necesito resolver estas tres precisiones de producto; no vuelven a abrir Q10–Q13.**

| Decisión | Tu respuesta |
| --- | --- |
| SUP-025/comida: ¿ratificas motivo obligatorio, cancelación antes de vigencia y al menos siete días de aviso hasta el día de entrada, incluso si la empresa se configuró mal al alta? La fecha sigue siendo el primer día de semana dentro de la siguiente quincena | PENDIENTE |
| Ubicación: ¿se conserva con incidencia el marcaje fuera de sede o con ubicación dudosa/simulada/ausente, y sin incidencia de ubicación si no hay sede asignada? Si cambia, indicar resultado por caso y por modalidad personal/terminal | PENDIENTE |
| Cierre automático: ¿se conserva una ejecución semanal, dejando bloqueados para intervención humana, o se requieren reintentos? Si se requieren, indicar cuándo y hasta cuándo | PENDIENTE |

## 9. Entorno, personas y aceptación de los recorridos — tareas 5, 6, 9, 12, 13, 15 y 16

**Necesito disponibilidad de entorno/hardware y responsables que revisen los resultados.**

| Dato que debes completar | Tu respuesta |
| --- | --- |
| ¿La primera validación será en la nueva VPS con datos ficticios? Si hay otro destino, identificarlo | PENDIENTE |
| Responsable de aceptación del cliente y persona que autoriza el primer uso con datos reales después de superar las comprobaciones | PENDIENTE |
| Responsable de privacidad/contratos del cliente, para los documentos operativos pendientes | PENDIENTE |
| Quién puede proporcionar cuentas ficticias por rol o revisar las que se preparen para el ensayo | PENDIENTE |
| Empresa ficticia y dos sedes de ensayo permitidas; si pueden crearse desde cero, indicarlo | PENDIENTE |
| Navegador y lector de pantalla disponibles para teclado, anuncios, zoom 200 % y ancho 320 px | PENDIENTE |
| Persona y fecha para validar portal, operador, supervisión por sedes, trabajador y Android con sesión real | PENDIENTE |
| Disponibilidad de Docker y control del navegador/escritorio en esta estación, o equipo alternativo donde ejecutar las comprobaciones bloqueadas | PENDIENTE |
| Ventana de instalación/pruebas; si hay servicio activo, indisponibilidad máxima permitida | PENDIENTE |

Yo obtendré commit, migraciones e inventario de imágenes efectivos cuando exista
acceso. También ejecutaré las comprobaciones y prepararé el acta por rol; no
necesitas calcular esos datos ni aceptar anticipadamente un resultado no probado.

## 10. Carga y continuidad — tarea 18

**Necesito objetivos medibles para probar la VPS; ya existen perfiles de 50/300 empleados.**

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Perfil del primer piloto: empleados, terminales y teléfonos personales | PENDIENTE |
| Dispositivos marcando simultáneamente y ventana de hora pico; ejemplo: 30 dispositivos durante 5 minutos | PENDIENTE |
| Usuarios simultáneos consultando portal y trabajos de cierre/exporte/expediente durante ese pico | PENDIENTE |
| Tiempo máximo aceptable para el 95 % de consultas y sincronizaciones, y porcentaje de errores admisible | PENDIENTE |
| Tiempo máximo aceptable para cierre, CSV y expediente del perfil elegido | PENDIENTE |
| Duración de la prueba sostenida o responsable que revisará una propuesta de prueba | PENDIENTE |
| Horario de operación, interrupción tolerable y responsable de DNS/certificados/incidentes | PENDIENTE |

Si desconoces concurrencia o tiempos, responde «Propón una solución» junto con
el tamaño/horario del piloto; prepararé objetivos para revisión. Los objetivos
de respaldo 24 h/4 h ya acordados se mantienen separados de estos tiempos.

## 11. Prueba desde dos IP públicas — tarea 8, previamente delegada

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Nombre/alias del desarrollador que conserva esta tarea | PENDIENTE |
| ¿Ya tiene resultado? Indicar ruta del acta; si no, fecha y conexiones disponibles para probar | PENDIENTE |

La delegación y el aplazamiento previos se conservan. Para cerrar todas las tareas
hará falta esa evidencia; dos dispositivos en el mismo Wi-Fi no la sustituyen.

## 12. Nómina y conector — tarea 19

**Necesito el contrato real de intercambio del primer cliente, con muestras ficticias.**

| Dato que debes completar | Tu respuesta |
| --- | --- |
| Nombre del sistema de nómina, versión y proveedor | PENDIENTE |
| Tipo de integración que admite: archivo, API o conector; ruta de documentación | PENDIENTE |
| Ruta de un archivo ficticio válido/importable o ejemplos ficticios de peticiones y respuestas | PENDIENTE |
| Campos obligatorios, identificador del empleado, formatos de fechas, unidades, codificación y separador, si no están en la documentación | PENDIENTE |
| ¿Sólo se envían resultados o también se sincroniza el padrón? ¿Qué sistema manda sobre cada dato? | PENDIENTE |
| Cómo recibe correcciones, cancelaciones, periodos reabiertos y reintentos sin duplicar | PENDIENTE |
| Entorno de prueba disponible y ruta privada de acceso, si requiere autenticación | PENDIENTE |
| Responsable del cliente/proveedor que validará la importación o sincronización | PENDIENTE |

Si aún no existe sistema de nómina elegido, indicarlo expresamente. Un CSV
genérico no permite declarar completado un conector aceptado por el cliente.

## 13. Alcance de la versión final — tarea 20

| Dato o decisión que debes completar | Tu respuesta |
| --- | --- |
| Funciones que exige el primer piloto y funciones que se diferirán expresamente | PENDIENTE |
| Consumidores del API además del portal/Android del repositorio: nombres/versiones o «ninguno» | PENDIENTE |
| Compatibilidad que requieren esos consumidores y responsable de aceptar cambios del contrato | PENDIENTE |
| Responsable de aceptar la versión 1.0 y fecha objetivo condicionada a superar sus comprobaciones | PENDIENTE |

Los diferimientos se registrarán como tales. Reducir el alcance del piloto no
convierte funciones diferidas en tareas terminadas ni elimina los bloqueos del
uso con datos reales.

**Opcional, fuera de las 17 tareas abiertas:** la automatización CI ya existe.
Si quieres cambiar la protección de `main`, indica si exigirá PR, checks y/o
revisión humana, y quién administra el repositorio. Si no respondes, se conserva
la política actual; no bloquea recopilar las respuestas de este documento.

## Cómo se usarán tus respuestas

1. Completar destino, acceso, identidad, claves y responsables con los bloques 1–3.
2. Convertir condiciones y decisiones de los bloques 4–8 en cambios y casos
   verificables, preservando históricos y los controles existentes.
3. Desplegar y comprobar en el destino, ejecutar recuperación, hardware,
   accesibilidad, carga e integración según los recursos de los bloques 9–12.
4. Presentar resultados y pendientes concretos al responsable de aceptación;
   después congelar el contrato/versionar según el bloque 13.

Puedes contestar todo de una vez. Para empezar por los bloqueos más inmediatos,
prioriza **1–6 y 9**. Las respuestas permiten completar el trabajo: cada tarea
se cerrará al tener su implementación, prueba y aceptación correspondientes.
