import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('Keycloak importa la protección del OTP y la reautenticación', {
  skip: !process.env.IDENTITY_TEST_SECRETOS,
}, async () => {
  const base = 'http://localhost:38082'
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
})
