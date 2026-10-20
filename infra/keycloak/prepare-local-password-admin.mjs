import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Sólo entorno local; nunca provisionar el servidor público con este guion.
const base = 'http://localhost:8082'
const clientName = 'zenit-password-admin'
const secrets = resolve('secrets')
async function request(method, path, token, body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) },
    body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000), redirect: 'error',
  })
  assert.equal(response.status, expected, `${method} ${path}`)
  return response
}
const password = (await readFile(resolve(secrets, 'keycloak_admin_password'), 'utf8')).trim()
const login = await request('POST', '/realms/master/protocol/openid-connect/token', null,
  new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password }))
const admin = (await login.json()).access_token
const prefix = '/admin/realms/zenit'
const clients = await (await request('GET', `${prefix}/clients?clientId=${clientName}`, admin)).json()
assert.ok(clients.length <= 1)
let client = clients[0]
if (!client) {
  const created = await request('POST', `${prefix}/clients`, admin, { clientId: clientName, enabled: true, publicClient: false,
    serviceAccountsEnabled: true, standardFlowEnabled: false, directAccessGrantsEnabled: false, fullScopeAllowed: false }, 201)
  client = await (await request('GET', `${prefix}/clients/${created.headers.get('Location').split('/').at(-1)}`, admin)).json()
}
assert.ok(client.enabled && !client.publicClient && client.serviceAccountsEnabled && !client.standardFlowEnabled && !client.directAccessGrantsEnabled && !client.fullScopeAllowed, 'Configuración técnica inesperada; no se sobrescribe')
const service = await (await request('GET', `${prefix}/clients/${client.id}/service-account-user`, admin)).json()
const management = (await (await request('GET', `${prefix}/clients?clientId=realm-management`, admin)).json())[0]
const role = await (await request('GET', `${prefix}/clients/${management.id}/roles/manage-users`, admin)).json()
const mappings = await (await request('GET', `${prefix}/users/${service.id}/role-mappings/clients/${management.id}`, admin)).json()
assert.ok(mappings.every(item => item.name === 'manage-users'), 'El cliente tiene permisos administrativos ajenos al ensayo')
await request('POST', `${prefix}/users/${service.id}/role-mappings/clients/${management.id}`, admin, [role], 204)
await request('POST', `${prefix}/clients/${client.id}/scope-mappings/clients/${management.id}`, admin, [role], 204)
const secret = (await (await request('GET', `${prefix}/clients/${client.id}/client-secret`, admin)).json()).value
assert.ok(typeof secret === 'string' && secret.length > 10)
const grant = await request('POST', '/realms/zenit/protocol/openid-connect/token', null,
  new URLSearchParams({ grant_type: 'client_credentials', client_id: clientName, client_secret: secret }))
const token = (await grant.json()).access_token
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
assert.deepEqual(claims.resource_access['realm-management'].roles, ['manage-users'])
await request('GET', `${prefix}/clients`, token, null, 403)
const directory = resolve(secrets, 'identity-admin')
await mkdir(directory, { recursive: true, mode: 0o700 })
const target = resolve(directory, 'identity_admin_client_secret')
await writeFile(target, secret, { mode: 0o600 })
console.log('Cliente técnico local comprobado. Secreto guardado en secrets/identity-admin/identity_admin_client_secret; no se muestra ni se cambia ninguna cuenta humana.')
console.log('Para habilitar backend local: IDENTITY_ADMIN_URL=http://keycloak:8082 y docker compose up --build --detach backend.')
