// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accessibilityViolations } from './accessibility'
import { loaded } from './testUi'
vi.mock('./auth',()=>({accessToken:vi.fn(),auth:{tokenParsed:{sub:'subject'},clearToken:vi.fn()},identityBase:'http://localhost:8082'}))
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),api:vi.fn(),apiDownload:vi.fn()}))
import { api, apiDownload, ApiError, type Me } from './api'
import { Dossiers, type Dossier } from './Dossiers'
import { clearDossierVerification, prepareDossierRedirect, captureDossierCallback } from './dossierFlow'
import { button, click, waitFor } from './testUi'
let root:Root,container:HTMLDivElement,cache:QueryClient,record:Dossier,allowed:boolean
const me:Me={userId:'self',displayName:'Ana',roles:['rh'],tenant:{name:'Ficticia',timeZone:'America/Mexico_City'}}
const dossierId='11111111-1111-4111-8111-111111111111'
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);allowed=true
  window.history.replaceState(null,'','/');clearDossierVerification()
  record={id:dossierId,status:'ready',expiresAt:new Date(Date.now()+86400000).toISOString(),manifestSha256:'a'.repeat(64),fileSha256:'b'.repeat(64)}
  vi.mocked(api).mockReset().mockImplementation(async(path,method)=>path==='/me/dossier-permission'?{enabled:allowed}:path.endsWith('/authorizations')?{authorization:'T'.repeat(43)}:{...record,status:path==='/dossiers'&&method==='POST'?'queued':record.status})
  vi.mocked(apiDownload).mockReset().mockImplementation(async()=>{record.status='downloaded';return {blob:new Blob(['zip']),filename:`expediente-${dossierId}.zip`}})
  URL.createObjectURL=vi.fn(()=>'blob:test');URL.revokeObjectURL=vi.fn();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
  container=document.createElement('div');document.body.append(container);root=createRoot(container);cache=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})
})
afterEach(async()=>{await act(async()=>root.unmount());cache.clear();container.remove();clearDossierVerification();window.history.replaceState(null,'','/');vi.restoreAllMocks();vi.unstubAllGlobals()})
async function mount(){await act(async()=>root.render(<QueryClientProvider client={cache}><Dossiers me={me}/></QueryClientProvider>))}
function returned(){
  const state='S'.repeat(43),verifier='V'.repeat(43),challenge='C'.repeat(43)
  const url=new URL('http://localhost:8082/realms/zenit/protocol/openid-connect/auth')
  url.search=new URLSearchParams({client_id:'zenit-dossier',redirect_uri:`${window.location.origin}/dossier/callback`,response_type:'code',scope:'openid',state,nonce:'N'.repeat(43),code_challenge_method:'S256',code_challenge:challenge,acr_values:'2'}).toString()
  prepareDossierRedirect(dossierId,'self:subject',{id:'challenge',state,authorizationUrl:url.href,expiresAt:new Date(Date.now()+300000).toISOString()},{verifier,challenge},'http://localhost:8082')
  window.history.replaceState(null,'',`/dossier/callback?state=${state}&code=fresh-code`);captureDossierCallback()
}
it('historia solicita conserva idempotencia y muestra estado manifiesto y nueva verificación',async()=>{
  await mount();await waitFor(()=>!!button('Solicitar expediente'))
  vi.mocked(api).mockRejectedValueOnce(new ApiError(503,'unavailable','Reintentar'))
  await click('Solicitar expediente');await waitFor(()=>document.body.textContent?.includes('Reintentar')===true)
  await click('Solicitar expediente');await waitFor(()=>!!button('Verificar identidad para descargar'))
  const posts=vi.mocked(api).mock.calls.filter(([,method])=>method==='POST')
  expect(posts[0][3]).toBe(posts[1][3]);expect(posts[1][2]).toEqual({formatVersion:1})
  expect(document.body.textContent).toContain('SHA-256 del ZIP');expect(button('Guardar manifiesto del expediente')).toBeDefined()
})
it('retorno válido canjea una vez y descarga por POST sin guardar autorización en storage',async()=>{
  returned();await mount();await waitFor(()=>!!button('Continuar con la descarga verificada'))
  await click('Continuar con la descarga verificada');await waitFor(()=>document.body.textContent?.includes('Descarga consumida')===true)
  expect(api).toHaveBeenCalledWith(`/dossiers/${dossierId}/authorizations`,'POST',{challengeId:'challenge',state:'S'.repeat(43),codeVerifier:'V'.repeat(43),code:'fresh-code'})
  expect(apiDownload).toHaveBeenCalledWith(`/dossiers/${dossierId}/download`,'POST',{authorization:'T'.repeat(43)})
  expect(sessionStorage.length).toBe(0);expect(button('Continuar con la descarga verificada')).toBeUndefined()
})
it('oculta operaciones sin permiso y exige otra verificación ante una respuesta perdida',async()=>{
  allowed=false;await mount();await waitFor(()=>document.body.textContent?.includes('no tiene permiso')===true)
  expect(button('Solicitar expediente')).toBeUndefined()
})
it('no reintenta ni reutiliza autorización después de interrupción',async()=>{
  returned();vi.mocked(apiDownload).mockRejectedValueOnce(new Error('Conexión interrumpida'))
  await mount();await waitFor(()=>!!button('Continuar con la descarga verificada'));await click('Continuar con la descarga verificada')
  await waitFor(()=>document.body.textContent?.includes('Conexión interrumpida')===true)
  expect(apiDownload).toHaveBeenCalledTimes(1);expect(sessionStorage.length).toBe(0);expect(button('Continuar con la descarga verificada')).toBeUndefined()
  expect(button('Verificar identidad para descargar')).toBeDefined()
})

it('cumple las reglas automáticas de accesibilidad', async () => {
  await mount(); await loaded()
  expect(await accessibilityViolations()).toEqual([])
})
