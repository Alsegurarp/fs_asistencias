# E6 — Verificación y consulta independiente del expediente

Entrega técnica del **28 de octubre de 2026**. Se incorpora E4/E5 desde
`feat/expediente-e4-e5` (`5cc975d`), cuya PR #21 se integró en la rama E2/E3
después de que la PR #20 llegara a main. La nueva entrega reúne E4–E6 contra
main; no presupone que la funcionalidad ya esté desplegada.

[PR #22 abierta](https://github.com/Alsegurarp/fs_asistencias/pull/22) contra
main, sin integrar ni desplegar; código funcional `0a1f9a2`. El CI remoto
está en curso al publicar. Los resultados de esta acta son locales.

E6 entrega `verificar-expediente.jar`, una herramienta independiente con el
esquema del formato 1 incluido. No inicia Spring ni requiere PostgreSQL,
Keycloak, cuenta, credenciales o conexión a Zenit. Utiliza las bibliotecas
Jackson/JSON Schema ya empleadas en el proyecto; no añade dependencias al
backend de producción. El JAR se genera con el build Docker existente.

## Qué comprueba

1. SHA-256 de los bytes completos del ZIP y del manifiesto, contra las dos
   huellas conservadas desde el canal autorizado del portal/API.
2. Inventario exacto de tres entradas sin duplicados ni rutas externas:
   `manifest.json`, `README.txt` y `records.ndjson`. No extrae archivos.
3. Tamaños y SHA-256 de README/NDJSON, formato del manifiesto y de cada
   colección contra el esquema normativo incluido; rechaza campos privados,
   tipos inválidos y claves JSON duplicadas.
4. Empresa única, solicitante presente, conteos por las 23 colecciones,
   identificadores únicos y referencias entre empleados, horarios, tarjetas,
   dispositivos, marcajes, incidencias, ajustes, cierres, acuses y corridas.
5. Huella del texto original de cada snapshot de cierre, sin reformatearlo.
   Conserva todas sus versiones; no reduce el archivo a los cierres vigentes.

Los actores/objetivos polimórficos de auditoría y los textos históricos de
actor no son claves foráneas: no se inventa una relación con una cuenta
actual. Las comprobaciones de estructura/integridad no certifican autoría,
firma avanzada ni validez jurídica. Una persona que reescriba datos y
manifiesto puede recalcular huellas internas; por eso el verificador exige
las huellas externas. Su custodia y la del archivo deben quedar separadas.

ZIP y NDJSON se recorren por flujo. Se mantienen sólo conteos e índices de
identificadores en memoria para comprobar relaciones en una segunda pasada.
Los perfiles anuales 50/300 están cubiertos; para históricos que excedan la
memoria disponible habrá que usar índices en disco. No materializa el ZIP ni
todos los registros en memoria. El manifiesto se limita a 1 MiB.

## Preparar la entrega

El build ya ejecuta `:backend:dossierVerifierJar`; el archivo queda en
`/workspace/backend/build/libs/verificar-expediente.jar` dentro de la etapa
`it`. Se entrega el JAR al responsable junto con el ZIP, las instrucciones,
las dos huellas de referencia y la versión/huella del propio verificador.
El binario se genera, no se versiona en Git.

Ejemplo para extraerlo de la imagen construida, desde la raíz del proyecto:

```powershell
docker build --target it --tag zenit-expediente-check .
docker create --name zenit-expediente-artefactos zenit-expediente-check
docker cp zenit-expediente-artefactos:/workspace/backend/build/libs/verificar-expediente.jar ./verificar-expediente.jar
docker rm zenit-expediente-artefactos
```

En la máquina independiente del destinatario, con **Java 25 o superior**,
sustituir las huellas de ejemplo por las recibidas por el canal autorizado:

```text
java -jar verificar-expediente.jar expediente.zip MANIFEST_SHA256 FILE_SHA256
java -jar verificar-expediente.jar expediente.zip MANIFEST_SHA256 FILE_SHA256 employee
java -jar verificar-expediente.jar expediente.zip MANIFEST_SHA256 FILE_SHA256 week_closure
java -jar verificar-expediente.jar expediente.zip MANIFEST_SHA256 FILE_SHA256 closure_acknowledgement
```

La primera orden devuelve el manifiesto verificado, sus conteos y limitaciones.
Las otras verifican primero el expediente completo y después muestran sólo
la colección elegida como JSON/NDJSON. Se puede guardar la salida y consultar
con un editor de texto, sin ejecutar HTML, fórmulas ni código de los datos.
Salida cero significa comprobación técnica correcta; cualquier rechazo sale
con código 1 y no imprime registros para consulta. Las órdenes de extracción
son un ejemplo reproducible; la validación local utilizó nombres de imagen y
contenedor propios de la sesión.

Para el host del proyecto se conserva el flujo exclusivamente Docker: se
puede ejecutar el mismo JAR con `--entrypoint java`, `--network none`, sistema
de archivos de sólo lectura y un montaje de sólo lectura con ZIP/JAR. No
instalar Java ni dependencias del proyecto en el host para esta comprobación.

## Recorrido de recuperación y salida

1. La persona autorizada solicita el expediente E5, verifica su identidad de
   nuevo y descarga una vez. Conserva ZIP, manifiesto y ambas huellas desde
   el portal/API, con versión, fecha de corte, empresa y responsable.
2. Copia la entrega a un equipo independiente; desconecta ese equipo del
   servicio o ejecuta el verificador sin red. Comprueba que no necesita
   sesión ni base del producto. Un archivo interrumpido requiere otra
   solicitud y MFA nuevo; no se intenta reutilizar la autorización consumida.
3. Verifica integridad y consulta `employee`, `attendance_event`, `incident`,
   `adjustment`, `week_closure` y `closure_acknowledgement`. Sigue los IDs de
   empleado/cierre: una reapertura conserva su versión, la nueva versión
   tiene otro cierre y cada objeción/conformidad pertenece al cierre original.
   `snapshot` y `envelope` son textos originales; no reescribirlos para
   recalcular sus huellas. La zona de consulta figura en el manifiesto.
4. Registra resultado, versión del verificador, conteos, limitaciones y
   aceptación del responsable. Custodia copias legibles y huellas por canales
   independientes conforme a la política pendiente de concretar.
5. Cualquier salida/baja o supresión es un procedimiento separado. Esta
   entrega no borra el origen, no restaura una instalación de Zenit ni
   habilita purga Android. El respaldo operativo multiempresa nunca se entrega
   como expediente de un cliente.

Limitaciones declaradas en cada manifiesto: sobres de rechazos ausentes del
servidor, texto histórico de acuse no guardado, evidencia sólo local Android
no incluida y metadata de auditoría filtrada. El verificador no reconstruye
ni acredita esa evidencia ausente.

## Evidencia técnica del 28

- **67 unitarias y 88 integraciones PostgreSQL**, sin fallos, errores ni
  omisiones; incluye tres pruebas unitarias E6, verificación de una descarga
  HTTP con las huellas del API y verificación de los ZIP E3 con historia,
  reapertura/objeciones, ajustes y perfiles de 50/300 durante un año.
- Casos negativos: truncamiento, datos/manifiesto alterados, empresa ajena,
  referencia inexistente, campo privado y entrada ZIP fuera del inventario.
- Ejecución del JAR empaquetado en un contenedor **sin red**, de sólo lectura,
  sin capacidades ni bases montadas: verifica y consulta el expediente
  ficticio descargado el 27. El ZIP coincide con su SHA-256 registrado en
  `build/e4-e5-qa/results.json`; la huella de manifiesto se derivó después de
  comprobar ese anclaje. Una huella de referencia falsa se rechazó.
- Evidencia local: `build/e4-e6-test-results/`,
  `build/e4-e6-offline-hashes.json`, `build/e4-e6-offline-check.log` y
  `build/e4-e6-offline-consult.log`. JAR en `build/verificar-expediente.jar`.

**Cierre:** verificación/consulta independiente entregada en alcance técnico.
La aceptación integral de conservación y salida sigue pendiente del
responsable, Q07/Q14 y el criterio jurídico. No se responde por inferencia
cuánto purgar ni qué documento de acuse aceptar. Los 17 pendientes globales
y seis P0 conservan sus condiciones de cierre.
