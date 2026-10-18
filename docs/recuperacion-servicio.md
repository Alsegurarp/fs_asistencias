# Recuperar Zenit desde un respaldo cifrado

El modo `recover` reutiliza el descifrado, restauración y comparación de tablas
de [Respaldos cifrados](respaldos-cifrados.md), pero conserva la instancia
verificada para arrancar backend e identidad. Se ejecuta sin red, sin acceso al
origen y con contraseñas nuevas de base de datos. Sólo acepta un destino vacío.

La configuración está en `deploy/recuperacion/compose.yaml`, aplicada sobre el
Compose raíz. Usa el proyecto `zenit-recuperacion`, sus propios volúmenes y
puertos locales 28080/28081/28082. No aplicar el archivo del servidor publicado
encima de esta configuración ni reutilizar su nombre de proyecto.

## Preparar la recuperación

1. Obtener del almacén externo un paquete y comprobar su SHA-256 contra el
   registro de operación controlado. El cifrado no acredita quién lo creó:
   aceptar sólo paquetes del almacén autorizado.
2. Recuperar del repositorio el commit con el que se hizo el respaldo, incluidos
   contrato, migraciones, imágenes y configuración del despliegue. Empezar con
   esa versión antes de actualizar. Las migraciones aplicadas no se revierten.
3. El custodio entrega temporalmente la clave privada age por un canal seguro;
   no colocarla en el almacén de paquetes ni subirla al servidor de origen.
4. Elegir un directorio vacío para secretos nuevos y una máquina con Docker y
   disco cifrado. La base restaurada contiene información en claro. En Linux,
   los archivos montados de secretos y la clave deben ser legibles por UID 70;
   sus directorios deben restringir el acceso a las cuentas autorizadas.

Desde PowerShell, en la raíz del repositorio, sustituir los valores de ejemplo:

```powershell
$env:RECOVERY_SECRETOS = 'D:/RecuperacionZenit/secretos-nuevos'
$env:RECOVERY_BACKUPS = 'D:/RecuperacionZenit/paquetes'
$env:RECOVERY_KEY = 'D:/CustodiaTemporal/backup-age.key'
$env:BACKUP_FILE = 'zenit-FECHA-ID.tar.age'
$recuperacion = @('compose', '-f', 'compose.yaml', '-f', 'deploy/recuperacion/compose.yaml')

New-Item -ItemType Directory -Path $env:RECOVERY_SECRETOS | Out-Null
docker @recuperacion --profile setup run --rm --build secrets-init
docker @recuperacion build db keycloak migrate backend web backup-recover
docker @recuperacion --profile ops run --rm --no-deps backup-recover
```

Comprobar el código de salida de cada comando antes de continuar. El último
debe terminar con `RECUPERACIÓN CORRECTA`. Una restauración fallida no deja el
marcador que permite arrancar la base. Si el volumen contiene una restauración
anterior o incompleta, el procedimiento la rechaza sin modificarla; conservar
la evidencia del fallo y elegir otro nombre de proyecto con `--project-name`.
No resolver el rechazo borrando un volumen que no se haya identificado.

El clúster recuperable mantiene `fsync` activo y autenticación SCRAM en TCP;
no hereda el modo rápido desechable del ensayo. Véanse las opciones de
[initdb](https://www.postgresql.org/docs/18/app-initdb.html) y la
[durabilidad de PostgreSQL](https://www.postgresql.org/docs/18/runtime-config-wal.html).

## Arrancar y comprobar servicios

```powershell
docker @recuperacion up --detach db keycloak backend
docker @recuperacion ps
Invoke-RestMethod http://localhost:28080/actuator/health
Invoke-RestMethod http://localhost:28082/realms/zenit/.well-known/openid-configuration
```

Exigir backend `UP`, Keycloak saludable y emisor
`http://localhost:28082/realms/zenit`. El paso de migraciones debe terminar
sin error y el backend valida el esquema antes de atender.

Después comprobar:

- Roles y permisos: `zenit_app`, `zenit_migrator`, `keycloak_app` y
  `zenit_backup` mantienen permisos restaurados y usan sus secretos nuevos.
  Sólo el administrador tiene acceso como superusuario. El rol interno
  bootstrap `restaura` conserva el atributo que PostgreSQL exige y queda
  `NOLOGIN`, sin contraseña ni membresías concedidas por el procedimiento.
- Acceso con una cuenta de Keycloak que existía al respaldar. Sus contraseñas
  y factores se recuperan desde la base; generar un nuevo
  `keycloak_admin_password` **no cambia una cuenta existente**. Si se perdió
  también el acceso de administración, hace falta el procedimiento de
  recuperación de identidad correspondiente, antes de considerar el servicio
  recuperado. No eliminar OTP para facilitar el ensayo.
- Datos de empresa y operaciones representativas con cuentas autorizadas.
  Reponer desde el registro de operación la lista `operator_emails`: se genera
  vacía y no forma parte de las bases.
- Para probar el portal en este origen local, revisar los retornos permitidos
  del cliente `zenit-portal` restaurado, que conserva las URL del origen.
  Cambiarlos sólo en esta identidad de recuperación; después levantar `web`.
  El trabajador de tareas está apagado para evitar cierres/exportes automáticos
  durante el ensayo.

La clave age sólo se monta en `backup-recover`. Los servicios que atienden no
la reciben. Al terminar, retirar su copia temporal según el procedimiento del
custodio y detener el entorno con `docker @recuperacion stop`; los volúmenes
permanecen para revisión.

## Regresar al servicio publicado

El ensayo local no cambia DNS ni sustituye producción. Para recuperar tras la
pérdida de la máquina, todavía hay que preparar el servidor de reemplazo,
reponer la configuración de operador y URLs públicas, permisos, secretos nuevos,
red y borde; emitir/restaurar certificados por su procedimiento y coordinar el
cambio con el anfitrión. Ver [Despliegue](despliegue-en-servidor.md).

Antes de abrir tráfico: identidad con el emisor público correcto, certificados
válidos, backend saludable, acceso autenticado y datos comprobados; entonces
reactivar trabajos, comprobar copia externa y registrar tiempos y antigüedad
del respaldo. No mantener dos instalaciones atendiendo los mismos dispositivos.

## Estado de la tarea 1

Comprobado el 18 de octubre de 2026, con datos ficticios locales y el origen
apagado durante toda la recuperación: 130 tablas y 1.867 filas con contenido
idéntico (producto: 29/120; identidad: 101/1.747). La instancia recuperada arrancó
con contraseñas nuevas de base de datos; pasaron siete migraciones, backend
`UP`, descubrimiento con el emisor local de recuperación, autenticación de la
cuenta local de administración restaurada y consulta administrativa del realm
`zenit`. No se probaron navegador ni OTP en este recorrido.

La ejecución completa, incluida construcción con caché, duró 66 segundos; la
restauración y comparación tomaron 6. No es una medida del tiempo de recuperar
el servidor publicado. Registro local ignorado por Git:
`build/recuperacion-servicio-2026-10-18.log`. El proyecto de prueba quedó detenido,
con volumen recuperado separado para revisión; se eliminó su clave age de
ensayo. No se generó una clave de operación ni se tocó el servidor publicado.

La recuperación persistente tiene una autoprueba con datos ficticios que
comprueba contraseña nueva, rechazo de la anterior, datos, rol bootstrap sin
acceso y rechazo de destino ocupado. Conserva las pruebas de alteración y clave
incorrecta del ensayo previo.

Confirmado el 18 de octubre de 2026:

- Acceso SSH al origen exclusivamente por el usuario Gabriel del proyecto;
  coordinar con él las intervenciones, sin habilitar accesos adicionales.
- Destino: otro servidor, probablemente conectado mediante otra VPN; falta
  identificar la máquina y el mecanismo de transferencia.
- Política aprobada: copia diaria y retención de 30 días; objetivos de pérdida
  máxima de 24 horas y recuperación en 4 horas.
- El equipo de fastSolution atiende los fallos.

Pendientes para cerrar: servidor destino y conectividad, custodio y segunda
copia de la clave, programación, transferencia comprobada, registro/aviso de
fallos y recuperación del ambiente publicado. Los objetivos aprobados todavía
deben medirse; el ensayo local no demuestra su cumplimiento en producción.

Por indicación de Alexis, consultar esas definiciones técnicas con el
desarrollador Gabriel, responsable del acceso SSH. Su papel de interlocutor
no lo designa automáticamente custodio; la persona y los lugares de custodia
deben quedar expresamente definidos antes de generar la clave de operación.
