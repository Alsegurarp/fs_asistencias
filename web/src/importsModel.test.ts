import { expect, it } from 'vitest'
import { dataRows, errorsCsv, errorsFileName, importAction, type ImportResult, importStatus, shortHash, sizeText } from './importsModel'

const base: ImportResult = { id: 'b7d9f1a3-0000', status: 'applied', dryRun: false, counts: { total: 2, accepted: 2, rejected: 0 }, errors: [], manifestHash: null }

it('nombra el estado y la acción de cada importación como el lienzo', () => {
  expect(importStatus({ status: 'ready', dryRun: true, appliedByImportId: null })).toEqual({ label: 'Revisado, sin aplicar', tone: 'warn' })
  expect(importStatus({ status: 'ready', dryRun: true, appliedByImportId: 'a1' }).label).toBe('Revisado y aplicado')
  expect(importStatus({ status: 'applied', dryRun: false })).toEqual({ label: 'Aplicado', tone: 'ok' })
  expect(importStatus({ status: 'failed', dryRun: true })).toEqual({ label: 'Falló', tone: 'error' })
  expect(importAction({ ...base, status: 'ready', dryRun: true })).toBe('Revisar y aplicar')
  expect(importAction({ ...base, status: 'ready', dryRun: true, appliedByImportId: 'a1' })).toBeNull()
  expect(importAction({ ...base, status: 'ready', dryRun: true, appliedByImportId: 'a1', counts: { total: 2, accepted: 1, rejected: 1 } })).toBe('Ver errores')
  expect(importAction(base)).toBe('Ver huella')
  expect(importAction({ ...base, counts: { total: 2, accepted: 1, rejected: 1 } })).toBe('Ver errores')
  expect(importAction({ ...base, status: 'failed' })).toBe('Ver errores')
})

it('acorta la huella y dice el tamaño del archivo', () => {
  expect(shortHash('8c1e52d0aa11bb22cc33dd44ee55ff6600112233445566778899aabb9f1744a0')).toBe('8c1e 52d0 … 9f17 44a0')
  expect(shortHash('8c1e52d0')).toBe('8c1e 52d0')
  expect([sizeText(800), sizeText(6 * 1024 + 100), sizeText(1024 * 1024)]).toEqual(['800 B', '6 KB', '1,0 MB'])
})

it('cuenta las filas del archivo sin los encabezados, también con saltos dentro de comillas', () => {
  expect(dataRows('﻿external_id,display_name\r\nA,Uno\r\nB,"Dos\nlíneas"\r\n\r\n')).toBe(2)
  expect(dataRows('external_id,display_name\nA,Uno')).toBe(1)
  expect(dataRows('external_id,display_name\n')).toBe(0)
  expect(dataRows('')).toBe(0)
})

it('arma el CSV de errores sin fórmulas y con un nombre a partir del archivo', () => {
  const errors = [{ row: 12, externalId: '=0219', code: 'site_not_found', message: 'No hay una sede activa con ese nombre.' }, { row: 40, externalId: null, code: 'missing_external_id', message: 'Falta, el identificador.' }]
  expect(errorsCsv({ errors })).toBe('﻿Fila,Número,Código,Qué pasa\r\n12,\'=0219,site_not_found,No hay una sede activa con ese nombre.\r\n40,,missing_external_id,"Falta, el identificador."\r\n')
  expect(errorsFileName({ id: 'b7d9f1a3-0000', fileName: 'padron-noviembre.CSV' })).toBe('padron-noviembre-errores.csv')
  expect(errorsFileName({ id: 'b7d9f1a3-0000', fileName: null })).toBe('importacion-b7d9f1a3-errores.csv')
})
