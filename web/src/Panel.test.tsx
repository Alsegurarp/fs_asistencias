// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

const server = vi.hoisted(() => ({ calls: [] as string[], pending: 0, handler: (path: string): Promise<unknown> => new Promise(() => path) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() }, identityBase: 'http://localhost:8082' }))
vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  api: vi.fn((path: string) => {
    server.calls.push(path); server.pending++
    const done = () => { server.pending-- }
    const answer = server.handler(path)
    answer.then(done, done)
    return answer
  }),
}))
import { ApiError, type Me } from './api'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { loaded, waitFor } from './testUi'

const sites = [{ id: 's1', name: 'Matriz Centro', radiusMeters: 120 }, { id: 's2', name: 'Bodega Norte', radiusMeters: 80 }]
const summary = {
  date: '2026-11-06', weekStart: '2026-11-02', timeZone: 'America/Mexico_City', siteId: null, people: 42,
  day: { marked: 38, attendanceEvents: 81, onShift: 34, noEntry: 4, foreignSite: 1 },
  week: { ordinaryMinutes: 71160, overtimeMinutes: 405, withOvertime: 3, withAttention: 4, missingExit: 3 },
  incidents: { open: 6, highSeverity: 1, unassigned: 4 },
  previousWeek: { weekStart: '2026-10-26', people: 42, closed: 39, agreed: 31, objected: 1 },
  devices: { active: 6, silent: 1 },
  mostHours: [
    { employeeId: 'e1', displayName: 'Ana Torres', siteId: 's2', ordinaryMinutes: 1920, overtimeMinutes: 190 },
    { employeeId: 'e3', displayName: 'Kevin Solís', siteId: 's1', ordinaryMinutes: 1920, overtimeMinutes: 0 },
  ],
}
const closures = { weekStart: '2026-10-26', closed: 39, reopened: 0, blocked: 3, acknowledgements: { agreed: 31, objected: 1, none: 7 } }
const incidents = [
  { id: 'i1', type: 'missing_pair', severity: 'high', status: 'open', employeeId: 'e2', employeeName: 'Luis Hernández', siteId: 's1', eventIds: [], openedAt: '2026-11-06T06:05:00Z', occurredAt: '2026-11-05T23:10:00Z', assigneeUserId: null, resolution: null },
  { id: 'i2', type: 'foreign_site', severity: 'medium', status: 'open', employeeId: 'e4', employeeName: 'Carmen Vega', siteId: 's2', eventIds: [], openedAt: '2026-11-06T14:51:00Z', occurredAt: '2026-11-06T14:51:00Z', assigneeUserId: null, resolution: null },
]
const rule = { id: 'r', version: 2, validFrom: '2026-01-01', validTo: '2026-12-31', weeklyOrdinaryMaxMinutes: 2880, parameters: {} }
const audit = [
  { id: 'a1', at: '2026-11-06T16:41:00Z', action: 'card.assigned', actor: { type: 'user', id: 'u1', displayName: 'Rocío Navarro' }, target: { type: 'card', id: 'c', displayName: 'T-0042' }, metadata: {} },
  { id: 'a2', at: '2026-11-06T06:05:00Z', action: 'incident.opened', actor: { type: 'system', id: null, displayName: null }, target: { type: 'incident', id: 'i1', displayName: 'Luis Hernández' }, metadata: {} },
]

function defaultServer(path: string): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (body: unknown) => Promise.resolve(body)
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/sites': return answer({ items: sites, nextCursor: null })
    case '/schedules': return answer({ items: [], nextCursor: null })
    case '/rule-sets': return answer({ items: [rule] })
    case '/attendance/summary': return answer(summary)
    case '/week-closures/summary': return answer(closures)
    case '/incidents': return answer({ items: incidents, nextCursor: null })
    case '/incidents/summary': return answer({ weekStart: '2026-11-02', open: { total: 6, unassigned: 4, mine: 0, high: 1, medium: 5, low: 0, blockingClosure: 3 }, resolved: { total: 0, thisWeek: 0 } })
    case '/audit-log': return answer({ items: audit, nextCursor: null })
    case '/employees/summary': return answer({ total: 0, active: 0, inactive: 0, withoutCard: 0, withoutSchedule: 0, bySchedule: [] })
    case '/cards/summary': return answer({ total: 0, byStatus: { inventory: 0, assigned: 0, active: 0, lost: 0, damaged: 0, revoked: 0, replaced: 0 } })
    case '/users/summary': return answer({ total: 1 })
  }
  return Promise.reject(new ApiError(404, 'not_found', `Sin respuesta simulada para ${path}`))
}

let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
let phone = false

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T16:45:00Z') })
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  server.calls = []; server.pending = 0; server.handler = defaultServer; phone = false
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

async function render(roles = ['admin_empresa'], tenant: Partial<NonNullable<Me['tenant']>> = {}) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City', ...tenant } }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={['/']}><Portal me={me} onSignOut={vi.fn()} /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await loaded()
  // Hay consultas que dependen de otras (los cierres de la semana anterior, las
  // reglas): se espera a que el servidor simulado no tenga respuestas pendientes.
  for (let quiet = 0, round = 0; quiet < 3; round++) {
    if (round > 300) throw new Error(`Quedaron ${server.pending} respuestas pendientes`)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    quiet = server.pending === 0 ? quiet + 1 : 0
  }
  await waitFor(() => !container.querySelector('main [aria-hidden="true"] .MuiSkeleton-root'))
}
const text = () => container.textContent || ''
const section = (title: string) => [...container.querySelectorAll('main section')].find(item => item.querySelector('h2')?.textContent?.startsWith(title)) as HTMLElement | undefined
const hrefs = (element: Element | undefined) => [...(element?.querySelectorAll('a') || [])].map(link => link.getAttribute('href'))

it('el inicio de Administración es el Panel con lo de hoy, la semana anterior y las cifras de la semana', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Hola, Mariana · viernes 6 de noviembre, hora de Ciudad de México')
  expect(container.querySelector('aside a[href="/panel"]')?.getAttribute('aria-current')).toBe('page')
  expect(server.calls).toContain('/attendance/summary?date=2026-11-06')
  expect(server.calls).toContain('/week-closures/summary?week=2026-10-26')
  expect(section('Asistencia de hoy')!.textContent).toBe('Asistencia de hoy38 / 42personas con entrada registrada81marcajes3sin salida1fuera de su sede')
  const previous = section('Semana anterior')!
  expect(previous.textContent).toContain('26 oct – 1 nov')
  expect(previous.textContent).toContain('39 de 42 cerradas')
  expect(previous.textContent).toContain('3Bloqueadas31Conformes1Objeción7Sin acuse')
  expect(hrefs(previous)).toEqual(['/cierres?semana=2026-10-26&pestana=bloqueadas', '/cierres?semana=2026-10-26&acuse=objecion', '/cierres?semana=2026-10-26'])
  expect(previous.querySelector('a[href="/cierres?semana=2026-10-26"]')?.textContent).toBe('Terminar el cierre')
  const stats = container.querySelector('section[aria-label="La semana en cifras"]')!
  expect([...stats.querySelectorAll('a')].map(link => [link.textContent, link.getAttribute('href')])).toEqual([
    ['6Incidencias abiertas', '/incidencias'], ['1,186 hOrdinarias en la semana', '/asistencia'], ['3Con tiempo extra', '/asistencia?filtro=extra'], ['5 / 6Lectores con señal', '/dispositivos'],
  ])
})

it('lo que pide atención junta las incidencias más graves con lo pendiente, y cada fila lleva a donde se atiende', async () => {
  await render()
  expect(server.calls).toContain('/incidents?status=open&sort=severity&limit=5')
  const attention = section('Requiere atención')!
  const rows = [...attention.querySelectorAll('li')].map(row => row.textContent)
  expect(rows).toEqual([
    'Falta la marca que cierraLuis Hernández · Matriz Centro · ayer 17:10Alta',
    'Marcó en otra sedeCarmen Vega · Bodega Norte · hoy 08:51Media',
    'Objeción a un cierreUna persona no está conforme con la semana 26 oct – 1 novRevisar',
    'Semanas sin cerrar3 personas bloqueadas en 26 oct – 1 nov, por incidencias o tramos abiertosRevisar',
    'Lector sin señalUn lector lleva más de 24 horas sin dar señalRevisar',
  ])
  expect(hrefs(attention)).toEqual(['/incidencias', '/incidencias?incidencia=i1', '/incidencias?incidencia=i2', '/cierres?semana=2026-10-26&acuse=objecion', '/cierres?semana=2026-10-26&pestana=bloqueadas', '/dispositivos'])
  server.handler = path => path.startsWith('/incidents?') ? Promise.resolve({ items: [], nextCursor: null })
    : path.startsWith('/attendance/summary') ? Promise.resolve({ ...summary, previousWeek: { ...summary.previousWeek, objected: 0 }, devices: { active: 6, silent: 0 } })
      : path.startsWith('/week-closures/summary') ? Promise.resolve({ ...closures, blocked: 0 }) : defaultServer(path)
  cache.clear()
  await render()
  expect(section('Requiere atención')!.textContent).toContain('Todo en orden: no hay incidencias abiertas ni cierres pendientes.')
})

it('las horas de la semana muestran a quienes más llevan contra el tope, y la actividad reciente dice quién hizo qué', async () => {
  await render()
  // El tope llega con las reglas, en otra consulta: puede llegar después del resumen.
  await waitFor(() => section('Horas de la semana')?.querySelector('h2')?.textContent === 'Horas de la semana · tope 48 h (2026)')
  const hoursCard = section('Horas de la semana')!
  expect([...hoursCard.querySelectorAll('li')].map(row => row.textContent)).toEqual(['Ana Torres32:00 + 3:10', 'Kevin Solís32:00'])
  expect(hrefs(hoursCard)).toEqual(['/asistencia?persona=e1', '/asistencia?persona=e3', '/asistencia'])
  expect(hoursCard.textContent).toContain('Ver la semana de las 42 personas')
  const activity = section('Actividad reciente')!
  expect([...activity.querySelectorAll('li')].map(row => row.textContent)).toEqual(['10:41Rocío Navarro asignó la tarjeta T-0042', '00:05Se abrió una incidencia de Luis Hernández'])
})

it('Supervisión no ve lectores ni la bitácora y no cierra; Auditoría consulta sin cerrar', async () => {
  // El servidor no le cuenta dispositivos a Supervisión.
  server.handler = path => path.startsWith('/attendance/summary') ? Promise.resolve({ ...summary, devices: null }) : defaultServer(path)
  await render(['supervisor'])
  expect(text()).not.toContain('Lectores con señal')
  expect(section('Actividad reciente')).toBeUndefined()
  expect(server.calls.some(path => path.startsWith('/audit-log'))).toBe(false)
  expect(section('Semana anterior')!.textContent).toContain('Ver los cierres')
  expect(text()).not.toContain('Terminar el cierre')
  server.handler = defaultServer; cache.clear()
  await render(['auditor'])
  expect(section('Actividad reciente')).toBeDefined()
  expect(text()).not.toContain('Terminar el cierre')
  await render(['rh'])
  expect(text()).toContain('Terminar el cierre')
  expect(section('Actividad reciente')).toBeUndefined()
})

it('una empresa sin personal ve sus primeros pasos en orden', async () => {
  server.handler = path => path.startsWith('/attendance/summary') ? Promise.resolve({ ...summary, people: 0, mostHours: [], devices: { active: 0, silent: 0 } }) : defaultServer(path)
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Hola, Mariana · deja lista tu empresa en el orden en que Zenit lo necesita')
  const steps = section('Primeros pasos')!
  expect(steps.querySelector('h2')?.textContent).toBe('Primeros pasos · 2 de 7 listos')
  expect([...steps.querySelectorAll('li strong')].map(item => item.textContent)).toEqual([
    'Revisa los datos de tu empresa', 'Agrega tus sedes y su zona de marcaje', 'Crea los horarios, pendiente', 'Da de alta a tu personal, pendiente',
    'Registra y asigna las tarjetas, pendiente', 'Activa un lector en cada sede, pendiente', 'Invita a tu equipo, pendiente',
  ])
  expect(steps.textContent).toContain('2 sedes: Matriz Centro, Bodega Norte')
  expect(hrefs(steps)).toEqual(['/configuracion', '/configuracion/sedes', '/personal/horarios', '/personal/importaciones', '/dispositivos/tarjetas', '/dispositivos', '/usuarios'])
  expect(text()).toContain('Así funciona Zenit')
  // Quien no administra no ve los primeros pasos: su panel dice lo que hay.
  await render(['rh'])
  expect(section('Primeros pasos')).toBeUndefined()
  expect(section('Asistencia de hoy')).toBeDefined()
})

it('el cambio de comida va en el banner del Panel y no se repite arriba', async () => {
  await render(['admin_empresa'], { upcomingBreakPolicy: { breakPolicy: 'marked', effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z' } })
  expect(text().match(/Aviso sobre la comida/g)).toHaveLength(1)
  expect(container.querySelector('main [role="status"] a[href="/configuracion"]')?.textContent).toBe('Ver el cambio')
  // Quien no abre Configuración ve el aviso sin el enlace.
  await render(['trabajador', 'supervisor'], { upcomingBreakPolicy: { breakPolicy: 'marked', effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z' } })
  expect(text().match(/Aviso sobre la comida/g)).toHaveLength(1)
})

it('si el panel no carga lo dice con la referencia y deja reintentar', async () => {
  server.handler = path => path.startsWith('/attendance/summary') ? Promise.reject(new ApiError(503, 'unavailable', 'El servicio no responde.', 'corr-1')) : defaultServer(path)
  await render()
  expect(text()).toContain('No pudimos cargar el panel. El servicio no responde. Referencia: corr-1.')
  expect([...container.querySelectorAll('button')].some(item => item.textContent === 'Reintentar')).toBe(true)
})

it('el panel y la campana abierta no tienen fallas automáticas de accesibilidad', async () => {
  await render()
  expect(await accessibilityViolations(container)).toEqual([])
  const bell = container.querySelector<HTMLButtonElement>('button[aria-label^="Avisos"]')!
  expect(bell.getAttribute('aria-label')).toBe('Avisos, 4 sin ver')
  await act(async () => bell.click())
  await waitFor(() => !!document.querySelector('[role="dialog"]'))
  expect(await accessibilityViolations(document.querySelector<HTMLElement>('[role="dialog"]')!)).toEqual([])
}, 15_000) // Dos revisiones de axe: en un equipo cargado pasan de los 5 s por omisión.

it('en teléfono las tarjetas van una debajo de otra y la barra inferior empieza por el Panel', async () => {
  phone = true
  await render()
  expect([...container.querySelectorAll('nav[aria-label="Secciones"] a')].map(link => link.getAttribute('href'))).toEqual(['/panel', '/asistencia', '/incidencias', '/mas'])
  expect(section('Asistencia de hoy')).toBeDefined()
})
