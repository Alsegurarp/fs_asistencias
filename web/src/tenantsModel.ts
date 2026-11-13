import type { Tenant, TenantUsage } from './api'
import type { Tone } from './ui'

/** Quien administra una empresa: sólo su correo y su acceso. */
export type Administrator = { email: string; status: 'active' | 'invited'; invitedAt: string; linkedAt: string | null }
export type AdministrationState = 'linked' | 'pending' | 'none'
/** Una empresa vista desde la operación del servicio. */
export type OperatedTenant = Tenant & { administration: { state: AdministrationState; total: number; administrators: Administrator[] } }
export type TenantSummary = { total: number; active: number; suspended: number; administration: Record<AdministrationState, number> }
export type UsageItem = { id: string; name: string; slug: string; status: 'active' | 'suspended'; usage: TenantUsage }
export type UsageSummary = { month: string; tenants: number; complete: number } & Record<UsageKey, number>

export type UsageKey = 'employeesWithAttendance' | 'employeesInPeriod' | 'cardsAssigned' | 'devicesActive' | 'attendanceEvents'
/** Los conteos del mes, en el orden de la tabla y del CSV. */
export const usageColumns: { key: UsageKey; label: string; short: string }[] = [
  { key: 'employeesWithAttendance', label: 'Personas que marcaron', short: 'personas que marcaron' },
  { key: 'employeesInPeriod', label: 'Personas vigentes', short: 'personas vigentes' },
  { key: 'cardsAssigned', label: 'Tarjetas asignadas', short: 'tarjetas asignadas' },
  { key: 'devicesActive', label: 'Lectores activos', short: 'lectores activos' },
  { key: 'attendanceEvents', label: 'Marcajes', short: 'marcajes' },
]

export const statusNames: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Activa', tone: 'ok' },
  suspended: { label: 'Suspendida', tone: 'error' },
}

/** Vistas de la tabla: cada una es un filtro del servidor. */
export const tenantFilters: { slug: string; label: string; params: Record<string, string>; count: (summary: TenantSummary) => number; always: boolean }[] = [
  { slug: 'todas', label: 'Todas', params: {}, count: summary => summary.total, always: true },
  { slug: 'activas', label: 'Activas', params: { status: 'active' }, count: summary => summary.active, always: true },
  { slug: 'suspendidas', label: 'Suspendidas', params: { status: 'suspended' }, count: summary => summary.suspended, always: true },
  { slug: 'invitacion-pendiente', label: 'Invitación sin usar', params: { administration: 'pending' }, count: summary => summary.administration.pending, always: false },
  { slug: 'sin-administracion', label: 'Sin quien administre', params: { administration: 'none' }, count: summary => summary.administration.none, always: false },
]

export const zones = [
  { value: 'America/Mexico_City', label: 'Ciudad de México' },
  { value: 'America/Tijuana', label: 'Tijuana' },
  { value: 'America/Cancun', label: 'Cancún' },
  { value: 'America/Chihuahua', label: 'Chihuahua' },
  { value: 'America/Hermosillo', label: 'Hermosillo' },
  { value: 'America/Mazatlan', label: 'Mazatlán' },
  { value: 'America/Monterrey', label: 'Monterrey' },
  { value: 'America/Merida', label: 'Mérida' },
]
/** «Ciudad de México»; una zona que no está en la lista se muestra como viene. */
export function zoneName(timeZone: string) {
  return zones.find(zone => zone.value === timeZone)?.label || timeZone.split('/').pop()!.replace(/_/g, ' ')
}

/** Mes en curso en una zona horaria, como AAAA-MM. */
export function currentMonth(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now)
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`
}

/** La consola corta «el mes en curso» con la hora del centro de México. */
export const consoleZone = 'America/Mexico_City'

export function addMonths(month: string, delta: number) {
  const [year, index] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, index - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** «noviembre» o «noviembre 2026». */
export function monthName(month: string, year = false) {
  const date = new Date(`${month}-15T12:00:00Z`)
  const name = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' }).format(date)
  return year ? `${name} ${date.getUTCFullYear()}` : name
}
export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const validMonth = (month: string | null): month is string => !!month && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)

/** «19 oct 2026», en la zona de la empresa. */
export function dayOf(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(new Date(instant)).replace('.', '')
}

export const count = (value: number) => value.toLocaleString('es-MX')

/** Qué decir de quien administra una empresa, en una línea. */
export function administrationText(tenant: OperatedTenant) {
  const { state, total, administrators } = tenant.administration
  if (state === 'none' || !administrators.length) return 'Nadie'
  const first = administrators[0].email
  return total > 1 ? `${first} y ${total - 1} más` : first
}
export const administrationNames: Record<AdministrationState, { label: string; tone: Tone }> = {
  linked: { label: 'Ya entró', tone: 'ok' },
  pending: { label: 'Invitación sin usar', tone: 'warn' },
  none: { label: 'Sin quien administre', tone: 'error' },
}

const cell = (value: string | number) => {
  const text = String(value)
  // Un nombre que empieza como fórmula no debe ejecutarse al abrir el archivo.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** El CSV del uso de un mes: una fila por empresa y el total; sólo conteos. */
export function usageCsv(month: string, items: UsageItem[], totals: UsageSummary) {
  const head = ['Mes', 'Empresa', 'Identificador', 'Estado', 'Mes completo', ...usageColumns.map(column => column.label)]
  const rows = items.map(item => [month, item.name, item.slug, statusNames[item.status]?.label || item.status, item.usage.complete ? 'sí' : 'no', ...usageColumns.map(column => item.usage[column.key])])
  const total = [month, 'Total', '', '', totals.complete === totals.tenants ? 'sí' : 'no', ...usageColumns.map(column => totals[column.key])]
  return '﻿' + [head, ...rows, total].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
