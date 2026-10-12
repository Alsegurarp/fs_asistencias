import { expect, it } from 'vitest'
import { closeBody, reopenBody, runBody, runPollInterval } from './closureModel'

const employee = '11111111-1111-4111-8111-111111111111'
it('el cierre directo envía sólo los empleados elegidos y elimina duplicados', () => {
  expect(closeBody('2026-10-05', [employee, employee])).toEqual({ weekStart: '2026-10-05', employeeIds: [employee] })
})
it('no convierte una selección vacía en un cierre de toda la empresa', () => {
  expect(() => closeBody('2026-10-05', [])).toThrow('entre 1 y 500')
  expect(() => closeBody('2026-10-05', ['desconocido'])).toThrow('de la lista')
})
it('rechaza más de 500 empleados y fechas imposibles', () => {
  const ids = Array.from({ length: 501 }, (_, n) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`)
  expect(() => closeBody('2026-10-05', ids)).toThrow('500')
  expect(() => closeBody('2026-02-30', [employee])).toThrow('fecha válida')
})
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
