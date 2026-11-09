// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown }
const server = vi.hoisted(() => ({ calls: [] as Call[], handler: (_path: string, _method: string, _body?: unknown): Promise<unknown> => new Promise(() => {}) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() }, identityBase: 'http://localhost:8082' }))
vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  api: vi.fn((path: string, method = 'GET', body?: unknown) => { server.calls.push({ path, method, body }); return server.handler(path, method, body) }),
}))
import { ApiError, type Me } from './api'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { waitFor } from './testUi'

const totals = (ordinaryMinutes: number, overtimeMinutes = 0) => ({ workedMinutes: ordinaryMinutes + overtimeMinutes, breakMinutes: 0, ordinaryMinutes, overtimeMinutes })
const closure = (id: string, employeeId: string, employeeName: string, extra: object) => ({ id, employeeId, employeeName, employeeExternalId: '0001', weekStart: '2026-10-26', version: 1, status: 'closed',
  ruleSet: { id: 'r', version: 2 }, totals: totals(2400), hash: `e02c${'1'.repeat(56)}9b13`, closedAt: '2026-11-02T16:16:00Z', closedBy: 'u3', closedByName: 'Rocío Navarro', acknowledgement: null, ...extra })
const carmen = closure('c1', 'e10', 'Carmen Vega', { employeeExternalId: '0101', acknowledgement: { id: 'k1', closureId: 'c1', type: 'objected', note: 'Falta mi salida del jueves 29.', at: '2026-11-03T01:05:00Z', evidenceHash: 'h' } })
const ana = closure('c2', 'e11', 'Ana Torres', { employeeExternalId: '0102', totals: totals(2880, 255), acknowledgement: { id: 'k2', closureId: 'c2', type: 'agreed', note: null, at: '2026-11-03T00:40:00Z', evidenceHash: 'h' } })
const jorge = closure('c3', 'e12', 'Jorge Ramírez', { employeeExternalId: '0103', closedBy: null, closedByName: null })
const summary = { weekStart: '2026-10-26', closed: 36, reopened: 0, blocked: 3, acknowledgements: { agreed: 31, objected: 1, none: 4 } }
const run = (extra: object) => ({ id: 'r1', weekStart: '2026-10-26', siteId: null, origin: 'requested', status: 'done', total: 42, closed: 39, blocked: { openIncidents: 2, openSegment: 1 },
  requestedBy: 'u3', requestedByName: 'Rocío Navarro', failure: null, createdAt: '2026-11-02T16:15:00Z', startedAt: '2026-11-02T16:15:01Z', finishedAt: '2026-11-02T16:16:00Z', ...extra })
const blocking = [
  { id: 'inc1', type: 'missing_pair', employeeId: 'e1', employeeName: 'Marco Ibarra', siteId: '5b1f2c3d-0000-4000-8000-000000000001', occurredAt: '2026-10-30T15:00:00Z', openedAt: '2026-11-02T16:16:00Z', assigneeUserId: null },
  { id: 'inc2', type: 'clock_anomaly', employeeId: 'e2', employeeName: 'Teresa Lugo', siteId: '5b1f2c3d-0000-4000-8000-000000000002', occurredAt: '2026-10-30T14:00:00Z', openedAt: '2026-10-30T14:00:00Z', assigneeUserId: 'u3' },
  { id: 'inc3', type: 'duplicate', employeeId: 'e3', employeeName: 'Iván Cruz', siteId: '5b1f2c3d-0000-4000-8000-000000000001', occurredAt: '2026-10-28T15:00:00Z', openedAt: '2026-10-28T15:00:00Z', assigneeUserId: null },
]
let state: { runs: object[]; followed: object[]; reopened: boolean } = { runs: [], followed: [], reopened: false }

function defaultServer(path: string, method: string, body?: unknown): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const query = url.searchParams
  const answer = (value: unknown) => Promise.resolve(value)
  const page = (items: unknown[]) => answer({ items, nextCursor: null })
  if (method === 'POST' && url.pathname === '/week-closure-runs') return answer(run({ id: 'r2', status: 'queued', total: null, closed: 0, blocked: { openIncidents: 0, openSegment: 0 }, siteId: (body as { siteId?: string }).siteId || null, requestedByName: 'Mariana Ortiz' }))
  if (method === 'POST' && url.pathname === '/week-closures/c1/reopen') { state.reopened = true; return answer({ ...carmen, status: 'reopened' }) }
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/incidents/summary': return answer({ weekStart: '2026-11-02', open: { total: 3, unassigned: 2, mine: 0, high: 1, medium: 1, low: 1, blockingClosure: 3 }, resolved: { total: 0, thisWeek: 0 } })
    case '/sites': return page([{ id: '5b1f2c3d-0000-4000-8000-000000000001', name: 'Matriz Centro' }, { id: '5b1f2c3d-0000-4000-8000-000000000002', name: 'Bodega Norte' }])
    case '/tenant': return answer({ id: 't', name: 'Empresa Demo', timeZone: 'America/Mexico_City', weekStartsOn: 'monday', autoCloseAfterHours: null })
    case '/rule-sets': return answer({ items: [{ id: 'r', version: 2, validFrom: '2026-01-01', validTo: null, weeklyOrdinaryMaxMinutes: 2880, parameters: {} }] })
    case '/week-closures/summary': return answer(query.get('week')! >= '2026-11-02' ? { ...summary, weekStart: '2026-11-02', closed: 0, blocked: 0, acknowledgements: { agreed: 0, objected: 0, none: 0 } } : summary)
    case '/week-closure-runs': return page(query.get('week')! >= '2026-11-02' ? [] : state.runs)
    case '/week-closure-runs/r2': return answer(state.followed.shift() || run({ id: 'r2', status: 'done', closed: 39 }))
    case '/incidents': return page(query.get('week')! >= '2026-11-02' ? [] : query.get('siteId') ? blocking.filter(item => item.siteId === query.get('siteId')) : blocking)
    case '/week-closures': return page(query.get('status') === 'reopened' ? [] : query.get('acknowledgement') === 'objected' ? [carmen] : [carmen, ana, jorge])
    case '/week-closures/c1': return answer(state.reopened ? { ...carmen, status: 'reopened' } : carmen)
    case '/employees/e10/attendance': return answer({ employeeId: 'e10', weekStart: '2026-10-26', timeZone: 'America/Mexico_City', ruleSet: { id: 'r', version: 2 }, segments: [], totals: totals(2400), alerts: [], openIncidentIds: [],
      closure: { id: 'c1', version: 1, status: 'closed' }, days: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].map(date => ({ date, workedMinutes: 480, breakMinutes: 0, ordinaryMinutes: 480, overtimeMinutes: 0 })) })
    case '/attendance/summary': return answer({ people: 42, day: {}, week: {} })
  }
  return new Promise(() => {})
}

let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
let phone = false
let location = ''
function Probe() { location = useLocation().search; return null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T16:30:00Z') })
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  server.calls = []; server.handler = defaultServer; phone = false
  state = { runs: [run({})], followed: [], reopened: false }
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers() })

async function render(path = '/cierres', roles = ['admin_empresa']) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' } }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Probe /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await waitFor(() => ![...document.querySelectorAll('[role="status"]')].some(item => item.textContent?.startsWith('Cargando')))
}
const text = () => document.body.textContent || ''
const cells = () => [...container.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent))
const banner = () => container.querySelector('section[aria-labelledby="corrida-t"]')?.textContent || ''
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label)
const linkTo = (label: string) => [...document.querySelectorAll<HTMLAnchorElement>('a')].find(item => item.textContent?.startsWith(label))!
const sheet = () => document.querySelector('button[aria-label="Cerrar detalle"]')?.closest('section') as HTMLElement
const posts = () => server.calls.filter(call => call.method === 'POST')

it('abre la última semana terminada con su corrida, los acuses y quién quedó cerrado', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Cierres semanales · la semana cerrada es la base para nómina y para el expediente')
  expect(server.calls.some(call => call.path === '/week-closures/summary?week=2026-10-30')).toBe(true)
  expect(text()).toContain('26 oct – 1 nov 2026')
  expect(banner()).toContain('Última corrida · lunes 2 nov, 10:15')
  expect(banner()).toContain('Pedida por Rocío Navarro · terminada')
  expect(banner()).toContain('39 cerradas de 42')
  expect(banner()).toContain('Cierre automático: desactivado')
  expect(container.querySelector('section[aria-label="Acuses"]')?.textContent).toBe('31Conformes1Con objeción4Sin acuse')
  expect(container.querySelector('[role="note"]')?.textContent).toBe('Bloqueadas:Iván Cruz · 1 incidencia abiertaTeresa Lugo · 1 incidencia abiertaMarco Ibarra · tramo abierto vie 30')
  expect([...container.querySelectorAll('nav[aria-label="Personas de la semana"] a')].map(link => link.textContent)).toEqual(['Cerradas · 36', 'Bloqueadas · 3', 'Reabiertas · 0'])
  expect(cells()).toEqual([
    ['Carmen Vega 0101', '40:00', '0:00', 'Rocío Navarro', 'e02c…9b13', 'Objeción'],
    ['Ana Torres 0102', '48:00', '4:15', 'Rocío Navarro', 'e02c…9b13', 'Conforme'],
    ['Jorge Ramírez 0103', '40:00', '0:00', 'Cierre programado', 'e02c…9b13', 'Sin acuse'],
  ])
  // Los bloqueados llevan a su incidencia en Incidencias, con la semana.
  expect(linkTo('Marco Ibarra').getAttribute('href')).toBe('/incidencias?semana=2026-10-26&incidencia=inc1')
})

it('la pestaña de bloqueadas sale de las incidencias que bloquean, por persona', async () => {
  await render('/cierres?pestana=bloqueadas')
  expect(cells()).toEqual([
    ['Iván Cruz', 'Matriz Centro', '1 incidencia abierta', 'mié 28 oct', 'Marca duplicada · sin asignar'],
    ['Teresa Lugo', 'Bodega Norte', '1 incidencia abierta', 'vie 30 oct', 'Hora del teléfono alterada'],
    ['Marco Ibarra', 'Matriz Centro', 'Tramo abierto', 'vie 30 oct', 'Falta la marca que cierra · sin asignar'],
  ])
  expect(server.calls.some(call => call.path.startsWith('/incidents?week=2026-10-30&blocksClosure=true&status=open'))).toBe(true)
})

it('filtra por acuse y por alcance en el servidor', async () => {
  await render()
  await act(async () => linkTo('1Con objeción').click())
  await waitFor(() => server.calls.some(call => call.path.includes('acknowledgement=objected')))
  expect(location).toContain('acuse=objecion')
  await waitFor(() => cells().length === 1)
  const select = container.querySelector<HTMLSelectElement>('select[name="alcance"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, '5b1f2c3d-0000-4000-8000-000000000002'); select.dispatchEvent(new Event('change', { bubbles: true })) })
  await waitFor(() => server.calls.some(call => call.path === '/week-closures/summary?week=2026-10-30&siteId=5b1f2c3d-0000-4000-8000-000000000002'))
  expect(server.calls.some(call => call.path.startsWith('/week-closures?') && call.path.includes('siteId=5b1f2c3d-0000-4000-8000-000000000002') && call.path.includes('acknowledgement=objected'))).toBe(true)
})

it('cierra las pendientes como trabajo, sigue la corrida y al terminar actualiza la pantalla', async () => {
  state.followed = [run({ id: 'r2', status: 'running', total: 42, closed: 25, blocked: { openIncidents: 2, openSegment: 0 }, requestedByName: 'Mariana Ortiz' })]
  await render()
  await act(async () => button('Cerrar las pendientes')!.click())
  await waitFor(() => !!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]')!.textContent!.includes('42personas'))
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.textContent).toContain('Cerrar la semana 26 oct – 1 nov')
  expect(dialog.textContent).toContain('42personas3por cerrar3seguirán bloqueadas')
  expect([...dialog.querySelectorAll('tbody tr')].map(tr => tr.textContent)).toEqual(['Iván CruzMarca duplicada', 'Teresa LugoHora del teléfono alterada', 'Marco IbarraFalta la marca que cierra'])
  // Cambiar el alcance vuelve a contar con esa sede.
  await act(async () => dialog.querySelector<HTMLInputElement>('input[value="5b1f2c3d-0000-4000-8000-000000000002"]')!.click())
  await waitFor(() => server.calls.some(call => call.path === '/week-closures/summary?week=2026-10-26&siteId=5b1f2c3d-0000-4000-8000-000000000002'))
  await act(async () => dialog.querySelector<HTMLInputElement>('input[value=""]')!.click())
  await act(async () => [...dialog.querySelectorAll('button')].find(item => item.textContent?.startsWith('Cerrar 3'))!.click())
  await waitFor(() => posts().length === 1)
  expect(posts()[0]).toEqual({ path: '/week-closure-runs', method: 'POST', body: { weekStart: '2026-10-26' } })
  await waitFor(() => banner().includes('27 de 42 revisadas'))
  expect(banner()).toContain('Corrida en curso · toda la empresa · 26 oct – 1 nov')
  expect(banner()).toContain('Por revisar 15')
  expect(button('Cerrando…')?.disabled).toBe(true)
  // Al terminar, se vuelven a pedir la lista, los conteos y las incidencias.
  const before = server.calls.filter(call => call.path.startsWith('/week-closures/summary')).length
  await act(async () => { await cache.invalidateQueries({ queryKey: ['closure-run'] }) })
  await waitFor(() => banner().includes('39 cerradas de 42'))
  await waitFor(() => server.calls.filter(call => call.path.startsWith('/week-closures/summary')).length > before)
})

it('una semana sin terminar no se puede cerrar todavía', async () => {
  await render('/cierres?semana=2026-11-04')
  expect(button('Cerrar las pendientes')?.disabled).toBe(true)
  expect(text()).toContain('Se puede cerrar desde el lunes 9 de noviembre.')
  expect(banner()).toContain('Sin corridas de cierre en esta semana')
})

it('si el seguimiento recibe 429 se pausa y se puede reanudar; una fallida se pide otra vez con el mismo alcance', async () => {
  state.runs = [run({ status: 'running', id: 'r9', siteId: '5b1f2c3d-0000-4000-8000-000000000001' })]
  state.followed = [run({ id: 'r2', status: 'running', siteId: '5b1f2c3d-0000-4000-8000-000000000001', total: 20, closed: 4, blocked: { openIncidents: 0, openSegment: 0 } })]
  server.handler = (path, method, body) => path === '/week-closure-runs/r9' ? Promise.reject(new ApiError(429, 'too_many_requests', 'Demasiadas consultas.')) : defaultServer(path, method, body)
  await render()
  await waitFor(() => banner().includes('El seguimiento está en pausa por demasiadas consultas'))
  server.handler = (path, method, body) => path === '/week-closure-runs/r9' ? Promise.resolve(run({ id: 'r9', siteId: '5b1f2c3d-0000-4000-8000-000000000001', status: 'failed', failure: 'job_abandoned' })) : defaultServer(path, method, body)
  await act(async () => button('Reanudar')!.click())
  await waitFor(() => banner().includes('El trabajo agotó sus reintentos. Lo ya cerrado se conserva.'))
  await act(async () => button('Pedir otra con el mismo alcance')!.click())
  await waitFor(() => posts().length === 1)
  expect(posts()[0].body).toEqual({ weekStart: '2026-10-26', siteId: '5b1f2c3d-0000-4000-8000-000000000001' })
  await waitFor(() => banner().includes('Corrida en curso · Matriz Centro'))
})

it('el cierre de una persona muestra lo congelado, sus días y la objeción, y Administración lo reabre con motivo', async () => {
  await render('/cierres?cierre=c1')
  await waitFor(() => !!sheet()?.textContent?.includes('Días trabajados') && !sheet()!.textContent!.includes('…Días'))
  const panel = sheet()
  expect(panel.textContent).toContain('Cierre versión 1 · 26 oct – 1 nov')
  expect(panel.textContent).toContain('40:00Ordinarias0:00Extra5Días trabajados')
  expect(panel.textContent).toContain('Objeción · lun 2 nov, 19:05, desde la app«Falta mi salida del jueves 29.»')
  expect(panel.textContent).toContain('CerróRocío Navarro, lun 2 nov, 10:16')
  expect(panel.textContent).toContain('Reglas2026, versión 2')
  expect(panel.querySelector('a[href="/asistencia?semana=2026-10-26&persona=e10&ficha=marcajes"]')?.textContent).toBe('Ver marcajes')
  const reason = panel.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, '  Revisar la salida del jueves 29.  '); reason.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => button('Reabrir semana')!.click())
  await waitFor(() => posts().length === 1)
  expect(posts()[0]).toEqual({ path: '/week-closures/c1/reopen', method: 'POST', body: { reason: 'Revisar la salida del jueves 29.' } })
  await waitFor(() => sheet().textContent!.includes('Listo: la semana quedó reabierta'))
  expect(sheet().textContent).toContain('Reabierta: este cierre ya no vale')
  expect(button('Reabrir semana')).toBeUndefined()
  expect(await accessibilityViolations(container)).toEqual([])
})

it('si otra persona ya la reabrió, lo dice y vuelve a pedir el cierre', async () => {
  server.handler = (path, method, body) => method === 'POST' && path.endsWith('/reopen') ? Promise.reject(new ApiError(409, 'closure_not_closed', 'Ya está reabierto.')) : defaultServer(path, method, body)
  await render('/cierres?cierre=c1')
  await waitFor(() => !!sheet()?.querySelector('textarea'))
  const reason = sheet().querySelector<HTMLTextAreaElement>('textarea[name="reason"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Revisar la salida del jueves.'); reason.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => button('Reabrir semana')!.click())
  await waitFor(() => text().includes('Otra persona ya la reabrió.'))
  expect(server.calls.filter(call => call.path === '/week-closures/c1').length).toBeGreaterThan(1)
})

it.each(['supervisor', 'auditor'])('%s consulta sin cerrar ni reabrir', async role => {
  await render('/cierres?cierre=c1', [role])
  await waitFor(() => !!sheet()?.textContent?.includes('Días trabajados'))
  expect(button('Cerrar las pendientes')).toBeUndefined()
  expect(sheet().querySelector('textarea')).toBeNull()
  expect(sheet().textContent).toContain('Reabrir una semana sólo lo puede hacer Administración.')
})

it('supervisión ve las corridas de su sede y sabe que las de toda la empresa no aparecen', async () => {
  state.runs = []
  await render('/cierres', ['supervisor'])
  expect(banner()).toBe('Sin corridas de tu sede en esta semana36 cerradasLas corridas de toda la empresa no aparecen aquí; lo que cerraron, sí.Cierre automático: desactivado')
})

it('RH cierra pero no reabre', async () => {
  await render('/cierres?cierre=c1', ['rh'])
  await waitFor(() => !!sheet()?.textContent?.includes('Días trabajados'))
  expect(button('Cerrar las pendientes')).toBeDefined()
  expect(sheet().querySelector('textarea')).toBeNull()
})

it('en teléfono muestra la corrida, los acuses, las bloqueadas y el botón a lo ancho', async () => {
  phone = true
  await render()
  expect(banner()).toContain('39 cerradas de 42')
  expect(button('Cerrar las pendientes')).toBeDefined()
  expect([...container.querySelectorAll('main li a strong')].map(item => item.textContent)).toEqual(['Carmen Vega', 'Ana Torres', 'Jorge Ramírez'])
  expect(container.querySelector('main li a')?.textContent).toContain('0101 · 40:00 + 0:00 extra · Rocío Navarro')
  expect(await accessibilityViolations(container)).toEqual([])
})

it('la pantalla y el diálogo no tienen fallas automáticas de accesibilidad', async () => {
  await render()
  expect(container.querySelectorAll('h1')).toHaveLength(1)
  expect(await accessibilityViolations(container)).toEqual([])
  await act(async () => button('Cerrar las pendientes')!.click())
  await waitFor(() => !!document.querySelector('[role="dialog"]'))
  expect(await accessibilityViolations(document.querySelector('[role="dialog"]')!)).toEqual([])
})
