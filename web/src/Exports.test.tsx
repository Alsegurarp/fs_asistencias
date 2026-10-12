// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn(), apiDownload: vi.fn() }))
import { api, apiDownload, ApiError } from './api'
import { Exports, type ExportRecord } from './Exports'
import { button, click, setInput, waitFor } from './testUi'
let root: Root
let container: HTMLDivElement
let cache: QueryClient
let record: ExportRecord
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 30, x: 0, y: 0, top: 0, bottom: 30, left: 0, right: 100, toJSON: () => ({}) })
  record = { id: '11111111-1111-4111-8111-111111111111', status: 'ready', weekStart: '2026-10-05', rowCount: 4, expiresAt: '2026-10-12T23:00:00Z', fileHash: 'hash' }
  vi.mocked(api).mockReset().mockImplementation(async path => path.startsWith('/sites') ? { items: [], nextCursor: null } : { ...record })
  vi.mocked(apiDownload).mockReset().mockResolvedValue({ blob: new Blob(['csv']), filename: 'demo.csv' })
  vi.stubGlobal('URL', URL)
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  container = document.createElement('div'); document.body.append(container)
  root = createRoot(container); cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount(role = 'admin_empresa') {
  await act(async () => root.render(<QueryClientProvider client={cache}><Exports me={{ userId: 'self', displayName: 'Demo', roles: [role], tenant: { name: 'Demo', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>))
}
it('solicita el CSV sin sede y descarga con credencial, dejando el manifiesto disponible', async () => {
  await mount(); await setInput('exportWeek', '2026-10-05'); await click('Solicitar CSV')
  await waitFor(() => !!button('Descargar CSV'))
  expect(vi.mocked(api).mock.calls.find(([, method]) => method === 'POST')).toEqual(['/exports', 'POST', { weekStart: '2026-10-05', format: 'csv' }, expect.any(String)])
  record.status = 'expired'
  await click('Descargar CSV')
  await waitFor(() => !button('Descargar CSV'))
  expect(apiDownload).toHaveBeenCalledWith(`/exports/${record.id}/download`)
  expect(document.body.textContent).toContain('usado o vencido')
  await click('Descargar manifiesto')
  await waitFor(() => vi.mocked(apiDownload).mock.calls.length === 2)
  expect(apiDownload).toHaveBeenLastCalledWith(`/exports/${record.id}/manifest`)
})
it('conserva la clave al reintentar una solicitud fallida y la cambia para una nueva intención', async () => {
  await mount()
  vi.mocked(api).mockImplementationOnce(async () => { throw new ApiError(503, 'unavailable', 'Reintentar') })
  await click('Solicitar CSV'); await waitFor(() => document.body.textContent?.includes('Reintentar') === true)
  await click('Solicitar CSV'); await waitFor(() => !!button('Descargar CSV'))
  let posts = vi.mocked(api).mock.calls.filter(([, method]) => method === 'POST')
  expect(posts[0][3]).toBe(posts[1][3])
  await click('Solicitar CSV'); await waitFor(() => vi.mocked(api).mock.calls.filter(([, method]) => method === 'POST').length === 3)
  posts = vi.mocked(api).mock.calls.filter(([, method]) => method === 'POST')
  expect(posts[2][3]).not.toBe(posts[1][3])
})
it.each(['queued', 'failed', 'expired'] as const)('no permite descargar cuando el estado es %s', async status => {
  record.status = status; await mount('auditor'); await click('Solicitar CSV')
  await waitFor(() => document.body.textContent?.includes('ID del exporte') === true)
  expect(button('Descargar CSV')).toBeUndefined()
})
it('no ofrece operaciones al supervisor', async () => { await mount('supervisor'); expect(button('Solicitar CSV')).toBeUndefined(); expect(document.body.textContent).toContain('Tu rol no permite exportar') })
