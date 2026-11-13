// Piezas que comparten los guiones de la demostración: sesión real en el
// portal, llamadas al API y dispositivos simulados que firman como la app.
// Nada de lo que imprimen es un secreto.
import { createHmac, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

export const PORTAL = (process.env.DEMO_PORTAL || 'https://zenit.fastsolution.com.mx').replace(/\/$/, '');
export const ZONA = 'America/Mexico_City';
const CUENTAS = process.env.DEMO_CUENTAS || '/secretos/cuentas.json';
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Las cuentas de la demostración, por rol; la de primer ingreso va como `nueva`. */
export function cuentas() {
  return Object.fromEntries(JSON.parse(readFileSync(CUENTAS, 'utf8')).map((c) => [c.modo === 'nuevo' ? 'nueva' : c.rol, c]));
}

/** El código de 6 dígitos de la app de autenticación para ese secreto. */
export function codigo(secreto, instante = Date.now()) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(instante / 30000)));
  const h = createHmac('sha1', Buffer.from(secreto, 'utf8')).update(contador).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}

export const navegador = () => chromium.launch();

/**
 * Entra al portal con la contraseña y el código de una cuenta lista. Devuelve
 * la página y una función que da el token vigente: el portal lo renueva solo
 * y aquí se toma cada vez que llega uno nuevo.
 */
export async function sesion(nav, cuenta, { ancho = 1440, alto = 900, ruta = '/' } = {}) {
  const contexto = await nav.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-MX', timezoneId: ZONA });
  const pagina = await contexto.newPage();
  let token = null;
  pagina.on('response', async (r) => {
    if (r.url().includes('/protocol/openid-connect/token') && r.ok()) {
      try { token = (await r.json()).access_token; } catch { /* sin cuerpo */ }
    }
  });
  await pagina.goto(PORTAL + ruta, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('#username', { timeout: 30000 });
  await pagina.fill('#username', cuenta.correo);
  await pagina.fill('#password', cuenta.clave);
  await pagina.click('#kc-login');
  await pagina.waitForSelector('#otp', { timeout: 30000 });
  // Un código ya usado se rechaza: se espera al siguiente periodo si hace falta.
  const periodo = Math.floor(Date.now() / 30000);
  if (sesion.ultimo === periodo) await dormir(30000 - (Date.now() % 30000) + 500);
  sesion.ultimo = Math.floor(Date.now() / 30000);
  await pagina.fill('#otp', codigo(cuenta.otp));
  await pagina.click('#kc-login');
  await pagina.waitForURL((u) => u.origin === PORTAL && !u.pathname.startsWith('/id/'), { timeout: 30000 });
  for (let i = 0; i < 40 && !token; i++) await dormir(250);
  if (!token) throw new Error('El portal no entregó un token tras iniciar sesión.');
  return { contexto, pagina, token: () => token };
}

/** Cliente del API con el token de la sesión; espera y repite si se agota la cuota. */
export function api(token) {
  return async function llamar(metodo, ruta, cuerpo, { esperado = [200, 201, 202, 204], credencial, clave } = {}) {
    // `credencial` vacía: la petición va sin credencial, como la activación.
    const valor = credencial === undefined ? token() : credencial;
    for (let intento = 0; intento < 4; intento++) {
      const r = await fetch(`${PORTAL}/api/v1${ruta}`, {
        method: metodo,
        headers: {
          ...(valor ? { authorization: `Bearer ${valor}` } : {}),
          ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
          ...(clave ? { 'idempotency-key': clave } : {}),
        },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
      if (r.status === 429) { console.log('   cuota por minuto agotada: espera de un minuto'); await dormir(61000); continue; }
      const texto = await r.text();
      const datos = texto ? JSON.parse(texto) : null;
      if (!esperado.includes(r.status)) throw new Error(`${metodo} ${ruta} respondió ${r.status} ${datos?.code || ''} ${JSON.stringify(datos?.errors || datos?.detail || '')}`);
      return datos;
    }
    throw new Error(`${metodo} ${ruta}: la cuota no se recuperó`);
  };
}

const b64u = (valor) => Buffer.from(valor).toString('base64url');

/** Un dispositivo como la app: llave propia, activación con código y sobres firmados. */
export class Dispositivo {
  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.llave = privateKey;
    this.publica = publicKey.export({ format: 'jwk' });
    this.secuencia = 0;
  }

  firmar(encabezado, contenido) {
    const base = `${b64u(JSON.stringify(encabezado))}.${b64u(JSON.stringify(contenido))}`;
    return `${base}.${sign('sha256', Buffer.from(base), { key: this.llave, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  }

  async activar(llamar, inscripcion) {
    const { code } = await llamar('POST', '/device-enrollments', inscripcion);
    const activacion = await llamar('POST', '/device-activations', {
      enrollmentCode: code,
      publicKey: this.publica,
      proof: this.firmar({ alg: 'ES256' }, { enrollmentCode: code }),
      device: { manufacturer: 'Demostración', model: inscripcion.mode === 'terminal' ? 'Terminal de sede' : 'Teléfono personal', androidSdk: 34, appVersion: '0.1.0-demostracion' },
      screenLock: true,
    }, { credencial: '' });
    this.id = activacion.deviceId;
    this.sesion = activacion.session.sessionId;
    this.audiencia = activacion.audience;
    return this;
  }

  asercion() {
    const ahora = Math.floor(Date.now() / 1000);
    return this.firmar({ alg: 'ES256', kid: this.id }, { iss: this.id, sub: this.id, aud: this.audiencia, iat: ahora, exp: ahora + 60 });
  }

  /** Manda un marcaje con la tarjeta simulada; devuelve el resultado en palabras. */
  async marcar(llamar, { huella, cuando, latitud, longitud }) {
    const clave = crypto.randomUUID();
    const sobre = this.firmar({ alg: 'ES256', kid: this.id }, {
      envelopeVersion: 1, idempotencyKey: clave, sessionId: this.sesion, sequence: ++this.secuencia,
      observedAt: cuando.toISOString(), timeZone: ZONA, card: { scheme: 'uid_sha256', proof: huella },
      location: { latitude: latitud, longitude: longitud, accuracyMeters: 12, capturedAt: cuando.toISOString(), provider: 'fused', mock: false },
      app: { version: '0.1.0-demostracion' },
    });
    const recibo = await llamar('POST', '/attendance-events', { envelope: sobre }, { credencial: this.asercion(), clave, esperado: [200, 201] });
    if (recibo?.rejection) return `rechazado (${recibo.rejection.code})`;
    return recibo?.incident ? `con incidencia (${recibo.incident.type})` : 'aceptado';
  }
}

export const huella = () => randomBytes(16).toString('hex');
