import { expect, it } from 'vitest'
import { type BlockingIncident, acknowledgementBadge, blockedLabels, blockedPeople, reopenBody, runBody, runPollInterval, runProcessed } from './closureModel'

const employee = '11111111-1111-4111-8111-111111111111'
it('la corrida usa toda la empresa o la sede elegida', () => {
  expect(runBody('2026-10-05', '')).toEqual({ weekStart: '2026-10-05' })
  expect(runBody('2026-10-05', employee)).toEqual({ weekStart: '2026-10-05', siteId: employee })
  expect(() => runBody('', employee)).toThrow('fecha válida')
})
it('la reapertura exige un motivo válido después de quitar espacios', () => {
  expect(reopenBody('  Corregir un marcaje faltante.  ')).toEqual({ reason: 'Corregir un marcaje faltante.' })
  expect(() => reopenBody('corto')).toThrow('10 y 500')
  expect(() => reopenBody(' '.repeat(20))).toThrow('10 y 500')
  expect(() => reopenBody('a'.repeat(501))).toThrow('10 y 500')
})
it.each(['queued', 'running'])('consulta cada cinco segundos en %s', status => {
  expect(runPollInterval(status, null)).toBe(5000)
})
it.each(['done', 'failed', undefined])('detiene el seguimiento en %s', status => {
  expect(runPollInterval(status, null)).toBe(false)
})
it('pausa el seguimiento ante un error de red, permisos o cuota', () => {
  expect(runPollInterval('running', new Error('429'))).toBe(false)
})

it('el acuse de un cierre: conforme, con objeción, sin acuse o reabierta', () => {
  expect(acknowledgementBadge({ status: 'closed', acknowledgement: { type: 'agreed', note: null, at: 'x' } }).label).toBe('Conforme')
  expect(acknowledgementBadge({ status: 'closed', acknowledgement: { type: 'objected', note: 'Faltó', at: 'x' } })).toEqual({ label: 'Objeción', tone: 'error' })
  expect(acknowledgementBadge({ status: 'closed', acknowledgement: null }).label).toBe('Sin acuse')
  // Reabierta, el acuse ya no vale.
  expect(acknowledgementBadge({ status: 'reopened', acknowledgement: { type: 'agreed', note: null, at: 'x' } }).label).toBe('Reabierta')
})

it('agrupa por persona las incidencias que bloquean, la más antigua primero', () => {
  const incident = (id: string, employeeId: string | null, employeeName: string, occurredAt: string): BlockingIncident =>
    ({ id, type: 'duplicate', employeeId, employeeName, siteId: 's1', occurredAt, openedAt: occurredAt, assigneeUserId: null })
  const people = blockedPeople([
    incident('a', 'e2', 'Teresa Lugo', '2026-10-30T15:00:00Z'), incident('b', 'e1', 'Marco Ibarra', '2026-10-28T15:00:00Z'),
    incident('c', 'e2', 'Teresa Lugo', '2026-10-27T15:00:00Z'), incident('d', null, 'Sin persona', '2026-10-26T15:00:00Z'),
  ])
  expect(people.map(person => [person.name, person.incidents.length, person.since])).toEqual([['Teresa Lugo', 2, '2026-10-27T15:00:00Z'], ['Marco Ibarra', 1, '2026-10-28T15:00:00Z']])
  expect(runProcessed({ closed: 25, blocked: { openIncidents: 1, openSegment: 1 } } as Parameters<typeof runProcessed>[0])).toBe(27)
})

it('distingue por sede a las bloqueadas que se llaman igual', () => {
  const person = (employeeId: string, name: string, siteId: string | null) => ({ employeeId, name, siteId, incidents: [], since: '2026-10-30T15:00:00Z' })
  const sites: Record<string, string> = { s1: 'Matriz Centro', s2: 'Bodega Norte' }
  expect(blockedLabels([person('e1', 'Ana Ruiz', 's1'), person('e2', 'Ana Ruiz', 's2'), person('e3', 'Ana Ruiz', null), person('e4', 'Iván Cruz', 's1')], id => (id ? sites[id] : undefined)))
    .toEqual({ e1: 'Ana Ruiz (Matriz Centro)', e2: 'Ana Ruiz (Bodega Norte)', e3: 'Ana Ruiz (sin sede)', e4: 'Iván Cruz' })
})
