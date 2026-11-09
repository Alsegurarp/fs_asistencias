import { type Week } from './incidentModel'

export type Closure = {
  id: string; employeeId: string; weekStart: string; version: number; status: 'closed' | 'reopened';
  ruleSet: { id: string; version: number }; totals: Week['totals']; hash: string; closedAt: string; closedBy: string | null;
  acknowledgement: { type: 'agreed' | 'objected'; note: string | null; at: string } | null;
  /** Desde el contrato 0.20.0: los nombres viajan en el cierre. */
  employeeName?: string; employeeExternalId?: string; closedByName?: string | null;
}
export type ClosureSummary = { weekStart: string; closed: number; reopened: number; blocked: number; acknowledgements: { agreed: number; objected: number; none: number } }
export type BlockedClosure = { employeeId: string; reason: string; incidentIds: string[] }
export type ClosureRun = {
  id: string; weekStart: string; siteId: string | null; origin: 'requested' | 'scheduled'; status: 'queued' | 'running' | 'done' | 'failed';
  total: number | null; closed: number; blocked: { openIncidents: number; openSegment: number }; requestedBy: string | null; requestedByName?: string | null;
  failure: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null;
}
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
function date(value: string) {
  const instant = Date.parse(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== value) throw new Error('Selecciona una fecha válida de la semana.')
}
export function runBody(weekStart: string, siteId: string) {
  date(weekStart)
  if (siteId && !uuid.test(siteId)) throw new Error('Selecciona una sede válida.')
  return { weekStart, ...(siteId ? { siteId } : {}) }
}
export function reopenBody(value: string) {
  const reason = value.trim()
  if (reason.length < 10 || reason.length > 500) throw new Error('El motivo debe tener entre 10 y 500 caracteres.')
  return { reason }
}
export function runPollInterval(status: string | undefined, error: unknown): number | false {
  return !error && (status === 'queued' || status === 'running') ? 5000 : false
}

/** El acuse de un cierre como etiqueta: una reabierta ya no tiene acuse vigente. */
export function acknowledgementBadge(closure: Pick<Closure, 'status' | 'acknowledgement'>): { label: string; tone: 'ok' | 'error' | 'neutral' } {
  if (closure.status === 'reopened') return { label: 'Reabierta', tone: 'neutral' }
  if (!closure.acknowledgement) return { label: 'Sin acuse', tone: 'neutral' }
  return closure.acknowledgement.type === 'agreed' ? { label: 'Conforme', tone: 'ok' } : { label: 'Objeción', tone: 'error' }
}

export const runFailures: Record<string, string> = { job_abandoned: 'El trabajo agotó sus reintentos.', tenant_not_active: 'La empresa se suspendió antes de terminar.' }

/** Cuántas personas ya revisó una corrida: las cerradas y las que quedaron bloqueadas. */
export function runProcessed(run: ClosureRun) { return run.closed + run.blocked.openIncidents + run.blocked.openSegment }

export type BlockingIncident = { id: string; type: string; employeeId: string | null; employeeName?: string; siteId: string | null; occurredAt?: string; openedAt: string; assigneeUserId: string | null }
export type BlockedPerson = { employeeId: string; name: string; siteId: string | null; incidents: BlockingIncident[]; since: string }

/**
 * Las personas que no se pueden cerrar, desde sus incidencias que bloquean un
 * cierre (MAQ-025): una fila por persona, con la más antigua primero.
 */
export function blockedPeople(incidents: BlockingIncident[]): BlockedPerson[] {
  const people = new Map<string, BlockedPerson>()
  for (const incident of incidents) {
    if (!incident.employeeId) continue
    const when = incident.occurredAt || incident.openedAt
    const person = people.get(incident.employeeId)
    if (person) {
      person.incidents.push(incident)
      if (when < person.since) person.since = when
    } else people.set(incident.employeeId, { employeeId: incident.employeeId, name: incident.employeeName || 'Persona', siteId: incident.siteId, incidents: [incident], since: when })
  }
  return [...people.values()].sort((a, b) => a.since.localeCompare(b.since) || a.name.localeCompare(b.name))
}

/** Nombre con que se muestra cada bloqueada; si dos se llaman igual, lleva su sede para distinguirlas. */
export function blockedLabels(people: BlockedPerson[], siteName: (id: string | null) => string | undefined): Record<string, string> {
  const seen = new Map<string, number>()
  for (const person of people) seen.set(person.name, (seen.get(person.name) || 0) + 1)
  return Object.fromEntries(people.map(person => [person.employeeId, (seen.get(person.name) || 0) > 1 ? `${person.name} (${siteName(person.siteId) || 'sin sede'})` : person.name]))
}
