import { csv } from './attendanceModel'
import type { Tone } from './ui'

/** Lo que guarda el servidor de cada archivo del padrón; nunca su contenido. */
export type ImportResult = {
  id: string; status: 'validating' | 'ready' | 'applied' | 'failed'; dryRun: boolean; templateVersion?: number
  /** `created`, `updated` y `unchanged` desde el contrato 0.29.0; nulos en las importaciones anteriores. */
  counts: { total: number; accepted: number; rejected: number; created?: number | null; updated?: number | null; unchanged?: number | null }
  errors: { row: number; externalId: string | null; code: string; message: string }[]
  manifestHash: string | null; fileName?: string | null; createdBy?: string | null; createdByName?: string | null
  reviewedImportId?: string | null; appliedByImportId?: string | null; createdAt?: string
}

/** El límite del servidor: hasta 1 MB y 5000 filas. */
export const maxBytes = 1024 * 1024

/** Estado de una fila del historial, como lo dice el lienzo. */
export function importStatus(item: Pick<ImportResult, 'status' | 'dryRun' | 'appliedByImportId'>): { label: string; tone: Tone } {
  if (item.status === 'failed') return { label: 'Falló', tone: 'error' }
  if (item.status === 'applied') return { label: 'Aplicado', tone: 'ok' }
  if (item.status === 'validating') return { label: 'Revisando', tone: 'info' }
  return item.appliedByImportId ? { label: 'Revisado y aplicado', tone: 'neutral' } : { label: 'Revisado, sin aplicar', tone: 'warn' }
}

/** Qué se puede hacer desde el historial: aplicar una revisión pendiente o ver lo que pasó. */
export function importAction(item: ImportResult): string | null {
  if (item.status === 'ready' && !item.appliedByImportId) return 'Revisar y aplicar'
  if (item.status === 'failed' || item.counts.rejected > 0) return 'Ver errores'
  if (item.status === 'applied') return 'Ver huella'
  return null
}

/** La huella en grupos de cuatro, con el principio y el final, como en el lienzo. */
export function shortHash(hash: string) {
  const groups = (text: string) => text.match(/.{1,4}/g)!.join(' ')
  return hash.length <= 16 ? groups(hash) : `${groups(hash.slice(0, 8))} … ${groups(hash.slice(-8))}`
}

export function sizeText(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Filas con datos debajo de los encabezados, para decir cuántas trae el archivo antes de revisarlo. */
export function dataRows(text: string) {
  let rows = 0
  let quoted = false
  let content = false
  for (const char of text.replace(/^﻿/, '')) {
    if (char === '"') quoted = !quoted
    if ((char === '\n' || char === '\r') && !quoted) { if (content) rows++; content = false; continue }
    if (char.trim()) content = true
  }
  if (content) rows++
  return Math.max(0, rows - 1)
}

export function plural(count: number, one: string, many: string) { return `${count} ${count === 1 ? one : many}` }

/** Las filas rechazadas, para corregirlas en el archivo. */
export function errorsCsv(item: Pick<ImportResult, 'errors'>) {
  return csv([['Fila', 'Número', 'Código', 'Qué pasa'], ...item.errors.map(error => [error.row, error.externalId, error.code, error.message])])
}

export function errorsFileName(item: Pick<ImportResult, 'fileName' | 'id'>) {
  const base = (item.fileName || `importacion-${item.id.slice(0, 8)}`).replace(/\.csv$/i, '')
  return `${base}-errores.csv`
}
