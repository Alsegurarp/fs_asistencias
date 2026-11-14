// Llena la empresa de demostración con lo que hace una empresa real en un
// día: sedes, horarios, personas con tarjeta, terminales, teléfonos y la
// jornada de ayer con sus incidencias. Todo ficticio y por el API, con la
// sesión de quien la administra. La semana se mueve para que ayer quede en
// una semana terminada, lista para cerrarse en la demostración.
//
// Variables: DEMO_PORTAL, DEMO_CUENTAS, DEMO_LATITUD y DEMO_LONGITUD (dónde
// se presenta: ahí queda Matriz Centro, para que marcar en vivo caiga dentro)
// y DEMO_HORA (HH:MM, opcional): la hora de hoy a la que se debió sembrar,
// cuando se reinicia tarde. Las marcas de ayer quedan como si la siembra se
// hubiera corrido a esa hora; demo.sh mueve después su recepción a esa hora.
import { Dispositivo, ZONA, api, cuentas, dormir, huella, navegador, sesion } from './comun.mjs';

const latitud = Number(process.env.DEMO_LATITUD || 19.432608);
const longitud = Number(process.env.DEMO_LONGITUD || -99.133209);
const bodega = { latitud: 19.5096, longitud: -99.1912 };
const fuera = { latitud: latitud + 0.012, longitud };

const dia = (fecha) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(fecha);
const hoy = dia(new Date());
const semanaDe = (fecha) => new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'long' }).format(fecha).toLowerCase();
const antes = (dias) => dia(new Date(Date.now() - dias * 86400000));

// La hora de la siembra: la de ahora o, con DEMO_HORA, una de hoy que ya pasó.
function horaDeHoy(texto) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(texto)) throw new Error('DEMO_HORA va como HH:MM, por ejemplo 07:00.');
  const desfase = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, timeZoneName: 'longOffset' })
    .formatToParts(new Date()).find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
  const fecha = new Date(`${hoy}T${texto}:00${desfase}`);
  if (fecha > new Date()) throw new Error(`DEMO_HORA (${texto}) todavía no llega: sólo sirve una hora de hoy que ya pasó.`);
  return fecha;
}
const siembra = process.env.DEMO_HORA ? horaDeHoy(process.env.DEMO_HORA) : new Date();
if (process.env.DEMO_HORA) console.log(`Siembra como si fueran las ${process.env.DEMO_HORA}: las marcas de ayer llegan con más de 24 horas y salen «sincronizada tarde» hasta que demo.sh mueve su recepción a esa hora.`);

// Hace casi 24 horas: todavía es ayer y todavía no cuenta como sincronización tardía.
const inicio = new Date(Math.floor((siembra.getTime() - 23.5 * 3600000) / 900000) * 900000);
const mas = (horas) => new Date(inicio.getTime() + horas * 3600000);
if (dia(inicio) === hoy) console.log('Aviso: a esta hora la jornada sembrada cae hoy y no se podrá cerrar; conviene sembrar después de las 7 de la mañana.');
// Una jornada diurna termina antes de las 20:00; la de tiempo extra dura casi
// 11 horas. Sembrada tarde, cruza la noche: cuenta como mixta (máximo de
// 7 h 30) y a todos les sale media hora extra.
const horaInicio = Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }).format(inicio));
if (horaInicio >= 12) console.log('Aviso: sembrada a esta hora, la jornada de ayer termina de noche y cuenta extra para todos; para la demostración conviene reiniciar entre las 7:30 y las 8:30.');

// Quién es quién. `caso` dice qué le pasó ayer; sin caso, no marcó.
const personas = [
  { no: '0101', nombre: 'Ana Torres', sede: 'bodega', horario: 'matutino', caso: 'terminal' },
  { no: '0102', nombre: 'Carmen Vega', sede: 'matriz', horario: 'oficina', caso: 'telefono' },
  { no: '0103', nombre: 'Jorge Ramírez', sede: 'bodega', horario: 'matutino', caso: 'extra' },
  { no: '0104', nombre: 'Raúl Ortega', sede: 'bodega', horario: 'matutino', caso: 'terminal' },
  { no: '0105', nombre: 'Diego Castañeda', sede: 'bodega', horario: 'matutino', caso: 'sinSalida' },
  { no: '0106', nombre: 'Andrea Lozano', sede: 'matriz', horario: 'oficina', caso: 'fuera' },
  { no: '0107', nombre: 'Marco Ibarra', sede: 'matriz', horario: 'oficina', caso: 'telefono' },
  { no: '0108', nombre: 'Patricia Núñez', sede: 'matriz', horario: 'oficina', caso: 'repetida' },
  { no: '0109', nombre: 'Luis Herrera', sede: 'bodega', horario: 'matutino', caso: 'extra' },
  { no: '0110', nombre: 'Sandra Morales', sede: 'matriz', horario: 'oficina', caso: 'terminal' },
  { no: '0111', nombre: 'Héctor Salinas', sede: 'bodega', horario: 'matutino', caso: 'tarde' },
  { no: '0112', nombre: 'Gabriela Ríos', sede: 'matriz', horario: 'oficina', caso: 'telefono' },
  { no: '0113', nombre: 'Fernando Cruz', sede: 'bodega', horario: 'matutino', caso: 'terminal' },
  { no: '0114', nombre: 'Verónica Paz', sede: 'matriz', horario: 'oficina', caso: 'terminal' },
  { no: '0115', nombre: 'Óscar Mendoza', sede: 'bodega', horario: 'matutino', sinTarjeta: true },
  { no: '0116', nombre: 'Lucía Fuentes', sede: 'matriz', horario: 'oficina', sinTarjeta: true },
];

const c = cuentas();
const nav = await navegador();
const { contexto, token } = await sesion(nav, c.admin_empresa);
const llamar = api(token);
const yo = await llamar('GET', '/me');
console.log(`Sesión de ${yo.displayName} en ${yo.tenant?.name}.`);

await llamar('PATCH', '/tenant', { weekStartsOn: semanaDe(new Date()) });
const nombres = { monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles', thursday: 'jueves', friday: 'viernes', saturday: 'sábado', sunday: 'domingo' };
console.log(`La semana empieza en ${nombres[semanaDe(new Date())]}: ayer queda en una semana terminada.`);

const sedes = {
  matriz: await llamar('POST', '/sites', { name: 'Matriz Centro', timeZone: ZONA, latitude: latitud, longitude: longitud, radiusMeters: 200 }),
  bodega: await llamar('POST', '/sites', { name: 'Bodega Norte', timeZone: ZONA, latitude: bodega.latitud, longitude: bodega.longitud, radiusMeters: 150 }),
};
const dias = (lista, entrada, salida, comida) => lista.map((d) => ({ dayOfWeek: d, startTime: entrada, endTime: salida, breakMinutes: comida }));
const semana5 = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const horarios = {
  oficina: await llamar('POST', '/schedules', { name: 'Oficina L–V', timeZone: ZONA, validFrom: antes(90), validTo: null, days: dias(semana5, '09:00', '18:00', 60) }),
  matutino: await llamar('POST', '/schedules', { name: 'Matutino 6 días', timeZone: ZONA, validFrom: antes(90), validTo: null, days: dias([...semana5, 'saturday'], '07:00', '15:00', 30) }),
};
console.log('Sedes: Matriz Centro y Bodega Norte. Horarios: Oficina L–V y Matutino 6 días.');

const terminales = {};
for (const [clave, sede] of Object.entries(sedes)) {
  terminales[clave] = await new Dispositivo().activar(llamar, { mode: 'terminal', siteId: sede.id, label: `Terminal ${sede.name}` });
}

for (const p of personas) {
  const persona = await llamar('POST', '/employees', { externalId: p.no, displayName: p.nombre, siteId: sedes[p.sede].id, employmentStart: '2025-08-04' });
  p.id = persona.id;
  await llamar('POST', `/employees/${p.id}/schedule-assignments`, { scheduleId: horarios[p.horario].id, validFrom: antes(90) });
  if (p.sinTarjeta) continue;
  p.huella = huella();
  const tarjeta = await llamar('POST', '/cards', { label: `T-${p.no}`, fingerprint: p.huella });
  await llamar('POST', `/cards/${tarjeta.id}/assignments`, { employeeId: p.id });
  if (['telefono', 'fuera', 'repetida', 'extra', 'tarde', 'sinSalida'].includes(p.caso)) {
    p.telefono = await new Dispositivo().activar(llamar, { mode: 'personal', employeeId: p.id });
  }
}
console.log(`Personas: ${personas.length}, ${personas.filter((p) => !p.sinTarjeta).length} con tarjeta; terminales en las dos sedes.`);

// La jornada de ayer, por caso.
const lugar = (p) => (p.sede === 'matriz' ? { latitud, longitud } : bodega);
const casos = {
  terminal: (p) => [[terminales[p.sede], mas(0), lugar(p)], [terminales[p.sede], mas(8), lugar(p)]],
  telefono: (p) => [[p.telefono, mas(0.25), lugar(p)], [p.telefono, mas(8.25), lugar(p)]],
  extra: (p) => [[p.telefono, mas(0), lugar(p)], [p.telefono, mas(10.75), lugar(p)]],
  fuera: (p) => [[p.telefono, mas(0.5), fuera], [p.telefono, mas(8.5), lugar(p)]],
  sinSalida: (p) => [[p.telefono, mas(0.25), lugar(p)]],
  repetida: (p) => [[p.telefono, mas(0.5), lugar(p)], [p.telefono, new Date(mas(0.5).getTime() + 20000), lugar(p)], [p.telefono, mas(8.5), lugar(p)]],
  tarde: (p) => [[p.telefono, new Date(mas(0).getTime() - 26 * 3600000), lugar(p)], [p.telefono, new Date(mas(8).getTime() - 26 * 3600000), lugar(p)]],
};
const resultados = {};
for (const p of personas.filter((x) => x.caso)) {
  const marcas = casos[p.caso](p).sort((a, b) => a[1] - b[1]);
  const dichos = [];
  for (const [dispositivo, cuando, donde] of marcas) {
    const dicho = await dispositivo.marcar(llamar, { huella: p.huella, cuando, latitud: donde.latitud, longitud: donde.longitud });
    resultados[dicho] = (resultados[dicho] || 0) + 1;
    dichos.push(dicho);
  }
  console.log(`  ${p.no} ${p.nombre} (${p.caso}): ${dichos.join(', ')}`);
}
console.log('Marcajes: ' + Object.entries(resultados).map(([k, v]) => `${v} ${k}`).join('; '));

// Lo que la administración deja listo: quién supervisa qué, el permiso del
// expediente y un cambio de comida que se ve en el Panel.
const usuarios = await llamar('GET', '/users?limit=50');
const supervision = usuarios.items.find((u) => u.roles.includes('supervisor'));
if (supervision) await llamar('PATCH', `/users/${supervision.id}`, { siteIds: [sedes.bodega.id] });
await llamar('PUT', `/users/${yo.userId}/dossier-permission`, { enabled: true });
await llamar('POST', '/tenant/break-policy-changes', { breakPolicy: 'marked', reason: 'A partir de la próxima quincena el personal marcará su comida.' });
console.log('Supervisión limitada a Bodega Norte, permiso del expediente para Administración y cambio de comida programado.');

await contexto.close();
await nav.close();
await dormir(100);
process.exit(0);
