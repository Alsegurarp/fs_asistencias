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
import { click, waitFor } from './testUi'

const base = { siteId: 's1', eventIds: [] as string[], assigneeUserId: null, assigneeName: null, assignedAt: null, assignedBy: null, assignedByName: null, blocksClosure: false, resolution: null, status: 'open' }
const incident = (id: string, type: string, severity: string, employeeId: string, employeeName: string, employeeExternalId: string, occurredAt: string, extra: object = {}) =>
  ({ ...base, id, type, severity, employeeId, employeeName, employeeExternalId, occurredAt, openedAt: '2026-11-06T06:05:00Z', ...extra })
const missing = incident('inc1', 'missing_pair', 'medium', 'e2', 'Luis Hernández', '0114', '2026-11-05T15:04:00Z', { eventIds: ['a1b2c3d4-0000-4000-8000-000000000001'] })
const duplicate = incident('inc2', 'duplicate', 'low', 'e5', 'Iván Cruz', '0128', '2026-10-28T15:00:00Z', { blocksClosure: true })
const foreign = incident('inc3', 'foreign_site', 'medium', 'e3', 'Carmen Vega', '0121', '2026-11-06T14:51:00Z',
  { siteId: 's2', assigneeUserId: 'u2', assigneeName: 'Hugo Peña', assignedAt: '2026-11-06T15:12:00Z', assignedBy: 'self', assignedByName: 'Mariana Ortiz' })
const anomaly = incident('inc4', 'clock_anomaly', 'high', 'e4', 'Teresa Lugo', '0171', '2026-10-30T14:00:00Z', { assigneeUserId: 'self', assigneeName: 'Mariana Ortiz', assignedAt: '2026-11-02T10:00:00Z' })
const resolvedAdjusted = incident('r1', 'missing_pair', 'medium', 'e6', 'Jorge Ramírez', '0192', '2026-10-29T15:00:00Z', {
  status: 'resolved', openedAt: '2026-10-30T06:05:00Z', assigneeUserId: 'u3', assigneeName: 'Rocío Navarro', assignedAt: '2026-10-30T15:12:00Z', assignedByName: 'Hugo Peña',
  resolution: { decision: 'adjusted', reason: 'El lector no respondió a la salida.', resolvedBy: 'u3', resolvedByName: 'Rocío Navarro', resolvedAt: '2026-11-04T00:40:00Z',
    adjustment: { kind: 'add_event', eventType: 'clock_out', occurredAt: '2026-10-29T23:00:00Z' } },
})
const resolvedOld = incident('r2', 'duplicate', 'low', 'e7', 'Paola Ruiz', '0211', '2026-10-21T15:00:00Z', {
  status: 'resolved', resolution: { decision: 'confirmed', reason: 'Pasó la tarjeta dos veces.', resolvedBy: 'self', resolvedByName: 'Mariana Ortiz', resolvedAt: '2026-10-22T18:00:00Z', adjustment: null },
})
const summary = { weekStart: '2026-11-02', open: { total: 4, unassigned: 2, mine: 1, high: 1, medium: 2, low: 1, blockingClosure: 1 }, resolved: { total: 27, thisWeek: 5 } }
const day = (dayOfWeek: string) => ({ dayOfWeek, startTime: '09:00', endTime: '18:00', breakMinutes: 0 })
let state: Record<string, unknown> = {}

function defaultServer(path: string, method: string, body?: unknown): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const query = url.searchParams
  const answer = (value: unknown) => Promise.resolve(value)
  const page = (items: unknown[]) => answer({ items, nextCursor: null })
  if (method === 'PATCH' && url.pathname === '/incidents/inc1') {
    const change = body as { assigneeUserId?: string | null; resolution?: { decision: string; reason: string; adjustment?: unknown } }
    const current = (state.inc1 || missing) as typeof missing
    const updated = change.resolution
      ? { ...current, status: 'resolved', resolution: { ...change.resolution, adjustment: change.resolution.adjustment || null, resolvedBy: 'self', resolvedByName: 'Mariana Ortiz', resolvedAt: '2026-11-06T16:30:00Z' } }
      : { ...current, assigneeUserId: change.assigneeUserId ?? null, assigneeName: change.assigneeUserId === 'u2' ? 'Hugo Peña' : null, assignedAt: change.assigneeUserId ? '2026-11-06T16:30:00Z' : null, assignedByName: change.assigneeUserId ? 'Mariana Ortiz' : null }
    state.inc1 = updated
    return answer(updated)
  }
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/incidents/summary': return answer(state.summary || summary)
    case '/sites': return page([{ id: 's1', name: 'Matriz Centro' }, { id: 's2', name: 'Bodega Norte' }])
    case '/schedules': return page([{ id: 'h2', name: 'Oficina L–V', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day) }])
    case '/employees/e2': return answer({ id: 'e2', displayName: 'Luis Hernández', externalId: '0114', siteId: 's1', currentScheduleId: 'h2' })
    case '/employees/e6': return answer({ id: 'e6', displayName: 'Jorge Ramírez', externalId: '0192', siteId: 's1', currentScheduleId: null })
    case '/employees/e6/attendance': return answer({ employeeId: 'e6', weekStart: '2026-10-26', timeZone: 'America/Mexico_City', closure: null, segments: [], totals: {}, alerts: [], openIncidentIds: [] })
    case '/incidents/inc1': return answer(state.inc1 || missing)
    case '/incidents/r1': return answer(resolvedAdjusted)
    case '/incidents/inc1/assignees': return page([{ id: 'self', displayName: 'Mariana Ortiz', roles: ['admin_empresa'] }, { id: 'u2', displayName: 'Hugo Peña', roles: ['supervisor'] }])
    case '/attendance-events': return page(query.get('employeeId') === 'e2' ? [{ id: 'a1b2c3d4-0000-4000-8000-000000000001', employeeId: 'e2', siteId: 's1', deviceMode: 'terminal', type: 'clock_in', outcome: 'accepted_with_incident',
      observedAt: '2026-11-05T15:04:00Z', receivedAt: '2026-11-05T15:04:00Z', delaySeconds: 0, locationVerdict: 'inside', accuracyMeters: 12, incidentIds: ['inc1'] }] : [])
    case '/incidents': {
      if (query.get('status') === 'resolved') return page([resolvedAdjusted, resolvedOld])
      let rows = [anomaly, missing, foreign, duplicate]
      if (query.get('assignee') === 'unassigned') rows = [missing, duplicate]
      if (query.get('assignee') === 'assigned') rows = [anomaly, foreign]
      if (query.get('assignee') === 'me') rows = [anomaly]
      if (query.get('q')) rows = rows.filter(row => row.employeeName.toLowerCase().includes(query.get('q')!.toLowerCase()))
      return page(state.empty ? [] : rows)
    }
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
  server.calls = []; server.handler = defaultServer; state = {}; phone = false
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers() })

async function render(path = '/incidencias', roles = ['admin_empresa']) {
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
const lists = () => server.calls.filter(call => call.method === 'GET' && call.path.startsWith('/incidents?')).map(call => new URL(call.path, 'http://zenit.test').searchParams)
const patches = () => server.calls.filter(call => call.method === 'PATCH').map(call => call.body)
const chip = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(button => button.textContent?.startsWith(label))!
const sheet = () => document.querySelector('button[aria-label="Cerrar detalle"]')?.closest('section') as HTMLElement
const linkTo = (label: string) => [...document.querySelectorAll<HTMLAnchorElement>('a')].find(link => link.textContent === label)!
async function setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
const field = <T extends Element>(selector: string) => document.querySelector<T>(selector)!
const reason = 'El lector de Recepción no respondió a la salida.'

it('lista las abiertas ordenadas por severidad con lo que resuelve el servidor', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Incidencias · lo que el sistema detectó al recibir las marcas')
  expect(lists()[0].toString()).toBe('status=open&sort=severity&limit=25')
  expect(cells()).toEqual([
    ['Hora del teléfono alterada', 'Teresa Lugo 0171', 'Matriz Centro', 'vie 30 oct', 'Alta', 'Mariana Ortiz', '—', 'Resolver Hora del teléfono alterada de Teresa Lugo'],
    ['Falta la marca que cierra', 'Luis Hernández 0114', 'Matriz Centro', 'ayer 09:04', 'Media', 'Sin asignar', '—', 'Resolver Falta la marca que cierra de Luis Hernández'],
    ['Marcó en otra sede', 'Carmen Vega 0121', 'Bodega Norte', 'hoy 08:51', 'Media', 'Hugo Peña', '—', 'Resolver Marcó en otra sede de Carmen Vega'],
    ['Marca duplicada', 'Iván Cruz 0128', 'Matriz Centro', 'mié 28 oct', 'Baja', 'Sin asignar', 'Sí', 'Resolver Marca duplicada de Iván Cruz'],
  ])
  expect([...container.querySelectorAll('nav[aria-label="Estado"] a')].map(link => link.textContent)).toEqual(['Abiertas · 4', 'Resueltas · 27'])
  expect([...container.querySelectorAll('button[aria-pressed]')].map(button => button.textContent)).toEqual(['Mías · 1', 'Severidad alta · 1', 'Bloquean un cierre · 1'])
  // El menú lleva cuántas siguen abiertas.
  expect(container.querySelector('aside a[href="/incidencias"]')?.textContent).toBe('Incidencias, 4 abiertas4')
  // El texto para lectores de pantalla mide un píxel: con 100 % desbordaba la página.
  const hidden = [...container.querySelectorAll('tbody td:last-child a span')][0] as HTMLElement
  expect([getComputedStyle(hidden).width, getComputedStyle(hidden).position]).toEqual(['1px', 'absolute'])
  // Persona y sede se cortan si son muy largas, y el texto completo queda en el título.
  const person = container.querySelector('tbody tr td:nth-child(2)') as HTMLElement
  expect([person.title, getComputedStyle(person).textOverflow, getComputedStyle(person).maxWidth]).toEqual(['Teresa Lugo 0171', 'ellipsis', '260px'])
  expect((container.querySelector('tbody tr td:nth-child(3)') as HTMLElement).title).toBe('Matriz Centro')
})

it('busca, filtra por tipo y con los filtros de un toque en el servidor, y lo deja en la dirección', async () => {
  await render()
  await act(async () => chip('Bloquean un cierre').click())
  await waitFor(() => lists().some(query => query.get('blocksClosure') === 'true'))
  await act(async () => chip('Mías').click())
  await waitFor(() => lists().some(query => query.get('assignee') === 'me' && query.get('blocksClosure') === 'true'))
  expect(location).toContain('bloquean=1')
  await setValue(field<HTMLSelectElement>('select[name="tipo"]'), 'foreign_site')
  await waitFor(() => lists().some(query => query.get('type') === 'foreign_site'))
  expect(server.calls.some(call => call.path === '/incidents/summary?type=foreign_site')).toBe(true)
  await setValue(field<HTMLInputElement>('input[name="q"]'), 'Luis')
  await waitFor(() => lists().some(query => query.get('q') === 'Luis' && query.get('type') === 'foreign_site'))
  // En las resueltas no hay «bloquean un cierre»: sólo una abierta bloquea.
  await act(async () => linkTo('Resueltas · 27').click())
  await waitFor(() => lists().some(query => query.get('status') === 'resolved' && query.get('sort') === 'resolved'))
  expect(lists().at(-1)!.get('blocksClosure')).toBeNull()
  expect([...container.querySelectorAll('button[aria-pressed]')].map(button => button.textContent)).toEqual(['Mías', 'Severidad alta'])
})

it('desde Cierres llega con la semana elegida, que se puede quitar', async () => {
  await render('/incidencias?semana=2026-11-02&incidencia=inc1')
  expect(lists()[0].get('week')).toBe('2026-11-02')
  expect(sheet().querySelector('h2')?.textContent).toBe('Falta la marca que cierra')
  await act(async () => chip('Semana 2 – 8 nov').click())
  await waitFor(() => !location.includes('semana='))
})

it('el tablero reparte sin asignar, asignadas y resueltas de esta semana', async () => {
  await render('/incidencias?vista=tablero')
  const columns = [...container.querySelectorAll('main section[aria-labelledby^="columna"]')]
  expect(columns.map(column => column.querySelector('h2')?.textContent)).toEqual(['Sin asignar · 2', 'Asignadas · 2', 'Resueltas esta semana · 5'])
  expect(columns.map(column => [...column.querySelectorAll('a strong')].map(item => item.textContent))).toEqual([
    ['Falta la marca que cierra', 'Marca duplicada'], ['Hora del teléfono alterada', 'Marcó en otra sede'], ['Falta la marca que cierra'],
  ])
  expect(columns[1].textContent).toContain('Asignada a Hugo Peña')
  expect(columns[0].textContent).toContain('Bloquea el cierre')
  // Se muestran las de esta semana; las demás, en la lista de resueltas.
  expect(columns[2].querySelector('a[href*="estado=resueltas"]')?.textContent).toBe('Ver 4 más')
  expect(lists().map(query => query.get('assignee') || query.get('status'))).toEqual(expect.arrayContaining(['unassigned', 'assigned', 'resolved']))
  expect(window.localStorage.getItem('zenit.incidencias.vista')).toBe('tablero')
  expect(await accessibilityViolations(container)).toEqual([])
})

it('el detalle muestra las marcas del día, la salida que falta, y asigna', async () => {
  await render('/incidencias?incidencia=inc1')
  await waitFor(() => !!sheet()?.textContent?.includes('Marcas del día') && !sheet()!.textContent!.includes('Cargando las marcas'))
  const panel = sheet()
  expect(panel.querySelector('h2')?.textContent).toBe('Falta la marca que cierra')
  expect(panel.textContent).toContain('Luis Hernández · 0114 · jueves 5 de noviembre')
  expect(panel.textContent).toContain('Horario' + 'Oficina L–V · L–V 09:00–18:00')
  expect([...panel.querySelectorAll('ol li')].map(li => li.textContent)).toEqual([
    'Entrada09:04· Terminal de Matriz Centro · dentro de la sede · precisión 12 m · abrió la incidencia', 'SalidaSin marca',
  ])
  // Para «falta la marca que cierra» el formulario ya propone agregar la salida.
  expect(field<HTMLInputElement>('input[name="decision"][value="adjusted"]').checked).toBe(true)
  expect(field<HTMLSelectElement>('select[name="eventType"]').value).toBe('clock_out')
  const assignee = panel.querySelector<HTMLSelectElement>('select[aria-labelledby]')!
  await waitFor(() => assignee.options.length === 3)
  expect([...assignee.options].map(option => option.textContent)).toEqual(['Sin asignar', 'Mariana Ortiz (yo) · Administración', 'Hugo Peña · Supervisión'])
  await setValue(assignee, 'u2')
  await waitFor(() => patches().length === 1)
  expect(patches()).toEqual([{ assigneeUserId: 'u2' }])
  await waitFor(() => assignee.value === 'u2')
  expect(await accessibilityViolations(container)).toEqual([])
})

it('agrega la salida convirtiendo la hora de la empresa a UTC y muestra lo resuelto', async () => {
  await render('/incidencias?incidencia=inc1')
  await waitFor(() => !!document.querySelector('input[name="time"]'))
  await setValue(field<HTMLInputElement>('input[name="time"]'), '18:02')
  await setValue(field<HTMLTextAreaElement>('textarea[name="reason"]'), reason)
  await click('Guardar resolución')
  await waitFor(() => patches().length === 1)
  expect(patches()[0]).toEqual({ resolution: { decision: 'adjusted', reason, adjustment: { kind: 'add_event', eventType: 'clock_out', occurredAt: '2026-11-06T00:02:00.000Z' } } })
  await waitFor(() => !!sheet()?.textContent?.includes('Resuelta como ajustada'))
  expect(sheet().textContent).toContain('Listo: la incidencia quedó resuelta.')
  expect(sheet().textContent).toContain('Se agregó la salida de las 18:02')
  // La lista y los conteos se vuelven a pedir.
  await waitFor(() => server.calls.filter(call => call.path === '/incidents/summary').length > 1)
})

it.each([['exclude_event', { kind: 'exclude_event', eventId: 'a1b2c3d4-0000-4000-8000-000000000001' }], ['retype_event', { kind: 'retype_event', eventId: 'a1b2c3d4-0000-4000-8000-000000000001', eventType: 'break_end' }]])('envía sólo los campos de %s', async (kind, adjustment) => {
  await render('/incidencias?incidencia=inc1')
  await waitFor(() => !!document.querySelector('select[name="kind"]') && !sheet().textContent!.includes('Cargando las marcas'))
  await setValue(field<HTMLSelectElement>('select[name="kind"]'), kind)
  await waitFor(() => !!document.querySelector('select[name="eventId"]'))
  expect(field<HTMLSelectElement>('select[name="eventId"]').value).toBe('a1b2c3d4-0000-4000-8000-000000000001')
  if (kind === 'retype_event') await setValue(field<HTMLSelectElement>('select[name="eventType"]'), 'break_end')
  await setValue(field<HTMLTextAreaElement>('textarea[name="reason"]'), reason)
  await click('Guardar resolución')
  await waitFor(() => patches().length === 1)
  expect(patches()[0]).toEqual({ resolution: { decision: 'adjusted', reason, adjustment } })
})

it('con la semana cerrada conserva el formulario y muestra la referencia', async () => {
  server.handler = (path, method, body) => method === 'PATCH' ? Promise.reject(new ApiError(409, 'week_closed', 'La semana está cerrada.', 'ref-409')) : defaultServer(path, method, body)
  await render('/incidencias?incidencia=inc1')
  await waitFor(() => !!document.querySelector('input[name="decision"]'))
  await act(async () => field<HTMLInputElement>('input[name="decision"][value="justified"]').click())
  await setValue(field<HTMLTextAreaElement>('textarea[name="reason"]'), reason)
  await click('Guardar resolución')
  await waitFor(() => text().includes('ref-409'))
  expect(text()).toContain('pide a Administración que la reabra en Cierres')
  expect(field<HTMLTextAreaElement>('textarea[name="reason"]').value).toBe(reason)
})

it('si otra persona ya la resolvió, vuelve a pedirla y muestra su decisión', async () => {
  let resolvedElsewhere = false
  server.handler = (path, method, body) => {
    if (method === 'PATCH') { resolvedElsewhere = true; return Promise.reject(new ApiError(409, 'incident_already_resolved', 'Ya está resuelta.')) }
    if (path === '/incidents/inc1' && resolvedElsewhere) return Promise.resolve({ ...missing, status: 'resolved', resolution: { decision: 'justified', reason: 'Lo revisó Supervisión.', adjustment: null, resolvedBy: 'u2', resolvedByName: 'Hugo Peña', resolvedAt: '2026-11-06T16:00:00Z' } })
    return defaultServer(path, method, body)
  }
  await render('/incidencias?incidencia=inc1')
  await waitFor(() => !!document.querySelector('input[name="decision"]'))
  await act(async () => field<HTMLInputElement>('input[name="decision"][value="confirmed"]').click())
  await setValue(field<HTMLTextAreaElement>('textarea[name="reason"]'), reason)
  await click('Guardar resolución')
  await waitFor(() => !!sheet()?.textContent?.includes('Resuelta como justificada'))
  expect(sheet().textContent).toContain('Hugo Peña')
})

it('marca el error del motivo que da el servidor y conserva el texto', async () => {
  server.handler = (path, method, body) => method === 'PATCH'
    ? Promise.reject(new ApiError(422, 'validation', 'Revisa el motivo.', undefined, [{ field: 'resolution.reason', message: 'El motivo no puede repetir sólo espacios.' }]))
    : defaultServer(path, method, body)
  await render('/incidencias?incidencia=inc1')
  await waitFor(() => !!document.querySelector('input[name="decision"]'))
  await act(async () => field<HTMLInputElement>('input[name="decision"][value="justified"]').click())
  await setValue(field<HTMLTextAreaElement>('textarea[name="reason"]'), reason)
  await click('Guardar resolución')
  await waitFor(() => text().includes('El motivo no puede repetir sólo espacios.'))
  expect(field<HTMLTextAreaElement>('textarea[name="reason"]').getAttribute('aria-invalid')).toBe('true')
  expect(field<HTMLTextAreaElement>('textarea[name="reason"]').value).toBe(reason)
})

it('una resuelta muestra la decisión, el ajuste y su historial', async () => {
  await render('/incidencias?estado=resueltas&incidencia=r1')
  await waitFor(() => !!sheet()?.textContent?.includes('Historial') && sheet()!.textContent!.includes('26 oct – 1 nov'))
  const panel = sheet()
  expect(panel.textContent).toContain('Jorge Ramírez · jueves 29 de octubre')
  expect(panel.textContent).toContain('Resolvió' + 'Rocío Navarro, mar 3 nov, 18:40')
  expect(panel.textContent).toContain('Ajuste' + 'Se agregó la salida de las 17:00')
  expect(panel.textContent).toContain('Semana' + '26 oct – 1 nov, recalculada')
  expect([...panel.querySelectorAll('ol li')].map(li => li.textContent)).toEqual([
    'Abiertavie 30 oct, 00:05 · sistema', 'Asignada a Rocío Navarrovie 30 oct, 09:12 · Hugo Peña',
    'Resuelta como ajustadamar 3 nov, 18:40 · Rocío Navarro', 'Semana recalculadamar 3 nov, 18:40 · sistema',
  ])
  expect(panel.querySelector('a[href="/asistencia?semana=2026-10-29&persona=e6"]')?.textContent).toBe('Ver su semana')
  expect(cells()[0]).toEqual(['Falta la marca que cierra', 'Jorge Ramírez 0192', 'jue 29 oct', 'Ajustada', 'Rocío Navarro', 'mar 3 nov', 'Ver Falta la marca que cierra de Jorge Ramírez'])
})

it('Auditoría consulta sin asignar ni resolver', async () => {
  await render('/incidencias?incidencia=inc1', ['auditor'])
  await waitFor(() => !!sheet()?.textContent?.includes('Marcas del día'))
  expect(document.querySelector('form[aria-label="Resolver la incidencia"]')).toBeNull()
  expect(sheet().querySelector('select')).toBeNull()
  expect(sheet().textContent).toContain('Auditoría consulta; resolver lo hacen Administración, RH y Supervisión.')
  expect(server.calls.some(call => call.path.includes('/assignees'))).toBe(false)
  expect([...container.querySelectorAll('button[aria-pressed]')].map(button => button.textContent)).toEqual(['Severidad alta · 1', 'Bloquean un cierre · 1'])
  expect(cells()[0].at(-1)).toBe('Ver Hora del teléfono alterada de Teresa Lugo')
})

it('sin abiertas dice que todo está en orden', async () => {
  state = { empty: true, summary: { ...summary, open: { total: 0, unassigned: 0, mine: 0, high: 0, medium: 0, low: 0, blockingClosure: 0 } } }
  await render()
  await waitFor(() => text().includes('Todo en orden'))
  expect(linkTo('Ver resueltas').getAttribute('href')).toContain('estado=resueltas')
  expect(container.querySelector('aside a[href="/incidencias"]')?.textContent).toBe('Incidencias')
})

it('en teléfono son tarjetas y el detalle ocupa la pantalla con sus botones abajo', async () => {
  phone = true
  await render()
  expect([...container.querySelectorAll('main li a')].map(link => link.textContent)).toEqual([
    'Hora del teléfono alteradaTeresa Lugo · vie 30 octAlta', 'Falta la marca que cierraLuis Hernández · ayer 09:04Media',
    'Marcó en otra sedeCarmen Vega · hoy 08:51Media', 'Marca duplicadaIván Cruz · bloquea el cierreBaja',
  ])
  expect(container.querySelector('nav[aria-label="Secciones"] a[href="/incidencias"]')?.textContent).toContain('4 abiertas')
  await act(async () => [...container.querySelectorAll<HTMLAnchorElement>('main li a')][1].click())
  await waitFor(() => [...document.querySelectorAll('section button')].some(button => button.textContent === 'Guardar resolución'))
  expect(document.querySelector('button[aria-label="Volver a la lista"]')).not.toBeNull()
  expect(await accessibilityViolations(container)).toEqual([])
})
