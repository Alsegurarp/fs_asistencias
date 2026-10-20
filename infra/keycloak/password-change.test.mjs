import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

test('cliente técnico de contraseña conserva OTP y otras acciones, sin privilegios de realm ni clientes', {
  skip: !process.env.IDENTITY_TEST_SECRETOS,
}, async () => {
  const base = 'http://localhost:38082'
  async function request(method, path, token, body, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) },
      body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    assert.equal(response.status, expected, `${method} ${path}`)
    return response
  }
  const password = readFileSync(join(process.env.IDENTITY_TEST_SECRETOS, 'keycloak_admin_password'), 'utf8').trim()
  const login = await request('POST', '/realms/master/protocol/openid-connect/token', null,
    new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password }))
  const admin = (await login.json()).access_token
  const prefix = '/admin/realms/zenit'
  let clientId, userId
  try {
    const clientName = `qa-password-${randomUUID()}`
    const client = await request('POST', `${prefix}/clients`, admin, { clientId: clientName, enabled: true, publicClient: false,
      serviceAccountsEnabled: true, standardFlowEnabled: false, directAccessGrantsEnabled: false, fullScopeAllowed: false }, 201)
    clientId = client.headers.get('Location').split('/').at(-1)
    const account = await (await request('GET', `${prefix}/clients/${clientId}/service-account-user`, admin)).json()
    const realmManagement = await (await request('GET', `${prefix}/clients?clientId=realm-management`, admin)).json()
    const role = await (await request('GET', `${prefix}/clients/${realmManagement[0].id}/roles/manage-users`, admin)).json()
    await request('POST', `${prefix}/users/${account.id}/role-mappings/clients/${realmManagement[0].id}`, admin, [role], 204)
    await request('POST', `${prefix}/clients/${clientId}/scope-mappings/clients/${realmManagement[0].id}`, admin, [role], 204)
    const secret = await (await request('GET', `${prefix}/clients/${clientId}/client-secret`, admin)).json()
    const grant = await request('POST', '/realms/zenit/protocol/openid-connect/token', null,
      new URLSearchParams({ grant_type: 'client_credentials', client_id: clientName, client_secret: secret.value }))
    const technical = (await grant.json()).access_token
    const created = await request('POST', `${prefix}/users`, admin, {
      username: `qa-${randomUUID()}@example.invalid`, email: 'qa-password@example.invalid', emailVerified: true, enabled: true,
      requiredActions: ['VERIFY_EMAIL'], credentials: [{ type: 'otp', userLabel: 'QA OTP',
        secretData: JSON.stringify({ value: 'JBSWY3DPEHPK3PXP' }), credentialData: JSON.stringify({ subType: 'totp', digits: 6, period: 30, algorithm: 'HmacSHA1' }) }],
    }, 201)
    userId = created.headers.get('Location').split('/').at(-1)
    const credentials = await (await request('GET', `${prefix}/users/${userId}/credentials`, admin)).json()
    assert.ok(credentials.some(item => item.type === 'otp'))
    const user = await (await request('GET', `${prefix}/users/${userId}`, technical)).json()
    await request('PUT', `${prefix}/users/${userId}`, technical, { requiredActions: [...new Set([...user.requiredActions, 'UPDATE_PASSWORD'])] }, 204)
    const after = await (await request('GET', `${prefix}/users/${userId}`, admin)).json()
    assert.ok(after.requiredActions.includes('VERIFY_EMAIL') && after.requiredActions.includes('UPDATE_PASSWORD'))
    const afterCredentials = await (await request('GET', `${prefix}/users/${userId}/credentials`, admin)).json()
    assert.deepEqual(afterCredentials.map(item => [item.id, item.type]), credentials.map(item => [item.id, item.type]))
    await request('GET', `${prefix}/clients`, technical, null, 403)
    await request('PUT', prefix, technical, { displayName: 'No permitido' }, 403)
  } finally {
    if (userId) await request('DELETE', `${prefix}/users/${userId}`, admin, null, 204)
    if (clientId) await request('DELETE', `${prefix}/clients/${clientId}`, admin, null, 204)
  }
})
