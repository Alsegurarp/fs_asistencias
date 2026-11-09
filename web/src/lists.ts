import { api, type Page } from './api'

/** Las listas cortas (sedes, horarios) se piden completas, página por página. */
export async function allPages<T>(path: string, pages = 20): Promise<T[]> {
  const items: T[] = []
  let cursor = ''
  for (let i = 0; i < pages; i++) {
    const page = await api<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    items.push(...page.items)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return items
}
