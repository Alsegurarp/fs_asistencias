# Verificaciones automáticas

Ampliación del 23 de octubre de 2026: el trabajo de contrato/seguridad añade
el autoensayo de respaldo cifrado, escrituras concurrentes por base,
restauración sin origen y rechazos de alteraciones. Se ejecuta sin red ni
volúmenes del proyecto, con datos y claves desechables. `/work` permite
ejecutar el auxiliar de escritura; la raíz sigue siendo de sólo lectura y se
retiran todas las capacidades. El comando aprobó localmente; la ejecución de
Actions debe corresponder al commit publicado. [Evidencia y límites](bitacora-trabajo.md#23-de-octubre-de-2026--respaldo-concurrente-validado-y-preparación-de-ci).

Corrección del 21 de octubre, posterior a `b2f7832`: el análisis de esa
[ejecución](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39626828092)
falló únicamente por la imagen del portal. Se actualizó Nginx a 1.30.6 con
digest fijo y se retiraron curl/libcurl, que el portal no utiliza. El nuevo
análisis local aprobó con 0 críticas, 0 altas y 3 medias, sin excepciones
nuevas; construcción, arranque y proxy también aprobaron. El workflow y su
umbral no cambiaron. [Evidencia y alcance](bitacora-trabajo.md#21-de-octubre-de-2026--corrección-del-análisis-de-seguridad-del-portal).
La corrección publicada en `main`/`f72941e` aprobó los cuatro trabajos,
incluidas las cinco imágenes, en la
[ejecución 39636653675](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39636653675).
El fallo de seguridad de CI queda resuelto; no acredita despliegue público.

El 21 de octubre se añadió la prueba de CSS/JS reales del login para detectar
permisos incorrectos en los tmpfs de Keycloak. Pasaron siete comprobaciones
aisladas de salud/realm sin omisiones; ese subconjunto no incluye la prueba
de cambio de contraseña. El recorrido A4 completo y los 33 casos A5 locales
están en [el acta del 21](qa-a1-a5-2026-10-21.md). Android instrumental también
rechazó un acuse de cierre ajeno en teléfono. Estas verificaciones son
locales: la ejecución de Actions del commit de cierre debe consultarse para
su SHA en [Verificaciones sobre main](https://github.com/Alsegurarp/fs_asistencias/actions/workflows/verificaciones.yml?query=branch%3Amain).
Las ejecuciones enlazadas abajo son antecedentes; el push no despliega el servidor.

A1–A5 integradas en `main`/`e4d7683` mediante la
[PR #10](https://github.com/Alsegurarp/fs_asistencias/pull/10). Los cuatro
trabajos aprobaron en su [ejecución 39504126988](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39504126988).
El árbol integrado coincide con el de la rama comprobada `5c0b5c5`.
El workflow incluye `infra/keycloak/password-change.test.mjs` contra
Keycloak aislado. El corte local acredita 75 integraciones de backend,
162 pruebas del portal y 7 de identidad; [evidencia y límites](entregas-a1-a5.md).

Antecedente previo a A1–A5: **20 de octubre de 2026**, sobre `main`/`565dbdd`.
Backend (74 de integración), portal (151), Android (13 unitarias y lint),
identidad aislada (6), contrato, secretos y las cinco imágenes aprobaron.
También se verificaron el arranque con V008, HTTP y restauración local.
[Evidencia y límites](verificacion-local-2026-10-20.md). Después se ejecutó
GitHub Actions manualmente para ese mismo commit, antes del push de los
documentos: los cuatro trabajos aprobaron en la
[ejecución 39472077601](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39472077601).
El push de documentación dispara una ejecución adicional para el nuevo commit.

Preparadas el 19 de octubre de 2026 en
[`.github/workflows/verificaciones.yml`](../.github/workflows/verificaciones.yml).
El repositorio está alojado en GitHub; se reutilizan las recetas Docker del
proyecto. El workflow se publicó en `avanceLunes` y los cuatro trabajos
aprobaron en la [ejecución 39300778600](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39300778600),
commit `d5d2a00`. Se corrigieron dos fallos de arranque: una referencia de
submódulo sin `.gitmodules` y la propiedad del directorio de secretos.
Se retiró del índice la referencia a la landing, que se despliega desde su
propio clon mediante `LANDING_REPO`. El runner crea los directorios antes del
generador para conservar su propiedad y el modo 700. Integrado en `main` el
19 de octubre mediante fast-forward desde `avanceLunes`, cuyo último commit
también aprobó los cuatro trabajos en la
[ejecución 39301664714](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39301664714).

## Qué ejecuta

Se dispara al subir cambios, abrir o actualizar una petición de cambios y a
petición manual. Tiene cuatro trabajos independientes:

| Trabajo | Comprobaciones |
| --- | --- |
| Backend | Construcción y unitarias; integración con PostgreSQL desechable; importación del realm, protección OTP y readiness con HTTP 200/503 |
| Portal | Construcción y pruebas con dos procesos, sin red durante las pruebas |
| Android | Unitarias, lint y construcción de APK de app e instrumentación |
| Contrato y seguridad | Contrato y ejemplos, secretos en todo el historial, construcción de las cinco imágenes, autoensayo de respaldo concurrente y restauración sin red, SBOM y análisis de vulnerabilidades |

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

El workflow queda habilitado en `main`. Si se quiere exigir los trabajos antes
de integrar cambios, falta configurar su obligatoriedad. No se ha cambiado esa
protección. Los resultados por commit se consultan en
[GitHub Actions](https://github.com/Alsegurarp/fs_asistencias/actions/workflows/verificaciones.yml).

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
