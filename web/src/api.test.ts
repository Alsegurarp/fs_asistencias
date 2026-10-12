import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const session = vi.hoisted(() => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
vi.mock('./auth', () => session)
import { api, ApiError, permissions } from './api'

describe('Permisos del contrato', () => {
  it('limita escritura y lectura según el rol', () => {
    expect(permissions(['supervisor'])).toEqual({ sites: true, employees: true, cards: false, editSites: false, editDirectory: false })
    expect(permissions(['auditor']).editDirectory).toBe(false)
    expect(permissions(['rh']).editSites).toBe(false)
    expect(permissions(['rh']).editDirectory).toBe(true)
    expect(Object.values(permissions(['trabajador', 'operador_saas']))).not.toContain(true)
    expect(Object.values(permissions(['admin_empresa']))).not.toContain(false)
  })
})

describe('Cliente del API', () => {
  beforeEach(() => { session.accessToken.mockResolvedValue('token-renovado'); session.auth.clearToken.mockClear() })
  afterEach(() => vi.unstubAllGlobals())
  it('usa el token renovado y envía JSON sólo en una mutación', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":"sede"}', { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    await expect(api('/sites', 'POST', { name: 'Centro' })).resolves.toEqual({ id: 'sede' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/sites', { method: 'POST', headers: { Authorization: 'Bearer token-renovado', 'Content-Type': 'application/json' }, body: '{"name":"Centro"}' })
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
})
