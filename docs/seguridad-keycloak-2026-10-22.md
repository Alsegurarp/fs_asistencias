# Corrección de la imagen de identidad — 22 de octubre de 2026

**Corrección posterior del 28 de octubre, PR #22:** los controles de imágenes
de push/PR detectaron Guava 33.6.0-jre con `GHSA-xxph-c9ww-hj94`
(`CVE-2026-102554`). El Dockerfile reemplaza ese JAR por **33.7.2-jre**
desde Maven Central con SHA-256 fijado, conservando el nombre requerido por
Quarkus antes de optimizar Keycloak. El SBOM confirma la versión nueva y
el análisis local aprueba sin críticas/altas ni excepciones. La prueba de
runtime comprueba huella y copia única. La
[bitácora](bitacora-trabajo.md#28-de-octubre-de-2026--corrección-de-los-dos-fallos-de-actions-en-pr-22)
registra evidencia y validaciones; el corte del 22 que sigue es histórico.

La [ejecución 39863661586](https://github.com/Alsegurarp/fs_asistencias/actions/runs/39863661586)
de la PR #14 falló en el inventario de cinco imágenes: Keycloak incluía
`CVE-2026-114406` crítica en `ca-certificates` y `CVE-2026-91415` alta en
`java-21-openjdk-headless`. Las otras cuatro imágenes aprobaron.

## Corrección

`infra/keycloak/Dockerfile` toma Keycloak 26.8.1 de su imagen oficial,
fijada por digest. Cambiar únicamente esa versión no resolvió los dos
hallazgos: su Java 21 y certificados UBI seguían afectados.

El runtime se construye con los paquetes mínimos de UBI 9.8 y Oracle JDK
25.0.5.0.2, publicado el 21 de octubre. Las descargas AMD64/ARM64 se fijan
por versión y SHA-256; el inventario conserva los paquetes RPM y el JDK.
Java incluye su almacén de confianza y la lista actualizada de certificados
bloqueados. No se copia el Java ni el paquete de certificados del runtime
anterior. No se ocultan paquetes ni se rebaja el umbral del análisis.

[Keycloak admite Java 25](https://www.keycloak.org/docs/26.8.0/release_notes/#java-25-support).
La [actualización de Oracle bloquea los certificados eMudhra comprometidos](https://ops.java/emudhra).
Oracle JDK 25 se distribuye bajo [NFTC, con uso gratuito en producción y
redistribución; sus actualizaciones conservan esos términos hasta septiembre
de 2028](https://www.oracle.com/java/technologies/downloads/).
Se preservan los archivos de licencia incluidos en el JDK.

La optimización PostgreSQL/salud se ejecuta con el mismo Java del runtime.
Se conservan UID 1000, grupo 0, realm sin usuarios/secretos, sistema de
archivos de sólo lectura, directorios temporales en memoria y capacidades
retiradas. `sed` y `findutils` suministran las utilidades que usa `kc.sh`.

`pcre2` y `pcre2-syntax` pasan a `10.40-7.el9_8`; se retiran las seis
excepciones anteriores para `10.40-6.el9`. `.grype.yaml` queda sin aceptaciones.

## Validación local

Construcción AMD64 y `./infra/check-images.ps1` completos: **5/5 aprobadas**,
con **cero críticas, altas y hallazgos aceptados en todas las imágenes**.
No se reconstruyeron las otras cuatro imágenes en este corte; se analizaron
sus imágenes locales existentes con la base de vulnerabilidades vigente.

| Imagen | Medias | Bajas | Desconocidas |
| --- | ---: | ---: | ---: |
| backend | 15 | 0 | 2 |
| web | 3 | 0 | 0 |
| db | 4 | 0 | 2 |
| keycloak | 22 | 11 | 0 |
| backup | 4 | 0 | 6 |

Imagen Keycloak analizada:
`sha256:219d443f5117b3380df5dc5174f6d6c9d6d1ea1e850309be5b210f72c757a25b`.
El SBOM reconoce `pkg:generic/oracle/jdk@25.0.5.0.2%2B1-LTS-2` y los RPM
actualizados; no contiene `java-21-openjdk-headless` ni `ca-certificates`.

Ensayo aislado con PostgreSQL desechable y secretos propios: **9/9 pruebas**
de identidad y seguridad. Comprueba HTTP 200/503, realm/OTP, recursos CSS/JS
con gzip, conservación de OTP/acciones y denegación de privilegios del cliente
técnico. La regresión adicional exige UID 1000, Java corregido y la huella
`2596bb6dda83c66d96c5a252d7b2ae1f24cc1ae3f1890223b4f3591a8d52bf10`
de la [lista completa de certificados bloqueados](https://docs.azul.com/core/emudhra-workaround.html).

Para repetir la identidad, definir `IDENTITY_TEST_SECRETOS` con un directorio
exclusivo del ensayo y ejecutar los pasos de preparación, prueba y limpieza
de `.github/workflows/verificaciones.yml`. El análisis se repite después de
`docker compose build backend web db keycloak backup`.

Informes locales, fuera de Git: `build/security/{summary.json,keycloak.cdx.json,
keycloak.vulns.json}` en el checkout de la PR; registros de construcción,
pruebas y limpieza en `build/keycloak-fix/` del checkout principal.

## Límites

ARM64 tiene descarga/checksum definidos, pero no quedó comprobado: Docker
local rechazó su ejecución con `exec format error` al no disponer de emulación.
Las candidatas descartadas no acreditan la imagen final. Estos resultados
locales no sustituyen el CI remoto del commit publicado. Los hallazgos medios,
bajos y desconocidos siguen abiertos. No hubo despliegue público ni sustitución
del Keycloak local en operación; la tarea de sesión 6 conserva su aplazamiento.
