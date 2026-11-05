import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { test } from 'node:test'

const realm = JSON.parse(readFileSync(new URL('./realm/zenit-realm.json', import.meta.url), 'utf8'))

function activeExecutions(alias) {
  const flow = realm.authenticationFlows.find(flow => flow.alias === alias)
  assert.ok(flow, `Falta el flujo ${alias}`)
  return flow.authenticationExecutions.filter(step => step.requirement !== 'DISABLED')
    .flatMap(step => step.authenticatorFlow ? activeExecutions(step.flowAlias) : [step])
}

test('recuperar contraseña conserva OTP y exige iniciar sesión otra vez', () => {
  const steps = activeExecutions(realm.resetCredentialsFlow)
  assert.ok(steps.some(step => step.authenticator === 'reset-password' && step.requirement === 'REQUIRED'))
  assert.ok(!steps.some(step => step.authenticator === 'reset-otp'))
  const email = steps.find(step => step.authenticator === 'reset-credential-email')
  assert.equal(email?.requirement, 'REQUIRED')
  const config = realm.authenticatorConfig.find(config => config.alias === email.authenticatorConfig)
  assert.equal(config?.config['force-login'], 'true')
})

test('las cuentas nuevas configuran OTP y el portal usa PKCE sin acceso por contraseña', () => {
  const otp = realm.requiredActions.find(action => action.alias === 'CONFIGURE_TOTP')
  assert.equal(otp?.enabled, true)
  assert.equal(otp?.defaultAction, true)
  assert.ok(activeExecutions(realm.browserFlow).some(step => step.authenticator === 'auth-otp-form'))
  const portal = realm.clients.find(client => client.clientId === 'zenit-portal')
  assert.equal(portal?.publicClient, true)
  assert.equal(portal?.directAccessGrantsEnabled, false)
  assert.equal(portal?.attributes['pkce.code.challenge.method'], 'S256')
})

test('verificación y recuperación por correo requieren SMTP configurado', () => {
  if (realm.verifyEmail || realm.resetPasswordAllowed) {
    assert.ok(realm.smtpServer.host && realm.smtpServer.from)
  }
  assert.equal(realm.registrationAllowed, false)
  assert.equal(realm.editUsernameAllowed, false)
  assert.ok(!realm.users?.length, 'El realm no debe distribuir cuentas ni contraseñas')
})

test('Q03 ofrece recuperación como segundo factor y las cuentas nuevas guardan sus códigos', () => {
  const steps = activeExecutions(realm.browserFlow)
  assert.equal(steps.find(step => step.authenticator === 'auth-recovery-authn-code-form')?.requirement, 'ALTERNATIVE')
  assert.equal(steps.find(step => step.authenticator === 'auth-otp-form')?.requirement, 'ALTERNATIVE')
  const recovery = realm.requiredActions.find(action => action.alias === 'CONFIGURE_RECOVERY_AUTHN_CODES')
  assert.equal(recovery.enabled, true)
  assert.equal(recovery.defaultAction, true)
  const dossier = realm.authenticationFlows.find(flow => flow.alias === 'dossier-otp')
  assert.equal(dossier.authenticationExecutions.find(step => step.authenticator === 'auth-otp-form')?.requirement, 'REQUIRED')
  assert.ok(!dossier.authenticationExecutions.some(step => step.authenticator === 'auth-recovery-authn-code-form'),
    'La recuperación de acceso no sustituye el OTP nuevo por descarga de expediente')
})

test('expediente usa cliente separado, retorno exacto y OTP sin reutilizar el nivel SSO', () => {
  const client = realm.clients.find(item => item.clientId === 'zenit-dossier')
  const flow = realm.authenticationFlows.find(item => item.id === client.authenticationFlowBindingOverrides.browser)
  assert.equal(flow.alias, 'dossier-browser')
  assert.deepEqual(client.redirectUris, ['${ZENIT_PORTAL_URL}/dossier/callback'])
  assert.equal(client.directAccessGrantsEnabled, false)
  assert.equal(client.attributes['pkce.code.challenge.method'], 'S256')
  assert.equal(client.attributes['minimum.acr.value'], '2', 'El cliente no puede crear una sesión SSO sólo con contraseña')
  assert.deepEqual(JSON.parse(client.attributes['acr.loa.map']), { '1': 1, '2': 2 })
  assert.equal(realm.browserFlow, 'browser', 'El acceso normal conserva su flujo')
  const steps = activeExecutions(flow.alias)
  assert.ok(steps.some(item => item.authenticator === 'auth-otp-form' && item.requirement === 'REQUIRED'))
  const level = realm.authenticatorConfig.find(item => item.alias === 'dossier-level-2')
  assert.equal(level.config['loa-condition-level'], '2')
  assert.equal(level.config['loa-max-age'], '0')
})

test('el login sirve sus estilos y scripts con el sistema de archivos de sólo lectura', {
  skip: !process.env.IDENTITY_TEST_SECRETOS,
}, async () => {
  const base = process.env.IDENTITY_TEST_URL || 'http://localhost:38082'
  const login = new URL(`${base}/realms/zenit/protocol/openid-connect/auth`)
  login.search = new URLSearchParams({ client_id: 'zenit-portal', redirect_uri: process.env.IDENTITY_TEST_PORTAL_URL || 'http://localhost:8081/',
    response_type: 'code', scope: 'openid', code_challenge_method: 'S256',
    code_challenge: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG' }).toString()
  const response = await fetch(login, { signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, 200)
  const html = await response.text()
  const resources = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => new URL(match[1], base))
    .filter(url => url.origin === base && url.pathname.startsWith('/resources/') && /\.(css|js)$/.test(url.pathname))
  assert.ok(resources.some(url => url.pathname.endsWith('.css')), 'El formulario debe incluir sus estilos')
  assert.ok(resources.some(url => url.pathname.endsWith('.js')), 'El formulario debe incluir sus scripts')
  for (const url of resources) {
    const asset = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' }, signal: AbortSignal.timeout(10000) })
    assert.equal(asset.status, 200, `Recurso de acceso ${url.pathname}`)
    assert.ok((await asset.text()).length > 0)
  }
})

test('Keycloak importa la protección del OTP y la reautenticación', {
  skip: !process.env.IDENTITY_TEST_SECRETOS,
}, async () => {
  const base = process.env.IDENTITY_TEST_URL || 'http://localhost:38082'
  const password = readFileSync(join(process.env.IDENTITY_TEST_SECRETOS, 'keycloak_admin_password'), 'utf8').trim()
  const login = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password }),
    signal: AbortSignal.timeout(10000),
  })
  assert.equal(login.status, 200, 'Debe autenticar la cuenta de arranque del ensayo')
  const { access_token } = await login.json()
  assert.ok(access_token)
  async function get(path) {
    const response = await fetch(`${base}/admin/realms/zenit${path}`, {
      headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(10000),
    })
    assert.equal(response.status, 200, `Consulta de configuración ${path}`)
    return response.json()
  }
  const imported = await get('')
  assert.equal(imported.resetPasswordAllowed, false, 'No habilitar recuperación sin correo operativo')
  assert.equal(imported.verifyEmail, false, 'No habilitar verificación sin correo operativo')
  const steps = await get('/authentication/flows/reset%20credentials/executions')
  const otp = steps.find(step => step.displayName === 'Reset - Conditional OTP')
  assert.equal(otp?.requirement, 'DISABLED')
  const email = steps.find(step => step.providerId === 'reset-credential-email')
  assert.equal(email?.requirement, 'REQUIRED')
  assert.ok(email.authenticationConfig)
  const config = await get(`/authentication/config/${email.authenticationConfig}`)
  assert.equal(config.config['force-login'], 'true')
  const actions = await get('/authentication/required-actions')
  assert.equal(actions.find(action => action.alias === 'CONFIGURE_TOTP')?.defaultAction, true)
  assert.equal(actions.find(action => action.alias === 'CONFIGURE_RECOVERY_AUTHN_CODES')?.defaultAction, true)
  const browser = await get('/authentication/flows/browser/executions')
  assert.equal(browser.find(step => step.providerId === 'auth-recovery-authn-code-form')?.requirement, 'ALTERNATIVE')
})

test('despliegue Q03 actualiza un realm existente y repetirlo conserva clientes y credenciales', {
  skip: !process.env.IDENTITY_TEST_SECRETOS, timeout: 120000,
}, async () => {
  const base = process.env.IDENTITY_TEST_URL || 'http://localhost:38082'
  const secretos = process.env.IDENTITY_TEST_SECRETOS
  const password = readFileSync(join(secretos, 'keycloak_admin_password'), 'utf8').trim()
  const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password }),
    signal: AbortSignal.timeout(10000),
  })
  assert.equal(response.status, 200)
  const { access_token } = await response.json()
  const prefix = `${base}/admin/realms/zenit`
  const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }
  const actions = await (await fetch(`${prefix}/authentication/required-actions`, { headers })).json()
  const action = actions.find(item => item.alias === 'CONFIGURE_RECOVERY_AUTHN_CODES')
  assert.equal((await fetch(`${prefix}/authentication/required-actions/${action.alias}`, {
    method: 'PUT', headers, body: JSON.stringify({ ...action, defaultAction: false }),
  })).status, 204)
  const route = `${prefix}/authentication/flows/browser/executions`
  const steps = await (await fetch(route, { headers })).json()
  const recovery = steps.find(item => item.providerId === 'auth-recovery-authn-code-form')
  assert.ok([202, 204].includes((await fetch(route, {
    method: 'PUT', headers, body: JSON.stringify({ ...recovery, requirement: 'DISABLED' }),
  })).status))
  mkdirSync(join(secretos, 'identity-admin'), { recursive: true })
  const env = { ...process.env, KEYCLOAK_URL: base, SECRETOS: secretos,
    PORTAL_URL: process.env.IDENTITY_TEST_PORTAL_URL || 'http://localhost:8081',
    REALM_FILE: fileURLToPath(new URL('./realm/zenit-realm.json', import.meta.url)) }
  for (let attempt = 0; attempt < 2; attempt++) {
    const output = execFileSync(process.execPath, ['deploy/servidor/zenit/identidad.mjs'], {
      env, encoding: 'utf8', timeout: 50000,
    })
    assert.match(output, /recuperación Q03: códigos habilitados/)
  }
  const after = await (await fetch(route, { headers })).json()
  assert.equal(after.find(item => item.id === recovery.id)?.requirement, 'ALTERNATIVE')
  assert.equal(after.find(item => item.providerId === 'auth-otp-form')?.requirement, 'ALTERNATIVE')
})
