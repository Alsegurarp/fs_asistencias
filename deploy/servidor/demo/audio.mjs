// Sonido de los videos: voz (Piper), efectos y música, todo sin derechos de
// terceros. Los efectos vienen de .audio/FX (ver FX); sólo el clic y la
// tarjeta tienen respaldo sintetizado aquí, igual que la música. La voz sale
// de un modelo abierto de Piper (videos.Dockerfile lo descarga).
//
// Durante la grabación se anota cuándo pasa cada cosa (clic, acercamiento,
// cambio de pantalla, tarjeta, frase); al terminar, `mezclar` pone cada
// sonido en su instante sobre el video y baja la música mientras se habla.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const SR = 48000;

/** WAV de 16 bits, mono, a partir de muestras entre -1 y 1. */
function wav(muestras) {
  const datos = Buffer.alloc(muestras.length * 2);
  for (let i = 0; i < muestras.length; i++) datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, muestras[i])) * 32767), i * 2);
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + datos.length, 4); cab.write('WAVE', 8);
  cab.write('fmt ', 12); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(SR, 24); cab.writeUInt32LE(SR * 2, 28); cab.writeUInt16LE(2, 32); cab.writeUInt16LE(16, 34);
  cab.write('data', 36); cab.writeUInt32LE(datos.length, 40);
  return Buffer.concat([cab, datos]);
}

/** Duración en segundos de un WAV PCM (busca el bloque «data»). */
export function duracionWav(archivo) {
  const b = readFileSync(archivo);
  const bytesPorSegundo = b.readUInt32LE(28);
  let i = 12;
  while (i < b.length - 8) {
    const id = b.toString('ascii', i, i + 4), tam = b.readUInt32LE(i + 4);
    if (id === 'data') return Math.min(tam, b.length - i - 8) / bytesPorSegundo;
    i += 8 + tam;
  }
  return 0;
}

const tono = (dur, fn) => Float32Array.from({ length: Math.round(dur * SR) }, (_, i) => fn(i / SR));

/**
 * Pista suave de respaldo (16 s que se repiten sin corte): Do, La menor, Fa y
 * Sol, con un fundido entre acordes. Sustitúyase por una pista propia con
 * DEMO_MUSICA o poniendo musica.mp3 en la carpeta de los videos.
 */
function fondo() {
  const nota = (n) => 261.63 * Math.pow(2, n / 12);
  const acordes = [[-12, -8, -5, 0, 4], [-15, -12, -8, -3, 0], [-19, -15, -12, -7, 5], [-17, -13, -10, -5, 2]].map((a) => a.map(nota));
  let suave = 0;
  return tono(16, (t) => {
    const k = Math.floor(t / 4) % 4, dentro = t % 4;
    const env = Math.min(1, dentro / 0.8, (4 - dentro) / 0.8);
    let s = 0;
    for (const f of acordes[k]) s += Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.003 * t);
    suave += 0.08 * (s - suave);
    return 0.09 * suave * (0.35 + 0.65 * env);
  });
}

/** Escribe los efectos y la música de respaldo una vez. */
export function prepararSonidos(dir) {
  mkdirSync(dir, { recursive: true });
  const efectos = {
    clic: () => tono(0.12, (t) => 0.55 * Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-90 * t) + 0.25 * Math.sin(2 * Math.PI * 3100 * t) * Math.exp(-140 * t)),
    tarjeta: () => tono(1.8, (t) => 0.22 * Math.sin(2 * Math.PI * 659.25 * t) * Math.exp(-2.6 * t) + 0.16 * Math.sin(2 * Math.PI * 987.77 * t) * Math.exp(-3 * t)
      + 0.1 * Math.sin(2 * Math.PI * 1318.5 * t) * Math.exp(-3.6 * t)),
    fondo,
  };
  for (const [nombre, hacer] of Object.entries(efectos)) {
    const archivo = `${dir}/${nombre}.wav`;
    if (!existsSync(archivo)) writeFileSync(archivo, wav(hacer()));
  }
}

/** La voz: un proceso de Piper que se queda abierto, con caché por texto. */
export class Voz {
  constructor(modelo, dir) {
    this.modelo = modelo;
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  async abrir() {
    if (this.proceso) return;
    this.proceso = spawn('python3', [new URL('./voz.py', import.meta.url).pathname, this.modelo], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.respuestas = createInterface({ input: this.proceso.stdout });
    this.pendientes = [];
    this.respuestas.on('line', (l) => this.pendientes.shift()?.(JSON.parse(l)));
    await new Promise((listo) => this.pendientes.push(listo));
  }

  /** El WAV de esa frase y su duración; lo sintetiza si aún no existe. */
  async decir(texto) {
    const nombre = createHash('sha1').update(`${this.modelo}\n${texto}`).digest('hex').slice(0, 16);
    const archivo = `${this.dir}/${nombre}.wav`;
    if (!existsSync(archivo)) {
      await this.abrir();
      const r = await new Promise((listo) => { this.pendientes.push(listo); this.proceso.stdin.write(JSON.stringify({ texto, archivo }) + '\n'); });
      if (r.error) throw new Error(`Piper no pudo sintetizar (${r.error})`);
    }
    return { archivo, duracion: duracionWav(archivo) };
  }

  cerrar() { this.proceso?.stdin.end(); }
}

function duracion(archivo) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo], { encoding: 'utf8' });
  return Number.parseFloat(r.stdout) || 0;
}

/**
 * Efectos propios: en <carpeta de los videos>/.audio/FX, un archivo por
 * propósito (mp3, wav u ogg; el nombre sin importar mayúsculas). Si falta
 * uno, se usa el sintetizado de .audio/ cuando lo hay; si tampoco, ese
 * momento queda sin efecto.
 */
export const FX = {
  clic: 'Click',              // cada clic
  zoom: 'ZoomIn',             // cada acercamiento
  tarjeta: 'TitleSound',      // tarjeta con la pregunta del cliente
  problema: 'SomethingWrong', // se señala un problema: una incidencia, alguien bloqueado
  aviso: 'Notification',      // se muestra la solución o el resultado
  cambio: 'Notification',     // cambio de pantalla
  cierre: 'Notification',     // tarjeta final con la marca
};

function archivoEfecto(dir, tipo) {
  const carpeta = `${dir}/FX`;
  if (FX[tipo] && existsSync(carpeta)) {
    const buscado = FX[tipo].toLowerCase();
    const hallado = readdirSync(carpeta).find((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f) && f.toLowerCase().replace(/\.[^.]+$/, '') === buscado);
    if (hallado) return { archivo: `${carpeta}/${hallado}`, propio: true };
  }
  const sintetizado = `${dir}/${tipo}.wav`;
  return existsSync(sintetizado) ? { archivo: sintetizado, propio: false } : null;
}

// Volumen de cada efecto en la mezcla (los propios ya vienen masterizados).
const VOLUMEN = { voz: 1, clic: 0.45, zoom: 0.45, cambio: 0.35, tarjeta: 0.45, problema: 0.6, aviso: 0.65, cierre: 0.65 };

/**
 * Pone el sonido sobre el video. `eventos`: [{ t, tipo, archivo? }] con t en
 * segundos desde el inicio del video. La música se repite, entra y sale con
 * fundido y baja sola mientras habla la voz.
 */
export function mezclar({ video, salida, eventos, dirSonidos, musica, volumenMusica = 0.08, conEfectos = true, conVoz = true }) {
  const dur = duracion(video);
  const entradas = ['-i', video];
  const filtros = [];
  let n = 1;
  let musicaIdx = null;
  if (musica) { entradas.push('-stream_loop', '-1', '-i', musica); musicaIdx = n++; }
  const grupos = { voz: [], sfx: [] };
  for (const e of eventos) {
    const esVoz = e.tipo === 'voz';
    if ((esVoz && !conVoz) || (!esVoz && !conEfectos)) continue;
    if (e.t < 0 || e.t > dur) continue;
    const efecto = esVoz ? { archivo: e.archivo, propio: false } : archivoEfecto(dirSonidos, e.tipo);
    if (!efecto) continue;
    entradas.push('-i', efecto.archivo);
    const etiqueta = `e${n}`;
    // Los mp3 traen un poco de silencio al inicio: se quita para que el sonido caiga en su cuadro.
    const recorte = efecto.propio ? 'silenceremove=start_periods=1:start_threshold=-50dB,' : '';
    filtros.push(`[${n}:a]aformat=sample_rates=${SR}:channel_layouts=stereo,${recorte}adelay=${Math.round(e.t * 1000)}:all=1,volume=${VOLUMEN[e.tipo] ?? 0.4}[${etiqueta}]`);
    (esVoz ? grupos.voz : grupos.sfx).push(`[${etiqueta}]`);
    n++;
  }
  const silencio = (nombre) => filtros.push(`aevalsrc=0:s=${SR}:c=stereo:d=${dur}[${nombre}]`);
  for (const [nombre, lista] of Object.entries(grupos)) {
    if (lista.length) filtros.push(`${lista.join('')}amix=inputs=${lista.length}:normalize=0:duration=longest,apad=whole_dur=${dur}[${nombre}]`);
    else silencio(nombre);
  }
  filtros.push('[voz]asplit=2[vozA][vozB]');
  if (musicaIdx !== null) {
    filtros.push(`[${musicaIdx}:a]aformat=sample_rates=${SR}:channel_layouts=stereo,atrim=0:${dur},volume=${volumenMusica},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, dur - 2.5)}:d=2.5[mus]`);
    // Ya va baja: mientras habla la voz sólo se aparta un poco más.
    filtros.push('[mus][vozB]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=500[musd]');
  } else {
    filtros.push('[vozB]anullsink');
    silencio('musd');
  }
  filtros.push('[vozA][sfx][musd]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95[a]');
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...entradas, '-filter_complex', filtros.join(';'),
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(dur), '-movflags', '+faststart', salida], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('ffmpeg no pudo mezclar el sonido');
  unlinkSync(video);
}
