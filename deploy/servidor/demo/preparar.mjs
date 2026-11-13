// Genera, una sola vez, lo secreto de la demostración en la carpeta local
// DEMO_SECRETOS (montada en /secretos), fuera del repositorio:
//   - cuentas.json y cuentas.tsv: las cuentas de quien presenta, con su
//     contraseña y el secreto de su código, y la de primer ingreso;
//   - cuentas-demo.md y un QR por cuenta, para agregarlas a la app de
//     autenticación del teléfono de quien presenta;
//   - pilot_card_key: la clave con que el servidor firma las tarjetas.
// Si ya existen, se conservan: así las cuentas y las tarjetas escritas siguen
// sirviendo después de cada reinicio. No imprime nada secreto.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const carpeta = '/secretos';
const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const azar = (n) => Array.from(randomBytes(n), (b) => alfabeto[b % alfabeto.length]).join('');

const plantilla = [
  { rol: 'admin_empresa', correo: 'demo.administracion@zenit.example', nombre: 'Mariana Ortiz', modo: 'listo' },
  { rol: 'rh', correo: 'demo.rh@zenit.example', nombre: 'Rocío Navarro', modo: 'listo' },
  { rol: 'supervisor', correo: 'demo.supervision@zenit.example', nombre: 'Laura Gil', modo: 'listo' },
  { rol: 'auditor', correo: 'demo.auditoria@zenit.example', nombre: 'Arturo Méndez', modo: 'listo' },
  { rol: 'rh', correo: 'demo.nueva@zenit.example', nombre: 'Sofía Herrera', modo: 'nuevo', clave: 'primer-ingreso' },
];

function base32(texto) {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of Buffer.from(texto, 'utf8')) bits += byte.toString(2).padStart(8, '0');
  let salida = '';
  for (let i = 0; i < bits.length; i += 5) salida += letras[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return salida;
}

// Para el servidor, una línea por cuenta separada por tabuladores; un campo
// vacío va como «-», porque dos tabuladores seguidos no se leen como un campo.
const tsv = (lista) => lista.map((c) => [c.rol, c.correo, c.nombre, c.clave, c.otp || '-', c.modo].join('\t')).join('\n') + '\n';

const rutaCuentas = `${carpeta}/cuentas.json`;
if (existsSync(rutaCuentas)) {
  writeFileSync(`${carpeta}/cuentas.tsv`, tsv(JSON.parse(readFileSync(rutaCuentas, 'utf8'))), { mode: 0o600 });
  console.log('cuentas de la demostración: se conservan las que ya había');
} else {
  const cuentas = plantilla.map((c) => ({ ...c, clave: c.modo === 'nuevo' ? `Zenit-${azar(10)}` : `${azar(18)}-7aZ`, otp: c.modo === 'nuevo' ? '' : azar(20) }));
  writeFileSync(rutaCuentas, JSON.stringify(cuentas, null, 1), { mode: 0o600 });
  writeFileSync(`${carpeta}/cuentas.tsv`, tsv(cuentas), { mode: 0o600 });
  const lineas = ['# Cuentas de la demostración de Zenit', '', 'Secreto: no se comparte ni se sube a ningún repositorio.', ''];
  for (const c of cuentas) {
    lineas.push(`## ${c.nombre} · ${c.rol}`, '', `- Correo: ${c.correo}`, `- Contraseña${c.modo === 'nuevo' ? ' temporal' : ''}: ${c.clave}`);
    if (c.otp) {
      const uri = `otpauth://totp/Zenit%20Demo:${encodeURIComponent(c.correo)}?secret=${base32(c.otp)}&issuer=Zenit%20Demo&digits=6&period=30&algorithm=SHA1`;
      const archivo = `qr-${c.correo.split('@')[0].replace('demo.', '')}.png`;
      await QRCode.toFile(`${carpeta}/${archivo}`, uri, { width: 360, margin: 2 });
      lineas.push(`- Clave para la app de autenticación: ${base32(c.otp)}`, `- QR: ${archivo}`);
    } else {
      lineas.push('- Primer ingreso en vivo: cambia la contraseña y liga su app de autenticación.');
    }
    lineas.push('');
  }
  writeFileSync(`${carpeta}/cuentas-demo.md`, lineas.join('\n'), { mode: 0o600 });
  console.log(`cuentas de la demostración generadas: ${cuentas.length}, con su QR en la carpeta de secretos`);
}

const rutaClave = `${carpeta}/pilot_card_key`;
if (existsSync(rutaClave)) {
  console.log('clave de las tarjetas del piloto: se conserva la que ya había');
} else {
  // La misma forma que genera el backend (`:backend:pilotCardKey`): JWK P-256 privada con su kid.
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...privateKey.export({ format: 'jwk' }), kid: `zenit-pilot-card-${new Date().toISOString().slice(0, 10)}` };
  writeFileSync(rutaClave, JSON.stringify(jwk), { mode: 0o600 });
  console.log('clave de las tarjetas del piloto generada');
}
