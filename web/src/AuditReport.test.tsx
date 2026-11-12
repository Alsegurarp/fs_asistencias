// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

type Call = { path: string; method: string; body?: unknown }
const server = vi.hoisted(() => ({ calls: [] as Call[], pending: 0, handler: (call: Call): Promise<unknown> => new Promise(() => call) }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn(), tokenParsed: { sub: 'kc-self' } }, identityBase: 'http://localhost:8082' }))
vi.mock('./files', () => ({ saveFile: vi.fn() }))
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
import { saveFile } from './files'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { click, waitFor } from './testUi'
import { type AuditEntry, actionText } from './auditModel'

const person = (name: string) => ({ type: 'user' as const, id: `u-${name}`, displayName: name })
const system = { type: 'system' as const, id: null, displayName: null }
const entry = (id: string, at: string, actor: AuditEntry['actor'], action: string, target: string | null, metadata: Record<string, string> = {}, type = 'employee'): AuditEntry =>
  ({ id, at, actor, action, target: { type, id: `t-${id}`, displayName: target }, correlationId: `c-${id}`, metadata })
const entries = [
  entry('a1', '2026-10-31T00:40:00Z', person('Rocío Navarro'), 'incident.resolved', 'Jorge Ramírez', { decision: 'adjusted' }, 'incident'),
  entry('a2', '2026-10-30T22:05:00Z', system, 'incident.opened', 'Teresa Lugo', { type: 'clock_anomaly' }, 'incident'),
  entry('a3', '2026-10-28T15:15:00Z', person('Claudia Ríos'), 'user.linked', 'Claudia Ríos', {}, 'user'),
  entry('a4', '2026-10-27T16:02:00Z', person('Rocío Navarro'), 'export.requested', null, { weekStart: '2026-10-19', format: 'csv' }, 'export'),
]
let summary = { total: 4, capped: false, cap: 10000 }

function defaultServer({ path }: Call): Promise<unknown> {
  const url = new URL(path, 'http://zenit.test')
  const answer = (value: unknown) => Promise.resolve(value)
  switch (url.pathname) {
    case '/me/dossier-permission': return answer({ enabled: false })
    case '/incidents/summary': return answer({ open: { total: 0 } })
    case '/audit-log/summary': return answer(summary)
    case '/audit-log': return answer({ items: url.searchParams.get('actorType') === 'device' ? [] : entries, nextCursor: null })
    case '/employees': return answer({ items: [{ id: 'e1', displayName: 'Jorge Ramírez', externalId: '0192', status: 'active' }], nextCursor: null })
  }
  return Promise.reject(new ApiError(404, 'not_found', `Sin respuesta simulada para ${path}`))
}

let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
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
  server.calls = []; server.pending = 0; server.handler = defaultServer; summary = { total: 4, capped: false, cap: 10000 }
  vi.mocked(saveFile).mockClear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, onchange: null,
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
async function render(path = '/reportes/bitacora', roles = ['auditor']) {
  const me: Me = { userId: 'self', displayName: 'Ernesto Salas', roles, tenant: { name: 'Empresa Demo', timeZone: 'America/Mexico_City' }, employeeId: null }
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={me} onSignOut={vi.fn()} /><Where /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await settle()
}
const text = () => container.textContent || ''
const rows = (scope: ParentNode = container) => [...scope.querySelectorAll('table tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
const lists = () => server.calls.filter(call => call.path.startsWith('/audit-log?')).map(call => new URL(call.path, 'http://zenit.test').searchParams)

it('cada acción se dice en una frase con lo que trae', () => {
  expect(actionText(entries[0])).toBe('Resolvió como ajustada una incidencia de Jorge Ramírez')
  expect(actionText(entries[1])).toBe('Abrió «Anomalía de reloj» de Teresa Lugo')
  expect(actionText(entries[3])).toBe('Pidió el exporte de 19 – 25 oct')
  expect(actionText(entry('x', '', person('Mariana Ortiz'), 'tenant.break_policy_change_scheduled', null, { breakPolicy: 'marked', effectiveOn: '2026-11-16' }))).toBe('Programó que la comida se marque desde el lun 16 nov')
  expect(actionText(entry('x', '', person('Mariana Ortiz'), 'user.roles_changed', 'Hugo Peña', { added: 'auditor', removed: 'supervisor' }))).toBe('Cambió los roles de Hugo Peña: agregó Auditoría; quitó Supervisión')
  expect(actionText(entry('x', '', person('Rocío'), 'card.revoked', 'T-0019', { reason: 'lost' }))).toBe('Revocó la tarjeta T-0019 por pérdida')
  expect(actionText(entry('x', '', person('Rocío'), 'import.applied', null, { total: '12', accepted: '10' }))).toBe('Importó un CSV del padrón: 10 de 12 filas aplicadas')
  expect(actionText(entry('x', '', person('Rocío'), 'algo.nuevo', 'Ana'))).toBe('algo.nuevo · Ana')
})

it('muestra los últimos 30 días con su cuenta, quién y la acción', async () => {
  await render()
  const params = lists()[0]
  expect(params.get('from')).toBe('2026-10-11T06:00:00.000Z')
  expect(params.get('to')).toBe('2026-11-11T06:00:00.000Z')
  expect(text()).toContain('4 acciones con estos filtros')
  expect(rows()).toEqual([
    ['30 oct 18:40', 'Rocío Navarro', 'Resolvió como ajustada una incidencia de Jorge Ramírez'],
    ['30 oct 16:05', 'Sistema', 'Abrió «Anomalía de reloj» de Teresa Lugo'],
    ['28 oct 09:15', 'Claudia Ríos', 'Entró por primera vez'],
    ['27 oct 10:02', 'Rocío Navarro', 'Pidió el exporte de 19 – 25 oct'],
  ])
})

it('los filtros van al servidor y se quitan juntos', async () => {
  await render()
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Quién actuó"] button')].find(item => item.textContent === 'Lectores')!.click())
  await settle()
  expect(location).toContain('quien=device')
  expect(lists().at(-1)!.get('actorType')).toBe('device')
  expect(text()).toContain('Ninguna acción con estos filtros')
  await render('/reportes/bitacora?accion=incidents&desde=2026-10-01&hasta=2026-10-31')
  expect(lists().at(-1)!.get('group')).toBe('incidents')
  expect(lists().at(-1)!.get('from')).toBe('2026-10-01T06:00:00.000Z')
  expect(lists().at(-1)!.get('to')).toBe('2026-11-01T06:00:00.000Z')
  await click('Quitar filtros'); await settle()
  expect(location).toBe('/reportes/bitacora')
})

it('un periodo al revés no consulta', async () => {
  await render('/reportes/bitacora?desde=2026-11-05&hasta=2026-11-01')
  expect(text()).toContain('«Desde» va antes de «Hasta».')
  expect(lists()).toEqual([])
})

it('la vista previa lleva la lista completa a la hoja y al CSV', async () => {
  await render()
  await click('Ver vista previa'); await settle()
  const sheet = document.querySelector('.zenit-print-root')!
  expect(sheet.textContent).toContain('Bitácora · 11 oct 2026 – 10 nov 2026')
  expect(sheet.textContent).toContain('4 acciones · todas las acciones · todos')
  expect(rows(sheet)).toHaveLength(4)
  await click('Descargar PDF')
  expect(window.print).toHaveBeenCalledOnce()
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Formato"] button')][1].click())
  await click('Descargar CSV')
  const [blob, name] = vi.mocked(saveFile).mock.calls[0]
  expect(name).toBe('zenit-bitacora-2026-10-11-2026-11-10.csv')
  // La marca de orden de bytes va primero, para que una hoja de cálculo lea bien los acentos.
  expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const lines = (await blob.text()).split('\r\n')
  expect(lines[0]).toBe('fecha_hora,zona_horaria,tipo_de_actor,quien,accion,codigo_de_accion,tipo_de_objeto,objeto,referencia')
  expect(lines[1]).toBe('2026-10-31T00:40:00Z,America/Mexico_City,user,Rocío Navarro,Resolvió como ajustada una incidencia de Jorge Ramírez,incident.resolved,incident,Jorge Ramírez,c-a1')
})

it('con demasiadas acciones pide acotar antes de armar la hoja', async () => {
  summary = { total: 10000, capped: true, cap: 10000 }
  await render('/reportes/bitacora?vista=previa')
  expect(text()).toContain('Con estos filtros hay más de 10,000 acciones')
  expect(server.calls.some(call => call.path.includes('limit=200'))).toBe(false)
})

it('RH no ve la bitácora', async () => {
  await render('/reportes/bitacora', ['rh'])
  expect(text()).toContain('Esta sección no está disponible para tu rol')
  expect(lists()).toEqual([])
})

it('cumple las reglas automáticas de accesibilidad en la lista y en la vista previa', { timeout: 30_000 }, async () => {
  await render()
  expect(await accessibilityViolations()).toEqual([])
  await render('/reportes/bitacora?vista=previa')
  await waitFor(() => !text().includes('Cargando'))
  expect(await accessibilityViolations()).toEqual([])
})
