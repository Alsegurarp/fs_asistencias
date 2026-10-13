import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
import { type Me } from './api'
import { Workspace } from './Workspace'

function render(roles: string[], tenant: Me['tenant'] = { name: 'Empresa', timeZone: 'America/Mexico_City' }) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  cache.setQueryData(['sites'], { pages: [{ items: [], nextCursor: null }], pageParams: [''] })
  const html = renderToStaticMarkup(<QueryClientProvider client={cache}><Workspace me={{ userId: 'self', displayName: 'Prueba', roles, tenant }} /></QueryClientProvider>)
  cache.clear()
  return html
}

it.each(['admin_empresa', 'rh', 'auditor'])('muestra las tres secciones operativas a %s', role => {
  const html = render([role])
  for (const section of ['incidents', 'closures', 'exports']) expect(html).toContain(`id="tab-${section}"`)
})

it('el supervisor ve incidencias y cierres, pero no exportes', () => {
  const html = render(['supervisor'])
  expect(html).toContain('id="tab-incidents"')
  expect(html).toContain('id="tab-closures"')
  expect(html).not.toContain('id="tab-exports"')
})

it('sólo el administrador ve Usuarios', () => {
  expect(render(['admin_empresa'])).toContain('id="tab-users"')
  for (const role of ['rh', 'supervisor', 'auditor', 'trabajador']) expect(render([role])).not.toContain('id="tab-users"')
})

it.each(['trabajador', 'operador_saas', 'desconocido'])('no muestra navegación de empresa a %s', role => {
  expect(render([role])).not.toContain('role="tab"')
})

it('no muestra secciones sin empresa aunque se reciban roles de empresa', () => {
  const html = render(['admin_empresa'], null)
  expect(html).not.toContain('role="tab"')
  expect(html).toContain('Solicita una invitación')
})

it('mantiene las pantallas existentes y relaciona pestaña y panel para accesibilidad', () => {
  const html = render(['admin_empresa'])
  expect(html).toContain('id="tab-sites"')
  expect(html).toContain('id="tab-employees"')
  expect(html).toContain('id="tab-cards"')
  expect(html).toContain('aria-controls="panel-sites"')
  expect(html).toContain('aria-labelledby="tab-sites"')
  expect(html).toContain('Todavía no hay registros.')
})
