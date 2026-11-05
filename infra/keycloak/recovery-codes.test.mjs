import assert from 'node:assert/strict'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const configured = JSON.parse(readFileSync(new URL('./realm/zenit-realm.json', import.meta.url), 'utf8'))

test('Q03 genera doce códigos, permite recuperar con contraseña y rechaza códigos consumidos', {
  skip: !process.env.IDENTITY_TEST_SECRETOS, timeout: 90000,
}, async () => {
  const base = process.env.IDENTITY_TEST_URL || 'http://localhost:38082'
  const realm = `qa-recovery-${randomUUID()}`
  const callback = 'http://localhost:8081/'
  const password = randomBytes(24).toString('base64url')
  const otpSecret = randomBytes(20).toString('hex')
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
        method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body,
      })
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0], split = pair.indexOf('=')
        cookies.set(pair.slice(0, split), pair.slice(split + 1))
      }
      if ([302, 303].includes(response.status)) {
        const next = new URL(response.headers.get('Location'), target)
        if (next.origin === new URL(callback).origin) return { callback: next }
        url = next.href
        body = undefined
      } else {
        assert.equal(response.status, 200)
        return { html: await response.text(), url: target }
      }
    }
    assert.fail('Demasiadas redirecciones')
  }
  const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  const form = page => {
    const action = page.html.match(/<form\b[^>]*action="([^"]+)"/)
    assert.ok(action, 'Se esperaba un formulario de identidad')
    return new URL(decode(action[1]), page.url).href
  }
  const loginPage = () => {
    cookies.clear()
    const verifier = randomBytes(32).toString('base64url')
    const params = new URLSearchParams({ client_id: 'qa-recovery', redirect_uri: callback,
      response_type: 'code', scope: 'openid', state: randomUUID(), prompt: 'login',
      code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') })
    return browse(`${base}/realms/${realm}/protocol/openid-connect/auth?${params}`)
  }
  const secret = readFileSync(join(process.env.IDENTITY_TEST_SECRETOS, 'keycloak_admin_password'), 'utf8').trim()
  const adminLogin = await adminRequest('POST', '/realms/master/protocol/openid-connect/token', null,
    new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'arranque', password: secret }))
  const admin = (await adminLogin.json()).access_token
  let created = false
  try {
    await adminRequest('POST', '/admin/realms', admin, {
      realm, enabled: true, sslRequired: 'none', browserFlow: configured.browserFlow,
      otpPolicyType: 'totp', otpPolicyAlgorithm: 'HmacSHA1', otpPolicyDigits: 6, otpPolicyPeriod: 30,
      authenticationFlows: configured.authenticationFlows.map(flow => ({ ...flow, id: randomUUID() })),
      authenticatorConfig: configured.authenticatorConfig.map(config => ({ ...config, id: randomUUID() })),
      requiredActions: configured.requiredActions,
      clients: [{ clientId: 'qa-recovery', publicClient: true, enabled: true, standardFlowEnabled: true,
        directAccessGrantsEnabled: false, redirectUris: [callback], attributes: { 'pkce.code.challenge.method': 'S256' } }],
      users: [{ username: 'qa-recovery', enabled: true, firstName: 'QA', lastName: 'Recovery',
        email: 'qa-recovery@example.invalid', emailVerified: true,
        requiredActions: ['CONFIGURE_RECOVERY_AUTHN_CODES'], credentials: [
          { type: 'password', value: password, temporary: false },
          { type: 'otp', secretData: JSON.stringify({ value: otpSecret }),
            credentialData: JSON.stringify({ subType: 'totp', digits: 6, period: 30, algorithm: 'HmacSHA1' }) },
        ] }],
    }, 201)
    created = true
    let page = await loginPage()
    page = await browse(form(page), new URLSearchParams({ username: 'qa-recovery', password }))
    assert.ok(page.html?.includes('name="otp"'), 'La contraseña sola debe pedir segundo factor')
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
    const digest = createHmac('sha1', otpSecret).update(counter).digest()
    const otp = String((digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff) % 1000000).padStart(6, '0')
    page = await browse(form(page), new URLSearchParams({ otp }))
    assert.ok(page.html?.includes('kc-recovery-codes-list'), 'Las cuentas generan sus códigos al configurar recuperación')
    const list = page.html.match(/<ol[^>]*id="kc-recovery-codes-list"[^>]*>([\s\S]*?)<\/ol>/)?.[1] || ''
    const codes = [...list.matchAll(/<li[^>]*>\s*(?:<span>[^<]*<\/span>\s*)?([A-Za-z0-9-]+)/g)].map(match => match[1])
    assert.equal(codes.length, 12, 'Keycloak debe ofrecer doce códigos')
    const fields = new URLSearchParams([...page.html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)]
      .map(match => [match[1], decode(match[2])]))
    fields.set('kcRecoveryCodesConfirmationCheck', 'on')
    assert.ok((await browse(form(page), fields)).callback, 'Guardar los códigos completa el ingreso con MFA')
    const users = await (await adminRequest('GET', `/admin/realms/${realm}/users?username=qa-recovery`, admin)).json()
    const credentials = await (await adminRequest('GET', `/admin/realms/${realm}/users/${users[0].id}/credentials`, admin)).json()
    assert.ok(credentials.some(credential => credential.type === 'otp'), 'Recuperación conserva el OTP')
    const recovery = credentials.find(credential => credential.type === 'recovery-authn-codes')
    assert.ok(recovery, 'Debe existir la credencial de recuperación')
    await adminRequest('POST', `/admin/realms/${realm}/users/${users[0].id}/credentials/${recovery.id}/moveToFirst`, admin, null, 204)
    for (let index = 0; index < 2; index++) {
      page = await loginPage()
      page = await browse(form(page), new URLSearchParams({ username: 'qa-recovery', password }))
      assert.ok(page.html?.includes('name="recoveryCodeInput"'), 'El código sustituye el OTP como segundo factor, no la contraseña')
      if (index === 1) {
        page = await browse(form(page), new URLSearchParams({ recoveryCodeInput: codes[0] }))
        assert.ok(!page.callback && page.html?.includes('name="recoveryCodeInput"'), 'No reutilizar el código consumido')
      }
      page = await browse(form(page), new URLSearchParams({ recoveryCodeInput: codes[index] }))
      assert.ok(page.callback?.searchParams.get('code'), 'Un código nuevo debe completar el ingreso')
    }
  } finally {
    if (created) await adminRequest('DELETE', `/admin/realms/${realm}`, admin, null, 204)
  }
})
