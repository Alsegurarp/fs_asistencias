import assert from 'node:assert/strict'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { test } from 'node:test'

const configured = JSON.parse(readFileSync(new URL('./realm/zenit-realm.json', import.meta.url), 'utf8'))
// Como lo hace el despliegue: los clientes versionados con la dirección pública del portal.
const portal = 'https://auditoria.example.invalid/auditoria'
const cliente = archivo => JSON.parse(readFileSync(new URL(`../../audit-portal/${archivo}`, import.meta.url), 'utf8')
  .replaceAll('https://auditoria.example', portal))

// Un servidor SMTP mínimo, sin TLS ni autenticación, que guarda lo que recibe.
function buzon() {
  const mensajes = []
  const servidor = createServer(socket => {
    let pendiente = '', enDatos = false, datos = ''
    const decir = linea => socket.write(`${linea}\r\n`)
    socket.on('error', () => {})
    socket.on('data', trozo => {
      pendiente += trozo.toString('latin1')
      for (let fin; (fin = pendiente.indexOf('\r\n')) >= 0;) {
        const linea = pendiente.slice(0, fin)
        pendiente = pendiente.slice(fin + 2)
        if (enDatos) {
          if (linea === '.') { enDatos = false; mensajes.push(datos); datos = ''; decir('250 2.0.0 recibido') }
          else datos += `${linea.replace(/^\./, '')}\r\n`
          continue
        }
        const comando = linea.split(' ')[0].toUpperCase()
        if (comando === 'DATA') { enDatos = true; decir('354 adelante') }
        else if (comando === 'QUIT') { decir('221 2.0.0 adiós'); socket.end() }
        else decir('250 2.0.0 hecho')
      }
    })
    decir('220 buzon ESMTP')
  })
  return new Promise(resolve => servidor.listen(0, '0.0.0.0', () => resolve({ servidor, mensajes, puerto: servidor.address().port })))
}

test('el auditor nuevo recibe un solo correo: activa su cuenta y vuelve a su enlace de invitación', {
  skip: !process.env.IDENTITY_TEST_SECRETOS, timeout: 90000,
}, async () => {
  const base = process.env.IDENTITY_TEST_URL || 'http://localhost:38082'
  const realm = `qa-audit-activation-${randomUUID()}`
  const invitacion = `${portal}/#invitacion=${randomBytes(32).toString('base64url')}`
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
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body,
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], split = pair.indexOf('=')
      cookies.set(pair.slice(0, split), pair.slice(split + 1))
    }
    if ([302, 303].includes(response.status)) return browse(new URL(response.headers.get('Location'), url).href)
    assert.equal(response.status, 200, url)
    return { html: await response.text(), url }
  }
  const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  const form = page => new URL(decode(page.html.match(/<form\b[^>]*action="([^"]+)"/)[1]), page.url).href
  const secret = readFileSync(join(process.env.IDENTITY_TEST_SECRETOS, 'keycloak_admin_password'), 'utf8').trim()
  const admin = (await (await adminRequest('POST', '/realms/master/protocol/openid-connect/token', null,
    new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password: secret }))).json()).access_token
  const { servidor, mensajes, puerto } = await buzon()
  let created = false
  try {
    await adminRequest('POST', '/admin/realms', admin, {
      realm, enabled: true, sslRequired: 'none', loginTheme: configured.loginTheme,
      internationalizationEnabled: configured.internationalizationEnabled,
      supportedLocales: configured.supportedLocales, defaultLocale: configured.defaultLocale,
      browserFlow: configured.browserFlow, requiredActions: configured.requiredActions,
      otpPolicyType: 'totp', otpPolicyAlgorithm: 'HmacSHA1', otpPolicyDigits: 6, otpPolicyPeriod: 30,
      authenticationFlows: configured.authenticationFlows.map(flow => ({ ...flow, id: randomUUID() })),
      authenticatorConfig: configured.authenticatorConfig.map(config => ({ ...config, id: randomUUID() })),
      smtpServer: { host: process.env.IDENTITY_TEST_SMTP_HOST || 'host.docker.internal', port: String(puerto),
        from: 'acceso@zenit.example', auth: 'false', ssl: 'false', starttls: 'false' },
      clients: [cliente('keycloak-client.json'), cliente('keycloak-activation-client.json')],
      // Como la crea el backend: sin contraseña y con las tres acciones pendientes.
      users: [{ username: 'zenit-audit-qa', email: 'auditor@example.invalid', enabled: true, emailVerified: false,
        firstName: 'Auditoría', lastName: 'Externa', requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD', 'CONFIGURE_TOTP'] }],
    }, 201)
    created = true
    const [usuario] = await (await adminRequest('GET', `/admin/realms/${realm}/users?username=zenit-audit-qa&exact=true`, admin)).json()
    const enviar = clientId => fetch(`${base}/admin/realms/${realm}/users/${usuario.id}/execute-actions-email?${new URLSearchParams({
      lifespan: '259200', client_id: clientId, redirect_uri: invitacion })}`, {
      method: 'PUT', signal: AbortSignal.timeout(10000), body: JSON.stringify(['VERIFY_EMAIL', 'UPDATE_PASSWORD', 'CONFIGURE_TOTP']),
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' } })

    // El cliente del portal sólo admite su retorno exacto: por eso existe el de activación.
    assert.equal((await enviar('zenit-audit-portal')).status, 400)
    // El de activación no puede iniciar sesiones aunque su retorno sea amplio.
    const intento = await fetch(`${base}/realms/${realm}/protocol/openid-connect/auth?${new URLSearchParams({
      client_id: 'zenit-audit-activation', redirect_uri: `${portal}/?action=callback`, response_type: 'code', scope: 'openid',
      state: randomUUID(), code_challenge_method: 'S256', code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url') })}`,
    { redirect: 'manual', signal: AbortSignal.timeout(10000) })
    assert.equal(new URL(intento.headers.get('Location')).searchParams.get('error'), 'unauthorized_client')

    assert.equal((await enviar('zenit-audit-activation')).status, 204)
    for (let espera = 0; !mensajes.length && espera < 100; espera++) await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(mensajes.length, 1, 'Keycloak manda un solo correo')
    const texto = mensajes[0].replaceAll('=\r\n', '').replaceAll('=3D', '=')
    const enlace = texto.match(new RegExp(`${base}/realms/${realm}/login-actions/action-token\\?[^\\s"<>]+`))
    assert.ok(enlace, 'El correo trae el enlace de activación')

    let page = await browse(decode(enlace[0]))
    const hechos = []
    for (let paso = 0; paso < 8; paso++) {
      const vuelta = [...page.html.matchAll(/href="([^"]+)"/g)].map(match => decode(match[1])).find(href => href.startsWith(portal))
      if (vuelta) {
        assert.deepEqual([...hechos].sort(), ['contraseña', 'segundo factor'], 'Antes de volver crea su contraseña y su segundo factor')
        assert.equal(vuelta, invitacion, 'Al terminar, vuelve al enlace de invitación con su token')
        return
      }
      if (page.html.includes('name="password-new"')) {
        hechos.push('contraseña')
        const nueva = `${randomBytes(18).toString('base64url')}#Aa1`
        page = await browse(form(page), new URLSearchParams({ 'password-new': nueva, 'password-confirm': nueva }))
      } else if (page.html.includes('name="totpSecret"')) {
        hechos.push('segundo factor')
        const totpSecret = decode(page.html.match(/name="totpSecret"[^>]*value="([^"]+)"/)[1])
        const counter = Buffer.alloc(8)
        counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
        const digest = createHmac('sha1', Buffer.from(totpSecret)).update(counter).digest()
        const totp = String((digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff) % 1000000).padStart(6, '0')
        page = await browse(form(page), new URLSearchParams({ totp, totpSecret, userLabel: 'QA' }))
      } else {
        // Keycloak pide confirmar el correo con un enlace antes de seguir.
        const seguir = page.html.match(/href="([^"]*login-actions\/[^"]*)"/)
        assert.ok(seguir, `Paso inesperado de la activación: ${page.url}`)
        page = await browse(new URL(decode(seguir[1]), page.url).href)
      }
    }
    assert.fail('La activación no terminó en el enlace de invitación')
  } finally {
    servidor.close()
    if (created) await adminRequest('DELETE', `/admin/realms/${realm}`, admin, null, 204)
  }
})
