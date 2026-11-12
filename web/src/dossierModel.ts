import type { Tone } from './ui'

/** Una copia del expediente, como la devuelven `GET /dossiers` y `GET /dossiers/{id}`. */
export type Dossier = {
  id: string; status: 'queued' | 'preparing' | 'ready' | 'failed' | 'expired' | 'downloaded'; expiresAt: string
  manifestSha256: string | null; fileSha256: string | null
  createdAt?: string; snapshotAt?: string | null; readyAt?: string | null; downloadedAt?: string | null; formatVersion?: number
}

export const dossierStatus: Record<Dossier['status'], { label: string; tone: Tone }> = {
  queued: { label: 'En cola', tone: 'info' },
  preparing: { label: 'Preparando', tone: 'info' },
  ready: { label: 'Lista', tone: 'ok' },
  failed: { label: 'Falló', tone: 'error' },
  expired: { label: 'Venció sin descargar', tone: 'neutral' },
  downloaded: { label: 'Descargada', tone: 'neutral' },
}

/** El manifiesto del ZIP: lo que trae y cuántos registros de cada tabla. */
export type Manifest = { formatVersion: number; snapshotAt: string; generatedAt?: string; timeZone?: string; counts: Record<string, number>; limitations?: string[] }

/** Las 23 tablas del formato 1, agrupadas como las lee una persona. */
const sections: { label: string; tables: string[] }[] = [
  { label: 'Empresa, usuarios y roles', tables: ['tenant', 'tenant_user', 'tenant_user_role'] },
  { label: 'Sedes', tables: ['site'] },
  { label: 'Horarios y sus días', tables: ['schedule', 'schedule_day'] },
  { label: 'Personas y asignaciones de horario', tables: ['employee', 'schedule_assignment'] },
  { label: 'Tarjetas y sus asignaciones', tables: ['card', 'card_assignment'] },
  { label: 'Lectores y sesiones', tables: ['device', 'device_session'] },
  { label: 'Marcajes y evidencias de ubicación', tables: ['attendance_event', 'location_evidence'] },
  { label: 'Marcas rechazadas', tables: ['attendance_rejection'] },
  { label: 'Incidencias y ajustes', tables: ['incident', 'adjustment'] },
  { label: 'Reglas laborales', tables: ['rule_set'] },
  { label: 'Cierres semanales y acuses', tables: ['week_closure', 'closure_acknowledgement'] },
  { label: 'Corridas de cierre y bloqueos', tables: ['week_closure_run', 'week_closure_run_blocked'] },
  { label: 'Bitácora', tables: ['audit_log'] },
]

/** Filas de «Qué incluye esta copia»: «Tarjetas y sus asignaciones · 62 · 58». Una tabla nueva sale con su nombre. */
export function manifestRows(counts: Record<string, number>) {
  const known = new Set(sections.flatMap(section => section.tables))
  const rows = sections.filter(section => section.tables.some(table => table in counts))
    .map(section => ({ label: section.label, value: section.tables.filter(table => table in counts).map(table => counts[table].toLocaleString('es-MX')).join(' · ') }))
  for (const [table, count] of Object.entries(counts)) if (!known.has(table)) rows.push({ label: table, value: count.toLocaleString('es-MX') })
  return rows
}

const limitations: Record<string, string> = {
  rejected_envelopes_unavailable: 'Las marcas rechazadas van sin el sobre original que mandó el lector.',
  historical_acknowledgement_text_unavailable: 'Los acuses anteriores al registro del texto van sin el texto que vio la persona.',
  local_android_evidence_not_included: 'Lo que guarda cada teléfono y no llegó al servidor no está en la copia.',
  audit_metadata_filtered: 'La bitácora va sin los datos internos que no son para la empresa.',
}
export function limitationText(code: string) { return limitations[code] || code }

/** «5e1b07c2 9d41 a6f3 … 2b80 77e1 a9c4»: el principio y el final, en grupos de cuatro. */
export function hashGroups(hash: string | null | undefined) {
  if (!hash) return ''
  const groups = (text: string) => text.match(/.{1,4}/g)!.join(' ')
  return hash.length > 24 ? `${hash.slice(0, 8)} ${groups(hash.slice(8, 16))} … ${groups(hash.slice(-12))}` : groups(hash)
}

/** El paso del asistente: preparar, confirmar la identidad o descargar. */
export function dossierStep(record: Dossier | undefined, returned: boolean) {
  if (record?.status === 'ready') return returned ? 3 : 2
  return 1
}
