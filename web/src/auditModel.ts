import { shortWeekLabel } from './attendanceModel'
import { incidentTypes } from './incidentModel'
import { roleLabel } from './roles'
import { breakNames, shortDay } from './settingsModel'

/** Una acción de la bitácora, como la devuelve `GET /audit-log`. */
export type AuditEntry = {
  id: string; at: string
  actor: { type: 'user' | 'device' | 'system'; id: string | null; displayName: string | null }
  action: string
  target: { type: string; id: string | null; displayName: string | null }
  correlationId?: string | null
  metadata: Record<string, string>
}
export type AuditSummary = { total: number; capped: boolean; cap: number }

/** Los grupos de acciones del filtro, como los agrupa el servidor por su prefijo. */
export const auditGroups = [
  { key: '', label: 'Todas' },
  { key: 'closures', label: 'Cierres y reaperturas' },
  { key: 'incidents', label: 'Incidencias' },
  { key: 'directory', label: 'Personal y horarios' },
  { key: 'devices', label: 'Tarjetas y lectores' },
  { key: 'access', label: 'Accesos y permisos' },
  { key: 'settings', label: 'Configuración' },
  { key: 'exports', label: 'Exportes y expediente' },
] as const

export const actorTypes = [
  { key: '', label: 'Todos' },
  { key: 'user', label: 'Personas' },
  { key: 'device', label: 'Lectores' },
  { key: 'system', label: 'Sistema' },
] as const

/** Quién actuó: la persona o el lector por su nombre, o «Sistema». */
export function actorText(entry: Pick<AuditEntry, 'actor'>) {
  if (entry.actor.type === 'system') return 'Sistema'
  return entry.actor.displayName || (entry.actor.type === 'device' ? 'Un lector' : 'Una persona')
}

const decisions: Record<string, string> = { justified: 'justificada', confirmed: 'confirmada', adjusted: 'ajustada' }
const fieldNames: Record<string, string> = {
  name: 'el nombre', displayName: 'el nombre', timeZone: 'la zona horaria', weekStartsOn: 'el inicio de semana', autoCloseAfterHours: 'el cierre automático',
  latitude: 'la ubicación', longitude: 'la ubicación', radiusMeters: 'el radio', status: 'el estado', siteId: 'la sede', externalId: 'el número',
  employmentStart: 'la fecha de alta', employmentEnd: 'la fecha de baja', employeeId: 'la fila del padrón',
}
const cardReasons: Record<string, string> = { lost: 'pérdida', damaged: 'daño', revoked: 'decisión de la empresa', employee_deactivated: 'baja de la persona' }

function fields(value: string | undefined) {
  const names = [...new Set((value || '').split(',').filter(Boolean).map(field => fieldNames[field] || field))]
  if (!names.length) return ''
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}
function roles(value: string | undefined) { return (value || '').split(',').filter(Boolean).map(roleLabel).join(', ') }
function week(value: string | undefined) { return value ? shortWeekLabel(value) : 'la semana' }
function day(value: string | undefined) { return value ? shortDay(value) : '' }

/**
 * La acción en una frase, como «Resolvió como ajustada una incidencia de
 * Jorge Ramírez». Lo que no se conoce se muestra con su código, para no
 * perder ninguna fila.
 */
export function actionText(entry: Pick<AuditEntry, 'action' | 'target' | 'metadata'>): string {
  const m = entry.metadata || {}
  const who = entry.target.displayName
  const of = who ? ` de ${who}` : ''
  const to = who ? ` a ${who}` : ''
  const named = (fallback: string) => who || fallback
  switch (entry.action) {
    case 'week.closed': return m.weekStart ? `Cerró la semana ${week(m.weekStart)}${of}` : `Cerró la semana${of}`
    case 'week.reopened': return `Reabrió el cierre${of}${m.reason ? `: «${m.reason}»` : ''}`
    case 'week.acknowledged': return `${m.type === 'objected' ? 'Objetó' : 'Dio conformidad a'} el cierre${of}`
    case 'week.closure_run_requested': return `Pidió el cierre de ${week(m.weekStart)}`
    case 'week.closure_run_finished': return `Terminó el cierre de ${week(m.weekStart)}: ${m.closed ?? 0} cerradas${Number(m.openIncidents || 0) + Number(m.openSegment || 0) ? `, ${Number(m.openIncidents || 0) + Number(m.openSegment || 0)} bloqueadas` : ''}`
    case 'week.closure_run_failed': return `No se pudo terminar un cierre${m.failure ? ` (${m.failure})` : ''}`
    case 'incident.opened': return m.type ? `Abrió «${incidentTypes[m.type] || m.type}»${of}` : `Abrió una incidencia${of}`
    case 'incident.assigned': return m.assigned === 'false' ? `Soltó la incidencia${of}` : `Tomó la incidencia${of}`
    case 'incident.resolved': return `Resolvió como ${decisions[m.decision] || m.decision || 'resuelta'} una incidencia${of}`
    case 'employee.created': return `Dio de alta a ${named('una persona')}${m.source && m.source !== 'manual' ? ' desde una importación' : ''}`
    case 'employee.updated': return `Cambió ${fields(m.fields) || 'los datos'}${of}`
    case 'employee.deactivated': return `Dio de baja a ${named('una persona')}`
    case 'employee.reactivated': return `Reactivó a ${named('una persona')}`
    case 'employee.schedule_assigned': return `Asignó un horario${to}${m.validFrom ? ` desde el ${day(m.validFrom)}` : ''}`
    case 'schedule.created': return `Creó el horario ${named('nuevo')}`
    case 'card.registered': return `Registró la tarjeta ${named('nueva')}${m.scheme ? ' del piloto' : ''}`
    case 'card.assigned': return `${m.replacedCardId ? 'Reemplazó y asignó' : 'Asignó'} la tarjeta ${named('')}`.trim()
    case 'card.revoked': return `Revocó la tarjeta ${named('')}${m.reason ? ` por ${cardReasons[m.reason] || m.reason}` : ''}`.replace('tarjeta  por', 'tarjeta por')
    case 'device.enrollment_created': return `Generó un código para activar ${m.mode === 'personal' ? 'un teléfono personal' : 'una terminal de sede'}`
    case 'device.activated': return `Se activó ${m.mode === 'personal' ? 'el teléfono' : 'la terminal'} ${named('')}`.trim()
    case 'device.revoked': return `Revocó el lector ${named('')}${m.reason ? `: «${m.reason}»` : ''}`.replace('lector :', 'lector:')
    case 'user.invited': return `Invitó a ${named('una persona')}${m.roles ? ` con rol ${roles(m.roles)}` : ''}`
    case 'user.linked': return 'Entró por primera vez'
    case 'user.updated': return `Cambió ${fields(m.fields) || 'el acceso'}${of}`
    case 'user.roles_changed': return `Cambió los roles${of}${m.added ? `: agregó ${roles(m.added)}` : ''}${m.removed ? `${m.added ? ';' : ':'} quitó ${roles(m.removed)}` : ''}`
    case 'user.sites_changed': return `Cambió las sedes que supervisa ${named('una persona')}`
    case 'user.disabled': return `Deshabilitó el acceso${of}`
    case 'user.enabled': return `Habilitó el acceso${of}`
    case 'user.unlinked': return `Soltó la liga con la cuenta${of}`
    case 'user.password_change_required': return `Pidió una contraseña nueva${to}`
    case 'dossier.permission_granted': return `Concedió el permiso de expediente${to}`
    case 'dossier.permission_revoked': return `Retiró el permiso de expediente${to}`
    case 'tenant.created': return 'Dio de alta la empresa'
    case 'tenant.updated': return `Cambió ${fields(m.fields) || 'los datos'} de la empresa`
    case 'tenant.suspended': return `Suspendió la empresa${m.reason ? `: «${m.reason}»` : ''}`
    case 'tenant.reactivated': return 'Reactivó la empresa'
    case 'tenant.break_policy_change_scheduled': return `Programó que la comida ${m.breakPolicy === 'marked' ? 'se marque' : 'no se considere'} desde el ${day(m.effectiveOn)}`
    case 'tenant.break_policy_change_cancelled': return `Canceló el cambio de comida a «${breakNames[m.breakPolicy as 'marked'] || m.breakPolicy}» del ${day(m.effectiveOn)}`
    case 'site.created': return `Agregó la sede ${named('nueva')}`
    case 'site.updated': return `Cambió ${fields(m.fields) || 'los datos'} de ${named('una sede')}`
    case 'export.requested': return `Pidió el exporte de ${week(m.weekStart)}`
    case 'export.ready': return `Preparó el exporte${m.rows ? ` con ${m.rows} filas` : ''}`
    case 'export.failed': return 'No se pudo preparar un exporte'
    case 'export.downloaded': return 'Descargó un exporte'
    case 'dossier.requested': return 'Pidió una copia del expediente'
    case 'dossier.ready': return 'Preparó una copia del expediente'
    case 'dossier.failed': return 'No se pudo preparar una copia del expediente'
    case 'dossier.expired': return 'Venció una copia del expediente sin descargar'
    case 'dossier.challenge_created': return 'Pidió confirmar su identidad para el expediente'
    case 'dossier.verification_failed': return 'Falló la confirmación de identidad del expediente'
    case 'dossier.authorized': return 'Confirmó su identidad para descargar el expediente'
    case 'dossier.downloaded': return 'Descargó el expediente'
  }
  if (entry.action.startsWith('import.')) return `Importó un CSV del padrón${m.total ? `: ${m.accepted ?? 0} de ${m.total} filas aplicadas` : ''}`
  return `${entry.action}${who ? ` · ${who}` : ''}`
}
