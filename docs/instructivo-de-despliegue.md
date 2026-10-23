# Instructivo de despliegue

Cómo publicar una versión de Zenit o de la landing en el servidor compartido
con una sola orden. El guion `deploy/servidor/desplegar.sh` exporta un commit,
lo sube, construye, actualiza, espera a que responda y lo comprueba por la
dirección pública. Mientras corre muestra el porcentaje, el paso actual, el
tiempo transcurrido y el tiempo que falta, y deja todo en un registro.

Cómo está montado el servidor y qué falta está en
[Despliegue en el servidor](despliegue-en-servidor.md).

## Requisitos

| Qué | Para qué |
| --- | --- |
| Docker en marcha (Docker Desktop en Windows) | SSH, rsync y curl corren en un contenedor efímero; la estación no los necesita instalados |
| Bash: Git Bash en Windows, o la terminal en Linux o macOS | El guion es de bash |
| Acceso SSH al servidor | Una carpeta privada con `config`, `known_hosts` e `identity`. La entrega quien administra el acceso; nunca va en Git |
| Clon del repositorio de la landing | Sólo para desplegar la landing |
| El commit ya hecho, y de preferencia subido | Se despliega un commit, nunca cambios sin commit |

El `config` del acceso SSH define un alias con `HostName`, `User` y `Port`. La
llave y `known_hosts` se toman de la misma carpeta, aunque el `config` diga
otra ruta.

## Configuración, una sola vez

1. Copia `deploy/servidor/despliegue.env.ejemplo` como
   `deploy/servidor/.env.despliegue`. Git ya lo ignora.
2. Llena sus tres valores:

   ```bash
   FS_SSH_PERFIL=D:/ruta/a/la/carpeta/del/acceso
   FS_SSH_ALIAS=alias-del-servidor
   LANDING_REPO=D:/ruta/al/clon/de/la/landing
   ```

   En Windows usa rutas con `/` (`D:/carpeta`); también sirven las de Git
   Bash (`/d/carpeta`).

La primera corrida construye la herramienta (unos segundos); después queda en
caché.

La herramienta construye curl 8.23.0 sin libssh2 desde fuentes oficiales
verificadas por SHA-256, mientras Alpine estable no ofrezca el APK corregido.
El primer build tarda más; el compilador no queda en el runtime. Su
[verificación local del 22](qa-local-2026-10-22.md) no acredita un despliegue.
Para comprobar la imagen antes de usarla:

```powershell
docker build --tag fastsolution-despliegue:1 deploy/servidor/herramienta
node --test infra/deploy-tool.test.mjs
.\infra\check-images.ps1 -Targets deploy-tool
```

## Uso

Desde la raíz del monorepo, en Git Bash:

```bash
# Zenit, en el commit actual (HEAD) del monorepo
bash deploy/servidor/desplegar.sh zenit

# La landing, en el commit actual de su repositorio
bash deploy/servidor/desplegar.sh landing

# Un commit en particular (también sirve para volver a uno anterior)
bash deploy/servidor/desplegar.sh zenit 5f36b5c

# Ver todo lo que pasa, línea por línea, en vez de la barra
bash deploy/servidor/desplegar.sh zenit --detalle

# Subir además la credencial de correo de la landing
bash deploy/servidor/desplegar.sh landing --credencial D:/ruta/privada/smtp.env
```

## Qué vas a ver

```text
Despliegue de zenit en 5f36b5c (fix(borde): oculta X-Powered-By de la landing...)
Tiempo estimado: ~5:10. Registro: .../build/despliegue/registros/zenit-20261018-021551-5f36b5c.log
bien   1/8 Revisando la estación y la conexión      0:03
bien   2/8 Exportando el commit                       0:02
bien   3/8 Subiendo el árbol al servidor             0:08
[#########.....................]  32%  4/8 Construyendo las imágenes  1:20 transcurrido, ~3:28 restante
  #52 2.205 Daemon will be stopped at the end of the build
```

Ésa es una salida real de la primera prueba, cuando todavía no había
historial y la estimación usaba los tiempos por omisión.

- La barra y el porcentaje avanzan con el tiempo de cada paso.
- **Transcurrido** cuenta desde el inicio; **restante** es una estimación.
- La línea de abajo es la última del registro, para ver qué está haciendo.
- Cada paso terminado deja una línea `bien` con lo que tardó.
- Si un paso tarda más de lo usual, la barra lo dice y se queda en el 95 % de
  ese paso hasta que termine.

La estimación sale del promedio de los tres últimos despliegues de cada paso,
guardados en `build/despliegue/historial.tsv`. La primera vez usa tiempos por
omisión, por eso puede equivocarse; mejora sola. La construcción de Zenit es
el paso largo: unos 2 minutos si cambió el backend, segundos si no.

Si la salida no es una terminal (por ejemplo, redirigida a un archivo), o con
`--detalle`, no hay barra: cada paso muestra su porcentaje al empezar y
después todo su registro. Para forzar la barra en ese caso:
`DESPLIEGUE_BARRA=1 bash deploy/servidor/desplegar.sh ...`.

## Qué hace cada paso

| Paso | Zenit | Landing |
| --- | --- | --- |
| Revisar | Docker en marcha, acceso SSH completo, herramienta construida y conexión al servidor | Lo mismo |
| Exportar | `git archive` del commit, con los fines de línea de Git | El commit de la landing y, del monorepo (HEAD), su composición y el guion del servidor |
| Subir | Árbol a `/opt/.fastsolution/zenit/fuente`, borrando lo que ya no existe | Árbol a `/opt/.fastsolution/landing/fuente` y su configuración |
| Credencial | No aplica | Sólo con `--credencial`: copia `smtp.env` con permisos 0600, sin mostrarlo |
| Construir | `docker compose build` de las cinco imágenes | La imagen `fastsolution-landing:<commit>` |
| Actualizar | `docker compose up -d`: sólo recrea lo que cambió | Recrea el contenedor |
| Esperar | Hasta 240 s a que el estado del backend responda 200 a través del borde | Hasta 120 s a que el contenedor esté sano |
| Borde | Si cambió `deploy/servidor/borde`, prueba los bloques con `nginx -t` y recarga; si no, nada | No aplica |
| Comprobar | Portal, estado del backend, emisor de la identidad, `401` sin token y `404` en la administración | Raíz `200` sin `X-Powered-By`, `www` `301` y contacto inválido `400` |

Al terminar, el servidor anota fecha, commit, resultado y duración en
`/opt/.fastsolution/<objetivo>/despliegues.log`.

## Registros

| Dónde | Qué |
| --- | --- |
| `build/despliegue/registros/<objetivo>-<fecha>-<commit>.log` | Todo lo que hizo cada paso, también lo que pasó en el servidor |
| `build/despliegue/historial.tsv` | Duración de cada paso que terminó bien; de aquí sale la estimación |
| `/opt/.fastsolution/<objetivo>/despliegues.log`, en el servidor | Una línea por despliegue, con su resultado |

`build/` no se sube a Git. El registro nunca contiene la credencial de correo.

## Si algo falla

El guion se detiene en el primer paso que falla, muestra sus últimas 25
líneas y la ruta del registro completo, y anota el fallo en el servidor. Lo
desplegado hasta ese paso se queda como quedó: corrige y vuelve a correrlo.

| Mensaje | Qué hacer |
| --- | --- |
| `Docker no responde` | Abre Docker Desktop y espera a que arranque |
| `falta config` (o `known_hosts`, `identity`) | Revisa `FS_SSH_PERFIL` en `.env.despliegue` |
| `Host key verification failed` o `Permission denied` | El acceso SSH no corresponde al servidor; pide el acceso correcto |
| `no existe el commit` | Revisa el commit, o haz `git fetch` |
| Falla «Construir» | El registro muestra el error de compilación; corrígelo en el código |
| `Zenit no respondió en 240 s` | El registro trae el estado de cada servicio; revisa el del backend |
| `MAL <url>: <motivo>` en «Comprobar» | El motivo dice qué no cuadró: el código, el texto esperado o una cabecera que no debe salir |

`Ctrl+C` detiene el guion en la estación. Si lo interrumpes durante un paso
del servidor, ese paso puede terminar allá; vuelve a correr el despliegue.

## Volver a una versión anterior

Despliega el commit anterior:
`bash deploy/servidor/desplegar.sh zenit <commit-anterior>`. Las imágenes que
no cambiaron salen de la caché del servidor. Las migraciones de la base no se
revierten: si la versión nueva agregó una, volver atrás necesita su propio
plan.

## Lo que el guion no hace

- No hace commits ni push, ni despliega cambios sin commit.
- No crea ni cambia los secretos de Zenit, ni el realm de la identidad.
- No toca el borde del anfitrión ni sus nombres: un nombre nuevo se pide aparte.
- No previene dos despliegues a la vez del mismo objetivo: que sólo una
  persona despliegue a la vez.
