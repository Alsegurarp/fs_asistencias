# E6 — descarga nueva con acuses y consulta sin red, 6 de noviembre de 2026

**Ensayo técnico aprobado** sobre `5b0a66c`, con el backend local actual,
PostgreSQL y Keycloak reales. Entorno ficticio `zenit-android-check`, API
48080 e identidad 48082; no se usó el servidor público ni el almacén Android.

## Historia comprobada

1. Se crea una empresa ficticia y una cuenta de trabajador ligada al padrón.
   Se cierra la semana del 26 de octubre, se registra una objeción con nota,
   se reabre y se cierra la versión 2 con conformidad. Cada acuse se envía
   autenticado como el trabajador, mediante la API pública del producto.
2. Administración recibe el permiso explícito del expediente y solicita uno
   nuevo. El manifiesto obtenido por API declara dos cierres y dos acuses.
3. El desafío exige PKCE S256 y ACR 2. Contraseña sola no entrega código;
   OTP incorrecto se rechaza; OTP válido completa el flujo real de Keycloak.
   El backend canjea el código con state/verificador y autoriza la descarga.
4. El ZIP se obtiene por el endpoint de descarga y coincide con `fileSha256`
   publicado por API. Repetir la descarga consumida devuelve 410. Se conservan
   las dos huellas del API antes de consultar los bytes del ZIP.
5. El JAR actualizado se construye con Gradle 9.8/JDK 25 y dependencias
   locales. Se ejecuta en tres contenedores independientes sin red,
   sistema de archivos de sólo lectura y ZIP/JAR montados de sólo lectura:
   verificación completa, consulta `week_closure` y consulta
   `closure_acknowledgement`. Las tres órdenes terminan con código cero.
6. La consulta conserva estados `reopened`/`closed`, versiones 1/2 y tipos
   `objected`/`agreed`, unidos por empleado y cierre de la misma empresa.
   Se recalculan además las dos huellas del acuse desde la salida consultada:
   coinciden, incluidos Unicode, separador `|` y microsegundos de la nota/fecha.
7. Una huella externa incorrecta produce salida distinta de cero y no
   imprime registros de consulta. La empresa ficticia queda suspendida y
   las cuentas/cliente creados para el ensayo se eliminan. El estado privado
   final no conserva contraseñas, secretos OTP ni tokens.

## Anclajes de esta fixture ficticia

| Artefacto | SHA-256 |
| --- | --- |
| Manifiesto, desde API | `9d6c03dac2a719d2a89094d860bc1c1a8447431e5e668f72b50b5a0a6ac795f4` |
| ZIP, desde API | `e069773c1a4f87b35660af15afa11f280da6f69a1bbd1a70249b8cedf7313476` |
| Verificador entregable | `292f9748c73b80d572225e37d2cccb95b60ed5eb43609f4b459dc90aa7897cbd` |

Evidencia local ignorada por Git en `build/qa-e6-20261106/`: ZIP, JAR,
`anchors.json`, `result.json`, registros de las tres consultas y del rechazo,
y guiones con aserciones de preparación/comprobación. Las huellas publicadas
aquí corresponden sólo a esta fixture, no a un expediente operativo.

## Límites

Se ejercitó el protocolo HTTP de autenticación, no la interfaz del navegador.
El control visual del navegador no estaba disponible. No hubo contraseña de
producción ni modificación de la política de autenticación normal.

La semana de esta fixture no tiene marcajes: se verifica evidencia de
versiones/acuses, no cálculo de jornada. El ZIP conserva las limitaciones
de formato sobre sobres rechazados, texto histórico del documento de acuse,
evidencia local Android y metadatos de auditoría. Este ensayo completa la
verificación técnica pendiente con acuses nuevos; la tarea 15 mantiene
aceptación integral/pública y custodia. No autoriza purga ni acredita
recuperación del respaldo de ambas bases desde el destino externo.
