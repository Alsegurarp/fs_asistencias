import { expect, it } from 'vitest'
import {
  cardCount, cardFilters, cardHolder, cardSince, cardStatus, deviceCount, deviceFilters, deviceName, deviceStatus, fingerprintError, readText, revocable, sinceText,
} from './devicesModel'

const now = new Date('2026-11-10T16:42:00Z')
const zone = 'America/Mexico_City'

it('nombra al lector por su etiqueta, por la persona de su teléfono o por su modelo', () => {
  expect(deviceName({ mode: 'terminal', label: 'Terminal Recepción', model: 'SM-T220', employeeName: null })).toBe('Terminal Recepción')
  expect(deviceName({ mode: 'personal', label: null, model: 'SM-S928B', employeeName: 'Hugo Peña' })).toBe('Teléfono de Hugo Peña')
  expect(deviceName({ mode: 'terminal', label: null, model: 'SM-T220', employeeName: null })).toBe('Terminal · SM-T220')
})

it('la última señal se dice en minutos, horas o días, y más de 24 h es sin señal', () => {
  expect(sinceText('2026-11-10T16:41:40Z', now)).toBe('hace un momento')
  expect(sinceText('2026-11-10T16:39:00Z', now)).toBe('hace 3 min')
  expect(sinceText('2026-11-09T14:42:00Z', now)).toBe('hace 26 h')
  expect(sinceText('2026-11-06T16:42:00Z', now)).toBe('hace 4 días')
  expect(sinceText(null, now)).toBe('sin señal todavía')
  expect(deviceStatus({ status: 'active', lastSeenAt: '2026-11-10T16:39:00Z' }, now)).toEqual({ label: 'Activo', tone: 'ok' })
  expect(deviceStatus({ status: 'active', lastSeenAt: '2026-11-09T14:42:00Z' }, now)).toEqual({ label: 'Sin señal', tone: 'warn' })
  expect(deviceStatus({ status: 'active', lastSeenAt: null }, now).label).toBe('Sin señal')
  expect(deviceStatus({ status: 'replaced', lastSeenAt: null }, now).label).toBe('Reemplazado')
})

it('las cifras de lectores y tarjetas salen del resumen del servidor', () => {
  const devices = { active: 6, silent: 1, revoked: 2, replaced: 1 }
  expect(deviceFilters.map(filter => deviceCount(filter, devices))).toEqual([6, 1, 3])
  const cards = { total: 62, byStatus: { inventory: 12, assigned: 1, active: 39, lost: 3, damaged: 1, revoked: 4, replaced: 2 } }
  expect(cardFilters.map(filter => cardCount(filter, cards))).toEqual([62, 40, 12, 4, 4, 2])
  expect(cardCount(cardFilters[0], undefined)).toBeUndefined()
})

it('dice quién tiene la tarjeta o quién la tuvo y hasta cuándo', () => {
  const active = { assignment: { employeeId: 'e1', employeeName: 'Paola Ruiz', employeeExternalId: '0211', since: '2026-09-02T15:00:00Z' }, latestAssignment: null }
  expect(cardHolder(active)).toEqual({ text: 'Paola Ruiz · 0211', past: false })
  const lost = { assignment: null, latestAssignment: { employeeId: 'e2', employeeName: 'Luis Hernández', employeeExternalId: '0114', since: '2026-09-01T15:00:00Z', until: '2026-10-22T17:00:00Z' } }
  expect(cardHolder(lost)).toEqual({ text: 'Antes: Luis Hernández', past: true })
  expect(cardHolder({ assignment: null, latestAssignment: null })).toBeNull()
  expect(cardSince({ ...lost, createdAt: '2026-09-01T00:00:00Z' })).toBe('2026-10-22T17:00:00Z')
  expect(cardSince({ assignment: null, latestAssignment: null, createdAt: '2026-09-01T00:00:00Z' })).toBe('2026-09-01T00:00:00Z')
})

it('sólo se revoca lo que está en uso o en inventario', () => {
  expect(['inventory', 'assigned', 'active', 'lost', 'damaged', 'revoked', 'replaced'].filter(revocable)).toEqual(['inventory', 'assigned', 'active'])
  expect(cardStatus('lost')).toEqual({ label: 'Perdida', tone: 'error' })
  expect(cardStatus('assigned').label).toBe('Activa')
})

it('la última lectura dice hoy con la hora, o la fecha', () => {
  expect(readText('2026-11-10T14:59:00Z', zone, '2026-11-10')).toBe('hoy 08:59')
  expect(readText('2026-11-03T14:59:00Z', zone, '2026-11-10')).toBe('3 nov 2026 · 08:59')
})

it('la huella va sin espacios y de 16 a 128 caracteres', () => {
  expect(fingerprintError('')).toBe('Escribe la huella de la tarjeta.')
  expect(fingerprintError('abc def ghi jkl mno')).toBe('La huella no lleva espacios.')
  expect(fingerprintError('a'.repeat(15))).toBe('La huella lleva de 16 a 128 caracteres.')
  expect(fingerprintError('a'.repeat(16))).toBe('')
})
