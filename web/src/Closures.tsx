import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, permissions, type Me, type Page, type Site, type Tenant } from './api'
import { type AttendanceSummary, addDays, dayMonth, hours, longDate, shortWeekLabel, timeIn, todayIn, weekLabel } from './attendanceModel'
import { ClosureSheet } from './ClosureSheet'
import {
  type BlockingIncident, type Closure, type ClosureRun, type ClosureSummary,
  acknowledgementBadge, blockedLabels, blockedPeople, runBody, runFailures, runPollInterval, runProcessed,
} from './closureModel'
import { color, font, glass, gradient, phoneQuery, shadow } from './design'
import { Icon } from './Icons'
import { dateInZone } from './incidentModel'
import { incidentTitle } from './incidentsView'
import { allPages } from './lists'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, Note, Pager, SelectBox, SkeletonRows, WeekNav, clickRow, tableSx, visuallyHidden } from './ui'

const pageSize = 25
const tabs = [
  { key: 'cerradas', label: 'Cerradas', status: 'closed' as const },
  { key: 'bloqueadas', label: 'Bloqueadas' },
  { key: 'reabiertas', label: 'Reabiertas', status: 'reopened' as const },
]
const acknowledgementFilters = [
  { key: 'conformes', value: 'agreed', label: 'Conformes' },
  { key: 'objecion', value: 'objected', label: 'Con objeción' },
  { key: 'sin-acuse', value: 'none', label: 'Sin acuse' },
] as const

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/**
 * Cierres semanales (OPE-04, OPE-09, OPE-10, OPE-11, TEL-10): la última
 * corrida o la que va en curso, los acuses, quién quedó cerrado, bloqueado o
 * reabierto, y el cierre de una persona con lo que congeló. Todo lo elegido
 * vive en la dirección.
 */
export function Closures({ me, context, section, screens, screen }: Props) {
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const allowed = permissions(me.roles)
  const cache = useQueryClient()
  const [params, setParams] = useSearchParams()
  // Sin semana elegida, la última que ya terminó: la anterior a la de hoy.
  const requested = params.get('semana') || addDays(today, -7)
  const siteId = params.get('sede') || ''
  const tab = tabs.find(item => item.key === params.get('pestana')) || tabs[0]
  const acknowledgement = acknowledgementFilters.find(item => item.key === params.get('acuse'))
  const selected = params.get('cierre')
  const [confirming, setConfirming] = useState(false)
  const [following, setFollowing] = useState<string | null>(null)
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

  const scope = new URLSearchParams({ week: requested, ...(siteId ? { siteId } : {}) })
  const summary = useQuery({ queryKey: ['closure-summary', scope.toString()], queryFn: () => api<ClosureSummary>(`/week-closures/summary?${scope}`), retry: false })
  const weekStart = summary.data?.weekStart
  const finished = !!weekStart && addDays(weekStart, 7) <= today
  // `?cerrar=1` (menú Crear) abre la confirmación en cuanto la semana se puede cerrar.
  const asked = params.get('cerrar') === '1'
  useEffect(() => {
    if (!asked || !weekStart) return
    if (allowed.closeWeeks && finished) setConfirming(true)
    change({ cerrar: null }, true)
  }, [asked, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps
  const sites = useQuery({ queryKey: ['sites', 'all'], queryFn: () => allPages<Site>('/sites'), retry: false, staleTime: 60_000 })
  const siteName = (id: string | null) => (id ? sites.data?.find(site => site.id === id)?.name : undefined)
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: () => api<Tenant>('/tenant'), retry: false, staleTime: 60_000 })
  // Las corridas de la semana van de la más antigua a la más reciente: la última es la que se muestra.
  const runs = useQuery({ queryKey: ['closure-runs', requested], queryFn: () => allPages<ClosureRun>(`/week-closure-runs?week=${requested}`), retry: false })
  const latest = runs.data?.filter(item => !siteId || item.siteId === siteId || item.siteId === null).at(-1)
  // Sólo se sigue una corrida que va en curso; una terminada se muestra como vino en la lista.
  const tracked = following || (latest && (latest.status === 'queued' || latest.status === 'running') ? latest.id : null)
  const followed = useQuery({ queryKey: ['closure-run', tracked], enabled: !!tracked, retry: false,
    queryFn: () => api<ClosureRun>(`/week-closure-runs/${tracked}`), refetchInterval: query => runPollInterval(query.state.data?.status, query.state.error) })
  const shown = (tracked && followed.data) || latest
  const blocking = useQuery({ queryKey: ['incidents', 'bloquean', scope.toString()], retry: false,
    queryFn: () => allPages<BlockingIncident>(`/incidents?${new URLSearchParams({ week: requested, blocksClosure: 'true', status: 'open', ...(siteId ? { siteId } : {}) })}`) })
  const blocked = blockedPeople(blocking.data || [])

  // Cuando una corrida seguida termina, lo demás de la pantalla cambia.
  const status = followed.data?.status
  const previous = useRef(status)
  useEffect(() => {
    const was = previous.current
    previous.current = status
    if ((was === 'queued' || was === 'running') && (status === 'done' || status === 'failed')) {
      for (const key of ['closure-summary', 'week-closures', 'closure-runs', 'incidents', 'incident-summary', 'attendance-weeks', 'attendance-summary', 'employee-week'])
        void cache.invalidateQueries({ queryKey: [key] })
    }
  }, [status, cache])

  const again = useMutation({ mutationFn: (previous: ClosureRun) => api<ClosureRun>('/week-closure-runs', 'POST', runBody(previous.weekStart, previous.siteId || '')),
    onSuccess: created => { cache.setQueryData(['closure-run', created.id], created); setFollowing(created.id) } })

  const open = (id: string, element: HTMLElement) => { opener.current = element; change({ cierre: id }) }
  const close = () => { change({ cierre: null }); setTimeout(() => opener.current?.focus(), 0) }

  const header = <PageHeader context={context} section={section} screens={screens} current={screen} description="la semana cerrada es la base para nómina y para el expediente"
    actions={phone ? undefined : actions()} />

  function actions() {
    return <>
      <WeekNav label={weekStart ? weekLabel(weekStart) : 'Cargando la semana…'} onPrevious={() => change({ semana: addDays(weekStart || requested, -7), cierre: null })}
        onNext={() => change({ semana: addDays(weekStart || requested, 7), cierre: null })} nextDisabled={!weekStart || addDays(weekStart, 7) > today} />
      {(sites.data?.length || 0) > 1 && <SelectBox name="alcance" label="Alcance" value={siteId} onChange={value => change({ sede: value || null, cierre: null })}
        options={[{ value: '', label: 'Toda la empresa' }, ...(sites.data || []).map(site => ({ value: site.id, label: site.name }))]} />}
      {allowed.closeWeeks && !phone && closeButton(false)}
    </>
  }
  function closeButton(wide: boolean) {
    const running = shown && (shown.status === 'queued' || shown.status === 'running')
    return <Stack spacing={0.5} sx={{ alignItems: wide ? 'stretch' : 'flex-start' }}>
      <Button variant="contained" startIcon={<Icon name={running ? 'clock' : 'closures'} size={18} />} disabled={!finished || !!running} onClick={() => setConfirming(true)}
        sx={{ color: `${color.white} !important`, minHeight: wide ? 52 : 42 }}>{running ? 'Cerrando…' : 'Cerrar las pendientes'}</Button>
      {weekStart && !finished && <Typography sx={{ fontSize: 12, color: color.muted }}>Se puede cerrar desde el {longDate(addDays(weekStart, 7))}.</Typography>}
    </Stack>
  }

  const banner = <RunBanner run={shown} pending={runs.isPending || (!!tracked && followed.isPending)} paused={followed.error instanceof ApiError ? followed.error : null}
    onRetry={() => void followed.refetch()} timeZone={timeZone} today={today} summary={summary.data} autoClose={tenant.data?.autoCloseAfterHours}
    siteName={siteName} siteScoped={me.roles.includes('supervisor') && !me.roles.some(role => ['admin_empresa', 'rh', 'auditor'].includes(role))} canAgain={allowed.closeWeeks} onAgain={() => shown && again.mutate(shown)} againPending={again.isPending} againError={again.error} />
  const acks = summary.data?.acknowledgements

  return <>
    {header}
    {phone && <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>{actions()}</Stack>}
    <Box sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 1.75 }}>
      {banner}
      <Box component="section" aria-label="Acuses" sx={{ ...glass, flex: '1 1 300px', borderRadius: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', p: 0.75, textAlign: 'center' }}>
        {acknowledgementFilters.map((item, index) => {
          const value = acks ? acks[item.value] : undefined
          const pressed = acknowledgement?.key === item.key
          return <Box component={Link} key={item.key} to={link({ acuse: pressed ? null : item.key, pestana: null, cierre: null })} aria-current={pressed ? 'true' : undefined}
            sx={{ p: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, borderLeft: index ? `1px solid ${color.lineSoft}` : 0, borderRadius: '14px', textDecoration: 'none', color: `${color.ink} !important`,
              '&[aria-current="true"]': { background: color.selected }, '&:hover': { background: color.hover } }}>
            <AckMark kind={item.value} />
            <Box component="span" sx={{ fontSize: 24, fontWeight: 700 }}>{typeof value === 'number' ? value : '…'}</Box>
            <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{item.label}</Box>
          </Box>
        })}
      </Box>
    </Box>
    {phone && allowed.closeWeeks && closeButton(true)}
    <PeopleList phone={phone} tab={tab} counts={summary.data} blocked={blocked} blockedPending={blocking.isPending} weekStart={weekStart || requested} siteId={siteId}
      acknowledgement={acknowledgement?.value} timeZone={timeZone} today={today} siteName={siteName} selected={selected} onOpen={open} link={link}
      onClearAck={() => change({ acuse: null })} ackLabel={acknowledgement?.label} />
    {selected && <ClosureSheet key={selected} id={selected} me={me} timeZone={timeZone} onClose={close}
      onReopened={() => { for (const key of ['closure-summary', 'week-closures', 'attendance-weeks', 'employee-week']) void cache.invalidateQueries({ queryKey: [key] }) }} />}
    {confirming && weekStart && <CloseWeekDialog weekStart={weekStart} siteId={siteId} sites={sites.data || []} today={today} onClose={() => setConfirming(false)}
      onStarted={created => { setConfirming(false); cache.setQueryData(['closure-run', created.id], created); setFollowing(created.id); void cache.invalidateQueries({ queryKey: ['closure-runs'] }) }} />}
  </>
}

function AckMark({ kind }: { kind: 'agreed' | 'objected' | 'none' }) {
  if (kind === 'none') return <Box aria-hidden="true" sx={{ color: color.muted, display: 'flex' }}><Icon name="clock" size={22} /></Box>
  return <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10" fill={kind === 'agreed' ? color.okMark : '#C2372E'} />
    {kind === 'agreed' ? <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke={color.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M12 7v6M12 16.5v.1" fill="none" stroke={color.white} strokeWidth="2.4" strokeLinecap="round" />}
  </svg>
}

type BannerProps = {
  run?: ClosureRun; pending: boolean; paused: ApiError | null; onRetry: () => void; timeZone: string; today: string; summary?: ClosureSummary
  autoClose?: number | null; siteName: (id: string | null) => string | undefined; siteScoped: boolean; canAgain: boolean; onAgain: () => void; againPending: boolean; againError: Error | null
}

/** OPE-04 y OPE-10: la última corrida, o la que va en curso, con su avance. */
function RunBanner({ run, pending, paused, onRetry, timeZone, today, summary, autoClose, siteName, siteScoped, canAgain, onAgain, againPending, againError }: BannerProps) {
  const auto = autoClose === undefined ? null : autoClose === null ? 'Cierre automático: desactivado' : `Cierre automático: ${autoClose} h después de terminar la semana`
  const box = { flex: '2 1 460px', position: 'relative', overflow: 'hidden', background: gradient.banner, boxShadow: shadow.banner, color: color.white, borderRadius: '20px', p: '16px 20px', display: 'flex', flexDirection: 'column', gap: 1.25 } as const
  const decor = <Box aria-hidden="true" sx={{ position: 'absolute', right: -50, top: -70, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
  if (pending) return <Box component="section" aria-label="Corrida de cierre" sx={box}>{decor}<Typography role="status" sx={{ fontSize: 15 }}>Cargando la corrida…</Typography></Box>
  if (!run) return <Box component="section" aria-labelledby="corrida-t" sx={box}>{decor}
    <Typography component="h2" id="corrida-t" sx={{ fontSize: 15, fontWeight: 600, position: 'relative' }}>{siteScoped ? 'Sin corridas de tu sede en esta semana' : 'Sin corridas de cierre en esta semana'}</Typography>
    <Typography sx={{ fontSize: 34, fontWeight: 700, lineHeight: 1, position: 'relative' }}>{summary?.closed ?? '…'} <Box component="span" sx={{ fontSize: 18, fontWeight: 500 }}>{summary?.closed === 1 ? 'cerrada' : 'cerradas'}</Box></Typography>
    {siteScoped && !!summary?.closed && <Typography sx={{ fontSize: 13, position: 'relative' }}>Las corridas de toda la empresa no aparecen aquí; lo que cerraron, sí.</Typography>}
    {auto && <Typography sx={{ fontSize: 13, position: 'relative' }}>{auto}</Typography>}
  </Box>
  const active = run.status === 'queued' || run.status === 'running'
  const total = run.total
  const processed = runProcessed(run)
  const blockedCount = run.blocked.openIncidents + run.blocked.openSegment
  const who = run.origin === 'scheduled' ? 'Cierre programado' : `Pedida por ${run.requestedByName || 'otra persona'}`
  const day = dateInZone(run.createdAt, timeZone)
  // «lunes 2 nov, 10:15», como en el lienzo.
  const when = `${day === today ? 'hoy' : `${longDate(day).split(' ')[0]} ${dayMonth(day).split(' ').slice(1).join(' ')}`}, ${timeIn(run.createdAt, timeZone)}`
  const scope = run.siteId ? siteName(run.siteId) || 'una sede' : 'toda la empresa'
  const width = (value: number) => `${total ? Math.min(100, (value / total) * 100) : 0}%`
  return <Box component="section" aria-labelledby="corrida-t" sx={box}>
    {decor}
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'space-between', gap: 1, position: 'relative' }}>
      <Typography component="h2" id="corrida-t" sx={{ fontSize: 15, fontWeight: 600 }}>{active ? `Corrida en curso · ${scope} · ${shortWeekLabel(run.weekStart)}` : `Última corrida · ${when}`}</Typography>
      {active ? <Box component="span" sx={{ fontSize: 12, fontWeight: 600, p: '3px 10px', borderRadius: 999, background: color.white, color: color.deep }}>{run.status === 'queued' ? 'En cola' : 'En curso'}</Box>
        : <Typography sx={{ fontSize: 13 }}>{who} · {run.status === 'failed' ? 'no terminó' : 'terminada'}</Typography>}
    </Stack>
    <Typography sx={{ fontSize: 34, fontWeight: 700, lineHeight: 1, position: 'relative' }}>
      {active ? processed : run.closed} <Box component="span" sx={{ fontSize: 18, fontWeight: 500 }}>{active ? `de ${total ?? '…'} revisadas` : `cerradas${total !== null ? ` de ${total}` : ''}`}</Box>
    </Typography>
    <Box role="img" aria-label={`${run.closed} cerradas y ${blockedCount} bloqueadas${total !== null ? ` de ${total}` : ''}`}
      sx={{ display: 'flex', gap: '2px', height: 10, position: 'relative', borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.22)' }}>
      <Box sx={{ width: width(run.closed), background: color.white }} />
      <Box sx={{ width: width(blockedCount), background: color.runBlocked }} />
    </Box>
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, position: 'relative' }}>
      <Legend tone={color.white}>Cerradas {run.closed}</Legend>
      <Legend tone={color.runBlocked}>Bloqueadas {blockedCount}</Legend>
      {active && total !== null && <span>Por revisar {Math.max(0, total - processed)}</span>}
      {!active && auto && <span>{auto}</span>}
    </Stack>
    {active && <Typography sx={{ fontSize: 13, position: 'relative' }}>{who} · puedes seguir trabajando; el avance se actualiza solo.</Typography>}
    {paused && <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 13 }}>El seguimiento está en pausa{paused.status === 429 ? ' por demasiadas consultas' : ''}. Lo ya cerrado se conserva.</Typography>
      <Button variant="outlined" onClick={onRetry} sx={{ minHeight: 36 }}>Reanudar</Button>
    </Box>}
    {run.status === 'failed' && <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 13 }}>{runFailures[run.failure || ''] || 'La corrida no pudo terminar.'} Lo ya cerrado se conserva.</Typography>
      {canAgain && <Button variant="outlined" disabled={againPending} onClick={onAgain} sx={{ minHeight: 36 }}>{againPending ? 'Pidiendo…' : 'Pedir otra con el mismo alcance'}</Button>}
      {againError && <Typography role="alert" sx={{ fontSize: 13, fontWeight: 600, width: '100%' }}>No se pudo pedir otra. {againError.message}</Typography>}
    </Box>}
  </Box>
}

function Legend({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: '3px', background: tone }} />{children}</Box>
}

type ListProps = {
  phone: boolean; tab: typeof tabs[number]; counts?: ClosureSummary; blocked: ReturnType<typeof blockedPeople>; blockedPending: boolean; weekStart: string; siteId: string
  acknowledgement?: string; timeZone: string; today: string; siteName: (id: string | null) => string | undefined; selected: string | null
  onOpen: (id: string, element: HTMLElement) => void; link: (values: Record<string, string | null>) => string; onClearAck: () => void; ackLabel?: string
}

/** OPE-04 y OPE-11: cerradas, bloqueadas y reabiertas de la semana. */
function PeopleList({ phone, tab, counts, blocked, blockedPending, weekStart, siteId, acknowledgement, timeZone, today, siteName, selected, onOpen, link, onClearAck, ackLabel }: ListProps) {
  const query = new URLSearchParams({ week: weekStart, ...(tab.status ? { status: tab.status } : {}), ...(siteId ? { siteId } : {}), ...(acknowledgement && tab.status === 'closed' ? { acknowledgement } : {}) })
  const scope = query.toString()
  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!
  const list = useQuery({ queryKey: ['week-closures', scope, cursor], enabled: !!tab.status, retry: false,
    queryFn: () => api<Page<Closure>>(`/week-closures?${query}&limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`) })
  const rows = list.data?.items || []
  const total = tab.status === 'closed' ? (acknowledgement && counts ? counts.acknowledgements[acknowledgement as 'agreed'] : counts?.closed) : counts?.reopened
  const start = (cursors.length - 1) * pageSize
  const pager = <Pager text={rows.length ? `${start + 1}–${start + rows.length}${typeof total === 'number' ? ` de ${total}` : ''}` : ''} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />
  const incidentLink = (person: ReturnType<typeof blockedPeople>[number]) => `/incidencias?${new URLSearchParams({ semana: weekStart, incidencia: person.incidents[0].id })}`
  const cause = (person: ReturnType<typeof blockedPeople>[number]) => {
    const missing = person.incidents.some(incident => incident.type === 'missing_pair')
    return missing && person.incidents.length === 1 ? 'Tramo abierto' : `${person.incidents.length} ${person.incidents.length === 1 ? 'incidencia abierta' : 'incidencias abiertas'}`
  }
  const failure = list.error instanceof ApiError ? list.error : null
  const tabNav = <Box component="nav" aria-label="Personas de la semana" sx={{ flex: 'none', display: 'flex', gap: 0.5, px: 1.5, borderBottom: `1px solid ${color.lineSoft}`, overflowX: 'auto' }}>
    {tabs.map(item => {
      const count = item.key === 'cerradas' ? counts?.closed : item.key === 'bloqueadas' ? (blockedPending ? undefined : blocked.length) : counts?.reopened
      return <Box component={Link} key={item.key} to={link({ pestana: item.key === 'cerradas' ? null : item.key, cierre: null })} aria-current={item.key === tab.key ? 'page' : undefined}
        sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, px: 1.5, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', borderBottom: '2px solid transparent', color: `${color.muted} !important`,
          '&[aria-current="page"]': { borderBottomColor: color.accent, color: `${color.deep} !important` } }}>
        {item.label}{typeof count === 'number' ? ` · ${count}` : ''}
      </Box>
    })}
  </Box>
  const labels = blockedLabels(blocked, siteName)
  const strip = blocked.length > 0 && <Box role="note" sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, p: '10px 14px', background: color.blockedBg, borderBottom: `1px solid ${color.blockedLine}`, fontSize: 13 }}>
    <Box component="strong" sx={{ color: color.warnInk }}>Bloqueadas:</Box>
    {blocked.slice(0, phone ? 3 : 5).map(person => <Box component={Link} key={person.employeeId} to={incidentLink(person)}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 32, px: 1.25, borderRadius: 999, background: color.white, border: `1px solid ${color.blockedPill}`, color: `${color.ink} !important`, textDecoration: 'none' }}>
      {labels[person.employeeId]} <Box component="span" sx={{ color: color.warnInk }}>· {cause(person).toLowerCase()}{person.incidents.length === 1 && cause(person) === 'Tramo abierto' ? ` ${dayMonth(dateInZone(person.since, timeZone)).split(' ').slice(0, 2).join(' ')}` : ''}</Box>
    </Box>)}
    {blocked.length > (phone ? 3 : 5) && <Box component={Link} to={link({ pestana: 'bloqueadas' })} sx={{ fontWeight: 600 }}>y {blocked.length - (phone ? 3 : 5)} más</Box>}
  </Box>
  const name = (row: Closure) => <Box component="a" data-row-link href={`?cierre=${row.id}`} aria-current={row.id === selected ? 'true' : undefined} onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onOpen(row.id, event.currentTarget) }}
    sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>{row.employeeName || 'Persona'}</Box>
  const who = (row: Closure) => row.closedBy === null ? 'Cierre programado' : row.closedByName || 'Sin nombre'

  let body: React.ReactNode
  if (tab.key === 'bloqueadas') {
    body = blockedPending ? <Typography role="status" sx={{ p: 2, fontSize: 13, color: color.muted }}>Cargando las bloqueadas…</Typography>
      : !blocked.length ? <Empty text="Nadie está bloqueado en esta semana." />
        : phone ? <Cards>{blocked.map(person => <Card key={person.employeeId} to={incidentLink(person)} title={person.name} detail={`${siteName(person.siteId) || 'Sin sede'} · desde ${dayMonth(dateInZone(person.since, timeZone))}`} badge={<Badge tone="warn">{cause(person)}</Badge>} />)}</Cards>
          : <Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Persona</th><th scope="col">Sede</th><th scope="col">Causa</th><th scope="col">Desde</th><th scope="col">Qué falta</th></tr></thead>
            <tbody>{blocked.map(person => <tr key={person.employeeId} onClick={clickRow}>
              <td><Box component={Link} data-row-link to={incidentLink(person)} sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>{person.name}</Box></td>
              <td>{siteName(person.siteId) || 'Sin sede'}</td>
              <td><Badge tone="warn">{cause(person)}</Badge></td>
              <td>{dayMonth(dateInZone(person.since, timeZone))}</td>
              <Box component="td" sx={{ whiteSpace: 'normal !important' }}>{person.incidents.map(incident => `${incidentTitle(incident.type)}${incident.assigneeUserId ? '' : ' · sin asignar'}`).join('; ')}</Box>
            </tr>)}</tbody>
          </Box>
  } else if (failure) {
    body = <Box sx={{ p: 2 }}><Note tone="error">No pudimos cargar los cierres. {failure.message}{failure.correlationId && ` Referencia: ${failure.correlationId}.`}</Note></Box>
  } else if (list.isPending) {
    body = <>
      <Typography role="status" sx={visuallyHidden}>Cargando los cierres…</Typography>
      {!phone && <Box component="table" sx={tableSx}><tbody><SkeletonRows columns={6} rows={8} /></tbody></Box>}
    </>
  } else if (!rows.length) {
    body = <Empty text={tab.key === 'reabiertas' ? 'Ninguna semana reabierta.' : acknowledgement ? `Nadie ${ackLabel?.toLowerCase() === 'sin acuse' ? 'sin acuse' : `con «${ackLabel}»`} en esta semana.` : 'Todavía no hay semanas cerradas.'} />
  } else if (phone) {
    body = <Cards>{rows.map(row => {
      const badge = acknowledgementBadge(row)
      return <Card key={row.id} onClick={element => onOpen(row.id, element)} href={`?cierre=${row.id}`} title={row.employeeName || 'Persona'}
        detail={`${row.employeeExternalId ? `${row.employeeExternalId} · ` : ''}${hours(row.totals.ordinaryMinutes)} + ${hours(row.totals.overtimeMinutes)} extra · ${who(row)}`} badge={<Badge tone={badge.tone}>{badge.label}</Badge>} />
    })}</Cards>
  } else {
    body = <Box component="table" sx={tableSx}>
      <thead><tr><th scope="col">Persona</th><th scope="col">Ordinarias</th><th scope="col">Extra</th><th scope="col">Cerró</th><th scope="col">Huella</th><th scope="col">{tab.key === 'reabiertas' ? 'Estado' : 'Acuse'}</th></tr></thead>
      <tbody>{rows.map(row => {
        const badge = acknowledgementBadge(row)
        return <tr key={row.id} data-selected={row.id === selected} onClick={clickRow}>
          <td>{name(row)}{row.employeeExternalId && <Box component="span" sx={{ color: color.subtle }}> {row.employeeExternalId}</Box>}{row.version > 1 && <Box component="span" sx={{ color: color.subtle }}> · versión {row.version}</Box>}</td>
          <td>{hours(row.totals.ordinaryMinutes)}</td>
          <td>{hours(row.totals.overtimeMinutes)}</td>
          <Box component="td" sx={{ color: color.muted }}>{who(row)}</Box>
          <td><Box component="code" title={row.hash} sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: color.muted }}>{row.hash.slice(0, 4)}…{row.hash.slice(-4)}</Box></td>
          <td><Badge tone={badge.tone}>{badge.label}</Badge></td>
        </tr>
      })}</tbody>
    </Box>
  }

  return <Box component="section" aria-label="Personas de la semana" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: color.white, borderRadius: '20px', boxShadow: shadow.table, overflow: 'hidden',
    [`@media ${phoneQuery}`]: { flex: 'none' } }}>
    {strip}
    {tabNav}
    {acknowledgement && tab.key === 'cerradas' && <Stack direction="row" sx={{ alignItems: 'center', gap: 1, p: '8px 14px', fontSize: 13, color: color.muted, borderBottom: `1px solid ${color.lineSoft}` }}>
      Sólo: {ackLabel} <Button variant="outlined" onClick={onClearAck} sx={{ minHeight: 32, ml: 'auto' }}>Ver todas</Button>
    </Stack>}
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{body}</Box>
    {tab.status && rows.length > 0 && pager}
  </Box>
}

function Empty({ text }: { text: string }) {
  return <Typography sx={{ p: 4, textAlign: 'center', fontSize: 14, color: color.muted }}>{text}</Typography>
}

function Cards({ children }: { children: React.ReactNode }) {
  return <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</Box>
}

function Card({ title, detail, badge, to, href, onClick }: { title: string; detail: string; badge: React.ReactNode; to?: string; href?: string; onClick?: (element: HTMLElement) => void }) {
  const sx = { display: 'flex', alignItems: 'center', gap: 1.5, p: '12px 14px', borderRadius: '16px', background: color.rowHover, textDecoration: 'none', color: `${color.ink} !important` } as const
  const content = <><Box sx={{ flex: 1, minWidth: 0 }}><Box component="strong" sx={{ display: 'block', fontSize: 15 }}>{title}</Box><Box component="span" sx={{ fontSize: 13, color: color.muted }}>{detail}</Box></Box>{badge}</>
  return <li>{to ? <Box component={Link} to={to} sx={sx}>{content}</Box>
    : <Box component="a" href={href} onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onClick?.(event.currentTarget) }} sx={sx}>{content}</Box>}</li>
}

/** OPE-09: confirmar el alcance antes de pedir la corrida. */
function CloseWeekDialog({ weekStart, siteId, sites, today, onClose, onStarted }: {
  weekStart: string; siteId: string; sites: Site[]; today: string; onClose: () => void; onStarted: (run: ClosureRun) => void
}) {
  const [scope, setScope] = useState(siteId)
  const end = addDays(weekStart, 6)
  const query = new URLSearchParams({ week: weekStart, ...(scope ? { siteId: scope } : {}) })
  const people = useQuery({ queryKey: ['attendance-summary', end > today ? today : end, scope], retry: false,
    queryFn: () => api<AttendanceSummary>(`/attendance/summary?${new URLSearchParams({ date: end > today ? today : end, ...(scope ? { siteId: scope } : {}) })}`) })
  const counts = useQuery({ queryKey: ['closure-summary', query.toString()], retry: false, queryFn: () => api<ClosureSummary>(`/week-closures/summary?${query}`) })
  const blocking = useQuery({ queryKey: ['incidents', 'bloquean', query.toString()], retry: false,
    queryFn: () => allPages<BlockingIncident>(`/incidents?${new URLSearchParams({ week: weekStart, blocksClosure: 'true', status: 'open', ...(scope ? { siteId: scope } : {}) })}`) })
  const blocked = blockedPeople(blocking.data || [])
  const labels = blockedLabels(blocked, id => sites.find(site => site.id === id)?.name)
  const start = useMutation({ mutationFn: () => api<ClosureRun>('/week-closure-runs', 'POST', runBody(weekStart, scope)), onSuccess: onStarted })
  const total = people.data?.people
  const closed = counts.data?.closed
  const ready = typeof total === 'number' && typeof closed === 'number' ? Math.max(0, total - closed - blocked.length) : undefined
  const failure = start.error instanceof ApiError ? start.error : null
  const tile = (value: number | undefined, label: string, tone: string) => <Box sx={{ background: color.rowHover, borderRadius: '12px', p: '10px 12px', fontSize: 12, color: color.muted }}>
    <Box component="strong" sx={{ display: 'block', fontSize: 20, color: tone }}>{typeof value === 'number' ? value : '…'}</Box>{label}
  </Box>
  return <Dialog open onClose={() => { if (!start.isPending) onClose() }} aria-labelledby="cerrar-t" fullWidth maxWidth="sm" slotProps={{ paper: { sx: { overflow: 'hidden' } } }}>
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, p: '18px 20px', color: color.white, background: gradient.sheet }}>
      <Box aria-hidden="true" sx={{ width: 40, height: 40, flex: 'none', borderRadius: '12px', background: color.white, color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="closures" /></Box>
      <Box sx={{ flex: 1 }}>
        <Typography component="h2" id="cerrar-t" sx={{ fontSize: 18, fontWeight: 600 }}>Cerrar la semana {shortWeekLabel(weekStart)}</Typography>
        <Typography sx={{ fontSize: 13 }}>Como trabajo: puedes seguir usando Zenit mientras corre</Typography>
      </Box>
    </Stack>
    <Box sx={{ p: '18px 20px', display: 'flex', flexDirection: 'column', gap: 1.75, fontFamily: font }}>
      <Box component="fieldset" sx={{ border: 0, m: 0, p: 0 }}>
        <Box component="legend" sx={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, mb: 1 }}>Alcance</Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px', background: color.hover, borderRadius: '12px', p: '3px' }}>
          {[{ id: '', name: 'Toda la empresa' }, ...sites].map(option => <Box component="label" key={option.id} sx={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, minHeight: 40, borderRadius: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: scope === option.id ? color.deep : color.muted, background: scope === option.id ? color.white : 'transparent', boxShadow: scope === option.id ? '0 1px 3px rgba(18,35,63,0.12)' : 'none', '&:focus-within': { outline: `2px solid ${color.accent}` } }}>
            <input type="radio" name="alcance-cierre" value={option.id} checked={scope === option.id} onChange={() => setScope(option.id)} style={{ accentColor: color.link }} />{option.name}
          </Box>)}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
        {tile(total, 'personas', color.ink)}{tile(ready, 'por cerrar', color.ok)}{tile(blocking.isPending ? undefined : blocked.length, 'seguirán bloqueadas', color.warnText)}
      </Box>
      {blocked.length > 0 && <Box sx={{ border: `1px solid ${color.line}`, borderRadius: '14px', overflow: 'auto', maxHeight: 200 }}>
        <Box component="table" sx={{ ...tableSx, '& td': { ...tableSx['& td'], whiteSpace: 'normal' } }}>
          <thead><tr><th scope="col">Seguirán bloqueadas</th><th scope="col">Por qué</th></tr></thead>
          <tbody>{blocked.map(person => <tr key={person.employeeId}><td>{labels[person.employeeId]}</td><td>{person.incidents.length === 1 ? incidentTitle(person.incidents[0].type) : `${person.incidents.length} incidencias abiertas`}</td></tr>)}</tbody>
        </Box>
      </Box>}
      <Note>Cada cierre guarda totales, días, reglas y su huella; cada persona da su acuse desde la app. Quien tenga una salida faltante también queda bloqueado; la corrida lo dice al terminar. Reabrir sólo lo puede hacer Administración.</Note>
      {failure && <Note tone="error">{failure.code === 'week_not_finished' ? 'La semana todavía no termina en la zona horaria de la empresa.' : `No se pudo pedir el cierre. ${failure.message}`}{failure.correlationId && ` Referencia: ${failure.correlationId}.`}</Note>}
    </Box>
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1.25, p: '14px 20px', borderTop: `1px solid ${color.lineSoft}` }}>
      <Button variant="outlined" disabled={start.isPending} onClick={onClose}>Cancelar</Button>
      <Button variant="contained" disabled={start.isPending} onClick={() => start.mutate()} sx={{ color: `${color.white} !important` }}>
        {start.isPending ? 'Pidiendo el cierre…' : ready ? `Cerrar ${ready} ${ready === 1 ? 'semana' : 'semanas'}` : 'Cerrar la semana'}
      </Button>
    </Stack>
  </Dialog>
}
