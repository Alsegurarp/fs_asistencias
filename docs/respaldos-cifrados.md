# Respaldos cifrados y restauración aislada

Los servicios `backup` y `backup-restore` usan el mismo procedimiento que el
ensayo existente. El primero guarda las bases del producto y Keycloak en un
paquete cifrado con [age](https://github.com/FiloSottile/age); sólo recibe la
clave pública. El segundo recibe la privada y restaura en una instancia
nueva de PostgreSQL, sin red, sin contraseña del origen y sin consultarlo.

## Preparar las claves una vez

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

- La restauración aislada comprueba bases y contenido; no levanta el backend
  ni Keycloak. Conserva propietarios y membresías, pero crea los roles sin
  login y no copia contraseñas ni privilegios globales de administración.
  Para recuperar un ambiente de servicio, asignar contraseñas nuevas desde
  sus secretos, habilitar únicamente los roles de servicio correspondientes,
  revisar privilegios y comprobar migraciones, salud del API e inicio de sesión.
  Ese recorrido completo sigue pendiente; no apuntar producción al ensayo.
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
  junto al paquete en el mismo almacén. Definir destino externo, periodicidad,
  responsable, tiempo máximo de recuperación y pérdida tolerable antes de
  publicar. La retención debe preservar registros legales y bloqueos por litigio.

## Verificación de esta entrega

La configuración de Compose y `git diff --check` se comprobaron sin errores.
La construcción, la autoprueba y el recorrido con las bases locales están
pendientes: Docker Desktop estaba detenido y el entorno restringido no pudo
iniciarlo. Los comandos anteriores están preparados, pero todavía no probados.
