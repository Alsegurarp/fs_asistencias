// Toma las capturas de la guía de demostración en el ambiente publicado, con
// las cuentas de la demostración, y las deja en docs/guia-de-demostracion/.
// Correr después de «demo.sh reiniciar»: muestra la empresa recién sembrada.
// Para fotografiar el reporte para nómina cierra la semana sembrada, así que
// después hay que reiniciar otra vez antes de presentar. No completa el
// primer ingreso: esa cuenta se usa en vivo.
import { mkdirSync } from 'node:fs';
import { PORTAL, ZONA, api, cuentas, dormir, navegador, sesion } from './comun.mjs';

const carpeta = '/docs/guia-de-demostracion';
mkdirSync(carpeta, { recursive: true });
const c = cuentas();
const nav = await navegador();
const hechas = [];

// `ocultar`: selectores que se tapan en la imagen, como el QR del código.
async function tomar(pagina, nombre, ruta, { completa = false, espera = 1500, antes, ocultar = [] } = {}) {
  if (ruta) await pagina.goto(PORTAL + ruta, { waitUntil: 'domcontentloaded' });
  await pagina.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  if (antes) await antes();
  await dormir(espera);
  await pagina.screenshot({ path: `${carpeta}/${nombre}.png`, fullPage: completa, mask: ocultar.map((s) => pagina.locator(s)), maskColor: '#dde5f2' });
  hechas.push(nombre);
}

// Acceso: ingreso y código, antes de entrar.
{
  const contexto = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: ZONA });
  const pagina = await contexto.newPage();
  await pagina.goto(PORTAL + '/', { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('#username');
  await tomar(pagina, '01-ingreso', null, { espera: 600 });
  await pagina.fill('#username', c.admin_empresa.correo);
  await pagina.fill('#password', c.admin_empresa.clave);
  await pagina.click('#kc-login');
  await pagina.waitForSelector('#otp');
  await tomar(pagina, '02-codigo', null, { espera: 600 });
  await contexto.close();
}

// Primer ingreso de la cuenta nueva: sólo la primera pantalla, sin completarlo.
{
  const contexto = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: ZONA });
  const pagina = await contexto.newPage();
  await pagina.goto(PORTAL + '/', { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('#username');
  await pagina.fill('#username', c.nueva.correo);
  await pagina.fill('#password', c.nueva.clave);
  await pagina.click('#kc-login');
  await pagina.waitForSelector('#totp', { timeout: 30000 });
  await tomar(pagina, '03-primer-ingreso', null, { espera: 800, ocultar: ['#kc-totp-secret-qr-code', '#kc-totp-secret-key'] });
  await contexto.close();
}

// Administración.
await dormir(31000);
{
  const { contexto, pagina, token } = await sesion(nav, c.admin_empresa, { ruta: '/panel' });
  const llamar = api(token);
  await tomar(pagina, '04-panel', '/panel');
  // La semana sembrada (la de ayer), no la que está en curso.
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(Date.now() - 86400000));
  await tomar(pagina, '05-asistencia', `/asistencia?semana=${dia}`);
  const personas = await llamar('GET', '/employees?limit=50');
  const jorge = personas.items.find((p) => p.displayName === 'Jorge Ramírez') || personas.items[0];
  await tomar(pagina, '06-ficha', `/asistencia?semana=${dia}&persona=${jorge.id}`);
  await tomar(pagina, '07-incidencias', '/incidencias?vista=lista');
  const abiertas = await llamar('GET', '/incidents?status=open&limit=5');
  if (abiertas.items[0]) await tomar(pagina, '08-incidencia', `/incidencias?vista=lista&incidencia=${abiertas.items[0].id}`);
  await tomar(pagina, '09-cierres', `/cierres?semana=${dia}`);
  // Cierra lo que se puede cerrar, como en la demostración, para tener reporte.
  const { weekStart: inicio } = await llamar('GET', `/week-closures/summary?week=${dia}`);
  const corrida = await llamar('POST', '/week-closure-runs', { weekStart: inicio });
  for (let i = 0; i < 30; i++) { const r = await llamar('GET', `/week-closure-runs/${corrida.id}`); if (!['queued', 'running'].includes(r.status)) break; await dormir(1000); }
  await tomar(pagina, '09b-cierres-cerrada', `/cierres?semana=${dia}`);
  await tomar(pagina, '10-personal', '/personal');
  await tomar(pagina, '11-importar', '/personal/importaciones?importar=archivo');
  await tomar(pagina, '12-dispositivos', '/dispositivos');
  await tomar(pagina, '13-emitir-codigo', '/dispositivos?activar=1');
  await tomar(pagina, '14-tarjetas', '/dispositivos/tarjetas');
  await tomar(pagina, '15-configuracion', '/configuracion');
  await tomar(pagina, '16-usuarios', '/usuarios');
  await tomar(pagina, '17-nomina', `/reportes/nomina?semana=${inicio}&paso=2`);
  await tomar(pagina, '18-nomina-pdf', `/reportes/nomina?semana=${inicio}&paso=3`, { espera: 2500 });
  await tomar(pagina, '19-bitacora', '/reportes/bitacora');
  await tomar(pagina, '20-expediente', '/reportes/expediente');
  await tomar(pagina, '21-perfil', '/panel?perfil=1');
  await contexto.close();
}

// Supervisión: sólo su sede.
await dormir(31000);
{
  const { contexto, pagina } = await sesion(nav, c.supervisor, { ruta: '/asistencia' });
  await tomar(pagina, '22-supervision', '/asistencia');
  await contexto.close();
}

// Teléfono.
await dormir(31000);
{
  const { contexto, pagina } = await sesion(nav, c.admin_empresa, { ancho: 390, alto: 844, ruta: '/panel' });
  await tomar(pagina, '23-telefono-panel', '/panel');
  await tomar(pagina, '24-telefono-asistencia', '/asistencia');
  await contexto.close();
}

console.log(`Capturas: ${hechas.length} en docs/guia-de-demostracion/`);
await nav.close();
process.exit(0);
