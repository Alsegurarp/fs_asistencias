// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accessibilityViolations } from './accessibility'
import { loaded } from './testUi'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError } from './api'
import { Schedules, type Schedule } from './Schedules'
import { button, choose, click, setInput, waitFor } from './testUi'
const id = '11111111-1111-4111-8111-111111111111'
const employeeId = '22222222-2222-4222-8222-222222222222'
const schedule: Schedule = { id, name: 'Turno demo', timeZone: 'America/Mexico_City', validFrom: '2026-10-01', validTo: null, days: [{ dayOfWeek: 'monday', startTime: '22:00', endTime: '06:00', breakMinutes: 30 }] }
let root: Root
let cache: QueryClient
let container: HTMLDivElement
let failure: ApiError | null
const mocked = vi.mocked(api)
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 30, x: 0, y: 0, top: 0, bottom: 30, left: 0, right: 100, toJSON: () => ({}) })
  failure = null
  mocked.mockReset().mockImplementation(async (path, method = 'GET', body) => {
    if (method === 'POST') { if (failure) throw failure; return path === '/schedules' ? schedule : { id: 'assignment', employeeId, scheduleId: id, validFrom: (body as { validFrom: string }).validFrom, validTo: null } }
    if (path === '/schedules') return { items: [schedule], nextCursor: 'next' }
    if (path.startsWith('/schedules?cursor=')) return { items: [{ ...schedule, id: employeeId, name: 'Segundo turno' }], nextCursor: null }
    if (path === '/employees') return { items: [{ id: employeeId, displayName: 'Ana Demo', externalId: 'DEMO-001', status: 'active' }], nextCursor: null }
    if (path === `/employees/${employeeId}`) return { id: employeeId, displayName: 'Ana Demo', currentScheduleId: null }
    throw new Error(path)
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount(role = 'rh') {
  await act(async () => root.render(<QueryClientProvider client={cache}><Schedules me={{ userId: 'self', displayName: 'Demo', roles: [role], tenant: { name: 'Demo', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>))
  if (role !== 'trabajador') await waitFor(() => document.body.textContent?.includes('Turno demo') === true)
}
function posts() { return mocked.mock.calls.filter(([, method]) => method === 'POST') }
it.each(['supervisor', 'auditor'])('%s consulta un turno nocturno sin modificarlo', async role => {
  await mount(role); expect(document.body.textContent).toContain('salida al día siguiente'); expect(button('Crear horario')).toBeUndefined(); expect(button('Asignar Turno demo')).toBeUndefined()
})
it('niega consultas al trabajador', async () => { await mount('trabajador'); expect(mocked).not.toHaveBeenCalled() })
it('pagina horarios', async () => { await mount(); await click('Cargar más horarios'); await waitFor(() => document.body.textContent?.includes('Segundo turno') === true); expect(mocked).toHaveBeenCalledWith('/schedules?cursor=next') })
it('crea días y vigencia con los campos exactos', async () => {
  await mount(); await click('Crear horario'); await setInput('scheduleName', 'Nuevo turno'); await setInput('scheduleFrom', '2026-10-01')
  for (const day of ['tuesday', 'wednesday', 'thursday', 'friday']) await act(async () => (document.querySelector(`[name="scheduleDay"][value="${day}"]`) as HTMLInputElement).click())
  await setInput('monday-start', '22:00'); await setInput('monday-end', '06:00'); await setInput('monday-break', '30'); await click('Guardar horario')
  await waitFor(() => posts().length === 1)
  expect(posts()[0][2]).toEqual({ name: 'Nuevo turno', timeZone: 'America/Mexico_City', validFrom: '2026-10-01', validTo: null, days: [{ dayOfWeek: 'monday', startTime: '22:00', endTime: '06:00', breakMinutes: 30 }] })
})
it('conserva la entrada ante una validación del servidor', async () => {
  failure = new ApiError(422, 'validation', 'La salida no puede ser igual a la entrada.', 'ref-turno')
  await mount(); await click('Crear horario'); await setInput('scheduleName', 'Turno a corregir'); await setInput('monday-end', '09:00'); await click('Guardar horario')
  await waitFor(() => document.body.textContent?.includes('ref-turno') === true)
  expect((document.querySelector('[name="scheduleName"]') as HTMLInputElement).value).toBe('Turno a corregir')
})
it('asigna un empleado y muestra vigencia sin repetir la mutación', async () => {
  await mount(); await click('Asignar Turno demo'); await choose('assignmentEmployee', 'Ana Demo')
  await waitFor(() => button('Confirmar asignación')?.disabled === false)
  await setInput('assignmentFrom', '2026-10-12'); await click('Confirmar asignación')
  await waitFor(() => document.body.textContent?.includes('Horario asignado desde 2026-10-12') === true)
  expect(posts()[0]).toEqual([`/employees/${employeeId}/schedule-assignments`, 'POST', { scheduleId: id, validFrom: '2026-10-12' }])
  expect(button('Confirmar asignación')?.disabled).toBe(true)
})
it('conserva empleado y fecha si la asignación anterior impide el cambio', async () => {
  failure = new ApiError(422, 'validation', 'Debe ser posterior al inicio anterior.')
  await mount(); await click('Asignar Turno demo'); await choose('assignmentEmployee', 'Ana Demo')
  await waitFor(() => button('Confirmar asignación')?.disabled === false); await click('Confirmar asignación')
  await waitFor(() => document.body.textContent?.includes('Debe ser posterior') === true)
  expect(document.querySelector('[name="assignmentEmployee"]')?.getAttribute('value')).toBe(employeeId)
})

it('cumple las reglas automáticas de accesibilidad', async () => {
  await mount(); await loaded()
  expect(await accessibilityViolations()).toEqual([])
})
