// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
import { showDay, upcomingText } from './BreakPolicyChange'

it('muestra el día del calendario de la empresa sin moverlo de zona', () => {
  expect(showDay('2026-11-16')).toBe('lunes 16 de noviembre de 2026')
  expect(showDay('2027-01-04')).toBe('lunes 4 de enero de 2027')
})
it('avisa en palabras de quien marca qué cambia y desde cuándo', () => {
  expect(upcomingText({ breakPolicy: 'marked', effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z' }))
    .toBe('Desde el lunes 16 de noviembre de 2026 se marcarán el inicio y el fin de la comida.')
  expect(upcomingText({ breakPolicy: 'not_considered', effectiveOn: '2026-12-07', effectiveAt: '2026-12-07T06:00:00Z' }))
    .toBe('Desde el lunes 7 de diciembre de 2026 ya no se marcará la comida: sólo entrada y salida.')
})
