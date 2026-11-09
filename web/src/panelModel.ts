import type { UpcomingBreakPolicy } from './api'
import { type AttendanceSummary, dayMonth, longDate, shortWeekLabel } from './attendanceModel'
import type { ClosureSummary } from './closureModel'
import type { IconName } from './Icons'
import type { Incident } from './incidentModel'
import { incidentIcons, incidentTitle, whenText } from './incidentsView'
import type { Tone } from './ui'

/** Lo que el Panel (OPE-01, OPE-12) y los avisos (CTA-03) arman sin llamar al API. */

const zoneNames: Record<string, string> = {
  'America/Mexico_City': 'Ciudad de México', 'America/Monterrey': 'Monterrey', 'America/Merida': 'Mérida', 'America/Cancun': 'Cancún',
  'America/Chihuahua': 'Chihuahua', 'America/Ciudad_Juarez': 'Ciudad Juárez', 'America/Mazatlan': 'Mazatlán', 'America/Hermosillo': 'Hermosillo',
  'America/Tijuana': 'Tijuana', 'America/Matamoros': 'Matamoros', 'America/Ojinaga': 'Ojinaga', 'America/Bahia_Banderas': 'Bahía de Banderas',
}
/** «Ciudad de México»; una zona fuera de México, por su ciudad. */
export function zoneName(timeZone: string) {
  return zoneNames[timeZone] || (timeZone.split('/').at(-1) || timeZone).replace(/_/g, ' ')
}

/** «viernes 6 de noviembre, hora de Ciudad de México». */
export function dateLine(date: string, timeZone: string) { return `${longDate(date)}, hora de ${zoneName(timeZone)}` }

/** «Mariana Ortiz» → «Mariana». */
export function firstName(name: string) { return name.trim().split(/\s+/)[0] || name }

export type Notice = { key: string; tone: Tone; icon: IconName; title: string; text: string; when?: string; to: string }

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** «La comida se marca desde el lun 16 nov». */
export function breakChangeText(change: UpcomingBreakPolicy) {
  return `La comida ${change.breakPolicy === 'marked' ? 'se marca' : 'deja de marcarse'} desde el ${dayMonth(change.effectiveOn)}`
}

/**
 * Lo que pide atención y no es una incidencia suelta: objeciones y personas
 * bloqueadas de la semana anterior y lectores sin señal. Cada aviso lleva a
 * donde se atiende; su clave cambia si cambia la cifra, para volver a avisar.
 */
export function pendingNotices({ summary, closures }: { summary?: AttendanceSummary; closures?: ClosureSummary }): Notice[] {
  const notices: Notice[] = []
  const previous = summary?.previousWeek
  if (previous && previous.objected > 0) notices.push({
    key: `objecion:${previous.weekStart}:${previous.objected}`, tone: 'warn', icon: 'closures', title: previous.objected === 1 ? 'Objeción a un cierre' : 'Objeciones a cierres',
    text: `${previous.objected === 1 ? 'Una persona no está conforme' : `${previous.objected} personas no están conformes`} con la semana ${shortWeekLabel(previous.weekStart)}`,
    to: `/cierres?semana=${previous.weekStart}&acuse=objecion`,
  })
  if (closures && closures.blocked > 0) notices.push({
    key: `bloqueadas:${closures.weekStart}:${closures.blocked}`, tone: 'warn', icon: 'closures', title: 'Semanas sin cerrar',
    text: `${plural(closures.blocked, 'persona bloqueada', 'personas bloqueadas')} en ${shortWeekLabel(closures.weekStart)}, por incidencias o tramos abiertos`,
    to: `/cierres?semana=${closures.weekStart}&pestana=bloqueadas`,
  })
  const silent = summary?.devices?.silent || 0
  if (silent > 0) notices.push({
    key: `lectores:${silent}`, tone: 'neutral', icon: 'devices', title: silent === 1 ? 'Lector sin señal' : 'Lectores sin señal',
    text: `${silent === 1 ? 'Un lector lleva' : `${silent} lectores llevan`} más de 24 horas sin dar señal`, to: '/dispositivos',
  })
  return notices
}

/** Una incidencia abierta como aviso: «Luis Hernández: falta la marca que cierra». */
export function incidentNotice(incident: Incident, timeZone: string, today: string): Notice {
  const title = incidentTitle(incident.type)
  return {
    key: `incidencia:${incident.id}`, tone: incident.severity === 'high' ? 'error' : incident.severity === 'medium' ? 'warn' : 'neutral',
    icon: incidentIcons[incident.type] || 'incidents', title: incident.severity === 'high' ? 'Incidencia de severidad alta' : title,
    text: incident.employeeName ? `${incident.employeeName}: ${title.charAt(0).toLowerCase()}${title.slice(1)}` : title,
    when: whenText(incident.occurredAt || incident.openedAt, timeZone, today), to: `/incidencias?incidencia=${incident.id}`,
  }
}

/**
 * Los avisos de la campana (CTA-03): el cambio programado de la comida, las
 * incidencias abiertas de severidad alta y lo pendiente de la semana anterior.
 * Salen de rutas que ya existen; no hay avisos guardados en el servidor.
 */
export function bellNotices({ upcoming, incidents = [], summary, closures, timeZone, today }: {
  upcoming?: UpcomingBreakPolicy | null; incidents?: Incident[]; summary?: AttendanceSummary; closures?: ClosureSummary; timeZone: string; today: string
}): Notice[] {
  const notices: Notice[] = []
  if (upcoming) notices.push({ key: `comida:${upcoming.effectiveOn}:${upcoming.breakPolicy}`, tone: 'info', icon: 'notice', title: 'Cambio programado', text: breakChangeText(upcoming), to: '/configuracion' })
  for (const incident of incidents.filter(item => item.severity === 'high').slice(0, 3)) notices.push(incidentNotice(incident, timeZone, today))
  return [...notices, ...pendingNotices({ summary, closures })]
}

/** Las claves vistas que siguen vigentes: lo que ya no está deja de guardarse. */
export function unseen(notices: Notice[], seen: string[]) { return notices.filter(notice => !seen.includes(notice.key)) }

export type AuditEntry = {
  id: string; at: string; action: string
  actor: { type: 'user' | 'device' | 'system'; id: string | null; displayName: string | null }
  target: { type: string; id: string | null; displayName: string | null }
  metadata: Record<string, string>
}

type Phrase = (target: string) => string
const of = (base: string): Phrase => target => (target ? `${base} de ${target}` : base)
const to = (base: string): Phrase => target => (target ? `${base} a ${target}` : base)
const named = (base: string): Phrase => target => (target ? `${base} ${target}` : base)
const plain = (base: string): Phrase => () => base

const phrases: Record<string, Phrase> = {
  'card.registered': named('registró la tarjeta'), 'card.assigned': named('asignó la tarjeta'), 'card.revoked': named('dio de baja la tarjeta'),
  'device.activated': named('activó el lector'), 'device.enrollment_created': plain('generó un código para activar un lector'), 'device.revoked': named('dio de baja el lector'),
  'dossier.requested': plain('pidió una copia del expediente'), 'dossier.ready': plain('dejó lista una copia del expediente'), 'dossier.failed': plain('no pudo preparar una copia del expediente'),
  'dossier.expired': plain('dejó vencer una copia del expediente'), 'dossier.downloaded': plain('descargó una copia del expediente'),
  'dossier.challenge_created': plain('pidió confirmar su identidad para el expediente'), 'dossier.authorized': plain('confirmó su identidad para el expediente'),
  'dossier.verification_failed': plain('no pudo confirmar su identidad para el expediente'),
  'dossier.permission_granted': to('dio el permiso del expediente'), 'dossier.permission_revoked': to('quitó el permiso del expediente'),
  'employee.created': to('dio de alta'), 'employee.updated': of('actualizó los datos'), 'employee.deactivated': to('dio de baja'),
  'employee.reactivated': to('reactivó'), 'employee.schedule_assigned': to('asignó un horario'),
  'export.requested': plain('pidió un exporte para nómina'), 'export.ready': plain('dejó listo un exporte para nómina'),
  'export.failed': plain('no pudo preparar un exporte para nómina'), 'export.downloaded': plain('descargó un exporte para nómina'),
  'incident.opened': of('abrió una incidencia'), 'incident.assigned': of('tomó la incidencia'), 'incident.resolved': of('resolvió la incidencia'),
  'schedule.created': named('creó el horario'), 'site.created': named('agregó la sede'), 'site.updated': named('actualizó la sede'),
  'tenant.updated': plain('actualizó la configuración de la empresa'), 'tenant.break_policy_change_scheduled': plain('programó un cambio de la comida'),
  'tenant.break_policy_change_cancelled': plain('canceló el cambio programado de la comida'), 'tenant.created': plain('creó la empresa'),
  'tenant.suspended': plain('suspendió la empresa'), 'tenant.reactivated': plain('reactivó la empresa'),
  'user.invited': to('invitó'), 'user.updated': of('actualizó la cuenta'), 'user.enabled': of('reactivó la cuenta'), 'user.disabled': of('desactivó la cuenta'),
  'user.roles_changed': of('cambió los roles'), 'user.sites_changed': of('cambió las sedes'), 'user.linked': of('ligó la cuenta'),
  'user.unlinked': of('desligó la cuenta'), 'user.password_change_required': to('pidió una contraseña nueva'),
  'week.closed': of('cerró la semana'), 'week.reopened': of('reabrió la semana'), 'week.acknowledged': plain('dio su acuse de la semana'),
  'week.closure_run_requested': plain('pidió cerrar las pendientes'), 'week.closure_run_finished': plain('terminó una corrida de cierre'),
  'week.closure_run_failed': plain('no pudo terminar una corrida de cierre'),
}

/** Quién hizo qué, en una línea de «Actividad reciente»: «Rocío Navarro asignó la tarjeta T-0042». */
export function activityText(entry: AuditEntry): { who: string; what: string } {
  const target = entry.target.displayName || ''
  // Una cuenta se liga sola la primera vez que entra: quien actúa es la misma persona.
  if (entry.action === 'user.linked' && entry.actor.displayName && entry.actor.displayName === target) return { who: target, what: 'entró por primera vez' }
  const what = (phrases[entry.action] || plain('hizo un cambio'))(target)
  if (entry.actor.type === 'system') return entry.action === 'incident.opened' ? { who: 'Se abrió', what: what.replace(/^abrió /, '') } : { who: 'Zenit', what }
  return { who: entry.actor.displayName || (entry.actor.type === 'device' ? 'Un lector' : 'Operación del servicio'), what }
}

export type Step = { key: string; title: string; detail: string; done: boolean; action: string; to: string }
export type StepFacts = {
  sites: { name: string; radiusMeters: number }[]; schedules: number; employees: number; cards: number; devices: number; users: number
}

/** OPE-12: lo que una empresa nueva deja listo, en el orden en que Zenit lo necesita. */
export function firstSteps(facts: StepFacts): Step[] {
  const sites = facts.sites
  return [
    { key: 'empresa', title: 'Revisa los datos de tu empresa', detail: 'Nombre, zona horaria e inicio de semana', done: true, action: 'Ver', to: '/configuracion' },
    { key: 'sedes', title: 'Agrega tus sedes y su zona de marcaje',
      detail: sites.length === 1 ? `1 sede: ${sites[0].name}, círculo de ${sites[0].radiusMeters} m` : sites.length ? `${sites.length} sedes: ${sites.map(site => site.name).join(', ')}` : 'Dónde marca tu personal y qué tan lejos puede estar',
      done: sites.length > 0, action: sites.length ? 'Agregar otra' : 'Agregar sede', to: '/configuracion/sedes' },
    { key: 'horarios', title: 'Crea los horarios', detail: facts.schedules ? plural(facts.schedules, 'horario creado', 'horarios creados') : 'Días, entrada, salida y comida de cada turno',
      done: facts.schedules > 0, action: 'Crear horario', to: '/personal/horarios' },
    { key: 'personal', title: 'Da de alta a tu personal', detail: facts.employees ? plural(facts.employees, 'persona activa', 'personas activas') : 'Uno por uno o con el CSV de tu sistema de nómina',
      done: facts.employees > 0, action: 'Importar CSV', to: '/personal/importaciones' },
    { key: 'tarjetas', title: 'Registra y asigna las tarjetas', detail: facts.cards ? plural(facts.cards, 'tarjeta asignada', 'tarjetas asignadas') : 'Cada persona marca con la suya',
      done: facts.cards > 0, action: 'Registrar', to: '/dispositivos/tarjetas' },
    { key: 'lectores', title: 'Activa un lector en cada sede', detail: facts.devices ? plural(facts.devices, 'lector activo', 'lectores activos') : 'Un teléfono de la sede o el de cada persona',
      done: facts.devices > 0, action: 'Activar', to: '/dispositivos' },
    { key: 'equipo', title: 'Invita a tu equipo', detail: facts.users > 1 ? plural(facts.users, 'cuenta', 'cuentas') : 'RH, Supervisión o Auditoría, con su rol',
      done: facts.users > 1, action: 'Invitar', to: '/usuarios' },
  ]
}
