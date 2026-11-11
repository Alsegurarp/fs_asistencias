import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, ButtonBase, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, permissions, type Me, type Page, type Site } from './api'
import { shortWeekLabel, todayIn } from './attendanceModel'
import { color, glass, phoneQuery, shadow } from './design'
import { Icon } from './Icons'
import { IncidentSheet } from './IncidentSheet'
import { type Incident, zonedInstants } from './incidentModel'
import { type Filters, incidentQuery, incidentTitle, incidentTitles, knownTotal, outcomes, severityOf, whenText } from './incidentsView'
import { allPages } from './lists'
import { PageHeader, initials as initialsOf } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, FilterChip, Note, Pager, visuallyHidden, Pane, SearchBox, SelectBox, SkeletonRows, StatusTabs, ViewSwitch, clickRow, tableSx } from './ui'

export type IncidentSummary = {
  weekStart: string
  open: { total: number; unassigned: number; mine: number; high: number; medium: number; low: number; blockingClosure: number }
  resolved: { total: number; thisWeek: number }
}
const pageSize = 25
const viewKey = 'zenit.incidencias.vista'
function savedView() { try { return window.localStorage.getItem(viewKey) === 'tablero' ? 'tablero' : 'lista' } catch { return 'lista' } }
function saveView(view: string) { try { window.localStorage.setItem(viewKey, view) } catch { /* sólo dura la visita */ } }

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/**
 * Incidencias (OPE-03, OPE-05, OPE-06, EST-08, TEL-02, TEL-09): abiertas y
 * resueltas en lista o tablero, con búsqueda y filtros en el servidor, y el
 * detalle para asignar y resolver sobre la lista. Todo lo elegido vive en la
 * dirección, también la incidencia abierta.
 */
export function Incidents({ me, context, section, screens, screen }: Props) {
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const [params, setParams] = useSearchParams()
  const status: 'open' | 'resolved' = params.get('estado') === 'resueltas' ? 'resolved' : 'open'
  const view = phone || status === 'resolved' ? 'lista' : params.get('vista') || savedView()
  const filters: Filters = {
    q: params.get('q') || '', type: params.get('tipo') || '', siteId: params.get('sede') || '', week: params.get('semana') || '',
    mine: params.get('mias') === '1', high: params.get('alta') === '1', blocking: params.get('bloquean') === '1',
  }
  const selected = params.get('incidencia')
  const [text, setText] = useState(filters.q)
  const opener = useRef<HTMLElement | null>(null)

  const change = (values: Record<string, string | null>, replace = false) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
      return next
    }, { replace })
  }
  const link = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
    return `?${next}`
  }
  useEffect(() => { setText(filters.q) }, [filters.q])
  useEffect(() => {
    const value = text.trim()
    if (value === filters.q) return
    const timer = setTimeout(() => change({ q: value || null }, true), 300)
    return () => clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!phone && status === 'open' && params.get('vista')) saveView(params.get('vista')!) }, [params, phone, status])

  const context3 = new URLSearchParams()
  if (filters.type) context3.set('type', filters.type)
  if (filters.siteId) context3.set('siteId', filters.siteId)
  if (filters.week) context3.set('week', filters.week)
  const summary = useQuery({ queryKey: ['incident-summary', context3.toString()], queryFn: () => api<IncidentSummary>(`/incidents/summary${context3.size ? `?${context3}` : ''}`), retry: false })
  const sites = useQuery({ queryKey: ['sites', 'all'], queryFn: () => allPages<Site>('/sites'), retry: false, staleTime: 60_000 })
  const siteName = (id: string | null) => (id ? sites.data?.find(site => site.id === id)?.name : undefined)

  const open = (id: string, element: HTMLElement) => { opener.current = element; change({ incidencia: id }) }
  const close = () => { change({ incidencia: null }); setTimeout(() => opener.current?.focus(), 0) }
  const clearFilters = () => { setText(''); change({ q: null, tipo: null, sede: null, semana: null, mias: null, alta: null, bloquean: null }) }
  const filtered = !!(filters.q || filters.type || filters.siteId || filters.week || filters.mine || filters.high || filters.blocking)
  const counts = summary.data

  const header = <PageHeader context={context} section={section} screens={screens} current={screen} description="lo que el sistema detectó al recibir las marcas"
    actions={!phone && status === 'open' ? <ViewSwitch label="Vista" current={view} options={[
      { key: 'lista', label: 'Lista', icon: 'list', to: link({ vista: 'lista' }) },
      { key: 'tablero', label: 'Tablero', icon: 'board', to: link({ vista: 'tablero' }) },
    ]} /> : undefined} />

  const chip = (key: 'mias' | 'alta' | 'bloquean', label: string, count?: number) =>
    <FilterChip key={key} small={phone} pressed={params.get(key) === '1'} onClick={() => change({ [key]: params.get(key) === '1' ? null : '1', incidencia: null })}>
      {label}{typeof count === 'number' && status === 'open' ? ` · ${count}` : ''}
    </FilterChip>
  const filterBar = <Box component="form" aria-label="Filtros" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }, true) }}
    sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', [`@media ${phoneQuery}`]: { flexDirection: 'column', alignItems: 'stretch', flexWrap: 'nowrap' } }}>
    <Box sx={{ display: phone ? 'flex' : 'contents', flexWrap: 'wrap', gap: 1 }}>
      <SearchBox name="q" label="Filtrar por persona o número" placeholder="Persona o número" value={text} onChange={setText} grow={phone} />
      <SelectBox name="tipo" label="Tipo" value={filters.type} onChange={value => change({ tipo: value || null, incidencia: null })}
        options={[{ value: '', label: 'Todos' }, ...Object.entries(incidentTitles).map(([value, label]) => ({ value, label }))]} />
      {(sites.data?.length || 0) > 1 && <SelectBox name="sede" label="Sede" value={filters.siteId} onChange={value => change({ sede: value || null, incidencia: null })}
        options={[{ value: '', label: 'Todas' }, ...(sites.data || []).map(site => ({ value: site.id, label: site.name }))]} />}
    </Box>
    {!phone && <Box aria-hidden="true" sx={{ width: '1px', height: 24, background: color.fieldSoft, mx: 0.5 }} />}
    <Box sx={{ display: phone ? 'flex' : 'contents', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
      {allowed.resolveIncidents && chip('mias', 'Mías', counts?.open.mine)}
      {chip('alta', 'Severidad alta', counts?.open.high)}
      {status === 'open' && chip('bloquean', 'Bloquean un cierre', counts?.open.blockingClosure)}
      {filters.week && <FilterChip small={phone} pressed onClick={() => change({ semana: null })}>Semana {shortWeekLabel(filters.week)} <Icon name="close" size={14} strokeWidth={2} /><Box component="span" sx={visuallyHidden}>(quitar)</Box></FilterChip>}
    </Box>
  </Box>

  const tabs = <StatusTabs label="Estado" current={status} note={status === 'open' ? 'Ordenadas por severidad y fecha' : 'Las más recientes primero'} options={[
    { key: 'open', label: `Abiertas${counts ? ` · ${counts.open.total}` : ''}`, to: link({ estado: null, incidencia: null }) },
    { key: 'resolved', label: `Resueltas${counts ? ` · ${counts.resolved.total}` : ''}`, to: link({ estado: 'resueltas', incidencia: null, bloquean: null }) },
  ]} />

  const allClear = status === 'open' && !filtered && counts?.open.total === 0
  return <>
    {header}
    {filterBar}
    {view === 'lista' && tabs}
    {allClear ? <AllClear to={link({ estado: 'resueltas' })} />
      : view === 'tablero' ? <Board filters={filters} summary={counts} timeZone={timeZone} today={today} siteName={siteName} selected={selected} onOpen={open}
        moreResolved={link({ estado: 'resueltas', vista: null })} />
        : <IncidentList phone={phone} status={status} filters={filters} filtered={filtered} total={knownTotal(filters, status, counts)} timeZone={timeZone} today={today}
          siteName={siteName} selected={selected} onOpen={open} onClear={clearFilters} canResolve={allowed.resolveIncidents} />}
    {selected && <IncidentSheet key={selected} id={selected} me={me} today={today} siteName={siteName} onClose={close}
      onChanged={() => { void cache.invalidateQueries({ queryKey: ['incidents'] }); void cache.invalidateQueries({ queryKey: ['incident-summary'] }) }} />}
  </>
}


function AllClear({ to }: { to: string }) {
  return <Box sx={{ flex: 1, minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 4, textAlign: 'center', background: color.white, borderRadius: '20px', boxShadow: shadow.table }}>
    <Box aria-hidden="true" sx={{ width: 72, height: 72, borderRadius: '20px', background: color.okBg, color: color.ok, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={28} /></Box>
    <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Todo en orden</Typography>
    <Typography sx={{ fontSize: 14, color: color.muted, maxWidth: 500 }}>No hay incidencias abiertas. Cuando una marca no cuadre con el horario, la sede o la hora del teléfono, aparecerá aquí.</Typography>
    <Button variant="outlined" component={Link} to={to}>Ver resueltas</Button>
  </Box>
}

function useIncidentPages(key: unknown[], query: URLSearchParams, limit: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['incidents', ...key, query.toString(), limit], initialPageParam: '', enabled, retry: false,
    queryFn: ({ pageParam }) => api<Page<Incident>>(`/incidents?${query}&limit=${limit}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: page => page.nextCursor || undefined,
  })
}

type ListProps = {
  phone: boolean; status: 'open' | 'resolved'; filters: Filters; filtered: boolean; total: number | null; timeZone: string; today: string
  siteName: (id: string | null) => string | undefined; selected: string | null; onOpen: (id: string, element: HTMLElement) => void; onClear: () => void; canResolve: boolean
}

/** OPE-05 y OPE-06; en teléfono, TEL-09. */
function IncidentList({ phone, status, filters, filtered, total, timeZone, today, siteName, selected, onOpen, onClear, canResolve }: ListProps) {
  const query = incidentQuery(filters, status)
  const scope = query.toString()
  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!
  const list = useQuery({ queryKey: ['incidents', 'list', scope, cursor], retry: false,
    queryFn: () => api<Page<Incident>>(`/incidents?${query}&limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`) })
  const rows = list.data?.items || []
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${total !== null ? ` de ${total}` : list.data?.nextCursor ? ' y más' : ''}` : ''
  const pager = <Pager text={pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />
  const failure = list.error instanceof ApiError ? list.error : null
  const empty = <Stack spacing={1.5} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{filtered ? 'Nada coincide con estos filtros' : status === 'open' ? 'No hay incidencias abiertas' : 'Todavía no hay incidencias resueltas'}</Typography>
    {filtered && <Button variant="outlined" onClick={onClear}>Quitar filtros</Button>}
  </Stack>
  const action = (row: Incident) => <Box component="a" data-row-link href={`?incidencia=${row.id}`} onClick={event => { event.preventDefault(); onOpen(row.id, event.currentTarget) }}
    aria-current={row.id === selected ? 'true' : undefined} sx={{ fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
    {status === 'open' && canResolve ? 'Resolver' : 'Ver'}<Box component="span" sx={visuallyHidden}> {incidentTitle(row.type)} de {row.employeeName}</Box>
  </Box>

  if (phone) return <Box component="section" aria-label="Incidencias" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {failure ? <ListError error={failure} onRetry={() => void list.refetch()} />
      : list.isPending ? <Typography role="status" sx={{ fontSize: 14, color: color.muted, p: 2 }}>Cargando incidencias…</Typography>
        : !rows.length ? <Box sx={{ background: color.white, borderRadius: '18px', boxShadow: shadow.card }}>{empty}</Box>
          : <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {rows.map(row => {
              const severity = severityOf(row.severity)
              return <li key={row.id}>
                <Box component="a" href={`?incidencia=${row.id}`} onClick={event => { event.preventDefault(); onOpen(row.id, event.currentTarget) }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '12px 14px', background: color.white, borderRadius: '18px', boxShadow: shadow.card, textDecoration: 'none', color: `${color.ink} !important` }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box component="strong" sx={{ display: 'block', fontSize: 15 }}>{incidentTitle(row.type)}</Box>
                    <Box component="span" sx={{ fontSize: 13, color: color.muted }}>{row.employeeName} · {row.blocksClosure ? 'bloquea el cierre' : status === 'resolved' && row.resolution ? outcomes[row.resolution.decision] : whenText(row.occurredAt || row.openedAt, timeZone, today)}</Box>
                  </Box>
                  {status === 'open' ? <Badge tone={severity.tone}>{severity.label}</Badge> : <Badge tone="ok">{row.resolution ? outcomes[row.resolution.decision] : 'Resuelta'}</Badge>}
                </Box>
              </li>
            })}
          </Box>}
    {rows.length > 0 && <Box sx={{ background: color.white, borderRadius: '18px', boxShadow: shadow.card }}>{pager}</Box>}
  </Box>

  return <Pane titleId="incidencias-tabla" title={list.isPending ? 'Cargando incidencias…' : status === 'open' ? `${total ?? rows.length} ${total === 1 ? 'abierta' : 'abiertas'}` : `${total ?? rows.length} ${total === 1 ? 'resuelta' : 'resueltas'}`}
    detail={filtered ? 'con estos filtros' : undefined} footer={rows.length ? pager : undefined}>
    {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando incidencias…</Typography>}
    {failure ? <Box sx={{ p: 2 }}><ListError error={failure} onRetry={() => void list.refetch()} /></Box>
      : !list.isPending && !rows.length ? empty
        : <Box component="table" sx={tableSx}>
          {status === 'open' ? <>
            <thead><tr><th scope="col">Tipo</th><th scope="col">Persona</th><th scope="col">Sede</th><th scope="col">Cuándo</th><th scope="col">Severidad</th><th scope="col">Asignada a</th><th scope="col">Bloquea cierre</th><th scope="col"><Box component="span" sx={visuallyHidden}>Acción</Box></th></tr></thead>
            <tbody>{list.isPending ? <SkeletonRows columns={8} rows={8} /> : rows.map(row => {
              const severity = severityOf(row.severity)
              return <tr key={row.id} data-selected={row.id === selected} onClick={clickRow}>
                <td>{incidentTitle(row.type)}</td>
                <td>{row.employeeName} <Box component="span" sx={{ color: color.subtle }}>{row.employeeExternalId}</Box></td>
                <td>{siteName(row.siteId) || <Muted>Sin sede</Muted>}</td>
                <td>{whenText(row.occurredAt || row.openedAt, timeZone, today)}</td>
                <td><Badge tone={severity.tone}>{severity.label}</Badge></td>
                <td>{row.assigneeUserId ? row.assigneeName || 'Sin nombre' : <Muted>Sin asignar</Muted>}</td>
                <td>{row.blocksClosure ? <Badge tone="warn">Sí</Badge> : <Muted>—</Muted>}</td>
                <td>{action(row)}</td>
              </tr>
            })}</tbody>
          </> : <>
            <thead><tr><th scope="col">Tipo</th><th scope="col">Persona</th><th scope="col">Del día</th><th scope="col">Resolución</th><th scope="col">Resolvió</th><th scope="col">Cuándo</th><th scope="col"><Box component="span" sx={visuallyHidden}>Acción</Box></th></tr></thead>
            <tbody>{list.isPending ? <SkeletonRows columns={7} rows={8} /> : rows.map(row => <tr key={row.id} data-selected={row.id === selected} onClick={clickRow}>
              <td>{incidentTitle(row.type)}</td>
              <td>{row.employeeName} <Box component="span" sx={{ color: color.subtle }}>{row.employeeExternalId}</Box></td>
              <td>{whenText(row.occurredAt || row.openedAt, timeZone, today)}</td>
              <td><Badge tone="ok">{row.resolution ? outcomes[row.resolution.decision] || row.resolution.decision : 'Resuelta'}</Badge></td>
              <td>{row.resolution?.resolvedByName || <Muted>Sin nombre</Muted>}</td>
              <td>{row.resolution ? whenText(row.resolution.resolvedAt, timeZone, today) : '—'}</td>
              <td>{action(row)}</td>
            </tr>)}</tbody>
          </>}
        </Box>}
  </Pane>
}

function Muted({ children }: { children: React.ReactNode }) { return <Box component="span" sx={{ color: color.subtle }}>{children}</Box> }

function ListError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{error.status === 403 ? 'Tu rol ya no puede consultar incidencias. Vuelve a entrar para actualizar tu acceso.' : `No pudimos cargar las incidencias. ${error.message}`}
      {error.correlationId && <> Referencia: <Box component="code" sx={{ fontFamily: 'monospace' }}>{error.correlationId}</Box>.</>}</Note>
    {error.status !== 403 && <Button variant="outlined" onClick={onRetry}>Reintentar</Button>}
  </Stack>
}

type BoardProps = {
  filters: Filters; summary?: IncidentSummary; timeZone: string; today: string; siteName: (id: string | null) => string | undefined
  selected: string | null; onOpen: (id: string, element: HTMLElement) => void; moreResolved: string
}

/** OPE-03: sin asignar, asignadas y resueltas esta semana. */
function Board({ filters, summary, timeZone, today, siteName, selected, onOpen, moreResolved }: BoardProps) {
  const narrowed = !!(filters.q || filters.high || filters.blocking || filters.mine)
  const unassigned = useIncidentPages(['tablero', 'sin-asignar'], incidentQuery({ ...filters, mine: false }, 'open', { assignee: 'unassigned' }), 20, !filters.mine)
  const assigned = useIncidentPages(['tablero', 'asignadas'], incidentQuery({ ...filters, mine: false }, 'open', { assignee: filters.mine ? 'me' : 'assigned' }), 20)
  const resolved = useIncidentPages(['tablero', 'resueltas'], incidentQuery({ ...filters, blocking: false }, 'resolved'), 10)
  const weekStart = summary?.weekStart
  const since = weekStart ? zonedInstants(`${weekStart}T00:00`, timeZone)[0] : undefined
  const recent = (resolved.data?.pages.flatMap(page => page.items) || []).filter(row => since && row.resolution && row.resolution.resolvedAt >= since)
  const resolvedCount = narrowed ? recent.length : summary?.resolved.thisWeek
  const hidden = (resolvedCount ?? 0) - recent.length
  return <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5 }}>
    <Column title="Sin asignar" count={filters.mine ? 0 : narrowed ? undefined : summary?.open.unassigned} pages={unassigned} empty={filters.mine ? 'Con «Mías» sólo se ven las asignadas a ti.' : 'Ninguna sin asignar.'}
      render={row => <Card key={row.id} row={row} selected={row.id === selected} onOpen={onOpen} timeZone={timeZone} today={today} siteName={siteName} />} />
    <Column title={filters.mine ? 'Asignadas a ti' : 'Asignadas'} count={narrowed ? undefined : summary ? summary.open.total - summary.open.unassigned : undefined} pages={assigned} empty="Ninguna asignada."
      render={row => <Card key={row.id} row={row} selected={row.id === selected} onOpen={onOpen} timeZone={timeZone} today={today} siteName={siteName} />} />
    <Column title="Resueltas esta semana" count={resolvedCount} items={recent} loading={resolved.isPending} error={resolved.error} empty="Ninguna resuelta esta semana."
      render={row => <Card key={row.id} row={row} selected={row.id === selected} onOpen={onOpen} timeZone={timeZone} today={today} siteName={siteName} />}
      more={hidden > 0 ? <Box component={Link} to={moreResolved} sx={{ alignSelf: 'center', p: 1, fontSize: 13, fontWeight: 600 }}>Ver {hidden} más</Box> : undefined} />
  </Box>
}

type Pages = ReturnType<typeof useIncidentPages>

function Column({ title, count, pages, items, loading, error, empty, render, more }: {
  title: string; count?: number; pages?: Pages; items?: Incident[]; loading?: boolean; error?: Error | null; empty: string; render: (row: Incident) => React.ReactNode; more?: React.ReactNode
}) {
  const rows = items || pages?.data?.pages.flatMap(page => page.items) || []
  const pending = loading ?? (pages ? pages.isPending && pages.fetchStatus !== 'idle' : false)
  const failure = error ?? pages?.error
  const id = `columna-${title.toLowerCase().replace(/\W+/g, '-')}`
  return <Box component="section" aria-labelledby={id} sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: 'rgba(214,227,250,0.5)', border: '1px solid rgba(185,206,245,0.7)', borderRadius: '18px' }}>
    <Typography component="h2" id={id} sx={{ flex: 'none', p: '12px 14px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: color.muted }}>
      {title}{typeof count === 'number' ? ` · ${count}` : ''}
    </Typography>
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {failure ? <Note tone="error">No pudimos cargar esta columna. {failure.message}</Note>
        : pending ? <Typography role="status" sx={{ fontSize: 13, color: color.muted, p: 1 }}>Cargando…</Typography>
          : rows.length ? rows.map(render) : <Typography sx={{ fontSize: 13, color: color.muted, p: 1 }}>{empty}</Typography>}
      {pages?.hasNextPage && <Button variant="outlined" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()} sx={{ alignSelf: 'center' }}>Ver más</Button>}
      {more}
    </Box>
  </Box>
}

function Card({ row, selected, onOpen, timeZone, today, siteName }: { row: Incident; selected: boolean; onOpen: (id: string, element: HTMLElement) => void; timeZone: string; today: string; siteName: (id: string | null) => string | undefined }) {
  const severity = severityOf(row.severity)
  return <ButtonBase component="a" href={`?incidencia=${row.id}`} aria-current={selected ? 'true' : undefined} onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onOpen(row.id, event.currentTarget) }}
    sx={{ ...glass, display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left', gap: '3px', p: 1.5, borderRadius: '14px', color: `${color.ink} !important`, textDecoration: 'none',
      boxShadow: '0 1px 2px rgba(18,35,63,0.05), 0 8px 18px rgba(31,79,168,0.08)', '&:hover': { borderColor: color.fieldHover },
      '&[aria-current="true"]': { borderColor: color.accent, boxShadow: `0 0 0 1px ${color.accent}, 0 8px 18px rgba(31,79,168,0.12)` }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } }}>
    <Box component="strong" sx={{ fontSize: 13 }}>{incidentTitle(row.type)}</Box>
    <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{row.employeeName}{siteName(row.siteId) ? ` · ${siteName(row.siteId)}` : ''}</Box>
    {row.status === 'resolved' && row.resolution
      ? <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, fontSize: 12, fontWeight: 600, color: color.ok }}><Icon name="check" size={14} strokeWidth={2.2} />{outcomes[row.resolution.decision] || 'Resuelta'}</Box>
      : <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.75, fontSize: 12, color: color.muted }}>
        <Badge tone={severity.tone}>{severity.label}</Badge>{whenText(row.occurredAt || row.openedAt, timeZone, today)}
        {row.assigneeUserId && <Box component="span" title={`Asignada a ${row.assigneeName || 'otra persona'}`} sx={{ ml: 'auto', width: 26, height: 26, borderRadius: '50%', background: color.tile, color: color.deep, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span aria-hidden="true">{initialsOf(row.assigneeName || '?')}</span><Box component="span" sx={visuallyHidden}>Asignada a {row.assigneeName || 'otra persona'}</Box>
        </Box>}
        {row.blocksClosure && <Box component="span" sx={{ width: '100%', fontWeight: 600, color: color.warnText }}>Bloquea el cierre</Box>}
      </Box>}
  </ButtonBase>
}

