// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError, type Tenant } from './api'
import { Tenants } from './Tenants'
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
  tenant = { id: '11111111-1111-4111-8111-111111111111', name: 'Empresa demo', slug: 'empresa-demo', timeZone: 'America/Mexico_City', weekStartsOn: 'monday', breakPolicy: 'not_considered', status: 'active', createdAt: '2026-10-01T12:00:00Z', autoCloseAfterHours: null }
  failure = null
  mocked.mockReset().mockImplementation(async (path, method = 'GET', body) => {
    if (method !== 'GET') { if (failure) throw failure; if (path.endsWith('/reactivation')) tenant.status = 'active'; return { ...tenant, ...(body as object) } }
    if (path === '/tenants') return { items: [{ ...tenant }], nextCursor: null }
    throw new Error(`Ruta inesperada: ${path}`)
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount() {
  await act(async () => root.render(<QueryClientProvider client={cache}><Tenants me={{ userId: 'self', displayName: 'Operación', roles: ['operador_saas'], tenant: null }} /></QueryClientProvider>))
  await waitFor(() => !!document.body.textContent?.includes('Empresa demo'))
}
function writes() { return mocked.mock.calls.filter(([, method]) => method && method !== 'GET') }
async function fill() {
  await click('Dar de alta empresa')
  await setInput('name', ' Pruebas de la app '); await setInput('slug', 'Pruebas-App'); await setInput('firstAdminEmail', ' Admin@Example.invalid ')
  await choose('breakPolicy', 'Se marca')
}

it('lista las empresas con su configuración', async () => {
  await mount()
  expect(document.body.textContent).toContain('empresa-demo'); expect(document.body.textContent).toContain('Empieza en lunes'); expect(document.body.textContent).toContain('No se marca')
})
it('da de alta una empresa con correo y clave normalizados', async () => {
  await mount(); await fill(); await click('Guardar empresa')
  await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual(['/tenants', 'POST', { name: 'Pruebas de la app', slug: 'pruebas-app', timeZone: 'America/Mexico_City', weekStartsOn: 'monday', breakPolicy: 'marked', firstAdminEmail: 'admin@example.invalid' }])
  await waitFor(() => !!document.body.textContent?.includes('Se dio de alta Pruebas de la app'))
  await waitFor(() => mocked.mock.calls.filter(([path, method]) => path === '/tenants' && (!method || method === 'GET')).length === 2)
})
it('muestra el conflicto del servidor sin cerrar el formulario', async () => {
  failure = new ApiError(409, 'slug_taken', 'El identificador ya existe.')
  await mount(); await fill(); await click('Guardar empresa')
  await waitFor(() => !!document.body.textContent?.includes('El identificador ya existe.'))
  expect(document.querySelector('[name="name"]')).not.toBeNull()
})

it('reactiva sólo empresas suspendidas con confirmación y motivo válido', async () => {
  tenant.status = 'suspended'; await mount(); await click('Reactivar Empresa demo')
  expect(button('Confirmar reactivación')?.disabled).toBe(true)
  await setInput('reason', ' Servicio restablecido '); expect(writes()).toHaveLength(0)
  await click('Confirmar reactivación')
  await waitFor(() => !button('Reactivar Empresa demo'))
  expect(writes()).toEqual([[`/tenants/${tenant.id}/reactivation`, 'POST', { reason: 'Servicio restablecido' }]])
})
it('conserva el motivo ante conflicto y permite cancelar sin escribir', async () => {
  tenant.status = 'suspended'; failure = new ApiError(409, 'tenant_not_suspended', 'Esa empresa no está suspendida.')
  await mount(); await click('Reactivar Empresa demo'); await setInput('reason', 'Revisado por operación'); await click('Confirmar reactivación')
  await waitFor(() => !!document.body.textContent?.includes('Esa empresa no está suspendida.'))
  expect((document.querySelector('[name="reason"]') as HTMLInputElement).value).toBe('Revisado por operación')
  await click('Cancelar'); expect(writes()).toHaveLength(1)
})
it('no consulta empresas con un rol ajeno al operador', async () => {
  await act(async () => root.render(<QueryClientProvider client={cache}><Tenants me={{ userId: 'self', displayName: 'RH', roles: ['rh'], tenant: null }} /></QueryClientProvider>))
  expect(mocked).not.toHaveBeenCalled(); expect(button('Dar de alta empresa')).toBeUndefined()
})
