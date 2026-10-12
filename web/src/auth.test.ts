import { beforeEach, expect, it, vi } from 'vitest'
const keycloak = vi.hoisted(() => ({
  init: vi.fn().mockResolvedValue(false), updateToken: vi.fn().mockResolvedValue(false),
  clearToken: vi.fn(), authenticated: false, token: undefined as string | undefined,
}))
vi.mock('keycloak-js', () => ({ default: class { constructor() { return keycloak } } }))
import { accessToken, authReady } from './auth'

beforeEach(() => {
  keycloak.authenticated = true
  keycloak.token = 'renovado'
  keycloak.updateToken.mockClear()
  keycloak.clearToken.mockClear()
})
it('inicializa una vez con PKCE S256 y sin iframe de sesión', async () => {
  await authReady
  expect(keycloak.init).toHaveBeenCalledExactlyOnceWith({ pkceMethod: 'S256', checkLoginIframe: false })
})
it('renueva antes de entregar la credencial', async () => {
  await expect(accessToken()).resolves.toBe('renovado')
  expect(keycloak.updateToken).toHaveBeenCalledWith(30)
})
it('limpia la credencial cuando falla la renovación', async () => {
  keycloak.updateToken.mockRejectedValueOnce(new Error('Expirado'))
  await expect(accessToken()).rejects.toThrow('La sesión venció')
  expect(keycloak.clearToken).toHaveBeenCalledOnce()
})
it('no intenta renovar sin autenticación', async () => {
  keycloak.authenticated = false
  await expect(accessToken()).rejects.toThrow('Inicia sesión')
  expect(keycloak.updateToken).not.toHaveBeenCalled()
})
