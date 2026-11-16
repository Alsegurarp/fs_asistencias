import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { test } from 'node:test'
import { servidorDeCorreo } from '../../deploy/servidor/zenit/correo.mjs'

const configured = JSON.parse(readFileSync(new URL('./realm/zenit-realm.json', import.meta.url), 'utf8'))
const credencial = (cambios = {}) => Object.entries({ SMTP_HOST: 'smtp-relay.example', SMTP_PORT: '587',
  SMTP_USER: 'usuario@example', SMTP_PASS: 'secreto', SMTP_FROM: 'acceso@zenit.example', ...cambios })
  .filter(([, valor]) => valor !== null).map(([clave, valor]) => `${clave}=${valor}`).join('\n')

test('la credencial de correo se vuelve el smtpServer del realm, con STARTTLS o TLS según el puerto', () => {
  assert.deepEqual(servidorDeCorreo(`# correo\r\nPORT=3000\r\n${credencial().replaceAll('\n', '\r\n')}\r\n`), {
    host: 'smtp-relay.example', port: '587', from: 'acceso@zenit.example', fromDisplayName: 'Zenit',
    auth: 'true', user: 'usuario@example', password: 'secreto', ssl: 'false', starttls: 'true' })
  const implicito = servidorDeCorreo(credencial({ SMTP_PORT: '465', SMTP_FROM_NAME: '"Zenit Demo"', SMTP_PASS: "'con espacio '" }))
  assert.deepEqual([implicito.ssl, implicito.starttls, implicito.fromDisplayName, implicito.password], ['true', 'false', 'Zenit Demo', 'con espacio '])
})

test('una credencial incompleta o con el login de Brevo como remitente se rechaza sin mostrar valores', () => {
  for (const clave of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
    assert.throws(() => servidorDeCorreo(credencial({ [clave]: null })), error => error.message.includes(clave) && !error.message.includes('secreto'))
  }
  assert.throws(() => servidorDeCorreo(credencial({ SMTP_PORT: 'correo' })), /SMTP_PORT/)
  assert.throws(() => servidorDeCorreo(credencial({ SMTP_FROM: 'Zenit <acceso@zenit.example>' })), /SMTP_FROM/)
  assert.throws(() => servidorDeCorreo(credencial({ SMTP_FROM: 'a1b2c3@smtp-brevo.com' })), /login de Brevo/)
})

// Un servidor SMTP mínimo, sin TLS, que guarda lo que recibe.
function buzon() {
  const mensajes = []
  const servidor = createServer(socket => {
    const mensaje = { usuario: null, de: null, para: [], datos: '' }
    let pendiente = '', enDatos = false, autenticando = null
    const decir = linea => socket.write(`${linea}\r\n`)
    socket.on('error', () => {})
    socket.on('data', trozo => {
      pendiente += trozo.toString('latin1')
      for (let fin; (fin = pendiente.indexOf('\r\n')) >= 0;) {
        const linea = pendiente.slice(0, fin)
        pendiente = pendiente.slice(fin + 2)
        if (enDatos) {
          if (linea === '.') { enDatos = false; mensajes.push({ ...mensaje, para: [...mensaje.para] }); decir('250 2.0.0 recibido') }
          else mensaje.datos += `${linea.replace(/^\./, '')}\r\n`
          continue
        }
        if (autenticando) {
          const texto = Buffer.from(linea, 'base64').toString()
          if (autenticando === 'plain') { mensaje.usuario = texto.split('\0')[1]; autenticando = null; decir('235 2.7.0 aceptado') }
          else if (autenticando === 'usuario') { mensaje.usuario = texto; autenticando = 'clave'; decir('334 UGFzc3dvcmQ6') }
          else { autenticando = null; decir('235 2.7.0 aceptado') }
          continue
        }
        const [orden, ...resto] = linea.split(' ')
        switch (orden.toUpperCase()) {
          case 'EHLO': socket.write('250-buzon\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n'); break
          case 'HELO': decir('250 buzon'); break
          case 'AUTH':
            if (resto[0]?.toUpperCase() === 'PLAIN' && resto[1]) { mensaje.usuario = Buffer.from(resto[1], 'base64').toString().split('\0')[1]; decir('235 2.7.0 aceptado') }
            else if (resto[0]?.toUpperCase() === 'PLAIN') { autenticando = 'plain'; decir('334 ') }
            else if (resto[1]) { mensaje.usuario = Buffer.from(resto[1], 'base64').toString(); autenticando = 'clave'; decir('334 UGFzc3dvcmQ6') }
            else { autenticando = 'usuario'; decir('334 VXNlcm5hbWU6') }
            break
          case 'MAIL': mensaje.de = linea.match(/<([^>]*)>/)?.[1]; mensaje.para = []; mensaje.datos = ''; decir('250 2.1.0 remitente') ; break
          case 'RCPT': mensaje.para.push(linea.match(/<([^>]*)>/)?.[1]); decir('250 2.1.5 destinatario'); break
          case 'DATA': enDatos = true; decir('354 adelante'); break
          case 'QUIT': decir('221 2.0.0 adiós'); socket.end(); break
          default: decir('250 2.0.0 hecho')
        }
      }
    })
    decir('220 buzon ESMTP')
  })
  return new Promise(resolve => servidor.listen(0, '0.0.0.0', () => resolve({ servidor, mensajes, puerto: servidor.address().port })))
}

test('«Olvidé mi contraseña» manda por el correo configurado un enlace que abre crear contraseña', {
  skip: !process.env.IDENTITY_TEST_SECRETOS, timeout: 90000,
}, async () => {
  const base = process.env.IDENTITY_TEST_URL || 'http://localhost:38082'
  const realm = `qa-reset-${randomUUID()}`
  const callback = 'http://localhost:8081/'
  const cookies = new Map()
  async function adminRequest(method, path, token, body, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) },
      body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
    })
    assert.equal(response.status, expected, `${method} ${path}`)
    return response
  }
  async function browse(url, body) {
    for (let count = 0; count < 10; count++) {
      const target = new URL(url)
      assert.equal(target.origin, base)
      const response = await fetch(target, {
        method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body,
      })
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0], split = pair.indexOf('=')
        cookies.set(pair.slice(0, split), pair.slice(split + 1))
      }
      if (![302, 303].includes(response.status)) {
        assert.equal(response.status, 200)
        return { html: await response.text(), url: target }
      }
      url = new URL(response.headers.get('Location'), target).href
      body = undefined
    }
    assert.fail('Demasiadas redirecciones')
  }
  const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  const form = page => {
    const action = page.html.match(/<form\b[^>]*action="([^"]+)"/)
    assert.ok(action, 'Se esperaba un formulario de identidad')
    return new URL(decode(action[1]), page.url).href
  }
  const secret = readFileSync(join(process.env.IDENTITY_TEST_SECRETOS, 'keycloak_admin_password'), 'utf8').trim()
  const admin = (await (await adminRequest('POST', '/realms/master/protocol/openid-connect/token', null,
    new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password: secret }))).json()).access_token
  const { servidor, mensajes, puerto } = await buzon()
  let created = false
  try {
    await adminRequest('POST', '/admin/realms', admin, {
      realm, enabled: true, sslRequired: 'none', loginTheme: configured.loginTheme, internationalizationEnabled: configured.internationalizationEnabled,
      supportedLocales: configured.supportedLocales, defaultLocale: configured.defaultLocale,
      browserFlow: configured.browserFlow, resetCredentialsFlow: configured.resetCredentialsFlow, resetPasswordAllowed: true,
      authenticationFlows: configured.authenticationFlows.map(flow => ({ ...flow, id: randomUUID() })),
      authenticatorConfig: configured.authenticatorConfig.map(config => ({ ...config, id: randomUUID() })),
      requiredActions: configured.requiredActions,
      // Como en el servidor: la misma función que usa el despliegue arma el correo del realm.
      // Sólo cambia STARTTLS, que Keycloak exige cuando está pedido y el buzón de la prueba no tiene.
      smtpServer: { ...servidorDeCorreo(credencial({ SMTP_HOST: process.env.IDENTITY_TEST_SMTP_HOST || 'host.docker.internal', SMTP_PORT: String(puerto) })), starttls: 'false' },
      clients: [{ clientId: 'qa-reset', publicClient: true, enabled: true, standardFlowEnabled: true,
        directAccessGrantsEnabled: false, redirectUris: [callback], attributes: { 'pkce.code.challenge.method': 'S256' } }],
      users: [{ username: 'qa-reset', enabled: true, firstName: 'QA', lastName: 'Reset',
        email: 'qa-reset@example.invalid', emailVerified: true, requiredActions: [],
        credentials: [{ type: 'password', value: randomBytes(24).toString('base64url'), temporary: false }] }],
    }, 201)
    created = true
    const params = new URLSearchParams({ client_id: 'qa-reset', redirect_uri: callback, response_type: 'code', scope: 'openid',
      state: randomUUID(), code_challenge_method: 'S256', code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url') })
    let page = await browse(`${base}/realms/${realm}/protocol/openid-connect/auth?${params}`)
    const enlace = page.html.match(/href="([^"]*login-actions\/reset-credentials[^"]*)"/)
    assert.ok(enlace, 'Con la recuperación encendida, «Olvidé mi contraseña» lleva a pedir el enlace')
    page = await browse(new URL(decode(enlace[1]), page.url).href)
    assert.ok(page.html.includes('name="username"'), 'Pide el correo de la cuenta')
    page = await browse(form(page), new URLSearchParams({ username: 'qa-reset@example.invalid' }))
    for (let espera = 0; !mensajes.length && espera < 100; espera++) await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(mensajes.length, 1, 'Keycloak debe entregar un mensaje al servidor de correo configurado')
    const [mensaje] = mensajes
    assert.equal(mensaje.usuario, 'usuario@example')
    assert.equal(mensaje.de, 'acceso@zenit.example')
    assert.deepEqual(mensaje.para, ['qa-reset@example.invalid'])
    assert.match(mensaje.datos, /^From: .*Zenit.*<acceso@zenit\.example>/m)
    const texto = mensaje.datos.replaceAll('=\r\n', '').replaceAll('=3D', '=')
    const token = texto.match(new RegExp(`${base}/realms/${realm}/login-actions/action-token\\?[^\\s"<>]+`))
    assert.ok(token, 'El mensaje trae el enlace para crear la contraseña')
    cookies.clear()
    page = await browse(decode(token[0]))
    // Keycloak puede pedir confirmar antes de mostrar el formulario.
    if (!page.html.includes('name="password-new"')) {
      const seguir = page.html.match(/href="([^"]*login-actions\/[^"]*)"/)
      assert.ok(seguir, 'El enlace del correo debe llevar a crear la contraseña')
      page = await browse(new URL(decode(seguir[1]), page.url).href)
    }
    assert.ok(page.html.includes('name="password-new"'), 'El enlace abre crear contraseña')
  } finally {
    servidor.close()
    if (created) await adminRequest('DELETE', `/admin/realms/${realm}`, admin, null, 204)
  }
})
