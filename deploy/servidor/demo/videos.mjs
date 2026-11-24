// Graba videos cortos del portal que cuentan, desde el lado del cliente, qué
// problema resuelve cada pantalla. Cada clip es un recorrido fijo: se repite
// igual cada vez que se corre, así que cuando cambie la interfaz basta con
// volver a grabar.
//
// Cómo se ve:
// - Calidad: no usa la grabación de Playwright (VP8 de baja calidad). Cada
//   clip abre Chromium visible en su propia pantalla virtual (Xvfb), a
//   pantalla completa como con F11, y ffmpeg la graba en H.264 (1920×1080 a
//   30 fps en escritorio, 780×1688 en teléfono).
// - Movimiento continuo: el cursor viaja con aceleración, la vista se acerca
//   a lo que importa, el desplazamiento es suave y los cambios de pantalla
//   son navegación de la app (sin recargar), con un fundido del contenido.
// - Sin pantallas de carga: tras cada cambio se espera a que no quede ningún
//   esqueleto ni indicador de progreso antes de mostrar el contenido.
// - Sonido (audio.mjs): voz que lee tarjetas y leyendas (Piper, sin conexión),
//   efectos en clics, acercamientos, cambios de pantalla y tarjetas, y música
//   de fondo que baja mientras se habla. Todo sin derechos de terceros: los
//   efectos y la música de respaldo se sintetizan; una pista propia se pone
//   como musica.mp3 en la carpeta de los videos.
//
// Correr con «videos.sh» después de «demo-local.sh reiniciar» (o «demo.sh
// reiniciar» en el servidor): muestra la empresa recién sembrada. Sólo
// navega y consulta: no cierra semanas, no resuelve incidencias ni emite
// códigos, así que la demostración queda igual que antes de grabar.
//
// Variables:
//   DEMO_VIDEOS  carpeta de salida (por omisión /videos)
//   DEMO_CLIPS   lista separada por comas para grabar sólo algunos (01-panel,03-incidencias)
//   DEMO_PUENTE  si se define, reenvía localhost:8081 y :8082 del contenedor a ese destino
//   DEMO_VOZ     modelo de Piper (es_MX-claude-high por omisión, es_MX-ald-medium) o «no»
//   DEMO_MUSICA  ruta de la pista de fondo, o «no»; por omisión la primera de .audio/Musica/,
//                luego musica.mp3 de la carpeta y, si no hay ninguna, la sintetizada
//   DEMO_MUSICA_VOLUMEN  volumen de la música, de 0 a 1 (0.08 por omisión: acompaña sin llamar la atención)
//   DEMO_EFECTOS «no» para quitar los efectos
//   DEMO_DESFASE_MS  retraso del primer cuadro de ffmpeg, para alinear el sonido (250 por omisión)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import net from 'node:net';
import { chromium } from 'playwright';
import { Voz, mezclar, prepararSonidos } from './audio.mjs';
import { PORTAL, ZONA, api, codigo, cuentas, dormir, navegador, sesion } from './comun.mjs';

const CARPETA = (process.env.DEMO_VIDEOS || '/videos').replace(/\/$/, '');
const SOLO = (process.env.DEMO_CLIPS || '').split(',').map((s) => s.trim()).filter(Boolean);
const FPS = 30;
const PAUSA = 700;

// ---------------------------------------------------------------- sonido

const SONIDOS = `${CARPETA}/.audio`;
const MODELO = process.env.DEMO_VOZ || 'es_MX-claude-high';
const voz = MODELO === 'no' ? null : new Voz(`/opt/voces/${MODELO}.onnx`, `${SONIDOS}/voz-${MODELO}`);
function musicaPropia() {
  const carpeta = `${SONIDOS}/Musica`;
  const pista = existsSync(carpeta) && readdirSync(carpeta).filter((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f)).sort()[0];
  if (pista) return `${carpeta}/${pista}`;
  return existsSync(`${CARPETA}/musica.mp3`) ? `${CARPETA}/musica.mp3` : null;
}
const MUSICA = process.env.DEMO_MUSICA === 'no' ? null : process.env.DEMO_MUSICA || musicaPropia() || `${SONIDOS}/fondo.wav`;
const VOLUMEN_MUSICA = Number(process.env.DEMO_MUSICA_VOLUMEN || 0.08);
const EFECTOS = process.env.DEMO_EFECTOS !== 'no';
const DESFASE = Number(process.env.DEMO_DESFASE_MS || 250);

// Lo que pasa en el clip, con su instante: se usa para poner el sonido.
let linea = null;
let t0 = 0;
const marcar = (tipo, extra = {}) => { if (linea) linea.push({ t: (Date.now() - t0) / 1000, tipo, ...extra }); };

/** Lo que dice la voz en una tarjeta. */
const dicho = (titulo, subtitulo) => [titulo, subtitulo].filter(Boolean).map((x) => (/[.?!]$/.test(x) ? x : `${x}.`)).join(' ');

/** Dice la frase (si hay voz) y devuelve cuánto dura, en milisegundos. */
async function hablar(texto) {
  if (!voz || !texto) return 0;
  const { archivo, duracion } = await voz.decir(texto);
  marcar('voz', { archivo });
  return duracion * 1000;
}

// Dentro de un contenedor «localhost» es el propio contenedor: el mismo puente
// que puente.mjs, aquí para que este guion no dependa de otro proceso.
if (process.env.DEMO_PUENTE) {
  for (const puerto of [8081, 8082]) {
    net.createServer((entrada) => {
      const salida = net.connect(puerto, process.env.DEMO_PUENTE);
      entrada.pipe(salida).pipe(entrada);
      entrada.on('error', () => salida.destroy());
      salida.on('error', () => entrada.destroy());
    }).listen(puerto, '127.0.0.1');
  }
  await dormir(500);
}

// ---------------------------------------------------------------- en la página

// Cursor visible y onda en cada clic: la pantalla virtual no dibuja el ratón.
const CURSOR = () => {
  if (window !== window.top) return;
  const montar = () => {
    const c = document.createElement('div');
    Object.assign(c.style, {
      position: 'fixed', left: '-100px', top: '-100px', width: '24px', height: '24px', marginLeft: '-12px', marginTop: '-12px',
      borderRadius: '50%', background: 'rgba(255,193,7,.55)', border: '2px solid #fff', boxShadow: '0 1px 6px rgba(0,0,0,.35)',
      zIndex: '2147483647', pointerEvents: 'none', transition: 'transform .12s',
    });
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; }, true);
    addEventListener('mousedown', (e) => {
      c.style.transform = 'scale(.7)';
      const o = document.createElement('div');
      Object.assign(o.style, {
        position: 'fixed', left: `${e.clientX - 22}px`, top: `${e.clientY - 22}px`, width: '44px', height: '44px', borderRadius: '50%',
        border: '3px solid rgba(255,193,7,.9)', zIndex: '2147483646', pointerEvents: 'none', transition: 'transform .5s ease-out, opacity .5s ease-out',
      });
      document.body.appendChild(o);
      requestAnimationFrame(() => { o.style.transform = 'scale(1.9)'; o.style.opacity = '0'; });
      setTimeout(() => o.remove(), 550);
    }, true);
    addEventListener('mouseup', () => { c.style.transform = ''; }, true);
  };
  if (document.body) montar(); else addEventListener('DOMContentLoaded', montar);
};

const vista = (pagina) => pagina.evaluate(() => ({ width: innerWidth, height: innerHeight }));

/** Pantalla de título: la pregunta del cliente y la respuesta corta. */
async function tarjeta(pagina, titulo, subtitulo = '', ms = 3000, texto = dicho(titulo, subtitulo), sonido = 'tarjeta') {
  marcar(sonido);
  await pagina.evaluate(({ titulo, subtitulo }) => {
    document.getElementById('demo-leyenda')?.remove();
    const t = document.createElement('div');
    t.id = 'demo-tarjeta';
    const chico = innerWidth < 600;
    t.innerHTML = `<div style="font:700 ${chico ? 30 : 46}px/1.2 Inter,system-ui,sans-serif;max-width:${chico ? 92 : 70}%">${titulo}</div>`
      + `<div style="font:400 ${chico ? 18 : 24}px/1.4 Inter,system-ui,sans-serif;opacity:.85;margin-top:18px;max-width:${chico ? 92 : 70}%">${subtitulo}</div>`;
    Object.assign(t.style, {
      position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      background: 'rgba(16,38,77,.95)', color: '#fff', zIndex: '2147483645', opacity: '0', transition: 'opacity .5s',
    });
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
  }, { titulo, subtitulo });
  await dormir(450);
  const habla = await hablar(texto);
  await dormir(Math.max(ms - 450, habla + 700));
  await pagina.evaluate(() => { const t = document.getElementById('demo-tarjeta'); if (t) { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); } });
  await dormir(600);
}

/** Leyenda abajo: lo que se ve, en palabras del cliente. Entra y sale con fundido. */
async function paso(pagina, texto, sonido) {
  if (sonido) marcar(sonido);
  await pagina.evaluate((texto) => {
    let l = document.getElementById('demo-leyenda');
    if (!l) {
      l = document.createElement('div');
      l.id = 'demo-leyenda';
      const chico = innerWidth < 600;
      Object.assign(l.style, {
        position: 'fixed', left: '50%', bottom: chico ? '22px' : '32px', transform: 'translateX(-50%) translateY(8px)', maxWidth: '86%',
        padding: chico ? '10px 16px' : '14px 26px', borderRadius: '14px', background: 'rgba(16,38,77,.93)', color: '#fff',
        font: `500 ${chico ? 16 : 22}px/1.35 Inter,system-ui,sans-serif`, textAlign: 'center', zIndex: '2147483644', pointerEvents: 'none',
        boxShadow: '0 8px 28px rgba(0,0,0,.28)', opacity: '0', transition: 'opacity .35s, transform .35s',
      });
      document.body.appendChild(l);
    }
    l.style.opacity = '0';
    setTimeout(() => {
      l.textContent = texto;
      l.style.opacity = '1';
      l.style.transform = 'translateX(-50%) translateY(0)';
    }, l.textContent ? 250 : 0);
  }, texto);
  const habla = await hablar(texto);
  await dormir(Math.max(2600, texto.length * 60 * (voz ? 0 : 1), habla + 650));
}

async function sinLeyenda(pagina) {
  await pagina.evaluate(() => { const l = document.getElementById('demo-leyenda'); if (l) { l.style.opacity = '0'; setTimeout(() => l.remove(), 350); } }).catch(() => {});
}

/** Espera a que la pantalla esté lista: red quieta y sin esqueletos ni indicadores de progreso. */
async function listo(pagina) {
  await pagina.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await pagina.waitForFunction(() => !document.querySelector('.MuiSkeleton-root, .MuiCircularProgress-root, .MuiLinearProgress-root, [role="progressbar"]'),
    null, { timeout: 10000, polling: 100 }).catch(() => {});
  await dormir(250);
}

/** Fundido del contenido (no del menú): el cambio de pantalla se ve como transición, no como corte. */
async function fundido(pagina, opacidad) {
  if (opacidad === 0) marcar('cambio');
  await pagina.evaluate((o) => {
    const el = document.getElementById('contenido') || document.getElementById('root');
    if (!el) return;
    el.style.transition = 'opacity .3s ease';
    el.style.opacity = String(o);
  }, opacidad).catch(() => {});
  await dormir(320);
}

// ------------------------------------------------------------ cursor y zoom

let raton = { x: 0, y: 0 };
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Mueve el cursor cuadro por cuadro, con aceleración: se ve el trayecto. */
async function mover(pagina, x, y) {
  const desde = { ...raton };
  const distancia = Math.hypot(x - desde.x, y - desde.y);
  const ms = Math.min(1100, Math.max(350, distancia * 0.9));
  const cuadros = Math.round(ms / 16);
  for (let i = 1; i <= cuadros; i++) {
    const t = suave(i / cuadros);
    await pagina.mouse.move(desde.x + (x - desde.x) * t, desde.y + (y - desde.y) * t);
    await dormir(16);
  }
  raton = { x, y };
}

async function apuntar(pagina, el) {
  const caja = await el.boundingBox();
  if (!caja) throw new Error('No se encontró el elemento.');
  await mover(pagina, caja.x + caja.width / 2, caja.y + Math.min(caja.height / 2, 40));
}

/**
 * Acerca la vista hacia el elemento: escala la raíz de la app (#root) y la
 * desplaza para dejarlo al centro. Leyendas, tarjetas y cursor quedan fuera
 * de #root y no se escalan. El navegador vuelve a dibujar a esa escala, así
 * que el texto no se pixela. `soltar` regresa a la vista normal.
 */
async function enfocar(pagina, el, escala = 1.8) {
  const caja = await el.boundingBox().catch(() => null);
  if (!caja) return false;
  marcar('zoom');
  await pagina.evaluate(({ caja, escala }) => {
    const raiz = document.getElementById('root');
    if (!raiz) return;
    const W = innerWidth, H = innerHeight;
    // Que el elemento quepa con margen; nunca menos que la vista normal.
    const s = Math.max(1.15, Math.min(escala, W / (caja.width * 1.2), H / (caja.height * 1.35)));
    const cx = caja.x + caja.width / 2 + scrollX, cy = caja.y + caja.height / 2 + scrollY;
    let tx = W / 2 + scrollX - s * cx, ty = H * 0.45 + scrollY - s * cy;
    // Sin bordes vacíos: la raíz escalada sigue cubriendo toda la pantalla.
    tx = Math.min(scrollX, Math.max(W + scrollX - s * raiz.offsetWidth, tx));
    ty = Math.min(scrollY, Math.max(H + scrollY - s * raiz.offsetHeight, ty));
    raiz.style.transformOrigin = '0 0';
    raiz.style.transition = 'transform .9s cubic-bezier(.65,0,.35,1)';
    raiz.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }, { caja, escala }).catch(() => {});
  await dormir(950);
  return true;
}

async function soltar(pagina) {
  await pagina.evaluate(() => { const r = document.getElementById('root'); if (r) r.style.transform = ''; }).catch(() => {});
  await dormir(950);
}

const localizar = (pagina, objetivo) => (typeof objetivo === 'string' ? pagina.locator(objetivo) : objetivo).first();
const visible = (el, ms = 4000) => el.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);

/**
 * Lleva el cursor al elemento, acerca la vista, hace clic y regresa.
 * `navega`: el clic cambia de pantalla; el contenido se funde mientras carga.
 */
async function clic(pagina, objetivo, { zoom = 1.6, navega = false } = {}) {
  const el = localizar(pagina, objetivo);
  await el.scrollIntoViewIfNeeded();
  await apuntar(pagina, el);
  await dormir(200);
  const acercado = zoom > 1 && await enfocar(pagina, el, zoom);
  // Al acercar, el elemento cambia de lugar en pantalla: el cursor lo sigue.
  if (acercado) await apuntar(pagina, el);
  await dormir(300);
  marcar('clic');
  await el.click();
  if (navega) {
    await dormir(150);
    await fundido(pagina, 0);
    if (acercado) await pagina.evaluate(() => { const r = document.getElementById('root'); if (r) { r.style.transition = 'none'; r.style.transform = ''; } }).catch(() => {});
    await listo(pagina);
    await fundido(pagina, 1);
  } else {
    await dormir(PAUSA);
    if (acercado) await soltar(pagina);
    await listo(pagina);
  }
}

/** Señala algo sin tocarlo: acerca la vista, explica y regresa. Si no aparece, sólo explica. */
async function resaltar(pagina, objetivo, texto, escala = 1.8, sonido) {
  const el = localizar(pagina, objetivo);
  if (!await visible(el)) return paso(pagina, texto, sonido);
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await apuntar(pagina, el).catch(() => {});
  const acercado = await enfocar(pagina, el, escala);
  await paso(pagina, texto, sonido);
  if (acercado) await soltar(pagina);
}

/** Cambia de pantalla como lo haría la app (sin recargar), con fundido. */
async function navegar(pagina, ruta) {
  await sinLeyenda(pagina);
  await fundido(pagina, 0);
  await pagina.evaluate((ruta) => {
    const idx = (history.state && typeof history.state.idx === 'number' ? history.state.idx : 0) + 1;
    history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx }, '', ruta);
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }, ruta);
  await listo(pagina);
  await fundido(pagina, 1);
}

/** Va a una pantalla: con clic en el menú si la opción está visible; si no, navegando dentro de la app. */
async function ir(pagina, ruta, menu) {
  await sinLeyenda(pagina);
  const enlace = menu ? pagina.getByRole('link', { name: menu, exact: true }).first() : null;
  if (enlace && !ruta.includes('?') && await visible(enlace, 1500)) await clic(pagina, enlace, { zoom: 1.35, navega: true });
  else await navegar(pagina, ruta);
}

/** Abre el renglón de una persona (o lo que diga `texto`); si no está, navega a `respaldo`. */
async function abrir(pagina, texto, respaldo) {
  await sinLeyenda(pagina);
  const el = pagina.locator('main').getByText(texto, { exact: false }).first();
  if (await visible(el, 3000)) await clic(pagina, el, { zoom: 1.7 });
  else if (respaldo) await navegar(pagina, respaldo);
}

/** Desplaza el contenido poco a poco y regresa. */
async function recorrer(pagina, veces = 3) {
  const { width, height } = await vista(pagina);
  await mover(pagina, width * 0.62, height * 0.55);
  for (let i = 0; i < veces * 14; i++) { await pagina.mouse.wheel(0, 22); await dormir(28); }
  await dormir(900);
  for (let i = 0; i < veces * 14; i++) { await pagina.mouse.wheel(0, -22); await dormir(18); }
  await dormir(500);
}

// ---------------------------------------------------------- grabación

// Una sola entrada con contraseña y código, fuera de los videos; cada clip
// reutiliza esa sesión de identidad.
mkdirSync(CARPETA, { recursive: true });
prepararSonidos(SONIDOS);

// La voz se sintetiza antes de grabar, para que no haya pausas en el video:
// se toman del propio guion los textos de tarjetas y leyendas. Lo que no
// aparezca aquí se sintetiza en el momento (y queda en caché para la próxima).
const CIERRE = 'Zenit. Control de asistencia para tu empresa.';
if (voz) {
  const fuente = readFileSync(new URL(import.meta.url), 'utf8');
  const frases = new Set([CIERRE]);
  for (const m of fuente.matchAll(/^\s*await tarjeta\(p, '([^']+)'(?:, '([^']*)')?/gm)) frases.add(dicho(m[1], m[2]));
  for (const renglon of fuente.split('\n')) {
    if (!/^\s*await (paso|resaltar)\(p,/.test(renglon)) continue;
    const textos = [...renglon.matchAll(/'([^']{12,})'/g)].map((m) => m[1]);
    if (textos.length) frases.add(textos.at(-1));
  }
  console.log(`voz: ${frases.size} frases con ${MODELO}`);
  for (const f of frases) await voz.decir(f);
}
const c = cuentas();
const entrador = await navegador();
const entrada = await sesion(entrador, c.admin_empresa, { ruta: '/panel' });
const estado = await entrada.contexto.storageState();
await entrador.close();

// La semana sembrada (la de ayer), no la que está en curso.
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(Date.now() - 86400000));

let siguientePantalla = 90;

/** Una pantalla virtual propia para el clip, del tamaño exacto del video. */
async function pantalla(ancho, alto) {
  const n = siguientePantalla++;
  const x = spawn('Xvfb', [`:${n}`, '-screen', '0', `${ancho}x${alto}x24`, '-nolisten', 'tcp', '-ac'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !existsSync(`/tmp/.X11-unix/X${n}`); i++) await dormir(100);
  if (!existsSync(`/tmp/.X11-unix/X${n}`)) throw new Error('Xvfb no arrancó: ¿se construyó videos.Dockerfile?');
  return { display: `:${n}`, cerrar: () => x.kill() };
}

/** Graba la pantalla en H.264; devuelve la función que detiene y cierra el archivo. */
function grabadora(display, ancho, alto, archivo) {
  const f = spawn('ffmpeg', [
    '-loglevel', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', String(FPS),
    '-video_size', `${ancho}x${alto}`, '-i', `${display}.0+0,0`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', archivo,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  // «q» le pide a ffmpeg terminar limpio, con el MP4 completo.
  return () => new Promise((hecho) => { f.on('close', hecho); f.stdin.write('q'); f.stdin.end(); });
}

/**
 * ¿Sigue en pantalla el aviso de Chrome «Para salir de la pantalla completa,
 * mantén presionada Esc»? Ese aviso es del navegador, no de la página: se
 * compara la franja de arriba de la pantalla virtual con la misma franja de
 * la página; si difieren, el aviso sigue ahí.
 */
async function avisoVisible(pagina, display, escala) {
  const { width } = await vista(pagina);
  const w = Math.min(640, width), x = Math.floor((width - w) / 2), h = 120;
  const W = Math.round(w * escala) & ~1, H = Math.round(h * escala) & ~1, X = Math.round(x * escala);
  const png = await pagina.screenshot({ clip: { x, y: 0, width: w, height: h } }).catch(() => null);
  if (!png) return false;
  const gris = ['-f', 'rawvideo', '-pix_fmt', 'gray', '-'];
  const real = spawnSync('ffmpeg', ['-v', 'error', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', `${W}x${H}`, '-i', `${display}.0+${X},0`, '-frames:v', '1', ...gris], { maxBuffer: 1 << 26 }).stdout;
  const esperado = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `scale=${W}:${H}`, '-frames:v', '1', ...gris], { input: png, maxBuffer: 1 << 26 }).stdout;
  if (!real?.length || real.length !== esperado?.length) return false;
  let suma = 0;
  for (let i = 0; i < real.length; i++) suma += Math.abs(real[i] - esperado[i]);
  return suma / real.length > 4;
}

/** Espera a que se vaya el aviso de pantalla completa (dos lecturas limpias seguidas). */
async function sinAviso(pagina, display, escala, desde) {
  // Chrome lo muestra unos 3.5 s; antes de eso ni se mide.
  await dormir(Math.max(0, 3800 - (Date.now() - desde)));
  let limpias = 0;
  for (let i = 0; i < 30 && limpias < 2; i++) {
    limpias = (await avisoVisible(pagina, display, escala)) ? 0 : limpias + 1;
    if (limpias < 2) await dormir(350);
  }
  if (limpias < 2) console.log('   aviso de pantalla completa: no se confirmó que se fuera; se graba de todos modos');
}

// Chrome no deja su ventana más angosta que unos 500 puntos: para el teléfono
// la ventana se abre más ancha y la vista de la página se fija al tamaño del
// teléfono, arriba a la izquierda; sólo esa parte se graba.
const VENTANA_MINIMA = 1100;

/**
 * Graba un clip. `ancho` y `alto` son la vista en puntos CSS; `escala`, la
 * densidad: el video mide ancho×escala por alto×escala. `movil`: la vista se
 * fija a ese tamaño (teléfono) en lugar de ocupar toda la ventana.
 */
async function grabar(nombre, guion, { ancho = 1440, alto = 810, escala = 4 / 3, movil = false } = {}) {
  if (SOLO.length && !SOLO.includes(nombre)) return;
  console.log(`grabando ${nombre}`);
  const W = Math.round(ancho * escala), H = Math.round(alto * escala);
  const anchoVentana = movil ? Math.max(ancho, VENTANA_MINIMA) : ancho;
  const x = await pantalla(Math.round(anchoVentana * escala), H);
  const nav = await chromium.launch({
    headless: false,
    env: { ...process.env, DISPLAY: x.display },
    // Sin la barra de «Chrome está siendo controlado por software automatizado».
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--start-fullscreen', '--window-position=0,0', `--window-size=${anchoVentana},${alto}`, `--force-device-scale-factor=${escala}`,
      '--hide-scrollbars', '--disable-infobars', '--no-first-run', '--disable-gpu', '--disable-features=Translate'],
  });
  const contexto = await nav.newContext({
    ...(movil ? { viewport: { width: ancho, height: alto }, deviceScaleFactor: escala } : { viewport: null }),
    locale: 'es-MX', timezoneId: ZONA, storageState: estado,
  });
  await contexto.addInitScript(CURSOR);
  const pagina = await contexto.newPage();
  // Pantalla completa, como F11: sin pestañas ni barra de direcciones.
  const cdp = await contexto.newCDPSession(pagina);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  const completa = Date.now();
  let token = null;
  pagina.on('response', async (r) => {
    if (r.url().includes('/protocol/openid-connect/token') && r.ok()) {
      try { token = (await r.json()).access_token; } catch { /* sin cuerpo */ }
    }
  });
  let parar = null;
  try {
    await pagina.goto(PORTAL + '/panel', { waitUntil: 'domcontentloaded' });
    // Si identidad vuelve a pedir la contraseña, se entra antes de grabar.
    if (await pagina.locator('#username').isVisible({ timeout: 4000 }).catch(() => false)) {
      await pagina.fill('#username', c.admin_empresa.correo);
      await pagina.fill('#password', c.admin_empresa.clave);
      await pagina.click('#kc-login');
      await pagina.waitForSelector('#otp', { timeout: 30000 });
      await dormir(30000 - (Date.now() % 30000) + 500);
      await pagina.fill('#otp', codigo(c.admin_empresa.otp));
      await pagina.click('#kc-login');
    }
    await pagina.waitForURL((u) => u.origin === PORTAL && !u.pathname.startsWith('/id/'), { timeout: 30000 });
    for (let i = 0; i < 40 && !token; i++) await dormir(250);
    await listo(pagina);
    await dormir(800);
    const { width, height } = await vista(pagina);
    raton = { x: width * 0.6, y: height * 0.5 };
    await pagina.mouse.move(raton.x, raton.y);
    await sinAviso(pagina, x.display, escala, completa);
    // La grabación empieza con el portal ya cargado, a pantalla completa y sin el aviso de Chrome.
    linea = [];
    parar = grabadora(x.display, W, H, `${CARPETA}/${nombre}.video.mp4`);
    t0 = Date.now() + DESFASE;
    await dormir(300);
    await guion(pagina, api(() => token));
    await sinLeyenda(pagina);
    await tarjeta(pagina, 'Zenit', 'Control de asistencia para tu empresa · zenit.fastsolution.com.mx', 2600, CIERRE, 'cierre');
    await dormir(800);
  } finally {
    if (parar) await parar();
    await nav.close();
    x.cerrar();
  }
  const eventos = linea;
  linea = null;
  mezclar({
    video: `${CARPETA}/${nombre}.video.mp4`, salida: `${CARPETA}/${nombre}.mp4`, eventos,
    dirSonidos: SONIDOS, musica: MUSICA, volumenMusica: VOLUMEN_MUSICA, conEfectos: EFECTOS, conVoz: !!voz,
  });
}

// ---------------------------------------------------------------- clips

// Lo que se suele señalar en cada pantalla. Si no aparece, el clip sigue con la leyenda.
const FILA = 'main tbody tr, main [role="row"]:nth-child(2)';
const BLOQUE = 'main .MuiCard-root, main .MuiPaper-root';
const DETALLE = (p) => p.locator('section[aria-labelledby]').filter({ has: p.getByRole('button', { name: 'Volver a la lista' }) });
const boton = (p, nombre) => p.locator('main').getByRole('button', { name: nombre });
const semanaAnterior = (p) => p.locator('main').getByRole('button', { name: /anterior/i });

// Cada clip parte de una pregunta del cliente, la resuelve en la pantalla y
// cierra con el beneficio.

await grabar('01-panel', async (p) => {
  await tarjeta(p, '¿Quién llegó hoy y quién no?', 'Sin llamar a cada sede ni esperar al corte de la quincena');
  await resaltar(p, BLOQUE, 'Al abrir Zenit ves la asistencia del día de toda tu empresa.');
  await recorrer(p);
  await paso(p, 'Lo que necesita tu atención aparece primero.', 'aviso');
});

await grabar('02-asistencia', async (p, llamar) => {
  await tarjeta(p, '¿Cuántas horas trabajó de verdad cada persona?', 'Zenit calcula la semana por ti');
  await ir(p, '/asistencia', 'Asistencia');
  if (await visible(semanaAnterior(p), 2000)) await clic(p, semanaAnterior(p), { zoom: 1.6 });
  else await navegar(p, `/asistencia?semana=${dia}`);
  await resaltar(p, FILA, 'Entradas, salidas y minutos de cada día, ya calculados.');
  const personas = await llamar('GET', '/employees?limit=50').catch(() => ({ items: [] }));
  const jorge = personas.items.find((x) => x.displayName === 'Jorge Ramírez');
  await abrir(p, 'Jorge Ramírez', jorge && `/asistencia?semana=${dia}&persona=${jorge.id}`);
  await resaltar(p, DETALLE(p), 'Jorge se quedó más tiempo: Zenit separa el tiempo extra para que nómina lo pague bien.', 1.5, 'aviso');
});

await grabar('03-incidencias', async (p, llamar) => {
  await tarjeta(p, '¿Tu empleado marcó en otra de tus sedes?', 'Nada se pierde');
  await ir(p, '/incidencias?vista=lista');
  await resaltar(p, FILA, 'Cada marcaje fuera de lugar queda registrado como incidencia.', 1.8, 'problema');
  const abiertas = await llamar('GET', '/incidents?status=open&limit=50').catch(() => ({ items: [] }));
  const de = (tipo) => abiertas.items.find((i) => i.type === tipo);
  await abrir(p, 'Andrea Lozano', de('foreign_site') && `/incidencias?vista=lista&incidencia=${de('foreign_site').id}`);
  await resaltar(p, DETALLE(p), 'Andrea marcó fuera de su sede: ves dónde, cuándo y con qué dispositivo.', 1.5);
  await paso(p, 'Tú decides si se justifica o se corrige, y el motivo queda registrado.', 'aviso');

  await tarjeta(p, '¿Alguien olvidó marcar su salida?', 'Zenit te avisa antes de cerrar la semana', 2600);
  await abrir(p, 'Diego Castañeda', de('missing_pair') && `/incidencias?vista=lista&incidencia=${de('missing_pair').id}`);
  await resaltar(p, DETALLE(p), 'A Diego le falta la salida: se corrige con la hora real, sin borrar lo que marcó.', 1.5, 'problema');
});

await grabar('04-cierres', async (p) => {
  await tarjeta(p, '¿Mandas a nómina horas con errores?', 'En Zenit sólo se cierra lo que está en orden');
  await ir(p, '/cierres', 'Cierres');
  if (await visible(semanaAnterior(p), 2000)) await clic(p, semanaAnterior(p), { zoom: 1.6 });
  else await navegar(p, `/cierres?semana=${dia}`);
  await resaltar(p, FILA, 'Quien tiene incidencias abiertas queda bloqueado hasta resolverlas.', 1.8, 'problema');
  await resaltar(p, boton(p, /cerrar/i), 'Lo demás se cierra con un clic, y cada empleado confirma su semana.', 1.8, 'aviso');
});

await grabar('05-personal', async (p) => {
  await tarjeta(p, '¿Dar de alta a 50 personas una por una?', 'Súbelas desde un archivo');
  await ir(p, '/personal', 'Personas');
  await resaltar(p, FILA, 'Tu personal, con su sede, su horario y su estado.');
  await ir(p, '/personal/horarios', 'Horarios');
  await resaltar(p, FILA, 'Los horarios se crean una vez y se asignan a quien corresponda.');
  await ir(p, '/personal/importaciones', 'Importaciones');
  await resaltar(p, boton(p, /importar|archivo/i), 'El archivo se revisa fila por fila antes de aplicarse: nada entra con errores.', 1.8, 'aviso');
});

await grabar('06-dispositivos', async (p) => {
  await tarjeta(p, '¿Cómo marcan tus empleados?', 'Con tarjeta en el lector de la sede o desde su teléfono');
  await ir(p, '/dispositivos', 'Lectores');
  await resaltar(p, FILA, 'Cada sede tiene su lector, y quien trabaja fuera usa su teléfono.');
  await ir(p, '/dispositivos/tarjetas', 'Tarjetas');
  await resaltar(p, FILA, 'Cada tarjeta está asignada a una persona, desde una fecha.');
});

await grabar('07-reportes', async (p) => {
  await tarjeta(p, '¿Te piden comprobar la asistencia?', 'Todo queda registrado y se puede verificar');
  await ir(p, '/reportes/nomina', 'Nómina');
  await paso(p, 'El reporte para nómina sale de las semanas cerradas, sin capturar nada a mano.');
  await ir(p, '/reportes/bitacora', 'Bitácora');
  await resaltar(p, FILA, 'Cada cambio queda en la bitácora: quién lo hizo, qué cambió y cuándo.');
  await ir(p, '/reportes/expediente', 'Expediente');
  await paso(p, 'El expediente completo se descarga, y se puede comprobar que nadie lo alteró.', 'aviso');
});

await grabar('08-telefono', async (p) => {
  await tarjeta(p, '¿Estás fuera de la oficina?', 'Revisa todo desde tu celular', 2600);
  await resaltar(p, p.locator('main').getByText('Asistencia de hoy').locator('xpath=..'), 'De un vistazo, quién ya registró su entrada hoy.', 1.35);
  await recorrer(p, 2);
  // La barra de abajo del teléfono, como lo usaría quien administra.
  await ir(p, '/asistencia', 'Asistencia');
  await resaltar(p, p.locator('main').getByText('Ana Torres').first().locator('xpath=..'), 'Cada persona, con su sede y sus horas de la semana.', 1.4);
  await recorrer(p, 2);
  await paso(p, 'Todo lo que ves en la oficina, también en tu teléfono.', 'aviso');
}, { ancho: 390, alto: 844, escala: 2, movil: true });

voz?.cerrar();
console.log(`Videos en ${CARPETA}`);
process.exit(0);
