import type { Page } from './api'
import { dateInZone } from './incidentModel'
import type { Tone } from './ui'

/** Tipos de las rutas de asistencia del contrato (0.24.0). */
export type Attention = 'alerts' | 'overtime' | 'no_entry_today' | 'on_shift'
export type Totals = { workedMinutes: number; breakMinutes: number; ordinaryMinutes: number; overtimeMinutes: number }
export type AttendanceAlert = { code: string; severity: 'info' | 'warning' | 'critical'; message: string }
export type Today = { state: 'on_shift' | 'on_break' | 'off_shift' | 'no_entry'; since: string | null; lastMarkAt: string | null }
export type ClosureRef = { id: string; version: number; status: 'closed' | 'reopened' }
export type WeekRow = {
  employeeId: string; externalId: string; displayName: string; siteId: string | null; scheduleId: string | null
  ruleSet: { id: string; version: number }; totals: Totals; alerts: AttendanceAlert[]
  openIncidents: { id: string; type: string }[]; closure: ClosureRef | null; today: Today | null
  /** Desde el contrato 0.26.0; nulos en un cierre anterior. */
  workedDays?: number | null; overtimeDays?: number | null
}
/** Un día de la semana con su reparto, del mismo cálculo que los totales. */
export type DayTotals = { date: string; workedMinutes: number; breakMinutes: number; ordinaryMinutes: number; overtimeMinutes: number }
export type WeekList = Page<WeekRow> & { weekStart: string; timeZone: string }
export type AttendanceSummary = {
  date: string; weekStart: string; timeZone: string; siteId: string | null; people: number
  day: { marked: number; attendanceEvents: number; onShift: number | null; noEntry: number | null; foreignSite: number }
  week: { ordinaryMinutes: number; overtimeMinutes: number; withOvertime: number; withAttention: number; missingExit: number }
  incidents?: { open: number; highSeverity: number; unassigned: number }
  previousWeek?: { weekStart: string; people: number; closed: number; agreed: number; objected: number }
  /** Nulo para quien no consulta dispositivos. */
  devices?: { active: number; silent: number } | null
  /** Desde el contrato 0.27.0: hasta cinco personas con más horas en la semana. */
  mostHours?: HoursRow[]
}
export type HoursRow = { employeeId: string; displayName: string; siteId: string | null; ordinaryMinutes: number; overtimeMinutes: number }
export type RuleSet = { id: string; version: number; validFrom: string; validTo: string | null; weeklyOrdinaryMaxMinutes: number; parameters: Record<string, string> }
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export type ScheduleDay = { dayOfWeek: DayOfWeek; startTime: string; endTime: string; breakMinutes: number }
export type Schedule = { id: string; name: string; days: ScheduleDay[] }
export type Segment = { id: string; kind: 'work' | 'break'; startAt: string; endAt: string | null; minutes: number }
export type PersonWeek = {
  employeeId: string; weekStart: string; timeZone: string; ruleSet: { id: string; version: number }
  segments: Segment[]; totals: Totals; alerts: AttendanceAlert[]; openIncidentIds: string[]; closure: ClosureRef | null
  /** Nulo en una semana cerrada antes del contrato 0.26.0. */
  days?: DayTotals[] | null
}
export type Mark = {
  id: string; employeeId: string; siteId: string | null; deviceMode: 'personal' | 'terminal'
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'; outcome: 'accepted' | 'accepted_with_incident'
  observedAt: string; receivedAt: string; delaySeconds: number; locationVerdict: 'inside' | 'outside' | 'inconclusive' | 'not_evaluated'
  accuracyMeters: number | null; incidentIds: string[]
}
export type Acknowledgement = { id: string; closureId: string; type: 'agreed' | 'objected'; note: string | null; at: string }
export type Closure = {
  id: string; employeeId: string; weekStart: string; version: number; status: 'closed' | 'reopened'
  totals: Totals; hash: string; closedAt: string; closedByName: string | null; acknowledgement: Acknowledgement | null
}

/** 1920 → «32:00»; 190 → «3:10». */
export function hours(minutes: number) {
  const sign = minutes < 0 ? '-' : ''
  const value = Math.abs(Math.round(minutes))
  return `${sign}${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

/** Tope en horas: 2880 → «48»; 450 → «7.5». */
export function limitHours(minutes: number) {
  const value = minutes / 60
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dayShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const dayLong = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const dayKeys: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const parts = (date: string) => { const value = new Date(`${date}T00:00:00Z`); return { day: value.getUTCDate(), month: value.getUTCMonth(), year: value.getUTCFullYear(), weekday: value.getUTCDay() } }

/** «2 – 8 nov 2026», «26 oct – 1 nov 2026», «29 dic 2025 – 4 ene 2026». */
export function weekLabel(weekStart: string) {
  const a = parts(weekStart)
  const b = parts(addDays(weekStart, 6))
  if (a.year !== b.year) return `${a.day} ${monthNames[a.month]} ${a.year} – ${b.day} ${monthNames[b.month]} ${b.year}`
  if (a.month !== b.month) return `${a.day} ${monthNames[a.month]} – ${b.day} ${monthNames[b.month]} ${b.year}`
  return `${a.day} – ${b.day} ${monthNames[b.month]} ${b.year}`
}

/** «26 oct – 1 nov», sin año: para listas de semanas. */
export function shortWeekLabel(weekStart: string) {
  const a = parts(weekStart)
  const b = parts(addDays(weekStart, 6))
  return a.month === b.month ? `${a.day} – ${b.day} ${monthNames[b.month]}` : `${a.day} ${monthNames[a.month]} – ${b.day} ${monthNames[b.month]}`
}

/** «Lun, 2 nov». */
export function dayLabel(date: string) {
  const p = parts(date)
  return `${dayShort[p.weekday]}, ${p.day} ${monthNames[p.month]}`
}

/** «jue 5 nov». */
export function dayMonth(date: string) {
  const p = parts(date)
  return `${dayShort[p.weekday].toLowerCase()} ${p.day} ${monthNames[p.month]}`
}

const monthLong = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** «jueves 5 de noviembre». */
export function longDate(date: string) {
  const p = parts(date)
  return `${dayLong[p.weekday]} ${p.day} de ${monthLong[p.month]}`
}

/** «lun 2». */
export function shortDay(date: string) {
  const p = parts(date)
  return `${dayShort[p.weekday].toLowerCase()} ${p.day}`
}

export function dayOfWeek(date: string): DayOfWeek { return dayKeys[parts(date).weekday] }

/** Hora local de un instante en la zona de la empresa, «07:58». */
export function timeIn(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant))
}

export function todayIn(timeZone: string, now = new Date()) { return dateInZone(now.toISOString(), timeZone) }

export function weekContains(weekStart: string, date: string) { return date >= weekStart && date <= addDays(weekStart, 6) }

/** «lunes a jueves completos, viernes en curso» en la semana de hoy; una semana pasada está terminada. */
export function weekProgress(weekStart: string, today: string) {
  if (!weekContains(weekStart, today)) return today < weekStart ? 'semana por venir' : 'semana terminada'
  const current = dayLong[parts(today).weekday]
  if (today === weekStart) return `${current} en curso`
  const first = dayLong[parts(weekStart).weekday]
  const last = dayLong[parts(addDays(today, -1)).weekday]
  return first === last ? `${first} completo, ${current} en curso` : `${first} a ${last} completos, ${current} en curso`
}

export function scheduleDayOn(schedule: Schedule | undefined, date: string) {
  return schedule?.days.find(day => day.dayOfWeek === dayOfWeek(date))
}

const dayLetters: Record<DayOfWeek, string> = { monday: 'L', tuesday: 'M', wednesday: 'Mi', thursday: 'J', friday: 'V', saturday: 'S', sunday: 'D' }
const order: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** «L–S 08:00–16:00»; si cada día tiene su hora, sólo los días. */
export function scheduleSummary(schedule: Schedule) {
  const days = order.filter(day => schedule.days.some(item => item.dayOfWeek === day))
  if (!days.length) return schedule.name
  const indexes = days.map(day => order.indexOf(day))
  const consecutive = indexes.every((value, i) => i === 0 || value === indexes[i - 1] + 1)
  const span = consecutive && days.length > 2 ? `${dayLetters[days[0]]}–${dayLetters[days.at(-1)!]}` : days.map(day => dayLetters[day]).join(', ')
  const first = schedule.days.find(item => item.dayOfWeek === days[0])!
  const same = schedule.days.every(item => item.startTime === first.startTime && item.endTime === first.endTime)
  return same ? `${span} ${first.startTime.slice(0, 5)}–${first.endTime.slice(0, 5)}` : `${span} · horario por día`
}

/** Qué dice la columna «Hoy». */
export function todayText(row: WeekRow, timeZone: string, schedule: Schedule | undefined, today: string, now = new Date()): { text: string; tone: Tone } | null {
  const state = row.today
  if (!state) return null
  switch (state.state) {
    case 'on_shift': return { text: `En turno ${state.since ? timeIn(state.since, timeZone) : ''}`.trim(), tone: 'ok' }
    case 'on_break': return { text: `En descanso ${state.since ? timeIn(state.since, timeZone) : ''}`.trim(), tone: 'info' }
    case 'off_shift': return { text: `Salió ${state.lastMarkAt ? timeIn(state.lastMarkAt, timeZone) : ''}`.trim(), tone: 'neutral' }
    case 'no_entry': {
      const planned = scheduleDayOn(schedule, today)
      const start = planned?.startTime.slice(0, 5)
      if (start && start > timeIn(now.toISOString(), timeZone)) return { text: `Entra ${start}`, tone: 'neutral' }
      return { text: 'Sin entrada', tone: 'warn' }
    }
  }
}

const incidentLabels: Record<string, { label: string; tone: Tone }> = {
  foreign_site: { label: 'Marcó en otra sede', tone: 'warn' },
  missing_pair: { label: 'Falta un marcaje', tone: 'error' },
  location_inconclusive: { label: 'Ubicación no concluyente', tone: 'neutral' },
  late_sync: { label: 'Sincronizó tarde', tone: 'neutral' },
  duplicate: { label: 'Lectura duplicada', tone: 'neutral' },
  outside_window: { label: 'Fuera de horario', tone: 'neutral' },
  clock_anomaly: { label: 'Hora del teléfono dudosa', tone: 'neutral' },
}
const alertLabels: Record<string, string> = {
  daily_combined_limit_exceeded: 'Tope diario excedido',
  daily_overtime_limit_exceeded: 'Extra diaria excedida',
  overtime_days_limit_exceeded: 'Extra en más días de los permitidos',
  weekly_overtime_limit_exceeded: 'Extra semanal excedida',
  weekly_total_overtime_limit_exceeded: 'Extra semanal excedida',
  break_computability_unverified: 'Descanso por confirmar',
}

export type Flag = { label: string; tone: Tone; incidentId?: string }

/**
 * La columna «Atención»: incidencias abiertas, un tramo sin salida que ya no
 * es el turno de hoy, topes rebasados y tiempo extra. Lo más grave primero.
 */
export function attentionFlags(row: WeekRow, overtimeMaxDays?: number): Flag[] {
  const flags: Flag[] = []
  const onShift = row.today?.state === 'on_shift' || row.today?.state === 'on_break'
  if (row.alerts.some(alert => alert.code === 'open_segment') && !onShift) flags.push({ label: 'Tramo sin salida', tone: 'error' })
  for (const incident of row.openIncidents) {
    const known = incidentLabels[incident.type] || { label: 'Incidencia abierta', tone: 'neutral' as Tone }
    flags.push({ ...known, incidentId: incident.id })
  }
  const seen = new Set<string>()
  for (const alert of row.alerts) {
    const label = alertLabels[alert.code]
    if (!label || seen.has(label)) continue
    seen.add(label)
    flags.push({ label, tone: alert.severity === 'critical' ? 'error' : 'neutral' })
  }
  if (row.totals.overtimeMinutes > 0 && !flags.some(flag => flag.label.startsWith('Extra'))) {
    // «Extra 3 de 4 días», como en el lienzo, cuando el servidor dice cuántos días y las reglas el máximo.
    flags.push({ label: row.overtimeDays && overtimeMaxDays ? `Extra ${row.overtimeDays} de ${overtimeMaxDays} días` : 'Tiempo extra', tone: 'warn' })
  }
  const rank: Record<Tone, number> = { error: 0, warn: 1, neutral: 2, info: 3, ok: 4 }
  return flags.sort((a, b) => rank[a.tone] - rank[b.tone])
}

export type DayLine = {
  date: string
  /** «08:00 – 16:00», «07:58 – en turno», «Programado 08:00 – 16:00». */
  range: string
  workedMinutes: number | null
  /** El reparto del día que da el servidor; nulo si la semana no lo trae. */
  ordinaryMinutes: number | null
  overtimeMinutes: number | null
  state: 'done' | 'open' | 'missing' | 'planned' | 'absent' | 'pending'
}

/**
 * Los días de la semana de una persona. Los tramos seguidos (un descanso en
 * medio, o un turno que cruza la medianoche) son una sola jornada, del día en
 * que empezó, como en el cálculo del servidor.
 */
export function dayLines(week: PersonWeek, schedule: Schedule | undefined, today: string, onShift: boolean, now = new Date()): DayLine[] {
  const tz = week.timeZone
  const segments = [...week.segments].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  const groups: { date: string; items: Segment[] }[] = []
  for (const segment of segments) {
    const last = groups.at(-1)
    const previous = last?.items.at(-1)
    if (last && previous?.endAt && Date.parse(previous.endAt) === Date.parse(segment.startAt)) last.items.push(segment)
    else groups.push({ date: dateInZone(segment.startAt, tz), items: [segment] })
  }
  const lastOpen = segments.at(-1)?.endAt === null ? segments.at(-1)!.id : null
  const lines = new Map<string, DayLine>()
  for (const group of groups) {
    const first = group.items[0]
    const end = group.items.at(-1)!
    const open = group.items.find(item => item.endAt === null)
    const current = !!open && open.id === lastOpen && onShift
    const worked = group.items.filter(item => item.kind === 'work').reduce((sum, item) => sum + item.minutes, 0)
    const range = `${timeIn(first.startAt, tz)} – ${open ? (current ? (open.kind === 'break' ? 'en descanso' : 'en turno') : 'sin salida') : timeIn(end.endAt!, tz)}`
    const existing = lines.get(group.date)
    const line: DayLine = { date: group.date, range, workedMinutes: worked, ordinaryMinutes: null, overtimeMinutes: null, state: open ? (current ? 'open' : 'missing') : 'done' }
    // Dos jornadas el mismo día: se suman y el rango va de la primera a la última.
    lines.set(group.date, existing ? { ...line, range: `${existing.range.split(' – ')[0]} – ${range.split(' – ')[1]}`, workedMinutes: (existing.workedMinutes || 0) + worked,
      state: existing.state === 'missing' || line.state === 'missing' ? 'missing' : line.state } : line)
  }
  const nowTime = timeIn(now.toISOString(), tz)
  for (let i = 0; i < 7; i++) {
    const date = addDays(week.weekStart, i)
    if (lines.has(date)) continue
    const planned = scheduleDayOn(schedule, date)
    if (!planned) continue
    const window = `${planned.startTime.slice(0, 5)} – ${planned.endTime.slice(0, 5)}`
    const none = { workedMinutes: null, ordinaryMinutes: null, overtimeMinutes: null }
    if (date > today) lines.set(date, { date, range: `Programado ${window}`, ...none, state: 'planned' })
    else if (date === today && planned.startTime.slice(0, 5) > nowTime) lines.set(date, { date, range: `Entra ${planned.startTime.slice(0, 5)}`, ...none, state: 'pending' })
    else lines.set(date, { date, range: `Sin marcas · programado ${window}`, ...none, state: 'absent' })
  }
  // El reparto de cada día lo da el servidor, con el mismo cálculo que los totales.
  for (const day of week.days || []) {
    const line = lines.get(day.date)
    if (line && line.workedMinutes !== null) lines.set(day.date, { ...line, ordinaryMinutes: day.ordinaryMinutes, overtimeMinutes: day.overtimeMinutes })
  }
  return [...lines.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export const markTypes: Record<Mark['type'], string> = { clock_in: 'Entrada', clock_out: 'Salida', break_start: 'Inicio de descanso', break_end: 'Fin de descanso' }
const verdicts: Record<Mark['locationVerdict'], string> = { inside: 'Dentro de la sede', outside: 'Fuera de la sede', inconclusive: 'Ubicación no concluyente', not_evaluated: 'Sin ubicación' }

export function deviceText(mark: Mark, siteName: (id: string | null) => string | undefined) {
  if (mark.deviceMode === 'personal') return 'Teléfono personal'
  const site = siteName(mark.siteId)
  return site ? `Terminal de ${site}` : 'Terminal'
}

/** «Dentro de la sede · precisión 12 m · llegó 6 min después». */
export function markEvidence(mark: Mark) {
  const items = [verdicts[mark.locationVerdict]]
  if (mark.accuracyMeters !== null && mark.locationVerdict !== 'not_evaluated') items.push(`precisión ${Math.round(mark.accuracyMeters)} m`)
  if (mark.delaySeconds >= 120) items.push(`llegó ${delay(mark.delaySeconds)} después`)
  return items.join(' · ')
}

/** «6 min», «2 h 5 min», «3 días». */
export function delay(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
  return `${Math.round(minutes / 1440)} días`
}

/** «9f3a…c21e». */
export function shortHash(hash: string) { return hash.length > 10 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash }

/** Una celda de CSV: comillas dobles, y un apóstrofo si empieza como fórmula de hoja de cálculo. */
export function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function csv(rows: (string | number | null | undefined)[][]) {
  return '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
