import type { TenantUser } from './api'
import { dateInZone } from './incidentModel'
import { joinNames, roleLabel } from './sections'
import { shortDay } from './settingsModel'
import type { Tone } from './ui'

/** Una persona con acceso, como la devuelve `GET /users` desde el contrato 0.22.0. */
export type UserRow = TenantUser & { siteIds: string[]; dossierPermission: boolean; dossierPermissionSince: string | null }

export type UserSummary = {
  total: number; active: number; invited: number; disabled: number
  byRole: Record<'admin_empresa' | 'rh' | 'supervisor' | 'auditor' | 'trabajador', number>
  supervisorsWithoutSites: number; dossierPermission: number
}

/** Los roles que se asignan en la empresa, con lo que deja hacer cada uno (EMP-05). */
export const tenantRoles = [
  { key: 'admin_empresa', label: 'Administración', detail: 'Todo, incluso usuarios y reaperturas' },
  { key: 'rh', label: 'RH', detail: 'Personal, incidencias, cierres y nómina' },
  { key: 'supervisor', label: 'Supervisión', detail: 'Sólo las sedes que le asignes' },
  { key: 'auditor', label: 'Auditoría', detail: 'Consulta, exportes y bitácora' },
  { key: 'trabajador', label: 'Trabajador', detail: 'Su asistencia y el acuse de sus cierres, ligado a su fila del padrón' },
] as const
export type TenantRole = typeof tenantRoles[number]['key']

/** Pestañas de la tabla: todas o un rol. «Trabajador» sólo aparece si alguien lo tiene. */
export const roleFilters: { slug: string; label: string; role: TenantRole | null }[] = [
  { slug: 'todos', label: 'Todos', role: null },
  { slug: 'administracion', label: 'Administración', role: 'admin_empresa' },
  { slug: 'rh', label: 'RH', role: 'rh' },
  { slug: 'supervision', label: 'Supervisión', role: 'supervisor' },
  { slug: 'auditoria', label: 'Auditoría', role: 'auditor' },
  { slug: 'trabajador', label: 'Trabajador', role: 'trabajador' },
]

export function roleCount(filter: typeof roleFilters[number], summary: UserSummary | undefined) {
  if (!summary) return undefined
  return filter.role ? summary.byRole[filter.role] : summary.total
}

/** «Administración y RH», en el orden de la tabla de roles. */
export function rolesOf(user: Pick<TenantUser, 'roles'>) {
  const order = tenantRoles.map(role => role.key as string)
  return joinNames([...user.roles].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(roleLabel))
}

const companyWide = ['admin_empresa', 'rh', 'auditor']

/**
 * Qué alcanza a ver: Administración y RH toda la empresa, Auditoría toda en
 * consulta y Supervisión sólo sus sedes, salvo que tenga otro rol de empresa.
 */
export function scopeText(user: Pick<TenantUser, 'roles' | 'status'> & { siteIds?: string[] }, siteName: (id: string) => string | undefined) {
  if (user.status === 'disabled') return '—'
  if (user.roles.some(role => role === 'admin_empresa' || role === 'rh')) return 'Toda la empresa'
  if (user.roles.includes('auditor')) return 'Toda la empresa, consulta'
  if (user.roles.includes('supervisor')) {
    const ids = user.siteIds || []
    if (!ids.length) return 'Sin sedes'
    const names = ids.map(id => siteName(id) || 'Sede').sort((a, b) => a.localeCompare(b, 'es'))
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} y ${names.length - 2} más` : joinNames(names)
  }
  if (user.roles.includes('trabajador')) return 'Su asistencia'
  return '—'
}

export const statusNames: Record<TenantUser['status'], { label: string; tone: Tone }> = {
  active: { label: 'Activa', tone: 'ok' },
  invited: { label: 'Invitada', tone: 'info' },
  disabled: { label: 'Deshabilitada', tone: 'neutral' },
}

/** La liga con su cuenta del servicio de identidad. */
export function accountText(user: Pick<TenantUser, 'status' | 'linkedAt'>) {
  if (user.linkedAt) return 'Vinculada'
  return user.status === 'disabled' ? 'Sin cuenta ligada' : 'Sin entrar aún'
}

/** «19 oct», el día en la zona de la empresa. */
export function dayText(instant: string, timeZone: string) {
  return shortDay(dateInZone(instant, timeZone)).replace(/^\S+ /, '')
}

/** «activa desde el 20 oct», «invitada el 5 nov» o «deshabilitada». */
export function sinceText(user: Pick<TenantUser, 'status' | 'linkedAt' | 'createdAt'>, timeZone: string) {
  if (user.status === 'active' && user.linkedAt) return `activa desde el ${dayText(user.linkedAt, timeZone)}`
  if (user.status === 'invited') return `invitada el ${dayText(user.createdAt, timeZone)}`
  return 'deshabilitada'
}

/** Lo que se manda al guardar «Editar acceso»: sólo lo que cambió. */
export type AccessDraft = { displayName: string; roles: string[]; siteIds: string[]; employeeId: string | null; dossier: boolean }

export function accessDraft(user: UserRow): AccessDraft {
  return { displayName: user.displayName, roles: [...user.roles], siteIds: [...user.siteIds], employeeId: user.employeeId, dossier: user.dossierPermission }
}

const same = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',')

export function accessChanges(user: UserRow, draft: AccessDraft) {
  const body: Record<string, unknown> = {}
  const name = draft.displayName.trim()
  if (name !== user.displayName) body.displayName = name
  if (!same(draft.roles, user.roles)) body.roles = draft.roles
  // Sin Supervisión las sedes no cuentan: no se mandan ni se borran.
  const siteIds = draft.roles.includes('supervisor') ? draft.siteIds : user.siteIds
  if (!same(siteIds, user.siteIds)) body.siteIds = siteIds
  const employeeId = draft.roles.includes('trabajador') || user.employeeId ? draft.employeeId : user.employeeId
  if (employeeId !== user.employeeId) body.employeeId = employeeId
  return { body, dossier: draft.dossier !== user.dossierPermission ? draft.dossier : undefined }
}

export function accessProblem(draft: AccessDraft, hadName: boolean) {
  if (!draft.roles.length) return 'Elige al menos un rol.'
  if (hadName && !draft.displayName.trim()) return 'El nombre no puede quedar vacío.'
  return undefined
}

/** EMP-06: qué deja hacer cada rol, con la misma regla que aplica el servidor. */
export const permissionRows: { action: string; values: [string, string, string, string] }[] = [
  { action: 'Ver asistencia, incidencias y cierres', values: ['Sí', 'Sí', 'Sus sedes', 'Sí'] },
  { action: 'Resolver incidencias', values: ['Sí', 'Sí', 'Sus sedes', '—'] },
  { action: 'Personal y horarios', values: ['Sí', 'Sí', 'Consulta, sus sedes', 'Consulta'] },
  { action: 'Tarjetas y lectores', values: ['Sí', 'Sí', '—', 'Consulta'] },
  { action: 'Importar el padrón', values: ['Sí', 'Sí', '—', '—'] },
  { action: 'Cerrar semanas', values: ['Sí', 'Sí', '—', '—'] },
  { action: 'Reabrir un cierre', values: ['Sí', '—', '—', '—'] },
  { action: 'Exportar para nómina', values: ['Sí', 'Sí', '—', 'Sí'] },
  { action: 'Bitácora', values: ['Sí', '—', '—', 'Sí'] },
  { action: 'Usuarios y configuración', values: ['Sí', '—', '—', '—'] },
]

/** El correo y el número de «Ayuda y soporte» (decidido el 10 nov). */
export const support = { email: 'rene.alexis.segura@gmail.com', phone: '56 3300 1126', tel: '+525633001126' }
