// Aplica al realm del servidor lo que el realm versionado agrega y Keycloak no
// importa: con --import-realm, un realm que ya existe se omite completo. Crea
// los clientes indicados con sus flujos y el cliente técnico del cambio
// obligatorio de contraseña; lo que ya existe sólo se comprueba. Nunca
// sobrescribe ni borra: ante una diferencia se detiene y la explica.
//
//   node identidad.mjs [clientId ...]      # por omisión, zenit-dossier
//
// Lo corre remoto.sh en cada despliegue, con el perfil `identidad` de
// deploy/servidor/zenit/compose.yaml. No muestra contraseñas ni secretos.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { chmod, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const base = (process.env.KEYCLOAK_URL || 'http://keycloak:8082').replace(/\/$/, '')
const secretos = process.env.SECRETOS || '/secretos'
const portal = process.env.PORTAL_URL || ''
const usuario = process.env.ADMIN_USER || 'arranque'
const clientes = process.argv.length > 2 ? process.argv.slice(2) : ['zenit-dossier']
const tecnico = 'zenit-password-admin'
assert.match(portal, /^https?:\/\/[^/]+$/, 'PORTAL_URL debe ser el origen del portal, sin ruta')

const realm = JSON.parse(await readFile(process.env.REALM_FILE || '/realm/zenit-realm.json', 'utf8'))
const prefijo = `/admin/realms/${encodeURIComponent(realm.realm)}`
const flujos = new Map(realm.authenticationFlows.map(flujo => [flujo.alias, flujo]))
const configuraciones = new Map((realm.authenticatorConfig || []).map(config => [config.alias, config.config]))
const contrasena = (await readFile(join(secretos, 'keycloak_admin_password'), 'utf8')).trim()

async function pedir(method, path, token, body, esperado = [200]) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) },
    body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000), redirect: 'manual',
  })
  assert.ok(esperado.includes(response.status), `${method} ${path}: ${response.status}`)
  return response
}

// El token de la consola dura poco; se renueva antes de que venza.
let sesion = { token: '', hasta: 0 }
async function admin() {
  if (Date.now() < sesion.hasta) return sesion.token
  const respuesta = await (await pedir('POST', '/realms/master/protocol/openid-connect/token', null,
    new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: usuario, password: contrasena }))).json()
  sesion = { token: respuesta.access_token, hasta: Date.now() + (respuesta.expires_in - 15) * 1000 }
  return sesion.token
}
const leer = async path => (await pedir('GET', path, await admin())).json()
const escribir = async (method, path, body, esperado) => pedir(method, path, await admin(), body, esperado)
const porPrioridad = pasos => [...pasos].sort((a, b) => a.priority - b.priority)
const nombre = paso => paso.authenticatorFlow ? paso.flowAlias : paso.authenticator

function esperado(alias, nivel = 0) {
  const flujo = flujos.get(alias)
  assert.ok(flujo, `El realm versionado no define el flujo ${alias}`)
  return porPrioridad(flujo.authenticationExecutions).flatMap(paso => [
    { nivel, requisito: paso.requirement, nombre: nombre(paso), config: paso.authenticatorConfig
      ? { alias: paso.authenticatorConfig, valores: configuraciones.get(paso.authenticatorConfig) } : null },
    ...(paso.authenticatorFlow ? esperado(paso.flowAlias, nivel + 1) : []),
  ])
}

async function vigente(alias) {
  const pasos = await leer(`${prefijo}/authentication/flows/${encodeURIComponent(alias)}/executions`)
  return Promise.all(pasos.map(async paso => ({
    nivel: paso.level, requisito: paso.requirement,
    nombre: paso.authenticationFlow ? paso.displayName : paso.providerId,
    config: paso.authenticationConfig ? await leer(`${prefijo}/authentication/config/${paso.authenticationConfig}`)
      .then(config => ({ alias: config.alias, valores: config.config })) : null,
  })))
}

// Agrega en orden los pasos de un flujo recién creado; los subflujos, igual.
async function crearPasos(alias) {
  const ruta = `${prefijo}/authentication/flows/${encodeURIComponent(alias)}/executions`
  for (const paso of porPrioridad(flujos.get(alias).authenticationExecutions)) {
    if (paso.authenticatorFlow) {
      const subflujo = flujos.get(paso.flowAlias)
      assert.ok(subflujo, `El realm versionado no define el subflujo ${paso.flowAlias}`)
      await escribir('POST', `${ruta}/flow`, { alias: subflujo.alias, type: subflujo.providerId,
        provider: 'registration-page-form', description: subflujo.description || '' }, [201])
    } else {
      await escribir('POST', `${ruta}/execution`, { provider: paso.authenticator }, [201])
    }
    const nuevo = (await leer(ruta)).filter(item => item.level === 0).at(-1)
    assert.equal(nuevo.authenticationFlow ? nuevo.displayName : nuevo.providerId, nombre(paso))
    await escribir('PUT', ruta, { ...nuevo, requirement: paso.requirement }, [202, 204])
    if (paso.authenticatorConfig) {
      await escribir('POST', `${prefijo}/authentication/executions/${nuevo.id}/config`,
        { alias: paso.authenticatorConfig, config: configuraciones.get(paso.authenticatorConfig) }, [201])
    }
    if (paso.authenticatorFlow) await crearPasos(paso.flowAlias)
  }
}

const idsDeFlujo = new Map()
async function asegurarFlujo(alias) {
  if (idsDeFlujo.has(alias)) return idsDeFlujo.get(alias)
  const definicion = flujos.get(alias)
  assert.ok(definicion?.topLevel, `El flujo ${alias} no es de primer nivel en el realm versionado`)
  const buscar = async () => (await leer(`${prefijo}/authentication/flows`)).find(flujo => flujo.alias === alias)
  let actual = await buscar()
  if (!actual) {
    await escribir('POST', `${prefijo}/authentication/flows`, { alias, description: definicion.description || '',
      providerId: definicion.providerId, topLevel: true, builtIn: false }, [201])
    await crearPasos(alias)
    actual = await buscar()
    console.log(`flujo ${alias}: creado`)
  }
  assert.deepEqual(await vigente(alias), esperado(alias), `El flujo ${alias} del servidor difiere del versionado; no se sobrescribe`)
  idsDeFlujo.set(alias, actual.id)
  return actual.id
}

function sustituir(valor) {
  if (typeof valor === 'string') return valor.replaceAll('${ZENIT_PORTAL_URL}', portal)
  if (Array.isArray(valor)) return valor.map(sustituir)
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sustituir(v)]))
  return valor
}

const alcancesDe = async (id, tipo) => (await leer(`${prefijo}/clients/${id}/${tipo}-client-scopes`)).map(a => a.name).sort()

// Al crear un cliente, Keycloak le agrega los alcances por omisión del realm.
async function alinearAlcances(id, tipo, deseados) {
  const todos = await leer(`${prefijo}/client-scopes`)
  for (const alcance of await leer(`${prefijo}/clients/${id}/${tipo}-client-scopes`)) {
    if (!deseados.includes(alcance.name)) await escribir('DELETE', `${prefijo}/clients/${id}/${tipo}-client-scopes/${alcance.id}`, null, [204])
  }
  const actuales = await alcancesDe(id, tipo)
  for (const name of deseados.filter(item => !actuales.includes(item))) {
    const alcance = todos.find(item => item.name === name)
    assert.ok(alcance, `El realm del servidor no tiene el alcance ${name}`)
    await escribir('PUT', `${prefijo}/clients/${id}/${tipo}-client-scopes/${alcance.id}`, null, [204])
  }
}

async function asegurarCliente(clientId) {
  const definicion = realm.clients.find(cliente => cliente.clientId === clientId)
  assert.ok(definicion, `El realm versionado no define el cliente ${clientId}`)
  const deseado = sustituir(structuredClone(definicion))
  const overrides = {}
  for (const [tipo, idVersionado] of Object.entries(definicion.authenticationFlowBindingOverrides || {})) {
    const alias = realm.authenticationFlows.find(flujo => flujo.id === idVersionado)?.alias
    assert.ok(alias, `El cliente ${clientId} apunta a un flujo sin alias en el realm versionado`)
    overrides[tipo] = await asegurarFlujo(alias)
  }
  deseado.authenticationFlowBindingOverrides = overrides
  const buscar = async () => (await leer(`${prefijo}/clients?clientId=${encodeURIComponent(clientId)}`))[0]
  let actual = await buscar()
  if (!actual) {
    await escribir('POST', `${prefijo}/clients`, deseado, [201])
    actual = await buscar()
    await alinearAlcances(actual.id, 'default', deseado.defaultClientScopes || [])
    await alinearAlcances(actual.id, 'optional', deseado.optionalClientScopes || [])
    console.log(`cliente ${clientId}: creado`)
  }
  const diferencias = []
  for (const campo of ['enabled', 'publicClient', 'protocol', 'standardFlowEnabled', 'implicitFlowEnabled',
    'directAccessGrantsEnabled', 'serviceAccountsEnabled', 'fullScopeAllowed', 'authenticationFlowBindingOverrides']) {
    if (campo in deseado && JSON.stringify(actual[campo]) !== JSON.stringify(deseado[campo])) diferencias.push(campo)
  }
  for (const campo of ['redirectUris', 'webOrigins']) {
    if (JSON.stringify([...(actual[campo] || [])].sort()) !== JSON.stringify([...(deseado[campo] || [])].sort())) diferencias.push(campo)
  }
  for (const [clave, valor] of Object.entries(deseado.attributes || {})) {
    if (actual.attributes?.[clave] !== valor) diferencias.push(`attributes.${clave}`)
  }
  for (const mapeo of deseado.protocolMappers || []) {
    const vigenteMapeo = (actual.protocolMappers || []).find(item => item.name === mapeo.name)
    if (!vigenteMapeo || vigenteMapeo.protocolMapper !== mapeo.protocolMapper ||
      Object.entries(mapeo.config).some(([clave, valor]) => vigenteMapeo.config?.[clave] !== valor)) diferencias.push(`protocolMappers.${mapeo.name}`)
  }
  for (const tipo of ['default', 'optional']) {
    const deseados = [...(deseado[`${tipo}ClientScopes`] || [])].sort()
    if (JSON.stringify(await alcancesDe(actual.id, tipo)) !== JSON.stringify(deseados)) diferencias.push(`${tipo}ClientScopes`)
  }
  assert.deepEqual(diferencias, [], `El cliente ${clientId} del servidor difiere del versionado; no se sobrescribe`)
  return deseado
}

// Comprueba sin cuentas que el cliente abre su inicio de sesión con PKCE y que
// rechaza un retorno ajeno.
async function probarInicio(cliente) {
  const [retorno] = cliente.redirectUris
  const verificador = randomBytes(32).toString('base64url')
  const direccion = retornoUsado => `/realms/${encodeURIComponent(realm.realm)}/protocol/openid-connect/auth?${new URLSearchParams({
    client_id: cliente.clientId, redirect_uri: retornoUsado, response_type: 'code', scope: 'openid',
    state: randomBytes(16).toString('hex'), nonce: randomBytes(16).toString('hex'),
    code_challenge: createHash('sha256').update(verificador).digest('base64url'), code_challenge_method: 'S256',
  })}`
  const pagina = await (await pedir('GET', direccion(retorno), null, null, [200])).text()
  assert.match(pagina, /name="username"/, `El cliente ${cliente.clientId} no abrió el formulario de inicio de sesión`)
  await pedir('GET', direccion('https://ajeno.invalid/dossier/callback'), null, null, [400])
}

async function asegurarTecnico() {
  const buscar = async () => (await leer(`${prefijo}/clients?clientId=${tecnico}`))[0]
  let cliente = await buscar()
  if (!cliente) {
    await escribir('POST', `${prefijo}/clients`, { clientId: tecnico, enabled: true, publicClient: false,
      serviceAccountsEnabled: true, standardFlowEnabled: false, directAccessGrantsEnabled: false, fullScopeAllowed: false }, [201])
    cliente = await buscar()
    console.log(`cliente ${tecnico}: creado`)
  }
  assert.ok(cliente.enabled && !cliente.publicClient && cliente.serviceAccountsEnabled && !cliente.standardFlowEnabled &&
    !cliente.directAccessGrantsEnabled && !cliente.fullScopeAllowed, `Configuración inesperada en ${tecnico}; no se sobrescribe`)
  const cuenta = await leer(`${prefijo}/clients/${cliente.id}/service-account-user`)
  const gestion = (await leer(`${prefijo}/clients?clientId=realm-management`))[0]
  const rol = await leer(`${prefijo}/clients/${gestion.id}/roles/manage-users`)
  for (const ruta of [`${prefijo}/users/${cuenta.id}/role-mappings/clients/${gestion.id}`,
    `${prefijo}/clients/${cliente.id}/scope-mappings/clients/${gestion.id}`]) {
    const asignados = await leer(ruta)
    assert.ok(asignados.every(item => item.name === 'manage-users'), `${tecnico} tiene permisos administrativos ajenos`)
    if (!asignados.length) await escribir('POST', ruta, [rol], [204])
  }
  const secreto = (await leer(`${prefijo}/clients/${cliente.id}/client-secret`)).value
  assert.ok(typeof secreto === 'string' && secreto.length > 10)
  const concedido = await (await pedir('POST', `/realms/${encodeURIComponent(realm.realm)}/protocol/openid-connect/token`, null,
    new URLSearchParams({ grant_type: 'client_credentials', client_id: tecnico, client_secret: secreto }))).json()
  const claims = JSON.parse(Buffer.from(concedido.access_token.split('.')[1], 'base64url').toString())
  assert.deepEqual(claims.resource_access?.['realm-management']?.roles, ['manage-users'])
  await pedir('GET', `${prefijo}/clients`, concedido.access_token, null, [403])

  // El backend lo lee al arrancar; remoto.sh lo reinicia si cambió.
  const carpeta = join(secretos, 'identity-admin')
  const destino = join(carpeta, 'identity_admin_client_secret')
  await chmod(carpeta, 0o755)
  if ((await readFile(destino, 'utf8').catch(() => null)) === secreto) {
    console.log(`cliente ${tecnico}: comprobado; secreto sin cambios`)
    return
  }
  // Sin capacidades no se puede abrir para escribir un archivo de sólo
  // lectura: se escribe uno nuevo y se reemplaza por renombrado, que además
  // evita que el backend lea un secreto a medias.
  const nuevo = `${destino}.nuevo`
  await rm(nuevo, { force: true })
  await writeFile(nuevo, secreto, { mode: 0o444 })
  await chmod(nuevo, 0o444)
  await rename(nuevo, destino)
  console.log(`cliente ${tecnico}: comprobado; secreto guardado para el backend`)
}

for (const clientId of clientes) {
  const cliente = await asegurarCliente(clientId)
  if (cliente.standardFlowEnabled && cliente.redirectUris?.length) await probarInicio(cliente)
  console.log(`cliente ${clientId}: comprobado`)
}
await asegurarTecnico()
console.log('identidad lista: el realm del servidor tiene lo que agrega el versionado')
