import type { Card, Device } from './api'
import { timeIn } from './attendanceModel'
import { dateInZone } from './incidentModel'
import { shortDate } from './personnelModel'
import type { Tone } from './ui'

/** Lo que comparten Lectores (PAD-02) y Tarjetas (PAD-11): textos, estados y filtros. */

export type DeviceSummary = { active: number; silent: number; revoked: number; replaced: number }
export type CardSummary = { total: number; byStatus: Record<string, number> }

export type CardRegistrar = { type: 'user' | 'device'; name: string | null }
export type CardHistory = { employeeId: string; employeeName: string; employeeExternalId: string; since: string; until: string | null; replacedCardId: string | null }
export type CardDetail = Card & {
  registeredBy: CardRegistrar | null
  assignments: CardHistory[]
  lastRead: { observedAt: string; deviceId: string; deviceName: string } | null
  readCount: number
}

/** Un lector activo sin contacto en este tiempo está «sin señal»; el servidor usa el mismo umbral. */
export const silentAfterMs = 24 * 60 * 60 * 1000

export const deviceModes: Record<Device['mode'], string> = { terminal: 'Terminal de sede', personal: 'Teléfono personal' }

/** Las pestañas de Lectores; cada una es una consulta al servidor. */
export const deviceFilters = [
  { slug: 'activos', label: 'Activos', query: { status: ['active'] } },
  { slug: 'sin-senal', label: 'Sin señal más de 24 h', query: { status: ['active'], silent: true } },
  { slug: 'revocados', label: 'Revocados o reemplazados', query: { status: ['revoked', 'replaced'] } },
] as const
export type DeviceFilter = typeof deviceFilters[number]

export function deviceCount(filter: DeviceFilter, summary: DeviceSummary | undefined) {
  if (!summary) return undefined
  return filter.slug === 'activos' ? summary.active : filter.slug === 'sin-senal' ? summary.silent : summary.revoked + summary.replaced
}

/** Nombre del lector en la tabla: su etiqueta, «Teléfono de …» o el modelo. */
export function deviceName(device: Pick<Device, 'mode' | 'label' | 'model' | 'employeeName'>) {
  if (device.label) return device.label
  if (device.mode === 'personal' && device.employeeName) return `Teléfono de ${device.employeeName}`
  return device.mode === 'terminal' ? `Terminal · ${device.model}` : device.model
}

/** «hace 3 min», «hace 26 h», «hace 4 días» o «sin señal todavía». */
export function sinceText(instant: string | null, now: Date) {
  if (!instant) return 'sin señal todavía'
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(instant).getTime()) / 60_000))
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} días`
}

export function silent(device: Pick<Device, 'status' | 'lastSeenAt'>, now: Date) {
  return device.status === 'active' && (!device.lastSeenAt || now.getTime() - new Date(device.lastSeenAt).getTime() > silentAfterMs)
}

export function deviceStatus(device: Pick<Device, 'status' | 'lastSeenAt'>, now: Date): { label: string; tone: Tone } {
  if (device.status === 'revoked') return { label: 'Revocado', tone: 'neutral' }
  if (device.status === 'replaced') return { label: 'Reemplazado', tone: 'neutral' }
  return silent(device, now) ? { label: 'Sin señal', tone: 'warn' } : { label: 'Activo', tone: 'ok' }
}

/** «Android · activado 12 oct»: el modelo que reporta el teléfono y el día que se activó. */
export function deviceDetail(device: Pick<Device, 'model' | 'enrolledAt'>, timeZone: string) {
  return `${device.model} · activado ${shortDate(dateInZone(device.enrolledAt, timeZone)).replace(/ \d{4}$/, '')}`
}

/** Las pestañas de Tarjetas, como en el lienzo; cada una pide sus estados al servidor. */
export const cardFilters = [
  { slug: 'todas', label: 'Todas', statuses: [] },
  { slug: 'activas', label: 'Activas', statuses: ['active', 'assigned'] },
  { slug: 'inventario', label: 'En inventario', statuses: ['inventory'] },
  { slug: 'perdidas', label: 'Perdidas o dañadas', statuses: ['lost', 'damaged'] },
  { slug: 'revocadas', label: 'Revocadas', statuses: ['revoked'] },
  { slug: 'reemplazadas', label: 'Reemplazadas', statuses: ['replaced'] },
] as const
export type CardFilter = typeof cardFilters[number]

export function cardCount(filter: CardFilter, summary: CardSummary | undefined) {
  if (!summary) return undefined
  if (!filter.statuses.length) return summary.total
  return filter.statuses.reduce((sum, status) => sum + (summary.byStatus[status] || 0), 0)
}

const cardStatuses: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Activa', tone: 'ok' },
  assigned: { label: 'Activa', tone: 'ok' },
  inventory: { label: 'En inventario', tone: 'info' },
  lost: { label: 'Perdida', tone: 'error' },
  damaged: { label: 'Dañada', tone: 'error' },
  revoked: { label: 'Revocada', tone: 'neutral' },
  replaced: { label: 'Reemplazada', tone: 'neutral' },
}
export function cardStatus(status: string) { return cardStatuses[status] || { label: status, tone: 'neutral' as Tone } }

const technologies: Record<string, string> = {
  manual: 'Huella manual',
  mifare_classic_signed: 'MIFARE Classic firmada',
}
/** «Tecnología»: cómo se registró la tarjeta y qué lleva dentro. */
export function cardTechnology(technology?: string) { return technology ? technologies[technology] || technology : '—' }

/** «Lecturas»: cuántos marcajes tiene y cuándo y dónde fue el último. */
export function readsText(card: Pick<CardDetail, 'readCount' | 'lastRead'>, timeZone: string, today: string) {
  if (!card.lastRead) return 'Todavía no se ha leído'
  return `${card.readCount} · la última ${readText(card.lastRead.observedAt, timeZone, today)} · ${card.lastRead.deviceName}`
}

/**
 * «Asignada a»: la persona que la tiene o, si ya no la tiene nadie, quién la
 * tuvo. La fecha en que la dejó va en «Desde», para no repetirla.
 */
export function cardHolder(card: Pick<Card, 'assignment' | 'latestAssignment'>) {
  if (card.assignment) return { text: `${card.assignment.employeeName || 'Persona'} · ${card.assignment.employeeExternalId || ''}`.replace(/ · $/, ''), past: false }
  const last = card.latestAssignment
  if (last?.until) return { text: `Antes: ${last.employeeName || 'Persona'}`, past: true }
  return null
}

/** «Desde»: la asignación vigente, el fin de la última o el alta en inventario. */
export function cardSince(card: Pick<Card, 'assignment' | 'latestAssignment' | 'createdAt'>) {
  return card.assignment?.since || card.latestAssignment?.until || card.createdAt
}

/** Una tarjeta en inventario, asignada o activa todavía se puede revocar; las demás ya no. */
export function revocable(status: string) { return ['inventory', 'assigned', 'active'].includes(status) }

export const revocationReasons = [
  { value: 'revoked', label: 'Revocada' },
  { value: 'lost', label: 'Perdida' },
  { value: 'damaged', label: 'Dañada' },
] as const

/** «hoy 08:59», «ayer 17:02» o «3 nov 2026 · 08:59». */
export function readText(instant: string, timeZone: string, today: string) {
  const day = dateInZone(instant, timeZone)
  const time = timeIn(instant, timeZone)
  if (day === today) return `hoy ${time}`
  return `${shortDate(day)} · ${time}`
}

/** La huella de la tarjeta simulada: sin espacios, de 16 a 128 caracteres (CardCreate). */
export function fingerprintError(value: string) {
  if (!value) return 'Escribe la huella de la tarjeta.'
  if (/\s/.test(value)) return 'La huella no lleva espacios.'
  if (value.length < 16 || value.length > 128) return 'La huella lleva de 16 a 128 caracteres.'
  return ''
}

export function fullName(label: string | null | undefined, fallback: string) { return label?.trim() || fallback }
