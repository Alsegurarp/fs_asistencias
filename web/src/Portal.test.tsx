// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'

const state = vi.hoisted(() => ({ dossier: false }))
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() }, identityBase: 'http://localhost:8082' }))
vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  // Las pantallas anteriores se quedan cargando: aquí sólo se prueba el marco.
  api: vi.fn((path: string) => path === '/me/dossier-permission' ? Promise.resolve({ enabled: state.dossier }) : new Promise(() => {})),
}))
// Cierres e Incidencias simuladas: sólo se prueba que el marco pasa la semana elegida.
vi.mock('./Incidents', async original => {
  const { useLocation } = await import('react-router')
  return {
    ...await original<typeof import('./Incidents')>(),
    Incidents: () => <p>Incidencias {useLocation().search || 'sin filtros'}</p>,
  }
})
import { type Me } from './api'
import { Portal } from './Portal'
import { theme } from './theme'
import { accessibilityViolations } from './accessibility'
import { waitFor } from './testUi'

const tenant: Me['tenant'] = { name: 'Empresa Demo', timeZone: 'America/Mexico_City' }
let container: HTMLDivElement
let root: Root
let mounted = false
let cache: QueryClient
let signOut: ReturnType<typeof vi.fn>
let phone = false

beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  signOut = vi.fn(); state.dossier = false; phone = false
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone && query.includes('max-width:860px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
})
afterEach(async () => { if (mounted) await act(async () => root.unmount()); mounted = false; cache.clear(); container.remove(); vi.unstubAllGlobals() })

async function render(roles: string[], path = '/', me: Partial<Me> = {}) {
  const user: Me = { userId: 'self', displayName: 'Mariana Ortiz', roles, tenant, ...me }
  // Un enrutador nuevo en cada llamada: MemoryRouter sólo lee la dirección al montarse.
  if (mounted) { await act(async () => root.unmount()); root = createRoot(container) }
  mounted = true
  await act(async () => root.render(<QueryClientProvider client={cache}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Portal me={user} email="mariana@demo.example" onSignOut={signOut} /></MemoryRouter>
  </ThemeProvider></QueryClientProvider>))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}
const links = (label: string) => [...container.querySelectorAll(`nav[aria-label="${label}"] a`)].map(link => link.getAttribute('href'))
const sideLinks = () => links('Secciones del portal')
const heading = () => container.querySelector('h1')?.textContent
const text = () => container.textContent || ''

it.each(['admin_empresa', 'rh', 'auditor'])('muestra incidencias, cierres y reportes a %s', async role => {
  await render([role])
  expect(sideLinks()).toEqual(expect.arrayContaining(['/incidencias', '/cierres', '/reportes']))
})

it('el supervisor ve asistencia, incidencias y cierres, pero no reportes ni usuarios', async () => {
  await render(['supervisor'])
  expect(sideLinks()).toEqual(['/panel', '/asistencia', '/incidencias', '/cierres', '/personal', '/configuracion'])
})

it.each(['trabajador', 'operador_saas'])('Asistencia de la empresa no está disponible para %s', async role => {
  await render([role], '/asistencia', role === 'operador_saas' ? { tenant: null } : {})
  expect(heading()).toBe('Esta sección no está disponible para tu rol')
  expect(text()).toContain('Asistencia sólo lo ven Administración, RH, Supervisión y Auditoría')
})

it('sólo el administrador ve Usuarios y roles', async () => {
  await render(['admin_empresa'])
  expect(sideLinks()).toContain('/usuarios')
  for (const role of ['rh', 'supervisor', 'auditor', 'trabajador']) {
    await render([role])
    expect(sideLinks()).not.toContain('/usuarios')
  }
})

it.each(['admin_empresa', 'rh', 'supervisor', 'auditor', 'trabajador'])('el expediente depende del permiso explícito para %s', async role => {
  await render([role], '/reportes/expediente')
  expect(container.querySelector('a[href="/reportes/expediente"]')).toBeNull()
  expect(heading()).toBe('Esta sección no está disponible para tu rol')
  expect(text()).toContain('sólo lo descarga quien tiene el permiso explícito')
  state.dossier = true; cache.clear()
  await render([role], '/reportes/expediente')
  if (['admin_empresa', 'rh', 'auditor'].includes(role)) expect(container.querySelector('nav[aria-label="Reportes y expediente"] a[href="/reportes/expediente"]')).not.toBeNull()
  expect(heading()).toBe('Reportes y expediente')
})

it('sin empresa no hay expediente aunque haya permiso', async () => {
  state.dossier = true
  await render(['admin_empresa'], '/reportes/expediente', { tenant: null })
  expect(container.querySelector('nav[aria-label="Secciones del portal"]')).toBeNull()
  expect(heading()).toBe('Esta sección no está disponible para tu rol')
})

it('al volver de verificar sin permiso descarta la verificación y lo dice', async () => {
  await render(['admin_empresa'], '/dossier/callback')
  expect(heading()).toBe('La verificación fue descartada')
  state.dossier = true; cache.clear()
  await render(['admin_empresa'], '/dossier/callback')
  expect(heading()).toBe('Reportes y expediente')
  expect(container.querySelector('a[href="/reportes/expediente"]')?.getAttribute('aria-current')).toBe('page')
})

it.each(['admin_empresa', 'supervisor', 'trabajador'])('avisa a %s del cambio de comida que viene y sólo si hay uno', async role => {
  const upcomingBreakPolicy = { breakPolicy: 'marked' as const, effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z' }
  await render([role], '/', { tenant: { ...tenant!, upcomingBreakPolicy } })
  expect(text()).toContain('Aviso sobre la comida: Desde el lunes 16 de noviembre de 2026 se marcarán el inicio y el fin de la comida.')
  await render([role], '/', { tenant: { ...tenant!, upcomingBreakPolicy: null } })
  expect(text()).not.toContain('Aviso sobre la comida')
})

it('el inicio abre el Panel, o Mi asistencia para quien sólo es trabajador', async () => {
  await render(['admin_empresa'])
  expect(container.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe('/panel')
  expect(heading()).toMatch(/^Hola, Mariana · /)
  await render(['trabajador'])
  expect(heading()).toBe('Mi asistencia')
  expect(container.querySelector('aside')).toBeNull()
  expect(container.querySelector('button[aria-label^="Ocultar"]')).toBeNull()
})

it('el trabajador no tiene secciones de empresa y el rol combinado conserva ambas', async () => {
  await render(['trabajador'], '/personal')
  expect(heading()).toBe('Esta sección no está disponible para tu rol')
  expect(text()).toContain('Tu rol es Trabajador.')
  await render(['admin_empresa', 'trabajador'], '/mi-asistencia')
  expect(heading()).toBe('Mi asistencia')
  expect(sideLinks()).toContain('/personal')
})

it('agrupa el menú como el lienzo y las secciones se pliegan', async () => {
  await render(['admin_empresa'])
  const groups = [...container.querySelectorAll('aside details')]
  expect(groups.map(group => group.querySelector('summary')?.textContent)).toEqual(['Operación', 'Padrón', 'Empresa'])
  expect(groups.every(group => group.hasAttribute('open'))).toBe(true)
  expect(sideLinks()).toEqual(['/panel', '/asistencia', '/incidencias', '/cierres', '/personal', '/dispositivos', '/configuracion', '/usuarios', '/reportes'])
})

it('las pestañas de una sección dependen del rol', async () => {
  await render(['admin_empresa'], '/personal/horarios')
  expect(links('Personal y horarios')).toEqual(['/personal', '/personal/horarios', '/personal/importaciones', '/personal/fuentes'])
  expect(container.querySelector('a[href="/personal/horarios"]')?.getAttribute('aria-current')).toBe('page')
  expect(container.querySelector('a[href="/personal"][aria-current="page"]')?.closest('aside')).not.toBeNull()
  await render(['supervisor'], '/personal/importaciones')
  expect(heading()).toBe('Esta sección no está disponible para tu rol')
  expect(text()).toContain('Tu rol es Supervisión. Importaciones sólo lo ven Administración y RH')
})

it('cada página tiene un solo h1 aunque monte una pantalla anterior', async () => {
  await render(['admin_empresa'], '/personal/horarios')
  expect(container.querySelectorAll('h1')).toHaveLength(1)
  expect(container.textContent).toContain('Empresa Demo / Personal y horarios')
})

it('una dirección que no existe dice que no se encontró', async () => {
  await render(['admin_empresa'], '/no-existe')
  expect(heading()).toBe('No encontramos esa página')
  expect(container.querySelector('a[href="/incidencias"]')).not.toBeNull()
})

it('quien opera el servicio sólo ve la consola, y una sección de empresa le dice por qué no', async () => {
  await render(['operador_saas'], '/', { tenant: null })
  expect(links('Secciones de la consola')).toEqual(['/empresas'])
  expect(heading()).toBe('Empresas · las que usan Zenit')
  expect(text()).toContain('Operación / Empresas')
  await render(['operador_saas'], '/incidencias', { tenant: null })
  expect(text()).toContain('Tu rol es Operación del servicio. Incidencias sólo lo ven Administración, RH, Supervisión y Auditoría')
})

it.each(['desconocido', 'admin_empresa'])('sin empresa ni consola no muestra navegación a %s', async role => {
  await render([role], '/', { tenant: null })
  expect(container.querySelector('nav')).toBeNull()
  expect(heading()).toBe('Tu cuenta está activa')
})

it('oculta y vuelve a mostrar el menú lateral, y lo recuerda', async () => {
  await render(['admin_empresa'])
  const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-controls]')!
  expect(toggle().getAttribute('aria-expanded')).toBe('true')
  await act(async () => toggle().click())
  expect(container.querySelector('aside')).toBeNull()
  expect(toggle().getAttribute('aria-label')).toBe('Mostrar el menú lateral')
  expect(window.localStorage.getItem('zenit.menu.oculto')).toBe('1')
  await render(['admin_empresa'])
  expect(container.querySelector('aside')).toBeNull()
  await act(async () => toggle().click())
  expect(container.querySelector('aside')).not.toBeNull()
})

it('el menú de la cuenta muestra quién entró y cierra la sesión', async () => {
  await render(['admin_empresa', 'trabajador'])
  const account = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!
  expect(account.getAttribute('aria-label')).toBe('Cuenta de Mariana Ortiz, Administración y Trabajador')
  expect(account.textContent).toBe('MO')
  await act(async () => account.click())
  await waitFor(() => !!document.querySelector('[role="menu"]'))
  const menu = document.querySelector('[role="menu"]')!
  expect(document.body.textContent).toContain('mariana@demo.example')
  expect([...menu.querySelectorAll('[role="menuitem"]')].map(item => item.textContent)).toEqual(['Mi asistencia', 'Cerrar sesión'])
  await act(async () => [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].at(-1)!.click())
  expect(signOut).toHaveBeenCalledOnce()
})

it('sin el rol de trabajador el menú de la cuenta no ofrece Mi asistencia', async () => {
  await render(['rh'])
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click())
  await waitFor(() => !!document.querySelector('[role="menu"]'))
  expect(document.querySelector('[role="menu"]')!.textContent).not.toContain('Mi asistencia')
})

it('en teléfono el menú pasa a la barra inferior con Más', async () => {
  phone = true
  await render(['admin_empresa'])
  expect(container.querySelector('aside')).toBeNull()
  expect(links('Secciones')).toEqual(['/panel', '/asistencia', '/incidencias', '/mas'])
  await render(['admin_empresa'], '/usuarios')
  expect(container.querySelector('nav[aria-label="Secciones"] a[href="/mas"]')?.getAttribute('aria-current')).toBe('page')
  await render(['admin_empresa'], '/mas')
  expect(heading()).toBe('Más')
  expect([...container.querySelectorAll('main h2')].map(item => item.textContent)).toEqual(['Operación', 'Padrón', 'Empresa'])
  await render(['supervisor'])
  expect(links('Secciones')).toEqual(['/panel', '/asistencia', '/incidencias', '/mas'])
})

it.each(['/no-existe', '/usuarios', '/mas'])('el marco no tiene fallas automáticas de accesibilidad en %s', async path => {
  await render(['supervisor'], path)
  expect(await accessibilityViolations(container)).toEqual([])
})

it('Incidencias recibe la semana y la incidencia por la dirección', async () => {
  await render(['admin_empresa'], '/incidencias?semana=2026-11-02&incidencia=inc-1')
  expect(container.querySelector('aside a[href="/incidencias"]')?.getAttribute('aria-current')).toBe('page')
  expect(text()).toContain('Incidencias ?semana=2026-11-02&incidencia=inc-1')
  await render(['admin_empresa'], '/incidencias')
  expect(text()).toContain('Incidencias sin filtros')
})

it('la campana cuenta los avisos sin ver, los lista y recuerda cuáles ya se vieron', async () => {
  const upcomingBreakPolicy = { breakPolicy: 'marked' as const, effectiveOn: '2026-11-16', effectiveAt: '2026-11-16T06:00:00Z' }
  await render(['admin_empresa'], '/usuarios', { tenant: { ...tenant!, upcomingBreakPolicy } })
  const bell = () => container.querySelector<HTMLButtonElement>('button[aria-label^="Avisos"]')!
  expect(bell().getAttribute('aria-label')).toBe('Avisos, 1 sin ver')
  await act(async () => bell().click())
  await waitFor(() => !!document.querySelector('[role="dialog"]'))
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.textContent).toContain('Cambio programado')
  expect(dialog.textContent).toContain('La comida se marca desde el lun 16 nov')
  expect(dialog.querySelector('a')?.getAttribute('href')).toBe('/configuracion')
  await act(async () => [...dialog.querySelectorAll('button')].find(item => item.textContent === 'Marcar como vistos')!.click())
  expect(bell().getAttribute('aria-label')).toBe('Avisos')
  await render(['admin_empresa'], '/usuarios', { tenant: { ...tenant!, upcomingBreakPolicy } })
  expect(bell().getAttribute('aria-label')).toBe('Avisos')
})

it('quien no ve la operación de la empresa no tiene campana', async () => {
  await render(['trabajador'])
  expect(container.querySelector('button[aria-label^="Avisos"]')).toBeNull()
})
