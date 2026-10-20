import { type Week } from './incidentModel'

export type Closure = {
  id: string; employeeId: string; weekStart: string; version: number; status: 'closed' | 'reopened';
  ruleSet: { id: string; version: number }; totals: Week['totals']; hash: string; closedAt: string; closedBy: string | null;
  acknowledgement: { type: 'agreed' | 'objected'; note: string | null; at: string } | null;
}
export type BlockedClosure = { employeeId: string; reason: string; incidentIds: string[] }
export type ClosureResult = { weekStart: string; closed: Closure[]; blocked: BlockedClosure[] }
export type ClosureRun = {
  id: string; weekStart: string; siteId: string | null; origin: 'requested' | 'scheduled'; status: 'queued' | 'running' | 'done' | 'failed';
  total: number | null; closed: number; blocked: { openIncidents: number; openSegment: number }; requestedBy: string | null;
  failure: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null;
}
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
function date(value: string) {
  const instant = Date.parse(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== value) throw new Error('Selecciona una fecha válida de la semana.')
}
export function closeBody(weekStart: string, employeeIds: string[]) {
  date(weekStart)
  const selected = [...new Set(employeeIds)]
  if (!selected.length || selected.length > 500) throw new Error('Selecciona entre 1 y 500 empleados. Para toda la empresa usa una corrida.')
  if (selected.some(id => !uuid.test(id))) throw new Error('Selecciona empleados de la lista.')
  return { weekStart, employeeIds: selected }
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
