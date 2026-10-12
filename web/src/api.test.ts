import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const session = vi.hoisted(() => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./auth', () => session)
import { api, apiDownload, ApiError, permissions } from './api'

describe('Permisos del contrato', () => {
  it('limita escritura y lectura según el rol', () => {
    expect(permissions(['supervisor'])).toMatchObject({ sites: true, employees: true, cards: false, editSites: false, editDirectory: false })
    expect(permissions(['auditor']).editDirectory).toBe(false)
    expect(permissions(['rh']).editSites).toBe(false)
    expect(permissions(['rh']).editDirectory).toBe(true)
    expect(Object.values(permissions(['trabajador', 'operador_saas']))).not.toContain(true)
    expect(Object.values(permissions(['admin_empresa']))).not.toContain(false)
  })

  it.each([
    ['admin_empresa', [true, true, true, true, true, true]],
    ['rh', [true, true, true, true, true, false]],
    ['supervisor', [true, true, false, true, false, false]],
    ['auditor', [true, true, true, false, false, false]],
    ['trabajador', [false, false, false, false, false, false]],
    ['operador_saas', [false, false, false, false, false, false]],
  ] as const)('respeta las acciones operativas de %s', (role, expected) => {
    const allowed = permissions([role])
    expect([allowed.incidents, allowed.closures, allowed.exports, allowed.resolveIncidents, allowed.closeWeeks, allowed.reopenClosures]).toEqual(expected)
  })

  it('combina roles y niega permisos desconocidos', () => {
    expect(permissions(['supervisor', 'auditor'])).toMatchObject({ exports: true, resolveIncidents: true, closeWeeks: false, reopenClosures: false })
    expect(Object.values(permissions(['desconocido']))).not.toContain(true)
  })
})

describe('Cliente del API', () => {
  beforeEach(() => { session.accessToken.mockResolvedValue('token-renovado'); session.auth.clearToken.mockClear() })
  afterEach(() => vi.unstubAllGlobals())
  it('usa el token renovado y envía JSON sólo en una mutación', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":"sede"}', { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    await expect(api('/sites', 'POST', { name: 'Centro' })).resolves.toEqual({ id: 'sede' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/sites', { method: 'POST', redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer token-renovado', 'Content-Type': 'application/json' }, body: '{"name":"Centro"}' })
  })
  it('conserva errores de campos y referencia de correlación', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Datos no válidos', code: 'validation', correlationId: 'ref-1', errors: [{ field: 'name', message: 'Obligatorio' }] }), { status: 422 })))
    await expect(api('/sites', 'POST', {})).rejects.toMatchObject({ status: 422, correlationId: 'ref-1', errors: [{ field: 'name', message: 'Obligatorio' }] })
  })
  it('cierra la sesión local ante una credencial rechazada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    expect(session.auth.clearToken).toHaveBeenCalledOnce()
  })
  it('no envía una petición cuando la renovación falla', async () => {
    session.accessToken.mockRejectedValueOnce(new Error('Sesión vencida'))
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(api('/employees')).rejects.toThrow('Sesión vencida')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('acepta respuestas sin cuerpo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(api('/cards/id/revocation', 'POST', { reason: 'lost' })).resolves.toBeUndefined()
  })

  it('conserva la clave de idempotencia que proporciona el caller al reintentar', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"id":"exporte"}', { status: 202 })))
    vi.stubGlobal('fetch', fetch)
    const key = 'c6167cf8-e8bb-4ea5-ade9-cd33b39e3261'
    const body = { weekStart: '2026-10-05', format: 'csv' }
    await api('/exports', 'POST', body, key)
    await api('/exports', 'POST', body, key)
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [, request] of fetch.mock.calls) {
      expect(request.headers['Idempotency-Key']).toBe(key)
      expect(request.headers.Authorization).toBe('Bearer token-renovado')
      expect(request.body).toBe(JSON.stringify(body))
    }
  })

  it('descarga CSV con credencial sin interpretar ni alterar sus bytes', async () => {
    const bytes = new TextEncoder().encode('\uFEFFnombre\r\n"Muñoz"\r\n')
    const fetch = vi.fn().mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="zenit-empresa-2026-10-05.csv"' } }))
    vi.stubGlobal('fetch', fetch)
    const file = await apiDownload('/exports/exporte/download')
    expect(file.filename).toBe('zenit-empresa-2026-10-05.csv')
    expect(new Uint8Array(await file.blob.arrayBuffer())).toEqual(bytes)
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/exports/exporte/download', {
      method: 'GET', redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer token-renovado' }, body: undefined,
    })
  })

  it('devuelve el error y la referencia cuando el archivo venció; no reintenta la descarga', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'export_expired', detail: 'El archivo venció.', correlationId: 'ref-exporte' }), { status: 410 }))
    vi.stubGlobal('fetch', fetch)
    await expect(apiDownload('/exports/exporte/download')).rejects.toMatchObject({ status: 410, code: 'export_expired', correlationId: 'ref-exporte', message: 'El archivo venció.' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('limpia la sesión también cuando la descarga responde 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    await expect(apiDownload('/exports/exporte/download')).rejects.toBeInstanceOf(ApiError)
    expect(session.auth.clearToken).toHaveBeenCalledOnce()
  })

  it('usa un nombre seguro o el nombre predeterminado si falta la cabecera', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('csv', { headers: { 'Content-Disposition': 'attachment; filename="../../reporte.csv"' } }))
      .mockResolvedValueOnce(new Response('csv'))
    vi.stubGlobal('fetch', fetch)
    expect((await apiDownload('/exports/exporte/download')).filename).toBe('.._.._reporte.csv')
    expect((await apiDownload('/exports/otro/download')).filename).toBe('zenit.csv')
  })
})
