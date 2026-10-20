export const incidentTypes: Record<string, string> = {
  duplicate: 'Lectura duplicada', missing_pair: 'Marcaje faltante', outside_window: 'Fuera de ventana',
  location_inconclusive: 'Ubicación inconclusa', clock_anomaly: 'Anomalía de reloj', foreign_site: 'Fuera de sede', late_sync: 'Sincronización tardía',
}
export const eventTypes: Record<string, string> = { clock_in: 'Entrada', clock_out: 'Salida', break_start: 'Inicio de descanso', break_end: 'Fin de descanso' }
export const decisions: Record<string, string> = { justified: 'Justificar', confirmed: 'Confirmar', adjusted: 'Ajustar jornada' }
export type Adjustment = { kind: 'add_event' | 'exclude_event' | 'retype_event'; eventId?: string; eventType?: string; occurredAt?: string }
export type Incident = {
  id: string; type: string; severity: string; status: 'open' | 'resolved'; employeeId: string | null; siteId: string | null;
  eventIds: string[]; openedAt: string; assigneeUserId: string | null;
  resolution: { decision: string; reason: string; adjustment: Adjustment | null; resolvedBy: string; resolvedAt: string } | null;
}
export type AttendanceEvent = { id: string; type: string; observedAt: string; locationVerdict: string; accuracyMeters: number | null }
export type User = { id: string; displayName: string; email: string; status: string }
export type Week = {
  weekStart: string; timeZone: string;
  segments: { id: string; kind: string; startAt: string; endAt: string | null; minutes: number }[];
  totals: { workedMinutes: number; breakMinutes: number; ordinaryMinutes: number; overtimeMinutes: number };
  alerts: { code: string; severity: string; message: string }[]; openIncidentIds: string[];
  closure: { id: string; version: number; status: string } | null;
  acknowledgement?: { id: string; closureId: string; type: 'agreed' | 'objected'; note: string | null; at: string; evidenceHash: string } | null;
}

function localParts(instant: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant)
  const value = (type: string) => parts.find(part => part.type === type)!.value
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`
}

export function dateInZone(instant: string, timeZone: string): string {
  return localParts(Date.parse(instant), timeZone).slice(0, 10)
}

export function showTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone, dateStyle: 'short', timeStyle: 'medium' }).format(new Date(instant))
}

/** Devuelve ambas ocurrencias si la hora se repite; ninguna si no existe por cambio horario. */
export function zonedInstants(local: string, timeZone: string): string[] {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(local)) return []
  const normalized = local.length === 16 ? `${local}:00` : local
  const nominal = Date.parse(`${normalized}Z`)
  if (!Number.isFinite(nominal)) return []
  const offsets = new Set([-36, -12, 0, 12, 36].map(hours => {
    const sample = nominal + hours * 3_600_000
    return Date.parse(`${localParts(sample, timeZone)}Z`) - sample
  }))
  return [...offsets].map(offset => nominal - offset).filter(candidate => localParts(candidate, timeZone) === normalized)
    .sort((a, b) => a - b).map(candidate => new Date(candidate).toISOString())
}

export function resolutionBody(data: FormData) {
  const text = (key: string) => String(data.get(key) || '').trim()
  const decision = text('decision')
  const reason = text('reason')
  if (!Object.hasOwn(decisions, decision)) throw new Error('Selecciona una decisión válida.')
  if (reason.length < 10 || reason.length > 500) throw new Error('El motivo debe tener entre 10 y 500 caracteres.')
  const resolution: { decision: string; reason: string; adjustment?: Adjustment } = { decision, reason }
  if (decision === 'adjusted') {
    const kind = text('kind') as Adjustment['kind']
    if (!['add_event', 'exclude_event', 'retype_event'].includes(kind)) throw new Error('Selecciona el tipo de ajuste.')
    const adjustment: Adjustment = { kind }
    if (kind !== 'add_event') {
      const eventId = text('eventId')
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId)) throw new Error('Selecciona un marcaje del empleado.')
      adjustment.eventId = eventId
    }
    if (kind !== 'exclude_event') {
      const eventType = text('eventType')
      if (!Object.hasOwn(eventTypes, eventType)) throw new Error('Selecciona el tipo de marcaje.')
      adjustment.eventType = eventType
    }
    if (kind === 'add_event') {
      const at = text('occurredAt')
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at) || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) throw new Error('Selecciona una fecha y hora válida en la zona de la empresa.')
      adjustment.occurredAt = at
    }
    resolution.adjustment = adjustment
  }
  return { resolution }
}
