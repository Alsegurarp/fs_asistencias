// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accessibilityViolations } from './accessibility'
import { loaded } from './testUi'
vi.mock('./auth',()=>({accessToken:vi.fn(),auth:{tokenParsed:{sub:'subject'},clearToken:vi.fn()},identityBase:'http://localhost:8082'}))
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),api:vi.fn(),apiDownload:vi.fn()}))
import { api, apiDownload, ApiError, type Me } from './api'
import { Dossiers, type Dossier } from './Dossiers'
import { companyGroups } from './sections'
import { clearDossierVerification, prepareDossierRedirect, captureDossierCallback } from './dossierFlow'
import { button, click, waitFor } from './testUi'
let root:Root,container:HTMLDivElement,cache:QueryClient,record:Dossier,allowed:boolean
const me:Me={userId:'self',displayName:'Ana',roles:['rh'],tenant:{name:'Ficticia',timeZone:'America/Mexico_City'}}
const section=companyGroups.flatMap(group=>group.sections).find(item=>item.key==='reportes')!
const screen=section.screens.find(item=>item.key==='dossier')!
const manifest={formatVersion:1,snapshotAt:'2026-11-06T16:20:00Z',counts:{tenant:1,tenant_user:7,tenant_user_role:9,site:2,audit_log:1920},limitations:['audit_metadata_filtered']}
const dossierId='11111111-1111-4111-8111-111111111111'
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);allowed=true
  window.history.replaceState(null,'','/');clearDossierVerification()
  record={id:dossierId,status:'ready',expiresAt:new Date(Date.now()+86400000).toISOString(),manifestSha256:'a'.repeat(64),fileSha256:'b'.repeat(64),snapshotAt:'2026-11-06T16:20:00Z'}
  vi.mocked(api).mockReset().mockImplementation(async(path,method)=>path==='/me/dossier-permission'?{enabled:allowed}:path.startsWith('/dossiers?')?{items:[],nextCursor:null}:path.endsWith('/authorizations')?{authorization:'T'.repeat(43)}:{...record,status:path==='/dossiers'&&method==='POST'?'queued':record.status})
  vi.mocked(apiDownload).mockReset().mockImplementation(async path=>{if(path.endsWith('/manifest'))return {blob:new Blob([JSON.stringify(manifest)]),filename:'manifest.json'};record.status='downloaded';return {blob:new Blob(['zip']),filename:`expediente-${dossierId}.zip`}})
  URL.createObjectURL=vi.fn(()=>'blob:test');URL.revokeObjectURL=vi.fn();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
  container=document.createElement('div');document.body.append(container);root=createRoot(container);cache=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})
})
afterEach(async()=>{await act(async()=>root.unmount());cache.clear();container.remove();clearDossierVerification();window.history.replaceState(null,'','/');vi.restoreAllMocks();vi.unstubAllGlobals()})
async function mount(){await act(async()=>root.render(<QueryClientProvider client={cache}><MemoryRouter><Dossiers me={me} context="Ficticia" section={section} screen={screen}/></MemoryRouter></QueryClientProvider>))}
const downloads=()=>vi.mocked(apiDownload).mock.calls.filter(([path])=>path.endsWith('/download'))
function returned(){
  const state='S'.repeat(43),verifier='V'.repeat(43),challenge='C'.repeat(43)
  const url=new URL('http://localhost:8082/realms/zenit/protocol/openid-connect/auth')
  url.search=new URLSearchParams({client_id:'zenit-dossier',redirect_uri:`${window.location.origin}/dossier/callback`,response_type:'code',scope:'openid',state,nonce:'N'.repeat(43),code_challenge_method:'S256',code_challenge:challenge,acr_values:'2'}).toString()
  prepareDossierRedirect(dossierId,'self:subject',{id:'challenge',state,authorizationUrl:url.href,expiresAt:new Date(Date.now()+300000).toISOString()},{verifier,challenge},'http://localhost:8082')
  window.history.replaceState(null,'',`/dossier/callback?state=${state}&code=fresh-code`);captureDossierCallback()
}
it('historia solicita conserva idempotencia y muestra estado manifiesto y nueva verificación',async()=>{
  await mount();await waitFor(()=>!!button('Preparar la copia'))
  vi.mocked(api).mockRejectedValueOnce(new ApiError(503,'unavailable','Reintentar'))
  await click('Preparar la copia');await waitFor(()=>document.body.textContent?.includes('Reintentar')===true)
  await click('Preparar la copia');await waitFor(()=>!!button('Confirmar que eres tú'))
  const posts=vi.mocked(api).mock.calls.filter(([,method])=>method==='POST')
  expect(posts[0][3]).toBe(posts[1][3]);expect(posts[1][2]).toEqual({formatVersion:1})
  expect(document.body.textContent).toContain('Huella del ZIP (SHA-256)');await waitFor(()=>!!button('Guardar manifiesto'))
  expect(document.body.textContent).toContain('Empresa, usuarios y roles1 · 7 · 9');expect(document.body.textContent).toContain('Bitácora1,920')
})
it('retorno válido canjea una vez y descarga por POST sin guardar autorización en storage',async()=>{
  returned();await mount();await waitFor(()=>!!button('Descargar ZIP (una vez)'))
  await click('Descargar ZIP (una vez)');await waitFor(()=>document.body.textContent?.includes('Descargada')===true)
  expect(api).toHaveBeenCalledWith(`/dossiers/${dossierId}/authorizations`,'POST',{challengeId:'challenge',state:'S'.repeat(43),codeVerifier:'V'.repeat(43),code:'fresh-code'})
  expect(apiDownload).toHaveBeenCalledWith(`/dossiers/${dossierId}/download`,'POST',{authorization:'T'.repeat(43)})
  expect(sessionStorage.length).toBe(0);expect(button('Descargar ZIP (una vez)')).toBeUndefined()
})
it('oculta operaciones sin permiso y exige otra verificación ante una respuesta perdida',async()=>{
  allowed=false;await mount();await waitFor(()=>document.body.textContent?.includes('no tiene permiso')===true)
  expect(button('Preparar la copia')).toBeUndefined()
})
it('no reintenta ni reutiliza autorización después de interrupción',async()=>{
  returned()
  // Se corta sólo la descarga del ZIP; el manifiesto sigue respondiendo.
  const original=vi.mocked(apiDownload).getMockImplementation()!
  vi.mocked(apiDownload).mockImplementation(async(path,...rest)=>{if(path.endsWith('/download'))throw new Error('Conexión interrumpida');return original(path,...rest)})
  await mount();await waitFor(()=>!!button('Descargar ZIP (una vez)'));await click('Descargar ZIP (una vez)')
  await waitFor(()=>document.body.textContent?.includes('Conexión interrumpida')===true)
  expect(downloads()).toHaveLength(1);expect(sessionStorage.length).toBe(0);expect(button('Descargar ZIP (una vez)')).toBeUndefined()
  expect(button('Confirmar que eres tú')).toBeDefined()
})

it('cumple las reglas automáticas de accesibilidad', async () => {
  await mount(); await loaded()
  expect(await accessibilityViolations()).toEqual([])
})

it('muestra el paso, lo que incluye la copia, su carátula y las copias anteriores; Administración ve quién puede descargarlo', async () => {
  const admin: Me = { ...me, roles: ['admin_empresa'] }
  const older = { ...record, id: 'old', status: 'downloaded' as const, snapshotAt: '2026-10-22T23:05:00Z', downloadedAt: '2026-10-23T00:05:00Z', manifestSha256: '91c4'.padEnd(60, '0') + '02de' }
  vi.mocked(api).mockImplementation(async (path, method) => path === '/me/dossier-permission' ? { enabled: true }
    : path.startsWith('/dossiers?') ? { items: [record, older], nextCursor: null }
      : path.startsWith('/users?') ? { items: [{ id: 'u1', email: 'm@x', displayName: 'Mariana Ortiz', roles: ['admin_empresa'], status: 'active', dossierPermission: true, dossierPermissionSince: '2026-10-19T17:00:00Z' }], nextCursor: null }
      : path.startsWith('/dossier-history?') ? { items: [
        { requestedByName: 'Rocío Navarro', own: false, status: 'downloaded', createdAt: '2026-10-25T16:00:00Z', readyAt: '2026-10-25T16:02:00Z', downloadedAt: '2026-10-25T17:00:00Z' },
        { requestedByName: 'Mariana Ortiz', own: true, status: 'downloaded', createdAt: '2026-10-22T23:00:00Z', readyAt: '2026-10-22T23:05:00Z', downloadedAt: '2026-10-23T00:05:00Z' },
      ], nextCursor: null }
        : { ...record, status: method === 'POST' ? 'queued' : record.status })
  await act(async () => root.render(<QueryClientProvider client={cache}><MemoryRouter><Dossiers me={admin} context="Ficticia" section={section} screen={screen} /></MemoryRouter></QueryClientProvider>))
  await waitFor(() => !!document.querySelector('.zenit-print-root'))
  expect(document.querySelector('[aria-current="step"]')?.textContent).toContain('Confirmar que eres tú')
  expect(document.body.textContent).toContain('Corte al 6 nov 2026, 10:20 · 3 secciones')
  expect(document.body.textContent).toContain('La bitácora va sin los datos internos que no son para la empresa.')
  expect(document.querySelector('.zenit-print-root')!.textContent).toContain('Formato 1 · corte al 6 nov 2026, 10:20, hora de la empresa')
  const tables = [...container.querySelectorAll('section')].map(item => item.querySelector('h2')?.textContent)
  expect(tables).toEqual(expect.arrayContaining(['Copias anteriores', 'Quién puede descargarlo', 'Qué incluye esta copia']))
  // Administración ve todas las copias de la empresa, con quién las pidió.
  expect(document.body.textContent).toContain('Rocío Navarro25 oct 2026, 10:00Descargada25 oct 2026, 11:00')
  expect(document.body.textContent).toContain('Tú22 oct 2026, 17:00Descargada22 oct 2026, 18:05')
  expect(document.body.textContent).toContain('Mariana OrtizAdministración19 oct 2026')
})
