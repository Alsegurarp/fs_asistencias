import { expect, it } from 'vitest'
import type { ScheduleDay } from './attendanceModel'
import {
  assignmentPreview, breakText, dayCells, daysText, hoursAndMinutes, hoursText, isCurrent, personStatus, scheduleBody, shiftKind, validityText, weeklyMinutes, weekDays, type DayDraft,
} from './personnelModel'

const day = (dayOfWeek: ScheduleDay['dayOfWeek'], startTime: string, endTime: string, breakMinutes = 0): ScheduleDay => ({ dayOfWeek, startTime, endTime, breakMinutes })
const weekdays = (start: string, end: string, breakMinutes = 60) => (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const).map(name => day(name, start, end, breakMinutes))

it('resume los días, el horario y la comida como el lienzo', () => {
  expect(daysText(weekdays('09:00', '18:00'))).toBe('L a V')
  expect(daysText([...weekdays('08:00', '16:00'), day('saturday', '08:00', '16:00')])).toBe('L a S')
  expect(daysText([day('monday', '9:00', '18:00'), day('wednesday', '9:00', '18:00'), day('friday', '9:00', '18:00')])).toBe('L, Mi y V')
  expect(daysText(weekDays.map(item => day(item.key, '08:00', '16:00')))).toBe('Todos los días')
  expect(hoursText(weekdays('09:00', '18:00'))).toBe('09:00 – 18:00')
  expect(hoursText(weekdays('22:00', '05:00'))).toBe('22:00 – 05:00 (día siguiente)')
  expect(hoursText([day('monday', '09:00', '18:00'), day('saturday', '09:00', '14:00')])).toBe('Varía por día')
  expect(breakText(weekdays('09:00', '18:00', 60))).toBe('60 min')
  expect(breakText(weekdays('09:00', '18:00', 0))).toBe('Sin comida')
})

it('clasifica la jornada por las horas entre las 20:00 y las 06:00', () => {
  expect(shiftKind(weekdays('09:00', '18:00'))).toBe('Diurna')
  expect(shiftKind(weekdays('14:00', '21:30'))).toBe('Mixta')
  expect(shiftKind(weekdays('22:00', '05:00'))).toBe('Nocturna')
  // Tres horas y media nocturnas ya es nocturna.
  expect(shiftKind(weekdays('16:30', '23:30'))).toBe('Nocturna')
  expect(shiftKind(weekdays('17:00', '23:29'))).toBe('Mixta')
})

it('cuenta las horas de la semana sin la comida, también si el turno cruza la medianoche', () => {
  expect(weeklyMinutes(weekdays('09:00', '18:00', 60))).toBe(2400)
  expect(hoursAndMinutes(weeklyMinutes(weekdays('09:00', '17:00', 30)))).toBe('37 h 30')
  expect(hoursAndMinutes(weeklyMinutes(weekdays('22:00', '05:00', 30)))).toBe('32 h 30')
})

it('dice la vigencia y si un horario sigue vigente', () => {
  expect(validityText('2026-09-01', null)).toBe('desde 1 sep 2026')
  expect(validityText('2026-01-01', '2026-08-31')).toBe('1 ene – 31 ago 2026')
  expect(validityText('2025-12-01', '2026-01-31')).toBe('1 dic 2025 – 31 ene 2026')
  expect(isCurrent({ validTo: null }, '2026-11-09')).toBe(true)
  expect(isCurrent({ validTo: '2026-11-09' }, '2026-11-09')).toBe(true)
  expect(isCurrent({ validTo: '2026-11-08' }, '2026-11-09')).toBe(false)
})

it('el estado de una persona distingue alta reciente, ingreso futuro y baja', () => {
  expect(personStatus({ status: 'active', employmentStart: '2026-09-01', employmentEnd: null }, '2026-11-09')).toEqual({ label: 'Activa', tone: 'ok' })
  expect(personStatus({ status: 'active', employmentStart: '2026-11-02', employmentEnd: null }, '2026-11-09')).toEqual({ label: 'Alta reciente', tone: 'info' })
  expect(personStatus({ status: 'active', employmentStart: '2026-11-16', employmentEnd: null }, '2026-11-09').label).toBe('Ingresa lun 16 nov')
  expect(personStatus({ status: 'inactive', employmentStart: '2026-01-05', employmentEnd: '2026-11-06' }, '2026-11-09')).toEqual({ label: 'Baja vie 6 nov', tone: 'neutral' })
})

it('al asignar desde una fecha muestra qué horario aplica en cada periodo', () => {
  expect(assignmentPreview({ name: 'Oficina L–V' }, 'Matutino 5 días', '2026-11-16')).toEqual([
    { period: 'Hasta el dom 15 nov', schedule: 'Oficina L–V' }, { period: 'Desde el lun 16 nov', schedule: 'Matutino 5 días' },
  ])
  expect(assignmentPreview(null, 'Mixto', '2026-11-16')).toEqual([{ period: 'Desde el lun 16 nov', schedule: 'Mixto' }])
})

it('arma el horario nuevo y dice qué falta', () => {
  const drafts: DayDraft[] = weekDays.map(item => ({ dayOfWeek: item.key, on: ['monday', 'tuesday'].includes(item.key), startTime: '09:00', endTime: '18:00', breakMinutes: '60' }))
  const ok = scheduleBody(' Oficina ', 'America/Mexico_City', '2026-11-16', '', drafts)
  expect(ok.errors).toEqual({})
  expect(ok.body).toEqual({ name: 'Oficina', timeZone: 'America/Mexico_City', validFrom: '2026-11-16',
    days: [{ dayOfWeek: 'monday', startTime: '09:00', endTime: '18:00', breakMinutes: 60 }, { dayOfWeek: 'tuesday', startTime: '09:00', endTime: '18:00', breakMinutes: 60 }] })
  const bad = scheduleBody('', 'America/Mexico_City', '2026-11-16', '2026-11-01', drafts.map(item => ({ ...item, on: item.dayOfWeek === 'monday', endTime: '09:00' })))
  expect(Object.keys(bad.errors).sort()).toEqual(['monday', 'name', 'validTo'])
  expect(scheduleBody('X', 'z', '2026-11-16', '', drafts.map(item => ({ ...item, on: false }))).errors.days).toBe('Elige al menos un día.')
  expect(scheduleBody('X', 'z', '2026-11-16', '', drafts.map(item => ({ ...item, breakMinutes: '600' }))).errors.monday).toBe('La comida debe durar menos que el turno.')
})

it('los días de la ficha se leen como en el lienzo', () => {
  expect(dayCells({ days: weekdays('09:00', '18:00') }).map(cell => `${cell.letter} ${cell.text}`)).toEqual(['L 9–18', 'M 9–18', 'M 9–18', 'J 9–18', 'V 9–18', 'S —', 'D —'])
  expect(dayCells({ days: [day('monday', '14:00', '21:30')] })[0].text).toBe('14–21:30')
})
