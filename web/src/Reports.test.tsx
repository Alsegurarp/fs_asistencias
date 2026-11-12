// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown; key?: string }
const server = vi.hoisted(() => ({ calls: [] as Call[], pending: 0, handler: (call: Call): Promise<unknown> => new Promise(() => call) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn(), tokenParsed: { sub: 'kc-self' } }, identityBase: 'http://localhost:8082' }))
vi.mock('./files', () => ({ saveFile: vi.fn() }))
vi.mock('./api', async original => {
  const track = (path: string, method: string, body?: unknown, key?: string) => {
    const call = { path, method, body, key }
    server.calls.push(call); server.pending++
    const answer = server.handler(call)
    const done = () => { server.pending-- }
    answer.then(done, done)
    return answer
  }
  return {
    ...await original<typeof import('./api')>(),
    api: vi.fn((path: string, method = 'GET', body?: unknown, key?: string) => track(path, method, body, key)),
    apiDownload: vi.fn((path: string) => track(path, 'DOWNLOAD').then(() => ({ blob: new Blob(['x']), filename: 'zenit.csv' }))),
  }
})
import { ApiError, type Me } from './api'
import { saveFile } from './files'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { click, waitFor } from './testUi'
import { groupBySite, hoursText, whenText } from './reportsModel'
import type { Closure } from './closureModel'

const closure = (id: string, externalId: string, name: string, ordinary: number, overtime: number, ack: 'agreed' | 'objected' | null): Closure => ({
  id, employeeId: `e-${id}`, employeeName: name, employeeExternalId: externalId, weekStart: '2026-10-26', version: 1, status: 'closed', ruleSet: { id: 'r1', version: 2 },
  totals: { workedMinutes: ordinary + overtime + 60, breakMinutes: 60, ordinaryMinutes: ordinary, overtimeMinutes: overtime }, hash: `hash-${id}-0123456789abcdef`,
  closedAt: '2026-11-02T08:00:00Z', closedBy: null, acknowledgement: ack ? { type: ack, note: null, at: '2026-11-02T10:00:00Z' } : null,
})
const closures = [closure('c1', '0187', 'Ana Torres', 2880, 255, 'agreed'), closure('c2', '0121', 'Carmen Vega', 2400, 0, 'objected'), closure('c3', '0300', 'Pedro Sin Sede', 600, 0, null)]
const siteOf: Record<string, string> = { c1: 's2', c2: 's1' }
const sites = [
  { id: 's1', name: 'Matriz Centro', timeZone: 'America/Mexico_City', latitude: 19.4, longitude: -99.1, radiusMeters: 120, status: 'active', people: 29, terminals: 2 },
  { id: 's2', name: 'Bodega Norte', timeZone: 'America/Mexico_City', latitude: 19.5, longitude: -99.2, radiusMeters: 200, status: 'active', people: 13, terminals: 1 },
]
const exportBase = { format: 'csv', timeZone: 'America/Mexico_City', ruleSetVersion: 2, manifestHash: null, downloadUrl: null, requestedBy: 'u1', downloadedBy: null, downloadedByName: null }
const exports = [
  { ...exportBase, id: 'x1', status: 'ready', weekStart: '2026-10-26', siteId: null, rowCount: 39, fileHash: 'f', expiresAt: '2026-11-10T16:55:00Z', createdAt: '2026-11-10T15:40:00Z', requestedByName: 'Rocío Navarro', downloadedAt: null },
  { ...exportBase, id: 'x2', status: 'queued', weekStart: '2026-10-26', siteId: 's2', rowCount: null, fileHash: null, expiresAt: null, createdAt: '2026-11-10T16:40:00Z', requestedByName: 'Hugo Peña', downloadedAt: null },
  { ...exportBase, id: 'x3', status: 'expired', weekStart: '2026-10-19', siteId: null, rowCount: 42, fileHash: 'f', expiresAt: null, createdAt: '2026-10-27T16:00:00Z', requestedByName: 'Rocío Navarro', downloadedAt: null },
  { ...exportBase, id: 'x4', status: 'failed', weekStart: '2026-10-12', siteId: null, rowCount: null, fileHash: null, expiresAt: null, createdAt: '2026-10-20T16:00:00Z', requestedByName: 'Rocío Navarro', downloadedAt: null },
]
let exportState: Record<string, unknown> = {}

function monday(date: string) { const day = new Date(`${date}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); return day.toISOString().slice(0, 10) }

function defaultServer({ path, method }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  if (method === 'POST' && url.pathname === '/exports') return answer({ ...exports[0], id: 'x9', status: 'queued', rowCount: null, fileHash: null, expiresAt: null })
  if (method === 'DOWNLOAD') return answer(undefined)
  const week = url.searchParams.get('week')
  const siteId = url.searchParams.get('siteId')
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/incidents/summary': return answer({ open: { total: 0 } })
    case '/sites': return answer({ items: sites, nextCursor: null })
    case '/tenant': return answer({ id: 't1', name: 'Empresa Demo', breakPolicy: 'not_considered', timeZone: 'America/Mexico_City' })
    case '/exports': return answer({ items: exports, nextCursor: null })
    case '/exports/x9': return answer({ ...exports[0], id: 'x9', ...exportState })
    case '/week-closures/summary': {
      const start = monday(week!)
      const closed = start === '2026-10-26' ? (siteId ? closures.filter(item => siteOf[item.id] === siteId).length : 3) : start === '2026-11-02' ? 0 : 40
      return answer({ weekStart: start, closed, reopened: 0, blocked: start === '2026-10-26' && !siteId ? 2 : 0, acknowledgements: { agreed: 1, objected: 1, none: 1 } })
    }
    case '/week-closures': {
      if (monday(week!) !== '2026-10-26') return answer({ items: [], nextCursor: null })
      return answer({ items: closures.filter(item => !siteId || siteOf[item.id] === siteId), nextCursor: null })
    }
    case '/incidents': return answer({ items: week && monday(week) === '2026-10-26' && !siteId ? [{ id: 'i1', type: 'missing_pair', employeeId: 'e9', employeeName: 'Teresa Lugo', siteId: 's2', openedAt: '2026-10-30T10:00:00Z', assigneeUserId: null }] : [], nextCursor: null })
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
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T16:42:00Z') })
  container = document.createElement('div'); container.id = 'root'; document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('print', vi.fn())
  window.localStorage.clear()
  server.calls = []; server.pending = 0; server.handler = defaultServer; phone = false; exportState = { status: 'queued' }
  vi.mocked(saveFile).mockClear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals() })

async function settle() {
  for (let quiet = 0, round = 0; quiet < 3; round++) {
    if (round > 150) throw new Error(`Quedaron ${server.pending} respuestas pendientes: ${server.calls.length} ${server.calls.slice(-6).map(c => c.method + ' ' + c.path).join(', ')}`)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    quiet = server.pending === 0 ? quiet + 1 : 0
  }
}
async function render(path = '/reportes', roles = ['rh']) {
  const me: Me = { userId: 'self', displayName: 'Rocío Navarro', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' }, employeeId: null }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const text = () => container.textContent || ''
const rows = (scope: ParentNode = container) => [...scope.querySelectorAll('table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const writes = () => server.calls.filter(call => call.method !== 'GET')
const sheet = () => document.querySelector('.zenit-print-root')!

it('suma horas y nombra cuándo se pidió', () => {
  expect(hoursText(106920)).toBe('1,782 h')
  expect(hoursText(2780)).toBe('46 h 20')
  const now = new Date('2026-11-10T16:42:00Z')
  expect(whenText('2026-11-10T16:40:00Z', 'America/Mexico_City', now)).toBe('hace 2 min')
  expect(whenText('2026-11-10T15:40:00Z', 'America/Mexico_City', now)).toBe('hoy 09:40')
  expect(whenText('2026-11-02T16:00:00Z', 'America/Mexico_City', now)).toBe('2 nov')
  const groups = groupBySite(closures, [{ id: 's1', name: 'Matriz Centro', rows: [closures[1]] }, { id: 's2', name: 'Bodega Norte', rows: [closures[0]] }], true)
  expect(groups.map(group => [group.name, group.rows.map(row => row.employeeName)])).toEqual([['Matriz Centro', ['Carmen Vega']], ['Bodega Norte', ['Ana Torres']], ['Sin sede', ['Pedro Sin Sede']]])
})

it('el inicio ofrece lo que el rol puede generar y lo generado hace poco', async () => {
  await render()
  expect(text()).toContain('¿Qué quieres generar?')
  expect(text()).toContain('Último: 26 oct – 1 nov · toda la empresa, hoy 09:40')
  expect(text()).toContain('Requiere permiso explícito')
  expect([...container.querySelectorAll('section[aria-label="Expediente de la empresa"] a')]).toHaveLength(0)
  expect(rows()).toEqual([
    ['Reporte para nómina', '26 oct – 1 nov · toda la empresa', 'Rocío Navarro', 'hoy 09:40', 'Listo', 'Vista previaDescargar'],
    ['Reporte para nómina', '26 oct – 1 nov · Bodega Norte', 'Hugo Peña', 'hace 2 min', 'En cola', ''],
    ['Reporte para nómina', '19 – 25 oct · toda la empresa', 'Rocío Navarro', '27 oct', 'Vencido', 'Vista previaPedir de nuevo'],
    ['Reporte para nómina', '12 – 18 oct · toda la empresa', 'Rocío Navarro', '20 oct', 'Falló', 'Vista previaReintentar'],
  ])
})

it('descargar uno listo lo guarda una vez; uno vencido se pide de nuevo', async () => {
  await render()
  await click('Descargar'); await settle()
  expect(writes()).toEqual([expect.objectContaining({ path: '/exports/x1/download', method: 'DOWNLOAD' })])
  expect(saveFile).toHaveBeenCalledOnce()
  await click('Pedir de nuevo'); await settle()
  expect(writes()[1]).toEqual(expect.objectContaining({ path: '/exports', method: 'POST', body: { weekStart: '2026-10-19', format: 'csv' } }))
})

it('el paso 1 elige la última semana con cierres y dice quién entra y quién no', async () => {
  await render('/reportes/nomina')
  const weeks = [...container.querySelectorAll('ul[aria-labelledby="semana"] button')].map(item => [item.textContent, item.getAttribute('aria-pressed'), (item as HTMLButtonElement).disabled])
  expect(weeks[0]).toEqual(['2 – 8 nov 2026sin cierres', 'false', true])
  expect(weeks[1]).toEqual(['26 oct – 1 nov 20263 cerradas · 2 bloqueadas', 'true', false])
  expect(text()).toContain('3personas incluidas')
  expect(text()).toContain('98 hordinarias')
  expect(text()).toContain('2bloqueadas, no entran')
  expect(rows()).toEqual([
    ['Matriz Centro', '29', '1', '0', '40 h', '0 h'],
    ['Bodega Norte', '13', '1', '1', '48 h', '4 h 15'],
  ])
  expect(text()).toContain('Teresa Lugo · Bodega NorteMarcaje faltante')
  expect(text()).toContain('Una persona más tiene un tramo abierto sin cerrar.')
  expect([...container.querySelectorAll<HTMLAnchorElement>('main a')].find(link => link.textContent === 'Resolver en Cierres')!.getAttribute('href')).toBe('/cierres?semana=2026-10-26&pestana=bloqueadas')
})

it('el paso 2 muestra las columnas elegidas agrupadas por sede', async () => {
  await render('/reportes/nomina?semana=2026-10-26&paso=2')
  expect(rows()).toEqual([
    ['Matriz Centro · 1 persona'], ['0121', 'Carmen Vega', '40:00', '0:00', '41:00', 'Objeción'],
    ['Bodega Norte · 1 persona'], ['0187', 'Ana Torres', '48:00', '4:15', '53:15', 'Conforme'],
    ['Sin sede · 1 persona'], ['0300', 'Pedro Sin Sede', '10:00', '0:00', '11:00', 'Sin acuse'],
  ])
  await act(async () => [...container.querySelectorAll<HTMLLabelElement>('label')].find(item => item.textContent?.startsWith('Agrupar por sede'))!.click())
  await act(async () => [...container.querySelectorAll<HTMLLabelElement>('label')].find(item => item.textContent?.startsWith('Acuse'))!.click())
  expect(rows()[0]).toEqual(['0121', 'Carmen Vega', '40:00', '0:00', '41:00'])
})

it('el paso 3 arma la hoja con subtotales y la imprime; el anexo lleva las huellas', async () => {
  await render('/reportes/nomina?semana=2026-10-26&paso=3')
  expect(sheet().textContent).toContain('Reporte de asistencia para nómina')
  expect(sheet().textContent).toContain('Semana 26 oct – 1 nov 2026 · Toda la empresa · reglas laborales, versión 2')
  expect(sheet().textContent).toContain('Generado por Rocío Navarro el 10 nov 2026, 10:42')
  expect(sheet().textContent).toContain('1 · 1 · 1conformes · objeción · sin acuse')
  expect(rows(sheet())).toContainEqual(['Subtotal Bodega Norte', '48:00', '4:15', '53:15', ''])
  expect(sheet().textContent).not.toContain('Anexo de huellas')
  await click('Descargar PDF')
  expect(window.print).toHaveBeenCalledOnce()
  await click('Anterior'); await settle()
  await act(async () => [...container.querySelectorAll<HTMLLabelElement>('label')].find(item => item.textContent?.startsWith('Anexo de huellas'))!.click())
  await click('Siguiente'); await settle()
  expect(sheet().textContent).toContain('hash-c1-0123456789abcdef')
})

it('el CSV oficial se pide al servidor, se espera y se descarga una vez', async () => {
  await render('/reportes/nomina?semana=2026-10-26&sede=s2&paso=3')
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Formato"] button')][1].click())
  expect(text()).toContain('Zenit prepara el CSV de 1 persona (Bodega Norte, 26 oct – 1 nov 2026)')
  await click('Preparar el CSV'); await settle()
  expect(writes()[0]).toEqual(expect.objectContaining({ path: '/exports', method: 'POST', body: { weekStart: '2026-10-26', format: 'csv', siteId: 's2' } }))
  expect(writes()[0].key).toMatch(/^[0-9a-f-]{36}$/)
  expect(text()).toContain('Preparando el CSV')
  exportState = { status: 'ready', rowCount: 1 }
  await act(async () => { await cache.refetchQueries({ queryKey: ['export', 'x9'] }) }); await settle()
  expect(text()).toContain('Listo: 1 fila, se puede descargar hasta las 10:55.')
  await click('Descargar CSV (una vez)'); await settle()
  expect(writes()[1]).toEqual(expect.objectContaining({ path: '/exports/x9/download' }))
  expect(saveFile).toHaveBeenCalledOnce()
})

it('Supervisión no genera reportes de nómina', async () => {
  await render('/reportes/nomina', ['supervisor'])
  expect(text()).toContain('Esta sección no está disponible para tu rol')
  expect(server.calls.some(call => call.path.startsWith('/week-closures'))).toBe(false)
})

it('cumple las reglas automáticas de accesibilidad en el inicio y en cada paso', { timeout: 30_000 }, async () => {
  await render()
  expect(await accessibilityViolations()).toEqual([])
  for (const step of ['1', '2', '3']) {
    await render(`/reportes/nomina?semana=2026-10-26&paso=${step}`)
    await waitFor(() => !text().includes('Cargando'))
    expect(await accessibilityViolations()).toEqual([])
  }
})
