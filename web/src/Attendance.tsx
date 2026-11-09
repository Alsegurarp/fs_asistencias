import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Menu, MenuItem, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Me, type Site } from './api'
import {
  type Attention, type AttendanceSummary, type RuleSet, type Schedule, type WeekList, type WeekRow,
  addDays, attentionFlags, csv, hours, limitHours, todayIn, todayText, weekContains, weekLabel, weekProgress,
} from './attendanceModel'
import { color, font, phoneQuery, shadow } from './design'
import { allPages } from './lists'
import { PersonSheet } from './PersonSheet'
import { PageHeader } from './Shell'
import type { Section, Screen } from './sections'
import { Icon } from './Icons'
import { Badge, FilterChip, IconButton, visuallyHidden, Note, OutlineButton, Pager, Pane, SearchBox, SelectBox, SkeletonRows, WeekNav, tableSx, toneText } from './ui'

const pageSize = 25
const filters: { slug: string; attention: Attention; label: string; short: string; today?: boolean }[] = [
  { slug: 'alertas', attention: 'alerts', label: 'Con alertas', short: 'Con alertas' },
  { slug: 'extra', attention: 'overtime', label: 'Con tiempo extra', short: 'Con extra' },
  { slug: 'sin-entrada', attention: 'no_entry_today', label: 'Sin entrada hoy', short: 'Sin entrada', today: true },
  { slug: 'en-turno', attention: 'on_shift', label: 'En turno', short: 'En turno', today: true },
]
type Column = 'site' | 'schedule' | 'today' | 'attention'
const columnNames: Record<Column, string> = { site: 'Sede', schedule: 'Horario', today: 'Hoy', attention: 'Atención' }
const columnsKey = 'zenit.asistencia.columnas'
function readColumns(): Column[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(columnsKey) || 'null')
    if (Array.isArray(saved)) return saved.filter((item): item is Column => item in columnNames)
  } catch { /* sin almacenamiento o dato roto: columnas de siempre */ }
  return ['site', 'schedule', 'today', 'attention']
}
function saveColumns(columns: Column[]) { try { window.localStorage.setItem(columnsKey, JSON.stringify(columns)) } catch { /* sólo dura la visita */ } }

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/**
 * Asistencia (OPE-02, EST-09, TEL-07): la semana de cada persona con sus
 * totales, filtros y búsqueda en el servidor. La ficha de una persona
 * (OPE-02, OPE-07, OPE-08, TEL-08) se abre sobre la tabla. Todo lo elegido
 * vive en la dirección, para que un enlace o el botón atrás lo conserven.
 */
export function Attendance({ me, context, section, screens, screen }: Props) {
  const timeZone = me.tenant!.timeZone
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const today = todayIn(timeZone)
  const requested = params.get('semana') || today
  const siteId = params.get('sede') || ''
  const filter = filters.find(item => item.slug === params.get('filtro'))
  const query = params.get('q') || ''
  const person = params.get('persona')
  const tab = params.get('ficha') || 'semana'
  const [text, setText] = useState(query)
  const [columns, setColumns] = useState(readColumns)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const change = (values: Record<string, string | null>, replace = false) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
      return next
    }, { replace })
  }
  // La búsqueda viaja a la dirección cuando la persona deja de escribir.
  useEffect(() => { setText(query) }, [query])
  useEffect(() => {
    const value = text.trim()
    if (value === query) return
    const timer = setTimeout(() => change({ q: value || null }, true), 300)
    return () => clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar de semana o de filtros, la tabla vuelve a su primera página.
  const scope = [requested, siteId, filter?.attention || '', query].join('|')
  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!

  const listParams = (from: string, limit: number) => {
    const search = new URLSearchParams({ week: requested, limit: String(limit) })
    if (siteId) search.set('siteId', siteId)
    if (filter) search.set('attention', filter.attention)
    if (query) search.set('q', query)
    if (from) search.set('cursor', from)
    return search
  }
  const list = useQuery({ queryKey: ['attendance-weeks', requested, siteId, filter?.attention || '', query, cursor],
    queryFn: () => api<WeekList>(`/attendance/weeks?${listParams(cursor, pageSize)}`), retry: false })
  const summaryDate = requested > today ? today : requested
  const summary = useQuery({ queryKey: ['attendance-summary', summaryDate, siteId],
    queryFn: () => api<AttendanceSummary>(`/attendance/summary?${new URLSearchParams({ date: summaryDate, ...(siteId ? { siteId } : {}) })}`), retry: false })
  const sites = useQuery({ queryKey: ['sites', 'all'], queryFn: () => allPages<Site>('/sites'), retry: false, staleTime: 60_000 })
  const schedules = useQuery({ queryKey: ['schedules', 'all'], queryFn: () => allPages<Schedule>('/schedules'), retry: false, staleTime: 60_000 })
  const weekStart = list.data?.weekStart || summary.data?.weekStart
  const rules = useQuery({ queryKey: ['rule-set', weekStart], enabled: !!weekStart, retry: false, staleTime: 3_600_000,
    queryFn: () => api<{ items: RuleSet[] }>(`/rule-sets?effectiveOn=${weekStart}`).then(result => result.items[0] || null) })

  const current = !!weekStart && weekContains(weekStart, today)
  // Un filtro de «hoy» no aplica a otra semana: el servidor responde 422.
  useEffect(() => { if (weekStart && filter?.today && !current) change({ filtro: null }, true) }, [weekStart, filter, current]) // eslint-disable-line react-hooks/exhaustive-deps

  const siteName = useMemo(() => { const names = new Map((sites.data || []).map(site => [site.id, site.name])); return (id: string | null) => (id ? names.get(id) : undefined) }, [sites.data])
  const scheduleOf = useMemo(() => { const all = new Map((schedules.data || []).map(item => [item.id, item])); return (id: string | null) => (id ? all.get(id) : undefined) }, [schedules.data])
  const rule = rules.data || null
  const ordinaryMax = rule?.weeklyOrdinaryMaxMinutes
  const overtimeMax = rule ? Number(rule.parameters.weeklyOvertimeMaxMinutes) || undefined : undefined
  const overtimeMaxDays = rule ? Number(rule.parameters.overtimeMaxDays) || undefined : undefined
  const description = rule && ordinaryMax ? `reglas ${rule.validFrom.slice(0, 4)}: ${limitHours(ordinaryMax)} h ordinarias${overtimeMax ? ` y hasta ${limitHours(overtimeMax)} h extra` : ''} por semana` : undefined

  const counts: Record<Attention, number | null | undefined> = {
    alerts: summary.data?.week.withAttention, overtime: summary.data?.week.withOvertime,
    no_entry_today: summary.data?.day.noEntry, on_shift: summary.data?.day.onShift,
  }
  const shownFilters = filters.filter(item => !item.today || current)
  const rows = list.data?.items || []
  const total = query ? null : filter ? counts[filter.attention] : summary.data?.people
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${typeof total === 'number' ? ` de ${total}` : list.data?.nextCursor ? ' y más' : ''}` : '0'

  const selectFilter = (slug: string | null) => change({ filtro: slug, persona: null })
  const clearFilters = () => { setText(''); change({ filtro: null, q: null, sede: null }) }
  const open = (employeeId: string, element: HTMLElement) => { opener.current = element; change({ persona: employeeId, ficha: null }) }
  const close = () => { change({ persona: null, ficha: null }); setTimeout(() => opener.current?.focus(), 0) }
  const toggleColumn = (column: Column) => setColumns(currentColumns => {
    const next = currentColumns.includes(column) ? currentColumns.filter(item => item !== column) : (Object.keys(columnNames) as Column[]).filter(item => item === column || currentColumns.includes(item))
    saveColumns(next)
    return next
  })

  const exportView = async () => {
    setExporting(true); setExportError(null)
    try {
      const all: WeekRow[] = []
      let from = ''
      do {
        const page = await api<WeekList>(`/attendance/weeks?${listParams(from, 200)}`)
        all.push(...page.items)
        from = page.nextCursor || ''
      } while (from)
      const header = ['Persona', 'Número', 'Sede', 'Horario', 'Ordinarias', 'Extra', ...(current ? ['Hoy'] : []), 'Atención']
      const body = all.map(row => [row.displayName, row.externalId, siteName(row.siteId) || '', scheduleOf(row.scheduleId)?.name || '', hours(row.totals.ordinaryMinutes), hours(row.totals.overtimeMinutes),
        ...(current ? [todayText(row, timeZone, scheduleOf(row.scheduleId), today)?.text || ''] : []), attentionFlags(row, overtimeMaxDays).map(flag => flag.label).join('; ')])
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([csv([header, ...body])], { type: 'text/csv;charset=utf-8' }))
      link.download = `asistencia-${weekStart || requested}.csv`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    } catch (error) {
      setExportError(error instanceof ApiError ? `${error.message}${error.correlationId ? ` Referencia: ${error.correlationId}.` : ''}` : 'No se pudo exportar la vista.')
    } finally { setExporting(false) }
  }

  const header = <PageHeader context={context} section={section} screens={screens} current={screen} description={description}
    actions={<>
      <WeekNav label={weekStart ? weekLabel(weekStart) : 'Cargando la semana…'} onPrevious={() => change({ semana: addDays(weekStart || requested, -7), persona: null })}
        onNext={() => change({ semana: addDays(weekStart || requested, 7), persona: null })} nextDisabled={!weekStart || addDays(weekStart, 7) > today} />
      {!phone && <OutlineButton icon="download" onClick={() => void exportView()} disabled={exporting || !rows.length}>{exporting ? 'Exportando…' : 'Exportar vista'}</OutlineButton>}
    </>} />

  const filterBar = <Box component="form" aria-label="Filtros" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }, true) }}
    sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', [`@media ${phoneQuery}`]: { flexWrap: 'nowrap', flexDirection: 'column', alignItems: 'stretch' } }}>
    {/* En escritorio todo va en una fila, como en el lienzo; en teléfono, la búsqueda arriba y los filtros se desplazan. */}
    <Box sx={{ display: phone ? 'flex' : 'contents', flexWrap: 'wrap', gap: 1 }}>
      <SearchBox name="q" label="Filtrar por persona o número" placeholder="Persona o número" value={text} onChange={setText} grow={phone} />
      {(sites.data?.length || 0) > 1 && <SelectBox name="sede" label="Sede" value={siteId} onChange={value => change({ sede: value || null, persona: null })}
        options={[{ value: '', label: 'Todas' }, ...(sites.data || []).map(site => ({ value: site.id, label: site.name }))]} />}
    </Box>
    {!phone && <Box aria-hidden="true" sx={{ width: '1px', height: 24, background: color.fieldSoft, mx: 0.5 }} />}
    <Box sx={{ display: phone ? 'flex' : 'contents', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
      {phone && <FilterChip small pressed={!filter} onClick={() => selectFilter(null)}>Todas{typeof summary.data?.people === 'number' ? ` · ${summary.data.people}` : ''}</FilterChip>}
      {shownFilters.map(item => {
        const count = counts[item.attention]
        return <FilterChip key={item.slug} small={phone} pressed={filter?.slug === item.slug} onClick={() => selectFilter(filter?.slug === item.slug ? null : item.slug)}>
          {phone ? item.short : item.label}{typeof count === 'number' ? ` · ${count}` : ''}
        </FilterChip>
      })}
    </Box>
  </Box>

  const failure = list.error instanceof ApiError ? list.error : null
  const loading = list.isPending
  const titleCount = query ? `Resultados de «${query}»` : filter ? `${typeof total === 'number' ? total : '…'} ${filter.label.toLowerCase()}` : `${typeof total === 'number' ? total : '…'} ${total === 1 ? 'persona' : 'personas'}`
  const visible = (column: Column) => columns.includes(column) && (column !== 'today' || current)

  return <>
    {header}
    {filterBar}
    {exportError && <Note tone="error">{exportError}</Note>}
    {phone
      ? <PhoneList rows={rows} loading={loading} failure={failure} onRetry={() => void list.refetch()} siteName={siteName} timeZone={timeZone} today={today} current={current}
          scheduleOf={scheduleOf} ordinaryMax={ordinaryMax} overtimeMaxDays={overtimeMaxDays} weekLine={weekStart ? `${weekLabel(weekStart)} · ${weekProgress(weekStart, today)}` : undefined}
          pager={<Pager text={pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor} onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })}
            onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />} onOpen={open}
          filtered={!!(filter || query || siteId)} onClear={clearFilters} />
      : <Pane titleId="asistencia-tabla" title={loading ? 'Cargando la semana…' : titleCount} detail={!loading && weekStart ? weekProgress(weekStart, today) : undefined}
          actions={<ColumnsMenu columns={columns} onToggle={toggleColumn} />}
          footer={<Pager text={loading ? '' : pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
            onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />}>
          {loading && <Typography role="status" sx={visuallyHidden}>Cargando la semana…</Typography>}
          {failure ? <Box sx={{ p: 2 }}><ListError error={failure} onRetry={() => void list.refetch()} /></Box>
            : !loading && !rows.length ? <Empty filtered={!!(filter || query || siteId)} onClear={clearFilters} />
              : <Box component="table" sx={tableSx}>
                <thead><tr>
                  <th scope="col">Persona</th>
                  {visible('site') && <th scope="col">Sede</th>}
                  {visible('schedule') && <th scope="col">Horario</th>}
                  <th scope="col">Ordinarias</th>
                  <th scope="col">Extra</th>
                  {visible('today') && <th scope="col">Hoy</th>}
                  {visible('attention') && <th scope="col">Atención</th>}
                </tr></thead>
                <tbody>
                  {loading ? <SkeletonRows columns={2 + columns.filter(visible).length + 1} /> : rows.map(row => {
                    const todayLabel = visible('today') ? todayText(row, timeZone, scheduleOf(row.scheduleId), today) : null
                    const flags = attentionFlags(row, overtimeMaxDays)
                    return <tr key={row.employeeId} data-selected={row.employeeId === person}>
                      <td>
                        <Box component={Link} to={`?${withPerson(params, row.employeeId)}`} aria-current={row.employeeId === person ? 'true' : undefined}
                          onClick={event => { event.preventDefault(); open(row.employeeId, event.currentTarget) }}
                          sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>{row.displayName}</Box>
                        {' '}<Box component="span" sx={{ color: color.subtle }}>{row.externalId}</Box>
                      </td>
                      {visible('site') && <td>{siteName(row.siteId) || <Muted>Sin sede</Muted>}</td>}
                      {visible('schedule') && <Box component="td" sx={{ color: color.muted }}>{scheduleOf(row.scheduleId)?.name || <Muted>Sin horario</Muted>}</Box>}
                      <td><strong>{hours(row.totals.ordinaryMinutes)}</strong>{ordinaryMax && <Box component="span" sx={{ color: color.subtle }}> / {limitHours(ordinaryMax)}</Box>}</td>
                      <td><strong>{hours(row.totals.overtimeMinutes)}</strong>{overtimeMax && row.totals.overtimeMinutes > 0 && <Box component="span" sx={{ color: color.subtle }}> / {limitHours(overtimeMax)}</Box>}</td>
                      {visible('today') && <Box component="td" sx={{ color: todayLabel ? toneText[todayLabel.tone] : color.subtle, fontWeight: todayLabel?.tone === 'ok' || todayLabel?.tone === 'warn' ? 600 : 400 }}>{todayLabel?.text || '—'}</Box>}
                      {visible('attention') && <td><Flags flags={flags} /></td>}
                    </tr>
                  })}
                </tbody>
              </Box>}
        </Pane>}
    {person && weekStart && <PersonSheet key={person} employeeId={person} weekStart={weekStart} today={today} timeZone={timeZone} row={rows.find(row => row.employeeId === person)}
      siteName={siteName} scheduleOf={scheduleOf} rule={rule} tab={tab} onTab={key => change({ ficha: key === 'semana' ? null : key }, true)} onClose={close} />}
  </>
}


function withPerson(params: URLSearchParams, employeeId: string) {
  const next = new URLSearchParams(params)
  next.set('persona', employeeId); next.delete('ficha')
  return next.toString()
}

function Muted({ children }: { children: React.ReactNode }) { return <Box component="span" sx={{ color: color.subtle }}>{children}</Box> }

/** Hasta dos etiquetas; las incidencias abren Incidencias en su semana. */
function Flags({ flags }: { flags: ReturnType<typeof attentionFlags> }) {
  if (!flags.length) return <Muted>—</Muted>
  return <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
    {flags.slice(0, 2).map(flag => <Badge key={`${flag.label}-${flag.incidentId || ''}`} tone={flag.tone}
      to={flag.incidentId ? `/incidencias?incidencia=${flag.incidentId}` : undefined}>{flag.label}</Badge>)}
    {flags.length > 2 && <Box component="span" sx={{ fontSize: 12, color: color.muted }} title={flags.slice(2).map(flag => flag.label).join(', ')}>+{flags.length - 2}</Box>}
  </Stack>
}

function ColumnsMenu({ columns, onToggle }: { columns: Column[]; onToggle: (column: Column) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return <>
    <IconButton icon="columns" label="Elegir columnas" aria-haspopup="menu" aria-expanded={anchor ? 'true' : undefined} onClick={event => setAnchor(event.currentTarget)} />
    <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ list: { 'aria-label': 'Columnas visibles' } }}>
      {(Object.keys(columnNames) as Column[]).map(column => <MenuItem key={column} role="menuitemcheckbox" aria-checked={columns.includes(column)} onClick={() => onToggle(column)} sx={{ minHeight: 44, fontSize: 14, gap: 1 }}>
        <Box aria-hidden="true" sx={{ width: 18, height: 18, flex: 'none', borderRadius: '5px', border: `1.5px solid ${columns.includes(column) ? color.link : color.field}`, background: columns.includes(column) ? color.link : color.white, color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {columns.includes(column) && <Icon name="check" size={14} strokeWidth={2.4} />}
        </Box>{columnNames[column]}
      </MenuItem>)}
    </Menu>
  </>
}

function ListError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const text = error.status === 403 ? 'Tu rol ya no puede consultar la asistencia de la empresa. Vuelve a entrar para actualizar tu acceso.'
    : error.status === 422 ? `La consulta no es válida: ${error.message}` : `No pudimos cargar la semana. ${error.message}`
  return <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{text}{error.correlationId && <> Referencia: <Box component="code" sx={{ fontFamily: 'monospace' }}>{error.correlationId}</Box>.</>}</Note>
    {error.status !== 403 && <Button variant="outlined" onClick={onRetry}>Reintentar</Button>}
  </Stack>
}

function Empty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return <Stack spacing={1.5} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{filtered ? 'Nadie coincide con estos filtros' : 'Nadie entra a esta semana'}</Typography>
    <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 420 }}>
      {filtered ? 'Prueba con otra sede, otro filtro o borra la búsqueda.' : 'Entran las personas activas del padrón y quien marcó en la semana. Da de alta a tu personal en Personal y horarios.'}
    </Typography>
    {filtered && <Button variant="outlined" onClick={onClear}>Quitar filtros</Button>}
  </Stack>
}

type PhoneListProps = {
  rows: WeekRow[]; loading: boolean; failure: ApiError | null; onRetry: () => void; siteName: (id: string | null) => string | undefined; timeZone: string; today: string; current: boolean
  scheduleOf: (id: string | null) => Schedule | undefined; ordinaryMax?: number; overtimeMaxDays?: number; weekLine?: string; pager: React.ReactNode; onOpen: (employeeId: string, element: HTMLElement) => void
  filtered: boolean; onClear: () => void
}

/** TEL-07: una tarjeta por persona con su barra de horas. */
function PhoneList({ rows, loading, failure, onRetry, siteName, timeZone, today, current, scheduleOf, ordinaryMax, overtimeMaxDays, weekLine, pager, onOpen, filtered, onClear }: PhoneListProps) {
  if (failure) return <ListError error={failure} onRetry={onRetry} />
  if (loading) return <Typography role="status" sx={{ fontSize: 14, color: color.muted, p: 2 }}>Cargando la semana…</Typography>
  if (!rows.length) return <Box sx={{ background: color.white, borderRadius: '18px', boxShadow: shadow.card }}><Empty filtered={filtered} onClear={onClear} /></Box>
  const max = ordinaryMax || 2880
  return <Box component="section" aria-labelledby="asistencia-lista" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Typography component="h2" id="asistencia-lista" sx={{ fontSize: 13, color: color.muted }}>{weekLine || 'Semana'}</Typography>
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map(row => {
        const flag = attentionFlags(row, overtimeMaxDays)[0]
        const now = current ? todayText(row, timeZone, scheduleOf(row.scheduleId), today) : null
        const ordinary = Math.min(100, (row.totals.ordinaryMinutes / (max * 1.2)) * 100)
        const extra = Math.min(100 - ordinary, (row.totals.overtimeMinutes / (max * 1.2)) * 100)
        return <li key={row.employeeId}>
          <Box component="a" href={`?persona=${row.employeeId}`} onClick={event => { event.preventDefault(); onOpen(row.employeeId, event.currentTarget) }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: '12px 14px', background: color.white, borderRadius: '18px', boxShadow: shadow.card, textDecoration: 'none', color: `${color.ink} !important` }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: 0 }}>
                <Box component="strong" sx={{ display: 'block', fontSize: 15 }}>{row.displayName}</Box>
                <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{[row.externalId, siteName(row.siteId), now?.text.toLowerCase()].filter(Boolean).join(' · ')}</Box>
              </Box>
              {flag && <Badge tone={flag.tone}>{flag.label}</Badge>}
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 12, color: color.muted }}>
              <span>{hours(row.totals.ordinaryMinutes)} ordinarias</span><span>{hours(row.totals.overtimeMinutes)} extra</span>
            </Stack>
            <Box role="img" aria-label={`${hours(row.totals.ordinaryMinutes)} ordinarias y ${hours(row.totals.overtimeMinutes)} extra`} sx={{ display: 'flex', gap: '2px', height: 8, borderRadius: 999, background: color.lineSoft, overflow: 'hidden' }}>
              <Box sx={{ width: `${ordinary}%`, background: color.accent, borderRadius: '999px 0 0 999px' }} />
              {extra > 0 && <Box sx={{ width: `${extra}%`, background: color.overtime, borderRadius: '0 4px 4px 0' }} />}
            </Box>
          </Box>
        </li>
      })}
    </Box>
    <Box sx={{ background: color.white, borderRadius: '18px', boxShadow: shadow.card, fontFamily: font }}>{pager}</Box>
  </Box>
}
