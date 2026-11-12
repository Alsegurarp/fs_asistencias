import { expect, it } from 'vitest'
import { actionText, type AuditEntry } from './auditModel'

const entry = (action: string, metadata: Record<string, string>, targetName?: string) =>
  ({ action, target: { displayName: targetName }, metadata }) as unknown as AuditEntry

it('dice en palabras los cambios de la forma de marcar', () => {
  expect(actionText(entry('employee.capture_method_changed', { from: 'card', to: 'phone' }, 'Bruno Demo'))).toBe('Cambió a Bruno Demo a marcar con su teléfono')
  expect(actionText(entry('tenant.capture_methods_changed', { to: 'card_terminal', reason: 'Contrató sólo el lector.' })))
    .toBe('Cambió el plan a tarjeta en el lector fijo: «Contrató sólo el lector.»')
  expect(actionText(entry('device.revoked', { reason: 'capture_method_changed' }))).toBe('Revocó el teléfono por el cambio a marcar con tarjeta')
  expect(actionText(entry('card.revoked', { reason: 'capture_method_changed' }))).toBe('Revocó la tarjeta por cambio a marcar con el teléfono')
  expect(actionText(entry('site.updated', { fields: 'captureMethods' }, 'Sede Centro'))).toBe('Cambió las formas de marcar de Sede Centro')
})
