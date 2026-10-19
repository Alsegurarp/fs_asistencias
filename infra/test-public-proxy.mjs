import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = new URL(process.argv[2] || 'https://zenit.fastsolution.com.mx')
assert.equal(base.protocol, 'https:')
assert.equal(base.pathname, '/')
assert.ok(!base.username && !base.password && !base.search && !base.hash)
const evidence = { startedAt: new Date().toISOString(), origin: base.origin, checks: [] }
mkdirSync('build', { recursive: true })
try {
  const redirect = await fetch(`http://${base.host}/`, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
  assert.ok([301, 308].includes(redirect.status))
  assert.equal(redirect.headers.get('location'), `${base.origin}/`)
  evidence.checks.push('HTTP redirige al mismo dominio HTTPS')

  const discovery = await fetch(`${base.origin}/id/realms/zenit/.well-known/openid-configuration`, {
    headers: { 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'invalid.example', Forwarded: 'proto=http;host=invalid.example' },
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(discovery.status, 200)
  const identity = await discovery.json()
  assert.equal(identity.issuer, `${base.origin}/id/realms/zenit`)
  for (const field of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    assert.ok(identity[field].startsWith(`${base.origin}/id/realms/zenit/`))
  }
  evidence.checks.push('Cabeceras falsas no cambian las URL HTTPS de identidad')

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  // El generador del backend excluye el cero: este código nunca puede emitirse.
  const code = '00000-00000'
  const input = `${Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ enrollmentCode: code })).toString('base64url')}`
  const proof = `${input}.${sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
  const body = JSON.stringify({ enrollmentCode: code, publicKey: publicKey.export({ format: 'jwk' }), proof, screenLock: true,
    device: { manufacturer: 'Zenit QA', model: 'Proxy check', androidSdk: 36, appVersion: '0.1.0' } })
  evidence.attempts = []
  for (let index = 1; index <= 12; index++) {
    const response = await fetch(`${base.origin}/api/v1/device-activations`, {
      method: 'POST', body, signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${index}`, 'X-Real-IP': `198.51.100.${index}`,
        Forwarded: `for=192.0.2.${index};proto=http`, 'X-Forwarded-Proto': 'http' },
    })
    const problem = await response.json()
    evidence.attempts.push({ attempt: index, status: response.status, code: problem.code })
    assert.equal(response.status, index <= 10 ? 410 : 429, `Respuesta inesperada en intento ${index}; revisar cuota previa o despliegue`)
    assert.equal(problem.code, index <= 10 ? 'enrollment_gone' : 'rate_limited')
  }
  evidence.checks.push('Rotar cabeceras IP falsas no evade la cuota: 10 rechazos y después 429')
  const health = await fetch(`${base.origin}/api/v1/system/status`, { signal: AbortSignal.timeout(15000) })
  assert.equal(health.status, 200)
  evidence.checks.push('El estado del servicio sigue respondiendo tras agotar la cuota de activación')
  evidence.result = 'passed'
  evidence.remaining = 'Falta repetir durante la misma ventana desde otra IP pública real para probar aislamiento entre visitantes.'
} catch (error) {
  evidence.result = 'failed'
  evidence.error = error.message
  throw error
} finally {
  evidence.finishedAt = new Date().toISOString()
  writeFileSync('build/public-proxy-check.json', JSON.stringify(evidence, null, 2))
  console.log(`Proxy público: ${evidence.result}; evidencia en build/public-proxy-check.json`)
}
