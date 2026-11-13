import { permissions } from './api'
import type { IconName } from './Icons'
import { roleLabel } from './roles'

/** Lo que cada rol puede ver, más el permiso explícito del expediente. */
export type Allowed = ReturnType<typeof permissions> & { dossier: boolean }
export type ScreenKey = 'panel' | 'sources' | 'attendance' | 'incidents' | 'closures' | 'employees' | 'schedules' | 'imports' | 'devices' | 'cards' | 'settings' | 'users' | 'exports' | 'payroll' | 'audit' | 'dossier' | 'personal' | 'tenants' | 'tenantUsage'

export type Screen = {
  key: ScreenKey
  path: string
  /** Nombre de la pestaña cuando la sección tiene varias pantallas. */
  tab: string
  allowed: (allowed: Allowed, roles: string[]) => boolean
}
export type Section = {
  key: string
  label: string
  /** Nombre corto para la barra inferior del teléfono. */
  short: string
  description?: string
  icon: IconName
  screens: Screen[]
}
export type Group = { key: string; label: string; sections: Section[] }

const can = (key: Exclude<ScreenKey, 'panel' | 'sources' | 'dossier' | 'tenants' | 'tenantUsage' | 'payroll' | 'audit'>) => (allowed: Allowed) => allowed[key]

/**
 * Menú del lienzo (OPE, PAD, EMP). Mientras cada sección no se construya,
 * sus pestañas son las pantallas anteriores del portal; al rehacerla, se
 * cambian aquí sus pantallas y se retira la anterior.
 */
export const companyGroups: Group[] = [
  { key: 'operacion', label: 'Operación', sections: [
    { key: 'panel', label: 'Panel', short: 'Panel', icon: 'panel', screens: [
      { key: 'panel', path: '/panel', tab: 'Panel', allowed: can('attendance') },
    ] },
    { key: 'asistencia', label: 'Asistencia', short: 'Asistencia', icon: 'attendance', screens: [
      { key: 'attendance', path: '/asistencia', tab: 'Asistencia', allowed: can('attendance') },
    ] },
    { key: 'incidencias', label: 'Incidencias', short: 'Incidencias', icon: 'incidents', screens: [
      { key: 'incidents', path: '/incidencias', tab: 'Incidencias', allowed: can('incidents') },
    ] },
    { key: 'cierres', label: 'Cierres semanales', short: 'Cierres', icon: 'closures', screens: [
      { key: 'closures', path: '/cierres', tab: 'Cierres', allowed: can('closures') },
    ] },
  ] },
  { key: 'padron', label: 'Padrón', sections: [
    { key: 'personal', label: 'Personal y horarios', short: 'Personal', icon: 'people', screens: [
      { key: 'employees', path: '/personal', tab: 'Personas', allowed: can('employees') },
      { key: 'schedules', path: '/personal/horarios', tab: 'Horarios', allowed: can('schedules') },
      { key: 'imports', path: '/personal/importaciones', tab: 'Importaciones', allowed: can('imports') },
      { key: 'sources', path: '/personal/fuentes', tab: 'Fuentes del padrón', allowed: can('imports') },
    ] },
    { key: 'dispositivos', label: 'Dispositivos y tarjetas', short: 'Dispositivos', icon: 'devices',
      description: 'los teléfonos que leen las tarjetas y las tarjetas de tu personal', screens: [
        { key: 'devices', path: '/dispositivos', tab: 'Lectores', allowed: can('devices') },
        { key: 'cards', path: '/dispositivos/tarjetas', tab: 'Tarjetas', allowed: can('cards') },
      ] },
  ] },
  { key: 'empresa', label: 'Empresa', sections: [
    { key: 'configuracion', label: 'Configuración', short: 'Configuración', icon: 'settings', screens: [
      { key: 'settings', path: '/configuracion', tab: 'Empresa', allowed: can('settings') },
    ] },
    { key: 'usuarios', label: 'Usuarios y roles', short: 'Usuarios', icon: 'users', screens: [
      { key: 'users', path: '/usuarios', tab: 'Usuarios', allowed: can('users') },
    ] },
    { key: 'reportes', label: 'Reportes y expediente', short: 'Reportes', icon: 'reports', screens: [
      { key: 'exports', path: '/reportes', tab: 'Reportes', allowed: allowed => allowed.exports || allowed.dossier },
      { key: 'payroll', path: '/reportes/nomina', tab: 'Nómina', allowed: can('exports') },
      { key: 'audit', path: '/reportes/bitacora', tab: 'Bitácora', allowed: (_, roles) => roles.some(role => role === 'admin_empresa' || role === 'auditor') },
      { key: 'dossier', path: '/reportes/expediente', tab: 'Expediente', allowed: allowed => allowed.dossier },
    ] },
  ] },
]

/** Consola de quien opera el servicio (CON), que no pertenece a ninguna empresa. */
export const consoleGroups: Group[] = [
  { key: 'servicio', label: 'Servicio', sections: [
    { key: 'empresas', label: 'Empresas', short: 'Empresas', icon: 'building', description: 'las que usan Zenit', screens: [
      { key: 'tenants', path: '/empresas', tab: 'Empresas', allowed: (_, roles) => roles.includes('operador_saas') },
    ] },
    { key: 'uso', label: 'Uso del mes', short: 'Uso', icon: 'columns', description: 'para facturar a cada empresa', screens: [
      { key: 'tenantUsage', path: '/empresas/uso', tab: 'Uso del mes', allowed: (_, roles) => roles.includes('operador_saas') },
    ] },
  ] },
]

/** «Mi asistencia» salió del portal porque el lienzo no la tiene: el trabajador usa la app. */
export const retiredPersonalPath = '/mi-asistencia'

/** Dirección registrada en el servicio de identidad para volver de verificar el expediente. */
export const dossierCallbackPath = '/dossier/callback'
export const sessionEndedPath = '/sesion-terminada'

export function visibleScreens(section: Section, allowed: Allowed, roles: string[]) {
  return section.screens.filter(screen => screen.allowed(allowed, roles))
}

export function visibleGroups(groups: Group[], allowed: Allowed, roles: string[]) {
  return groups
    .map(group => ({ ...group, sections: group.sections.filter(section => visibleScreens(section, allowed, roles).length > 0) }))
    .filter(group => group.sections.length > 0)
}

/** Primera pantalla que la persona puede abrir: el inicio del portal. */
export function homePath(groups: Group[], allowed: Allowed, roles: string[]) {
  for (const group of visibleGroups(groups, allowed, roles))
    for (const section of group.sections) return visibleScreens(section, allowed, roles)[0].path
  return null
}

const companyRoles = ['admin_empresa', 'rh', 'supervisor', 'auditor', 'trabajador']

export { roleLabel }

export function joinNames(names: string[]) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

/** Roles que ven una pantalla, calculados con la misma regla del menú. */
export function rolesFor(screen: Screen) {
  if (screen.key === 'tenants' || screen.key === 'tenantUsage') return ['operador_saas']
  if (screen.key === 'dossier') return []
  return companyRoles.filter(role => screen.allowed({ ...permissions([role]), dossier: false }, [role]))
}
