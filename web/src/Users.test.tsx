// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError, type TenantUser } from './api'
import { Users } from './Users'
import { button, choose, click, setInput, waitFor } from './testUi'

const id = '11111111-1111-4111-8111-111111111111'
const employeeId = '22222222-2222-4222-8222-222222222222'
let user: TenantUser
let root: Root
let container: HTMLDivElement
let cache: QueryClient
let failure: ApiError | null
const mocked = vi.mocked(api)
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 30, x: 0, y: 0, top: 0, bottom: 30, left: 0, right: 100, toJSON: () => ({}) })
  user = { id, email: 'demo@example.invalid', displayName: 'Persona demo', roles: ['rh'], status: 'active', createdAt: '2026-10-01T12:00:00Z', linkedAt: '2026-10-02T12:00:00Z', employeeId: null }
  failure = null
  mocked.mockReset().mockImplementation(async (path, method = 'GET', body) => {
    if (method !== 'GET') { if (failure) throw failure; return { ...user, ...(body as object || {}) } }
    if (path === '/users') return { items: [{ ...user }], nextCursor: 'next-page' }
    if (path.startsWith('/users?cursor=')) return { items: [{ ...user, id: employeeId, email: 'second@example.invalid' }], nextCursor: null }
    if (path === '/employees') return { items: [{ id: employeeId, displayName: 'Empleado demo', externalId: 'DEMO-001', status: 'active' }], nextCursor: null }
    if (path === `/employees/${employeeId}`) return { id: employeeId, displayName: 'Empleado demo' }
    throw new Error(`Ruta inesperada: ${path}`)
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount(role = 'admin_empresa', self = 'self') {
  await act(async () => root.render(<QueryClientProvider client={cache}><Users me={{ userId: self, displayName: 'Demo', roles: [role], tenant: { name: 'Demo', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>))
  if (role === 'admin_empresa') await waitFor(() => !!button(`Editar ${user.email}`))
}
async function check(selector: string) { await act(async () => (document.querySelector(selector) as HTMLInputElement).click()) }
function writes() { return mocked.mock.calls.filter(([, method]) => method && method !== 'GET') }

it.each(['rh', 'supervisor', 'auditor', 'trabajador'])('no consulta ni modifica usuarios con el rol %s', async role => {
  await mount(role); expect(mocked).not.toHaveBeenCalled(); expect(button('Invitar usuario')).toBeUndefined()
})
it('pagina los usuarios con el cursor del servidor', async () => {
  await mount(); await click('Cargar más usuarios'); await waitFor(() => !!button('Editar second@example.invalid'))
  expect(mocked).toHaveBeenCalledWith('/users?cursor=next-page'); expect(button('Cargar más usuarios')).toBeUndefined()
})
it('invita con correo normalizado, varios roles y empleado opcional', async () => {
  await mount(); await click('Invitar usuario')
  await setInput('email', 'Nueva@Example.invalid'); await setInput('displayName', 'Nueva demo')
  await check('[name="roles"][value="rh"]'); await check('[name="roles"][value="trabajador"]')
  await choose('userEmployeeId', 'Empleado demo'); await click('Guardar usuario')
  await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual(['/users', 'POST', { email: 'nueva@example.invalid', displayName: 'Nueva demo', roles: ['rh', 'trabajador'], employeeId }])
})
it('exige al menos un rol antes de invitar', async () => {
  await mount(); await click('Invitar usuario'); await setInput('email', 'new@example.invalid'); await click('Guardar usuario')
  expect(document.body.textContent).toContain('Selecciona al menos un rol'); expect(writes()).toHaveLength(0)
})
it('edita sólo campos cambiados y permite soltar el vínculo de empleado', async () => {
  user.employeeId = employeeId
  await mount(); await click(`Editar ${user.email}`)
  expect((document.querySelector('[name="email"]') as HTMLInputElement).disabled).toBe(true)
  await choose('userEmployeeId', 'Sin empleado vinculado'); await click('Guardar usuario')
  await waitFor(() => writes().length === 1)
  expect(writes()[0]).toEqual([`/users/${id}`, 'PATCH', { employeeId: null }])
})
it('conserva roles y formulario cuando el servidor protege al último administrador', async () => {
  user.roles = ['admin_empresa']; failure = new ApiError(409, 'last_admin', 'La empresa no puede quedarse sin administrador.', 'ref-admin')
  await mount(); await click(`Editar ${user.email}`); await check('[name="disabled"]'); await click('Guardar usuario')
  await waitFor(() => document.body.textContent?.includes('ref-admin') === true)
  expect((document.querySelector('[name="disabled"]') as HTMLInputElement).checked).toBe(true)
  expect((document.querySelector('[name="roles"][value="admin_empresa"]') as HTMLInputElement).checked).toBe(true)
  expect(writes()[0][2]).toEqual({ disabled: true })
})
it('rehabilita una cuenta enviando sólo disabled false', async () => {
  user.status = 'disabled'; await mount(); await click(`Editar ${user.email}`); await check('[name="disabled"]'); await click('Guardar usuario')
  await waitFor(() => writes().length === 1); expect(writes()[0][2]).toEqual({ disabled: false })
})

it('no aparenta borrar un nombre que el backend no permite vaciar', async () => {
  await mount(); await click(`Editar ${user.email}`); await setInput('displayName', ''); await click('Guardar usuario')
  expect(document.body.textContent).toContain('El nombre existente no puede quedar vacío'); expect(writes()).toHaveLength(0)
})
it('exige confirmación al desvincular y no manda datos de roles ni contraseñas', async () => {
  await mount(); await click(`Desvincular ${user.email}`)
  expect(button('Confirmar desvinculación')?.disabled).toBe(true)
  expect(document.body.textContent).toContain('puede vincularse otra vez')
  await check('[name="confirmUnlink"]'); await click('Confirmar desvinculación')
  await waitFor(() => writes().length === 1); expect(writes()[0]).toEqual([`/users/${id}/unlink`, 'POST', undefined])
})
it('actualiza me después de modificar el propio acceso', async () => {
  cache.setQueryData(['me'], { userId: id })
  await mount('admin_empresa', id); await click(`Editar ${user.email}`); await setInput('displayName', 'Mi nuevo nombre'); await click('Guardar usuario')
  await waitFor(() => cache.getQueryState(['me'])?.isInvalidated === true)
  expect(writes()[0][2]).toEqual({ displayName: 'Mi nuevo nombre' })
})

it('exige confirmación para el cambio obligatorio y no solicita contraseñas', async () => {
  await mount(); await click(`Exigir cambio de contraseña a ${user.email}`)
  expect(button('Confirmar cambio obligatorio')?.disabled).toBe(true)
  expect(document.querySelector('input[type="password"]')).toBeNull()
  await check('[name="confirmPasswordChange"]'); await click('Confirmar cambio obligatorio')
  await waitFor(() => !!document.body.textContent?.includes('Cambio obligatorio confirmado'))
  expect(writes()).toEqual([[`/users/${id}/password-change`, 'POST']])
})
it('no ofrece cambio obligatorio a cuentas sin vínculo o deshabilitadas', async () => {
  user.linkedAt = null; await mount()
  expect(button(`Exigir cambio de contraseña a ${user.email}`)).toBeUndefined()
  user.linkedAt = '2026-10-02T12:00:00Z'; user.status = 'disabled'
  await act(async () => { await cache.invalidateQueries({ queryKey: ['users'] }) })
  expect(button(`Exigir cambio de contraseña a ${user.email}`)).toBeUndefined()
})
it('no anuncia éxito cuando la identidad no confirma el cambio obligatorio', async () => {
  failure = new ApiError(503, 'identity_unavailable', 'No se pudo confirmar el cambio obligatorio.')
  await mount(); await click(`Exigir cambio de contraseña a ${user.email}`); await check('[name="confirmPasswordChange"]'); await click('Confirmar cambio obligatorio')
  await waitFor(() => !!document.body.textContent?.includes('No se pudo confirmar el cambio obligatorio.'))
  expect(document.body.textContent).not.toContain('Cambio obligatorio confirmado.')
  expect(writes()).toHaveLength(1)
})
