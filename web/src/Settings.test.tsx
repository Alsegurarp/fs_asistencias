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
// Leaflet no dibuja en jsdom: el mapa se reemplaza por su región, con un botón que simula arrastrar el punto.
vi.mock('./SiteMap', () => ({
  default: ({ label, onMove }: { label: string; onMove?: (lat: number, lng: number) => void }) =>
    <div role="region" aria-label={label}>{onMove && <button type="button" onClick={() => onMove(25.6866, -100.3161)}>Mover el punto</button>}</div>,
}))
import { ApiError, type Me, type Tenant } from './api'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { click, setInput, waitFor } from './testUi'
import { breakChangeStarts, ruleYears, shortDay } from './settingsModel'

const tenant: Tenant = {
  id: 't1', name: 'Empresa Demo', slug: 'empresa-demo', timeZone: 'America/Mexico_City', weekStartsOn: 'monday', breakPolicy: 'not_considered', status: 'active',
  createdAt: '2026-10-19T16:00:00Z', autoCloseAfterHours: null, breakPolicyChange: null,
}
const sites = [
  { id: 's1', name: 'Matriz Centro', timeZone: 'America/Mexico_City', latitude: 19.432608, longitude: -99.133209, radiusMeters: 120, status: 'active', createdAt: '2026-10-19T16:00:00Z', people: 29, terminals: 2 },
  { id: 's2', name: 'Bodega Norte', timeZone: 'America/Tijuana', latitude: 19.5, longitude: -99.2, radiusMeters: 200, status: 'inactive', createdAt: '2026-10-20T16:00:00Z', people: 0, terminals: 0 },
]
const ruleSets = [
  { id: 'r1', jurisdiction: 'MX-LFT', version: 2, validFrom: '2026-05-01', validTo: '2026-12-31', weeklyOrdinaryMaxMinutes: 2880,
    parameters: { weeklyOvertimeMaxMinutes: '540', dailyCombinedMaxMinutes: '720', dailyOvertimeMaxMinutes: '240', overtimeMaxDays: '4', dailyOrdinaryMaxMinutesDay: '480', dailyOrdinaryMaxMinutesNight: '420', dailyOrdinaryMaxMinutesMixed: '450' },
    sources: ['DOF, decreto del 1 de mayo de 2026: https://dof.gob.mx/nota'] },
  { id: 'r2', jurisdiction: 'MX-LFT', version: 1, validFrom: '2027-01-01', validTo: '2027-12-31', weeklyOrdinaryMaxMinutes: 2760, parameters: { weeklyOvertimeMaxMinutes: '540' } as Record<string, string>, sources: [] },
]
let current: Tenant = tenant

function defaultServer({ path, method, body }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  if (method === 'PATCH' && url.pathname === '/tenant') { current = { ...current, ...(body as Partial<Tenant>) }; return answer(current) }
  if (method === 'PATCH' && url.pathname.startsWith('/sites/')) return answer({ ...sites.find(site => url.pathname.endsWith(site.id)), ...(body as object) })
  if (method === 'POST' && url.pathname === '/sites') return answer({ ...sites[0], id: 's9', ...(body as object), people: 0, terminals: 0 })
  if (method === 'POST' && url.pathname === '/tenant/break-policy-changes') return answer({ id: 'b1', breakPolicy: 'marked', effectiveOn: '2026-11-30', effectiveAt: '2026-11-30T06:00:00Z', reason: 'x', scheduledAt: '2026-11-10T16:42:00Z' })
  if (method === 'POST') return answer({})
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/tenant': return answer(current)
    case '/sites': return answer({ items: sites, nextCursor: null })
    case '/employees/summary': return answer({ total: 44, active: 42, inactive: 2, withoutCard: 0, withoutSchedule: 0, bySchedule: [] })
    case '/devices/summary': return answer({ active: 6, silent: 0, revoked: 0, replaced: 0 })
    case '/rule-sets': return answer({ items: ruleSets })
    case '/incidents/summary': return answer({ open: { total: 0 } })
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
  server.calls = []; server.pending = 0; server.handler = defaultServer; phone = false; current = tenant
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
async function render(path = '/configuracion', roles = ['admin_empresa']) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' } }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
  await waitFor(() => !document.querySelector('[role="status"]')?.textContent?.startsWith('Cargando el mapa'))
}
const text = () => document.body.textContent || ''
const rows = () => [...container.querySelectorAll('main table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const requests = (method: string) => server.calls.filter(call => call.method === method)
const field = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!
const sheet = (title: string) => [...document.querySelectorAll('h2')].find(item => item.textContent === title)!.closest('section')!

it('la vista previa del cambio de comida usa la regla del servidor', () => {
  // Día 10: la siguiente quincena empieza el 16 (lunes) con 6 días de aviso; no alcanza y pasa a la del 1 de
  // diciembre, un martes, así que entra el lunes 7.
  expect(breakChangeStarts('2026-11-10', 'monday')).toBe('2026-12-07')
  expect(breakChangeStarts('2026-11-02', 'monday')).toBe('2026-11-16')
  expect(breakChangeStarts('2026-11-20', 'sunday')).toBe('2026-12-06')
  expect(shortDay('2026-11-16')).toBe('lun 16 nov')
  expect(ruleYears(ruleSets, '2026-11-10').map(item => [item.year, item.ordinary, item.overtime, item.current])).toEqual([[2026, '48 h', '9 h', true], [2027, '46 h', '9 h', false]])
})

it('muestra la empresa, sus políticas y las sedes con sus cifras', async () => {
  await render()
  expect(text()).toContain('2 sedes · 42 personas · 6 lectores · en Zenit desde el 19 oct')
  expect(text()).toContain('Hoy no se marca')
  expect(text()).toContain('2026: 48 h ordinarias y hasta 9 h extra por semana')
  expect(rows()).toEqual([
    ['Matriz Centro', 'Círculo de 120 m', 'Ciudad de México', '2', '29', 'Activa', 'Editar'],
    ['Bodega Norte', 'Círculo de 200 m', 'Tijuana', '0', '0', 'Inactiva', 'Editar'],
  ])
  expect(container.querySelector('[role="region"][aria-label="Mapa de las sedes"]')).not.toBeNull()
})

it('guarda sólo lo que cambió de la empresa y manda null al dejar el cierre vacío', async () => {
  current = { ...tenant, autoCloseAfterHours: 48 }
  await render()
  await setInput('name', 'Empresa Demo Local')
  await setInput('autoCloseAfterHours', '')
  await click('Guardar')
  await settle()
  expect(requests('PATCH')).toEqual([expect.objectContaining({ path: '/tenant', body: { name: 'Empresa Demo Local', autoCloseAfterHours: null } })])
  expect(text()).toContain('Guardado')
})

it('no deja guardar un cierre fuera de 1 a 168 horas', async () => {
  await render()
  await setInput('autoCloseAfterHours', '200')
  await click('Guardar')
  expect(text()).toContain('De 1 a 168 horas, sin decimales.')
  expect(requests('PATCH')).toEqual([])
})

it('una fila abre la sede; arrastrar el punto cambia latitud y longitud y se guarda sólo eso', async () => {
  await render()
  const row = [...container.querySelectorAll('main table tbody tr')][0]
  await act(async () => (row.querySelectorAll('td')[2] as HTMLElement).click())
  await settle()
  expect(location).toBe('/configuracion?sede=s1')
  await click('Mover el punto')
  expect(field('latitude').value).toBe('25.6866')
  await click('Guardar')
  await settle()
  expect(requests('PATCH')).toEqual([expect.objectContaining({ path: '/sites/s1', body: { latitude: 25.6866, longitude: -100.3161 } })])
})

it('agregar una sede revisa los campos antes de mandarla', async () => {
  await render('/configuracion?sede=nueva')
  await setInput('radiusMeters', '5')
  await click('Agregar sede')
  expect(text()).toContain('Escribe el nombre de la sede.')
  expect(text()).toContain('De 20 a 2000 metros, sin decimales.')
  await setInput('siteName', 'Andén 3')
  await setInput('radiusMeters', '150')
  await click('Agregar sede')
  await settle()
  expect(requests('POST').at(-1)).toMatchObject({ path: '/sites', body: { name: 'Andén 3', radiusMeters: 150, timeZone: 'America/Mexico_City' } })
  expect(location).toBe('/configuracion?sede=s9')
})

it('el interruptor «Sede activa» la desactiva en el acto; una inactiva se reactiva', async () => {
  await render('/configuracion?sede=s1')
  const toggle = () => act(async () => { (document.querySelector('input[aria-label="Sede activa"]') as HTMLInputElement).click() })
  expect((document.querySelector('input[aria-label="Sede activa"]') as HTMLInputElement).checked).toBe(true)
  await toggle()
  await settle()
  expect(requests('PATCH').at(-1)).toMatchObject({ path: '/sites/s1', body: { status: 'inactive' } })
  await render('/configuracion?sede=s2')
  expect(sheet('Bodega Norte').textContent).toContain('Inactiva')
  expect((document.querySelector('input[aria-label="Sede activa"]') as HTMLInputElement).checked).toBe(false)
  await toggle()
  await settle()
  expect(requests('PATCH').at(-1)).toMatchObject({ path: '/sites/s2', body: { status: 'active' } })
})

it('programa un cambio de comida con motivo y cancela el pendiente', async () => {
  await render('/configuracion?comida=1')
  await click('Programar un cambio')
  expect(text()).toContain('Entraría el lun 7 dic 2026')
  await click('Programar cambio')
  expect(text()).toContain('Escribe al menos 10 caracteres.')
  await setInput('reason', 'Registrar la salida a comer en ambas sedes.')
  await click('Programar cambio')
  await settle()
  expect(requests('POST').at(-1)).toMatchObject({ path: '/tenant/break-policy-changes', body: { breakPolicy: 'marked', reason: 'Registrar la salida a comer en ambas sedes.' } })

  current = { ...tenant, breakPolicyChange: { id: 'b1', breakPolicy: 'marked', effectiveOn: '2026-12-07', effectiveAt: '2026-12-07T06:00:00Z', reason: 'Registrar la salida a comer.', scheduledAt: '2026-11-10T16:42:00Z' } }
  await render('/configuracion?comida=1')
  expect(text()).toContain('Desde el lun 7 dic 2026')
  expect(field('weekStartsOn').closest('.MuiInputBase-root')?.className).toContain('Mui-disabled')
  await click('Cancelar el cambio')
  await settle()
  expect(requests('POST').at(-1)).toMatchObject({ path: '/tenant/break-policy-changes/b1/cancellation' })
})

it('las reglas laborales se consultan por año, con las reglas por día y la fuente', async () => {
  await render('/configuracion?reglas=1')
  expect(text()).toContain('2026 · vigente48 h9 h')
  expect(text()).toContain('Máximo 12 h en un día, sumando ordinarias y extra.')
  expect(text()).toContain('Extra: hasta 4 h al día y en no más de 4 días por semana.')
  expect(document.querySelector('a[href="https://dof.gob.mx/nota"]')?.textContent).toBe('DOF, decreto del 1 de mayo de 2026')
})

it('Auditoría consulta sin poder cambiar; la dirección vieja de sedes lleva a Configuración', async () => {
  await render('/configuracion', ['auditor'])
  expect(field('name').disabled).toBe(true)
  expect([...document.querySelectorAll('button')].some(item => item.textContent === 'Guardar' || item.textContent === 'Agregar sede')).toBe(false)
  await render('/configuracion/sedes')
  expect(location).toBe('/configuracion')
})

it('en el teléfono cada sede es una tarjeta con sus cifras', async () => {
  phone = true
  await render()
  expect(container.querySelector('main table')).toBeNull()
  expect([...container.querySelectorAll('main li')].map(item => item.textContent)[0]).toBe('Matriz CentroActivaCírculo de 120 m · 2 terminales · 29 personas')
})

it('cumple las reglas automáticas de accesibilidad en la pantalla, la sede y las ventanas', async () => {
  await render()
  expect(await accessibilityViolations()).toEqual([])
  await render('/configuracion?sede=s1')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/configuracion?comida=1')
  expect(await accessibilityViolations(document.body)).toEqual([])
  await render('/configuracion?reglas=1')
  expect(await accessibilityViolations(document.body)).toEqual([])
}, 20_000)
