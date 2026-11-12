# Diseño: dos formas de marcar

Estado: **propuesta para revisar**. Nada de esto está construido.

## Decisiones (2026-11-11 y 2026-11-12)

- **Dos formas de marcar, vendidas por separado.** Una es la tarjeta de la
  persona en el teléfono de la oficina. La otra es el teléfono de la persona
  en la etiqueta de la oficina. Es el mismo producto: cada empresa tiene
  habilitada una forma, la otra o las dos, según su plan.
- **Una persona marca de una sola forma.** Con tarjeta, nunca la lee con un
  teléfono suyo. Con teléfono, la identidad está en el teléfono y no lleva
  tarjeta. **Se retira la lectura de la propia tarjeta en el teléfono
  personal**, que existe hoy.
- **Las etiquetas las registra el administrador desde el portal.** Puede dar
  ese permiso a otra persona, y se da al crear su perfil.
- **Cada etiqueta lleva un nombre**, por ejemplo «Puerta norte» o «Oficina
  del gerente». Una sede puede tener varias.
- **Etiquetas:** MIFARE Classic para el piloto y NTAG 424 DNA después. Todavía
  no hay 424 DNA para probar.
- **GPS:** se manda si hay. Si llega y queda fuera de la sede, se abre
  incidencia.
- **Lector fijo:** sin GPS cuenta en su sede (`device_site`, contrato
  0.34.0).

## Las dos formas

| | Tarjeta en el lector fijo | Teléfono en la etiqueta |
| --- | --- | --- |
| Qué se queda en la sede | Un teléfono en modo terminal | Una o varias etiquetas con nombre |
| Qué lleva la persona | Su tarjeta, sin datos personales (un código firmado) | Su teléfono, activado a su nombre |
| Quién dice quién marca | La tarjeta | El teléfono, que firma cada sobre con su llave |
| Qué prueba la sede | El lector fijo | La etiqueta y, si hay, el GPS |
| Se registra en | Dispositivos y tarjetas: lectores y tarjetas | Dispositivos y tarjetas: etiquetas y teléfonos |
| Si pierde lo que lleva | Se revoca la tarjeta y se le da otra | Se revoca el teléfono y se activa otro |

## Plan de la empresa y forma de cada persona

- **El plan de la empresa:** `captureMethods`, con valores `card_terminal`
  y/o `phone_tag`.
  - Lo fija la operación de FastSolution en la Consola de operación, que es el
    bloque 5. La empresa no lo cambia.
  - Cambiarlo queda en la bitácora.
- **La forma de cada sede:** sólo aplica si el plan trae las dos formas. La
  sede elige una de las dos o ambas; el valor por omisión es todas las que
  permita el plan.
- **La forma de cada persona:** `captureMethod`, con valor `card` o `phone`.
  - Se elige en su ficha, entre lo que permitan el plan y su sede.
  - Con `card`, el servidor rechaza cualquier marca suya que llegue con
    etiqueta (`method_not_allowed`).
  - Con `phone`, rechaza las que lleguen con tarjeta.
  - Cambiar de forma se hace en el portal: se revoca lo anterior (la tarjeta o
    el teléfono) y queda en la bitácora.
- **El teléfono personal:** sólo se puede activar para una persona con
  `phone`. Ya no acepta tarjetas: hoy acepta la de su titular, y eso se
  retira.

## Qué prueba la etiqueta en cada fase

| | Fase 1: Classic (piloto) | Fase 2: NTAG 424 DNA |
| --- | --- | --- |
| Qué guarda la etiqueta | Un código firmado por el servidor | Su clave AES; en cada lectura entrega un mensaje firmado con un contador (SUN) |
| ¿Se puede clonar? | Sí | No |
| ¿Se puede repetir una lectura vieja? | Sí | No: el servidor rechaza un contador ya visto |
| Sin GPS | `not_evaluated` con `location_inconclusive` | Cuenta en la sede (`site_tag`) y no abre incidencia |
| GPS dentro | `inside` | `inside` |
| GPS preciso fuera | `outside` con `foreign_site` | `outside` con `foreign_site` |
| GPS simulado | `inconclusive` con `location_inconclusive` | Igual |
| GPS impreciso | `inconclusive` con `location_inconclusive` | `site_tag` |

En la fase 1 la etiqueta sólo dice qué sede se leyó; la presencia la sigue
probando el GPS. Por eso, sin GPS, la marca queda para revisión. Es el mismo
riesgo aceptado que con las tarjetas Classic.

## Registrar una etiqueta desde el portal

El portal no puede escribir una etiqueta: un navegador no escribe MIFARE
Classic ni configura una 424 DNA. Por eso se separan dos pasos.

1. **Preparar la etiqueta: lo hace FastSolution antes de entregarla.**
   - Una herramienta interna escribe el código firmado (fase 1) o configura la
     clave y el mensaje SUN (fase 2).
   - Imprime en la etiqueta su clave corta, por ejemplo `ZS-7K4M-2Q9P`.
   - La etiqueta todavía no es de ninguna empresa.
2. **Registrarla: lo hace el administrador en el portal.**
   - En Dispositivos y tarjetas, «Registrar etiqueta».
   - Escribe la clave impresa, elige la sede, le pone nombre («Puerta norte») y
     la guarda.
   - Desde ese momento vale para esa empresa y esa sede.
   - Una clave ya registrada en otra empresa se rechaza sin decir de cuál.

Si prefieres que el cliente prepare sus propias etiquetas, haría falta
escribirlas desde la app Android de quien administra. Es más trabajo y saca la
clave de FastSolution; no lo recomiendo para la fase 2.

**El permiso:** `site_tag_manager`. Lo tiene la Administración y se puede dar
a otra persona al invitarla o al editar su acceso, igual que el permiso del
expediente. Permite registrar, renombrar, mover de sede y revocar etiquetas.

## Servidor

### Datos

- **`tenant`:** se agrega `capture_methods text[]`. Las empresas que ya existen
  quedan con `card_terminal` y `phone_tag`, para no romper nada.
- **`site`:** se agrega `capture_methods text[]`, nulo cuando vale el del
  plan.
- **`employee`:** se agrega `capture_method` (`card` | `phone`). Las personas
  que ya existen quedan en `card`.
- **`site_tag`:**
  - Campos: `tenant_id` (nulo mientras no se registre), `id`, `site_id`,
    `name`, `short_code`, `fingerprint`, `technology`, `status` (`unassigned`
    | `active` | `revoked`), `registered_at`, `registered_by`, `revoked_at`,
    `revoked_reason`, `last_read_at`.
  - Va aparte de `card` porque una tarjeta tiene titular y una etiqueta tiene
    sede y nombre.
- **`attendance_event`:**
  - `card_id` admite nulo y se agrega `site_tag_id`; una restricción exige
    exactamente uno de los dos.
  - **Esto cambia el formato del expediente**, porque `attendance_event`
    viaja en él. Requiere documentar el campo nuevo y que `card_id` puede
    venir vacío.
- **Fase 2:** `site_tag_counter` guarda los contadores ya vistos. Un contador
  repetido se rechaza (`tag_replayed`).
- **Permiso:** `tenant_user.site_tag_permission`, como
  `dossier_permission`.

### Sobre del marcaje

`envelopeVersion` sigue en 1. El sobre lleva exactamente uno de estos dos
campos:

- `card`, como hoy, y sólo desde una terminal.
- `siteTag: { scheme, proof, keyVersion }`, y sólo desde un teléfono personal.

Los esquemas de `siteTag`:

- **`site_tag_pilot_v1`:** la prueba es `<uid>.<código>.<firma>`. Firma con
  otro dominio que la tarjeta, así que una tarjeta no pasa por etiqueta ni al
  revés.
- **`site_tag_ntag424_v1` (fase 2):** el UID cifrado y el contador (PICCData)
  con su CMAC. La clave de cada etiqueta se deriva de una clave maestra y del
  UID.

### Reglas de captura

1. **La forma del dispositivo:**
   - Una terminal acepta sólo `card`.
   - Un teléfono personal acepta sólo `siteTag`; con tarjeta, `card_not_allowed`.
2. **La persona:** con `siteTag`, quien marca es `device.employeeId`. Debe
   estar activa, dentro de su periodo y tener `capture_method = phone`.
3. **El plan y la sede:** la forma debe estar en el plan de la empresa y en la
   sede de la etiqueta o de la terminal. Si no, `method_not_allowed`.
4. **La etiqueta:**
   - Debe estar registrada en la empresa y activa. Si no, `tag_unknown` o
     `tag_revoked`.
   - Una etiqueta revocada vale para las marcas observadas antes de la
     revocación (sin conexión).
5. **La sede:** es la de la etiqueta. Si no es la sede de la persona, se abre
   `foreign_site`.
6. **La ubicación:** se evalúa según la tabla de las fases.
7. **Lo demás:** tipo de marca, duplicados, `late_sync`, `clock_anomaly` y la
   semana cerrada siguen igual.

### API (0.35.0 el plan y la forma; 0.37.0 las etiquetas)

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `POST /site-tags/registration` | Administración o quien tenga `site_tag_permission` | Registra la etiqueta con su clave impresa, su sede y su nombre |
| `GET /site-tags?siteId=&status=&q=` | Administración, RH y quien tenga el permiso | Etiquetas con sede, nombre, tecnología, estado y última lectura |
| `PATCH /site-tags/{id}` | Administración o quien tenga el permiso | Cambia el nombre o la sede |
| `POST /site-tags/{id}/revocation` | Igual | La revoca, con un motivo |
| `PUT /users/{id}/site-tag-permission` | Administración | Da o quita el permiso |
| `PATCH /employees/{id}` | Administración y RH | Agrega `captureMethod` |
| `PATCH /sites/{id}` | Administración | Agrega `captureMethods` |
| `PUT /tenants/{tenantId}/capture-methods` | Operación de FastSolution | Fija el plan |

Todo queda en la bitácora: `site_tag.registered`, `site_tag.updated`,
`site_tag.revoked`, `employee.capture_method_changed` y
`tenant.capture_methods_changed`.

## App Android

- **Terminal:** como hoy; lee tarjetas.
- **Teléfono personal:**
  - Deja de leer la propia tarjeta.
  - Al acercarlo a una etiqueta de la sede, arma el sobre con `siteTag` y la
    ubicación que haya.
  - Muestra «Entrada · Puerta norte, Sede Piloto NFC» y el resultado.
  - Sin conexión guarda el sobre como hoy.
  - Si lee algo que no es una etiqueta de sede, por ejemplo una tarjeta, avisa
    «Esto no es una etiqueta de la oficina» y no manda nada.
- **Activación:** el portal sólo ofrece activar un teléfono personal para una
  persona con `phone`.

## Portal

- **Ficha de la persona:** «Cómo marca: con tarjeta / con su teléfono», entre
  lo que permitan el plan y su sede. Cambiarlo pide confirmar y dice qué se
  revoca.
- **Dispositivos y tarjetas:**
  - Una pestaña «Etiquetas» con nombre, sede, tecnología, estado y última
    lectura.
  - Las acciones: registrar, renombrar, mover y revocar.
  - Si el plan no trae la etiqueta, la pestaña no aparece.
- **Usuarios:** la casilla «Puede registrar etiquetas» al invitar y al editar
  el acceso, con su fila en la tabla de permisos.
- **Configuración:** en cada sede, las formas de marcar admitidas y cuántas
  etiquetas activas tiene.
- **Asistencia, en Marcajes:** «Entrada · Puerta norte · teléfono personal», con
  su evidencia.
- **Consola de operación (bloque 5):** el plan de cada empresa.

## Riesgos

| Riesgo | Fase 1 | Fase 2 |
| --- | --- | --- |
| Clonar la etiqueta y marcar desde casa | Sin GPS o con GPS fuera, queda en incidencia | No se puede |
| Prestar el teléfono a otra persona | Igual que hoy con el teléfono personal | Igual |
| Quitar o dañar la etiqueta | Se revoca y se registra otra | Igual |
| Registrar una etiqueta robada de otra empresa | La clave ya está registrada y se rechaza | Igual |
| Datos personales en la etiqueta o la tarjeta | Ninguno | Ninguno |

## Lo que se retira

- **La lectura de la propia tarjeta en el teléfono personal.** Antes de
  quitarla hay que revisar quién la usa hoy. En los datos locales son pruebas
  de QA; en un ambiente con clientes habría que pasar a esas personas a una de
  las dos formas.

## Decidido

- **Quién prepara las etiquetas:** FastSolution, antes de entregarlas
  (2026-11-12). El cliente sólo las registra por su código corto.

## Orden propuesto

1. **Plan y forma (hecho, contrato 0.35.0):** `captureMethods` de la empresa
   y la sede, `captureMethod` de cada persona, y las reglas que rechazan la
   forma equivocada.
2. **Etiquetas en el servidor:** tabla, registro, sobre `siteTag`, reglas, API
   0.37.0 y el expediente.
3. **Preparar etiquetas Classic:** la herramienta interna de FastSolution.
4. **Android:** el teléfono personal lee etiquetas y deja de leer la propia
   tarjeta.
5. **Portal:** la ficha de la persona, las etiquetas en Dispositivos, el
   permiso en Usuarios y las formas en Configuración.
6. **Prueba con una etiqueta Classic real** en la Sede Piloto NFC.
7. **Consola de operación:** el plan de cada empresa, dentro del bloque 5.
8. **Fase 2:** NTAG 424 DNA, cuando tengas las etiquetas.
