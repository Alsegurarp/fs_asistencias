// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
vi.mock('./auth', () => ({ auth: {}, authReady: new Promise(() => {}), accessToken: vi.fn(), identityBase: 'http://localhost:8082' }))
import { returnUrl } from './App'

it('al entrar vuelve a la misma pantalla con lo elegido, salvo desde la sesión terminada', () => {
  window.history.replaceState(null, '', '/asistencia?semana=2026-11-02&persona=e1&ficha=marcajes')
  expect(returnUrl()).toBe(`${window.location.origin}/asistencia?semana=2026-11-02&persona=e1&ficha=marcajes`)
  window.history.replaceState(null, '', '/sesion-terminada?x=1')
  expect(returnUrl()).toBe(`${window.location.origin}/`)
})
