# Respaldos cifrados y restauración aislada

Los servicios `backup` y `backup-restore` usan el mismo procedimiento que el
ensayo existente. El primero guarda las bases del producto y Keycloak en un
paquete cifrado con [age](https://github.com/FiloSottile/age); sólo recibe la
clave pública. El segundo recibe la privada y restaura en una instancia
nueva de PostgreSQL, sin red, sin contraseña del origen y sin consultarlo.

Para conservar la instancia verificada y arrancar backend e identidad con
contraseñas nuevas, usar [Recuperación del servicio](recuperacion-servicio.md).

## Preparar las claves una vez

La clave privada age sirve para **descifrar los archivos de respaldo**. La
clave pública correspondiente permite cifrarlos sin poder abrirlos, como muestra
la [documentación de age](https://github.com/FiloSottile/age#usage).
No es una licencia, una credencial de cliente, una clave SSH ni una clave del
desarrollador. El servidor que respalda sólo necesita la pública.

En el formato actual, cada paquete contiene las bases completas de Zenit y
Keycloak: la privada permite recuperar los datos de todas las empresas incluidas
en esos paquetes. Su custodia corresponde al responsable operativo designado,
sin dar acceso automáticamente a todo desarrollador o cliente. El cliente no
necesita introducirla para usar el producto.

Una pareja de claves puede proteger sucesivos respaldos de una instalación;
no se genera una por archivo ni se usa para asignar licencias. Se recomienda
separar las claves de desarrollo y de producción. Si se pierde la privada y
todas sus copias, los paquetes cifrados para ella dejan de ser recuperables;
crear otra pareja no abre los anteriores. Quien tenga la privada y esos
paquetes podrá descifrarlos. Conservarla separada del almacén de respaldos.
La persona y el lugar de custodia todavía no están elegidos. Alexis indica
consultar su definición y la continuación técnica con Gabriel, quien realiza
las conexiones SSH; no se le asigna la custodia automáticamente.

Con Docker Desktop funcionando, desde la raíz del repositorio:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose --profile ops build backup backup-restore
docker compose --profile ops run --rm --no-deps --volume ./secrets:/keys --entrypoint age-keygen backup --output /keys/backup-age.key
docker compose --profile ops run --rm --no-deps --volume ./secrets:/keys:ro --entrypoint age-keygen backup -y /keys/backup-age.key
```

El último comando imprime la clave **pública**, que empieza con `age1`.
Ponerla como `BACKUP_RECIPIENT` en `.env`. No sobrescribir la privada si ya
existe: sin ella no se recuperan sus paquetes anteriores. Respaldarla por
separado en un almacén de secretos con acceso restringido; conservarla
mientras existan respaldos cifrados con ella.

`secrets/` y `backups/` están excluidos de Git y del contexto de construcción
del backend. La privada local sólo se monta en el servicio de restauración,
nunca en el servicio que respalda. Los comandos de generación montan
`secrets/` exclusivamente para crear y consultar esa clave.

En Linux, el usuario PostgreSQL del contenedor (UID/GID 70) debe poder
escribir en `backups/` y en `secrets/` durante la generación. Configurar esos
permisos antes de ejecutar; no abrir las carpetas a todos los usuarios.

## Guardar y comprobar una copia

El origen debe estar levantado para guardar:

```powershell
docker compose --profile ops run --rm backup
```

Conserva únicamente `backups/zenit-FECHA-ID.tar.age`. Una ejecución fallida
elimina el archivo provisional; no publica un paquete parcial. Anotar el
nombre y su SHA-256, que imprime al terminar, en el registro de operación.

Para comprobarlo, indicar el nombre de ese archivo, sin ruta:

```powershell
$env:BACKUP_FILE = 'zenit-FECHA-ID.tar.age'
docker compose --profile ops run --rm backup-restore
Remove-Item Env:BACKUP_FILE
```

No necesita que el origen esté encendido. Descifra y verifica el paquete
antes de restaurar, crea un clúster y sus bases desde cero y comprueba cada
tabla: conteo y SHA-256 del conjunto ordenado de huellas de sus filas. El
respaldo y esas huellas se toman en la misma instantánea por base, de modo
que una escritura posterior no modifica lo que se compara.

La instancia usa un volumen anónimo en disco, eliminado con `--rm`. No
escribe en el volumen original ni sustituye un entorno existente. Un éxito
termina con `ENSAYO CORRECTO`; cualquier error devuelve un código distinto
de cero. No considerar una copia comprobada hasta obtener ese resultado.

## Autoprueba sin datos reales

```powershell
docker build --target backup-tools --tag zenit-backup-tools infra/postgres
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp --tmpfs /work:uid=70,gid=70,mode=0700 --tmpfs /backups:uid=70,gid=70,mode=0700 --tmpfs /run/secrets:uid=70,gid=70,mode=0700 --entrypoint bash zenit-backup-tools /opt/zenit/self-test.sh
```

Crea dos bases ficticias con Unicode, valores nulos, JSON, binarios,
identidades y propietarios separados. Apaga el origen antes de restaurar.
Exige éxito y luego rechazo de filas eliminadas, una huella de contenido
distinta con el mismo conteo, ciphertext alterado y otra clave privada.
Las claves y todos los archivos de esa prueba desaparecen con el contenedor.

## Límites y recuperación operativa

- El modo `restore` comprueba bases y contenido; no levanta el backend
  ni Keycloak. Conserva propietarios y membresías, pero crea los roles sin
  login y no copia contraseñas ni privilegios globales de administración.
  Para recuperar un ambiente de servicio, asignar contraseñas nuevas desde
  sus secretos, habilitar únicamente los roles de servicio correspondientes,
  revisar privilegios y comprobar migraciones, salud del API e inicio de sesión.
  El modo `recover` y su configuración separada preparan ese recorrido, según
  [Recuperación del servicio](recuperacion-servicio.md); no apuntar producción
  al ensayo. La copia externa operativa sigue pendiente.
- Los datos en claro viven sólo en `/work` durante el proceso. Al respaldar
  está en memoria; al restaurar, en el volumen temporal de Docker. La
  eliminación del volumen no equivale a borrado físico seguro: usar cifrado
  de disco en el host que restaura.
- Las huellas agregan 64 bytes por fila en memoria de PostgreSQL. Antes de
  usar tablas de millones de filas, pasar a verificación por lotes. El
  respaldo inicial también debe caber en la memoria asignada a `backup`.
- Cada base usa su propia instantánea; no se garantiza un instante común
  entre producto e identidad. Tampoco se comprueban aquí objetos grandes
  externos a tablas ni la continuidad de secuencias con escrituras simultáneas.
- El cifrado age detecta alteraciones y protege la confidencialidad, pero no
  autentica quién creó el respaldo. Restaurar únicamente paquetes procedentes
  del almacén controlado: un dump contiene SQL que se ejecuta con privilegios.
- No hay borrado automático, retención ni copia remota. No colocar la privada
  junto al paquete en el mismo almacén. Ya están aprobados respaldo diario,
  retención de 30 días y objetivos de pérdida/recuperación de 24 h/4 h.
  Faltan concretar destino externo, custodia y responsables, automatizar y
  ensayar esos objetivos. La retención debe preservar registros legales y
  bloqueos por litigio.

## Verificación de esta entrega

### Verificación del 14 de octubre de 2026

El 14 de octubre de 2026 se construyó la imagen y la autoprueba terminó con
`AUTOPRUEBA CORRECTA`: restauró sin el origen disponible y rechazó filas
eliminadas, contenido distinto con el mismo conteo, ciphertext alterado y una
clave privada incorrecta. Los paquetes ficticios de las dos bases ocuparon
2,333 y 2,345 bytes.

La primera revisión de la imagen encontró 2 vulnerabilidades críticas y 10
altas en el binario de age provisto por Alpine. Se recompilaron únicamente
`age` y `age-keygen` 1.3.2 con Go 1.27.2 y `x/crypto` 0.56.0, sin agregar Go a
la aplicación ni instalar el toolchain en la imagen final. Los ejecutables sí
son binarios Go y llevan su biblioteca estándar enlazada, que por eso aparece
en el inventario. El análisis posterior terminó sin error: 0 críticas, 0 altas,
4 medias y 1 de gravedad desconocida. Esta última corresponde al paquete
`openpgp` de `x/crypto`, que no forma parte del grafo de importación de los dos
ejecutables. No se aceptó ni exceptuó ningún hallazgo.

Ese mismo día, con el entorno local levantado desde un volumen nuevo, el
ensayo existente respaldó la base del producto en 108,830 bytes y la de
identidad en 204,322; restauró 29 y 96 tablas y comparó 12 y 203 filas, en
total 125 tablas y 215 filas con contenido idéntico, en 2 segundos.

Al terminar el corte del 14 seguía pendiente guardar un paquete age con las
bases locales y restaurarlo. Ese recorrido se comprobó el 18 con claves de
ensayo eliminadas al terminar; las claves de operación y su custodia siguen
pendientes. Véase la actualización del 18 más abajo.

### Repetición del 17 de octubre de 2026

El 17 de octubre de 2026 se construyó el target `backup-tools` y pasó la
autoprueba sin red ni datos reales: restauración sin origen, filas eliminadas,
contenido distinto con el mismo conteo, paquete alterado y clave incorrecta.
Las claves y copias ficticias desaparecieron con el contenedor.

El ensayo existente también pasó con las bases locales y la comparación de
contenido: 130 tablas y 1.772 filas idénticas. No guardó un respaldo persistente
ni comprobó escrituras simultáneas en esta ejecución.

Al terminar el corte del 17 seguían pendientes una copia cifrada comprobada
y la recuperación completa; se ensayaron el 18. Siguen pendientes claves y
copia de operación. La autoprueba por sí sola no sustituye esos recorridos. Resultados en la
[validación de tareas 1 a 6](validacion-tareas-1-a-6.md).

### Recuperación del servicio del 18 de octubre de 2026

El modo `recover` pasó su autoprueba y un recorrido con las bases ficticias
locales: 130 tablas y 1.867 filas con contenido idéntico, contraseñas nuevas de
base de datos, siete migraciones correctas, backend saludable y autenticación
de la cuenta de Keycloak restaurada. El origen estuvo apagado durante la
recuperación. Detalles y límites en [Recuperación del servicio](recuperacion-servicio.md).

Esto comprueba recuperación local de bases y servicios; no cierra destino
externo, custodia, programación, retención ni recuperación del ambiente público.
Las claves usadas fueron de ensayo y se eliminaron, sin generar una de operación.

### Restauración posterior a V008 del 20 de octubre de 2026

El ensayo de bases restauró 131 tablas y 1,970 filas con contenido idéntico
en 6 segundos. No guardó copia operativa ni repitió la recuperación completa
con origen apagado y secretos nuevos. [Evidencia](verificacion-local-2026-10-20.md).
