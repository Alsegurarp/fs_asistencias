// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

const server = vi.hoisted(() => ({ calls: [] as string[], handler: (path: string): Promise<unknown> => new Promise(() => path) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() }, identityBase: 'http://localhost:8082' }))
vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  api: vi.fn((path: string) => { server.calls.push(path); return server.handler(path) }),
}))
import { ApiError, type Me } from './api'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { click, waitFor } from './testUi'

const sites = [{ id: 's1', name: 'Matriz Centro' }, { id: 's2', name: 'Bodega Norte' }]
const day = (dayOfWeek: string, startTime: string, endTime: string) => ({ dayOfWeek, startTime, endTime, breakMinutes: 0 })
const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const schedules = [
  { id: 'h1', name: 'Matutino 6 días', days: [...weekdays, 'saturday'].map(name => day(name, '08:00', '16:00')) },
  { id: 'h2', name: 'Oficina L–V', days: weekdays.map(name => day(name, '09:00', '18:00')) },
  { id: 'h3', name: 'Mixto', days: weekdays.map(name => day(name, '14:00', '22:00')) },
]
const totals = (ordinaryMinutes: number, overtimeMinutes = 0) => ({ workedMinutes: ordinaryMinutes + overtimeMinutes, breakMinutes: 0, ordinaryMinutes, overtimeMinutes })
const row = (employeeId: string, displayName: string, externalId: string, siteId: string, scheduleId: string, extra: object) => ({
  employeeId, displayName, externalId, siteId, scheduleId, ruleSet: { id: 'r', version: 2 }, totals: totals(1920), alerts: [], openIncidents: [], closure: null, today: null, ...extra,
})
const ana = row('e1', 'Ana Torres', '0187', 's2', 'h1', { totals: totals(1920, 190), alerts: [{ code: 'weekly_overtime', severity: 'info', message: 'La semana tiene 190 minutos extraordinarios.' }],
  today: { state: 'on_shift', since: '2026-11-06T13:58:00Z', lastMarkAt: '2026-11-06T13:58:00Z' } })
const luis = row('e2', 'Luis Hernández', '0114', 's1', 'h2', { totals: totals(1440), alerts: [{ code: 'open_segment', severity: 'warning', message: 'Falta el marcaje que cierra un tramo.' }],
  openIncidents: [{ id: 'i1', type: 'missing_pair' }], today: { state: 'off_shift', since: null, lastMarkAt: '2026-11-06T15:00:00Z' } })
const paola = row('e4', 'Paola Ruiz', '0211', 's1', 'h3', { totals: totals(1915), openIncidents: [{ id: 'i2', type: 'foreign_site' }], today: { state: 'no_entry', since: null, lastMarkAt: null } })
const later = row('e5', '=Marta Ríos', '0300', 's1', 'h2', { today: { state: 'no_entry', since: null, lastMarkAt: null } })
const summary = { date: '2026-11-06', weekStart: '2026-11-02', timeZone: 'America/Mexico_City', siteId: null, people: 42,
  day: { marked: 38, attendanceEvents: 81, onShift: 34, noEntry: 4, foreignSite: 1 }, week: { ordinaryMinutes: 71160, overtimeMinutes: 405, withOvertime: 3, withAttention: 4, missingExit: 3 } }
const rule = { id: 'r', version: 2, validFrom: '2026-01-01', validTo: '2026-12-31', weeklyOrdinaryMaxMinutes: 2880, parameters: { weeklyOvertimeMaxMinutes: '540' } }
const anaWeek = { employeeId: 'e1', weekStart: '2026-11-02', timeZone: 'America/Mexico_City', ruleSet: { id: 'r', version: 2 }, openIncidentIds: [], closure: null, totals: totals(1920, 190),
  alerts: [{ code: 'weekly_overtime', severity: 'info', message: 'Extra de la semana.' }, { code: 'open_segment', severity: 'warning', message: 'Falta el marcaje que cierra un tramo.' }],
  segments: [
    { id: 'a', kind: 'work', startAt: '2026-11-02T14:00:00Z', endAt: '2026-11-02T22:00:00Z', minutes: 480 },
    { id: 'b', kind: 'work', startAt: '2026-11-03T13:57:00Z', endAt: '2026-11-03T23:02:00Z', minutes: 545 },
    { id: 'c', kind: 'work', startAt: '2026-11-06T13:58:00Z', endAt: null, minutes: 0 },
  ] }
const mark = (id: string, type: string, observedAt: string, extra: object) => ({ id, employeeId: 'e1', siteId: 's2', deviceMode: 'terminal', type, outcome: 'accepted', observedAt,
  receivedAt: observedAt, delaySeconds: 0, locationVerdict: 'inside', accuracyMeters: 12, incidentIds: [], payloadHash: 'x', ...extra })
const marks = [
  mark('m1', 'clock_out', '2026-11-03T23:02:00Z', { deviceMode: 'personal', accuracyMeters: 9, delaySeconds: 360, outcome: 'accepted_with_incident', incidentIds: ['i9'] }),
  mark('m2', 'clock_in', '2026-11-06T13:58:00Z', {}),
]
const closure = { id: 'c1', employeeId: 'e1', employeeName: 'Ana Torres', employeeExternalId: '0187', weekStart: '2026-10-26', version: 1, status: 'closed', ruleSet: { id: 'r', version: 2 },
  totals: totals(2880, 255), hash: `9f3a${'0'.repeat(56)}c21e`, closedAt: '2026-11-02T08:00:00Z', closedBy: null, closedByName: null,
  acknowledgement: { id: 'k', closureId: 'c1', type: 'agreed', note: null, at: '2026-11-02T18:40:00Z', evidenceHash: 'h' } }

function defaultServer(path: string): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const query = url.searchParams
  const answer = (body: unknown) => Promise.resolve(body)
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/sites': return answer({ items: sites, nextCursor: null })
    case '/schedules': return answer({ items: schedules, nextCursor: null })
    case '/rule-sets': return answer({ items: [rule] })
    case '/attendance/summary': return answer({ ...summary, date: query.get('date'), weekStart: query.get('date')! < '2026-11-02' ? '2026-10-26' : '2026-11-02' })
    case '/attendance/weeks': {
      const weekStart = query.get('week')! < '2026-11-02' ? '2026-10-26' : '2026-11-02'
      const page = query.get('cursor') === 'c2' ? { items: [later], nextCursor: null } : { items: [ana, luis, paola], nextCursor: 'c2' }
      return answer({ weekStart, timeZone: 'America/Mexico_City', ...page })
    }
    case '/employees/e1/attendance': return answer(anaWeek)
    case '/employees/e9': return answer({ id: 'e9', externalId: '0400', displayName: 'Rocío Navarro', siteId: 's1', currentScheduleId: 'h3', status: 'active' })
    case '/employees/e9/attendance': return answer({ ...anaWeek, employeeId: 'e9', segments: [], totals: totals(0), alerts: [] })
    case '/attendance-events': return answer({ items: query.get('employeeId') === 'e1' ? marks : [], nextCursor: null })
    case '/week-closures': return answer({ items: query.get('week') === '2026-10-26' && query.get('employeeId') === 'e1' ? [closure] : [], nextCursor: null })
  }
  return new Promise(() => {})
}

let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
let phone = false
let location = ''

function Probe() { location = useLocation().search; return null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T16:30:00Z') })
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  server.calls = []; server.handler = defaultServer; phone = false
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

async function render(path = '/asistencia', roles = ['admin_empresa']) {
  const me: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' } }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Probe /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await waitFor(() => !document.querySelector('[role="status"]')?.textContent?.startsWith('Cargando la semana'))
}
const text = () => document.body.textContent || ''
const cells = () => [...container.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent))
const weeksCalls = () => server.calls.filter(path => path.startsWith('/attendance/weeks')).map(path => new URL(path, 'http://zenit.test').searchParams)
const chip = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(button => button.textContent?.startsWith(label))!

it('muestra la semana de cada persona como la calcula el servidor', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('Asistencia · reglas 2026: 48 h ordinarias y hasta 9 h extra por semana')
  expect(text()).toContain('2 – 8 nov 2026')
  expect(container.querySelector('h2')?.textContent).toBe('42 personas · lunes a jueves completos, viernes en curso')
  expect(cells()).toEqual([
    ['Ana Torres 0187', 'Bodega Norte', 'Matutino 6 días', '32:00 / 48', '3:10 / 9', 'En turno 07:58', 'Tiempo extra'],
    ['Luis Hernández 0114', 'Matriz Centro', 'Oficina L–V', '24:00 / 48', '0:00', 'Salió 09:00', 'Tramo sin salidaFalta un marcaje'],
    ['Paola Ruiz 0211', 'Matriz Centro', 'Mixto', '31:55 / 48', '0:00', 'Entra 14:00', 'Marcó en otra sede'],
  ])
  expect([...container.querySelectorAll('button[aria-pressed]')].map(button => button.textContent)).toEqual(['Con alertas · 4', 'Con tiempo extra · 3', 'Sin entrada hoy · 4', 'En turno · 34'])
  expect(text()).toContain('1–3 de 42')
  // Una incidencia abre Incidencias en su semana.
  expect(container.querySelector('tbody a[href="/incidencias?incidencia=i1"]')?.textContent).toBe('Falta un marcaje')
})

it('filtra, busca y elige sede en el servidor, y lo deja en la dirección', async () => {
  await render()
  await act(async () => chip('Con tiempo extra').click())
  await waitFor(() => weeksCalls().some(query => query.get('attention') === 'overtime'))
  expect(location).toContain('filtro=extra')
  expect(chip('Con tiempo extra').getAttribute('aria-pressed')).toBe('true')
  await waitFor(() => !!container.querySelector('h2')?.textContent?.includes('3 con tiempo extra'))

  const input = container.querySelector<HTMLInputElement>('input[name="q"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Ana'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  await waitFor(() => weeksCalls().some(query => query.get('q') === 'Ana' && query.get('attention') === 'overtime'))
  expect(location).toContain('q=Ana')

  const select = container.querySelector<HTMLSelectElement>('select[name="sede"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 's1'); select.dispatchEvent(new Event('change', { bubbles: true })) })
  await waitFor(() => weeksCalls().some(query => query.get('siteId') === 's1' && query.get('q') === 'Ana'))
  expect(server.calls).toContain('/attendance/summary?date=2026-11-06&siteId=s1')
  // Nunca se pidió una persona por fila.
  expect(server.calls.filter(path => path.startsWith('/employees/'))).toEqual([])
})

it('pasa de página con el cursor y vuelve a la primera al cambiar el filtro', async () => {
  await render()
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.click())
  await waitFor(() => cells()[0]?.[0] === "=Marta Ríos 0300")
  expect(weeksCalls().at(-1)!.get('cursor')).toBe('c2')
  expect(text()).toContain('26–26 de 42')
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Página anterior"]')!.click())
  await waitFor(() => cells()[0]?.[0] === 'Ana Torres 0187')
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.click())
  await act(async () => chip('Con alertas').click())
  await waitFor(() => weeksCalls().at(-1)!.get('attention') === 'alerts')
  expect(weeksCalls().at(-1)!.get('cursor')).toBeNull()
})

it('cambia de semana; en una semana pasada no hay «hoy» ni se puede ir al futuro', async () => {
  await render()
  expect(container.querySelector<HTMLButtonElement>('button[aria-label="Semana siguiente"]')!.disabled).toBe(true)
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Semana anterior"]')!.click())
  await waitFor(() => text().includes('26 oct – 1 nov 2026'))
  expect(location).toContain('semana=2026-10-26')
  expect([...container.querySelectorAll('button[aria-pressed]')].map(button => button.textContent)).toEqual(['Con alertas · 4', 'Con tiempo extra · 3'])
  expect([...container.querySelectorAll('th')].map(th => th.textContent)).not.toContain('Hoy')
  expect(container.querySelector('h2')?.textContent).toContain('semana terminada')
  expect(container.querySelector<HTMLButtonElement>('button[aria-label="Semana siguiente"]')!.disabled).toBe(false)
})

it('abre la ficha con la semana día por día, sus marcajes y sus cierres', async () => {
  await render()
  const name = [...container.querySelectorAll<HTMLAnchorElement>('tbody a')].find(link => link.textContent === 'Ana Torres')!
  await act(async () => name.click())
  await waitFor(() => !!document.querySelector('[role="tablist"]') && text().includes('Lun, 2 nov'))
  expect(location).toContain('persona=e1')
  const sheet = document.querySelector('section[aria-labelledby] [role="tablist"]')!.closest('section')!
  expect(sheet.querySelector('h2')?.textContent).toBe('Ana Torres')
  expect(document.activeElement).toBe(sheet.querySelector('h2'))
  expect(sheet.textContent).toContain('0187 · Bodega Norte · L–S 08:00–16:00')
  expect(sheet.textContent).toContain('32:00Ordinarias / 48 h3:10Extra / 9 h0Incidencias')
  expect([...sheet.querySelectorAll('li')].map(li => li.textContent)).toEqual([
    'Lun, 2 nov08:00 – 16:008:00', 'Mar, 3 nov07:57 – 17:029:05', 'Mié, 4 novSin marcas · programado 08:00 – 16:00',
    'Jue, 5 novSin marcas · programado 08:00 – 16:00', 'Vie, 6 nov07:58 – en turnoAbierto', 'Sáb, 7 novProgramado 08:00 – 16:00',
  ])
  // El tramo del turno en curso no es un aviso.
  expect(sheet.textContent).not.toContain('Falta el marcaje')
  expect(sheet.textContent).toContain('Evidencia de hoy: entrada 07:58 · Terminal de Bodega Norte · dentro de la sede · precisión 12 m')
  expect(sheet.textContent).toContain('Calculada con reglas laborales 2026, versión 2 · semana sin cierre')

  await click('Marcajes')
  expect(location).toContain('ficha=marcajes')
  // Cambiar de pestaña no manda el foco al título de la página.
  expect(document.activeElement).not.toBe(container.querySelector('h1'))
  expect(sheet.textContent).toContain('2 marcas de la semana con su evidencia.')
  expect([...sheet.querySelectorAll('li')].map(li => li.textContent)).toEqual([
    'vie 607:58Entrada · Terminal de Bodega NorteDentro de la sede · precisión 12 mAceptada',
    'mar 317:02Salida · Teléfono personalDentro de la sede · precisión 9 m · llegó 6 min despuésCon incidencia',
  ])
  expect(server.calls.find(path => path.startsWith('/attendance-events'))).toBe('/attendance-events?employeeId=e1&from=2026-11-02T06%3A00%3A00.000Z&to=2026-11-09T06%3A00%3A00.000Z&limit=200')

  await click('Cierres y acuses')
  await waitFor(() => sheet.textContent!.includes('26 oct – 1 nov'))
  expect(server.calls.filter(path => path.startsWith('/week-closures')).map(path => new URL(path, 'http://zenit.test').searchParams.get('week')))
    .toEqual(['2026-11-02', '2026-10-26', '2026-10-19', '2026-10-12', '2026-10-05', '2026-09-28'])
  expect(sheet.querySelector('li')?.textContent).toBe('26 oct – 1 nov48:00 + 4:15 extra · huella 9f3a…c21eConforme')

  await act(async () => sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  await waitFor(() => !document.querySelector('[role="tablist"]'))
  expect(location).not.toContain('persona=')
  await waitFor(() => document.activeElement === name)
})

it('un enlace directo abre la ficha de alguien que no está en la página', async () => {
  await render('/asistencia?persona=e9&ficha=marcajes')
  await waitFor(() => text().includes('0 marcas de la semana'))
  expect(server.calls).toContain('/employees/e9')
  const sheet = document.querySelector('[role="tablist"]')!.closest('section')!
  await waitFor(() => sheet.querySelector('h2')?.textContent === 'Rocío Navarro')
  expect(sheet.textContent).toContain('0400 · Matriz Centro · L–V 14:00–22:00')
  expect(sheet.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Marcajes')
  expect(await accessibilityViolations(container)).toEqual([])
})

it('dice qué falló con su referencia y deja reintentar', async () => {
  server.handler = path => path.startsWith('/attendance/weeks') ? Promise.reject(new ApiError(500, 'internal', 'Error interno.', 'ref-123')) : defaultServer(path)
  await render()
  await waitFor(() => text().includes('ref-123'))
  expect(text()).toContain('No pudimos cargar la semana. Error interno.')
  server.handler = defaultServer
  await click('Reintentar')
  await waitFor(() => cells().length === 3)
})

it('sin resultados ofrece quitar los filtros', async () => {
  server.handler = path => path.startsWith('/attendance/weeks') && path.includes('attention=') ? Promise.resolve({ weekStart: '2026-11-02', timeZone: 'America/Mexico_City', items: [], nextCursor: null }) : defaultServer(path)
  await render('/asistencia?filtro=alertas')
  await waitFor(() => text().includes('Nadie coincide con estos filtros'))
  await click('Quitar filtros')
  await waitFor(() => cells().length === 3)
  expect(location).not.toContain('filtro=')
})

it('exporta la vista completa a CSV sin abrir fórmulas en la hoja de cálculo', async () => {
  let blob: Blob | undefined
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn((value: Blob) => { blob = value; return 'blob:zenit' }), revokeObjectURL: vi.fn() }))
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  await render()
  await click('Exportar vista')
  await waitFor(() => !!blob)
  expect(weeksCalls().filter(query => query.get('limit') === '200').map(query => query.get('cursor'))).toEqual([null, 'c2'])
  // Con BOM, para que Excel lea los acentos.
  expect([...new Uint8Array(await blob!.arrayBuffer()).slice(0, 3)]).toEqual([0xEF, 0xBB, 0xBF])
  const content = await blob!.text()
  expect(content.split('\r\n').slice(0, 2)).toEqual(['Persona,Número,Sede,Horario,Ordinarias,Extra,Hoy,Atención', 'Ana Torres,0187,Bodega Norte,Matutino 6 días,32:00,3:10,En turno 07:58,Tiempo extra'])
  expect(content).toContain("'=Marta Ríos,0300")
  expect(download).toHaveBeenCalledOnce()
})

it('las columnas opcionales se eligen y se recuerdan', async () => {
  await render()
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Elegir columnas"]')!.click())
  await waitFor(() => !!document.querySelector('[role="menuitemcheckbox"]'))
  await act(async () => [...document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')].find(item => item.textContent === 'Horario')!.click())
  expect([...container.querySelectorAll('th')].map(th => th.textContent)).toEqual(['Persona', 'Sede', 'Ordinarias', 'Extra', 'Hoy', 'Atención'])
  expect(window.localStorage.getItem('zenit.asistencia.columnas')).toBe('["site","today","attention"]')
})

it('en teléfono muestra tarjetas con su barra de horas y la ficha a pantalla completa', async () => {
  phone = true
  await render()
  expect([...container.querySelectorAll('button[aria-pressed]')].map(button => button.textContent)).toEqual(['Todas · 42', 'Con alertas · 4', 'Con extra · 3', 'Sin entrada · 4', 'En turno · 34'])
  expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('32:00 ordinarias y 3:10 extra')
  expect(container.querySelector('li a')?.textContent).toContain('0187 · Bodega Norte · en turno 07:58')
  expect(await accessibilityViolations(container)).toEqual([])
  await act(async () => container.querySelector<HTMLAnchorElement>('li a')!.click())
  await waitFor(() => !!document.querySelector('button[aria-label="Volver a la lista"]'))
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Volver a la lista"]')!.click())
  await waitFor(() => !document.querySelector('[role="tablist"]'))
})

it('la tabla con la ficha abierta no tiene fallas automáticas de accesibilidad', async () => {
  await render('/asistencia?persona=e1')
  await waitFor(() => text().includes('Lun, 2 nov'))
  expect(container.querySelectorAll('h1')).toHaveLength(1)
  expect(await accessibilityViolations(container)).toEqual([])
})

it('Supervisión ve la tabla con lo que el servidor le deja ver', async () => {
  await render('/asistencia', ['supervisor'])
  expect(cells()).toHaveLength(3)
  expect(server.calls.some(path => path.startsWith('/devices'))).toBe(false)
})
