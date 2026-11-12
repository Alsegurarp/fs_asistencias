import { hours, shortWeekLabel, timeIn } from './attendanceModel'
import type { Closure } from './closureModel'
import { dateInZone } from './incidentModel'
import { shortDay } from './settingsModel'
import type { Tone } from './ui'

/** Un exporte de nómina, como lo devuelve `GET /exports`. */
export type ExportRecord = {
  id: string; status: 'queued' | 'ready' | 'expired' | 'failed'; weekStart: string; siteId: string | null; format: 'csv'
  timeZone?: string; ruleSetVersion?: number | null; rowCount: number | null; manifestHash?: string | null; fileHash: string | null
  expiresAt: string | null; createdAt?: string; requestedByName?: string | null; downloadedAt?: string | null; downloadedByName?: string | null
}

export const exportStatus: Record<ExportRecord['status'], { label: string; tone: Tone }> = {
  queued: { label: 'En cola', tone: 'info' },
  ready: { label: 'Listo', tone: 'ok' },
  expired: { label: 'Vencido', tone: 'neutral' },
  failed: { label: 'Falló', tone: 'error' },
}

/** Un exporte listo ya descargado vuelve como `expired`: se dice «Descargado». */
export function exportStatusOf(record: Pick<ExportRecord, 'status' | 'downloadedAt'>) {
  if (record.status === 'expired' && record.downloadedAt) return { label: 'Descargado', tone: 'neutral' as Tone }
  return exportStatus[record.status]
}

/** «hace 2 min», «hoy 09:40», «ayer 18:05» o «2 nov». */
export function whenText(instant: string, timeZone: string, now = new Date()) {
  const minutes = Math.round((now.getTime() - Date.parse(instant)) / 60_000)
  if (minutes >= 0 && minutes < 1) return 'hace un momento'
  if (minutes >= 0 && minutes < 60) return `hace ${minutes} min`
  const day = dateInZone(instant, timeZone)
  const today = dateInZone(now.toISOString(), timeZone)
  const yesterday = dateInZone(new Date(now.getTime() - 86_400_000).toISOString(), timeZone)
  if (day === today) return `hoy ${timeIn(instant, timeZone)}`
  if (day === yesterday) return `ayer ${timeIn(instant, timeZone)}`
  return shortDay(day).replace(/^\S+ /, '')
}

/** «26 oct – 1 nov · toda la empresa». */
export function scopeLabel(weekStart: string, siteName: string | undefined) {
  return `${shortWeekLabel(weekStart)} · ${siteName || 'toda la empresa'}`
}

/** 106920 minutos → «1,782 h»; 2780 → «46 h 20». */
export function hoursText(minutes: number) {
  const value = Math.round(minutes)
  const whole = Math.floor(value / 60)
  const rest = value % 60
  const text = whole.toLocaleString('es-MX')
  return rest ? `${text} h ${String(rest).padStart(2, '0')}` : `${text} h`
}

export { hours }

/** Columnas que se pueden prender o apagar; las tres primeras son de nómina y siempre van. */
export type PayrollOptions = { worked: boolean; breaks: boolean; acknowledgement: boolean; bySite: boolean; hashes: boolean; signature: boolean }
export const defaultOptions: PayrollOptions = { worked: true, breaks: false, acknowledgement: true, bySite: true, hashes: false, signature: true }

export const acknowledgementText = (closure: Pick<Closure, 'acknowledgement'>) =>
  closure.acknowledgement?.type === 'agreed' ? 'Conforme' : closure.acknowledgement?.type === 'objected' ? 'Objeción' : 'Sin acuse'

export type PayrollGroup = { key: string; name: string; rows: Closure[] }
export type Totals = { people: number; ordinary: number; overtime: number; worked: number; breaks: number; agreed: number; objected: number; none: number }

export function totalsOf(rows: Closure[]): Totals {
  const totals: Totals = { people: rows.length, ordinary: 0, overtime: 0, worked: 0, breaks: 0, agreed: 0, objected: 0, none: 0 }
  for (const row of rows) {
    totals.ordinary += row.totals.ordinaryMinutes
    totals.overtime += row.totals.overtimeMinutes
    totals.worked += row.totals.workedMinutes
    totals.breaks += row.totals.breakMinutes
    if (row.acknowledgement?.type === 'agreed') totals.agreed++
    else if (row.acknowledgement?.type === 'objected') totals.objected++
    else totals.none++
  }
  return totals
}

const byExternalId = (a: Closure, b: Closure) => (a.employeeExternalId || '').localeCompare(b.employeeExternalId || '', 'es', { numeric: true })

/**
 * Agrupa los cierres por sede, en el orden de las sedes. Quien no aparece en
 * ninguna sede va en «Sin sede». Sin agrupar, un solo grupo ordenado por
 * número, como el CSV del servidor.
 */
export function groupBySite(all: Closure[], bySite: { id: string; name: string; rows: Closure[] }[], grouped: boolean): PayrollGroup[] {
  if (!grouped) return [{ key: 'todos', name: '', rows: [...all].sort(byExternalId) }]
  const seen = new Set<string>()
  const groups: PayrollGroup[] = []
  for (const site of bySite) {
    const rows = site.rows.filter(row => !seen.has(row.id)).sort(byExternalId)
    rows.forEach(row => seen.add(row.id))
    if (rows.length) groups.push({ key: site.id, name: site.name, rows })
  }
  const rest = all.filter(row => !seen.has(row.id)).sort(byExternalId)
  if (rest.length) groups.push({ key: 'sin-sede', name: 'Sin sede', rows: rest })
  return groups
}

/** Tamaños de hoja de la vista previa: ancho y alto en milímetros y el `@page` de la impresión. */
export const paperSizes = [
  { key: 'carta-h', label: 'Carta horizontal', width: 279, height: 216, page: 'letter landscape' },
  { key: 'carta-v', label: 'Carta vertical', width: 216, height: 279, page: 'letter portrait' },
  { key: 'a4-h', label: 'A4 horizontal', width: 297, height: 210, page: 'A4 landscape' },
] as const
export type PaperKey = typeof paperSizes[number]['key']

/** «91c4…02de». */
export function shortHash(hash: string | null | undefined) { return hash && hash.length > 10 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash || '' }
