// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown }
const server = vi.hoisted(() => ({ calls: [] as Call[], pending: 0, handler: (call: Call): Promise<unknown> => new Promise(() => call) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() }, identityBase: 'http://localhost:8082' }))
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
import { createOptions } from './TopBar'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { setInput, waitFor } from './testUi'

function defaultServer({ path }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  const q = url.searchParams.get('q')
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/employees':
      if (q === 'an') return answer({ items: [
        { id: 'e1', displayName: 'Ana Torres', externalId: '0187', status: 'active', siteId: 's1', activeCardLabel: 'T-0031' },
        { id: 'e2', displayName: 'Andrea Lozano', externalId: '0215', status: 'active', siteId: 's1', activeCardLabel: null },
      ], nextCursor: null })
      return answer({ items: [], nextCursor: null })
    case '/cards': return answer({ items: q === 'an' ? [{ id: 'c1', label: 'T-0031', status: 'active', assignment: { employeeId: 'e1', employeeName: 'Ana Torres', employeeExternalId: '0187', since: '2026-09-02T15:00:00Z' }, latestAssignment: null }] : [], nextCursor: null })
    case '/devices': return answer({ items: q === 'an' ? [{ id: 'd1', mode: 'terminal', status: 'active', employeeId: null, siteId: 's2', label: 'Terminal Andén 2', model: 'SM-T220', appVersion: '1.4.0', enrolledAt: '2026-10-14T16:00:00Z', lastSeenAt: '2026-11-10T16:34:00Z', revokedAt: null }] : [], nextCursor: null })
  }
  // Las pantallas detrás del marco no importan aquí.
  return Promise.reject(new ApiError(404, 'not_found', `Sin respuesta simulada para ${path}`))
}

let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
let location = ''
function Where() { const here = useLocation(); location = here.pathname + here.search; return null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T16:42:00Z') })
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  server.calls = []; server.pending = 0; server.handler = defaultServer
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals() })

async function settle() {
  for (let quiet = 0, round = 0; quiet < 3; round++) {
    if (round > 300) throw new Error(`Quedaron ${server.pending} respuestas pendientes`)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    quiet = server.pending === 0 ? quiet + 1 : 0
  }
}
const me = (roles: string[]): Me => ({ userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' } })
async function render(roles = ['admin_empresa'], path = '/personal/fuentes') {
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me(roles)} onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const searchBox = () => container.querySelector<HTMLInputElement>('header input[role="combobox"]')!
async function type(value: string) {
  await act(async () => searchBox().focus())
  await setInput(searchBox().name || 'x', value).catch(() => undefined)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(searchBox(), value)
    searchBox().dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
  await settle()
}
async function key(target: HTMLElement | Window, value: string) {
  await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })))
  await settle()
}

it('busca en personas, tarjetas y lectores con pocos resultados de cada uno', async () => {
  await render()
  expect(searchBox().getAttribute('aria-label')).toBe('Buscar personas, tarjetas y lectores')
  await type('an')
  const paths = server.calls.map(call => call.path)
  expect(paths).toEqual(expect.arrayContaining(['/employees?q=an&limit=3&status=active', '/cards?q=an&limit=3', '/devices?q=an&limit=3&status=active']))
  const list = document.querySelector('[role="listbox"]')!
  expect([...list.querySelectorAll('[role="group"]')].map(group => group.getAttribute('aria-label'))).toEqual(['Personas', 'Tarjetas', 'Lectores'])
  expect([...list.querySelectorAll('[role="option"]')].map(item => item.textContent)).toEqual([
    'Ana Torres0187 · tarjeta T-0031', 'Andrea Lozano0215 · sin tarjeta', 'T-0031Activa · asignada a Ana Torres · 0187', 'Terminal Andén 2Terminal de sede · señal hace 8 min',
  ])
  expect(list.textContent).toContain('Enter abre el primero · Esc cierra')
})

it('Enter abre el primero, las flechas eligen otro y Esc cierra', async () => {
  await render()
  await type('an')
  await key(searchBox(), 'ArrowDown')
  await key(searchBox(), 'ArrowDown')
  expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('T-0031')
  await key(searchBox(), 'Enter')
  expect(location).toBe('/dispositivos/tarjetas?tarjeta=c1')
  await type('an')
  await key(searchBox(), 'Enter')
  expect(location).toBe('/personal?persona=e1')
  await type('an')
  await key(searchBox(), 'Escape')
  expect(document.querySelector('[role="listbox"]')).toBeNull()
  await type('zz')
  expect(document.querySelector('[role="listbox"]')?.textContent).toContain('Nada coincide con «zz».')
})

it('sólo busca en lo que el rol ve, y la tecla / enfoca la búsqueda', async () => {
  await render(['supervisor'], '/asistencia')
  expect(searchBox().getAttribute('aria-label')).toBe('Buscar personas')
  await type('an')
  expect(server.calls.some(call => call.path.startsWith('/cards?') || call.path.startsWith('/devices?'))).toBe(false)
  await act(async () => searchBox().blur())
  await key(window, '/')
  await waitFor(() => document.activeElement === searchBox())
})

it('el menú Crear ofrece sólo lo que cada rol puede hacer', () => {
  expect(createOptions(me(['admin_empresa'])).map(item => item.label)).toEqual(['Dar de alta a una persona', 'Crear un horario', 'Activar un lector', 'Registrar una tarjeta', 'Cerrar la semana'])
  expect(createOptions(me(['rh'])).map(item => item.key)).toEqual(['P', 'H', 'L', 'T', 'S'])
  expect(createOptions(me(['supervisor']))).toEqual([])
  expect(createOptions(me(['auditor']))).toEqual([])
})

it('la tecla C abre el menú Crear y cada opción abre su ventana sobre la página actual', async () => {
  await render()
  await key(window, 'c')
  await waitFor(() => !!document.querySelector('[role="menu"][aria-label="Crear"]'))
  const menu = document.querySelector('[role="menu"][aria-label="Crear"]')!
  expect([...menu.querySelectorAll('[role="menuitem"]')].map(item => item.textContent)).toEqual([
    'Dar de alta a una personaPersonal y horariosP', 'Crear un horarioTurnos con su vigenciaH', 'Activar un lectorCódigo de un solo usoL', 'Registrar una tarjetaInventario de tarjetasT', 'Cerrar la semanaToda la empresa o una sedeS',
  ])
  await key(menu as HTMLElement, 't')
  await waitFor(() => !!document.querySelector('[role="dialog"]'))
  expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Registrar una tarjeta')
  expect(location).toBe('/personal/fuentes')
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(item => item.textContent === 'Cancelar')!.click())
  await settle()
  await act(async () => container.querySelector<HTMLButtonElement>('header button[aria-keyshortcuts="C"]')!.click())
  await waitFor(() => !!document.querySelector('[role="menu"]'))
  await act(async () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.startsWith('Cerrar la semana'))!.click())
  await settle()
  expect(location).toBe('/cierres?cerrar=1')
})

it('Supervisión no ve el botón Crear', async () => {
  await render(['supervisor'], '/asistencia')
  expect(container.querySelector('header button[aria-keyshortcuts="C"]')).toBeNull()
})

it('cumple las reglas automáticas de accesibilidad con la búsqueda y el menú abiertos', async () => {
  await render()
  await type('an')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await key(searchBox(), 'Escape')
  await act(async () => container.querySelector<HTMLButtonElement>('header button[aria-keyshortcuts="C"]')!.click())
  await waitFor(() => !!document.querySelector('[role="menu"]'))
  expect(await accessibilityViolations(document.body)).toEqual([])
}, 20_000)
