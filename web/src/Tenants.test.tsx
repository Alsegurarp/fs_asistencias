// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown }
const server = vi.hoisted(() => ({ calls: [] as Call[], pending: 0, handler: (call: Call): Promise<unknown> => new Promise(() => call) }))
const saved = vi.hoisted(() => ({ files: [] as { blob: Blob; name: string }[] }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn(), tokenParsed: { sub: 'kc-self' } }, identityBase: 'http://localhost:8082' }))
vi.mock('./files', () => ({ saveFile: (blob: Blob, name: string) => { saved.files.push({ blob, name }) } }))
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
import { button, click, setInput, waitFor } from './testUi'
import { type OperatedTenant, type UsageItem, addMonths, currentMonth, monthName, usageCsv, zoneName } from './tenantsModel'

const config = { timeZone: 'America/Mexico_City', weekStartsOn: 'monday', breakPolicy: 'not_considered', autoCloseAfterHours: null, breakPolicyChange: null } as const
let tenants: OperatedTenant[]
const usageOf = (id: string, month: string) => {
  const marked = id === 't1' ? 38 : id === 't2' ? 54 : 26
  return { tenantId: id, month, timeZone: 'America/Mexico_City', from: `${month}-01T06:00:00Z`, to: `${addMonths(month, 1)}-01T06:00:00Z`, complete: month < '2026-11',
    employeesWithAttendance: marked, employeesInPeriod: marked + 4, cardsAssigned: marked + 2, devicesActive: 6, attendanceEvents: marked * 50 }
}
let failure: ApiError | null

function defaultServer({ path, method, body }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  const found = tenants.find(item => item.id === url.pathname.split('/')[2])
  if (method !== 'GET') {
    if (failure) return Promise.reject(failure)
    if (url.pathname === '/tenants') {
      const created = { ...config, ...(body as object), id: 't9', status: 'active', createdAt: '2026-11-10T16:42:00Z' } as OperatedTenant
      tenants.push({ ...created, administration: { state: 'pending', total: 1, administrators: [{ email: (body as { firstAdminEmail: string }).firstAdminEmail, status: 'invited', invitedAt: created.createdAt, linkedAt: null }] } })
      return answer(created)
    }
    if (url.pathname.endsWith('/suspension')) found!.status = 'suspended'
    if (url.pathname.endsWith('/reactivation')) found!.status = 'active'
    if (url.pathname.endsWith('/break-policy-changes')) found!.breakPolicyChange = { id: 'cambio', breakPolicy: 'marked', reason: (body as { reason: string }).reason, effectiveOn: '2026-11-23', effectiveAt: '2026-11-23T06:00:00Z', scheduledAt: '2026-11-10T16:42:00Z' }
    if (url.pathname.endsWith('/cancellation')) found!.breakPolicyChange = null
    if (url.pathname.endsWith('/administrators/unlink')) found!.administration = { state: 'pending', total: 1, administrators: [{ ...found!.administration.administrators[0], status: 'invited', linkedAt: null }] }
    return answer(found)
  }
  const q = url.searchParams.get('q')?.toLowerCase(); const status = url.searchParams.get('status'); const administration = url.searchParams.get('administration')
  const shown = tenants.filter(item => (!q || item.name.toLowerCase().includes(q) || item.slug.includes(q)) && (!status || item.status === status) && (!administration || item.administration.state === administration))
  const month = url.searchParams.get('month') || ''
  const items = shown.map(item => ({ id: item.id, name: item.name, slug: item.slug, status: item.status, usage: usageOf(item.id, month) })) as UsageItem[]
  switch (url.pathname) {
    case '/tenants': return answer({ items: shown.map(item => ({ ...item })), nextCursor: null })
    case '/tenants/summary': {
      const all = tenants.filter(item => !q || item.name.toLowerCase().includes(q) || item.slug.includes(q))
      const by = (state: string) => all.filter(item => item.administration.state === state).length
      return answer({ total: all.length, active: all.filter(item => item.status === 'active').length, suspended: all.filter(item => item.status === 'suspended').length, administration: { linked: by('linked'), pending: by('pending'), none: by('none') } })
    }
    case '/tenants/usage': return answer({ items, nextCursor: null })
    case '/tenants/usage/summary': {
      const sum = (key: 'employeesWithAttendance' | 'employeesInPeriod' | 'cardsAssigned' | 'devicesActive' | 'attendanceEvents') => items.reduce((total, item) => total + item.usage[key], 0)
      return answer({ month, tenants: items.length, complete: month < '2026-11' ? items.length : 0, employeesWithAttendance: sum('employeesWithAttendance'), employeesInPeriod: sum('employeesInPeriod'), cardsAssigned: sum('cardsAssigned'), devicesActive: sum('devicesActive'), attendanceEvents: sum('attendanceEvents') })
    }
  }
  if (found && url.pathname.endsWith('/usage')) return answer(usageOf(found.id, month))
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
  tenants = [
    { ...config, id: 't1', name: 'Empresa Demo Local', slug: 'empresa-demo-local', status: 'active', createdAt: '2026-10-19T16:00:00Z',
      administration: { state: 'linked', total: 1, administrators: [{ email: 'mariana@demo.example', status: 'active', invitedAt: '2026-10-19T16:00:00Z', linkedAt: '2026-10-20T15:00:00Z' }] } },
    { ...config, id: 't2', name: 'Logística del Bajío', slug: 'logistica-bajio', status: 'active', createdAt: '2026-11-02T16:00:00Z', breakPolicy: 'marked',
      administration: { state: 'pending', total: 1, administrators: [{ email: 'direccion@bajio.example', status: 'invited', invitedAt: '2026-11-02T16:00:00Z', linkedAt: null }] } },
    { ...config, id: 't3', name: 'Panificadora La Espiga', slug: 'panificadora-espiga', status: 'suspended', createdAt: '2026-10-12T16:00:00Z', weekStartsOn: 'sunday',
      administration: { state: 'none', total: 0, administrators: [] } },
  ]
  failure = null; saved.files = []
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
    if (round > 300) throw new Error(`Quedaron ${server.pending} respuestas pendientes: ${server.calls.slice(-8).map(c => c.method + ' ' + c.path).join(', ')}`)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    quiet = server.pending === 0 ? quiet + 1 : 0
  }
}
async function render(path = '/empresas', roles = ['operador_saas']) {
  const me: Me = { userId: 'self', displayName: 'Operación', roles, tenant: null, employeeId: null }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} email="operacion@zenit.example" onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const text = () => document.body.textContent || ''
const rows = () => [...container.querySelectorAll('main table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const writes = () => server.calls.filter(call => call.method !== 'GET').map(call => [call.path, call.method, call.body])
const gets = (prefix: string) => server.calls.filter(call => call.method === 'GET' && call.path.startsWith(prefix)).map(call => call.path)
const chip = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].findLast(item => item.textContent?.trim() === label)!
async function press(label: string) { await act(async () => chip(label).click()); await settle() }
async function go(label: string) { await click(label); await settle() }
async function action(title: string) {
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.startsWith(title))!.click())
  await settle()
}

it('lista las empresas con su configuración, quién las administra y cuántos marcaron en el mes', async () => {
  await render()
  expect(rows()[0]).toEqual(['Empresa Demo Localempresa-demo-local', 'Activa', '19 oct 2026', 'Ciudad de México · lunes', 'No se marca', '—', 'mariana@demo.exampleYa entró', '38', 'Ver'])
  expect(rows()[1][6]).toBe('direccion@bajio.exampleInvitación sin usar')
  expect(rows()[2].slice(1, 4)).toEqual(['Suspendida', '12 oct 2026', 'Ciudad de México · domingo'])
  expect(rows()[2][6]).toBe('NadieSin quien administre')
  expect(text()).toContain('2empresas activas'); expect(text()).toContain('1suspendida'); expect(text()).toContain('118personas marcaron en noviembre')
  expect(chip('Todas · 3')).toBeDefined(); expect(chip('Suspendidas · 1')).toBeDefined(); expect(chip('Invitación sin usar · 1')).toBeDefined()
  expect(gets('/tenants/usage?')).toEqual(['/tenants/usage?month=2026-11&limit=25'])
  expect(writes()).toEqual([])
})

it('las vistas y la búsqueda se piden al servidor; con el filtro de administración no se pide el uso por página', async () => {
  await render()
  await press('Suspendidas · 1')
  expect(gets('/tenants?').at(-1)).toBe('/tenants?limit=25&status=suspended')
  expect(gets('/tenants/usage?').at(-1)).toBe('/tenants/usage?month=2026-11&limit=25&status=suspended')
  expect(rows()).toHaveLength(1)
  const before = gets('/tenants/usage?').length
  await press('Sin quien administre · 1')
  expect(gets('/tenants?').at(-1)).toBe('/tenants?limit=25&administration=none')
  expect(gets('/tenants/usage?')).toHaveLength(before)
  expect(rows()[0]).toHaveLength(8)
  await render('/empresas?q=baj')
  expect(gets('/tenants?').at(-1)).toBe('/tenants?limit=25&q=baj')
  expect(gets('/tenants/summary').at(-1)).toBe('/tenants/summary')
  expect(rows().map(row => row[0])).toEqual(['Logística del Bajíologistica-bajio'])
})

it('da de alta una empresa con el correo y el identificador normalizados y abre su ficha', async () => {
  await render('/empresas?alta=1')
  await setInput('name', ' Ferretería El Tornillo '); await setInput('slug', 'Ferreteria-Tornillo'); await setInput('firstAdminEmail', ' Duena@Tornillo.example ')
  await go('Dar de alta e invitar')
  expect(text()).toContain('Elige una política de comida.'); expect(writes()).toEqual([])
  await act(async () => document.querySelector<HTMLInputElement>('input[name="breakPolicy"][value="marked"]')!.click())
  await go('Dar de alta e invitar')
  expect(writes()).toEqual([['/tenants', 'POST', { name: 'Ferretería El Tornillo', slug: 'ferreteria-tornillo', timeZone: 'America/Mexico_City', weekStartsOn: 'monday', breakPolicy: 'marked', firstAdminEmail: 'duena@tornillo.example' }]])
  expect(location).toBe('/empresas?q=ferreteria-tornillo&empresa=t9')
  expect(text()).toContain('duena@tornillo.example'); expect(text()).toContain('Sin entrar')
})

it('un identificador repetido se dice sin cerrar la ventana', async () => {
  failure = new ApiError(409, 'slug_taken', 'El identificador ya existe.')
  await render('/empresas?alta=1')
  await setInput('name', 'Otra'); await setInput('slug', 'otra'); await setInput('firstAdminEmail', 'a@otra.example')
  await act(async () => document.querySelector<HTMLInputElement>('input[name="breakPolicy"][value="not_considered"]')!.click())
  await go('Dar de alta e invitar')
  expect(text()).toContain('El identificador ya existe.')
  expect(document.querySelector('[name="name"]')).not.toBeNull()
})

it('la ficha de una empresa activa trae su uso del mes y las acciones de operación', async () => {
  await render('/empresas?empresa=t1')
  expect(gets('/tenants/t1/usage')).toEqual(['/tenants/t1/usage?month=2026-11'])
  expect(text()).toContain('Cierre automáticoDesactivado'); expect(text()).toContain('Entró el 20 oct 2026'); expect(text()).toContain('1,900marcajes')
  expect(document.querySelector('a[href="/empresas/uso?q=empresa-demo-local"]')).not.toBeNull()
  // Quien ya la administra invita a las demás: la operación no.
  expect(button('Invitar a otra persona')).toBeUndefined()

  await action('Programar un cambio de comida')
  expect(location).toContain('accion=comida')
  await go('Programar cambio'); expect(writes()).toEqual([])
  await setInput('reason', 'La empresa lo pidió por soporte.'); await go('Programar cambio')
  expect(writes()).toEqual([['/tenants/t1/break-policy-changes', 'POST', { breakPolicy: 'marked', reason: 'La empresa lo pidió por soporte.' }]])
  expect(text()).toContain('Se marca desde el lun 23 nov 2026')
  await go('Cancelar el cambio')
  expect(writes()[1]).toEqual(['/tenants/t1/break-policy-changes/cambio/cancellation', 'POST', undefined])

  await action('Soltar a quien administra')
  expect((document.querySelector('[name="email"]') as HTMLInputElement).value).toBe('mariana@demo.example')
  await setInput('reason', 'Dejó la empresa; lo pidió la dirección.'); await go('Soltar la liga')
  expect(writes()[2]).toEqual(['/tenants/t1/administrators/unlink', 'POST', { email: 'mariana@demo.example', reason: 'Dejó la empresa; lo pidió la dirección.' }])
  await waitFor(() => !!button('Invitar a otra persona'))
})

it('sin nadie que la administre con su cuenta, la operación invita a otra persona', async () => {
  await render('/empresas?empresa=t2')
  await go('Invitar a otra persona')
  await setInput('email', ' Nueva@Bajio.example '); await setInput('reason', 'La invitación del alta llegó a otro correo.'); await go('Invitar')
  expect(writes()).toEqual([['/tenants/t2/administrators', 'POST', { email: 'nueva@bajio.example', reason: 'La invitación del alta llegó a otro correo.' }]])
})

it('suspender pide motivo y la ficha suspendida explica qué implica y permite reactivar', async () => {
  await render('/empresas?empresa=t1')
  await action('Suspender la empresa')
  expect(text()).toContain('Los lectores ya activos siguen marcando y sincronizando.')
  await go('Suspender'); expect(writes()).toEqual([])
  await setInput('reason', 'Falta de pago de octubre.'); await go('Suspender')
  expect(writes()).toEqual([['/tenants/t1/suspension', 'POST', { reason: 'Falta de pago de octubre.' }]])
  expect(text()).toContain('Mientras siga suspendida'); expect(button('Suspender')).toBeUndefined()
  await go('Reactivar'); expect(writes()).toHaveLength(1)
  await setInput('reason', 'Contrato renovado.'); await go('Reactivar')
  expect(writes()[1]).toEqual(['/tenants/t1/reactivation', 'POST', { reason: 'Contrato renovado.' }])
  await waitFor(() => text().includes('Acciones de operación'))
})

it('un conflicto al reactivar conserva el motivo', async () => {
  failure = new ApiError(409, 'tenant_not_suspended', 'Esa empresa no está suspendida.')
  await render('/empresas?empresa=t3')
  await setInput('reason', 'Revisado por operación'); await go('Reactivar')
  expect(text()).toContain('Esa empresa no está suspendida.')
  expect((document.querySelector('[name="reason"]') as HTMLTextAreaElement).value).toBe('Revisado por operación')
})

it('el uso del mes lista cada empresa con su total, cambia de mes y exporta el CSV', async () => {
  await render('/empresas/uso')
  expect(rows()[0]).toEqual(['Empresa Demo Local', '38', '42', '40', '6', '1,900'])
  expect(rows()[2][0]).toBe('Panificadora La EspigaSuspendida')
  expect([...container.querySelectorAll('tfoot th, tfoot td')].map(cell => cell.textContent)).toEqual(['Total', '118', '130', '124', '18', '5,900'])
  expect(text()).toContain('noviembre está en curso')
  expect(document.querySelector<HTMLButtonElement>('[aria-label="Mes siguiente"]')!.disabled).toBe(true)
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Mes anterior"]')!.click()); await settle()
  expect(location).toBe('/empresas/uso?mes=2026-10')
  expect(gets('/tenants/usage?').at(-1)).toBe('/tenants/usage?month=2026-10&limit=25')
  expect(text()).toContain('Octubre ya está completo y no cambia.')
  await go('Exportar CSV')
  expect(saved.files.map(file => file.name)).toEqual(['zenit-uso-2026-10.csv'])
  expect(writes()).toEqual([])
})

it('el CSV del uso lleva sólo conteos y neutraliza un nombre que parece fórmula', () => {
  const item = (name: string): UsageItem => ({ id: 'x', name, slug: 'x', status: 'active', usage: { ...usageOf('t1', '2026-10') } })
  const csv = usageCsv('2026-10', [item('=SUMA(A1), S.A.'), item('Normal')], { month: '2026-10', tenants: 2, complete: 2, employeesWithAttendance: 76, employeesInPeriod: 84, cardsAssigned: 80, devicesActive: 12, attendanceEvents: 3800 })
  const lines = csv.replace('﻿', '').trim().split('\r\n')
  expect(lines[0]).toBe('Mes,Empresa,Identificador,Estado,Mes completo,Personas que marcaron,Personas vigentes,Tarjetas asignadas,Lectores activos,Marcajes')
  expect(lines[1]).toBe(`2026-10,"'=SUMA(A1), S.A.",x,Activa,sí,38,42,40,6,1900`)
  expect(lines[3]).toBe('2026-10,Total,,,sí,76,84,80,12,3800')
})

it('calcula el mes en curso en su zona, suma meses y nombra zonas', () => {
  expect(currentMonth('America/Mexico_City', new Date('2026-11-01T05:30:00Z'))).toBe('2026-10')
  expect(currentMonth('UTC', new Date('2026-11-01T05:30:00Z'))).toBe('2026-11')
  expect(addMonths('2026-01', -1)).toBe('2025-12'); expect(addMonths('2026-12', 1)).toBe('2027-01')
  expect(monthName('2026-11', true)).toBe('noviembre 2026')
  expect(zoneName('America/Mexico_City')).toBe('Ciudad de México'); expect(zoneName('America/Bahia_Banderas')).toBe('Bahia Banderas')
})

it('quien no opera el servicio no consulta empresas', async () => {
  await render('/empresas', ['rh'])
  expect(gets('/tenants')).toEqual([])
  expect(button('Dar de alta una empresa')).toBeUndefined()
})

it('en el teléfono cada empresa es una tarjeta', async () => {
  phone = true
  await render()
  const cards = [...container.querySelectorAll('main li')].map(item => item.textContent)
  expect(cards[0]).toBe('Empresa Demo Localempresa-demo-localActivaCiudad de México · lunes · comida: no se marca · 38 marcaronAdministra: mariana@demo.example · ya entró')
})

it('cumple las reglas automáticas de accesibilidad en las pantallas, la ficha y las ventanas', { timeout: 60_000 }, async () => {
  await render()
  expect(await accessibilityViolations()).toEqual([])
  await render('/empresas/uso')
  expect(await accessibilityViolations()).toEqual([])
  for (const path of ['/empresas?empresa=t1', '/empresas?empresa=t3', '/empresas?alta=1', '/empresas?empresa=t1&accion=comida', '/empresas?empresa=t1&accion=soltar', '/empresas?empresa=t2&accion=invitar', '/empresas?empresa=t1&accion=suspender']) {
    await render(path)
    expect(await accessibilityViolations(document.body), path).toEqual([])
  }
})
