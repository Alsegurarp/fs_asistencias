// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accessibilityViolations } from './accessibility'
import { loaded } from './testUi'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError, type Me } from './api'
import { Closures } from './Closures'
import { type BlockedClosure, type Closure, type ClosureRun } from './closureModel'
import { button, choose, click, setInput, waitFor } from './testUi'

const closureId = '11111111-1111-4111-8111-111111111111'
const employeeId = '22222222-2222-4222-8222-222222222222'
const otherEmployee = '33333333-3333-4333-8333-333333333333'
const userId = '44444444-4444-4444-8444-444444444444'
const incidentId = '55555555-5555-4555-8555-555555555555'
const runId = '66666666-6666-4666-8666-666666666666'
const siteId = '77777777-7777-4777-8777-777777777777'
const initialClosure: Closure = { id: closureId, employeeId, weekStart: '2026-10-05', version: 1, status: 'closed', ruleSet: { id: 'rules', version: 1 }, totals: { workedMinutes: 480, breakMinutes: 30, ordinaryMinutes: 480, overtimeMinutes: 0 }, hash: 'a'.repeat(64), closedAt: '2026-10-12T14:00:00Z', closedBy: userId, acknowledgement: null }
const initialRun: ClosureRun = { id: runId, weekStart: '2026-10-05', siteId: null, origin: 'requested', status: 'done', total: 2, closed: 1, blocked: { openIncidents: 1, openSegment: 0 }, requestedBy: userId, failure: null, createdAt: '2026-10-12T14:00:00Z', startedAt: '2026-10-12T14:00:00Z', finishedAt: '2026-10-12T14:00:01Z' }
let closures: Closure[]
let run: ClosureRun
let failure: ApiError | null
let runFailure: ApiError | null
let blockedPeople: BlockedClosure[]
let blockedFailure: ApiError | null
let paginateBlocked: boolean
let pollSequence: boolean
let detailCalls: number
let releasePost: (() => void) | undefined
let holdPost: boolean
let root: Root
let cache: QueryClient
let container: HTMLDivElement
const onIncidents = vi.fn()
const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 30, x: 0, y: 0, top: 0, bottom: 30, left: 0, right: 100, toJSON: () => ({}) })
  closures = [structuredClone(initialClosure)]
  run = structuredClone(initialRun)
  blockedPeople = [{ employeeId: otherEmployee, reason: 'open_incidents', incidentIds: [incidentId] }]
  blockedFailure = null; paginateBlocked = false
  failure = null; runFailure = null; pollSequence = false; detailCalls = 0; releasePost = undefined; holdPost = false
  onIncidents.mockClear()
  mockedApi.mockReset()
  mockedApi.mockImplementation(async (path, method = 'GET', body) => {
    const url = new URL(path, 'http://test')
    if (method === 'POST') {
      if (holdPost) await new Promise<void>(resolve => { releasePost = resolve })
      if (failure) {
        if (failure.code === 'closure_not_closed') closures[0].status = 'reopened'
        throw failure
      }
      if (url.pathname.endsWith('/reopen')) { closures[0].status = 'reopened'; return structuredClone(closures[0]) }
      if (url.pathname === '/week-closures') {
        const selected = (body as { employeeIds: string[] }).employeeIds
        return { weekStart: '2026-10-05', closed: selected.includes(employeeId) ? [structuredClone(closures[0])] : [], blocked: selected.includes(otherEmployee) ? [{ employeeId: otherEmployee, reason: 'open_incidents', incidentIds: [incidentId] }] : [] }
      }
      if (url.pathname === '/week-closure-runs') { run = { ...run, id: runId, status: 'queued', siteId: (body as { siteId?: string }).siteId || null, failure: null, total: null, closed: 0, blocked: { openIncidents: 0, openSegment: 0 } }; return structuredClone(run) }
    }
    if (url.pathname === '/week-closures') return url.searchParams.has('cursor')
      ? { items: [{ ...structuredClone(closures[0]), id: otherEmployee, employeeId: otherEmployee, status: 'reopened' }], nextCursor: null }
      : { items: structuredClone(closures), nextCursor: 'next-closure' }
    if (url.pathname === `/week-closures/${closureId}`) return structuredClone(closures[0])
    if (url.pathname === '/week-closure-runs') return { items: [structuredClone(run)], nextCursor: null }
    if (url.pathname === `/week-closure-runs/${runId}/blocked`) {
      if (blockedFailure) throw blockedFailure
      return { items: structuredClone(paginateBlocked ? blockedPeople.slice(url.searchParams.has('cursor') ? 1 : 0, url.searchParams.has('cursor') ? 2 : 1) : blockedPeople), nextCursor: paginateBlocked && !url.searchParams.has('cursor') ? 'next-blocked' : null }
    }
    if (url.pathname === `/week-closure-runs/${runId}`) {
      detailCalls++
      if (runFailure) throw runFailure
      if (pollSequence) run = { ...run, status: detailCalls === 1 ? 'queued' : detailCalls === 2 ? 'running' : 'done', total: detailCalls === 1 ? null : 2, closed: detailCalls === 1 ? 0 : 1 }
      return structuredClone(run)
    }
    if (url.pathname === '/employees') return { items: [{ id: employeeId, displayName: 'Empleado listo', externalId: 'E-001', status: 'active' }, { id: otherEmployee, displayName: 'Empleado bloqueado', externalId: 'E-002', status: 'active' }], nextCursor: null }
    if (url.pathname.startsWith('/employees/')) return { id: employeeId, displayName: url.pathname.includes(otherEmployee) ? 'Empleado bloqueado' : 'Empleado listo' }
    if (url.pathname === '/sites') return { items: [{ id: siteId, name: 'Sede prueba', status: 'active' }], nextCursor: null }
    if (url.pathname.startsWith('/sites/')) return { id: siteId, name: 'Sede prueba' }
    throw new Error(`Petición inesperada: ${path}`)
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
})
afterEach(async () => {
  releasePost?.()
  await act(async () => root.unmount())
  cache.clear(); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})
async function mount(role = 'rh') {
  const me: Me = { userId, displayName: 'Mi nombre', roles: [role], tenant: { name: 'Empresa', timeZone: 'America/Mexico_City' } }
  await act(async () => root.render(<QueryClientProvider client={cache}><Closures me={me} onIncidents={onIncidents} /></QueryClientProvider>))
  await waitFor(() => !!button('Ver cierre') && !!button('Ver avance'))
}
async function selectEmployee(label: string) {
  const node = [...document.querySelectorAll('label')].find(item => item.textContent?.includes(label))!
  await act(async () => node.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
}
function posts() { return mockedApi.mock.calls.filter(([, method]) => method === 'POST') }

it.each(['auditor', 'supervisor'])('%s consulta sin botones de cierre o reapertura', async role => {
  await mount(role)
  expect(button('Cerrar empleados')).toBeUndefined()
  expect(button('Cerrar empresa o sede')).toBeUndefined()
  await click('Ver cierre')
  await waitFor(() => document.body.textContent?.includes('Totales congelados') === true)
  expect(button('Confirmar reapertura')).toBeUndefined()
})
it('pagina cierres y reinicia el cursor al cambiar empleado', async () => {
  await mount()
  await click('Cargar más cierres')
  await waitFor(() => mockedApi.mock.calls.some(([path]) => path.includes('cursor=next-closure')))
  await choose('employeeFilter', 'Empleado bloqueado')
  await waitFor(() => mockedApi.mock.calls.some(([path]) => path.includes(`employeeId=${otherEmployee}`)))
  expect(mockedApi.mock.calls.some(([path]) => path.includes(`employeeId=${otherEmployee}`) && path.includes('cursor='))).toBe(false)
})
it('cierra sólo la selección y permite ir a la incidencia de un bloqueado', async () => {
  await mount()
  await click('Cerrar empleados')
  await waitFor(() => document.body.textContent?.includes('E-001') === true)
  await setInput('requestWeek', '2026-10-05')
  await selectEmployee('E-001'); await selectEmployee('E-002')
  await click('Confirmar cierre')
  await waitFor(() => !!button('Revisar incidencia 1'))
  expect(posts()[0][2]).toEqual({ weekStart: '2026-10-05', employeeIds: [employeeId, otherEmployee] })
  expect(document.body.textContent).toContain('1 cierres vigentes y 1 bloqueados')
  await click('Revisar incidencia 1')
  expect(onIncidents).toHaveBeenCalledWith({ week: '2026-10-05', incidentId })
})
it('no permite una selección vacía ni cambia los empleados al repetir el cierre', async () => {
  await mount(); await click('Cerrar empleados')
  expect(button('Confirmar cierre')!.disabled).toBe(true)
  await waitFor(() => document.body.textContent?.includes('E-001') === true)
  await selectEmployee('E-001'); await setInput('requestWeek', '2026-10-05')
  await click('Confirmar cierre'); await waitFor(() => posts().length === 1 && button('Confirmar cierre')?.disabled === false)
  await click('Confirmar cierre'); await waitFor(() => posts().length === 2)
  expect(posts()[0][2]).toEqual(posts()[1][2])
})
it('conserva los campos si el backend rechaza una semana no terminada', async () => {
  failure = new ApiError(422, 'validation', 'Datos no válidos', 'ref-semana', [{ field: 'weekStart', message: 'La semana todavía no termina.' }])
  await mount(); await click('Cerrar empleados')
  await waitFor(() => document.body.textContent?.includes('E-001') === true)
  await selectEmployee('E-001'); await setInput('requestWeek', '2026-10-12'); await click('Confirmar cierre')
  await waitFor(() => document.body.textContent?.includes('ref-semana') === true)
  expect((document.querySelector('[name="requestWeek"]') as HTMLInputElement).value).toBe('2026-10-12')
  expect(document.body.textContent).toContain('La semana todavía no termina.')
})
it('deshabilita cambios y cierre del diálogo mientras la petición está pendiente', async () => {
  holdPost = true
  await mount(); await click('Cerrar empleados'); await waitFor(() => document.body.textContent?.includes('E-001') === true)
  await selectEmployee('E-001'); await click('Confirmar cierre')
  await waitFor(() => !!releasePost)
  expect(button('Cerrar')!.disabled).toBe(true)
  expect(document.querySelector('[name="requestWeek"]')!.hasAttribute('disabled')).toBe(true)
  expect(posts()).toHaveLength(1)
  await act(async () => releasePost!())
  await waitFor(() => document.body.textContent?.includes('cierres vigentes') === true)
})
it('el administrador reabre con motivo y conserva el cálculo de la versión', async () => {
  await mount('admin_empresa'); await click('Ver cierre'); await waitFor(() => !!button('Confirmar reapertura'))
  await setInput('reason', 'Corregir un marcaje faltante.')
  await click('Confirmar reapertura')
  await waitFor(() => document.body.textContent?.includes('Semana reabierta.') === true)
  expect(posts()[0]).toEqual([`/week-closures/${closureId}/reopen`, 'POST', { reason: 'Corregir un marcaje faltante.' }])
  expect(document.body.textContent).toContain('trabajo 480 min')
  expect(button('Confirmar reapertura')).toBeUndefined()
})
it('recarga un cierre que otra persona ya reabrió', async () => {
  failure = new ApiError(409, 'closure_not_closed', 'Ese cierre ya está reabierto.')
  await mount('admin_empresa'); await click('Ver cierre'); await waitFor(() => !!button('Confirmar reapertura'))
  await setInput('reason', 'Corregir un marcaje faltante.'); await click('Confirmar reapertura')
  await waitFor(() => button('Confirmar reapertura') === undefined)
  expect(document.body.textContent).toContain('Ese cierre ya está reabierto.')
})
it('identifica cierres programados y el acuse objetado', async () => {
  closures[0].closedBy = null
  closures[0].acknowledgement = { type: 'objected', note: 'Falta una hora.', at: '2026-10-12T15:00:00Z' }
  await mount('auditor'); await click('Ver cierre')
  await waitFor(() => document.body.textContent?.includes('Acuse: Objetado') === true)
  expect(document.body.textContent).toContain('Cierre programado')
  expect(document.body.textContent).toContain('Falta una hora.')
})
it('solicita una corrida por sede y pasa a su seguimiento', async () => {
  await mount(); await click('Cerrar empresa o sede')
  await choose('closureSite', 'Sede prueba'); await setInput('requestWeek', '2026-10-05'); await click('Confirmar corrida')
  await waitFor(() => document.body.textContent?.includes('Avance de corrida') === true)
  expect(posts()[0][2]).toEqual({ weekStart: '2026-10-05', siteId })
})
it('consulta la corrida cada cinco segundos y se detiene al terminar', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  pollSequence = true; run.status = 'queued'
  await mount(); await click('Ver avance'); await waitFor(() => detailCalls === 1)
  await act(async () => { vi.advanceTimersByTime(5000) }); await waitFor(() => detailCalls === 2)
  await act(async () => { vi.advanceTimersByTime(5000) }); await waitFor(() => detailCalls === 3 && document.body.textContent?.includes('Terminada') === true)
  await act(async () => { vi.advanceTimersByTime(20000) })
  expect(detailCalls).toBe(3)
})
it('pausa el seguimiento cuando recibe 429 y permite reintentarlo', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  runFailure = new ApiError(429, 'rate_limited', 'Demasiadas peticiones', 'ref-cuota')
  run.status = 'running'
  await mount(); await click('Ver avance'); await waitFor(() => document.body.textContent?.includes('seguimiento está pausado') === true)
  await act(async () => { vi.advanceTimersByTime(20000) }); expect(detailCalls).toBe(1)
  runFailure = null
  await click('Reintentar avance'); await waitFor(() => detailCalls === 2)
})
it('muestra personas y causas y enlaza la incidencia individual y el alcance', async () => {
  run.siteId = siteId
  await mount('auditor'); await click('Ver avance'); await waitFor(() => !!button('Revisar incidencias abiertas'))
  await waitFor(() => document.querySelector('[aria-label="Personas bloqueadas"]')?.textContent?.includes('Empleado bloqueado') === true)
  expect(document.querySelector('[aria-label="Personas bloqueadas"]')!.textContent).toContain('Empleado bloqueado')
  expect(document.querySelector('[aria-label="Personas bloqueadas"]')!.textContent).toContain('Incidencias abiertas')
  await click(`Ver incidencia ${incidentId}`)
  expect(onIncidents).toHaveBeenCalledWith({ week: '2026-10-05', incidentId })
  await click('Revisar incidencias abiertas')
  expect(onIncidents).toHaveBeenCalledWith({ week: '2026-10-05', siteId })
})
it('pagina bloqueados de una corrida parcial y explica los tramos iniciados por ajustes', async () => {
  paginateBlocked = true; run.status = 'failed'; run.failure = 'job_abandoned'
  blockedPeople.push({ employeeId, reason: 'open_segment', incidentIds: [] })
  await mount(); await click('Ver avance'); await waitFor(() => !!button('Cargar más bloqueados'))
  expect(document.querySelector('[aria-label="Personas bloqueadas"]')!.querySelectorAll('tbody tr')).toHaveLength(1)
  await click('Cargar más bloqueados')
  await waitFor(() => document.querySelector('[aria-label="Personas bloqueadas"]')!.querySelectorAll('tbody tr').length === 2)
  expect(document.body.textContent).toContain('Tramo sin salida')
  expect(document.body.textContent).toContain('El tramo abierto proviene de un ajuste')
})
it('conserva los conteos antiguos cuando no hay detalle nominal registrado', async () => {
  blockedPeople = []
  await mount(); await click('Ver avance')
  await waitFor(() => document.body.textContent?.includes('Las corridas anteriores a esta función sólo conservan conteos.') === true)
  expect(document.body.textContent).toContain('Incidencias abiertas: 1')
})
it('permite recuperar el detalle de bloqueados tras un error sin perder los conteos', async () => {
  blockedFailure = new ApiError(429, 'rate_limited', 'Demasiadas peticiones', 'ref-bloqueados')
  await mount(); await click('Ver avance'); await waitFor(() => !!button('Reintentar bloqueados'))
  expect(document.body.textContent).toContain('ref-bloqueados')
  expect(document.body.textContent).toContain('Incidencias abiertas: 1')
  blockedFailure = null
  await click('Reintentar bloqueados'); await waitFor(() => !!button(`Ver incidencia ${incidentId}`))
})
it('una corrida fallida conserva los cierres y se solicita de nuevo con el mismo alcance', async () => {
  run = { ...run, status: 'failed', failure: 'job_abandoned', siteId }
  await mount(); await click('Ver avance'); await waitFor(() => !!button('Solicitar otra corrida con el mismo alcance'))
  expect(document.body.textContent).toContain('Lo ya cerrado se conserva.')
  await click('Solicitar otra corrida con el mismo alcance'); await waitFor(() => posts().length === 1)
  expect(posts()[0][2]).toEqual({ weekStart: '2026-10-05', siteId })
})

it('cumple las reglas automáticas de accesibilidad', async () => {
  await mount(); await loaded()
  expect(await accessibilityViolations()).toEqual([])
})
