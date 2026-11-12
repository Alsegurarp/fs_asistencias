# Diseño: etiqueta en la sede

Estado: **propuesta para revisar**. Nada de esto está construido.
Decisiones del 2026-11-11 en las que se basa:

- Una etiqueta NFC se queda pegada en la sede.
- El teléfono personal de cada persona la lee y manda el marcaje.
- Para el piloto se usan etiquetas MIFARE Classic. Después se cambian a
  NTAG 424 DNA.
- El GPS se manda si hay. Si llega y queda fuera de la sede, se abre
  incidencia.

## Qué cambia frente a hoy

Este producto invierte quién lee a quién:

| | Lector fijo (hoy) | Teléfono personal con su tarjeta (hoy) | Etiqueta en la sede (nuevo) |
| --- | --- | --- | --- |
| Qué se queda en la sede | Un teléfono en modo terminal | Nada | Una etiqueta |
| Qué lleva la persona | Su tarjeta | Su teléfono y su tarjeta | Su teléfono |
| Quién dice quién marca | La tarjeta | La tarjeta, que debe ser del titular del teléfono | El teléfono, por estar ligado a su titular |
| Qué prueba la sede | El lector fijo (`device_site`, 0.34.0) | El GPS | La etiqueta y, si hay, el GPS |

La persona no necesita tarjeta. El teléfono ya está ligado a ella: se activó
en modo `personal` con su `employeeId` y firma cada sobre con su llave.

## Qué prueba la etiqueta en cada fase

| | Fase 1: Classic (piloto) | Fase 2: NTAG 424 DNA |
| --- | --- | --- |
| Qué guarda la etiqueta | Un código firmado por el servidor (como la tarjeta del piloto) y nada de la persona | Su clave AES; en cada lectura entrega un mensaje firmado con un contador (SUN) |
| ¿Se puede clonar? | Sí, en minutos y con un lector barato | No; la clave no sale de la etiqueta |
| ¿Se puede repetir una lectura vieja? | Sí | No; el servidor rechaza un contador ya visto |
| Sin GPS | `not_evaluated` con `location_inconclusive`, igual que hoy | Cuenta en la sede (`site_tag`) y no abre incidencia |
| GPS dentro | `inside` | `inside` |
| GPS preciso fuera | `outside` con `foreign_site` | `outside` con `foreign_site` |
| GPS simulado o impreciso | `inconclusive` con `location_inconclusive` | `site_tag` si es impreciso; `inconclusive` con incidencia si es simulado |

En la fase 1 la etiqueta sólo dice qué sede se leyó; la presencia la sigue
probando el GPS. Por eso, sin GPS, la marca queda para revisión. Así una
etiqueta clonada y leída en casa no pasa sin que nadie la vea. Es el riesgo
aceptado del piloto, el mismo que el de las tarjetas Classic
(`piloto-tarjetas-classic`).

## Servidor

### Datos

- **Tabla nueva `site_tag`:**
  - Campos: `tenant_id`, `id`, `site_id`, `fingerprint`, `label` (`ZS-…`),
    `technology` (`mifare_classic` | `ntag424_dna`), `status`
    (`active` | `revoked`), `created_at`, `revoked_at`, `revoked_reason`,
    `last_read_at`.
  - Va aparte de `card` porque una tarjeta tiene titular e historial de
    titulares y una etiqueta tiene sede.
- **`attendance_event`:**
  - `card_id` pasa a admitir nulo.
  - Se agrega `site_tag_id`.
  - Una restricción exige exactamente uno de los dos.
  - **Esto cambia el formato del expediente**, porque `attendance_event`
    viaja en él. Requiere una versión nueva del formato o un campo opcional
    documentado, igual que en entregas anteriores.
- **Fase 2:** la tabla `site_tag_counter` (`site_tag_id`, `counter`) guarda los
  contadores ya vistos. Un contador repetido se rechaza (`tag_replayed`).

### Sobre del marcaje

`envelopeVersion` sigue en 1. El sobre lleva exactamente uno de estos dos
campos:

- `card: { scheme, proof, keyVersion }`, como hoy.
- `siteTag: { scheme, proof, keyVersion }` (nuevo).

Los esquemas de `siteTag`:

- **`site_tag_pilot_v1`:**
  - La prueba es `<uid>.<código>.<firma>`, como la tarjeta del piloto.
  - Firma con otro dominio, para que una tarjeta de persona no pueda pasar por
    etiqueta ni al revés.
- **`site_tag_ntag424_v1` (fase 2):**
  - La prueba es el UID cifrado y el contador (PICCData) con su CMAC, tal como
    los entrega la etiqueta.
  - El servidor deriva la clave de cada etiqueta de una clave maestra y del
    UID.

### Reglas de captura

1. **El dispositivo:** sólo un dispositivo `personal` acepta `siteTag`. Una
   terminal que lo mande se rechaza con `tag_not_allowed`.
2. **La persona:** quien marca es `device.employeeId`. Valen las mismas reglas
   que hoy: activa, dentro de su periodo y con un marcaje a la vez.
3. **La etiqueta:**
   - Debe existir, ser de la empresa y estar activa. Si no, `tag_unknown` o
     `tag_revoked`.
   - Una etiqueta revocada vale para las marcas observadas antes de la
     revocación (sin conexión), igual que la tarjeta.
4. **La sede:** la sede de la marca es la de la etiqueta. Si no es la sede de la
   persona, se abre `foreign_site`, como en el lector fijo.
5. **La ubicación:** se evalúa contra la sede de la etiqueta según la tabla de
   arriba. Nace el veredicto `site_tag`, sólo en la fase 2.
6. **Lo demás:** tipo de marca, duplicados, `late_sync`, `clock_anomaly` y la
   semana cerrada siguen igual.

### API

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `POST /site-tags/issue` | Teléfono del administrador o terminal de la sede | Devuelve el código firmado para escribirlo en la etiqueta (fase 1) o la configuración SUN (fase 2) |
| `POST /site-tags` | Igual | Registra la etiqueta ya escrita, ligada a una sede |
| `GET /site-tags?siteId=` | Portal: administración y RH | Etiquetas, su estado y su última lectura |
| `POST /site-tags/{id}/revocation` | Portal: administración | La revoca, con un motivo; queda en la bitácora |

Todo queda en la bitácora: `site_tag.issued`, `site_tag.registered` y
`site_tag.revoked`. La nueva versión del contrato sería la **0.35.0**.

## App Android

- **Modo personal:** al acercar el teléfono a una etiqueta de sede, arma el
  sobre con `siteTag` y la ubicación que haya.
  - La pantalla dice «Entrada en Sede Piloto NFC» y el resultado del servidor.
  - Sin conexión, guarda el sobre como hoy.
- **Distinguir tarjeta y etiqueta:** el teléfono reconoce por el dominio del
  código si leyó una tarjeta de persona o una etiqueta de sede.
  - Una tarjeta ajena sigue rechazándose (`card_not_owner`).
- **Registrar una etiqueta:** un flujo para la terminal o el teléfono de quien
  administra: elegir la sede, acercar la etiqueta, escribirla y registrarla.
  - En la fase 1 reutiliza lo ya hecho para escribir tarjetas del piloto.
  - En la fase 2 configura la clave y el mensaje SUN.

## Portal

- **Dispositivos y tarjetas:** una pestaña «Etiquetas de sede» con la sede, la
  tecnología, el estado y la última lectura, y la acción de revocar.
- **Configuración:** cada sede muestra cuántas etiquetas activas tiene.
- **Asistencia, en Marcajes:** «Entrada · Etiqueta de Sede Piloto NFC ·
  teléfono personal», con su evidencia («Dentro de la sede», «Sin ubicación»
  o, en la fase 2, «Etiqueta segura de la sede»).
- **Incidencias:** sin tipos nuevos; se reutilizan `foreign_site` y
  `location_inconclusive`.

## Riesgos

| Riesgo | Fase 1 | Fase 2 |
| --- | --- | --- |
| Clonar la etiqueta y marcar desde casa | Sin GPS o con GPS fuera, queda en incidencia | No se puede |
| Prestar el teléfono a otra persona | Igual que hoy con el teléfono personal | Igual |
| Quitar o dañar la etiqueta | Se revoca y se registra otra | Igual |
| Fotografiar la etiqueta o leerla a distancia | Sirve para clonarla (ver la primera fila) | El contador hace inútil una lectura vieja |
| Datos personales en la etiqueta | Ninguno | Ninguno |

## Preguntas abiertas para Alexis

1. **Las dos formas a la vez:** ¿una misma persona puede marcar con su tarjeta
   en el lector fijo y también con su teléfono en la etiqueta, o la empresa
   elige una forma por persona o por sede?
2. **Quién registra las etiquetas:** ¿el teléfono de quien administra, la
   terminal de la sede o ambos?
3. **Varias etiquetas por sede:** por ejemplo, una por puerta. El diseño lo
   permite; ¿hace falta que el portal las distinga por nombre («Puerta norte»)?
4. **Etiquetas 424 DNA:** ¿ya tienes algunas para probar la fase 2, o hay que
   comprarlas? Se consiguen por unidad en tiendas de NFC.

## Orden propuesto

1. **Fase 1 en el servidor:** la tabla, el sobre, las reglas, la API, el
   contrato 0.35.0 y la parte del expediente.
2. **Fase 1 en Android:** leer la etiqueta en modo personal y registrar
   etiquetas.
3. **Fase 1 en el portal:** las etiquetas en Dispositivos, el conteo en
   Configuración y la evidencia en Marcajes.
4. **Prueba con una etiqueta Classic real** en la Sede Piloto NFC.
5. **Fase 2:** NTAG 424 DNA con SUN y el veredicto `site_tag`.
