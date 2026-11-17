# QA en el ambiente publicado: terminal, tarjeta y teléfono personal, 16 de noviembre de 2026

Partes 7 y 8 de la [guía de demostración](guia-de-demostracion.md) con el
teléfono y una tarjeta física, en <https://zenit.fastsolution.com.mx>, con la
empresa ficticia Distribuidora Altiplano. `main` en `97150ea` (PR #74), sin
desplegar todavía: el ambiente corría lo anterior.

## Entorno

| Qué | Valor |
| --- | --- |
| Teléfono | Samsung SM-S928B, manejado por ADB; la app instalada el 14 de noviembre (0.1.0, debug) |
| Estado inicial del teléfono | Vinculado desde el 14 de noviembre como terminal de Matriz Centro, con la sesión de captura vigente |
| Portal | Chrome con la sesión de Administración (Mariana Ortiz) que abrió Alexis |
| Tarjeta | Una MIFARE Classic 1K, que Alexis acercó al teléfono |

## Recorrido

| Paso | Resultado |
| --- | --- |
| Preparar la tarjeta en la terminal | «Tarjeta ZC-E0D0B451 preparada y en inventario»: el servidor firmó el código y la terminal lo escribió |
| Marcar con la tarjeta sin asignar (10:13) | Rechazado: «La tarjeta no tiene titular» (`card_unknown`). El recibo llegó al momento, sin pendientes |
| Asignarla en el portal | La asignó Alexis; quedó a nombre de Óscar Mendoza (0115, Bodega Norte) |
| Marcar con la tarjeta asignada (10:16) | Aceptado: «Óscar Mendoza · Entrada · Requiere revisión». En Asistencia, «En turno 10:16» con «Marcó en otra sede», porque la terminal es de Matriz Centro |
| Cerrar la semana del 7 al 13 de noviembre | La ventana anunció 15 por cerrar y 2 bloqueadas; la corrida terminó con 14 cerradas de 17 y 3 bloqueadas. La tercera, Diego Castañeda, por un tramo abierto el viernes 13, que la corrida detecta al cerrar, como avisa la ventana |
| Generar el código de teléfono personal de Ana Torres | «Activar lector» → Teléfono personal → Ana Torres: código de un solo uso con vencimiento a 15 minutos |
| Cambiar la vinculación del teléfono | «Cambiar vinculación» → «Continuar con un código nuevo» → el código → «Vincular teléfono». El teléfono pasó de terminal a personal y aparece «Mi semana» |

## Continuación, 17 de noviembre

Con el teléfono otra vez en ADB, todavía vinculado como teléfono personal de
Ana Torres:

| Paso | Resultado |
| --- | --- |
| Mi semana → 7 nov – 13 nov | «Semana cerrada», 8 h 0 min, 1 día con registros, 0 incidencias, y «Revisión del cierre» con «Responder al cierre» |
| Responder al cierre (16:00) | La revisión previa pide marcar «He revisado las jornadas y los totales» antes de habilitar las respuestas; «Confirmar respuesta» dice «Versión 1 · Estoy conforme». Al enviar: «Respuesta registrada · Se registró la conformidad con el cierre · 17 nov 2026 · 16:00» |
| Recargar la semana | La respuesta sigue ahí: la trae el servidor en `/me/attendance`, no un recibo local. La app la manda con un POST directo a `/week-closures/{id}/acknowledgements`, sin cola |

Después, con la sesión de Administración (Mariana Ortiz) que abrió Alexis en
el Chrome del mismo teléfono, manejado por ADB y las herramientas de
desarrollo de Chrome:

| Paso | Resultado |
| --- | --- |
| Cierres semanales, 7 – 13 nov | «1 Conformes · 0 Con objeción · 13 Sin acuse»; Ana Torres (0101) aparece «Conforme» |
| Dispositivos y tarjetas | «Terminal · SM-S928B» seguía activo después del cambio de vinculación, junto a «Teléfono de Ana Torres». Se revocó con el motivo «QA 17 nov: el telefono se vinculo como personal de Ana Torres»: Activos pasó de 13 a 12 y Revocados de 0 a 1 |
| «Instala Zenit» en el teléfono | La invitación del portal salió sola después de entrar. «Instalar» → el diálogo de Chrome «Zenit · Control de asistencia» → Install. Quedó la app (`org.chromium.webapk.a938cfad3bbc27edb_v2`): abre el Panel sin barra del navegador (`display-mode: standalone`) y con la sesión vigente. En Mi perfil, «Zenit en este equipo · Ya está instalado» y el menú de la cuenta ya no ofrece instalar |

## Sin terminar

- La consola con la cuenta de operación: no se tuvo esa cuenta.

## Lo que se vio de paso

- **La guía asigna la tarjeta a Carlos Medina**, que no está en el padrón
  sembrado: se da de alta en vivo en la parte 6 (`0122`). Como esa parte no
  se hizo, la tarjeta se asignó a Óscar Mendoza, sembrado sin tarjeta.
- **Cambiar la vinculación de un teléfono deja activo el lector anterior.**
  El teléfono borra su clave vieja, pero el servidor no lo sabe: hay que
  revocarlo a mano en Dispositivos y tarjetas (se hizo el 17). Vale decirlo
  en la guía o revocarlo solo al vincular el mismo teléfono otra vez.
- **El teléfono de Ana Torres sale «Sin señal · sin señal todavía»** aunque
  consultó su semana y respondió al cierre. La última señal sólo se mueve al
  abrir sesión de captura o al marcar (`Devices.kt` `openSession`,
  `Capture.kt`); un teléfono personal que sólo consulta no la mueve y cuenta
  en «Sin señal más de 24 h».
- **Con la sesión cerrada, el menú de Chrome dice «This app cannot be
  installed»**: la pantalla de ingreso es de Keycloak (`/id/realms/zenit/…`)
  y no lleva el manifiesto. Se instala desde el portal, ya dentro.
- **La demostración quedó modificada**: semana cerrada, una tarjeta nueva
  asignada, el teléfono de Ana y su conformidad, y el lector de la terminal
  revocado. `demo.sh reiniciar` la deja como al principio. En el teléfono
  queda instalada la app del portal.
- **El inicio del teléfono personal dice «Aproxime su tarjeta al lector NFC
  del dispositivo»** (17 de noviembre). Con lo decidido el 12 de noviembre,
  un teléfono personal no lee tarjetas: marcará en la etiqueta de la sede,
  que todavía no existe. El texto se cambia cuando llegue esa pantalla.
