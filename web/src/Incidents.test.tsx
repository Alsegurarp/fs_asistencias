// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError, type Me } from './api'
import { Incidents } from './Incidents'
import { type Incident, type Week } from './incidentModel'
import { button, choose, click, setInput, waitFor } from './testUi'

const id = '11111111-1111-4111-8111-111111111111'
const employeeId = '22222222-2222-4222-8222-222222222222'
const eventId = '33333333-3333-4333-8333-333333333333'
const userId = '44444444-4444-4444-8444-444444444444'
const otherUser = '55555555-5555-4555-8555-555555555555'
const initial: Incident = { id, type: 'missing_pair', severity: 'medium', status: 'open', employeeId, siteId: null, eventIds: [eventId], openedAt: '2026-10-12T14:00:00Z', assigneeUserId: null, resolution: null }
const initialWeek: Week = { weekStart: '2026-10-12', timeZone: 'America/Mexico_City', segments: [{ id: 'segment', kind: 'work', startAt: '2026-10-12T14:00:00Z', endAt: null, minutes: 0 }], totals: { workedMinutes: 480, breakMinutes: 0, ordinaryMinutes: 480, overtimeMinutes: 0 }, alerts: [], openIncidentIds: [id], closure: null }
let serverIncident: Incident
let failure: ApiError | null
let root: Root
let cache: QueryClient
let container: HTMLDivElement
const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 30, x: 0, y: 0, top: 0, bottom: 30, left: 0, right: 100, toJSON: () => ({}) })
  serverIncident = structuredClone(initial)
  failure = null
  mockedApi.mockReset()
  mockedApi.mockImplementation(async (path, method = 'GET', body) => {
    const url = new URL(path, 'http://test')
    if (method === 'PATCH') {
      if (failure) {
        if (failure.code === 'incident_already_resolved') serverIncident = { ...serverIncident, status: 'resolved', resolution: { decision: 'confirmed', reason: 'Resuelta por otra persona', adjustment: null, resolvedBy: otherUser, resolvedAt: '2026-10-12T16:00:00Z' } }
        throw failure
      }
      const update = body as { assigneeUserId?: string | null; resolution?: Incident['resolution'] }
      if ('assigneeUserId' in update) serverIncident.assigneeUserId = update.assigneeUserId!
      if (update.resolution) serverIncident = { ...serverIncident, status: 'resolved', resolution: { ...update.resolution, adjustment: update.resolution.adjustment || null, resolvedBy: userId, resolvedAt: '2026-10-12T16:00:00Z' } }
      return structuredClone(serverIncident)
    }
    if (url.pathname === '/incidents') {
      if (url.searchParams.get('cursor')) return { items: [{ ...serverIncident, id: otherUser, type: 'clock_anomaly' }], nextCursor: null }
      return { items: !url.searchParams.get('status') || url.searchParams.get('status') === serverIncident.status ? [structuredClone(serverIncident)] : [], nextCursor: 'next-page' }
    }
    if (url.pathname === `/incidents/${id}`) return structuredClone(serverIncident)
    if (url.pathname === `/employees/${employeeId}`) return { id: employeeId, displayName: 'Empleado de prueba' }
    if (url.pathname.endsWith('/attendance')) return { ...initialWeek, totals: { ...initialWeek.totals, workedMinutes: serverIncident.status === 'resolved' ? 960 : 480 } }
    if (url.pathname === '/attendance-events') return { items: [{ id: eventId, type: 'clock_in', observedAt: '2026-10-12T14:00:00Z', locationVerdict: 'inside', accuracyMeters: 8 }], nextCursor: null }
    if (url.pathname === '/sites') return { items: [], nextCursor: null }
    if (url.pathname === '/users') return { items: [{ id: otherUser, displayName: 'Responsable de prueba', email: 'rh@example.invalid', status: 'active' }, { id: 'disabled', displayName: 'Usuario deshabilitado', status: 'disabled' }], nextCursor: null }
    if (url.pathname.startsWith('/users/')) return { id: otherUser, displayName: 'Responsable de prueba', status: 'active' }
    throw new Error(`Petición inesperada: ${path}`)
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
})

afterEach(async () => {
  await act(async () => root.unmount())
  cache.clear()
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function mount(role = 'rh') {
  const me: Me = { userId, displayName: 'Mi nombre', roles: [role], tenant: { name: 'Empresa', timeZone: 'America/Mexico_City' } }
  await act(async () => root.render(<QueryClientProvider client={cache}><Incidents me={me} /></QueryClientProvider>))
  await waitFor(() => !!button('Ver detalle'))
}
async function open(role = 'rh') {
  await mount(role)
  await click('Ver detalle')
  await waitFor(() => document.body.textContent?.includes('Trabajo: 480 min') === true)
  await waitFor(() => document.body.textContent?.includes('Dentro de sede') === true)
}
function patches() { return mockedApi.mock.calls.filter(([, method]) => method === 'PATCH') }

it('pagina y reinicia el cursor al cambiar filtros', async () => {
  await mount()
  await click('Cargar más incidencias')
  await waitFor(() => document.body.textContent?.includes('Anomalía de reloj') === true)
  expect(mockedApi.mock.calls.some(([path]) => path.includes('cursor=next-page'))).toBe(true)
  await choose('statusFilter', 'Resuelta')
  await waitFor(() => mockedApi.mock.calls.some(([path]) => path === '/incidents?status=resolved'))
  expect(mockedApi.mock.calls.some(([path]) => path.includes('status=resolved') && path.includes('cursor='))).toBe(false)
  await setInput('weekFilter', '2026-10-05')
  await waitFor(() => mockedApi.mock.calls.some(([path]) => path.includes('week=2026-10-05')))
})

it('el auditor consulta la semana y el marcaje sin controles de modificación', async () => {
  await open('auditor')
  expect(document.body.textContent).toContain('Sin salida')
  expect(document.body.textContent).toContain('Empleado de prueba')
  expect(button('Asignarme')).toBeUndefined()
  expect(button('Guardar resolución')).toBeUndefined()
  expect(button('Agregar salida faltante')).toBeUndefined()
  expect(mockedApi.mock.calls.some(([path]) => path.startsWith('/users'))).toBe(false)
})

it('ofrece agregar la salida del tramo abierto sin esconder el ajuste detrás de la decisión', async () => {
  await open('admin_empresa')
  await click('Agregar salida faltante')
  expect(document.querySelector('[name="eventType"]')?.getAttribute('value')).toBe('clock_out')
  expect(document.activeElement).toBe(document.querySelector('[name="localTime"]'))
  expect(button('Guardar resolución')?.disabled).toBe(true)
  await setInput('reason', 'Salida verificada para completar la jornada.')
  await setInput('localTime', '2026-10-12T16:00')
  await click('Guardar resolución')
  await waitFor(() => patches().length === 1)
  expect(patches()[0][2]).toEqual({ resolution: { decision: 'adjusted', reason: 'Salida verificada para completar la jornada.', adjustment: { kind: 'add_event', eventType: 'clock_out', occurredAt: '2026-10-12T22:00:00.000Z' } } })
  expect(button('Agregar salida faltante')).toBeUndefined()
})

it('no ofrece agregar una salida para una incidencia de otro tipo', async () => {
  serverIncident.type = 'foreign_site'
  await open()
  expect(button('Agregar salida faltante')).toBeUndefined()
})

it('el supervisor se asigna y quita la asignación sin consultar usuarios', async () => {
  await open('supervisor')
  await click('Asignarme')
  await waitFor(() => serverIncident.assigneeUserId === userId)
  await waitFor(() => button('Quitar asignación')?.disabled === false)
  await click('Quitar asignación')
  await waitFor(() => serverIncident.assigneeUserId === null)
  expect(patches().map(([, , body]) => body)).toEqual([{ assigneeUserId: userId }, { assigneeUserId: null }])
  expect(mockedApi.mock.calls.some(([path]) => path.startsWith('/users'))).toBe(false)
})

it('justifica y muestra la nueva semana calculada por el servidor', async () => {
  await open()
  await setInput('reason', 'El teléfono estuvo sin conexión.')
  await click('Guardar resolución')
  await waitFor(() => document.body.textContent?.includes('Trabajo: 960 min') === true)
  expect(patches()[0][2]).toEqual({ resolution: { decision: 'justified', reason: 'El teléfono estuvo sin conexión.' } })
  expect(button('Guardar resolución')).toBeUndefined()
})

it('agrega un marcaje convirtiendo la hora de la empresa a UTC', async () => {
  await open()
  await choose('decision', 'Ajustar jornada')
  await setInput('reason', 'El supervisor confirma la salida.')
  await choose('eventType', 'Salida')
  await setInput('localTime', '2026-10-12T08:30')
  await waitFor(() => button('Guardar resolución')?.disabled === false)
  await click('Guardar resolución')
  await waitFor(() => patches().length === 1)
  expect(patches()[0][2]).toEqual({ resolution: { decision: 'adjusted', reason: 'El supervisor confirma la salida.', adjustment: { kind: 'add_event', eventType: 'clock_out', occurredAt: '2026-10-12T14:30:00.000Z' } } })
})

it.each([['Excluir marcaje', 'exclude_event'], ['Cambiar tipo de marcaje', 'retype_event']])('envía los campos exactos para %s', async (label, kind) => {
  await open()
  await choose('decision', 'Ajustar jornada')
  await choose('kind', label)
  await choose('eventId', 'Entrada')
  if (kind === 'retype_event') await choose('eventType', 'Salida')
  await setInput('reason', 'Se revisó el marcaje con la persona.')
  await click('Guardar resolución')
  await waitFor(() => patches().length === 1)
  expect(patches()[0][2]).toEqual({ resolution: { decision: 'adjusted', reason: 'Se revisó el marcaje con la persona.', adjustment: { kind, eventId, ...(kind === 'retype_event' ? { eventType: 'clock_out' } : {}) } } })
})

it('conserva el formulario ante una semana cerrada y muestra la referencia', async () => {
  failure = new ApiError(409, 'week_closed', 'La semana ya está cerrada.', 'ref-conflicto')
  await open()
  await setInput('reason', 'Se revisó el marcaje con la persona.')
  await click('Guardar resolución')
  await waitFor(() => document.body.textContent?.includes('ref-conflicto') === true)
  expect((document.querySelector('[name="reason"]') as HTMLTextAreaElement).value).toBe('Se revisó el marcaje con la persona.')
  expect(document.body.textContent).toContain('reabrir la semana')
})

it('recarga una incidencia que otra persona ya resolvió', async () => {
  failure = new ApiError(409, 'incident_already_resolved', 'La incidencia ya está resuelta.')
  await open()
  await setInput('reason', 'Se revisó el marcaje con la persona.')
  await click('Guardar resolución')
  await waitFor(() => document.body.textContent?.includes('Resuelta por otra persona') === true)
  expect(button('Guardar resolución')).toBeUndefined()
})

it('marca el error del motivo y mantiene el texto ante una validación del servidor', async () => {
  failure = new ApiError(422, 'validation', 'Datos no válidos', 'ref-validacion', [{ field: 'resolution.reason', message: 'Motivo no válido para esta resolución' }])
  await open()
  await setInput('reason', 'Se revisó el marcaje con la persona.')
  await click('Guardar resolución')
  await waitFor(() => document.querySelector('[name="reason"]')?.getAttribute('aria-invalid') === 'true')
  expect((document.querySelector('[name="reason"]') as HTMLTextAreaElement).value).toBe('Se revisó el marcaje con la persona.')
})

it('el administrador asigna a otra persona con acceso vigente', async () => {
  await open('admin_empresa')
  await choose('assigneeUserId', 'Responsable de prueba')
  expect([...document.querySelectorAll('[role="option"]')].some(option => option.textContent?.includes('Usuario deshabilitado'))).toBe(false)
  await click('Guardar responsable')
  await waitFor(() => serverIncident.assigneeUserId === otherUser)
  expect(patches()[0][2]).toEqual({ assigneeUserId: otherUser })
})
