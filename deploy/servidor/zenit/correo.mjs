// Convierte la credencial de correo (`smtp.env`, líneas CLAVE=valor) en el
// `smtpServer` que guarda el realm. La usa identidad.mjs en cada despliegue.
// Nunca muestra los valores: los errores sólo nombran la clave.
import assert from 'node:assert/strict'

const obligatorias = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']

export function servidorDeCorreo(texto) {
  const valores = {}
  for (const linea of texto.split(/\r?\n/)) {
    const partes = linea.match(/^\s*(SMTP_[A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (partes) valores[partes[1]] = partes[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  for (const clave of obligatorias) assert.ok(valores[clave], `La credencial de correo no trae ${clave}`)
  const puerto = Number(valores.SMTP_PORT)
  assert.ok(Number.isInteger(puerto) && puerto > 0 && puerto < 65536, 'SMTP_PORT no es un puerto')
  assert.match(valores.SMTP_FROM, /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, 'SMTP_FROM debe ser sólo la dirección del remitente')
  // El login SMTP de Brevo sólo autentica: como remitente, Brevo rechaza el mensaje.
  assert.ok(!/@smtp-brevo\.com$/i.test(valores.SMTP_FROM), 'SMTP_FROM es el login de Brevo, no un remitente verificado')
  const implicito = puerto === 465
  return {
    host: valores.SMTP_HOST, port: String(puerto), from: valores.SMTP_FROM,
    fromDisplayName: valores.SMTP_FROM_NAME || 'Zenit',
    auth: 'true', user: valores.SMTP_USER, password: valores.SMTP_PASS,
    ssl: String(implicito), starttls: String(!implicito),
  }
}
