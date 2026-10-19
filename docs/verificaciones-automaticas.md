# Verificaciones automáticas

Preparadas el 19 de octubre de 2026 en
[`.github/workflows/verificaciones.yml`](../.github/workflows/verificaciones.yml).
El repositorio está alojado en GitHub; se reutilizan las recetas Docker del
proyecto. El workflow se publicó en `avanceLunes`. Su primera ejecución falló
antes de las pruebas por una referencia de submódulo sin `.gitmodules`; se
retiró del índice esa referencia a la landing, que se despliega desde su propio
clon mediante `LANDING_REPO`. La segunda ejecución aprobó portal, Android y
contrato/seguridad; backend falló por la propiedad del directorio de secretos.
El runner ahora crea los directorios antes del generador para conservar su
propiedad y el modo 700. Falta acreditar una ejecución completa aprobada.

## Qué ejecuta

Se dispara al subir cambios, abrir o actualizar una petición de cambios y a
petición manual. Tiene cuatro trabajos independientes:

| Trabajo | Comprobaciones |
| --- | --- |
| Backend | Construcción y unitarias; integración con PostgreSQL desechable; importación del realm, protección OTP y readiness con HTTP 200/503 |
| Portal | Construcción y pruebas con dos procesos, sin red durante las pruebas |
| Android | Unitarias, lint y construcción de APK de app e instrumentación |
| Contrato y seguridad | Contrato y ejemplos, secretos en todo el historial, construcción de las cinco imágenes, SBOM y análisis de vulnerabilidades |

Los trabajos usan `contents: read` y checkout fijado a un SHA de
[la versión 7.0.1 oficial](https://github.com/actions/checkout/releases/tag/v7.0.1),
sin conservar credenciales en Git. El runner
[Ubuntu 24.04](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
incluye PowerShell para el guion de imágenes. No se usan credenciales del
servidor, cuentas humanas ni el token de desarrollo. Los secretos de las bases
de prueba se generan en el runner y sus contenedores se limpian al terminar.

Una comprobación que falla deja el trabajo en rojo. El análisis de imágenes
imprime el motivo y guarda los informes bajo `build/security/`. Mantiene las
excepciones ya aprobadas en `.grype.yaml`; no acepta automáticamente hallazgos
nuevos. Las pruebas Android de CI no ejecutan un teléfono ni una tarjeta NFC.

Para cerrar la habilitación falta comprobar los cuatro
trabajos en GitHub y, si se quiere exigirlos antes de integrar cambios,
configurar su obligatoriedad en la rama. No se ha cambiado esa protección.

## Repetir el análisis local

Construir las imágenes y ejecutar desde PowerShell 7 en la raíz:

```powershell
docker compose build backend web db keycloak backup
.\infra\check-images.ps1
```

El guion registra el ID exacto de cada imagen y la fecha del análisis en
`build/security/summary.json`, junto con los recuentos por gravedad y las
excepciones. Elimina sus exportaciones `.tar` al terminar. La base de Grype
se conserva en el volumen Docker `grype-db`, evitando leer SQLite desde un
directorio Windows montado en el contenedor.

Después de corregir sólo algunas imágenes:

```powershell
.\infra\check-images.ps1 -Targets backend,web
```

Se actualizan sus entradas del resumen conservando los IDs y fechas originales
de los demás análisis. Un resultado corresponde a ese ID, no a cualquier imagen
que posteriormente reciba la misma etiqueta.

## Comprobar las imágenes del servidor

La revisión del equipo local no acredita los contenedores publicados. Gabriel,
como responsable de SSH, debe recoger en el servidor, con el mismo Compose del
despliegue, los IDs de sus contenedores e imágenes y el commit desplegado. El
inventario no necesita mostrar variables de entorno ni archivos de secretos:

```bash
docker ps --filter label=com.docker.compose.project=fastsolution-zenit --format '{{.ID}} {{.Names}} {{.Image}}'
docker ps -q --filter label=com.docker.compose.project=fastsolution-zenit | xargs -r docker inspect --format '{{.Name}} {{.Image}}'
cat /opt/.fastsolution/zenit/fuente/.version-desplegada
```

Después hay que analizar esas imágenes, desplegar las correcciones que procedan
y comprobar nuevamente el servicio. Esta sesión no ejecutó SSH ni desplegó
cambios; la tarea 12 sigue abierta en ese alcance.
