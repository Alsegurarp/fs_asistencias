// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '@mui/material'
import { theme } from './theme'
import { CompanySuspended, NoCompany, SessionEnded } from './States'
import { accessibilityViolations } from './accessibility'

let container: HTMLDivElement
let root: Root
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

async function render(node: React.ReactNode) { await act(async () => root.render(<ThemeProvider theme={theme}>{node}</ThemeProvider>)) }
const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent === text)!

it('la sesión terminada ofrece volver a entrar', async () => {
  const signIn = vi.fn()
  await render(<SessionEnded onSignIn={signIn} />)
  expect(container.querySelector('h1')?.textContent).toBe('Tu sesión terminó')
  await act(async () => button('Volver a entrar').click())
  expect(signIn).toHaveBeenCalledOnce()
  expect(await accessibilityViolations(container)).toEqual([])
})

it('la cuenta sin empresa dice con qué correo entró y permite salir', async () => {
  const signOut = vi.fn()
  await render(<NoCompany email="laura@demo.example" onSignOut={signOut} />)
  expect(container.textContent).toContain('Entraste como laura@demo.example, pero ninguna empresa te ha dado acceso')
  await act(async () => button('Cerrar sesión').click())
  expect(signOut).toHaveBeenCalledOnce()
  await render(<NoCompany onSignOut={signOut} />)
  expect(container.textContent).toContain('Entraste, pero ninguna empresa')
  expect(await accessibilityViolations(container)).toEqual([])
})

it('la empresa suspendida dice cuál es, qué sigue funcionando y permite salir', async () => {
  const signOut = vi.fn()
  await render(<CompanySuspended company="Panificadora Ejemplo" onSignOut={signOut} />)
  expect(container.querySelector('h1')?.textContent).toBe('Tu empresa está suspendida')
  expect(container.textContent).toContain('Panificadora Ejemplo tiene el servicio de Zenit suspendido')
  expect(container.textContent).toContain('siguen registrando las marcas')
  await act(async () => button('Cerrar sesión').click())
  expect(signOut).toHaveBeenCalledOnce()
  await render(<CompanySuspended onSignOut={signOut} />)
  expect(container.textContent).toContain('Tu empresa tiene el servicio de Zenit suspendido')
  expect(await accessibilityViolations(container)).toEqual([])
})
