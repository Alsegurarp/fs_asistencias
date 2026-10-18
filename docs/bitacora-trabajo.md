# Bitácora de trabajo

## 18 de octubre de 2026 — Publicación en el servidor compartido

**Estado: Zenit publicado con datos ficticios; la landing espera su
credencial de correo.** Zenit corre en <https://zenit.fastsolution.com.mx>
sobre el commit `2c24cde`, con la configuración de servidor de
`deploy/servidor/`. Un borde propio de fastSolution termina TLS con
certificados de Let's Encrypt que emite y renueva lego; el borde del
anfitrión sólo enruta por nombre, sin descifrar. Los secretos se generaron en
el servidor y no salen de él.

Comprobado por la dirección pública: portal, estado del backend y página de
acceso de la identidad; emisor público correcto aunque se falsifiquen
cabeceras; `404` para la administración, `master` y la salud de la
identidad; `421` para un `Host` ajeno; puertos internos cerrados; consola de
identidad por túnel. Detalle en [Despliegue en el servidor](despliegue-en-servidor.md).

No comprobado: ninguna sesión real (no hay cuentas de personas), correo,
respaldo operativo, ni una renovación real de certificado. La landing quedó
construida; su `Dockerfile` se corrigió para dejar su imagen sin
vulnerabilidades altas y arranca cuando exista su credencial.

## 17 de octubre de 2026 — Declaración de pendientes

Se consolidaron en [Estado y pendientes](estado-y-pendientes.md#lista-consolidada-de-tareas-pendientes)
las tareas 2 y 4 aún abiertas y las tareas 7 a 20 sin abordar, conservando
la numeración y el orden de complejidad originales. Se registraron sus
dependencias y los límites de las tareas 5 y 6 completadas. No se aprobaron
reglas de negocio, no se ejecutaron funciones nuevas ni se publicó el sistema.

## 17 de octubre de 2026 — Ejecución de tareas 1 a 6

**Estado: avance comprobado; decisiones y recorrido manual abiertos.**
Docker Desktop se inició y el entorno local se reconstruyó sin borrar volúmenes.
El API respondió `UP` en el puerto local 18080 y el portal HTTP 200 en 8081.

- Documentación unificada: alcance actual del portal, presentación móvil,
  verificaciones de respaldos y URL de identidad. Se retiró la indicación
  desactualizada de que el portal no iniciaba sesión y el desarrollo fuera de Docker.
- Backend: construcción con pruebas unitarias y 73 pruebas de integración correctas.
  Contrato válido. Búsqueda de secretos del historial sin hallazgos tras una
  excepción exacta, por valor y archivo, para un UUID ficticio de una prueba.
- Portal: 128 pruebas correctas con dos procesos. El primer intento por omisión
  tuvo 8 fallos de espera/sincronización; `pnpm test` ahora usa ese límite.
- Android: construcción Docker correcta con 9 pruebas unitarias, lint y APK
  debug. No se repitieron release ni instrumentación en el teléfono.
- Identidad configurable: imágenes local y HTTPS ficticia construidas; cliente,
  nginx y CSP coinciden; HTTP 200 comprobado. No se publicó ni verificó TLS real.
- Respaldos: autoprueba aislada correcta, incluidos casos de alteración y clave
  incorrecta. Ensayo local correcto: 130 tablas/1.772 filas con contenido idéntico.
  No se generaron claves de operación ni se guardó una copia cifrada persistente.
- Decisiones de negocio: [propuestas preparadas](decisiones-de-negocio.md),
  pendientes de respuesta; no se modificaron reglas ni permisos.
- Horarios/importación: [guion preparado](validacion-tareas-1-a-6.md#guion-pendiente-con-sesión-real).
  Computer Use detuvo el control de Chrome al no poder determinar la URL activa
  con suficiente certeza. La prueba con sesión real sigue pendiente.

La [validación detallada](validacion-tareas-1-a-6.md) conserva comandos,
resultados y el estado final de Android.

## 14 de octubre de 2026 — Jornada, acuse y respaldos

**Estado: avance parcial; tareas abiertas.** El usuario pidió registrar lo
pendiente y continuar con la siguiente tarea crítica. No se consideran
completadas ni se cambia su prioridad.

### Revisión jurídica de jornada y acuse

Entregado: [revisión documental](revision-juridica-jornada-acuse.md) contra
fuentes oficiales del DOF y la LFT. Se confirmó el calendario de topes y se
identificaron diferencias entre las disposiciones y el cálculo implementado.
No se cambió el algoritmo, el contrato ni la evidencia de cierres existentes.

Falta para cerrar:

1. Dictamen de un profesional laboral sobre jornada y valor del acuse,
   considerando contratos y régimen aplicable al cliente.
2. Aprobar criterios y resultados esperados de jornada diurna, nocturna y
   mixta; tiempo extraordinario diario y semanal; descansos computables;
   distribución de horas; cruces de medianoche, semana y año; periodos
   anteriores a la reforma y ausencias.
3. Implementar esos criterios con pruebas y conservar las reglas y los
   cierres históricos. Las alertas actuales no acreditan conformidad laboral.
4. Definir el documento presentado al trabajador, su identidad, acuerdo del
   empleador, versión del texto, copia reproducible y atención de objeciones.
   La huella del servidor no equivale por sí sola a firma avanzada ni prueba
   plena de acuerdo.
5. Revisar las disposiciones generales de registro electrónico antes de
   publicar y de enero de 2027; aprobar la retención documental.

### Respaldos cifrados y restauración nueva

Entregado: modos `backup` y `backup-restore`, cifrado age, verificación de
conteos y contenido, autoprueba aislada y [guía](respaldos-cifrados.md).
No se generó todavía una clave de operación ni se guardó una copia comprobada.

Falta para cerrar:

1. Iniciar Docker Desktop. El intento desde este entorno falló por acceso
   denegado a los registros de Docker; el motor sigue detenido.
2. Construir las herramientas y ejecutar la autoprueba: restauración sin
   origen y rechazo de filas eliminadas, contenido distinto, paquete alterado
   y clave incorrecta. Repetir el ensayo existente, que también fue modificado.
3. Generar y custodiar las claves; guardar una copia cifrada de las bases
   locales y restaurarla en el contenedor aislado. Repetir con escrituras
   simultáneas y registrar el resultado.
4. Analizar vulnerabilidades de la imagen nueva que incluye age y comprobar
   el procedimiento en el sistema operativo del servidor elegido.
5. Recuperar un ambiente completo con secretos nuevos, permisos revisados,
   migraciones correctas, backend saludable y acceso a Keycloak. La prueba
   preparada sólo verifica las bases, no la recuperación de los servicios.
6. Definir destino fuera de la máquina, periodicidad, retención, responsable,
   custodia separada de claves y objetivos de recuperación. Probar la carga
   prevista; adaptar la verificación por lotes si supera el límite documentado.

Comprobado: `docker compose --profile ops config --quiet` y
`git diff --check`, sin errores. No ejecutados: construcción, autoprueba,
restauración, análisis de vulnerabilidades ni pruebas funcionales.

Actualización del 14 de octubre de 2026: la imagen se construyó y la parte de
autoprueba del punto 2 terminó correctamente. Restauró dos bases ficticias sin
el origen disponible y rechazó filas eliminadas, contenido distinto con el
mismo conteo, un paquete alterado y otra clave privada. Los paquetes ocuparon
2,333 y 2,345 bytes. Sigue pendiente repetir el ensayo existente y recorrer las
bases locales.

También se completó la parte de análisis del punto 4. El primer inventario
encontró 2 críticas y 10 altas en age; por decisión del usuario se corrigió la
imagen en vez de aceptar el riesgo. age 1.3.2 y age-keygen se recompilaron con
Go 1.27.2 y `x/crypto` 0.56.0. El segundo análisis terminó sin error, con 0
críticas, 0 altas, 4 medias y 1 de gravedad desconocida; esta última sólo
afecta a `openpgp`, ausente del grafo de importación de los ejecutables. No se
generaron claves de operación ni respaldos locales. Siguen abiertos el ensayo
existente del punto 2, los puntos 3, 5 y 6, y la comprobación del procedimiento
en el sistema operativo que se elija para el servidor.

Actualización del 14 de octubre de 2026, con el entorno local levantado desde
un volumen nuevo: el ensayo existente respaldó y restauró la base del producto
y la de identidad y comparó 125 tablas y 215 filas con contenido idéntico, en
2 segundos. Queda cerrado el punto 2. Los puntos 3, 5 y 6 esperan decidir
custodio de la clave privada y de su copia aislada, destino fuera de la
máquina, frecuencia, retención, quién atiende un fallo y objetivos de
recuperación; sin eso no se genera una clave de operación. La comprobación en
el sistema operativo del servidor espera que exista el servidor.

### Siguiente tarea

Preparar el ambiente compartido con TLS, correo verificado, recuperación de
contraseña y cuentas personales de administración. Pendientes de confirmar:
servidor/proveedor, dominios del portal e identidad y servicio SMTP. No se
ha autorizado ni realizado una publicación.

## 14 de octubre de 2026 — Preparación del ambiente compartido

**Estado: en curso; depende de infraestructura y Docker.** Se encontró que
la imagen del portal usaba la identidad local y su CSP sólo permitía ese
origen. Ahora Compose pasa `IDENTITY_URL` a la construcción del cliente y a
la generación de CSP; ambos usan el mismo valor que backend y Keycloak.

Comprobado: resolución de Compose con dirección local y con dominio ficticio
HTTPS, y `git diff --check`. No comprobado: construcción del portal, nginx
en ejecución ni recorrido de acceso por HTTPS. Docker sigue detenido.

Se preparó [el procedimiento del ambiente compartido](preparar-ambiente-compartido.md).
Faltan servidor y dominios, emisión y renovación de certificados, SMTP,
configuración del realm activo, prueba de verificación y recuperación,
cuentas personales con OTP y retiro de la cuenta temporal tras comprobar
el acceso. No se habilitaron cambios de identidad sin SMTP ni se publicó.

Actualización del 14 de octubre de 2026: la imagen del portal se construyó con
la dirección de identidad local y con una ficticia HTTPS. En los dos casos la
CSP de nginx y el cliente contienen la misma dirección, y la otra no aparece
en el código servido. La imagen quedó restaurada con la dirección local.
Siguen sin comprobarse nginx en ejecución y el recorrido de acceso por HTTPS.

Actualización del 14 de octubre de 2026: con el entorno local completo, nginx
respondió `200` en la raíz con la CSP y las cabeceras esperadas, y su proxy
devolvió el estado del backend. Sigue sin comprobarse el recorrido de acceso
por HTTPS: espera servidor, dominios y certificados.
