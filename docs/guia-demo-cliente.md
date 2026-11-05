# Guía de demo Zenit para el cliente

Referencia: candidata local 0.18.0, 5 de noviembre de 2026.

## 1. Zenit - Guía para tu demo

Para clientes y administradores, sin programación

Del primer acceso al cierre semanal. Sigue las rutas que aparecen en pantalla y utiliza sólo personas y datos ficticios durante la demostración.

> Versión de referencia: candidata local 0.18.0, 5 de noviembre de 2026. Las capturas son de una empresa ficticia. Confirma con soporte la versión de tu dirección de demo antes de seguir los pasos.

### El recorrido

Preparar el servicio → Entrar → Crear accesos → Registrar sedes y personas → Asignar horarios → Vincular dispositivo → Consultar asistencia → Resolver incidencias → Cerrar → Acusar y descargar.

| Si necesitas... | Ve a la página |
| --- | --- |
| Qué pedir a soporte y quién hace qué | 2 |
| Crear cuenta e iniciar sesión | 3 |
| Asignar usuarios, roles y sedes | 4 |
| Sedes, empleados e importación | 5 |
| Horarios, comida y jornada legal | 6 |
| Tarjetas y activación del teléfono | 7 |
| Captura y sincronización | 8 |
| Incidencias y cierre de semana | 9 |
| Acuse, CSV y expediente | 10 |
| Recuperación, bajas y conservación | 11 |
| Guion de demo y solución de problemas | 12 |

> Estado de la demo: el portal tiene funciones conectadas. La captura Android de producción sigue bloqueada hasta integrar autenticación de tarjetas reales. Una presentación con ejemplos no genera asistencia real. No presentes estas funciones pendientes como terminadas.

## 2. Antes de empezar

Responsables, materiales y primera empresa

### Lo que soporte debe entregarte

1. Dirección HTTPS del portal de tu instancia y contacto de soporte por el canal acordado. La dirección local de las capturas no es la de tu empresa.
2. Cuenta personal de administración preparada, contraseña inicial por canal seguro y procedimiento de verificación del correo. Un segundo usuario de prueba permite comprobar permisos.
3. Si se mostrará Android: archivo de instalación autorizado, teléfono compatible, permisos de ubicación y, cuando corresponda, NFC y tarjetas preparadas por soporte.
4. Empresa de prueba, una sede, dos empleados ficticios y una semana terminada con marcajes de prueba coherentes para poder mostrar cierre, acuse y CSV. Si no existen, solicita su preparación.

### Quién hace cada cosa

| Responsable | Dónde y qué hace |
| --- | --- |
| Soporte / operador | Prepara la instancia privada del cliente, las identidades y el primer administrador. En el portal de operador da de alta la empresa y consulta su uso mensual. |
| Administrador del cliente | En su portal gestiona usuarios, configuración, sedes y personas. Otorga expresamente el permiso de expediente. |
| RH / supervisión | Gestionan la asistencia según sus permisos. Supervisión opera en sus sedes asignadas. |
| Trabajador | Consulta su propia asistencia y acusa el cierre. Puede usar teléfono personal enrolado; una terminal compartida no muestra su semana personal. |

### Alta inicial de empresa: la hace el operador

1. Entrar con la cuenta de operador y abrir Empresas → Dar de alta empresa.
2. Completar Nombre, Identificador definitivo, Zona horaria, inicio de semana y Descanso o comida. Elegir expresamente la política de comida con el cliente.
3. Indicar el correo exacto de quien administrará la empresa. Pulsar Guardar empresa y revisar la confirmación.
4. El administrador entra con la identidad verificada de ese mismo correo. La empresa creada no crea por sí sola su contraseña.

> Antes de una demo con personas reales: soporte debe confirmar privacidad, acceso, respaldo y recuperación de esa instancia. Por ahora siguen pendientes proveedor/dominio, bucket efectivo, SMTP y aceptación de producción.

## 3. Crear cuenta e iniciar sesión

Cuenta personal + permiso en la empresa

### 1. Preparar la identidad: soporte

El sistema de acceso se llama Keycloak. El registro público está deshabilitado. El cliente pide la cuenta a soporte; no necesita entrar a la consola técnica.

1. Soporte abre la consola de administración de Keycloak de esa instancia, selecciona el espacio zenit y va a Users → Add user.
2. Registra el correo real y nombre de la persona. En Credentials → Set password prepara una contraseña inicial temporal por canal seguro, sin compartir cuentas.
3. Prepara las acciones de cambio de contraseña, configuración de OTP y códigos de recuperación. La verificación del correo debe completarse con el procedimiento autorizado; crear el usuario no demuestra que sea dueño del correo.
4. Con SMTP funcional, la persona completa los enlaces de verificación/recuperación enviados a su correo. SMTP aún está pendiente: soporte debe acordar y comprobar el alta de la demo; no se promete correo automático.

### 2. Entrar: cada persona

1. Abrir la dirección que entregó soporte y pulsar Iniciar sesión si aparece.
2. Escribir su correo/usuario y contraseña. Si se exige, cambiar la contraseña inicial por una personal.
3. Configurar la aplicación autenticadora con el código QR mostrado por Keycloak y escribir el código temporal. No enviar el QR ni sus códigos a otras personas.
4. Guardar los 12 códigos de recuperación en un lugar privado y separado del teléfono; cada código se usa una vez. Confirmar que se guardaron cuando lo pida la pantalla.
5. Al volver al portal, comprobar el nombre de la empresa y el de la persona. Si no aparecen, revisar con administración la invitación y el correo exacto.

> La identidad permite entrar; la invitación permite trabajar en una empresa. Ambas deben existir. Nunca uses la cuenta del desarrollador o una contraseña compartida para la demo del cliente.

### Resultado esperado

Ves tu empresa y únicamente las secciones de tus roles. Al terminar usa Cerrar sesión, especialmente en computadoras compartidas.

## 4. Asignar usuarios y permisos

Administrador · Portal → Usuarios

1. Abrir Usuarios → Invitar usuario.
2. Escribir el mismo Correo de la cuenta verificada, Nombre visible y al menos un rol. Esta acción no envía una invitación por correo ni crea contraseña.
3. Para Trabajador, elegir además Empleado vinculado. Crear al empleado primero si no aparece. El vínculo no asigna automáticamente el rol.
4. Para Supervisión, elegir Sede para supervisión y pulsar Agregar sede de supervisión por cada sede autorizada. Comprobar la lista antes de guardar.
5. Pulsar Guardar usuario. La persona entra con su propia cuenta; revisar que pase de Invitado a Activo al vincularse. Para cambiar permisos, usar Editar junto a esa persona.

| Rol | Uso en la demo |
| --- | --- |
| Administración | Configura la empresa y gestiona accesos; puede realizar las operaciones administrativas habilitadas. |
| RH | Gestiona padrón, horarios y asistencia; no administra usuarios. |
| Supervisión | Consulta y atiende asistencia en sus sedes. Sin sedes no obtiene datos de supervisión. |
| Trabajador | Consulta su propia semana y emite su acuse, con empleado vinculado. |
| Auditoría | Consulta información de la empresa y exportes. Combinada con Supervisión amplía lectura; las escrituras siguen limitadas por las sedes. |

Formulario real con datos ficticios. El permiso de expediente se concede por separado desde la lista de usuarios.

> Concede sólo lo necesario. Administración o RH adicionales amplían el alcance a toda la empresa. El administrador no recibe automáticamente permiso de expediente empresarial: debe concederlo expresamente.

## 5. Registrar sedes y empleados

Administrador / RH · Portal

### Crear una sede

1. Abrir Sedes → Agregar.
2. Completar Nombre y Zona horaria. Pedir a soporte o al responsable del lugar la Latitud y Longitud correctas; son la ubicación del centro de trabajo.
3. Indicar Radio de geocerca (metros), entre 20 y 2.000. Por ejemplo, 100 metros sólo si corresponde al lugar real.
4. Pulsar Confirmar y comprobar que la sede figura activa. La geocerca aporta evidencia puntual de ubicación; no equivale a seguimiento continuo.

### Crear empleados uno por uno

1. Abrir Empleados → Agregar.
2. Escribir un Identificador externo único, por ejemplo DEMO-001, el Nombre, la Sede y Fecha de alta.
3. Pulsar Confirmar. Repetir con DEMO-002. Crear empleado no crea cuenta, tarjeta ni horario.
4. Si la persona usará el portal, volver a Usuarios y vincular este empleado a su cuenta y rol Trabajador.

### Cargar varias personas con un archivo

1. Abrir Importar empleados y descargar el ejemplo. Conservar sus cuatro encabezados: external_id, display_name, employment_start, site_name.
2. Editar una copia con datos ficticios, fechas AAAA-MM-DD y el nombre exacto de la sede. Guardar como CSV UTF-8.
3. Seleccionar el archivo y validar sin aplicar. Revisar filas aceptadas y errores; corregir el archivo cuando corresponda.
4. Aplicar expresamente las filas aceptadas y leer la confirmación. El mismo identificador actualiza al empleado; una sede vacía lo deja sin sede. El archivo no asigna tarjetas ni horarios.

> Antes de aplicar una importación revisa los identificadores: pueden actualizar personas existentes. El límite es 5.000 filas y 1 MB. Al abandonar la pestaña no se conserva el archivo en pantalla.

### Resultado esperado

Dos empleados ficticios aparecen en su sede. Puedes verlos en Empleados y seleccionarlos después en Usuarios, Horarios y Dispositivos.

## 6. Horarios, comida y jornada

Administrador / RH · Horarios y Configuración

### Crear y asignar un horario

1. Abrir Horarios → Crear horario. Indicar nombre, zona horaria y Vigente desde; la fecha final es opcional.
2. Seleccionar los días y completar Entrada, Salida y Descanso (minutos) de cada uno. Una salida anterior a la entrada termina al día siguiente.
3. Guardar horario. En la lista, pulsar Asignar junto al horario creado.
4. Elegir Empleado y Asignar desde dentro de su vigencia. Confirmar asignación y revisar la confirmación. Una asignación futura no se muestra como vigente hoy.
5. Para sustituir un horario, crear el nuevo y asignarlo desde una fecha posterior al inicio de la última asignación. Revisar el cierre de la anterior; no se edita el horario existente.

### Cambiar cómo se marca la comida

1. Abrir Configuración → Programar cambio de comida. Seleccionar Se marca o No se marca según la operación acordada.
2. Escribir el motivo y revisar la fecha calculada: primer día de semana de la siguiente quincena que cumpla al menos siete días de aviso.
3. Confirmar sólo si los datos son correctos. Revisar el aviso y comunicarlo al personal. Antes de su vigencia se puede cancelar con motivo.
4. No usar este cambio para corregir marcajes pasados. La política aplicable depende de la fecha de la jornada.

> Registrar un descanso no autoriza descontarlo siempre: si la persona no puede salir del lugar de trabajo, el artículo 64 LFT lo considera tiempo efectivo. Esa condición del cliente aún debe confirmarse; el sistema advierte el cálculo pendiente. No certifiques nómina con ese supuesto sin resolver.

### Qué toma como base la reforma

Máximo ordinario semanal: 48 h en 2026, 46 en 2027, 44 en 2028, 42 en 2029 y 40 en 2030. Los máximos diarios diurno, nocturno y mixto son 8, 7 y 7,5 h. Un contrato más favorable puede fijar menos. La reducción no permite disminuir salarios ni prestaciones.

El cálculo actual incorpora clasificación y límites diarios/semanales sin duplicar horas extra. Los horarios aún no generan automáticamente retardos, faltas, vacaciones ni incapacidades. Tampoco calculan un recibo de nómina.

Base: decreto DOF de 1 de mayo de 2026 y LFT, artículos 60 a 64. Referencias en página 12. Los límites especiales y contratos requieren sus datos concretos.

## 7. Tarjetas y dispositivos

Administrador / RH · Tarjetas y Dispositivos

### Registrar y asignar una tarjeta

1. Soporte prepara la tarjeta y proporciona su huella compatible por el procedimiento autorizado. No inventar una huella ni confundirla con el número impreso.
2. En Tarjetas → Agregar, introducir Número impreso y Huella de tarjeta. La huella se registra una vez y no se consulta después.
3. En la tarjeta disponible, pulsar Asignar y elegir el empleado correcto. Confirmar. Ante pérdida o daño, usar Revocar y expresar el motivo.

> Pendiente de uso real: falta elegir y autenticar la tecnología física de tarjeta e integrar la captura de producción. Registrar inventario, leer NFC o preparar una tarjeta de ejemplo no resuelve esa autenticación. Pide a soporte una demo ficticia autorizada; no intentes habilitar captura de producción.

### Vincular el teléfono o la terminal

1. Abrir Dispositivos → Emitir código.
2. Elegir Personal para el teléfono de un empleado, o Terminal para un equipo compartido de una sede.
3. En Personal elegir la persona; en Terminal elegir la sede y, si se desea, un nombre de la terminal. Emitir código.
4. Entregar el código únicamente a quien activará el equipo. Es temporal, de un uso y vence a los 15 minutos. Si vence, emitir otro.
5. En Android abrir Mi asistencia y seguir la pantalla de activación: introducir el código y confirmar los permisos solicitados. Usar la instalación y servidor preparados por soporte.
6. Volver a Dispositivos: comprobar modalidad, persona/sede, modelo, estado y última conexión. Si no aparece activado, no reutilizar un código ya consumido.

### Dos accesos en Android

| Entrada | Para qué sirve |
| --- | --- |
| Administración | Abre el portal web del servicio para gestionar la empresa según el rol. |
| Mi asistencia | Abre la operación de asistencia del dispositivo enrolado. En personal permite consultar la semana y acusar un cierre. |
| Ver presentación con ejemplos | Si soporte entrega esa variante de demostración, muestra datos locales. No acredita captura, vacaciones o puntualidad conectadas. |

Si se pierde un equipo, administración usa Revocar en Dispositivos. Conserva el motivo y solicita a soporte la sustitución; no borres la app con evidencia pendiente de sincronizar.

## 8. Captura y sincronización

Trabajador · Android preparado por soporte

> Esta página explica el recorrido previsto y disponible en el entorno de prueba autorizado. La captura en la versión de producción sigue bloqueada. Si la demo no dispone del equipo y tarjeta preparados, muestra la presentación y los registros ficticios precargados, indicando su origen.

### Registrar una marca en la demo autorizada

1. Abrir Mi asistencia y comprobar la persona o sede a la que pertenece el dispositivo.
2. Mantener fecha y hora automáticas. Activar ubicación y conceder los permisos solicitados; para terminal/tarjeta, activar NFC cuando corresponda.
3. En la pantalla de marcaje seguir la indicación de Entrada, inicio/fin de descanso o Salida. Acercar la tarjeta preparada al lector cuando se solicite.
4. Esperar la confirmación y leer el tipo de marca recibido. Evitar marcar repetidamente para corregir una duda.
5. Si la marca tiene una incidencia, comunicarla a administración. La corrección se hace con motivo en el portal, preservando el registro original.

### Qué significa trabajar sin conexión

1. La aplicación conserva pendientes cifrados para enviarlos después dentro de la vigencia y capacidad de su sesión.
2. Al recuperar conexión, mantener la app y el dispositivo disponibles para sincronizar. Revisar el estado y los recibos; guardar localmente no significa que el servidor ya aceptó.
3. Comprobar si el resultado fue aceptado, registrado con incidencia o rechazado. Si falla, conservar el equipo y pedir soporte con la hora del problema.
4. No desinstalar, borrar almacenamiento ni cambiar de teléfono para liberar pendientes. Una sesión vencida puede necesitar renovación; no se promete operación indefinida sin red.

### Qué mostrar al cliente

Una entrada y una salida ficticias, sus horas y el estado de sincronización. Si se prueba corte de red, soporte debe supervisarlo y comprobar la recepción posterior. El aviso de un futuro cambio de comida necesita además su prueba física y sin red; no se da por aceptado sólo por ver el portal.

> Si ves una marca errónea, no la sustituyas haciendo otra al azar. Anota persona, fecha, hora y resultado. Administración revisará Incidencias. Una alerta o rechazo nunca equivale por sí solo a ausencia laboral.

## 9. Revisar y cerrar la semana

Administración / RH / supervisión según permisos

### Consultar y resolver incidencias

1. Abrir Incidencias y filtrar la persona, fechas y estado que necesitas.
2. Abrir el detalle y consultar su semana: revisar marcajes, descansos, alertas y evidencia antes de decidir.
3. Asignar la incidencia a quien deba atenderla, si corresponde. Resolver con la opción apropiada y un motivo comprensible.
4. Si hay una corrección autorizada, agregar un marcaje, excluir uno del cálculo o cambiar su tipo, según el formulario. Revisar hora y zona. El registro original se conserva.
5. Volver a consultar la semana. Confirmar los minutos y que la incidencia quedó resuelta. Supervisión sólo puede actuar en sus sedes asignadas.

### Cerrar una semana ya terminada

1. Como administración o RH, abrir Cierres y elegir la semana y personas. Para la demo usar una semana terminada preparada por soporte.
2. Consultar la vista previa/detalle y atender incidencias pendientes antes de cerrar.
3. Ejecutar el cierre directo o iniciar una corrida para el conjunto de personas, según la pantalla disponible.
4. Consultar el estado de la corrida. Si hay personas bloqueadas, revisar el motivo, corregir lo que corresponda y repetir para quienes faltan.
5. Comprobar el cierre y su versión. Pedir al trabajador que revise su propia semana y emita el acuse.

### Si aparece un error después del cierre

Administración puede reabrir con motivo. La versión anterior y sus acuses se conservan. Tras corregir, cerrar de nuevo y solicitar la revisión del nuevo cierre. Una objeción del trabajador no reabre automáticamente.

> Un cierre exitoso no certifica que todos los supuestos laborales estén resueltos. Revisar especialmente descanso computable, condiciones contractuales y regímenes especiales. El cierre programado sólo trabaja sobre semanas sin incidencias pendientes; habilitarlo después de acordar la operación.

### Resultado esperado

La semana ficticia muestra un cierre identificable, sus totales y la versión correspondiente. Las personas bloqueadas están explicadas y no se confunden con cierres completos.

## 10. Acuse y entrega de resultados

Trabajador y personas autorizadas · Portal / Android

### Acusar la semana: trabajador

1. Entrar con su propia cuenta a Mi asistencia en el portal, o usar Mi semana en su teléfono personal enrolado.
2. Elegir la semana cerrada y revisar sus horas, alertas y versión.
3. Indicar conformidad u objeción según lo que realmente corresponda y confirmar el texto mostrado.
4. Comprobar que el acuse quedó registrado en el servidor. Para una corrección, avisar a administración; una terminal compartida no ofrece esta consulta personal.

### Descargar un CSV: administración, RH o auditoría

1. Abrir Exportes y solicitar el CSV de la semana/cierres que corresponden.
2. Consultar el estado hasta que esté listo. Descargar y guardar el archivo y su manifiesto en una carpeta privada del cliente.
3. La descarga es de un uso y su enlace temporal vence a los 15 minutos. Si se consume o falla después de comenzar, solicitar otra entrega.
4. Revisar el CSV antes de usarlo. Incluye cierres vigentes y el estado de acuse disponible; no es un conector de nómina aceptado por el cliente.

### Descargar un expediente empresarial

1. Administración abre Usuarios → Permiso de expediente de la persona. Marca la confirmación y pulsa Conceder permiso. Debe ser una cuenta activa vinculada.
2. La persona autorizada abre Expediente empresarial, solicita la preparación y consulta estado y vencimiento. Guardar el manifiesto.
3. Antes de descargar, completar la nueva verificación de identidad con OTP. Volver al portal y pulsar Continuar con la descarga verificada.
4. Guardar el ZIP, manifiesto y verificador actualizado entregado por soporte. La descarga no se reanuda: si se consume e interrumpe, solicitar otro expediente.
5. Pedir a soporte una demostración de verificación y consulta sin conexión. Guardar el resultado y leer las limitaciones declaradas; no borrar el origen por obtener un ZIP.

> El expediente de una empresa y el respaldo completo del servicio son distintos. El expediente declara evidencia ausente, incluidos ciertos sobres rechazados, textos históricos y datos sólo locales de Android. La aceptación integral del acuse y conservación sigue pendiente. El pago de nómina depende de la integración acordada con el cliente.

## 11. Recuperación y operación diaria

Accesos individuales y conservación de evidencia

### Si alguien pierde el acceso

| Situación | Qué hacer |
| --- | --- |
| Olvidó la contraseña | Con SMTP verificado y habilitado, usar la recuperación por correo de la pantalla de acceso y seguir el enlace. Como SMTP sigue pendiente, solicitar el procedimiento a soporte; no prometer que llegará un mensaje. |
| Perdió el autenticador | Conservar su contraseña y usar un código de recuperación no consumido en la opción de acceso que ofrece Keycloak. Después, restablecer el autenticador y renovar/guardar los códigos mediante el proceso de la cuenta o soporte. |
| Perdió también los códigos | Contactar a soporte. La recuperación excepcional requiere verificar identidad y doble aprobación de personas distintas, documentada. No se omite MFA por una solicitud informal. |
| Administrador pide cambio de contraseña | Usuarios → Exigir cambio de contraseña → confirmar. Obliga una nueva contraseña al siguiente ingreso; no recupera por sí solo una contraseña olvidada ni elimina OTP. |

### Baja de una persona

1. En Empleados → Editar, elegir Inactivo e indicar Fecha efectiva de baja, no futura. Revisar antes de confirmar.
2. La baja revoca la tarjeta y termina el horario aplicable; conserva históricos. Reactivar no restituye tarjeta ni horario automáticamente.
3. Revisar aparte los accesos de portal en Usuarios y los dispositivos en Dispositivos; deshabilitar/revocar según corresponda. No asumir que la baja del empleado elimina su identidad.

### Responsabilidades del cliente y soporte

Cada cliente tendrá su instancia en VPS privada. Los desarrolladores la administran y dan soporte; el administrador del cliente conserva su acceso propio. El bucket S3 externo lo gestiona soporte. La custodia del material de recuperación corresponde al administrador del cliente; si no la asume, se documenta su entrega y responsable desarrollador de respaldo.

La política acordada es copia externa diaria, retención de 30 días, RPO 24 h y RTO 4 h; su provisión y ensayo real siguen pendientes. Rotar respaldos no sustituye el archivo laboral ni elimina la obligación del empleador de conservar y exhibir registros.

> No compartir contraseñas, códigos OTP, códigos de recuperación ni claves de respaldo en capturas o correos de soporte. Suspender una empresa mantiene captura/sincronización de dispositivos existentes, pero bloquea administración y nuevas vinculaciones.

## 12. Guion de demo y ayuda rápida

20 minutos con datos ficticios preparados

| Minutos | Recorrido y comprobación |
| --- | --- |
| 0-3 | Entrar como administrador con cuenta propia y MFA. Mostrar empresa correcta y explicar qué prepara soporte. |
| 3-7 | Mostrar sede y crear un empleado ficticio. En Usuarios asignar el rol y vínculo correcto. Para supervisión agregar sólo su sede. |
| 7-10 | Crear/asignar un horario y mostrar configuración de comida. Revisar fecha futura y aviso sin cambiar producción. |
| 10-13 | Mostrar emisión/activación de código si hay equipo preparado. Para captura usar sólo prueba autorizada o presentación, aclarando cuál es. |
| 13-17 | Consultar semana ficticia terminada, resolver una incidencia y cerrar. En otra cuenta de trabajador, revisar y acusar. |
| 17-20 | Solicitar CSV y mostrar expediente con permiso expreso y OTP nuevo. Confirmar archivos guardados y cerrar sesión. |

### Cuando algo no aparece

| Problema | Revisión inicial |
| --- | --- |
| No puedo entrar / no llega correo | Verifica la dirección, cuenta exacta y hora automática del teléfono. SMTP puede estar pendiente; pide ayuda a soporte. |
| No veo una pestaña | Revisa el rol. Usuarios es sólo de administración; Expediente exige permiso explícito. No pidas contraseña de otro usuario. |
| Supervisión no ve datos | Comprueba sedes asignadas. Una semana con evidencia de otras sedes puede quedar fuera de su alcance. |
| No puedo cerrar / no hay acuse | La semana debe terminar y cerrar correctamente. Revisa incidencias y bloqueos; el trabajador acusa sólo su cierre. |
| Código o descarga vencidos | Solicita otro código/entrega. Los consumidos no se reutilizan. |
| El teléfono no marca | Confirma con soporte variante de demo, activación, sesión, permisos y hardware. Producción sigue bloqueada por autenticación de tarjeta. |

Para soporte, envía por el canal acordado: empresa, pantalla, acción, fecha/hora y referencia de error si aparece. Oculta datos personales y nunca envíes secretos. Al acabar, confirma que los pendientes se sincronizaron y conserva los archivos descargados.

### Fuentes y límites de esta guía

Pantallas y contrato del proyecto, candidato local 0.18.0. Esta guía no acredita despliegue público, pruebas físicas, aceptación de SUP-025, integración de nómina ni cumplimiento integral. El resto se registra por tarea en la bitácora.

[Reforma de jornada: DOF, 1 de mayo de 2026](https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537)

[Ley Federal del Trabajo vigente: Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf)

La elección de VPS y S3 es técnica: la reforma de jornada no prescribe esos proveedores. Las obligaciones de seguridad, privacidad y conservación siguen requiriendo su operación y documentación.
