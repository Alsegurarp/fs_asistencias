import { expect, it } from 'vitest'
import { type PersonWeek, type ScheduleDay, type WeekRow, attentionFlags, csv, dayLines, delay, hours, scheduleSummary, shortHash, weekLabel, weekProgress } from './attendanceModel'

it('escribe minutos como horas y minutos', () => {
  expect([hours(1920), hours(190), hours(0), hours(5), hours(-65)]).toEqual(['32:00', '3:10', '0:00', '0:05', '-1:05'])
})

it('nombra la semana aunque cruce de mes o de año', () => {
  expect(weekLabel('2026-11-02')).toBe('2 – 8 nov 2026')
  expect(weekLabel('2026-10-26')).toBe('26 oct – 1 nov 2026')
  expect(weekLabel('2025-12-29')).toBe('29 dic 2025 – 4 ene 2026')
})

it('dice cuánto de la semana ya pasó', () => {
  expect(weekProgress('2026-11-02', '2026-11-06')).toBe('lunes a jueves completos, viernes en curso')
  expect(weekProgress('2026-11-02', '2026-11-03')).toBe('lunes completo, martes en curso')
  expect(weekProgress('2026-11-02', '2026-11-02')).toBe('lunes en curso')
  expect(weekProgress('2026-10-26', '2026-11-06')).toBe('semana terminada')
})

it('resume un horario por sus días', () => {
  const day = (dayOfWeek: ScheduleDay['dayOfWeek'], startTime = '08:00', endTime = '16:00'): ScheduleDay => ({ dayOfWeek, startTime, endTime, breakMinutes: 0 })
  expect(scheduleSummary({ id: 'h', name: 'Matutino', days: (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const).map(name => day(name)) })).toBe('L–S 08:00–16:00')
  expect(scheduleSummary({ id: 'h', name: 'Partido', days: [day('monday'), day('wednesday'), day('friday', '09:00')] })).toBe('L, Mi, V · horario por día')
  expect(scheduleSummary({ id: 'h', name: 'Nocturno', days: [day('friday', '22:00', '06:00'), day('saturday', '22:00', '06:00')] })).toBe('V, S 22:00–06:00')
})

it('un turno que cruza la medianoche con un descanso es una sola jornada, del día en que empezó', () => {
  const week: PersonWeek = {
    employeeId: 'e', weekStart: '2026-11-02', timeZone: 'America/Mexico_City', ruleSet: { id: 'r', version: 1 }, openIncidentIds: [], closure: null, alerts: [],
    totals: { workedMinutes: 450, breakMinutes: 30, ordinaryMinutes: 420, overtimeMinutes: 30 },
    segments: [
      // Martes 22:00 a miércoles 05:30, hora del centro, con descanso de 01:00 a 01:30.
      { id: 'a', kind: 'work', startAt: '2026-11-04T04:00:00Z', endAt: '2026-11-04T07:00:00Z', minutes: 180 },
      { id: 'b', kind: 'break', startAt: '2026-11-04T07:00:00Z', endAt: '2026-11-04T07:30:00Z', minutes: 30 },
      { id: 'c', kind: 'work', startAt: '2026-11-04T07:30:00Z', endAt: '2026-11-04T11:30:00Z', minutes: 240 },
      // Jueves: entró y no salió; ya no es su turno.
      { id: 'd', kind: 'work', startAt: '2026-11-05T14:00:00Z', endAt: null, minutes: 0 },
    ],
  }
  expect(dayLines(week, undefined, '2026-11-06', false, new Date('2026-11-06T16:00:00Z'))).toEqual([
    { date: '2026-11-03', range: '22:00 – 05:30', workedMinutes: 420, state: 'done' },
    { date: '2026-11-05', range: '08:00 – sin salida', workedMinutes: 0, state: 'missing' },
  ])
})

it('lo que pide atención va primero; el turno en curso no es un tramo sin salida', () => {
  const base: WeekRow = { employeeId: 'e', externalId: '1', displayName: 'P', siteId: null, scheduleId: null, ruleSet: { id: 'r', version: 1 }, closure: null, today: null,
    totals: { workedMinutes: 600, breakMinutes: 0, ordinaryMinutes: 480, overtimeMinutes: 120 }, openIncidents: [],
    alerts: [{ code: 'open_segment', severity: 'warning', message: '' }, { code: 'daily_combined_limit_exceeded', severity: 'critical', message: '' }] }
  expect(attentionFlags(base).map(flag => flag.label)).toEqual(['Tramo sin salida', 'Tope diario excedido', 'Tiempo extra'])
  expect(attentionFlags({ ...base, today: { state: 'on_shift', since: null, lastMarkAt: null } }).map(flag => flag.label)).toEqual(['Tope diario excedido', 'Tiempo extra'])
  expect(attentionFlags({ ...base, alerts: [{ code: 'codigo_nuevo', severity: 'critical', message: '' }], totals: { ...base.totals, overtimeMinutes: 0 } })).toEqual([])
})

it('el CSV escapa comillas y neutraliza fórmulas', () => {
  expect(csv([['=1+1', 'a,b', 'dijo "hola"', '-5', null]])).toBe('﻿\'=1+1,"a,b","dijo ""hola""",\'-5,\r\n')
  expect(shortHash(`9f3a${'0'.repeat(56)}c21e`)).toBe('9f3a…c21e')
})

it('dice cuánto tardó en llegar una marca en la unidad que se lee', () => {
  expect([delay(360), delay(3600), delay(56_700), delay(3 * 86_400)]).toEqual(['6 min', '1 h', '15 h 45 min', '3 días'])
})
