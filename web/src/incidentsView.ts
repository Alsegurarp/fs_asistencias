import { addDays, dayMonth, timeIn } from './attendanceModel'
import type { IconName } from './Icons'
import { dateInZone, type Adjustment, type AttendanceEvent, type Incident } from './incidentModel'
import type { Tone } from './ui'

/** Lo que la pantalla de Incidencias muestra de cada incidencia, sin llamar al API. */

export const incidentTitles: Record<string, string> = {
  missing_pair: 'Falta la marca que cierra',
  foreign_site: 'Marcó en otra sede',
  clock_anomaly: 'Hora del teléfono alterada',
  duplicate: 'Marca duplicada',
  location_inconclusive: 'Ubicación no concluyente',
  late_sync: 'Sincronizada tarde',
  outside_window: 'Fuera del horario',
}
export const incidentIcons: Record<string, IconName> = {
  missing_pair: 'clock', foreign_site: 'location', clock_anomaly: 'alert', duplicate: 'copy',
  location_inconclusive: 'location', late_sync: 'sync', outside_window: 'clock',
}
export function incidentTitle(type: string) { return incidentTitles[type] || 'Incidencia' }

export const severities: Record<string, { label: string; tone: Tone }> = {
  high: { label: 'Alta', tone: 'error' }, medium: { label: 'Media', tone: 'warn' }, low: { label: 'Baja', tone: 'neutral' },
}
export function severityOf(value: string) { return severities[value] || { label: value, tone: 'neutral' as Tone } }

/** La decisión como resultado: «Resuelta como ajustada». */
export const outcomes: Record<string, string> = { justified: 'Justificada', confirmed: 'Confirmada', adjusted: 'Ajustada' }

const markWithArticle: Record<string, string> = { clock_in: 'la entrada', clock_out: 'la salida', break_start: 'el inicio de descanso', break_end: 'el fin de descanso' }
const markName: Record<string, string> = { clock_in: 'entrada', clock_out: 'salida', break_start: 'inicio de descanso', break_end: 'fin de descanso' }

/** «Se agregó la salida de las 17:00», con la marca que tocó cuando se conoce. */
export function adjustmentText(adjustment: Adjustment, timeZone: string, marks: AttendanceEvent[] = []) {
  const target = marks.find(mark => mark.id === adjustment.eventId)
  const at = target ? ` de las ${timeIn(target.observedAt, timeZone)}` : ''
  switch (adjustment.kind) {
    case 'add_event': return `Se agregó ${markWithArticle[adjustment.eventType || ''] || 'una marca'}${adjustment.occurredAt ? ` de las ${timeIn(adjustment.occurredAt, timeZone)}` : ''}`
    case 'exclude_event': return target ? `Se excluyó ${markWithArticle[target.type] || 'la marca'}${at}` : 'Se excluyó una marca'
    case 'retype_event': return `La marca${at} pasó a ser ${markName[adjustment.eventType || ''] || 'otra'}`
  }
}

/** «hoy 08:51», «ayer 22:10» o «jue 5 nov». */
export function whenText(instant: string, timeZone: string, today: string) {
  const day = dateInZone(instant, timeZone)
  if (day === today) return `hoy ${timeIn(instant, timeZone)}`
  if (day === addDays(today, -1)) return `ayer ${timeIn(instant, timeZone)}`
  return dayMonth(day)
}

/** El día del marcaje que abrió la incidencia, en la zona de la empresa. */
export function incidentDay(incident: Incident, timeZone: string) {
  return dateInZone(incident.occurredAt || incident.openedAt, timeZone)
}

export type Filters = { q: string; type: string; siteId: string; week: string; mine: boolean; high: boolean; blocking: boolean }

/** Parámetros de `listIncidents`: todo filtro va al servidor, antes de paginar. */
export function incidentQuery(filters: Filters, status: 'open' | 'resolved', extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ status, sort: status === 'open' ? 'severity' : 'resolved' })
  if (filters.q) query.set('q', filters.q)
  if (filters.type) query.set('type', filters.type)
  if (filters.siteId) query.set('siteId', filters.siteId)
  if (filters.week) query.set('week', filters.week)
  if (filters.mine) query.set('assignee', 'me')
  if (filters.high) query.set('severity', 'high')
  // Sólo una abierta bloquea un cierre.
  if (filters.blocking && status === 'open') query.set('blocksClosure', 'true')
  for (const [key, value] of Object.entries(extra)) query.set(key, value)
  return query
}

/** Conteos que acompañan la lista: los de un filtro de un toque, si sólo hay ese. */
export function knownTotal(filters: Filters, status: 'open' | 'resolved', summary?: { open: { total: number; mine: number; high: number; blockingClosure: number }; resolved: { total: number } }) {
  if (!summary || filters.q) return null
  const chips = [filters.mine, filters.high, filters.blocking && status === 'open'].filter(Boolean).length
  if (status === 'resolved') return chips ? null : summary.resolved.total
  if (!chips) return summary.open.total
  if (chips > 1) return null
  return filters.mine ? summary.open.mine : filters.high ? summary.open.high : summary.open.blockingClosure
}

/**
 * Las marcas del día con lo que les falta: si el día termina en una entrada,
 * la salida aparece como «Sin marca», como en el lienzo.
 */
export function dayMarks<T extends { observedAt: string; type: string }>(marks: T[], day: string, timeZone: string) {
  const own = marks.filter(mark => dateInZone(mark.observedAt, timeZone) === day).sort((a, b) => a.observedAt.localeCompare(b.observedAt))
  const last = own.at(-1)
  return { marks: own, missingExit: !!last && (last.type === 'clock_in' || last.type === 'break_end') }
}
