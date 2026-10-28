import assert from 'node:assert/strict'
import { createHash, createHmac, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { test } from 'node:test'

const configuredRealm = JSON.parse(readFileSync(new URL('./realm/zenit-realm.json', import.meta.url), 'utf8'))

// Importa la configuración efectiva del cliente/flujo en un realm aislado.
test('MFA del expediente exige OTP nuevo con SSO y publica el nivel realmente alcanzado', {
  skip: !process.env.IDENTITY_TEST_SECRETOS,
  timeout: 120000,
}, async t => {
  const base = process.env.IDENTITY_TEST_URL || 'http://localhost:38082'
  const realm = `qa-dossier-${randomUUID()}`
  const issuer = `${base}/realms/${realm}`
  const callback = 'http://localhost:8081/'
  const clientId = 'qa-dossier'
  const flowId = randomUUID()
  const password = randomBytes(24).toString('base64url')
  const otpSecret = randomBytes(20).toString('hex')
  const cookies = new Map()
  async function request(method, path, token, body, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) },
      body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    assert.equal(response.status, expected, `${method} ${path}`)
    return response
  }
  async function browser(url, body) {
    for (let redirects = 0; redirects < 10; redirects++) {
      const target = new URL(url)
      assert.equal(target.origin, base)
      assert.ok(target.pathname.startsWith(`/realms/${realm}/`))
      const response = await fetch(target, {
        method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body,
      })
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0]
        const split = pair.indexOf('=')
        cookies.set(pair.slice(0, split), pair.slice(split + 1))
      }
      if ([302, 303].includes(response.status)) {
        const next = new URL(response.headers.get('Location'), target)
        if (next.origin === new URL(callback).origin) {
          assert.equal(next.pathname, '/')
          return { callback: next }
        }
        url = next.href
        body = undefined
      } else {
        assert.equal(response.status, 200, 'El proveedor debe presentar el formulario')
        return { html: await response.text() }
      }
    }
    assert.fail('Demasiadas redirecciones de autenticación')
  }
  function form(page) {
    assert.ok(page.html, 'Debe pedir interacción; no puede devolver un código por SSO')
    const action = /<form\b[^>]*action="([^"]+)"/.exec(page.html)?.[1]
    assert.ok(action, 'Debe existir un formulario de autenticación')
    return action.replaceAll('&amp;', '&')
  }
  function otp(counter = Math.floor(Date.now() / 30000)) {
    const moving = Buffer.alloc(8)
    moving.writeBigUInt64BE(BigInt(counter))
    const hash = createHmac('sha1', otpSecret).update(moving).digest()
    return String((hash.readUInt32BE(hash.at(-1) & 15) & 0x7fffffff) % 1000000).padStart(6, '0')
  }
  function authorization(level, prompt, essential = true) {
    const state = randomBytes(24).toString('base64url')
    const nonce = randomBytes(24).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: 'code',
      scope: 'openid', state, nonce, code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      ...(essential ? { claims: JSON.stringify({ id_token: { acr: { essential: true, values: [String(level)] } } }) }
        : { acr_values: String(level) }),
      ...(prompt ? { prompt } : {}),
    })
    return { state, nonce, verifier, url: `${issuer}/protocol/openid-connect/auth?${params}` }
  }
  let keys
  function claims(token, audience) {
    const [encodedHeader, payload, signature] = token.split('.')
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url'))
    assert.equal(header.alg, 'RS256')
    const jwk = keys.find(key => key.kid === header.kid)
    assert.ok(jwk)
    assert.ok(verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${payload}`),
      createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signature, 'base64url')))
    const result = JSON.parse(Buffer.from(payload, 'base64url'))
    assert.equal(result.iss, issuer)
    assert.ok([result.aud].flat().includes(audience))
    assert.ok(result.exp > Date.now() / 1000)
    return result
  }
  async function exchange(page, auth) {
    assert.ok(page.callback, 'La autenticación completa debe devolver el código')
    assert.equal(page.callback.searchParams.get('state'), auth.state)
    assert.equal(page.callback.searchParams.get('error'), null)
    const code = page.callback.searchParams.get('code')
    assert.ok(code)
    const response = await request('POST', `/realms/${realm}/protocol/openid-connect/token`, null,
      new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: callback,
        code, code_verifier: auth.verifier }))
    const tokens = await response.json()
    const id = claims(tokens.id_token, clientId)
    const access = claims(tokens.access_token, 'zenit-api')
    assert.equal(id.nonce, auth.nonce)
    assert.equal(id.sub, access.sub)
    assert.equal(id.acr, access.acr)
    return { ...tokens, id, access }
  }
  const adminPassword = readFileSync(join(process.env.IDENTITY_TEST_SECRETOS, 'keycloak_admin_password'), 'utf8').trim()
  const login = await request('POST', '/realms/master/protocol/openid-connect/token', null,
    new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password: adminPassword }))
  const admin = (await login.json()).access_token
  let created = false
  try {
    await request('POST', '/admin/realms', admin, {
      realm, enabled: true, sslRequired: 'none', registrationAllowed: false,
      browserFlow: 'dossier-browser', otpPolicyType: 'totp', otpPolicyAlgorithm: 'HmacSHA1',
      otpPolicyDigits: 6, otpPolicyPeriod: 30, otpPolicyLookAheadWindow: 1, otpPolicyCodeReusable: false,
      authenticationFlows: configuredRealm.authenticationFlows.filter(item => item.alias.startsWith('dossier-')).map(item => ({
        ...item, id: item.alias === 'dossier-browser' ? flowId : randomUUID(),
      })),
      authenticatorConfig: configuredRealm.authenticatorConfig.filter(item => item.alias.startsWith('dossier-')),
      clients: [{ ...configuredRealm.clients.find(item => item.clientId === 'zenit-dossier'), clientId,
        redirectUris: [callback], authenticationFlowBindingOverrides: { browser: flowId },
      }],
      users: [{ username: 'qa-dossier', enabled: true, email: 'qa-dossier@example.invalid', emailVerified: true,
        firstName: 'QA', lastName: 'Expediente', requiredActions: [], credentials: [
          { type: 'password', value: password, temporary: false },
          { type: 'otp', secretData: JSON.stringify({ value: otpSecret }),
            credentialData: JSON.stringify({ subType: 'totp', digits: 6, period: 30, algorithm: 'HmacSHA1' }) },
        ] }],
    }, 201)
    created = true
    keys = (await (await request('GET', `/realms/${realm}/protocol/openid-connect/certs`)).json()).keys

    const rejectedLevel = await fetch(authorization(1).url, { redirect: 'manual', signal: AbortSignal.timeout(10000) })
    assert.equal(rejectedLevel.status, 400, 'Una petición de ACR esencial inferior al mínimo se rechaza')
    const lowAuth = authorization(1, undefined, false)
    const loginPage = await browser(lowAuth.url)
    assert.match(loginPage.html, /name="password"/)
    let initial = await browser(form(loginPage), new URLSearchParams({ username: 'qa-dossier', password }))
    assert.match(initial.html, /name="otp"/, 'El mínimo del cliente impide crear SSO sin OTP aunque se solicite ACR 1')
    const initialCounter = Math.floor(Date.now() / 30000)
    const initialOtp = otp(initialCounter)
    const low = await exchange(await browser(form(initial), new URLSearchParams({ otp: initialOtp })), lowAuth)
    assert.equal(low.access.acr, '2', 'El cliente exige nivel 2 incluso si la URL pide nivel 1')

    const firstAuth = authorization(2)
    let page = await browser(firstAuth.url)
    assert.match(page.html, /name="otp"/, 'SSO debe pedir el segundo factor')
    const currentCounter = Math.floor(Date.now() / 30000)
    const valid = [-1, 0, 1].map(offset => otp(currentCounter + offset))
    const wrong = ['000000', '111111', '222222', '333333'].find(code => !valid.includes(code))
    page = await browser(form(page), new URLSearchParams({ otp: wrong }))
    assert.ok(!page.callback, 'Un OTP incorrecto no emite un código')
    assert.match(page.html, /name="otp"/)
    page = await browser(form(page), new URLSearchParams({ otp: initialOtp }))
    assert.ok(!page.callback, 'El OTP del login anterior no puede reutilizarse')
    await setTimeout(Math.max(0, (initialCounter + 1) * 30000 - Date.now() + 1000))
    const counter = Math.floor(Date.now() / 30000)
    const used = otp(counter)
    const first = await exchange(await browser(form(page), new URLSearchParams({ otp: used })), firstAuth)
    assert.equal(first.access.acr, '2')
    assert.equal(first.access.sub, low.access.sub)

    const silentAuth = authorization(2, 'none')
    const silent = await browser(silentAuth.url)
    assert.ok(silent.callback)
    assert.equal(silent.callback.searchParams.get('state'), silentAuth.state)
    assert.equal(silent.callback.searchParams.get('code'), null, 'No debe elevar silenciosamente usando SSO')
    assert.ok(['interaction_required', 'login_required'].includes(silent.callback.searchParams.get('error')))

    const secondAuth = authorization(2)
    page = await browser(secondAuth.url)
    assert.match(page.html, /name="otp"/, 'Otra operación debe pedir OTP otra vez')
    page = await browser(form(page), new URLSearchParams({ otp: used }))
    assert.ok(!page.callback, 'Un OTP ya consumido no autoriza otra operación')
    assert.match(page.html, /name="otp"/)
    await setTimeout(Math.max(0, (counter + 1) * 30000 - Date.now() + 1000))
    const second = await exchange(await browser(form(page), new URLSearchParams({ otp: otp() })), secondAuth)
    assert.equal(second.access.acr, '2')
    assert.notEqual(second.access.jti, first.access.jti)
    assert.equal(second.access.sid, first.access.sid, 'Se prueba la misma sesión SSO')

    const refreshed = await (await request('POST', `/realms/${realm}/protocol/openid-connect/token`, null,
      new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: second.refresh_token }))).json()
    const refreshClaims = claims(refreshed.access_token, 'zenit-api')
    assert.equal(refreshClaims.auth_time, second.access.auth_time, 'Renovar un token no acredita otra autenticación')
    const downgradedAuth = authorization(1, undefined, false)
    const downgraded = await browser(downgradedAuth.url)
    assert.ok(!downgraded.callback, 'Reducir el nivel en la URL no evita el OTP nuevo')
    assert.match(downgraded.html, /name="otp"/)
    t.diagnostic(`SSO con OTP por operación aprobado; ACR tras renovación: ${refreshClaims.acr}. El backend vincula y consume la autorización del expediente en sus pruebas de integración.`)
  } finally {
    if (created) {
      const fresh = await request('POST', '/realms/master/protocol/openid-connect/token', null,
        new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password: adminPassword }))
      await request('DELETE', `/admin/realms/${realm}`, (await fresh.json()).access_token, null, 204)
    }
  }
})
