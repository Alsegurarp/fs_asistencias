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
import { PersonalAttendance } from './PersonalAttendance'
import { type Week } from './incidentModel'
import { click, setInput, waitFor } from './testUi'

let root: Root, container: HTMLDivElement, cache: QueryClient, week: Week
const mocked = vi.mocked(api)
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  week = { weekStart: '2026-10-05', timeZone: 'America/Mexico_City', segments: [{ id: 'one', kind: 'work', startAt: '2026-10-05T13:00:00Z', endAt: null, minutes: 0 }], totals: { workedMinutes: 0, breakMinutes: 0, ordinaryMinutes: 0, overtimeMinutes: 0 }, alerts: [], openIncidentIds: [], closure: null, acknowledgement: null }
  mocked.mockReset().mockResolvedValue(week)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.unstubAllGlobals() })
async function mount(roles = ['trabajador'], userId = 'self') {
  await act(async () => root.render(<QueryClientProvider client={cache}><PersonalAttendance me={{ userId, displayName: 'Persona', roles, tenant: { name: 'Empresa', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>))
}
it('consulta sólo la ruta personal y muestra la semana y sus tramos', async () => {
  await mount(); await waitFor(() => !!document.body.textContent?.includes('Sin salida'))
  await setInput('personalWeek', '2026-10-06'); await click('Consultar semana')
  await waitFor(() => mocked.mock.calls.some(([path]) => path === '/me/attendance?week=2026-10-06'))
  await waitFor(() => !!document.body.textContent?.includes('2026-10-05'))
  expect(mocked.mock.calls.every(([path, method]) => path.startsWith('/me/attendance?week=') && !method)).toBe(true)
  expect(document.body.textContent).toContain('2026-10-05')
})
it('muestra el acuse del servidor aunque no se haya enviado desde esta sesión', async () => {
  week.closure = { id: 'closure', version: 2, status: 'closed' }
  week.acknowledgement = { id: 'receipt', closureId: 'closure', type: 'objected', note: 'Revisar salida', at: '2026-10-12T12:00:00Z', evidenceHash: 'hash' }
  await mount(); await waitFor(() => !!document.body.textContent?.includes('Diferencia reportada'))
  expect(document.body.textContent).toContain('Revisar salida'); expect(document.body.textContent).toContain('receipt')
})
it('no presenta como vigente un acuse de una semana reabierta', async () => {
  week.closure = { id: 'closure', version: 1, status: 'reopened' }
  week.acknowledgement = { id: 'old-receipt', closureId: 'closure', type: 'agreed', note: null, at: '2026-10-12T12:00:00Z', evidenceHash: 'hash' }
  await mount(); await waitFor(() => !!document.body.textContent?.includes('Semana reabierta'))
  expect(document.body.textContent).not.toContain('old-receipt')
})
it('explica falta de vínculo y no conserva la semana de otro usuario en caché', async () => {
  await mount(); await waitFor(() => !!document.body.textContent?.includes('2026-10-05'))
  mocked.mockRejectedValue(new ApiError(403, 'forbidden', 'Permiso insuficiente'))
  await mount(['trabajador'], 'unlinked'); await waitFor(() => !!document.body.textContent?.includes('vínculo con el padrón'))
  expect(document.body.textContent).not.toContain('2026-10-05')
})
it('no consulta sin rol Trabajador', async () => {
  await mount(['rh']); expect(mocked).not.toHaveBeenCalled()
})

it('cumple las reglas automáticas de accesibilidad', async () => {
  await mount(); await loaded()
  expect(await accessibilityViolations()).toEqual([])
})
