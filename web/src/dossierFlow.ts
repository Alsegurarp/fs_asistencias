export type VerificationIntent = { dossierId: string; owner: string; challengeId: string; state: string; verifier: string; expiresAt: string; issuer: string }
type VerificationReturn = { state?: string; code?: string; error?: string }
export type Challenge = { id: string; state: string; authorizationUrl: string; expiresAt: string }
const pendingKey = 'zenit.dossier.pending'
const returnKey = 'zenit.dossier.return'
const opaque = /^[A-Za-z0-9_-]{43}$/

export function clearDossierVerification() { sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(returnKey) }
export function pendingVerification(): VerificationIntent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey) || 'null') as VerificationIntent | null
    if (!value || typeof value.owner !== 'string' || typeof value.dossierId !== 'string' || typeof value.challengeId !== 'string' ||
      !opaque.test(value.state) || !opaque.test(value.verifier) || !Number.isFinite(Date.parse(value.expiresAt)) || typeof value.issuer !== 'string') return null
    return value
  } catch { return null }
}
export function verificationReturned() { return sessionStorage.getItem(returnKey) !== null }

// Se ejecuta antes de Keycloak.init: el código del cliente expediente no pertenece al login normal.
export function captureDossierCallback() {
  if (window.location.pathname !== '/dossier/callback' || verificationReturned()) return
  const intent = pendingVerification()
  if (!intent) return
  const params = new URLSearchParams(window.location.search)
  if (!params.has('state') && !params.has('code') && !params.has('error')) return
  const state = params.get('state') || ''
  const code = params.get('code') || ''
  const error = params.get('error') || ''
  const valid = params.getAll('state').length === 1 && params.getAll('code').length <= 1 && params.getAll('error').length <= 1 && params.getAll('iss').length <= 1 &&
    state === intent.state && (!params.has('iss') || params.get('iss') === intent.issuer) && (!!code !== !!error) && code.length <= 2048
  sessionStorage.setItem(returnKey, JSON.stringify(valid ? { state, ...(code ? { code } : { error: 'cancelled' }) } : { error: 'invalid_state' }))
  window.history.replaceState(null, '', '/dossier/callback')
}

export async function dossierPkce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const base64 = (array: Uint8Array) => btoa(String.fromCharCode(...array)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const verifier = base64(bytes)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64(new Uint8Array(digest)) }
}

export function prepareDossierRedirect(dossierId: string, owner: string, response: Challenge, pair: { verifier: string; challenge: string }, identityBase: string) {
  const issuer = `${identityBase.replace(/\/$/, '')}/realms/zenit`
  const expected = new URL(`${issuer}/protocol/openid-connect/auth`)
  const url = new URL(response.authorizationUrl)
  const query = url.searchParams
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password || url.hash ||
    [...query.keys()].some(name => query.getAll(name).length !== 1) ||
    !opaque.test(response.state) || !opaque.test(pair.verifier) || !opaque.test(query.get('nonce') || '') ||
    query.get('state') !== response.state || query.get('code_challenge') !== pair.challenge || query.get('code_challenge_method') !== 'S256' ||
    query.get('client_id') !== 'zenit-dossier' || query.get('redirect_uri') !== `${window.location.origin}/dossier/callback` ||
    query.get('response_type') !== 'code' || query.get('acr_values') !== '2' || !Number.isFinite(Date.parse(response.expiresAt)) || Date.parse(response.expiresAt) <= Date.now()) {
    throw new Error('La verificación recibida no corresponde a esta solicitud. Inicia otra verificación.')
  }
  clearDossierVerification()
  sessionStorage.setItem(pendingKey, JSON.stringify({ dossierId, owner, challengeId: response.id, state: response.state, verifier: pair.verifier, expiresAt: response.expiresAt, issuer } satisfies VerificationIntent))
  return url.href
}

export function takeDossierVerification(owner: string) {
  const intent = pendingVerification()
  let result: VerificationReturn | null = null
  try { result = JSON.parse(sessionStorage.getItem(returnKey) || 'null') as VerificationReturn | null } catch { /* Rechazar el retorno incompleto. */ }
  // Se elimina antes de la red: recargar o perder la respuesta exige otro desafío.
  clearDossierVerification()
  if (!intent || intent.owner !== owner) throw new Error('La cuenta cambió. Solicita otra verificación con la cuenta actual.')
  if (Date.parse(intent.expiresAt) <= Date.now()) throw new Error('La verificación venció. Inicia otra verificación.')
  if (result?.error === 'cancelled') throw new Error('La verificación fue cancelada. Puedes iniciar otra.')
  if (!result?.code || result.error || result.state !== intent.state) throw new Error('El retorno de verificación no es válido. Inicia otra verificación.')
  return { dossierId: intent.dossierId, body: { challengeId: intent.challengeId, state: intent.state, codeVerifier: intent.verifier, code: result.code } }
}
