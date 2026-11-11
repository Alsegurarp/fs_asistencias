import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('./auth', () => ({ accessToken: vi.fn(), auth: { clearToken: vi.fn() } }))
import { Directory } from './Directory'

function render(kind: 'sites', roles: string[], items: unknown[] = []) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  cache.setQueryData([kind], { pages: [{ items, nextCursor: null }], pageParams: [''] })
  const html = renderToStaticMarkup(<QueryClientProvider client={cache}><Directory kind={kind} me={{ userId: 'self', displayName: 'Prueba', roles, tenant: { name: 'Empresa', timeZone: 'America/Mexico_City' } }} /></QueryClientProvider>)
  cache.clear()
  return html
}
it('RH puede consultar sedes pero no agregar ni editar', () => {
  const html = render('sites', ['rh'], [{ id: 's1', name: 'Centro', status: 'active', timeZone: 'America/Mexico_City', radiusMeters: 100 }])
  expect(html).toContain('Centro')
  expect(html).not.toContain('>Agregar<')
  expect(html).not.toContain('>Editar<')
})
it('permite agregar sedes a quien administra', () => {
  expect(render('sites', ['admin_empresa'])).toContain('>Agregar<')
})
