// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { captureDossierCallback, clearDossierVerification, dossierPkce, pendingVerification, prepareDossierRedirect, takeDossierVerification, verificationReturned } from './dossierFlow'
const state='S'.repeat(43), nonce='N'.repeat(43), verifier='V'.repeat(43)
const pair={verifier,challenge:'C'.repeat(43)}
const issuer='http://localhost:8082/realms/zenit'
const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto')
function response() {
  const url=new URL(`${issuer}/protocol/openid-connect/auth`)
  url.search=new URLSearchParams({client_id:'zenit-dossier',redirect_uri:`${window.location.origin}/dossier/callback`,response_type:'code',scope:'openid',state,nonce,code_challenge_method:'S256',code_challenge:pair.challenge,acr_values:'2'}).toString()
  return {id:'challenge',state,authorizationUrl:url.href,expiresAt:new Date(Date.now()+300000).toISOString()}
}
function begin() { prepareDossierRedirect('dossier','account:subject',response(),pair,'http://localhost:8082') }
function callback(query:URLSearchParams) { window.history.replaceState(null,'',`/dossier/callback?${query}`); captureDossierCallback() }
beforeEach(()=>{clearDossierVerification(); window.history.replaceState(null,'','/'); vi.stubGlobal('crypto',webcrypto)})
afterEach(()=>vi.unstubAllGlobals())
it('genera PKCE aleatorio S256 y conserva correlación hasta un canje de un uso',async()=>{
  const a=await dossierPkce(),b=await dossierPkce()
  expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(a.verifier).not.toBe(b.verifier)
  const hash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(a.verifier))
  expect(btoa(String.fromCharCode(...new Uint8Array(hash))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')).toBe(a.challenge)
  begin(); callback(new URLSearchParams({state,code:'fresh-code',iss:issuer}))
  expect(window.location.search).toBe(''); expect(verificationReturned()).toBe(true)
  expect(takeDossierVerification('account:subject')).toEqual({dossierId:'dossier',body:{challengeId:'challenge',state,codeVerifier:verifier,code:'fresh-code'}})
  expect(pendingVerification()).toBe(null)
  expect(()=>takeDossierVerification('account:subject')).toThrow()
})
it.each(['state','iss','duplicate','missing','cancelled'])('rechaza retorno %s y no deja reutilizarlo',kind=>{
  begin(); const query=new URLSearchParams({state,code:'code',iss:issuer})
  if(kind==='state')query.set('state','X'.repeat(43))
  if(kind==='iss')query.set('iss','https://other.invalid')
  if(kind==='duplicate')query.append('state',state)
  if(kind==='missing')query.delete('code')
  if(kind==='cancelled'){query.delete('code');query.set('error','access_denied')}
  callback(query);expect(()=>takeDossierVerification('account:subject')).toThrow()
  expect(pendingVerification()).toBe(null);expect(verificationReturned()).toBe(false)
})
it('no confunde el segundo retorno del login normal con el código del expediente',()=>{
  begin(); callback(new URLSearchParams({state,code:'dossier-code',iss:issuer}))
  window.history.replaceState(null,'','/dossier/callback?state=normal-login&code=normal-code')
  captureDossierCallback()
  expect(window.location.search).toContain('normal-code')
  expect(takeDossierVerification('account:subject').body.code).toBe('dossier-code')
})
it('rechaza cambio de cuenta, expiración y retorno sin intención',()=>{
  begin();callback(new URLSearchParams({state,code:'code'}))
  expect(()=>takeDossierVerification('other:subject')).toThrow(/cuenta cambió/)
  begin();callback(new URLSearchParams({state,code:'code'}))
  vi.useFakeTimers();vi.setSystemTime(Date.now()+301000)
  expect(()=>takeDossierVerification('account:subject')).toThrow(/venció/)
  vi.useRealTimers()
  expect(()=>takeDossierVerification('account:subject')).toThrow()
})
it.each(['origin','client','redirect','pkce','nonce','duplicate'])('rechaza URL de identidad alterada: %s',kind=>{
  const reply=response(),url=new URL(reply.authorizationUrl)
  if(kind==='origin')url.hostname='foreign.invalid'
  if(kind==='client')url.searchParams.set('client_id','zenit-portal')
  if(kind==='redirect')url.searchParams.set('redirect_uri','https://foreign.invalid/callback')
  if(kind==='pkce')url.searchParams.set('code_challenge_method','plain')
  if(kind==='nonce')url.searchParams.delete('nonce')
  if(kind==='duplicate')url.searchParams.append('nonce',nonce)
  reply.authorizationUrl=url.href
  expect(()=>prepareDossierRedirect('dossier','account:subject',reply,pair,'http://localhost:8082')).toThrow()
  expect(pendingVerification()).toBe(null)
})
