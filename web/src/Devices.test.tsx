// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accessibilityViolations } from './accessibility'
import { loaded } from './testUi'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError, type Device } from './api'
import { Devices } from './Devices'
import { button, choose, click, setInput, waitFor } from './testUi'

const deviceId = '11111111-1111-4111-8111-111111111111'
const employeeId = '22222222-2222-4222-8222-222222222222'
const siteId = '33333333-3333-4333-8333-333333333333'
let device: Device
let root: Root
let container: HTMLDivElement
let cache: QueryClient
let failure: ApiError | null
const mocked = vi.mocked(api)
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 30, x: 0, y: 0, top: 0, bottom: 30, left: 0, right: 100, toJSON: () => ({}) })
  device = { id: deviceId, mode: 'personal', status: 'active', employeeId, siteId: null, label: null, model: 'Modelo demo', appVersion: '0.1.0', enrolledAt: '2026-10-01T12:00:00Z', lastSeenAt: null, revokedAt: null }
  failure = null
  mocked.mockReset().mockImplementation(async (path, method = 'GET', body) => {
    if (method !== 'GET') {
      if (failure) throw failure
      if (path === '/device-enrollments') return { id: 'e', ...(body as object), siteId: null, label: null, code: 'K7M2-9QXD', status: 'pending', expiresAt: '2026-10-01T12:15:00Z', createdAt: '2026-10-01T12:00:00Z' }
      return { ...device, status: 'revoked', revokedAt: '2026-10-02T12:00:00Z' }
    }
    if (path === '/devices') return { items: [{ ...device }], nextCursor: null }
    if (path === '/employees') return { items: [{ id: employeeId, displayName: 'Empleado demo', externalId: 'DEMO-001', status: 'active' }], nextCursor: null }
    if (path === `/employees/${employeeId}`) return { id: employeeId, displayName: 'Empleado demo' }
    if (path === '/sites') return { items: [{ id: siteId, name: 'Sede demo', status: 'active' }], nextCursor: null }
    throw new Error(`Ruta inesperada: ${path}`)
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount(role = 'admin_empresa') {
  await act(async () => root.render(<QueryClientProvider client={cache}><Devices me={{ userId: 'self', displayName: 'Demo', roles: [role], tenant: { name: 'Demo', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>))
  if (role !== 'supervisor' && role !== 'trabajador') await waitFor(() => !!document.body.textContent?.includes('Modelo demo'))
}
function writes() { return mocked.mock.calls.filter(([, method]) => method && method !== 'GET') }

it.each(['supervisor', 'trabajador'])('no consulta dispositivos con el rol %s', async role => {
  await mount(role); expect(mocked).not.toHaveBeenCalled(); expect(button('Emitir código')).toBeUndefined()
})
it('auditoría consulta sin emitir ni revocar', async () => {
  await mount('auditor'); await waitFor(() => !!document.body.textContent?.includes('Empleado demo'))
  expect(button('Emitir código')).toBeUndefined(); expect(button('Revocar Modelo demo')).toBeUndefined()
})
it('emite un código personal para una persona y lo muestra con la dirección del servidor', async () => {
  await mount(); await click('Emitir código'); await choose('enrollEmployeeId', 'Empleado demo'); await click('Emitir código')
  await waitFor(() => !!document.body.textContent?.includes('K7M2-9QXD'))
  expect(writes()).toEqual([['/device-enrollments', 'POST', { mode: 'personal', employeeId }]])
  expect(document.body.textContent).toContain(window.location.origin)
})
it('emite un código de terminal con sede y nombre', async () => {
  await mount(); await click('Emitir código'); await choose('mode', 'Terminal compartida'); await choose('enrollSiteId', 'Sede demo')
  await setInput('label', ' Recepción '); await click('Emitir código')
  await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual(['/device-enrollments', 'POST', { mode: 'terminal', siteId, label: 'Recepción' }])
})
it('muestra el rechazo del servidor sin cerrar el formulario', async () => {
  failure = new ApiError(422, 'validation', 'La persona está dada de baja.')
  await mount(); await click('Emitir código'); await choose('enrollEmployeeId', 'Empleado demo'); await click('Emitir código')
  await waitFor(() => !!document.body.textContent?.includes('La persona está dada de baja.'))
  expect(button('Emitir código')).toBeDefined()
})
it('revoca con motivo y vuelve a consultar la lista', async () => {
  await mount(); await click('Revocar Modelo demo'); await setInput('reason', 'El teléfono se extravió.'); await click('Confirmar revocación')
  await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual([`/devices/${deviceId}/revocation`, 'POST', { reason: 'El teléfono se extravió.' }])
  await waitFor(() => mocked.mock.calls.filter(([path]) => path === '/devices').length === 2)
})

it('cumple las reglas automáticas de accesibilidad', async () => {
  await mount(); await loaded()
  expect(await accessibilityViolations()).toEqual([])
})
