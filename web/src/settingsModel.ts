import type { BreakPolicy, Site, Tenant } from './api'
import type { RuleSet as WeekRuleSet } from './attendanceModel'

/** Una sede con sus cifras (contrato 0.33.0). */
export type SiteSummary = Site & { createdAt?: string; people?: number; terminals?: number }

/** Una versión de las reglas laborales, como la devuelve `GET /rule-sets`; la misma consulta que usa Cierres. */
export type RuleSet = WeekRuleSet & { sources?: string[] }

export type WeekDay = Tenant['weekStartsOn']

export const weekDayNames: Record<WeekDay, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
}

/** Las zonas horarias de México, por la ciudad que la gente reconoce. */
export const timeZones: { value: string; label: string }[] = [
  { value: 'America/Mexico_City', label: 'Ciudad de México' },
  { value: 'America/Monterrey', label: 'Monterrey' },
  { value: 'America/Merida', label: 'Mérida' },
  { value: 'America/Cancun', label: 'Cancún' },
  { value: 'America/Chihuahua', label: 'Chihuahua' },
  { value: 'America/Ciudad_Juarez', label: 'Ciudad Juárez' },
  { value: 'America/Mazatlan', label: 'Mazatlán' },
  { value: 'America/Hermosillo', label: 'Hermosillo' },
  { value: 'America/Tijuana', label: 'Tijuana' },
  { value: 'America/Matamoros', label: 'Matamoros' },
  { value: 'America/Bahia_Banderas', label: 'Bahía de Banderas' },
]

export function zoneLabel(zone: string) { return timeZones.find(item => item.value === zone)?.label || zone.replace(/^.*\//, '').replaceAll('_', ' ') }

/** Las opciones de zona, con la actual aunque no sea de México. */
export function zoneOptions(current?: string) {
  return current && !timeZones.some(item => item.value === current) ? [{ value: current, label: zoneLabel(current) }, ...timeZones] : timeZones
}

export const breakNames: Record<BreakPolicy, string> = { not_considered: 'No se marca', marked: 'Se marca' }

/** «lun 16 nov»: un día del calendario de la empresa, sin moverlo de zona. */
export function shortDay(day: string, year = false) {
  const parts = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(`${day}T12:00:00Z`))
  const part = (type: Intl.DateTimeFormatPartTypes) => (parts.find(item => item.type === type)?.value || '').replace('.', '')
  return `${part('weekday')} ${part('day')} ${part('month')}${year ? ` ${part('year')}` : ''}`
}

/** «Hoy no se marca · se marca desde el lun 16 nov». */
export function breakText(tenant: Pick<Tenant, 'breakPolicy' | 'breakPolicyChange'>) {
  const now = `Hoy ${breakNames[tenant.breakPolicy].toLowerCase()}`
  const change = tenant.breakPolicyChange
  return change ? `${now} · ${breakNames[change.breakPolicy].toLowerCase()} desde el ${shortDay(change.effectiveOn)}` : now
}

const dayIndex: Record<WeekDay, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) }

function nextFortnight(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  if (date < 16) return `${day.slice(0, 8)}16`
  const next = new Date(Date.UTC(year, month, 1, 12))
  return next.toISOString().slice(0, 10)
}

/**
 * Cuándo entraría un cambio de comida programado hoy, con la misma regla del
 * servidor: el primer inicio de semana dentro de la siguiente quincena, con al
 * menos siete días de aviso. Sólo es la vista previa; la fecha la fija el
 * servidor al programarlo.
 */
export function breakChangeStarts(today: string, weekStartsOn: WeekDay) {
  let fortnight = nextFortnight(today)
  for (;;) {
    // El primer inicio de semana en o después del día 1 o 16.
    const last = addDays(fortnight, 6)
    const back = (new Date(`${last}T12:00:00Z`).getUTCDay() - dayIndex[weekStartsOn] + 7) % 7
    const start = addDays(last, -back)
    if (daysBetween(today, start) >= 7) return start
    fortnight = nextFortnight(fortnight)
  }
}

const hours = (minutes: number | string | undefined) => {
  const value = Number(minutes)
  if (!Number.isFinite(value)) return '—'
  const whole = Math.floor(value / 60)
  const rest = value % 60
  return rest ? `${whole} h ${rest}` : `${whole} h`
}

export type RuleYear = { year: number; ordinary: string; overtime: string; current: boolean; set: RuleSet }

/**
 * La tabla de topes por año: de cada año, la versión más reciente que lo
 * cubre. `today` marca la vigente.
 */
export function ruleYears(sets: RuleSet[], today: string): RuleYear[] {
  const byYear = new Map<number, RuleSet>()
  for (const set of sets) {
    const from = Number(set.validFrom.slice(0, 4))
    const to = Number((set.validTo || set.validFrom).slice(0, 4))
    for (let year = from; year <= to; year++) {
      const known = byYear.get(year)
      if (!known || set.version > known.version || (set.version === known.version && set.validFrom > known.validFrom)) byYear.set(year, set)
    }
  }
  const year = Number(today.slice(0, 4))
  return [...byYear.entries()].sort(([a], [b]) => a - b).map(([key, set]) => ({
    year: key, ordinary: hours(set.weeklyOrdinaryMaxMinutes), overtime: hours(set.parameters.weeklyOvertimeMaxMinutes), current: key === year, set,
  }))
}

/** «2026: 48 h ordinarias y hasta 9 h extra por semana». */
export function rulesText(years: RuleYear[]) {
  const current = years.find(item => item.current) || years.at(-1)
  return current ? `${current.year}: ${current.ordinary} ordinarias y hasta ${current.overtime} extra por semana` : 'Sin reglas registradas'
}

/** Las reglas por día de la versión vigente, en palabras. */
export function dailyRules(set: RuleSet | undefined) {
  if (!set) return []
  const p = set.parameters
  const rules = [`Jornada de ${hours(p.dailyOrdinaryMaxMinutesDay)} diurna, ${hours(p.dailyOrdinaryMaxMinutesNight)} nocturna o ${hours(p.dailyOrdinaryMaxMinutesMixed)} mixta.`]
  if (p.dailyCombinedMaxMinutes) rules.push(`Máximo ${hours(p.dailyCombinedMaxMinutes)} en un día, sumando ordinarias y extra.`)
  if (p.dailyOvertimeMaxMinutes) rules.push(`Extra: hasta ${hours(p.dailyOvertimeMaxMinutes)} al día${p.overtimeMaxDays ? ` y en no más de ${p.overtimeMaxDays} días por semana` : ''}.`)
  return rules
}

/** La fuente sin su enlace: «DOF, decreto del 1 de mayo de 2026…». */
export function sourceText(source: string) {
  const [text, ...rest] = source.split(/:\s+(?=https?:\/\/)/)
  return { text, url: rest.join('') || null }
}

export type SiteDraft = { name: string; timeZone: string; latitude: string; longitude: string; radiusMeters: string; active: boolean }

export function siteDraft(site: SiteSummary | null, timeZone: string): SiteDraft {
  return site
    ? { name: site.name, timeZone: site.timeZone, latitude: String(site.latitude), longitude: String(site.longitude), radiusMeters: String(site.radiusMeters), active: site.status === 'active' }
    : { name: '', timeZone, latitude: '19.432608', longitude: '-99.133209', radiusMeters: '100', active: true }
}

/** Los errores de cada campo antes de mandar la sede; vacío si está bien. */
export function siteErrors(draft: SiteDraft) {
  const errors: Partial<Record<keyof SiteDraft, string>> = {}
  const number = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
  if (!draft.name.trim()) errors.name = 'Escribe el nombre de la sede.'
  const latitude = number(draft.latitude)
  if (latitude === null || latitude < -90 || latitude > 90) errors.latitude = 'Entre -90 y 90.'
  const longitude = number(draft.longitude)
  if (longitude === null || longitude < -180 || longitude > 180) errors.longitude = 'Entre -180 y 180.'
  const radius = number(draft.radiusMeters)
  if (radius === null || !Number.isInteger(radius) || radius < 20 || radius > 2000) errors.radiusMeters = 'De 20 a 2000 metros, sin decimales.'
  return errors
}

/** Lo que cambió de la sede, para mandar sólo eso. */
export function siteChanges(site: SiteSummary | null, draft: SiteDraft) {
  const body = { name: draft.name.trim(), timeZone: draft.timeZone, latitude: Number(draft.latitude), longitude: Number(draft.longitude), radiusMeters: Number(draft.radiusMeters) }
  if (!site) return body
  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) if (value !== site[key as keyof Site]) changes[key] = value
  const status = draft.active ? 'active' : 'inactive'
  if (status !== site.status) changes.status = status
  return changes
}
