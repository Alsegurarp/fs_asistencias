// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }))
import { api, ApiError } from './api'
import { Imports, type ImportResult } from './Imports'
import { button, click, waitFor } from './testUi'
let root: Root
let cache: QueryClient
let container: HTMLDivElement
let result: ImportResult
const mocked = vi.mocked(api)
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  result = { id: 'result', status: 'ready', dryRun: true, counts: { total: 2, accepted: 1, rejected: 1 }, errors: [{ row: 3, externalId: 'BAD', code: 'invalid_date', message: 'Fecha inválida' }], manifestHash: 'hash' }
  mocked.mockReset().mockImplementation(async (_path, _method, body) => ({ ...result, dryRun: (body as FormData).get('dryRun') === 'true', status: (body as FormData).get('dryRun') === 'true' ? result.status : 'applied' }))
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount(role = 'rh') { await act(async () => root.render(<QueryClientProvider client={cache}><Imports me={{ userId: 'self', displayName: 'Demo', roles: [role], tenant: { name: 'Demo', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>)) }
async function file(size = 12) {
  const input = document.querySelector('[aria-label="Archivo CSV"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [new File(['x'.repeat(size)], 'demo.csv', { type: 'text/csv' })], configurable: true })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}
async function confirm() { await act(async () => (document.querySelector('[name="confirmImport"]') as HTMLInputElement).click()) }
it.each(['supervisor', 'auditor', 'trabajador'])('niega la importación al rol %s', async role => { await mount(role); expect(button('Validar archivo')).toBeUndefined(); expect(mocked).not.toHaveBeenCalled() })
it('valida antes de aplicar, informa filas rechazadas y usa otra clave para la aplicación', async () => {
  await mount(); expect(button('Validar archivo')?.disabled).toBe(true); await file(); await click('Validar archivo')
  await waitFor(() => document.body.textContent?.includes('Fecha inválida') === true)
  expect(button('Aplicar filas aceptadas')?.disabled).toBe(true)
  expect(document.body.textContent).toContain('El padrón todavía no cambió')
  cache.setQueryData(['employees'], {})
  await confirm(); await click('Aplicar filas aceptadas')
  await waitFor(() => document.body.textContent?.includes('Las filas aceptadas se aplicaron') === true)
  const calls = mocked.mock.calls
  expect(calls[0][0]).toBe('/imports/csv'); expect((calls[0][2] as FormData).get('dryRun')).toBe('true')
  expect((calls[1][2] as FormData).get('dryRun')).toBe('false'); expect(calls[1][3]).not.toBe(calls[0][3])
  expect((calls[0][2] as FormData).get('file')).toBeInstanceOf(File)
  expect(cache.getQueryState(['employees'])?.isInvalidated).toBe(true); expect(button('Aplicar filas aceptadas')).toBeUndefined()
})
it('reintenta la aplicación con el mismo archivo y clave tras perder la respuesta', async () => {
  await mount(); await file(); await click('Validar archivo'); await waitFor(() => !!button('Aplicar filas aceptadas')); await confirm()
  mocked.mockRejectedValueOnce(new ApiError(503, 'unavailable', 'Respuesta perdida'))
  await click('Aplicar filas aceptadas'); await waitFor(() => document.body.textContent?.includes('Respuesta perdida') === true)
  await click('Aplicar filas aceptadas'); await waitFor(() => mocked.mock.calls.length === 3)
  expect(mocked.mock.calls[2][3]).toBe(mocked.mock.calls[1][3])
  expect((mocked.mock.calls[2][2] as FormData).get('file')).toBe((mocked.mock.calls[1][2] as FormData).get('file'))
})
it('un archivo nuevo invalida la validación y confirmación anterior', async () => {
  await mount(); await file(); await click('Validar archivo'); await waitFor(() => !!button('Aplicar filas aceptadas')); await confirm()
  await file(30); expect(button('Aplicar filas aceptadas')).toBeUndefined()
  await click('Validar archivo'); await waitFor(() => mocked.mock.calls.length === 2)
  expect(mocked.mock.calls[1][3]).not.toBe(mocked.mock.calls[0][3])
})
it('no aplica un archivo con encabezados inválidos', async () => {
  result.status = 'failed'; result.errors = [{ row: 1, externalId: null, code: 'invalid_header', message: 'Encabezados incorrectos' }]
  await mount(); await file(); await click('Validar archivo'); await waitFor(() => document.body.textContent?.includes('Encabezados incorrectos') === true)
  expect(button('Aplicar filas aceptadas')).toBeUndefined()
})
it.each([0, 1024 * 1024 + 1])('rechaza un archivo de %s bytes antes de enviarlo', async size => {
  await mount(); await file(size); expect(document.body.textContent).toContain('hasta 1 MB'); expect(button('Validar archivo')?.disabled).toBe(true); expect(mocked).not.toHaveBeenCalled()
})
