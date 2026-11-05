"""Guía del cliente: generar PDF, fuente legible y renders para revisión visual.

Requiere reportlab, pypdf, pdfplumber y pypdfium2. No accede a servicios ni secretos.
Ejecutar desde la raíz del repositorio; las capturas opcionales son datos ficticios.
"""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
import pdfplumber
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/guia-demo-zenit-cliente.pdf'
TMP = ROOT / 'tmp/pdfs'
OUT.parent.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
for name, file in [('Arial', 'arial.ttf'), ('Arial-Bold', 'arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / file)))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial', boldItalic='Arial-Bold')

# Cada bloque es una página deliberada, con pasos y resultado comprobable.
PAGES = [
('Zenit\nGuía para tu demo', 'Para clientes y administradores, sin programación', [
('intro', 'Del primer acceso al cierre semanal. Sigue las rutas que aparecen en pantalla y utiliza sólo personas y datos ficticios durante la demostración.'),
('box', 'Versión de referencia: candidata local 0.18.0, 5 de noviembre de 2026. Las capturas son de una empresa ficticia. Confirma con soporte la versión de tu dirección de demo antes de seguir los pasos.'),
('h', 'El recorrido'),
('p', 'Preparar el servicio → Entrar → Crear accesos → Registrar sedes y personas → Asignar horarios → Vincular dispositivo → Consultar asistencia → Resolver incidencias → Cerrar → Acusar y descargar.'),
('table', [('Si necesitas...', 'Ve a la página'), ('Qué pedir a soporte y quién hace qué', '2'), ('Crear cuenta e iniciar sesión', '3'), ('Asignar usuarios, roles y sedes', '4'), ('Sedes, empleados e importación', '5'), ('Horarios, comida y jornada legal', '6'), ('Tarjetas y activación del teléfono', '7'), ('Captura y sincronización', '8'), ('Incidencias y cierre de semana', '9'), ('Acuse, CSV y expediente', '10'), ('Recuperación, bajas y conservación', '11'), ('Guion de demo y solución de problemas', '12')]),
('box', 'Estado de la demo: el portal tiene funciones conectadas. La captura Android de producción sigue bloqueada hasta integrar autenticación de tarjetas reales. Una presentación con ejemplos no genera asistencia real. No presentes estas funciones pendientes como terminadas.')]),
('Antes de empezar', 'Responsables, materiales y primera empresa', [
('h', 'Lo que soporte debe entregarte'),
('steps', ['Dirección HTTPS del portal de tu instancia y contacto de soporte por el canal acordado. La dirección local de las capturas no es la de tu empresa.', 'Cuenta personal de administración preparada, contraseña inicial por canal seguro y procedimiento de verificación del correo. Un segundo usuario de prueba permite comprobar permisos.', 'Si se mostrará Android: archivo de instalación autorizado, teléfono compatible, permisos de ubicación y, cuando corresponda, NFC y tarjetas preparadas por soporte.', 'Empresa de prueba, una sede, dos empleados ficticios y una semana terminada con marcajes de prueba coherentes para poder mostrar cierre, acuse y CSV. Si no existen, solicita su preparación.']),
('h', 'Quién hace cada cosa'),
('table', [('Responsable', 'Dónde y qué hace'), ('Soporte / operador', 'Prepara la instancia privada del cliente, las identidades y el primer administrador. En el portal de operador da de alta la empresa y consulta su uso mensual.'), ('Administrador del cliente', 'En su portal gestiona usuarios, configuración, sedes y personas. Otorga expresamente el permiso de expediente.'), ('RH / supervisión', 'Gestionan la asistencia según sus permisos. Supervisión opera en sus sedes asignadas.'), ('Trabajador', 'Consulta su propia asistencia y acusa el cierre. Puede usar teléfono personal enrolado; una terminal compartida no muestra su semana personal.')]),
('h', 'Alta inicial de empresa: la hace el operador'),
('steps', ['Entrar con la cuenta de operador y abrir Empresas → Dar de alta empresa.', 'Completar Nombre, Identificador definitivo, Zona horaria, inicio de semana y Descanso o comida. Elegir expresamente la política de comida con el cliente.', 'Indicar el correo exacto de quien administrará la empresa. Pulsar Guardar empresa y revisar la confirmación.', 'El administrador entra con la identidad verificada de ese mismo correo. La empresa creada no crea por sí sola su contraseña.']),
('box', 'Antes de una demo con personas reales: soporte debe confirmar privacidad, acceso, respaldo y recuperación de esa instancia. Por ahora siguen pendientes proveedor/dominio, bucket efectivo, SMTP y aceptación de producción.')]),
('Crear cuenta e iniciar sesión', 'Cuenta personal + permiso en la empresa', [
('h', '1. Preparar la identidad: soporte'),
('p', 'El sistema de acceso se llama Keycloak. El registro público está deshabilitado. El cliente pide la cuenta a soporte; no necesita entrar a la consola técnica.'),
('steps', ['Soporte abre la consola de administración de Keycloak de esa instancia, selecciona el espacio zenit y va a Users → Add user.', 'Registra el correo real y nombre de la persona. En Credentials → Set password prepara una contraseña inicial temporal por canal seguro, sin compartir cuentas.', 'Prepara las acciones de cambio de contraseña, configuración de OTP y códigos de recuperación. La verificación del correo debe completarse con el procedimiento autorizado; crear el usuario no demuestra que sea dueño del correo.', 'Con SMTP funcional, la persona completa los enlaces de verificación/recuperación enviados a su correo. SMTP aún está pendiente: soporte debe acordar y comprobar el alta de la demo; no se promete correo automático.']),
('h', '2. Entrar: cada persona'),
('steps', ['Abrir la dirección que entregó soporte y pulsar Iniciar sesión si aparece.', 'Escribir su correo/usuario y contraseña. Si se exige, cambiar la contraseña inicial por una personal.', 'Configurar la aplicación autenticadora con el código QR mostrado por Keycloak y escribir el código temporal. No enviar el QR ni sus códigos a otras personas.', 'Guardar los 12 códigos de recuperación en un lugar privado y separado del teléfono; cada código se usa una vez. Confirmar que se guardaron cuando lo pida la pantalla.', 'Al volver al portal, comprobar el nombre de la empresa y el de la persona. Si no aparecen, revisar con administración la invitación y el correo exacto.']),
('box', 'La identidad permite entrar; la invitación permite trabajar en una empresa. Ambas deben existir. Nunca uses la cuenta del desarrollador o una contraseña compartida para la demo del cliente.'),
('h', 'Resultado esperado'),
('p', 'Ves tu empresa y únicamente las secciones de tus roles. Al terminar usa Cerrar sesión, especialmente en computadoras compartidas.')]),
('Asignar usuarios y permisos', 'Administrador · Portal → Usuarios', [
('steps', ['Abrir Usuarios → Invitar usuario.', 'Escribir el mismo Correo de la cuenta verificada, Nombre visible y al menos un rol. Esta acción no envía una invitación por correo ni crea contraseña.', 'Para Trabajador, elegir además Empleado vinculado. Crear al empleado primero si no aparece. El vínculo no asigna automáticamente el rol.', 'Para Supervisión, elegir Sede para supervisión y pulsar Agregar sede de supervisión por cada sede autorizada. Comprobar la lista antes de guardar.', 'Pulsar Guardar usuario. La persona entra con su propia cuenta; revisar que pase de Invitado a Activo al vincularse. Para cambiar permisos, usar Editar junto a esa persona.']),
('table', [('Rol', 'Uso en la demo'), ('Administración', 'Configura la empresa y gestiona accesos; puede realizar las operaciones administrativas habilitadas.'), ('RH', 'Gestiona padrón, horarios y asistencia; no administra usuarios.'), ('Supervisión', 'Consulta y atiende asistencia en sus sedes. Sin sedes no obtiene datos de supervisión.'), ('Trabajador', 'Consulta su propia semana y emite su acuse, con empleado vinculado.'), ('Auditoría', 'Consulta información de la empresa y exportes. Combinada con Supervisión amplía lectura; las escrituras siguen limitadas por las sedes.')]),
('image', 'guia-demo-usuarios.png'),
('caption', 'Formulario real con datos ficticios. El permiso de expediente se concede por separado desde la lista de usuarios.'),
('box', 'Concede sólo lo necesario. Administración o RH adicionales amplían el alcance a toda la empresa. El administrador no recibe automáticamente permiso de expediente empresarial: debe concederlo expresamente.')]),
('Registrar sedes y empleados', 'Administrador / RH · Portal', [
('h', 'Crear una sede'),
('steps', ['Abrir Sedes → Agregar.', 'Completar Nombre y Zona horaria. Pedir a soporte o al responsable del lugar la Latitud y Longitud correctas; son la ubicación del centro de trabajo.', 'Indicar Radio de geocerca (metros), entre 20 y 2.000. Por ejemplo, 100 metros sólo si corresponde al lugar real.', 'Pulsar Confirmar y comprobar que la sede figura activa. La geocerca aporta evidencia puntual de ubicación; no equivale a seguimiento continuo.']),
('h', 'Crear empleados uno por uno'),
('steps', ['Abrir Empleados → Agregar.', 'Escribir un Identificador externo único, por ejemplo DEMO-001, el Nombre, la Sede y Fecha de alta.', 'Pulsar Confirmar. Repetir con DEMO-002. Crear empleado no crea cuenta, tarjeta ni horario.', 'Si la persona usará el portal, volver a Usuarios y vincular este empleado a su cuenta y rol Trabajador.']),
('h', 'Cargar varias personas con un archivo'),
('steps', ['Abrir Importar empleados y descargar el ejemplo. Conservar sus cuatro encabezados: external_id, display_name, employment_start, site_name.', 'Editar una copia con datos ficticios, fechas AAAA-MM-DD y el nombre exacto de la sede. Guardar como CSV UTF-8.', 'Seleccionar el archivo y validar sin aplicar. Revisar filas aceptadas y errores; corregir el archivo cuando corresponda.', 'Aplicar expresamente las filas aceptadas y leer la confirmación. El mismo identificador actualiza al empleado; una sede vacía lo deja sin sede. El archivo no asigna tarjetas ni horarios.']),
('box', 'Antes de aplicar una importación revisa los identificadores: pueden actualizar personas existentes. El límite es 5.000 filas y 1 MB. Al abandonar la pestaña no se conserva el archivo en pantalla.'),
('h', 'Resultado esperado'),
('p', 'Dos empleados ficticios aparecen en su sede. Puedes verlos en Empleados y seleccionarlos después en Usuarios, Horarios y Dispositivos.')]),
('Horarios, comida y jornada', 'Administrador / RH · Horarios y Configuración', [
('h', 'Crear y asignar un horario'),
('steps', ['Abrir Horarios → Crear horario. Indicar nombre, zona horaria y Vigente desde; la fecha final es opcional.', 'Seleccionar los días y completar Entrada, Salida y Descanso (minutos) de cada uno. Una salida anterior a la entrada termina al día siguiente.', 'Guardar horario. En la lista, pulsar Asignar junto al horario creado.', 'Elegir Empleado y Asignar desde dentro de su vigencia. Confirmar asignación y revisar la confirmación. Una asignación futura no se muestra como vigente hoy.', 'Para sustituir un horario, crear el nuevo y asignarlo desde una fecha posterior al inicio de la última asignación. Revisar el cierre de la anterior; no se edita el horario existente.']),
('h', 'Cambiar cómo se marca la comida'),
('steps', ['Abrir Configuración → Programar cambio de comida. Seleccionar Se marca o No se marca según la operación acordada.', 'Escribir el motivo y revisar la fecha calculada: primer día de semana de la siguiente quincena que cumpla al menos siete días de aviso.', 'Confirmar sólo si los datos son correctos. Revisar el aviso y comunicarlo al personal. Antes de su vigencia se puede cancelar con motivo.', 'No usar este cambio para corregir marcajes pasados. La política aplicable depende de la fecha de la jornada.']),
('box', 'Registrar un descanso no autoriza descontarlo siempre: si la persona no puede salir del lugar de trabajo, el artículo 64 LFT lo considera tiempo efectivo. Esa condición del cliente aún debe confirmarse; el sistema advierte el cálculo pendiente. No certifiques nómina con ese supuesto sin resolver.'),
('h', 'Qué toma como base la reforma'),
('p', 'Máximo ordinario semanal: 48 h en 2026, 46 en 2027, 44 en 2028, 42 en 2029 y 40 en 2030. Los máximos diarios diurno, nocturno y mixto son 8, 7 y 7,5 h. Un contrato más favorable puede fijar menos. La reducción no permite disminuir salarios ni prestaciones.'),
('p', 'El cálculo actual incorpora clasificación y límites diarios/semanales sin duplicar horas extra. Los horarios aún no generan automáticamente retardos, faltas, vacaciones ni incapacidades. Tampoco calculan un recibo de nómina.'),
('caption', 'Base: decreto DOF de 1 de mayo de 2026 y LFT, artículos 60 a 64. Referencias en página 12. Los límites especiales y contratos requieren sus datos concretos.')]),
('Tarjetas y dispositivos', 'Administrador / RH · Tarjetas y Dispositivos', [
('h', 'Registrar y asignar una tarjeta'),
('steps', ['Soporte prepara la tarjeta y proporciona su huella compatible por el procedimiento autorizado. No inventar una huella ni confundirla con el número impreso.', 'En Tarjetas → Agregar, introducir Número impreso y Huella de tarjeta. La huella se registra una vez y no se consulta después.', 'En la tarjeta disponible, pulsar Asignar y elegir el empleado correcto. Confirmar. Ante pérdida o daño, usar Revocar y expresar el motivo.']),
('box', 'Pendiente de uso real: falta elegir y autenticar la tecnología física de tarjeta e integrar la captura de producción. Registrar inventario, leer NFC o preparar una tarjeta de ejemplo no resuelve esa autenticación. Pide a soporte una demo ficticia autorizada; no intentes habilitar captura de producción.'),
('h', 'Vincular el teléfono o la terminal'),
('steps', ['Abrir Dispositivos → Emitir código.', 'Elegir Personal para el teléfono de un empleado, o Terminal para un equipo compartido de una sede.', 'En Personal elegir la persona; en Terminal elegir la sede y, si se desea, un nombre de la terminal. Emitir código.', 'Entregar el código únicamente a quien activará el equipo. Es temporal, de un uso y vence a los 15 minutos. Si vence, emitir otro.', 'En Android abrir Mi asistencia y seguir la pantalla de activación: introducir el código y confirmar los permisos solicitados. Usar la instalación y servidor preparados por soporte.', 'Volver a Dispositivos: comprobar modalidad, persona/sede, modelo, estado y última conexión. Si no aparece activado, no reutilizar un código ya consumido.']),
('h', 'Dos accesos en Android'),
('table', [('Entrada', 'Para qué sirve'), ('Administración', 'Abre el portal web del servicio para gestionar la empresa según el rol.'), ('Mi asistencia', 'Abre la operación de asistencia del dispositivo enrolado. En personal permite consultar la semana y acusar un cierre.'), ('Ver presentación con ejemplos', 'Si soporte entrega esa variante de demostración, muestra datos locales. No acredita captura, vacaciones o puntualidad conectadas.')]),
('p', 'Si se pierde un equipo, administración usa Revocar en Dispositivos. Conserva el motivo y solicita a soporte la sustitución; no borres la app con evidencia pendiente de sincronizar.')]),
('Captura y sincronización', 'Trabajador · Android preparado por soporte', [
('box', 'Esta página explica el recorrido previsto y disponible en el entorno de prueba autorizado. La captura en la versión de producción sigue bloqueada. Si la demo no dispone del equipo y tarjeta preparados, muestra la presentación y los registros ficticios precargados, indicando su origen.'),
('h', 'Registrar una marca en la demo autorizada'),
('steps', ['Abrir Mi asistencia y comprobar la persona o sede a la que pertenece el dispositivo.', 'Mantener fecha y hora automáticas. Activar ubicación y conceder los permisos solicitados; para terminal/tarjeta, activar NFC cuando corresponda.', 'En la pantalla de marcaje seguir la indicación de Entrada, inicio/fin de descanso o Salida. Acercar la tarjeta preparada al lector cuando se solicite.', 'Esperar la confirmación y leer el tipo de marca recibido. Evitar marcar repetidamente para corregir una duda.', 'Si la marca tiene una incidencia, comunicarla a administración. La corrección se hace con motivo en el portal, preservando el registro original.']),
('h', 'Qué significa trabajar sin conexión'),
('steps', ['La aplicación conserva pendientes cifrados para enviarlos después dentro de la vigencia y capacidad de su sesión.', 'Al recuperar conexión, mantener la app y el dispositivo disponibles para sincronizar. Revisar el estado y los recibos; guardar localmente no significa que el servidor ya aceptó.', 'Comprobar si el resultado fue aceptado, registrado con incidencia o rechazado. Si falla, conservar el equipo y pedir soporte con la hora del problema.', 'No desinstalar, borrar almacenamiento ni cambiar de teléfono para liberar pendientes. Una sesión vencida puede necesitar renovación; no se promete operación indefinida sin red.']),
('h', 'Qué mostrar al cliente'),
('p', 'Una entrada y una salida ficticias, sus horas y el estado de sincronización. Si se prueba corte de red, soporte debe supervisarlo y comprobar la recepción posterior. El aviso de un futuro cambio de comida necesita además su prueba física y sin red; no se da por aceptado sólo por ver el portal.'),
('box', 'Si ves una marca errónea, no la sustituyas haciendo otra al azar. Anota persona, fecha, hora y resultado. Administración revisará Incidencias. Una alerta o rechazo nunca equivale por sí solo a ausencia laboral.')]),
('Revisar y cerrar la semana', 'Administración / RH / supervisión según permisos', [
('h', 'Consultar y resolver incidencias'),
('steps', ['Abrir Incidencias y filtrar la persona, fechas y estado que necesitas.', 'Abrir el detalle y consultar su semana: revisar marcajes, descansos, alertas y evidencia antes de decidir.', 'Asignar la incidencia a quien deba atenderla, si corresponde. Resolver con la opción apropiada y un motivo comprensible.', 'Si hay una corrección autorizada, agregar un marcaje, excluir uno del cálculo o cambiar su tipo, según el formulario. Revisar hora y zona. El registro original se conserva.', 'Volver a consultar la semana. Confirmar los minutos y que la incidencia quedó resuelta. Supervisión sólo puede actuar en sus sedes asignadas.']),
('h', 'Cerrar una semana ya terminada'),
('steps', ['Como administración o RH, abrir Cierres y elegir la semana y personas. Para la demo usar una semana terminada preparada por soporte.', 'Consultar la vista previa/detalle y atender incidencias pendientes antes de cerrar.', 'Ejecutar el cierre directo o iniciar una corrida para el conjunto de personas, según la pantalla disponible.', 'Consultar el estado de la corrida. Si hay personas bloqueadas, revisar el motivo, corregir lo que corresponda y repetir para quienes faltan.', 'Comprobar el cierre y su versión. Pedir al trabajador que revise su propia semana y emita el acuse.']),
('h', 'Si aparece un error después del cierre'),
('p', 'Administración puede reabrir con motivo. La versión anterior y sus acuses se conservan. Tras corregir, cerrar de nuevo y solicitar la revisión del nuevo cierre. Una objeción del trabajador no reabre automáticamente.'),
('box', 'Un cierre exitoso no certifica que todos los supuestos laborales estén resueltos. Revisar especialmente descanso computable, condiciones contractuales y regímenes especiales. El cierre programado sólo trabaja sobre semanas sin incidencias pendientes; habilitarlo después de acordar la operación.'),
('h', 'Resultado esperado'),
('p', 'La semana ficticia muestra un cierre identificable, sus totales y la versión correspondiente. Las personas bloqueadas están explicadas y no se confunden con cierres completos.')]),
('Acuse y entrega de resultados', 'Trabajador y personas autorizadas · Portal / Android', [
('h', 'Acusar la semana: trabajador'),
('steps', ['Entrar con su propia cuenta a Mi asistencia en el portal, o usar Mi semana en su teléfono personal enrolado.', 'Elegir la semana cerrada y revisar sus horas, alertas y versión.', 'Indicar conformidad u objeción según lo que realmente corresponda y confirmar el texto mostrado.', 'Comprobar que el acuse quedó registrado en el servidor. Para una corrección, avisar a administración; una terminal compartida no ofrece esta consulta personal.']),
('h', 'Descargar un CSV: administración, RH o auditoría'),
('steps', ['Abrir Exportes y solicitar el CSV de la semana/cierres que corresponden.', 'Consultar el estado hasta que esté listo. Descargar y guardar el archivo y su manifiesto en una carpeta privada del cliente.', 'La descarga es de un uso y su enlace temporal vence a los 15 minutos. Si se consume o falla después de comenzar, solicitar otra entrega.', 'Revisar el CSV antes de usarlo. Incluye cierres vigentes y el estado de acuse disponible; no es un conector de nómina aceptado por el cliente.']),
('h', 'Descargar un expediente empresarial'),
('steps', ['Administración abre Usuarios → Permiso de expediente de la persona. Marca la confirmación y pulsa Conceder permiso. Debe ser una cuenta activa vinculada.', 'La persona autorizada abre Expediente empresarial, solicita la preparación y consulta estado y vencimiento. Guardar el manifiesto.', 'Antes de descargar, completar la nueva verificación de identidad con OTP. Volver al portal y pulsar Continuar con la descarga verificada.', 'Guardar el ZIP, manifiesto y verificador actualizado entregado por soporte. La descarga no se reanuda: si se consume e interrumpe, solicitar otro expediente.', 'Pedir a soporte una demostración de verificación y consulta sin conexión. Guardar el resultado y leer las limitaciones declaradas; no borrar el origen por obtener un ZIP.']),
('box', 'El expediente de una empresa y el respaldo completo del servicio son distintos. El expediente declara evidencia ausente, incluidos ciertos sobres rechazados, textos históricos y datos sólo locales de Android. La aceptación integral del acuse y conservación sigue pendiente. El pago de nómina depende de la integración acordada con el cliente.')]),
('Recuperación y operación diaria', 'Accesos individuales y conservación de evidencia', [
('h', 'Si alguien pierde el acceso'),
('table', [('Situación', 'Qué hacer'), ('Olvidó la contraseña', 'Con SMTP verificado y habilitado, usar la recuperación por correo de la pantalla de acceso y seguir el enlace. Como SMTP sigue pendiente, solicitar el procedimiento a soporte; no prometer que llegará un mensaje.'), ('Perdió el autenticador', 'Conservar su contraseña y usar un código de recuperación no consumido en la opción de acceso que ofrece Keycloak. Después, restablecer el autenticador y renovar/guardar los códigos mediante el proceso de la cuenta o soporte.'), ('Perdió también los códigos', 'Contactar a soporte. La recuperación excepcional requiere verificar identidad y doble aprobación de personas distintas, documentada. No se omite MFA por una solicitud informal.'), ('Administrador pide cambio de contraseña', 'Usuarios → Exigir cambio de contraseña → confirmar. Obliga una nueva contraseña al siguiente ingreso; no recupera por sí solo una contraseña olvidada ni elimina OTP.')]),
('h', 'Baja de una persona'),
('steps', ['En Empleados → Editar, elegir Inactivo e indicar Fecha efectiva de baja, no futura. Revisar antes de confirmar.', 'La baja revoca la tarjeta y termina el horario aplicable; conserva históricos. Reactivar no restituye tarjeta ni horario automáticamente.', 'Revisar aparte los accesos de portal en Usuarios y los dispositivos en Dispositivos; deshabilitar/revocar según corresponda. No asumir que la baja del empleado elimina su identidad.']),
('h', 'Responsabilidades del cliente y soporte'),
('p', 'Cada cliente tendrá su instancia en VPS privada. Los desarrolladores la administran y dan soporte; el administrador del cliente conserva su acceso propio. El bucket S3 externo lo gestiona soporte. La custodia del material de recuperación corresponde al administrador del cliente; si no la asume, se documenta su entrega y responsable desarrollador de respaldo.'),
('p', 'La política acordada es copia externa diaria, retención de 30 días, RPO 24 h y RTO 4 h; su provisión y ensayo real siguen pendientes. Rotar respaldos no sustituye el archivo laboral ni elimina la obligación del empleador de conservar y exhibir registros.'),
('box', 'No compartir contraseñas, códigos OTP, códigos de recuperación ni claves de respaldo en capturas o correos de soporte. Suspender una empresa mantiene captura/sincronización de dispositivos existentes, pero bloquea administración y nuevas vinculaciones.')]),
('Guion de demo y ayuda rápida', '20 minutos con datos ficticios preparados', [
('table', [('Minutos', 'Recorrido y comprobación'), ('0-3', 'Entrar como administrador con cuenta propia y MFA. Mostrar empresa correcta y explicar qué prepara soporte.'), ('3-7', 'Mostrar sede y crear un empleado ficticio. En Usuarios asignar el rol y vínculo correcto. Para supervisión agregar sólo su sede.'), ('7-10', 'Crear/asignar un horario y mostrar configuración de comida. Revisar fecha futura y aviso sin cambiar producción.'), ('10-13', 'Mostrar emisión/activación de código si hay equipo preparado. Para captura usar sólo prueba autorizada o presentación, aclarando cuál es.'), ('13-17', 'Consultar semana ficticia terminada, resolver una incidencia y cerrar. En otra cuenta de trabajador, revisar y acusar.'), ('17-20', 'Solicitar CSV y mostrar expediente con permiso expreso y OTP nuevo. Confirmar archivos guardados y cerrar sesión.')]),
('h', 'Cuando algo no aparece'),
('table', [('Problema', 'Revisión inicial'), ('No puedo entrar / no llega correo', 'Verifica la dirección, cuenta exacta y hora automática del teléfono. SMTP puede estar pendiente; pide ayuda a soporte.'), ('No veo una pestaña', 'Revisa el rol. Usuarios es sólo de administración; Expediente exige permiso explícito. No pidas contraseña de otro usuario.'), ('Supervisión no ve datos', 'Comprueba sedes asignadas. Una semana con evidencia de otras sedes puede quedar fuera de su alcance.'), ('No puedo cerrar / no hay acuse', 'La semana debe terminar y cerrar correctamente. Revisa incidencias y bloqueos; el trabajador acusa sólo su cierre.'), ('Código o descarga vencidos', 'Solicita otro código/entrega. Los consumidos no se reutilizan.'), ('El teléfono no marca', 'Confirma con soporte variante de demo, activación, sesión, permisos y hardware. Producción sigue bloqueada por autenticación de tarjeta.')]),
('p', 'Para soporte, envía por el canal acordado: empresa, pantalla, acción, fecha/hora y referencia de error si aparece. Oculta datos personales y nunca envíes secretos. Al acabar, confirma que los pendientes se sincronizaron y conserva los archivos descargados.'),
('h', 'Fuentes y límites de esta guía'),
('p', 'Pantallas y contrato del proyecto, candidato local 0.18.0. Esta guía no acredita despliegue público, pruebas físicas, aceptación de SUP-025, integración de nómina ni cumplimiento integral. El resto se registra por tarea en la bitácora.'),
('link', ('Reforma de jornada: DOF, 1 de mayo de 2026', 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537')),
('link', ('Ley Federal del Trabajo vigente: Cámara de Diputados', 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf')),
('caption', 'La elección de VPS y S3 es técnica: la reforma de jornada no prescribe esos proveedores. Las obligaciones de seguridad, privacidad y conservación siguen requiriendo su operación y documentación.')])
]

TEAL=HexColor('#17677D'); INK=HexColor('#173449'); GRAY=HexColor('#526573'); PALE=HexColor('#EDF5F7')
styles = {
    'title': ParagraphStyle('title', fontName='Arial-Bold', fontSize=27, leading=32, textColor=INK, spaceAfter=12),
    'subtitle': ParagraphStyle('subtitle', fontName='Arial', fontSize=11, leading=15, textColor=TEAL, spaceAfter=16),
    'body': ParagraphStyle('body', fontName='Arial', fontSize=9.8, leading=13.5, textColor=INK, spaceAfter=7),
    'h': ParagraphStyle('h', fontName='Arial-Bold', fontSize=12, leading=16, textColor=TEAL, spaceBefore=10, spaceAfter=7),
    'caption': ParagraphStyle('caption', fontName='Arial', fontSize=8, leading=11, textColor=GRAY, spaceAfter=8),
    'cell': ParagraphStyle('cell', fontName='Arial', fontSize=9, leading=11.5, textColor=INK),
    'compact': ParagraphStyle('compact', fontName='Arial', fontSize=8.7, leading=11, textColor=INK),
    'head': ParagraphStyle('head', fontName='Arial-Bold', fontSize=9, leading=12, textColor=white),
    'step': ParagraphStyle('step', fontName='Arial', fontSize=9.8, leading=13.5, textColor=INK, leftIndent=19, firstLineIndent=-19, spaceAfter=6),
}

def p(text, style='body'):
    return Paragraph(escape(text).replace('\n', '<br/>'), styles[style])

class NumberedCanvas(canvas.Canvas):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs); self.pages=[]
    def showPage(self):
        self.pages.append(dict(self.__dict__)); self._startPage()
    def save(self):
        for page in self.pages:
            self.__dict__.update(page)
            self.setStrokeColor(TEAL); self.setLineWidth(1)
            self.line(43, 805, 552, 805)
            self.setFont('Arial-Bold',8); self.setFillColor(TEAL)
            self.drawString(43,815,'ZENIT  /  GUÍA DE DEMO PARA EL CLIENTE')
            self.setFont('Arial',8); self.setFillColor(GRAY)
            self.drawString(43,27,'fastSolution  ·  Referencia local: 5 de noviembre de 2026')
            self.drawRightString(552,27,f'{self._pageNumber} / {len(self.pages)}')
            super().showPage()
        super().save()

story=[]; source=['# Guía de demo Zenit para el cliente','', 'Referencia: candidata local 0.18.0, 5 de noviembre de 2026.','']
for number,(title,subtitle,blocks) in enumerate(PAGES,1):
    if number>1: story.append(PageBreak())
    story.extend([p(title,'title'),p(subtitle,'subtitle')])
    source += [f'## {number}. {title.replace(chr(10)," - ")}', '', subtitle, '']
    for kind,value in blocks:
        if kind in ('p','intro','caption','h'):
            story.append(p(value,'h' if kind=='h' else 'caption' if kind=='caption' else 'body'))
            source += [('### ' if kind=='h' else '')+value,'']
        elif kind=='steps':
            for i,text in enumerate(value,1):
                story.append(p(f'{i}.  {text}','step')); source += [f'{i}. {text}']
            source.append('')
        elif kind=='box':
            box=Table([[p(value)]], colWidths=[509]); box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),.6,HexColor('#C5DCE3')),('LEFTPADDING',(0,0),(-1,-1),11),('RIGHTPADDING',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
            story.extend([box,Spacer(1,9)]); source += ['> '+value,'']
        elif kind=='table':
            cell_style='compact' if number==12 else 'cell'
            rows=[[p(a,'head' if i==0 else cell_style),p(b,'head' if i==0 else cell_style)] for i,(a,b) in enumerate(value)]
            t=Table(rows,colWidths=[157,352],hAlign='LEFT')
            padding=4 if number==12 else 6
            t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),TEAL),('ROWBACKGROUNDS',(0,1),(-1,-1),[PALE,white]),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),padding),('BOTTOMPADDING',(0,0),(-1,-1),padding)]))
            story.extend([t,Spacer(1,10)])
            source.extend(['| '+a+' | '+b+' |' for a,b in value[:1]]+['| --- | --- |']+['| '+a+' | '+b+' |' for a,b in value[1:]]+[''])
        elif kind=='image':
            image_path=ROOT/'docs/imagenes'/value
            if image_path.exists():
                im=Image(str(image_path),width=215,height=239.2); im.hAlign='CENTER'; story.extend([im,Spacer(1,5)])
        elif kind=='link':
            label,url=value
            story.append(Paragraph(f'<link href="{escape(url)}" color="#17677D">{escape(label)}</link>',styles['caption']))
            source += [f'[{label}]({url})','']

doc=SimpleDocTemplate(str(OUT),pagesize=(595.28,841.89),rightMargin=43,leftMargin=43,topMargin=54,bottomMargin=45,title='Zenit - Guía de demo para el cliente',author='fastSolution',pageCompression=1)
doc.build(story,canvasmaker=NumberedCanvas)
(ROOT/'docs/guia-demo-cliente.md').write_text('\n'.join(source),encoding='utf-8')
reader=PdfReader(str(OUT))
assert len(reader.pages)==len(PAGES), f'Desbordamiento: {len(reader.pages)} páginas, se esperaban {len(PAGES)}'
with pdfplumber.open(OUT) as pdf:
    for number,page in enumerate(pdf.pages,1):
        text=page.extract_text() or ''
        assert len(text)>600, f'Página {number} casi vacía'
        assert '\ufffd' not in text and '\u25a0' not in text, f'Glifo inválido en {number}'
        assert f'{number} / {len(PAGES)}' in text, f'Falta folio {number}'
        for char in page.chars:
            assert char['x0']>=20 and char['x1']<=580, f'Texto fuera del ancho en {number}'
            assert 10<=char['top'] and char['bottom']<=833, f'Texto fuera del alto en {number}'
pdf=pdfium.PdfDocument(str(OUT))
for i,page in enumerate(pdf):
    page.render(scale=1.35).to_pil().save(TMP/f'guia-{i+1:02}.png')
print(f'PDF generado y validado: {len(reader.pages)} páginas, {OUT.stat().st_size} bytes. Renders en tmp/pdfs/.')
