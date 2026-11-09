import type { Employee } from './api'
import { addDays, dayMonth, type DayOfWeek, type Schedule, type ScheduleDay } from './attendanceModel'
import type { Tone } from './ui'

/** Lo que Personal y horarios (PAD-01, PAD-03, PAD-07, PAD-08, PAD-10) muestran sin llamar al API. */

export type ScheduleWithValidity = Schedule & { timeZone: string; validFrom: string; validTo: string | null }
export type Assignment = { id: string; employeeId: string; scheduleId: string; validFrom: string; validTo: string | null }
export type EmployeeSummary = { total: number; active: number; inactive: number; withoutCard: number; withoutSchedule: number; bySchedule: { scheduleId: string; people: number }[] }
export type Checkpoint = { sourceId: string; type: 'csv' | 'api' | 'connector'; status: 'active' | 'paused' | 'error'; cursor: string | null; sourceVersion: string | null; updatedAt: string }

export const weekDays: { key: DayOfWeek; short: string; letter: string; long: string }[] = [
  { key: 'monday', short: 'L', letter: 'L', long: 'Lunes' }, { key: 'tuesday', short: 'M', letter: 'M', long: 'Martes' },
  { key: 'wednesday', short: 'Mi', letter: 'M', long: 'Miércoles' }, { key: 'thursday', short: 'J', letter: 'J', long: 'Jueves' },
  { key: 'friday', short: 'V', letter: 'V', long: 'Viernes' }, { key: 'saturday', short: 'S', letter: 'S', long: 'Sábado' },
  { key: 'sunday', short: 'D', letter: 'D', long: 'Domingo' },
]

const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
/** Minutos de un turno; si la salida es antes que la entrada, termina al día siguiente. */
export function shiftMinutes(day: Pick<ScheduleDay, 'startTime' | 'endTime'>) {
  const span = minutes(day.endTime) - minutes(day.startTime)
  return span > 0 ? span : span + 1440
}
export function crossesMidnight(day: Pick<ScheduleDay, 'startTime' | 'endTime'>) { return minutes(day.endTime) <= minutes(day.startTime) }

/** «L a V», «L a S», «L, Mi y V» o «Todos los días». */
export function daysText(days: Pick<ScheduleDay, 'dayOfWeek'>[]) {
  const index = days.map(day => weekDays.findIndex(item => item.key === day.dayOfWeek)).filter(i => i >= 0).sort((a, b) => a - b)
  if (index.length === 7) return 'Todos los días'
  if (!index.length) return 'Sin días'
  const consecutive = index.every((value, i) => i === 0 || value === index[i - 1] + 1)
  if (consecutive && index.length > 2) return `${weekDays[index[0]].short} a ${weekDays[index.at(-1)!].short}`
  const names = index.map(i => weekDays[i].short)
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

/** El horario más común de sus días: «09:00 – 18:00», o «Varía» si cambia. */
export function hoursText(days: Pick<ScheduleDay, 'startTime' | 'endTime'>[]) {
  const shapes = new Set(days.map(day => `${day.startTime}–${day.endTime}`))
  if (shapes.size !== 1) return 'Varía por día'
  return `${days[0].startTime} – ${days[0].endTime}${crossesMidnight(days[0]) ? ' (día siguiente)' : ''}`
}

export function breakText(days: Pick<ScheduleDay, 'breakMinutes'>[]) {
  const values = new Set(days.map(day => day.breakMinutes))
  if (values.size !== 1) return 'Varía'
  const value = days[0]?.breakMinutes ?? 0
  return value ? `${value} min` : 'Sin comida'
}

/**
 * Jornada por las horas que caen entre las 20:00 y las 06:00 (LFT art. 60):
 * ninguna, diurna; tres horas y media o más, nocturna; menos, mixta. Si sus
 * días no coinciden, la de más horas nocturnas.
 */
export type Shift = 'Diurna' | 'Mixta' | 'Nocturna'
export function shiftKind(days: Pick<ScheduleDay, 'startTime' | 'endTime'>[]): Shift {
  let worst = 0
  for (const day of days) {
    const start = minutes(day.startTime)
    let night = 0
    for (let at = start; at < start + shiftMinutes(day); at++) {
      const clock = at % 1440
      if (clock >= 1200 || clock < 360) night++
    }
    worst = Math.max(worst, night)
  }
  return worst === 0 ? 'Diurna' : worst >= 210 ? 'Nocturna' : 'Mixta'
}

/** Horas de trabajo por semana, sin la comida: 2250 → «37 h 30». */
export function weeklyMinutes(days: ScheduleDay[]) { return days.reduce((sum, day) => sum + Math.max(0, shiftMinutes(day) - day.breakMinutes), 0) }
export function hoursAndMinutes(total: number) { const m = total % 60; return `${Math.floor(total / 60)} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` }

const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** «1 sep 2026». */
export function shortDate(date: string) { const [y, m, d] = date.split('-').map(Number); return `${d} ${monthNames[m - 1]} ${y}` }

/** «desde 1 sep 2026» o «1 ene – 31 ago 2026». */
export function validityText(from: string, to: string | null) {
  if (!to) return `desde ${shortDate(from)}`
  return from.slice(0, 4) === to.slice(0, 4) ? `${shortDate(from).replace(/ \d{4}$/, '')} – ${shortDate(to)}` : `${shortDate(from)} – ${shortDate(to)}`
}

/** Un horario vigente hoy o por empezar; uno que ya terminó es histórico. */
export function isCurrent(schedule: { validTo: string | null }, today: string) { return !schedule.validTo || schedule.validTo >= today }

export const sources: Record<Employee['source'], string> = { manual: 'Manual', csv: 'CSV', api: 'API', connector: 'Conector' }

/** Recién dada de alta: ingresó en las últimas dos semanas. */
export function personStatus(employee: Pick<Employee, 'status' | 'employmentStart' | 'employmentEnd'>, today: string): { label: string; tone: Tone } {
  if (employee.status !== 'active') return { label: employee.employmentEnd ? `Baja ${dayMonth(employee.employmentEnd)}` : 'Dada de baja', tone: 'neutral' }
  if (employee.employmentStart > today) return { label: `Ingresa ${dayMonth(employee.employmentStart)}`, tone: 'info' }
  if (employee.employmentStart >= addDays(today, -14)) return { label: 'Alta reciente', tone: 'info' }
  return { label: 'Activa', tone: 'ok' }
}

/** El horario que aplica cada periodo al asignar uno nuevo desde una fecha (PAD-08). */
export function assignmentPreview(current: { name: string; validFrom?: string } | null, next: string, from: string) {
  const rows: { period: string; schedule: string }[] = []
  if (current) rows.push({ period: `Hasta el ${dayMonth(addDays(from, -1))}`, schedule: current.name })
  rows.push({ period: `Desde el ${dayMonth(from)}`, schedule: next })
  return rows
}

export type DayDraft = { dayOfWeek: DayOfWeek; on: boolean; startTime: string; endTime: string; breakMinutes: string }

/** El cuerpo de `POST /schedules` y lo que falta, campo por campo. */
export function scheduleBody(name: string, timeZone: string, validFrom: string, validTo: string, days: DayDraft[]) {
  const errors: Record<string, string> = {}
  if (!name.trim()) errors.name = 'Escribe el nombre del horario.'
  if (!validFrom) errors.validFrom = 'Elige desde cuándo vale.'
  if (validTo && validFrom && validTo < validFrom) errors.validTo = 'Debe ser después de «Vigente desde».'
  const chosen = days.filter(day => day.on)
  if (!chosen.length) errors.days = 'Elige al menos un día.'
  for (const day of chosen) {
    if (!/^\d{2}:\d{2}$/.test(day.startTime) || !/^\d{2}:\d{2}$/.test(day.endTime)) errors[day.dayOfWeek] = 'Escribe entrada y salida.'
    else if (day.startTime === day.endTime) errors[day.dayOfWeek] = 'La salida no puede ser igual a la entrada.'
    else if (!/^\d+$/.test(day.breakMinutes || '0') || Number(day.breakMinutes || 0) >= shiftMinutes(day)) errors[day.dayOfWeek] = 'La comida debe durar menos que el turno.'
  }
  const body = {
    name: name.trim(), timeZone, validFrom, ...(validTo ? { validTo } : {}),
    days: chosen.map(day => ({ dayOfWeek: day.dayOfWeek, startTime: day.startTime, endTime: day.endTime, breakMinutes: Number(day.breakMinutes || 0) })),
  }
  return { body, errors, days: body.days }
}

/** Días de un horario como los muestra la ficha: «L 9–18», «S —». */
export function dayCells(schedule: Pick<Schedule, 'days'>) {
  return weekDays.map(item => {
    const day = schedule.days.find(value => value.dayOfWeek === item.key)
    const trim = (time: string) => (time.endsWith(':00') ? String(Number(time.slice(0, 2))) : time)
    return { letter: item.letter, long: item.long, text: day ? `${trim(day.startTime)}–${trim(day.endTime)}` : '—', working: !!day }
  })
}
