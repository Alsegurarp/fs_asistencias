import { describe, expect, it } from 'vitest'
import { dateInZone, resolutionBody, zonedInstants } from './incidentModel'

const eventId = 'c6167cf8-e8bb-4ea5-ade9-cd33b39e3261'
function data(values: Record<string, string>) {
  const result = new FormData()
  for (const [key, value] of Object.entries(values)) result.set(key, value)
  return result
}

describe('Resolución contra el contrato', () => {
  it.each(['justified', 'confirmed'])('envía %s sin restos de un ajuste anterior', decision => {
    expect(resolutionBody(data({ decision, reason: '  Motivo suficiente  ', kind: 'add_event', eventType: 'clock_in', occurredAt: '2026-10-12T12:00:00.000Z' }))).toEqual({ resolution: { decision, reason: 'Motivo suficiente' } })
  })
  it('agrega un marcaje sin enviar eventId', () => {
    expect(resolutionBody(data({ decision: 'adjusted', reason: 'Motivo suficiente', kind: 'add_event', eventId, eventType: 'clock_out', occurredAt: '2026-10-12T18:00:00.000Z' }))).toEqual({ resolution: { decision: 'adjusted', reason: 'Motivo suficiente', adjustment: { kind: 'add_event', eventType: 'clock_out', occurredAt: '2026-10-12T18:00:00.000Z' } } })
  })
  it('excluye un marcaje sin enviar tipo ni fecha', () => {
    expect(resolutionBody(data({ decision: 'adjusted', reason: 'Motivo suficiente', kind: 'exclude_event', eventId, eventType: 'clock_out', occurredAt: 'anterior' }))).toEqual({ resolution: { decision: 'adjusted', reason: 'Motivo suficiente', adjustment: { kind: 'exclude_event', eventId } } })
  })
  it('cambia el tipo sin enviar fecha', () => {
    expect(resolutionBody(data({ decision: 'adjusted', reason: 'Motivo suficiente', kind: 'retype_event', eventId, eventType: 'clock_out', occurredAt: 'anterior' }))).toEqual({ resolution: { decision: 'adjusted', reason: 'Motivo suficiente', adjustment: { kind: 'retype_event', eventId, eventType: 'clock_out' } } })
  })
  it.each(['corto', ' '.repeat(20), 'a'.repeat(501)])('rechaza motivos inválidos', reason => {
    expect(() => resolutionBody(data({ decision: 'confirmed', reason }))).toThrow('entre 10 y 500')
  })
  it('rechaza marcajes, tipos, decisiones y fechas inválidas', () => {
    expect(() => resolutionBody(data({ decision: 'toString', reason: 'Motivo suficiente' }))).toThrow('decisión')
    expect(() => resolutionBody(data({ decision: 'adjusted', reason: 'Motivo suficiente', kind: 'exclude_event', eventId: 'otro' }))).toThrow('marcaje')
    expect(() => resolutionBody(data({ decision: 'adjusted', reason: 'Motivo suficiente', kind: 'add_event', eventType: 'toString' }))).toThrow('tipo de marcaje')
    expect(() => resolutionBody(data({ decision: 'adjusted', reason: 'Motivo suficiente', kind: 'add_event', eventType: 'clock_out', occurredAt: '2026-02-30T12:00:00.000Z' }))).toThrow('fecha y hora')
  })
})

describe('Hora de la empresa', () => {
  it('convierte México y un desplazamiento de media hora sin usar la zona del navegador', () => {
    expect(zonedInstants('2026-10-12T08:30:15', 'America/Mexico_City')).toEqual(['2026-10-12T14:30:15.000Z'])
    expect(zonedInstants('2026-10-12T08:30', 'Asia/Kolkata')).toEqual(['2026-10-12T03:00:00.000Z'])
    expect(dateInZone('2026-10-12T03:00:00Z', 'America/Mexico_City')).toBe('2026-10-11')
  })
  it('no convierte silenciosamente una hora inexistente por cambio horario', () => {
    expect(zonedInstants('2026-03-08T02:30', 'America/New_York')).toEqual([])
  })
  it('ofrece las dos ocurrencias de una hora repetida', () => {
    expect(zonedInstants('2026-11-01T01:30', 'America/New_York')).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z'])
  })
  it('rechaza fechas imposibles y entradas incompletas', () => {
    expect(zonedInstants('2026-02-30T12:00', 'America/Mexico_City')).toEqual([])
    expect(zonedInstants('', 'America/Mexico_City')).toEqual([])
  })
})
