# QA Android: tarjetas del piloto, 10 de noviembre de 2026

Prueba física de las tarjetas MIFARE Classic del piloto
(`mifare_classic_signed`) contra el backend local, con datos ficticios.
Rama `feat/android-identificar-tarjeta`, contrato 0.30.0.

## Entorno

| Qué | Valor |
| --- | --- |
| Teléfono | Samsung SM-S928B, Android API 36, por ADB con `adb reverse tcp:18080` |
| App | APK debug de la rama |
| Backend | Local, `CAPTURE_PILOT_CARDS=true`, clave generada con `:backend:pilotCardKey` en `secrets/pilot_card_key` |
| Empresa | Zenit Demo (ficticia). Sede «Sede Piloto NFC», persona «Persona Piloto Uno» (`PIL-001`) y código de terminal creados directamente en la base local |
| Tarjeta | La entregada por Alexis: Classic 1K, identificador `A9C6CC10`, SAK 08 |

## Diagnóstico previo

`CardProbeActivity` (debug) leyó la tarjeta antes de prepararla: Classic 1K,
identificador de 4 bytes, claves de fábrica en los 16 sectores y bloque 0
`A9C6CC10B30804006263646566676869`. El final `bcdefghi` es típico de
tarjetas con identificador cambiable («mágicas»): se puede clonar.

## Recorrido

| Paso | Resultado |
| --- | --- |
| Activar el teléfono como terminal con el código | Activado; la sesión trae `pilotCards` y aparece «Preparar tarjetas» |
| Preparar la tarjeta | «Tarjeta ZC-CCBF0B5D preparada y en inventario». En la base: estado `inventory`, `key_version` 1, huella de 64 caracteres; bitácora `card.registered` a nombre del dispositivo |
| Asignarla a la persona | Hecho en la base local, con los mismos pasos que `POST /cards/{id}/assignments` (no había sesión del portal) |
| Marcar | `clock_in` aceptado con `card_scheme` `mifare_classic_signed`. Incidencia `location_inconclusive`, esperada: la sede ficticia no está donde está el teléfono |
| Marcar otra vez | `clock_out` aceptado |
| Perderla (revocar) | Hecho en la base local con los mismos pasos que la revocación con motivo `lost` |
| Marcar con la tarjeta perdida | Rechazado: `card_revoked`, «La tarjeta ya no está activa» |
| Leer con claves de fábrica | Sectores 1 y 2 ya no abren con las claves de fábrica, MAD ni NFC Forum; los demás siguen con la de fábrica y sin datos |

## Hallazgo corregido

Al sostener la tarjeta, Android la detecta otra vez y la app mandaba un
segundo marcaje segundos después. El servidor lo marcaba como `duplicate`,
pero era ruido para Supervisión. La app ahora ignora la misma tarjeta
durante 60 segundos, la misma ventana que el servidor usa para duplicados,
y lo dice en pantalla («Esta tarjeta ya se leyó hace un momento»). Los
marcajes de prueba anteriores al cambio quedaron en la base local con su
incidencia `duplicate`.

## Lo que no cubre

- Asignar y revocar desde el portal: se hizo en la base local por no tener
  sesión de administración con segundo factor en este momento.
- El ambiente publicado: no tiene la clave ni el interruptor del piloto y no
  se desplegó.
- La versión release en el teléfono: se compiló, pero no se instaló.
- Un teléfono sin soporte MIFARE Classic (algunos chips no lo tienen): la app
  rechaza la tarjeta con un mensaje, pero no se probó en uno así.
- Clonar la tarjeta: es el riesgo aceptado, no se intentó.
