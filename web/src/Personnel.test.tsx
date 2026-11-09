// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown }
const server = vi.hoisted(() => ({ calls: [] as Call[], pending: 0, handler: (call: Call): Promise<unknown> => new Promise(() => call) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() }, identityBase: 'http://localhost:8082' }))
vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  api: vi.fn((path: string, method = 'GET', body?: unknown) => {
    const call = { path, method, body }
    server.calls.push(call); server.pending++
    const answer = server.handler(call)
    const done = () => { server.pending-- }
    answer.then(done, done)
    return answer
  }),
}))
import { ApiError, type Me } from './api'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { click, setInput, waitFor } from './testUi'

const sites = [{ id: 's1', name: 'Matriz Centro', radiusMeters: 120, status: 'active' }, { id: 's2', name: 'Bodega Norte', radiusMeters: 80, status: 'active' }]
const weekdays = (start: string, end: string, breakMinutes: number) => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(dayOfWeek => ({ dayOfWeek, startTime: start, endTime: end, breakMinutes }))
const schedules = [
  { id: 'h1', name: 'Oficina L–V', timeZone: 'America/Mexico_City', validFrom: '2026-09-01', validTo: null, days: weekdays('09:00', '18:00', 60), createdAt: '' },
  { id: 'h2', name: 'Nocturno', timeZone: 'America/Mexico_City', validFrom: '2026-09-01', validTo: null, days: weekdays('22:00', '05:00', 30), createdAt: '' },
  { id: 'h0', name: 'Oficina L–V (anterior)', timeZone: 'America/Mexico_City', validFrom: '2026-01-01', validTo: '2026-08-31', days: weekdays('09:00', '18:30', 60), createdAt: '' },
]
const person = (id: string, displayName: string, externalId: string, extra: object = {}) => ({
  id, displayName, externalId, siteId: 's1', status: 'active', employmentStart: '2026-09-01', employmentEnd: null, source: 'csv', currentScheduleId: 'h1', activeCardId: 'c1', activeCardLabel: 'T-0058', ...extra,
})
const paola = person('e1', 'Paola Ruiz', '0211', { source: 'manual' })
const ana = person('e2', 'Ana Torres', '0187', { siteId: 's2', currentScheduleId: 'h2', activeCardLabel: 'T-0031' })
const marco = person('e3', 'Marco Ibarra', '0133', { activeCardId: null, activeCardLabel: null })
const andrea = person('e4', 'Andrea Lozano', '0215', { employmentStart: '2026-11-02', source: 'manual', activeCardId: null, activeCardLabel: null })
const summary = { total: 44, active: 42, inactive: 2, withoutCard: 2, withoutSchedule: 0, bySchedule: [{ scheduleId: 'h1', people: 24 }, { scheduleId: 'h2', people: 4 }] }

function defaultServer({ path, method, body }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  if (method === 'POST' && url.pathname === '/employees') return answer({ ...person('e9', (body as { displayName: string }).displayName, (body as { externalId: string }).externalId), source: 'manual', currentScheduleId: null, activeCardId: null, activeCardLabel: null })
  if (method === 'POST' && url.pathname.endsWith('/schedule-assignments')) return answer({ id: 'a9', employeeId: url.pathname.split('/')[2], scheduleId: (body as { scheduleId: string }).scheduleId, validFrom: (body as { validFrom: string }).validFrom, validTo: null })
  if (method === 'POST' && url.pathname.endsWith('/assignments')) return answer({})
  if (method === 'POST' && url.pathname === '/schedules') return answer({ id: 'h9', ...(body as object), validTo: null, createdAt: '' })
  if (method === 'PATCH') return answer({ ...paola, ...(body as object) })
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/sites': return answer({ items: sites, nextCursor: null })
    case '/schedules': return answer({ items: schedules, nextCursor: null })
    case '/employees/summary': return answer(summary)
    case '/employees': {
      if (url.searchParams.get('q') === 'and') return answer({ items: [andrea], nextCursor: null })
      return answer({ items: url.searchParams.get('withoutCard') ? [marco, andrea] : [paola, ana, marco, andrea], nextCursor: url.searchParams.get('withoutCard') ? null : 'c2' })
    }
    case '/employees/e1': return answer(paola)
    case '/employees/e7': return answer(person('e7', 'Teresa Lugo', '0300', { siteId: 's2', currentScheduleId: null, activeCardId: null, activeCardLabel: null }))
    case '/employees/e1/schedule-assignments': return answer({ items: [
      { id: 'a2', employeeId: 'e1', scheduleId: 'h1', validFrom: '2026-09-01', validTo: null },
      { id: 'a1', employeeId: 'e1', scheduleId: 'h0', validFrom: '2026-01-05', validTo: '2026-08-31' },
    ] })
    case '/employees/e7/schedule-assignments': return answer({ items: [] })
    case '/cards': return answer(url.searchParams.get('status') === 'inventory'
      ? { items: [{ id: 'c61', label: 'T-0061', status: 'inventory', assignment: null }], nextCursor: null }
      : { items: [{ id: 'c1', label: 'T-0058', status: 'active', assignment: { employeeId: 'e1', employeeName: 'Paola Ruiz', employeeExternalId: '0211', since: '2026-09-02T15:00:00Z' } }], nextCursor: null })
    case '/imports': return answer({ items: [{ fileName: 'padron-octubre.csv', status: 'applied', createdAt: '2026-10-19T16:00:00Z' }], nextCursor: null })
    case '/integrations/checkpoints': return answer({ items: [
      { sourceId: 'f1', type: 'csv', status: 'active', cursor: 'padron-octubre.csv · fila 44', sourceVersion: '1', updatedAt: '2026-10-19T16:00:00Z' },
      { sourceId: 'f2', type: 'api', status: 'paused', cursor: 'registro 1208', sourceVersion: '2', updatedAt: '2026-11-01T16:00:00Z' },
    ] })
    case '/audit-log': return answer({ items: [{ id: 'l1', at: '2026-10-29T16:00:00Z', action: 'employee.created', actor: { type: 'user', id: 'u', displayName: 'Rocío Navarro' }, target: { type: 'employee', id: 'e4', displayName: 'Andrea Lozano' }, metadata: {} }], nextCursor: null })
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
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
async function render(path = '/personal', roles = ['admin_empresa']) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' } }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const text = () => document.body.textContent || ''
const gets = (pathname: string) => server.calls.filter(call => call.method === 'GET' && call.path.split('?')[0] === pathname).map(call => call.path)
const writes = () => server.calls.filter(call => call.method !== 'GET').map(call => [call.method, call.path, call.body])
const rows = () => [...container.querySelectorAll('main table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const chip = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(item => item.textContent?.startsWith(label))!
const select = async (name: string, value: string) => {
  const element = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!
  await act(async () => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
  await settle()
}
async function chooseOption(name: string, label: string) {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
  const combo = input.parentElement!.querySelector('[role="combobox"]')!
  await act(async () => combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })))
  await waitFor(() => [...document.querySelectorAll('[role="option"]')].some(option => option.textContent?.includes(label)))
  await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent?.includes(label))!.click())
}

it('lista el padrón con su sede, horario, tarjeta, origen y estado, con las cifras de cada pestaña', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Personal y horarios')
  expect([...container.querySelectorAll('nav[aria-label="Personal y horarios"] a')].map(link => link.textContent)).toEqual(['Personas · 42', 'Horarios · 3', 'Importaciones', 'Fuentes del padrón'])
  expect(gets('/employees')).toContain('/employees?limit=25&status=active')
  expect(rows()).toEqual([
    ['Paola Ruiz 0211', 'Matriz Centro', 'Oficina L–V', 'T-0058', 'Manual', 'Activa'],
    ['Ana Torres 0187', 'Bodega Norte', 'Nocturno', 'T-0031', 'CSV', 'Activa'],
    ['Marco Ibarra 0133', 'Matriz Centro', 'Oficina L–V', 'Sin tarjeta', 'CSV', 'Activa'],
    ['Andrea Lozano 0215', 'Matriz Centro', 'Oficina L–V', 'Sin tarjeta', 'Manual', 'Alta reciente'],
  ])
  expect(text()).toContain('1–4 de 42 activas')
  expect(text()).toContain('Última importación: padron-octubre.csv · aplicada el lun 19 oct')
  expect([...container.querySelectorAll('button[aria-pressed]')].map(item => item.textContent)).toEqual(['Oficina L–V · 24', 'Nocturno · 4', 'Sin tarjeta · 2'])
})

it('filtra por horario, sin tarjeta, estado y búsqueda en el servidor, y lo deja en la dirección', async () => {
  await render()
  await act(async () => chip('Nocturno').click()); await settle()
  expect(location).toBe('/personal?horario=h2')
  expect(gets('/employees')).toContain('/employees?limit=25&status=active&scheduleId=h2')
  await act(async () => chip('Sin tarjeta').click()); await settle()
  expect(location).toBe('/personal?sin-tarjeta=1')
  expect(gets('/employees')).toContain('/employees?limit=25&status=active&withoutCard=true')
  expect(rows().map(row => row[0])).toEqual(['Marco Ibarra 0133', 'Andrea Lozano 0215'])
  await select('estado', 'bajas')
  expect(gets('/employees')).toContain('/employees?limit=25&status=inactive&withoutCard=true')
  expect(gets('/employees/summary')).toContain('/employees/summary?status=inactive')
  await select('estado', 'todas')
  await setInput('q', 'and')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) }); await settle()
  expect(location).toBe('/personal?sin-tarjeta=1&estado=todas&q=and')
  expect(gets('/employees/summary')).toContain('/employees/summary?q=and')
})

it('la ficha muestra el horario vigente con sus días y el anterior, la tarjeta, y edita y da de baja', async () => {
  await render('/personal?persona=e1')
  const sheet = () => document.querySelector<HTMLElement>('section[aria-labelledby]:has(button[aria-label="Cerrar ficha"])')!
  expect(sheet().querySelector('h2')?.textContent).toBe('Paola Ruiz')
  expect(sheet().textContent).toContain('0211 · Matriz Centro · alta 1 sep 2026')
  const schedule = sheet().querySelector('section[aria-label="Horario vigente"]')!.textContent
  expect(schedule).toContain('Oficina L–V · jornada diurna · comida 60 min · desde 1 sep 2026')
  expect(schedule).toContain('L9–18M9–18M9–18J9–18V9–18S—D—')
  expect(schedule).toContain('Antes: Oficina L–V (anterior) · 5 ene – 31 ago 2026')
  expect(sheet().querySelector('section[aria-label="Tarjeta T-0058"]')?.textContent).toContain('Activa desde el 2 sep 2026')
  expect(sheet().querySelector('a[href="/asistencia?persona=e1"]')).not.toBeNull()

  await click('Editar')
  await setInput('displayName', 'Paola Ruiz Gómez')
  await chooseOption('siteId', 'Bodega Norte')
  await click('Guardar'); await settle()
  expect(writes()).toContainEqual(['PATCH', '/employees/e1', { displayName: 'Paola Ruiz Gómez', siteId: 's2' }])

  await click('Dar de baja')
  expect(sheet().textContent).toContain('Revoca la tarjeta T-0058 y cierra su horario desde esa fecha.')
  await setInput('employmentEnd', '2026-11-10')
  expect([...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Confirmar baja')!.disabled).toBe(true)
  await setInput('employmentEnd', '2026-11-06')
  await click('Confirmar baja'); await settle()
  expect(writes()).toContainEqual(['PATCH', '/employees/e1', { status: 'inactive', employmentEnd: '2026-11-06' }])
})

it('una persona sin horario ni tarjeta recibe ambos desde su ficha', async () => {
  await render('/personal?persona=e7')
  expect(text()).toContain('Sin horario hoy: su semana se calcula sin turno programado.')
  expect(text()).toContain('Sin tarjeta: no puede marcar en un lector.')
  await click('Asignar tarjeta'); await settle()
  await chooseOption('cardId', 'T-0061')
  await click('Asignar'); await settle()
  expect(writes()).toContainEqual(['POST', '/cards/c61/assignments', { employeeId: 'e7' }])
  await click('Asignar horario'); await settle()
  expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Asignar horario')
  expect(document.querySelector('[role="dialog"] ul[aria-label="Personas elegidas"]')?.textContent).toContain('Teresa Lugo · 0300')
  await chooseOption('scheduleId', 'Nocturno')
  await setInput('validFrom', '2026-11-16')
  expect(document.querySelector('[role="dialog"] table')?.textContent).toBe('PeriodoHorarioDesde el lun 16 novNocturno')
  await click('Asignar'); await settle()
  expect(writes()).toContainEqual(['POST', '/employees/e7/schedule-assignments', { scheduleId: 'h2', validFrom: '2026-11-16' }])
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('da de alta con horario y tarjeta, y avisa si el número ya existe', async () => {
  await render()
  await click('Dar de alta'); await settle()
  await setInput('externalId', '0216')
  await setInput('displayName', 'Iván Cruz')
  await chooseOption('siteId', 'Bodega Norte')
  await chooseOption('scheduleId', 'Oficina L–V')
  await chooseOption('cardId', 'T-0061')
  await click('Dar de alta'); await settle()
  expect(writes()).toEqual([
    ['POST', '/employees', { externalId: '0216', displayName: 'Iván Cruz', siteId: 's2', employmentStart: '2026-11-09' }],
    ['POST', '/employees/e9/schedule-assignments', { scheduleId: 'h1', validFrom: '2026-11-09' }],
    ['POST', '/cards/c61/assignments', { employeeId: 'e9' }],
  ])
  expect(location).toBe('/personal?persona=e9')

  server.handler = call => call.method === 'POST' && call.path === '/employees' ? Promise.reject(new ApiError(409, 'external_id_taken', 'Ese identificador ya existe.')) : defaultServer(call)
  await click('Dar de alta'); await settle()
  await setInput('externalId', '0211'); await setInput('displayName', 'Otra persona')
  await click('Dar de alta'); await settle()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Ese número ya es de otra persona.')
})

it('si el alta entra pero el horario falla, lo dice y deja abrir su ficha', async () => {
  server.handler = call => call.method === 'POST' && call.path.endsWith('/schedule-assignments') ? Promise.reject(new ApiError(422, 'validation', 'La solicitud no es válida.', 'corr-9', [{ field: 'validFrom', message: 'Queda fuera de la vigencia del horario.' }])) : defaultServer(call)
  await render()
  await click('Dar de alta'); await settle()
  await setInput('externalId', '0217'); await setInput('displayName', 'Raúl Ortega')
  await chooseOption('scheduleId', 'Nocturno')
  await click('Dar de alta'); await settle()
  expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Se dio de alta, con pendientes')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('No se asignó el horario: Queda fuera de la vigencia del horario. Referencia: corr-9.')
  await click('Abrir su ficha'); await settle()
  expect(location).toBe('/personal?persona=e9')
})

it('Horarios separa vigentes e históricos, cuenta a las personas y crea un horario', async () => {
  await render('/personal/horarios')
  expect(text()).toContain('Vigentes · 2')
  expect(text()).toContain('Históricos · 1')
  expect(rows()).toEqual([
    ['Oficina L–V', 'L a V', '09:00 – 18:00', '60 min', 'Diurna', 'desde 1 sep 2026', '24', 'Asignar'],
    ['Nocturno', 'L a V', '22:00 – 05:00 (día siguiente)', '30 min', 'Nocturna', 'desde 1 sep 2026', '4', 'Asignar'],
  ])
  await render('/personal/horarios?vigencia=historicos')
  expect(rows()).toEqual([['Oficina L–V (anterior)', 'L a V', '09:00 – 18:30', '60 min', 'Diurna', '1 ene – 31 ago 2026', 'Histórico']])

  await render('/personal/horarios')
  await click('Crear horario'); await settle()
  await setInput('name', 'Matutino 5 días')
  const times = [...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="time"]')]
  for (const input of times.filter((_, index) => index % 2 === 0)) await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '07:00'); input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  for (const input of times.filter((_, index) => index % 2 === 1)) await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '15:00'); input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent).toBe('Jornada diurna35 h por semana')
  await click('Crear horario'); await settle()
  const created = writes().find(item => item[1] === '/schedules')!
  expect(created[2]).toMatchObject({ name: 'Matutino 5 días', timeZone: 'America/Mexico_City', validFrom: '2026-11-09' })
  expect((created[2] as { days: unknown[] }).days).toHaveLength(5)
  expect((created[2] as { days: unknown[] }).days[0]).toEqual({ dayOfWeek: 'monday', startTime: '07:00', endTime: '15:00', breakMinutes: 60 })
})

it('asigna un horario a varias personas y dice a quién no se pudo', async () => {
  server.handler = call => call.method === 'POST' && call.path === '/employees/e4/schedule-assignments' ? Promise.reject(new ApiError(409, 'employee_inactive', 'No se asignan horarios a una persona dada de baja.')) : defaultServer(call)
  await render('/personal/horarios')
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Asignar Nocturno"]')!.click()); await settle()
  await setInput('agregar', 'and')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) }); await settle()
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] ul[aria-label="Resultados"] button')][0].click())
  await click('Asignar'); await settle()
  expect(writes()).toContainEqual(['POST', '/employees/e4/schedule-assignments', { scheduleId: 'h2', validFrom: '2026-11-09' }])
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('No se asignó a una persona: Andrea Lozano (No se asignan horarios a una persona dada de baja.)')
})

it('Supervisión y Auditoría consultan sin dar de alta, editar ni dar de baja', async () => {
  for (const role of ['supervisor', 'auditor']) {
    await render('/personal?persona=e1', [role])
    expect(text()).toContain('Paola Ruiz')
    for (const label of ['Dar de alta', 'Importar CSV', 'Editar', 'Dar de baja', 'Cambiar desde una fecha']) expect([...document.querySelectorAll('button, a')].some(item => item.textContent === label), `${role}: ${label}`).toBe(false)
    expect(gets('/imports')).toEqual([])
  }
  await render('/personal/horarios', ['supervisor'])
  expect(text()).not.toContain('Crear horario')
  expect(container.querySelector('button[aria-label^="Asignar"]')).toBeNull()
})

it('Fuentes del padrón muestra cada fuente y, a Administración, los cambios recientes', async () => {
  await render('/personal/fuentes')
  expect(rows().slice(0, 2)).toEqual([
    ['Archivo CSV', 'CSV', 'Activa', 'padron-octubre.csv · fila 44', '1', 'lun 19 oct'],
    ['Sistema de nómina', 'API', 'En pausa', 'registro 1208', '2', 'dom 1 nov'],
  ])
  expect(gets('/audit-log')).toEqual(['/audit-log?group=directory&limit=10'])
  expect(text()).toContain('Dio de alta a Andrea Lozano')
  server.calls = []
  await render('/personal/fuentes', ['rh'])
  expect(text()).toContain('Archivo CSV')
  expect(gets('/audit-log')).toEqual([])
  await render('/personal/fuentes', ['supervisor'])
  expect(container.querySelector('h1')?.textContent).toBe('Esta sección no está disponible para tu rol')
})

it('sin nadie en el padrón invita a dar de alta o importar', async () => {
  server.handler = call => call.path.startsWith('/employees/summary') ? Promise.resolve({ ...summary, total: 0, active: 0, inactive: 0, withoutCard: 0, bySchedule: [] })
    : call.path.startsWith('/employees?') ? Promise.resolve({ items: [], nextCursor: null }) : defaultServer(call)
  await render()
  expect(container.querySelector('main h2')?.textContent).toBe('Aún no hay personas en el padrón')
  expect([...container.querySelectorAll('main section a')].map(link => link.getAttribute('href'))).toEqual(['/personal/importaciones?importar=archivo'])
})

it('en teléfono cada persona es una tarjeta y la ficha ocupa la pantalla', async () => {
  phone = true
  await render()
  expect([...container.querySelectorAll('main section[aria-label="Personas"] li')].map(item => item.textContent)[0]).toBe('Paola Ruiz0211 · Matriz Centro · Oficina L–V · T-0058Activa')
  await act(async () => container.querySelector<HTMLElement>('main section[aria-label="Personas"] li a')!.click()); await settle()
  expect(location).toBe('/personal?persona=e1')
  expect(document.querySelector('button[aria-label="Volver a la lista"]')).not.toBeNull()
})

it('la lista con la ficha abierta y el alta no tienen fallas automáticas de accesibilidad', async () => {
  await render('/personal?persona=e1')
  expect(await accessibilityViolations(container)).toEqual([])
  await click('Dar de alta'); await settle()
  expect(await accessibilityViolations(document.querySelector<HTMLElement>('[role="dialog"]')!)).toEqual([])
}, 15_000)
