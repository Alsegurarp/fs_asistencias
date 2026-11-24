# Videos del portal

Clips cortos que muestran qué se puede hacer en el portal y cómo. Se graban
con Playwright a partir de un guion fijo (`deploy/servidor/demo/videos.mjs`):
cada corrida repite los mismos clics y tiempos, así que cuando cambie la
interfaz basta con volver a grabar. Todo corre en contenedores.

## Grabar

```bash
docker compose up --build                              # portal :8081, identidad :8082
bash deploy/servidor/demo/demo-local.sh reiniciar      # empresa de demostración
bash deploy/servidor/demo/videos.sh                    # graba los clips en MP4
```

Para regrabar sólo algunos: `DEMO_CLIPS=01-panel,05-personal bash deploy/servidor/demo/videos.sh`.
Los videos quedan en `output/video/portal/` en MP4 H.264. La primera vez se construye
la imagen `zenit-demo-videos` (`videos.Dockerfile`): Playwright 1.52 más Xvfb y ffmpeg.

## Sonido

Cada clip lleva voz, efectos y música de fondo, sin derechos de terceros
(`deploy/servidor/demo/audio.mjs` y `voz.py`):

- **Voz**: Piper, sin conexión, lee las tarjetas y las leyendas. Por omisión
  `es_MX-claude-high` (apache-2.0); `DEMO_VOZ=es_MX-ald-medium` (unlicense)
  usa la otra; `DEMO_VOZ=no` quita la voz. Las frases se sintetizan antes de
  grabar y quedan en caché en `output/video/portal/.audio/`. El ritmo del
  clip espera a que termine cada frase.
- **Efectos**: archivos propios en `output/video/portal/.audio/FX/`, uno por
  propósito (tabla `FX` de `audio.mjs`): `Click` en cada clic, `ZoomIn` en cada
  acercamiento, `TitleSound` en las tarjetas, `SomethingWrong` al señalar un
  problema y `Notification` en soluciones, cambios de pantalla y la tarjeta
  final. Si falta el clic o la tarjeta se usa uno sintetizado; si falta otro,
  ese momento queda sin efecto. `DEMO_EFECTOS=no` los quita.
- **Música**: si existe `output/video/portal/musica.mp3` se usa esa pista (por
  ejemplo, una de Pixabay Music, cuya licencia permite uso comercial sin
  atribución); si no, una pista suave sintetizada. Entra y sale con fundido y
  baja sola mientras habla la voz. `DEMO_MUSICA=no` la quita.
- Si el sonido se oye adelantado o atrasado respecto a la imagen, se ajusta
  con `DEMO_DESFASE_MS` (250 por omisión).

## Clips

| Clip | Contenido |
| --- | --- |
| `01-panel` | Resumen del día |
| `02-asistencia` | Semana del personal y ficha de una persona |
| `03-incidencias` | Lista y detalle de una incidencia abierta |
| `04-cierres` | Quién puede cerrarse y quién está bloqueado |
| `05-personal` | Personas, horarios e importación |
| `06-dispositivos` | Lectores y tarjetas |
| `07-reportes` | Nómina, bitácora y expediente |
| `08-telefono` | Panel y asistencia en pantalla de teléfono (390×844) |

## Cómo está hecho

- Entra una sola vez con la cuenta `admin_empresa` de `DEMO_SECRETOS`
  (contraseña y código), fuera de los videos; cada clip reutiliza la sesión.
- Sólo navega y consulta: no cierra semanas, no resuelve incidencias ni emite
  códigos. La demostración queda igual que antes de grabar.
- Calidad: no usa la grabación integrada de Playwright (VP8, baja calidad).
  Cada clip abre Chromium visible en su propia pantalla virtual (Xvfb) y
  ffmpeg la graba en H.264, CRF 18, 30 fps: 1920×1080 en escritorio (vista de
  1440×810 a escala 4/3) y 780×1688 en teléfono (390×844 a escala 2).
- Acercamiento: antes de cada clic, y al señalar algo, la vista se acerca al
  elemento escalando `#root` con CSS. El navegador vuelve a dibujar a esa
  escala, así que el texto no se pixela.
- Pantalla completa (como F11): sin pestañas ni barra de direcciones.
- Movimiento continuo: el cursor viaja cuadro por cuadro, el desplazamiento
  es suave y los cambios de pantalla son navegación de la app (sin recargar)
  con un fundido del contenido. No se graban pantallas de carga: se espera a
  que no quede ningún esqueleto ni indicador de progreso.
- Historia por clip: tarjeta con la pregunta del cliente, pasos con leyenda abajo y
  acercamiento a lo que importa, y tarjeta final con la dirección del portal.
  Se dibuja un cursor con onda en cada clic.
- Para agregar un clip: un bloque `await grabar('NN-nombre', async (p, llamar) => { ... })`
  con `tarjeta`, `ir`, `paso`, `resaltar`, `clic` y `recorrer`.
- `resaltar` usa selectores genéricos (primera fila, primer bloque, botón por
  nombre); si una pantalla no los tiene, el clip sigue sólo con la leyenda.
- Datos siempre ficticios: son los de la empresa de demostración.
