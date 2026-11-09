// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown; key?: string }
const server = vi.hoisted(() => ({ calls: [] as Call[], pending: 0, handler: (call: Call): Promise<unknown> => new Promise(() => call) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() }, identityBase: 'http://localhost:8082' }))
vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  api: vi.fn((path: string, method = 'GET', body?: unknown, key?: string) => {
    const call = { path, method, body, key }
    server.calls.push(call); server.pending++
    const answer = server.handler(call)
    const done = () => { server.pending-- }
    answer.then(done, done)
    return answer
  }),
}))
import { ApiError, type Me } from './api'
import type { ImportResult } from './importsModel'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { button, click, waitFor } from './testUi'

const hash = '8c1e52d0aa11bb22cc33dd44ee55ff6600112233445566778899aabb9f1744a0'
const item = (id: string, extra: Partial<ImportResult> = {}): ImportResult => ({
  id, status: 'applied', dryRun: false, templateVersion: 1, counts: { total: 44, accepted: 44, rejected: 0, created: 3, updated: 1, unchanged: 40 }, errors: [], manifestHash: hash,
  fileName: 'padron-octubre.csv', createdBy: 'u1', createdByName: 'Rocío Navarro', reviewedImportId: null, appliedByImportId: null, createdAt: '2026-10-19T16:00:00Z', ...extra,
})
const errors = [
  { row: 12, externalId: '0219', code: 'site_not_found', message: 'No hay una sede activa con ese nombre.' },
  { row: 27, externalId: '0187', code: 'invalid_date', message: 'La fecha de inicio debe ser AAAA-MM-DD.' },
  { row: 40, externalId: null, code: 'missing_external_id', message: 'Falta el identificador externo.' },
]
const pending = item('r1', { status: 'ready', dryRun: true, counts: { total: 48, accepted: 45, rejected: 3, created: 4, updated: 2, unchanged: 39 }, errors, fileName: 'padron-noviembre.csv', createdAt: '2026-11-09T17:02:00Z' })
const history = [
  pending,
  item('a1'),
  item('a2', { fileName: 'padron-alta-bodega.csv', createdByName: 'Mariana Ortiz', counts: { total: 13, accepted: 12, rejected: 1, created: null, updated: null, unchanged: null }, errors: errors.slice(0, 1), createdAt: '2026-10-14T16:00:00Z' }),
  item('f1', { status: 'failed', dryRun: true, fileName: 'padron-prueba.csv', counts: { total: 0, accepted: 0, rejected: 1, created: 0, updated: 0, unchanged: 0 }, manifestHash: null,
    errors: [{ row: 1, externalId: null, code: 'invalid_header', message: 'Los encabezados deben ser: external_id,display_name,employment_start,site_name.' }], createdAt: '2026-10-12T16:00:00Z' }),
]
const summary = { total: 44, active: 42, inactive: 2, withoutCard: 2, withoutSchedule: 0, bySchedule: [] }

function defaultServer({ path, method, body }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  if (method === 'POST' && url.pathname === '/imports/csv') {
    const form = body as FormData
    if (form.get('dryRun') === 'true') return answer({ ...pending, id: 'r9', fileName: (form.get('file') as File).name, createdByName: 'Mariana Ortiz', createdAt: '2026-11-09T18:00:00Z' })
    return answer({ ...pending, id: 'a9', status: 'applied', dryRun: false, reviewedImportId: form.get('reviewedImportId'), createdByName: 'Mariana Ortiz', createdAt: '2026-11-09T18:06:00Z' })
  }
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/schedules': return answer({ items: [], nextCursor: null })
    case '/employees/summary': return answer(summary)
    case '/imports': return answer({ items: history, nextCursor: null })
    case '/imports/r1': return answer(pending)
    case '/imports/a2': return answer(history[2])
    case '/imports/f1': return answer(history[3])
  }
  return Promise.reject(new ApiError(404, 'not_found', `Sin respuesta simulada para ${path}`))
}

let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
let phone = false
let location = ''
function Where() { const here = useLocation(); location = here.pathname + here.search; return null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-09T18:00:00Z') })
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  server.calls = []; server.pending = 0; server.handler = defaultServer; phone = false
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals() })

async function settle() {
  for (let quiet = 0, round = 0; quiet < 3; round++) {
    if (round > 300) throw new Error(`Quedaron ${server.pending} respuestas pendientes`)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    quiet = server.pending === 0 ? quiet + 1 : 0
  }
}
async function render(path = '/personal/importaciones', roles = ['admin_empresa']) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' } }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const text = () => document.body.textContent || ''
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const uploads = () => server.calls.filter(call => call.method === 'POST')
const form = (call: Call) => call.body as FormData
const rows = () => [...container.querySelectorAll('main table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const figures = () => [...(dialog()?.querySelectorAll('dl > div') || [])].map(item => `${item.querySelector('dd')?.textContent} ${item.querySelector('dt')?.textContent}`)
const csvFile = (rowsCount: number, name = 'padron-noviembre.csv') =>
  new File([['external_id,display_name,employment_start,site_name', ...Array.from({ length: rowsCount }, (_, index) => `E-${index},"Apellido, Nombre",2026-01-05,`)].join('\n') + '\n'], name, { type: 'text/csv' })
async function pick(file: File) {
  const input = document.querySelector<HTMLInputElement>('[aria-label="Archivo CSV"]')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  await settle()
}
async function follow(selector: string) {
  await act(async () => document.querySelector<HTMLElement>(selector)!.click())
  await settle()
}

it('el historial dice de cada archivo quién lo subió, cuándo, cuántas filas entraron y qué se puede hacer', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Personal y horarios')
  expect(container.querySelector('nav[aria-label="Personal y horarios"] a[aria-current="page"]')?.textContent).toBe('Importaciones')
  expect(text()).toContain('Cada archivo se revisa antes de aplicarse; nada cambia hasta que alguien lo aplica.')
  expect(rows()).toEqual([
    ['padron-noviembre.csv', 'Rocío Navarro', 'hoy 11:02', '48', '45', '3', 'Revisado, sin aplicar', 'Revisar y aplicar'],
    ['padron-octubre.csv', 'Rocío Navarro', 'lun 19 oct', '44', '44', '0', 'Aplicado', 'Ver huella'],
    ['padron-alta-bodega.csv', 'Mariana Ortiz', 'mié 14 oct', '13', '12', '1', 'Aplicado', 'Ver errores'],
    ['padron-prueba.csv', 'Rocío Navarro', 'lun 12 oct', '0', '0', '1', 'Falló', 'Ver errores'],
  ])
  expect(text()).toContain('4 importaciones')
  expect(server.calls.find(call => call.path.startsWith('/imports?'))?.path).toBe('/imports?limit=25')
})

it('sube un archivo, lo revisa sin cambiar nada y aplica sólo las filas listas, cada paso con su clave', async () => {
  await render('/personal')
  await follow('a[href="/personal/importaciones?importar=archivo"]')
  expect(location).toBe('/personal/importaciones?importar=archivo')
  expect(dialog()?.querySelector('h2')?.textContent).toBe('Importar el padrón')
  expect(dialog()?.querySelector('[aria-current="step"]')?.textContent).toBe('1Subir archivo')
  expect(button('Revisar archivo')?.disabled).toBe(true)
  expect(dialog()?.querySelector('a[href="/plantilla-empleados.csv"]')?.textContent).toBe('Descargar la plantilla')

  await pick(csvFile(48))
  expect(dialog()?.textContent).toContain('padron-noviembre.csv · 48 filas ·')
  expect(uploads()).toHaveLength(0)
  await click('Revisar archivo'); await settle()
  expect(form(uploads()[0]).get('dryRun')).toBe('true')
  expect((form(uploads()[0]).get('file') as File).name).toBe('padron-noviembre.csv')
  expect(form(uploads()[0]).get('reviewedImportId')).toBeNull()

  // Revisar: cuántas filas entran y por qué no entran las demás.
  expect(dialog()?.querySelector('[aria-current="step"]')?.textContent).toBe('2Revisar')
  expect(figures()).toEqual(['48 filas', '45 listas para aplicar', '3 con error'])
  expect([...dialog()!.querySelectorAll('table tbody tr')].map(row => row.textContent)).toEqual(['120219No hay una sede activa con ese nombre.', '270187La fecha de inicio debe ser AAAA-MM-DD.', '40—Falta el identificador externo.'])
  expect(dialog()?.textContent).toContain('Las filas con error no se aplican. Corrígelas y vuelve a subir el archivo, o aplica sólo las 45 listas.')

  await click('Aplicar 45 filas'); await settle()
  const apply = uploads()[1]
  expect([form(apply).get('dryRun'), form(apply).get('reviewedImportId')]).toEqual(['false', 'r9'])
  expect(form(apply).get('file')).toBe(form(uploads()[0]).get('file'))
  expect(apply.key).not.toBe(uploads()[0].key)

  // Aplicado: qué hizo cada fila en el padrón y la huella.
  expect(dialog()?.querySelector('[aria-current="step"]')).toBeNull()
  expect(dialog()?.textContent).toContain('Se aplicaron 45 filas')
  expect(dialog()?.textContent).toContain('hoy 12:06 · por Mariana Ortiz')
  expect(figures()).toEqual(['4 altas', '2 con cambios', '39 sin cambios', '3 fuera por error'])
  expect(dialog()?.querySelector('code')?.textContent).toBe('8c1e 52d0 … 9f17 44a0')
  expect(button('Descargar errores')).toBeDefined()
  expect(server.calls.filter(call => call.path === '/imports?limit=25').length).toBeGreaterThan(1)

  await click('Listo'); await settle()
  expect(dialog()).toBeNull()
  expect(location).toBe('/personal/importaciones')
})

it('si se pierde la respuesta, reintentar manda el mismo archivo con la misma clave', async () => {
  await render('/personal/importaciones?importar=archivo')
  await pick(csvFile(3)); await click('Revisar archivo'); await settle()
  server.handler = call => call.method === 'POST' ? Promise.reject(new ApiError(503, 'unavailable', 'Respuesta perdida')) : defaultServer(call)
  await click('Aplicar 45 filas'); await settle()
  expect(dialog()?.textContent).toContain('Respuesta perdida')
  expect(dialog()?.textContent).toContain('no se aplica dos veces')
  server.handler = defaultServer
  await click('Aplicar 45 filas'); await settle()
  const [, lost, retried] = uploads()
  expect(retried.key).toBe(lost.key)
  expect(form(retried).get('file')).toBe(form(lost).get('file'))
  expect(dialog()?.textContent).toContain('Se aplicaron 45 filas')
})

it('subir otro archivo vuelve al primer paso y estrena claves', async () => {
  await render('/personal/importaciones?importar=archivo')
  await pick(csvFile(3)); await click('Revisar archivo'); await settle()
  await click('Subir otro archivo')
  expect(dialog()?.querySelector('[aria-current="step"]')?.textContent).toBe('1Subir archivo')
  await pick(csvFile(5, 'otro.csv')); await click('Revisar archivo'); await settle()
  expect(uploads()[1].key).not.toBe(uploads()[0].key)
  expect((form(uploads()[1]).get('file') as File).name).toBe('otro.csv')
})

it('una revisión del historial se aplica eligiendo otra vez el mismo archivo', async () => {
  await render()
  await follow('a[aria-label="Revisar y aplicar: padron-noviembre.csv"]')
  expect(location).toBe('/personal/importaciones?importar=r1')
  expect(dialog()?.querySelector('p')?.textContent).toBe('padron-noviembre.csv')
  expect(figures()).toEqual(['48 filas', '45 listas para aplicar', '3 con error'])
  expect(dialog()?.textContent).toContain('Elige otra vez padron-noviembre.csv')
  expect(button('Aplicar 45 filas')?.disabled).toBe(true)

  server.handler = call => call.method === 'POST' ? Promise.reject(new ApiError(409, 'review_mismatch', 'El archivo no es el que se revisó.')) : defaultServer(call)
  await pick(csvFile(48, 'padron-noviembre (1).csv'))
  expect(dialog()?.textContent).toContain('padron-noviembre (1).csv · 48 filas')
  await click('Aplicar 45 filas'); await settle()
  expect([form(uploads()[0]).get('dryRun'), form(uploads()[0]).get('reviewedImportId')]).toEqual(['false', 'r1'])
  expect(dialog()?.textContent).toContain('Ese no es el archivo que se revisó')
  expect(dialog()?.textContent).not.toContain('no se aplica dos veces')

  server.handler = defaultServer
  await click('Quitar')
  await pick(csvFile(48))
  await click('Aplicar 45 filas'); await settle()
  expect(uploads()[1].key).not.toBe(uploads()[0].key)
  expect(dialog()?.textContent).toContain('Se aplicaron 45 filas')
})

it('un archivo que no es la plantilla no se aplica y lo dice', async () => {
  await render()
  await follow('a[aria-label="Ver errores: padron-prueba.csv"]')
  expect(dialog()?.textContent).toContain('El archivo no se puede aplicar: no entró ninguna fila. Los encabezados deben ser')
  expect([...dialog()!.querySelectorAll('button')].map(item => item.textContent)).toEqual(['', 'Subir otro archivo', 'Cerrar'])
})

it('una importación aplicada antes del desglose muestra lo que se sabe', async () => {
  await render('/personal/importaciones?importar=a2')
  expect(figures()).toEqual(['12 aplicadas', '1 fuera por error'])
  expect(dialog()?.textContent).toContain('Se aplicaron 12 filas')
  expect(dialog()?.textContent).toContain('mié 14 oct · por Mariana Ortiz')
})

it.each([0, 1024 * 1024 + 1])('rechaza un archivo de %s bytes antes de enviarlo', async size => {
  await render('/personal/importaciones?importar=archivo')
  await pick(new File(['x'.repeat(size)], 'grande.csv', { type: 'text/csv' }))
  expect(dialog()?.textContent).toContain('Elige un archivo con contenido, de hasta 1 MB.')
  expect(button('Revisar archivo')?.disabled).toBe(true)
  expect(uploads()).toHaveLength(0)
})

it('RH también importa; sin historial invita a subir el primero', async () => {
  server.handler = call => call.path.startsWith('/imports?') ? Promise.resolve({ items: [], nextCursor: null }) : defaultServer(call)
  await render('/personal/importaciones', ['rh'])
  expect(text()).toContain('Todavía no hay importaciones')
  await click('Importar CSV'); await settle()
  expect(location).toBe('/personal/importaciones?importar=archivo')
})

it('en el teléfono cada importación es una tarjeta con su acción', async () => {
  phone = true
  await render()
  const cards = [...container.querySelectorAll('section[aria-label="Importaciones"] li')]
  expect(cards).toHaveLength(4)
  expect(cards[0].textContent).toBe('padron-noviembre.csvRevisado, sin aplicarRocío Navarro · hoy 11:02 · 48 filas · 45 listas · 3 con errorRevisar y aplicar')
  expect(container.querySelector('main table')).toBeNull()
})

it('cumple las reglas automáticas de accesibilidad en el historial y en cada paso', async () => {
  await render()
  expect(await accessibilityViolations()).toEqual([])
  await render('/personal/importaciones?importar=archivo')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/personal/importaciones?importar=r1')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/personal/importaciones?importar=a2')
  expect(await accessibilityViolations(document.body)).toEqual([])
}, 20_000)
