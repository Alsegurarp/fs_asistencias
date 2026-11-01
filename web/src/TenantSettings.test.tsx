// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accessibilityViolations } from './accessibility'
import { loaded } from './testUi'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError, type Tenant } from './api'
import { TenantSettings } from './TenantSettings'
import { button, choose, click, setInput, waitFor } from './testUi'

let tenant: Tenant
let root: Root
let container: HTMLDivElement
let cache: QueryClient
let failure: ApiError | null
const mocked = vi.mocked(api)
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 30, x: 0, y: 0, top: 0, bottom: 30, left: 0, right: 100, toJSON: () => ({}) })
  tenant = { id: 'empresa', name: 'Empresa demo', slug: 'empresa-demo', timeZone: 'America/Mexico_City', weekStartsOn: 'monday', breakPolicy: 'not_considered', status: 'active', createdAt: '2026-10-01T12:00:00Z', autoCloseAfterHours: 24, breakPolicyChange: null }
  failure = null
  mocked.mockReset().mockImplementation(async (path, method = 'GET', body) => {
    if (path === '/tenant/break-policy-changes' && method === 'POST') {
      if (failure) throw failure
      const { breakPolicy, reason } = body as { breakPolicy: 'marked'; reason: string }
      tenant = { ...tenant, breakPolicyChange: { id: 'cambio', breakPolicy, reason, effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z', scheduledAt: '2026-10-30T17:00:00Z' } }
      return tenant.breakPolicyChange
    }
    if (path === '/tenant/break-policy-changes/cambio/cancellation' && method === 'POST') { tenant = { ...tenant, breakPolicyChange: null }; return undefined }
    if (path !== '/tenant') throw new Error(`Ruta inesperada: ${path}`)
    if (method === 'PATCH') { if (failure) throw failure; tenant = { ...tenant, ...(body as object) } }
    return { ...tenant }
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount(role = 'admin_empresa') {
  await act(async () => root.render(<QueryClientProvider client={cache}><TenantSettings me={{ userId: 'self', displayName: 'Prueba', roles: [role], tenant: { name: 'Empresa demo', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>))
  if (role !== 'trabajador') await waitFor(() => !!document.body.textContent?.includes('empresa-demo'))
}
function writes() { return mocked.mock.calls.filter(([, method]) => method === 'PATCH') }
function posts() { return mocked.mock.calls.filter(([, method]) => method === 'POST') }

it('no consulta la empresa con rol trabajador', async () => {
  await mount('trabajador'); expect(mocked).not.toHaveBeenCalled(); expect(button('Editar configuración')).toBeUndefined()
})
it.each(['rh', 'supervisor', 'auditor'])('%s consulta sin poder editar', async role => {
  await mount(role)
  expect(document.body.textContent).toContain('America/Mexico_City')
  expect(button('Editar configuración')).toBeUndefined()
  expect(writes()).toHaveLength(0)
})
it('envía sólo campos cambiados y refresca la cuenta y consultas', async () => {
  const invalidate = vi.spyOn(cache, 'invalidateQueries')
  await mount(); await click('Editar configuración'); await setInput('name', ' Nuevo nombre '); await click('Guardar configuración')
  await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual(['/tenant', 'PATCH', { name: 'Nuevo nombre' }])
  await waitFor(() => !document.querySelector('[role="dialog"]'))
  expect(invalidate).toHaveBeenCalledWith()
  expect(document.body.textContent).toContain('Nuevo nombre')
})
it('guarda el día elegido y manda null al desactivar el cierre, sin tocar la comida', async () => {
  await mount(); await click('Editar configuración'); await choose('weekStartsOn', 'Domingo')
  expect(document.querySelector('[name="breakPolicy"]')).toBeNull()
  await setInput('autoCloseAfterHours', ''); await click('Guardar configuración')
  await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual(['/tenant', 'PATCH', { weekStartsOn: 'sunday', autoCloseAfterHours: null }])
})
it('programa el cambio de comida con motivo, lo anuncia y lo cancela', async () => {
  await mount(); await click('Programar cambio de comida')
  expect(document.body.textContent).toContain('primer día de semana de la empresa dentro de la siguiente quincena')
  expect(button('Programar cambio')!.disabled).toBe(true)
  await setInput('reason', ' Desde noviembre se registra la comida. '); await click('Programar cambio')
  await waitFor(() => posts().length === 1)
  expect(posts()[0]).toEqual(['/tenant/break-policy-changes', 'POST', { breakPolicy: 'marked', reason: 'Desde noviembre se registra la comida.' }])
  await waitFor(() => !!document.body.textContent?.includes('se marca desde el lunes 16 de noviembre de 2026'))
  expect(document.body.textContent).toContain('Descanso o comida: No se marca')
  // Con un cambio programado, el inicio de semana espera.
  await click('Editar configuración')
  expect(document.body.textContent).toContain('Cancela el cambio de comida programado')
  await click('Cancelar'); await click('Cancelar cambio de comida')
  await waitFor(() => posts().length === 2)
  expect(posts()[1]).toEqual(['/tenant/break-policy-changes/cambio/cancellation', 'POST'])
  await waitFor(() => !!button('Programar cambio de comida'))
})
it.each(['rh', 'auditor'])('%s ve el cambio programado sin poder cambiarlo', async role => {
  tenant = { ...tenant, breakPolicyChange: { id: 'cambio', breakPolicy: 'marked', reason: 'Desde noviembre se registra la comida.', effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z', scheduledAt: '2026-10-30T17:00:00Z' } }
  await mount(role)
  expect(document.body.textContent).toContain('Desde noviembre se registra la comida.')
  expect(button('Cancelar cambio de comida')).toBeUndefined()
  expect(button('Programar cambio de comida')).toBeUndefined()
})
it('no pisa campos ajenos si la configuración se refresca mientras se edita', async () => {
  await mount(); await click('Editar configuración'); await setInput('name', 'Nombre editado')
  await act(async () => { tenant = { ...tenant, timeZone: 'UTC' }; cache.setQueryData(['tenant'], tenant) })
  await click('Guardar configuración'); await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual(['/tenant', 'PATCH', { name: 'Nombre editado' }])
  expect(tenant.timeZone).toBe('UTC')
})
it('no envía una actualización vacía', async () => {
  await mount(); await click('Editar configuración'); await click('Guardar configuración')
  await waitFor(() => !!document.body.textContent?.includes('No hay cambios para guardar'))
  expect(writes()).toHaveLength(0)
})
it('conserva los valores del formulario tras un rechazo del servidor', async () => {
  failure = new ApiError(422, 'validation', 'La zona horaria no es válida.')
  await mount(); await click('Editar configuración'); await setInput('timeZone', 'Marte/Olimpo'); await click('Guardar configuración')
  await waitFor(() => !!document.body.textContent?.includes('La zona horaria no es válida.'))
  expect(document.querySelector<HTMLInputElement>('[name="timeZone"]')!.value).toBe('Marte/Olimpo')
})

it('cumple las reglas automáticas de accesibilidad', async () => {
  await mount(); await loaded()
  expect(await accessibilityViolations()).toEqual([])
})
