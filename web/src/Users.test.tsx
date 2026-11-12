// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown }
const server = vi.hoisted(() => ({ calls: [] as Call[], pending: 0, handler: (call: Call): Promise<unknown> => new Promise(() => call) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn(), tokenParsed: { sub: 'kc-self' } }, identityBase: 'http://localhost:8082' }))
vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  api: vi.fn((path: string, method = 'GET', body?: unknown) => {
    const call = { path, method, body }
    server.calls.push(call); server.pending++
    const answer = server.handler(call)
    const done = () => { server.pending-- }
    answer.then(done, done)
    return answer
  }),
}))
import { ApiError, type Me } from './api'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { button, click, setInput, waitFor } from './testUi'
import type { UserRow, UserSummary } from './usersModel'
import { scopeText } from './usersModel'

const base = { dossierPermission: false, dossierPermissionSince: null, employeeId: null, siteIds: [] as string[] }
const people: UserRow[] = [
  { ...base, id: 'self', email: 'mariana@demo.example', displayName: 'Mariana Ortiz', roles: ['admin_empresa'], status: 'active', createdAt: '2026-10-19T16:00:00Z', linkedAt: '2026-10-19T17:00:00Z', dossierPermission: true },
  { ...base, id: 'u2', email: 'hugo@demo.example', displayName: 'Hugo Peña', roles: ['supervisor'], status: 'active', createdAt: '2026-10-20T16:00:00Z', linkedAt: '2026-10-20T17:00:00Z', siteIds: ['s2'] },
  { ...base, id: 'u3', email: 'laura@demo.example', displayName: 'Laura Gil', roles: ['supervisor'], status: 'invited', createdAt: '2026-11-05T16:00:00Z', linkedAt: null },
  { ...base, id: 'u4', email: 'ernesto@demo.example', displayName: 'Ernesto Salas', roles: ['auditor'], status: 'active', createdAt: '2026-10-22T16:00:00Z', linkedAt: '2026-10-22T17:00:00Z' },
  { ...base, id: 'u5', email: 'andres@demo.example', displayName: 'Andrés Mora', roles: ['rh'], status: 'disabled', createdAt: '2026-10-19T16:00:00Z', linkedAt: null },
]
const summary: UserSummary = { total: 5, active: 3, invited: 1, disabled: 1, byRole: { admin_empresa: 1, rh: 1, supervisor: 2, auditor: 1, trabajador: 0 }, supervisorsWithoutSites: 1, dossierPermission: 1 }
const sites = [
  { id: 's1', name: 'Matriz Centro', timeZone: 'America/Mexico_City', latitude: 19.4, longitude: -99.1, radiusMeters: 120, status: 'active' },
  { id: 's2', name: 'Bodega Norte', timeZone: 'America/Mexico_City', latitude: 19.5, longitude: -99.2, radiusMeters: 200, status: 'active' },
]

function defaultServer({ path, method, body }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  const person = (id: string) => people.find(item => item.id === id)!
  if (method === 'POST' && url.pathname === '/users') return answer({ ...base, id: 'u9', status: 'invited', createdAt: '2026-11-10T16:42:00Z', linkedAt: null, displayName: '', ...(body as object) })
  if (method === 'PATCH') return answer({ ...person(url.pathname.split('/')[2]), ...(body as object) })
  if (method === 'POST' && url.pathname.endsWith('/unlink')) return answer({ ...person(url.pathname.split('/')[2]), linkedAt: null, status: 'invited' })
  if (method === 'POST' || method === 'PUT') return answer(undefined)
  if (url.pathname.startsWith('/users/') && url.pathname !== '/users/summary') return answer(person(url.pathname.split('/')[2]) || { ...base, id: 'u9', email: 'nueva@demo.example', displayName: 'Nueva', roles: ['rh'], status: 'invited', createdAt: '2026-11-10T16:42:00Z', linkedAt: null })
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: true })
    case '/users': {
      const role = url.searchParams.get('role'); const status = url.searchParams.get('status')
      return answer({ items: people.filter(item => (!role || item.roles.includes(role)) && (!status || item.status === status)), nextCursor: null })
    }
    case '/users/summary': return answer(summary)
    case '/sites': return answer({ items: sites, nextCursor: null })
    case '/incidents/summary': return answer({ open: { total: 0 } })
  }
  return Promise.reject(new ApiError(404, 'not_found', `Sin respuesta simulada para ${path}`))
}

let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
let phone = false
let location = ''
function Where() { const here = useLocation(); location = here.pathname + here.search; return null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T16:42:00Z') })
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  server.calls = []; server.pending = 0; server.handler = defaultServer; phone = false
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals() })

async function settle() {
  for (let quiet = 0, round = 0; quiet < 3; round++) {
    if (round > 300) throw new Error(`Quedaron ${server.pending} respuestas pendientes: ${server.calls.slice(-8).map(c => c.method + ' ' + c.path).join(', ')} (${server.calls.length})`)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    quiet = server.pending === 0 ? quiet + 1 : 0
  }
}
async function render(path = '/usuarios', roles = ['admin_empresa'], extra: Partial<Me> = {}) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' }, employeeId: null, ...extra }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} email="mariana@demo.example" onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const text = () => document.body.textContent || ''
const rows = () => [...container.querySelectorAll('main table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const writes = () => server.calls.filter(call => call.method !== 'GET')
const lists = () => server.calls.filter(call => call.method === 'GET' && call.path.startsWith('/users?')).map(call => call.path)
const chip = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].findLast(item => item.textContent?.trim() === label)!
async function press(label: string) { await act(async () => chip(label).click()); await settle() }
async function confirmAndSettle(label: string) { await click(label); await settle() }
async function menu(label: string) {
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label^="Cuenta de Mariana Ortiz"]')!.click())
  await act(async () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.startsWith(label))!.click())
  await settle()
}

it('el alcance resume roles y sedes', () => {
  const name = (id: string) => ({ s1: 'Matriz Centro', s2: 'Bodega Norte', s3: 'Andén' } as Record<string, string>)[id]
  expect(scopeText({ roles: ['supervisor', 'auditor'], status: 'active', siteIds: [] }, name)).toBe('Toda la empresa, consulta')
  expect(scopeText({ roles: ['supervisor'], status: 'active', siteIds: ['s2', 's1'] }, name)).toBe('Bodega Norte y Matriz Centro')
  expect(scopeText({ roles: ['supervisor'], status: 'active', siteIds: ['s2', 's1', 's3'] }, name)).toBe('Andén, Bodega Norte y 1 más')
  expect(scopeText({ roles: ['supervisor'], status: 'active', siteIds: [] }, name)).toBe('Sin sedes')
  expect(scopeText({ roles: ['rh'], status: 'disabled', siteIds: [] }, name)).toBe('—')
})

it('muestra las cifras, las pestañas por rol y cada persona con su alcance y su cuenta', async () => {
  await render()
  expect(text()).toContain('4Con acceso · 3 activas')
  expect(text()).toContain('1Invitación sin aceptar')
  expect(text()).toContain('1 de 2Supervisión con sedes')
  expect(text()).toContain('1Pueden descargar el expediente')
  expect([...document.querySelectorAll('[role="group"][aria-label="Rol"] button')].map(item => item.textContent)).toEqual(['Todos · 5', 'Administración · 1', 'RH · 1', 'Supervisión · 2', 'Auditoría · 1'])
  expect(rows()).toEqual([
    ['MOMariana Ortiz (tú)mariana@demo.example', 'Administración', 'Toda la empresa', 'Activa', '19 oct', 'Vinculada', 'Sí', 'Editar acceso'],
    ['HPHugo Peñahugo@demo.example', 'Supervisión', 'Bodega Norte', 'Activa', '20 oct', 'Vinculada', '—', 'Editar acceso'],
    ['LGLaura Gillaura@demo.example', 'Supervisión', 'Sin sedes', 'Invitada', '5 nov', 'Sin entrar aún', '—', 'Editar acceso'],
    ['ESErnesto Salasernesto@demo.example', 'Auditoría', 'Toda la empresa, consulta', 'Activa', '22 oct', 'Vinculada', '—', 'Editar acceso'],
    ['AMAndrés Moraandres@demo.example', 'RH', '—', 'Deshabilitada', '19 oct', 'Sin cuenta ligada', '—', 'Editar acceso'],
  ])
})

it('filtra por rol y por las cifras en el servidor', async () => {
  await render()
  await press('Supervisión · 2')
  expect(location).toBe('/usuarios?rol=supervision')
  expect(lists().at(-1)).toBe('/users?limit=25&role=supervisor')
  expect(rows()).toHaveLength(2)
  const invited = [...document.querySelectorAll<HTMLAnchorElement>('[aria-label="Accesos en cifras"] a')][1]
  await act(async () => invited.click()); await settle()
  expect(lists().at(-1)).toBe('/users?limit=25&status=invited')
  expect(text()).toContain('Invitaciones sin aceptar')
})

it('editar acceso guarda sólo lo que cambió y concede el expediente aparte', async () => {
  await render('/usuarios')
  await act(async () => (container.querySelectorAll('main table tbody tr')[1].querySelectorAll('td')[2] as HTMLElement).click())
  await settle()
  expect(location).toBe('/usuarios?persona=u2')
  expect(text()).toContain('Acceso de Hugo Peña')
  expect(text()).toContain('hugo@demo.example · activa desde el 20 oct')
  await press('Matriz Centro')
  await press('Auditoría')
  await act(async () => document.querySelector<HTMLInputElement>('[name="dossierPermission"]')!.click())
  await confirmAndSettle('Guardar cambios')
  expect(writes()).toEqual([
    { path: '/users/u2', method: 'PATCH', body: { roles: ['supervisor', 'auditor'], siteIds: ['s2', 's1'] } },
    { path: '/users/u2/dossier-permission', method: 'PUT', body: { enabled: true } },
  ])
  expect(location).toBe('/usuarios')
})

it('sin roles no se guarda; a quien no ha entrado no se le concede el expediente ni se le pide contraseña', async () => {
  await render('/usuarios?persona=u3')
  expect(document.querySelector<HTMLInputElement>('[name="dossierPermission"]')!.disabled).toBe(true)
  expect(text()).toContain('Se concede cuando ya entró con su cuenta y su acceso está activo.')
  expect(button('Pedir contraseña nueva en su próximo ingresoCuando ya entró y su acceso está activo.')?.disabled).toBe(true)
  await press('Supervisión')
  await click('Guardar cambios')
  expect(text()).toContain('Elige al menos un rol.')
  expect(writes()).toEqual([])
})

it('la seguridad de la cuenta pide confirmación: contraseña, soltar la liga y deshabilitar', async () => {
  await render('/usuarios?persona=u4')
  await click('Pedir contraseña nueva en su próximo ingreso')
  expect(writes()).toEqual([])
  await confirmAndSettle('Pedir contraseña nueva')
  expect(text()).toContain('Listo: Ernesto Salas elegirá una contraseña nueva en su próximo ingreso.')
  await click('Listo')
  await click('Soltar la liga con su cuenta')
  expect(text()).toContain('No le quita el acceso')
  await confirmAndSettle('Soltar la liga')
  await click('Deshabilitar su acceso')
  await confirmAndSettle('Deshabilitar')
  expect(writes()).toEqual([
    { path: '/users/u4/password-change', method: 'POST', body: undefined },
    { path: '/users/u4/unlink', method: 'POST', body: undefined },
    { path: '/users/u4', method: 'PATCH', body: { disabled: true } },
  ])
})

it('un acceso deshabilitado se habilita otra vez', async () => {
  await render('/usuarios?persona=u5')
  expect(text()).toContain('Su acceso está deshabilitado')
  await click('Habilitar su acceso')
  await confirmAndSettle('Habilitar')
  expect(writes()).toEqual([{ path: '/users/u5', method: 'PATCH', body: { disabled: false } }])
})

it('invitar revisa el correo y el rol, manda sólo lo elegido y abre a la persona nueva', async () => {
  await render('/usuarios')
  await click('Invitar')
  expect(text()).toContain('No le llega un correo')
  await setInput('email', 'laura')
  await act(async () => document.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit())
  expect(text()).toContain('Escribe un correo válido.')
  await setInput('email', ' Nueva@Demo.example ')
  await setInput('displayName', 'Nueva Persona')
  await act(async () => document.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit())
  expect(text()).toContain('Elige al menos un rol.')
  await act(async () => document.querySelector<HTMLInputElement>('[role="dialog"] input[value="supervisor"]')!.click())
  await press('Bodega Norte')
  await act(async () => document.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit())
  await settle()
  expect(writes()).toEqual([{ path: '/users', method: 'POST', body: { email: 'nueva@demo.example', roles: ['supervisor'], displayName: 'Nueva Persona', siteIds: ['s2'] } }])
  expect(location).toBe('/usuarios?persona=u9')
})

it('un correo que ya tiene acceso se marca en su campo', async () => {
  server.handler = call => call.method === 'POST' && call.path === '/users' ? Promise.reject(new ApiError(409, 'email_unavailable', 'El correo no está disponible.')) : defaultServer(call)
  await render('/usuarios?invitar=1')
  await setInput('email', 'hugo@demo.example')
  await act(async () => document.querySelector<HTMLInputElement>('[role="dialog"] input[value="rh"]')!.click())
  await act(async () => document.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit())
  await settle()
  expect(text()).toContain('Este correo ya tiene acceso a una empresa.')
})

it('los permisos por rol se consultan en una tabla', async () => {
  await render('/usuarios')
  await click('Permisos por rol')
  const table = [...document.querySelectorAll('[role="dialog"] tbody tr')].map(row => [...row.children].map(cell => cell.textContent))
  expect(table[0]).toEqual(['Ver asistencia, incidencias y cierres', 'Sí', 'Sí', 'Sus sedes', 'Sí'])
  expect(table.at(-1)).toEqual(['Usuarios y configuración', 'Sí', '—', '—', '—'])
  await click('Entendido')
  expect(location).toBe('/usuarios')
})

it('Mi perfil sale del menú de la cuenta con el acceso y la seguridad; Ayuda y soporte da el correo y el teléfono', async () => {
  await render('/usuarios', ['supervisor'])
  await menu('Mi perfil')
  expect(location).toBe('/usuarios?perfil=1')
  expect(text()).toContain('RolSupervisión')
  expect(text()).toContain('AlcanceLas sedes que te asignaron')
  expect(text()).toContain('Expediente de la empresaPuede descargarlo')
  expect(text()).toContain('En el padrónNo')
  const links = [...document.querySelectorAll<HTMLAnchorElement>('section a[href*="/realms/zenit/account"]')]
  expect(links.map(link => link.textContent)).toEqual(['Cambiar', 'Reconfigurar'])
  await menu('Ayuda y soporte')
  expect(document.querySelector('a[href^="mailto:rene.alexis.segura@gmail.com"]')).not.toBeNull()
  expect(document.querySelector('a[href="tel:+525633001126"]')?.textContent).toContain('56 3300 1126')
})

it('quien no administra no abre Usuarios', async () => {
  await render('/usuarios', ['rh'])
  expect(text()).toContain('Esta sección no está disponible para tu rol')
  expect(lists()).toEqual([])
})

it('en el teléfono cada persona es una tarjeta', async () => {
  phone = true
  await render()
  const cards = [...container.querySelectorAll('main li')].map(item => item.textContent)
  expect(cards[1]).toBe('Hugo Peñahugo@demo.exampleActivaSupervisión · Bodega Norte · Vinculada')
  expect(cards[0]).toContain('· expediente')
})

it('cumple las reglas automáticas de accesibilidad en la pantalla, el panel y las ventanas', { timeout: 30_000 }, async () => {
  await render()
  expect(await accessibilityViolations()).toEqual([])
  await render('/usuarios?persona=u2')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/usuarios?invitar=1')
  await act(async () => document.querySelector<HTMLInputElement>('[role="dialog"] input[value="trabajador"]')!.click())
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/usuarios?permisos=1')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/usuarios?perfil=1')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/usuarios?ayuda=1')
  expect(await accessibilityViolations(document.body)).toEqual([])
})
