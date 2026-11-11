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
import { ApiError, type Card, type Device, type Me } from './api'
import type { CardDetail } from './devicesModel'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { click, setInput, waitFor } from './testUi'

const device = (id: string, extra: Partial<Device> = {}): Device => ({
  id, mode: 'terminal', status: 'active', employeeId: null, employeeName: null, siteId: 's1', label: 'Terminal Recepción', model: 'SM-T220', appVersion: '1.4.0',
  enrolledAt: '2026-10-12T16:00:00Z', lastSeenAt: '2026-11-10T16:41:00Z', revokedAt: null, ...extra,
})
const devices = [
  device('d1'),
  device('d2', { siteId: 's2', label: 'Terminal Bodega Norte', lastSeenAt: '2026-11-09T14:42:00Z', enrolledAt: '2026-10-14T16:00:00Z' }),
  device('d3', { mode: 'personal', siteId: null, employeeId: 'e1', employeeName: 'Hugo Peña', label: null, model: 'SM-S928B', lastSeenAt: '2026-11-10T14:42:00Z', enrolledAt: '2026-10-20T16:00:00Z' }),
]
const card = (id: string, label: string, extra: Partial<Card> = {}): Card => ({
  id, label, status: 'active', keyVersion: null, technology: 'manual', createdAt: '2026-09-01T16:00:00Z', updatedAt: '2026-09-02T16:00:00Z',
  assignment: { employeeId: 'e2', employeeName: 'Paola Ruiz', employeeExternalId: '0211', since: '2026-09-02T15:00:00Z' },
  latestAssignment: { employeeId: 'e2', employeeName: 'Paola Ruiz', employeeExternalId: '0211', since: '2026-09-02T15:00:00Z', until: null }, ...extra,
})
const cards = [
  card('c1', 'T-0058'),
  card('c2', 'T-0019', { status: 'lost', keyVersion: 1, technology: 'mifare_classic_signed', assignment: null, latestAssignment: { employeeId: 'e3', employeeName: 'Luis Hernández', employeeExternalId: '0114', since: '2026-09-01T15:00:00Z', until: '2026-10-22T17:00:00Z' } }),
  card('c3', 'T-0061', { status: 'inventory', assignment: null, latestAssignment: null, createdAt: '2026-09-01T16:00:00Z' }),
]
const detail: CardDetail = {
  ...cards[0], registeredBy: { type: 'user', name: 'Rocío Navarro' },
  assignments: [{ employeeId: 'e2', employeeName: 'Paola Ruiz', employeeExternalId: '0211', since: '2026-09-02T15:00:00Z', until: null, replacedCardId: null }],
  lastRead: { observedAt: '2026-11-10T14:59:00Z', deviceId: 'd1', deviceName: 'Terminal Recepción' }, readCount: 42,
}
const people = [{ id: 'e9', displayName: 'Andrea Lozano', externalId: '0215', status: 'active', siteId: 's2', employmentStart: '2026-11-01', employmentEnd: null, source: 'manual' }]

function defaultServer({ path, method }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  if (method === 'POST') {
    if (url.pathname === '/device-enrollments') return answer({ id: 'n1', mode: 'terminal', employeeId: null, siteId: 's2', label: 'Terminal Andén 3', code: '7K4QP-2X9AB', status: 'pending', expiresAt: '2026-11-10T17:12:00Z', createdAt: '2026-11-10T16:42:00Z' })
    if (url.pathname === '/cards') return answer(card('c9', 'T-0063', { status: 'inventory', assignment: null, latestAssignment: null }))
    return answer({})
  }
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/sites': return answer({ items: [{ id: 's1', name: 'Matriz Centro', status: 'active', timeZone: 'America/Mexico_City' }, { id: 's2', name: 'Bodega Norte', status: 'active', timeZone: 'America/Mexico_City' }], nextCursor: null })
    case '/devices/summary': return answer({ active: 3, silent: 1, revoked: 2, replaced: 1 })
    case '/devices': return answer({ items: url.searchParams.get('silent') ? [devices[1]] : devices, nextCursor: null })
    case '/cards/summary': return answer({ total: 62, byStatus: { inventory: 12, assigned: 0, active: 40, lost: 3, damaged: 1, revoked: 4, replaced: 2 } })
    case '/cards': return answer({ items: url.searchParams.get('status') === 'inventory' ? [cards[2]] : cards, nextCursor: null })
    case '/cards/c1': return answer(detail)
    case '/cards/c3': return answer({ ...cards[2], registeredBy: { type: 'device', name: 'Terminal Recepción' }, assignments: [], lastRead: null, readCount: 0 })
    case '/employees': return answer({ items: people, nextCursor: null })
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
async function render(path = '/dispositivos', roles = ['admin_empresa']) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' } }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const text = () => document.body.textContent || ''
const rows = () => [...container.querySelectorAll('main table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const posts = () => server.calls.filter(call => call.method === 'POST')
/** La ficha lateral abierta, por su título. */
const sheet = (title: string) => [...document.querySelectorAll('h2')].find(item => item.textContent === title)!.closest('section')!
const facts = (title: string) => [...sheet(title).querySelectorAll('dl dt')].map(item => `${item.textContent}: ${item.nextElementSibling?.textContent}`)
const chip = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Estado"] button')].find(item => item.textContent?.startsWith(label))!

it('Lectores muestra cada lector con su tipo, sede o persona, app y última señal', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Dispositivos y tarjetas · los teléfonos que leen las tarjetas y las tarjetas de tu personal')
  expect(container.querySelector('nav[aria-label="Dispositivos y tarjetas"]')?.textContent).toBe('Lectores · 3Tarjetas · 62')
  expect([...container.querySelectorAll('[role="group"][aria-label="Estado"] button')].map(item => item.textContent)).toEqual(['Activos · 3', 'Sin señal más de 24 h · 1', 'Revocados o reemplazados · 3'])
  expect(rows()).toEqual([
    ['Terminal RecepciónSM-T220 · activado 12 oct', 'Terminal de sede', 'Matriz Centro', '1.4.0', 'hace 1 min', 'Revocar'],
    ['Terminal Bodega NorteSM-T220 · activado 14 oct', 'Terminal de sede', 'Bodega Norte', '1.4.0', 'hace 26 h', 'Revocar'],
    ['Teléfono de Hugo PeñaSM-S928B · activado 20 oct', 'Teléfono personal', 'Hugo Peña', '1.4.0', 'hace 2 h', 'Revocar'],
  ])
  expect(server.calls.find(call => call.path.startsWith('/devices?'))?.path).toBe('/devices?limit=25&status=active')
  expect(text()).toContain('Revocar es inmediato: el lector deja de autenticarse')
})

it('las pestañas y la búsqueda de Lectores se piden al servidor', async () => {
  await render()
  await act(async () => chip('Sin señal').click()); await settle()
  expect(location).toBe('/dispositivos?estado=sin-senal')
  expect(server.calls.at(-1)?.path).toContain('status=active&silent=true')
  expect(rows()).toHaveLength(1)
  await act(async () => chip('Revocados').click()); await settle()
  expect(server.calls.some(call => call.path === '/devices?limit=25&status=revoked&status=replaced')).toBe(true)
  await setInput('q', 'bodega')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) }); await settle()
  expect(server.calls.some(call => call.path === '/devices?limit=25&status=revoked&status=replaced&q=bodega')).toBe(true)
})

it('revocar un lector pide el motivo y lo manda al servidor', async () => {
  await render()
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Revocar Terminal Bodega Norte"]')!.click())
  await settle()
  expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Revocar Terminal Bodega Norte')
  await setInput('reason', 'Se dañó la pantalla')
  await click('Revocar')
  await settle()
  expect(posts()).toEqual([{ path: '/devices/d2/revocation', method: 'POST', body: { reason: 'Se dañó la pantalla' }, key: undefined }])
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('activar un lector genera un código de un solo uso para una terminal de sede', async () => {
  await render('/dispositivos?activar=1')
  expect(text()).toContain('Activar un lector')
  const siteSelect = document.querySelector<HTMLElement>('input[name="siteId"]')!.parentElement!.querySelector('[role="combobox"]')!
  await act(async () => siteSelect.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })))
  await waitFor(() => [...document.querySelectorAll('[role="option"]')].some(option => option.textContent === 'Bodega Norte'))
  await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent === 'Bodega Norte')!.click())
  await setInput('label', 'Terminal Andén 3')
  await click('Generar código'); await settle()
  expect(posts()[0]).toMatchObject({ path: '/device-enrollments', body: { mode: 'terminal', siteId: 's2', label: 'Terminal Andén 3' } })
  expect(text()).toContain('7K4QP-2X9AB')
  expect(text()).toContain('Se muestra una sola vez · vence a las 11:12')
  expect(text()).toContain('El teléfono queda ligado a Bodega Norte.')
  await click('Generar otro código'); await settle()
  expect(text()).not.toContain('7K4QP-2X9AB')
})

it('un teléfono personal se activa para una persona del padrón', async () => {
  await render('/dispositivos?activar=1')
  await act(async () => document.querySelector<HTMLElement>('[role="radio"][aria-checked="false"]')!.click())
  await settle()
  await click('Andrea Lozano0215'); await settle()
  await click('Generar código'); await settle()
  expect(posts()[0]).toMatchObject({ path: '/device-enrollments', body: { mode: 'personal', employeeId: 'e9' } })
})

it('Tarjetas tiene pestañas por estado con sus cifras y dice quién tiene cada una', async () => {
  await render('/dispositivos/tarjetas')
  expect(container.querySelector('nav[aria-label="Dispositivos y tarjetas"] a[aria-current="page"]')?.textContent).toBe('Tarjetas · 62')
  expect([...container.querySelectorAll('nav[aria-label="Estado de las tarjetas"] a')].map(item => item.textContent))
    .toEqual(['Todas · 62', 'Activas · 40', 'En inventario · 12', 'Perdidas o dañadas · 4', 'Revocadas · 4', 'Reemplazadas · 2'])
  expect(rows()).toEqual([
    ['T-0058', 'Activa', 'Huella manual', 'Paola Ruiz · 0211', '2 sep'],
    ['T-0019', 'Perdida', 'MIFARE Classic firmada', 'Antes: Luis Hernández', '22 oct'],
    ['T-0061', 'En inventario', 'Huella manual', '—', '1 sep'],
  ])
  await act(async () => [...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Estado de las tarjetas"] a')].find(item => item.textContent?.startsWith('Perdidas'))!.click())
  await settle()
  expect(server.calls.some(call => call.path === '/cards?limit=25&status=lost&status=damaged')).toBe(true)
})

it('el detalle de una tarjeta dice quién la registró, su última lectura y su historial', async () => {
  await render('/dispositivos/tarjetas?tarjeta=c1')
  expect(facts('T-0058')).toEqual([
    'Asignada a: Paola Ruiz · 0211', 'Desde: 2 sep 2026', 'Tecnología: Huella manual', 'Registrada: 1 sep 2026 · Rocío Navarro', 'Lecturas: 42 · la última hoy 08:59 · Terminal Recepción',
  ])
  expect([...sheet('T-0058').querySelectorAll('ol li')].map(item => item.textContent)).toEqual(['Asignada a Paola Ruiz2 sep 2026', 'Registrada en inventario1 sep 2026 · Rocío Navarro'])
  expect([...sheet('T-0058').querySelectorAll('button')].map(item => item.textContent)).toEqual(expect.arrayContaining(['Reponer con otra del inventario', 'Revocar']))
  expect([...sheet('T-0058').querySelectorAll('button')].some(item => item.textContent === 'Asignar')).toBe(false)
})

it('un clic en cualquier parte de la fila abre el detalle de la tarjeta', async () => {
  await render('/dispositivos/tarjetas')
  const row = [...container.querySelectorAll('main table tbody tr')].find(item => item.textContent?.includes('T-0058'))!
  await act(async () => (row.querySelectorAll('td')[1] as HTMLElement).click())
  await settle()
  expect(facts('T-0058')[0]).toBe('Asignada a: Paola Ruiz · 0211')
})

it('revocar una tarjeta pide el motivo; reponerla pasa otra del inventario a la misma persona', async () => {
  await render('/dispositivos/tarjetas?tarjeta=c1')
  await click('Revocar')
  expect(text()).toContain('Una tarjeta revocada no vuelve a funcionar; para reponerla asigna otra del inventario.')
  await click('Revocar'); await settle()
  expect(posts()[0]).toEqual({ path: '/cards/c1/revocation', method: 'POST', body: { reason: 'lost' }, key: undefined })

  await render('/dispositivos/tarjetas?tarjeta=c1')
  server.calls = []
  await click('Reponer con otra del inventario'); await settle()
  const select = document.querySelector<HTMLElement>('input[name="replacementId"]')!.parentElement!.querySelector('[role="combobox"]')!
  await act(async () => select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })))
  await waitFor(() => [...document.querySelectorAll('[role="option"]')].some(option => option.textContent === 'T-0061'))
  await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent === 'T-0061')!.click())
  await click('Reponer'); await settle()
  expect(posts()).toEqual([{ path: '/cards/c3/assignments', method: 'POST', body: { employeeId: 'e2' }, key: undefined }])
})

it('una tarjeta en inventario se asigna a quien no tiene; la registrada por una terminal lo dice', async () => {
  await render('/dispositivos/tarjetas?tarjeta=c3')
  expect(facts('T-0061')).toContain('Registrada: 1 sep 2026 · Terminal Recepción')
  expect(facts('T-0061')).toContain('Lecturas: Todavía no se ha leído')
  await click('Asignar'); await settle()
  expect(server.calls.some(call => call.path.startsWith('/employees?') && call.path.includes('withoutCard=true') && call.path.includes('status=active'))).toBe(true)
  await click('Andrea Lozano0215 · sin tarjeta')
  await click('Asignar'); await settle()
  expect(posts()).toEqual([{ path: '/cards/c3/assignments', method: 'POST', body: { employeeId: 'e9' }, key: undefined }])
})

it('registrar una tarjeta valida la huella, la registra y la asigna si se pide', async () => {
  await render('/dispositivos/tarjetas?registrar=1')
  expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Registrar una tarjeta')
  await setInput('label', 'T-0063')
  await setInput('fingerprint', 'corta')
  await click('Registrar')
  expect(text()).toContain('La huella lleva de 16 a 128 caracteres.')
  expect(posts()).toHaveLength(0)
  await setInput('fingerprint', 'f3a9c1d0e2b4a6c8f3a9c1d0')
  await click('Andrea Lozano0215 · sin tarjeta')
  await click('Registrar'); await settle()
  expect(posts()).toEqual([
    { path: '/cards', method: 'POST', body: { label: 'T-0063', fingerprint: 'f3a9c1d0e2b4a6c8f3a9c1d0' }, key: undefined },
    { path: '/cards/c9/assignments', method: 'POST', body: { employeeId: 'e9' }, key: undefined },
  ])
  expect(location).toBe('/dispositivos/tarjetas?tarjeta=c9')
})

it('Auditoría consulta sin botones de escritura; Supervisión no ve la sección', async () => {
  await render('/dispositivos', ['auditor'])
  expect(rows()[0]).toHaveLength(5)
  expect(text()).not.toContain('Activar lector')
  expect(text()).not.toContain('Registrar tarjeta')
  await render('/dispositivos/tarjetas?tarjeta=c1', ['auditor'])
  expect(text()).toContain('Lecturas')
  expect([...document.querySelectorAll('button')].some(item => ['Revocar', 'Reponer con otra del inventario', 'Asignar'].includes(item.textContent || ''))).toBe(false)
  await render('/dispositivos/tarjetas', ['supervisor'])
  expect(text()).toContain('Esta sección no está disponible para tu rol')
})

it('en el teléfono cada lector y cada tarjeta es una tarjeta con su estado', async () => {
  phone = true
  await render()
  expect(container.querySelector('main table')).toBeNull()
  const items = [...container.querySelectorAll('main li')].map(item => item.textContent)
  expect(items[0]).toBe('Terminal RecepciónTerminal de sede · Matriz Centro · app 1.4.0ActivoÚltima señal: hace 1 minRevocar')
  expect(items[1]).toContain('Sin señal')
  await render('/dispositivos/tarjetas')
  expect([...container.querySelectorAll('main li')].map(item => item.textContent)[0]).toBe('T-0058ActivaPaola Ruiz · 0211 · 2 sep')
})

it('cumple las reglas automáticas de accesibilidad en lectores, tarjetas, detalle y ventanas', async () => {
  await render()
  expect(await accessibilityViolations()).toEqual([])
  await render('/dispositivos?activar=1')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/dispositivos/tarjetas?tarjeta=c1')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/dispositivos/tarjetas?registrar=1')
  expect(await accessibilityViolations(document.body)).toEqual([])
}, 20_000)
