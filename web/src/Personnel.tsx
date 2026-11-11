import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Employee, type Me, type Page, permissions } from './api'
import { dayMonth, todayIn } from './attendanceModel'
import { color, phoneQuery, shadow } from './design'
import { EmployeeSheet } from './EmployeeSheet'
import { Icon } from './Icons'
import { useSchedules, useSites } from './personnelData'
import { type EmployeeSummary, personStatus, sources } from './personnelModel'
import { NewPersonModal } from './PersonnelForms'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, FilterChip, Note, Pager, Pane, SearchBox, SelectBox, SkeletonRows, clickRow, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/**
 * Encabezado de Personal y horarios: el mismo en sus pestañas, con las cifras
 * de personas activas y horarios, «Importar CSV» y «Dar de alta» para quien
 * edita el padrón.
 */
export function PersonnelHeader({ me, context, section, screens, screen, onCreate }: Props & { onCreate?: () => void }) {
  const allowed = permissions(me.roles)
  const counts = useQuery({ queryKey: ['employee-summary', 'activas'], queryFn: () => api<EmployeeSummary>('/employees/summary?status=active'), retry: false, staleTime: 30_000 })
  const schedules = useSchedules()
  const [creating, setCreating] = useState(false)
  const create = onCreate || (() => setCreating(true))
  return <>
    <PageHeader context={context} section={section} screens={screens} current={screen}
      counts={{ employees: counts.data?.active, schedules: schedules.data?.length }}
      actions={allowed.editDirectory ? <>
        {allowed.imports && <ButtonLink to="/personal/importaciones?importar=archivo" icon="upload">Importar CSV</ButtonLink>}
        <Button variant="contained" onClick={create} sx={{ minHeight: 42, px: 2.5 }}>Dar de alta</Button>
      </> : undefined} />
    {creating && <NewPersonModal me={me} onClose={() => setCreating(false)} />}
  </>
}

export function ButtonLink({ to, icon, children }: { to: string; icon?: 'upload' | 'people'; children: ReactNode }) {
  return <Box component={Link} to={to} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minHeight: 42, px: 2, borderRadius: 999, border: `1px solid ${color.fieldSoft}`, background: color.white,
    color: `${color.link} !important`, fontSize: 14, fontWeight: 600, textDecoration: 'none', '&:hover': { background: color.hover, borderColor: color.fieldHover } }}>
    {icon && <Icon name={icon} size={18} />}{children}
  </Box>
}

const pageSize = 25
const statusFilters = [
  { slug: 'activas', status: 'active', label: 'Activas' },
  { slug: 'bajas', status: 'inactive', label: 'Dadas de baja' },
  { slug: 'todas', status: '', label: 'Todas' },
] as const

/**
 * Personas (PAD-01, EST-07): el padrón con su sede, horario vigente, tarjeta,
 * origen y estado. Estado, horario, «Sin tarjeta», sede y búsqueda van al
 * servidor y viven en la dirección; la ficha se abre sobre la tabla.
 */
export function Personnel(props: Props) {
  const { me } = props
  const allowed = permissions(me.roles)
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const state = statusFilters.find(item => item.slug === params.get('estado')) || statusFilters[0]
  const scheduleId = params.get('horario') || ''
  const withoutCard = params.get('sin-tarjeta') === '1'
  const siteId = params.get('sede') || ''
  const query = params.get('q') || ''
  const person = params.get('persona')
  const [text, setText] = useState(query)
  const [creating, setCreating] = useState(false)
  const opener = useRef<HTMLElement | null>(null)

  const change = (values: Record<string, string | null>, replace = false) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
      return next
    }, { replace })
  }
  useEffect(() => { setText(query) }, [query])
  useEffect(() => {
    const value = text.trim()
    if (value === query) return
    const timer = setTimeout(() => change({ q: value || null }, true), 300)
    return () => clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const scope = [state.status, scheduleId, withoutCard, siteId, query].join('|')
  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!
  const listParams = new URLSearchParams({ limit: String(pageSize) })
  if (state.status) listParams.set('status', state.status)
  if (scheduleId) listParams.set('scheduleId', scheduleId)
  if (withoutCard) listParams.set('withoutCard', 'true')
  if (siteId) listParams.set('siteId', siteId)
  if (query) listParams.set('q', query)
  if (cursor) listParams.set('cursor', cursor)
  const list = useQuery({ queryKey: ['employees', 'personal', listParams.toString()], queryFn: () => api<Page<Employee>>(`/employees?${listParams}`), retry: false })
  const summaryParams = new URLSearchParams()
  if (state.status) summaryParams.set('status', state.status)
  if (siteId) summaryParams.set('siteId', siteId)
  if (query) summaryParams.set('q', query)
  const summary = useQuery({ queryKey: ['employee-summary', summaryParams.toString()], queryFn: () => api<EmployeeSummary>(`/employees/summary${summaryParams.size ? `?${summaryParams}` : ''}`), retry: false })
  const everyone = useQuery({ queryKey: ['employee-summary', ''], queryFn: () => api<EmployeeSummary>('/employees/summary'), retry: false })
  const schedules = useSchedules()
  const sites = useSites()
  const lastImport = useQuery({ queryKey: ['imports', 'ultima'], enabled: allowed.imports, retry: false, staleTime: 60_000,
    queryFn: () => api<Page<{ fileName: string | null; status: string; createdAt: string }>>('/imports?limit=1') })

  const siteName = useMemo(() => { const names = new Map((sites.data || []).map(site => [site.id, site.name])); return (id: string | null) => (id ? names.get(id) : undefined) }, [sites.data])
  const scheduleName = useMemo(() => { const names = new Map((schedules.data || []).map(item => [item.id, item.name])); return (id: string | null | undefined) => (id ? names.get(id) : undefined) }, [schedules.data])

  const rows = list.data?.items || []
  const filtered = !!(scheduleId || withoutCard || siteId || query || state.slug !== 'activas')
  const total = withoutCard ? summary.data?.withoutCard
    : scheduleId ? summary.data?.bySchedule.find(item => item.scheduleId === scheduleId)?.people
      : summary.data ? (state.status === 'active' ? summary.data.active : state.status === 'inactive' ? summary.data.inactive : summary.data.total) : undefined
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${typeof total === 'number' ? ` de ${total}` : list.data?.nextCursor ? ' y más' : ''}${state.slug === 'activas' ? ' activas' : ''}` : '0'
  const open = (employeeId: string, element: HTMLElement) => { opener.current = element; change({ persona: employeeId }) }
  const close = () => { change({ persona: null }); setTimeout(() => opener.current?.focus(), 0) }
  const clear = () => { setText(''); change({ estado: null, horario: null, 'sin-tarjeta': null, sede: null, q: null }) }
  const pager = <Pager text={list.isPending ? '' : pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />

  const header = <PersonnelHeader {...props} onCreate={() => setCreating(true)} />
  const modal = creating && <NewPersonModal me={me} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); change({ persona: id, estado: null }) }} />
  // EST-07: sin nadie en el padrón no hay tabla que filtrar.
  if (everyone.data?.total === 0) return <>{header}<EmptyRoster canEdit={allowed.editDirectory} canImport={allowed.imports} onCreate={() => setCreating(true)} />{modal}</>

  const failure = list.error instanceof ApiError ? list.error : null
  const filters = <Box component="form" aria-label="Filtros" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }, true) }}
    sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', [`@media ${phoneQuery}`]: { flexDirection: 'column', alignItems: 'stretch', flexWrap: 'nowrap' } }}>
    <Box sx={{ display: phone ? 'flex' : 'contents', gap: 1, flexWrap: 'wrap' }}>
      <SearchBox name="q" label="Buscar por nombre o número" placeholder="Nombre o número" value={text} onChange={setText} grow={phone} />
      {(sites.data?.length || 0) > 1 && <SelectBox name="sede" label="Sede" value={siteId} onChange={value => change({ sede: value || null })}
        options={[{ value: '', label: 'Todas' }, ...(sites.data || []).map(site => ({ value: site.id, label: site.name }))]} />}
      <SelectBox name="estado" label="Estado" value={state.slug} onChange={value => change({ estado: value === 'activas' ? null : value })}
        options={statusFilters.map(item => ({ value: item.slug, label: item.label }))} />
    </Box>
    {!phone && <Box aria-hidden="true" sx={{ width: '1px', height: 24, background: color.fieldSoft, mx: 0.5 }} />}
    <Box sx={{ display: phone ? 'flex' : 'contents', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
      {!!summary.data?.bySchedule.length && <Typography component="span" sx={{ fontSize: 13, color: color.muted, alignSelf: 'center', flex: 'none' }}>Horario:</Typography>}
      {(summary.data?.bySchedule || []).filter(item => item.people > 0 || item.scheduleId === scheduleId).map(item => <FilterChip key={item.scheduleId} small={phone} pressed={scheduleId === item.scheduleId}
        onClick={() => change({ horario: scheduleId === item.scheduleId ? null : item.scheduleId, 'sin-tarjeta': null })}>
        {scheduleName(item.scheduleId) || 'Horario'} · {item.people}
      </FilterChip>)}
      {typeof summary.data?.withoutCard === 'number' && (summary.data.withoutCard > 0 || withoutCard) && <FilterChip small={phone} pressed={withoutCard}
        onClick={() => change({ 'sin-tarjeta': withoutCard ? null : '1', horario: null })}>Sin tarjeta · {summary.data.withoutCard}</FilterChip>}
    </Box>
  </Box>

  const note = lastImport.data?.items[0]
  const footer = <>
    {pager}
    {note && !phone && <Typography sx={{ flex: 'none', p: '0 16px 10px', fontSize: 12, color: color.subtle }}>
      Última importación: {note.fileName || 'archivo sin nombre'} · {note.status === 'applied' ? 'aplicada' : note.status === 'ready' ? 'revisada' : note.status === 'failed' ? 'falló' : 'en revisión'} el {dayMonth(note.createdAt.slice(0, 10))}
    </Typography>}
  </>

  return <>
    {header}
    {filters}
    {phone
      ? <PhoneList rows={rows} loading={list.isPending} failure={failure} onRetry={() => void list.refetch()} siteName={siteName} scheduleName={scheduleName} today={today} onOpen={open} pager={pager} filtered={filtered} onClear={clear} />
      : <Pane titleId="personal-tabla" title={list.isPending ? 'Cargando personas…' : query ? `Resultados de «${query}»` : `${typeof total === 'number' ? total : '…'} ${total === 1 ? 'persona' : 'personas'}`}
          detail={!list.isPending && !query ? (withoutCard ? 'sin tarjeta' : scheduleId ? scheduleName(scheduleId) : state.label.toLowerCase()) : undefined} footer={footer}>
          {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando personas…</Typography>}
          {failure ? <Box sx={{ p: 2 }}><ListError error={failure} onRetry={() => void list.refetch()} /></Box>
            : !list.isPending && !rows.length ? <Empty filtered={filtered} onClear={clear} />
              : <Box component="table" sx={tableSx}>
                <thead><tr>
                  <th scope="col">Persona</th><th scope="col">Sede</th><th scope="col">Horario vigente</th><th scope="col">Tarjeta</th><th scope="col">Origen</th><th scope="col">Estado</th>
                </tr></thead>
                <tbody>
                  {list.isPending ? <SkeletonRows columns={6} /> : rows.map(row => {
                    const status = personStatus(row, today)
                    return <tr key={row.id} data-selected={row.id === person} onClick={clickRow}>
                      <td>
                        <Box component={Link} data-row-link to={`?${withPerson(params, row.id)}`} aria-current={row.id === person ? 'true' : undefined}
                          onClick={event => { event.preventDefault(); open(row.id, event.currentTarget) }}
                          sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>{row.displayName}</Box>
                        {' '}<Box component="span" sx={{ color: color.subtle }}>{row.externalId}</Box>
                      </td>
                      <td>{siteName(row.siteId) || <Muted>Sin sede</Muted>}</td>
                      <Box component="td" sx={{ color: color.muted }}>{scheduleName(row.currentScheduleId) || <Muted>Sin horario</Muted>}</Box>
                      <td>{row.activeCardLabel || (row.activeCardId ? 'Asignada' : <Box component="span" sx={{ color: color.warnText, fontWeight: 600 }}>Sin tarjeta</Box>)}</td>
                      <Box component="td" sx={{ color: color.muted }}>{sources[row.source] || row.source}</Box>
                      <td><Badge tone={status.tone}>{status.label}</Badge></td>
                    </tr>
                  })}
                </tbody>
              </Box>}
        </Pane>}
    {person && <EmployeeSheet key={person} me={me} employeeId={person} row={rows.find(row => row.id === person)} today={today} siteName={siteName} sites={sites.data || []} schedules={schedules.data || []} onClose={close} />}
    {modal}
  </>
}

function withPerson(params: URLSearchParams, id: string) { const next = new URLSearchParams(params); next.set('persona', id); return next.toString() }
function Muted({ children }: { children: ReactNode }) { return <Box component="span" sx={{ color: color.subtle }}>{children}</Box> }

function ListError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const text = error.status === 403 ? 'Tu rol ya no puede consultar el padrón. Vuelve a entrar para actualizar tu acceso.'
    : error.status === 422 ? `La consulta no es válida: ${error.message}` : `No pudimos cargar a las personas. ${error.message}`
  return <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{text}{error.correlationId && <> Referencia: <Box component="code" sx={{ fontFamily: 'monospace' }}>{error.correlationId}</Box>.</>}</Note>
    {error.status !== 403 && <Button variant="outlined" onClick={onRetry}>Reintentar</Button>}
  </Stack>
}

function Empty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return <Stack spacing={1.5} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{filtered ? 'Nadie coincide con estos filtros' : 'No hay personas activas'}</Typography>
    <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 420 }}>{filtered ? 'Prueba con otro horario, otra sede o borra la búsqueda.' : 'Las dadas de baja siguen en «Dadas de baja».'}</Typography>
    {filtered && <Button variant="outlined" onClick={onClear}>Quitar filtros</Button>}
  </Stack>
}

/** EST-07: el padrón todavía vacío. */
function EmptyRoster({ canEdit, canImport, onCreate }: { canEdit: boolean; canImport: boolean; onCreate: () => void }) {
  return <Box component="section" aria-labelledby="padron-vacio" sx={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, p: { xs: 3, md: 6 }, textAlign: 'center', background: color.white, borderRadius: '20px', boxShadow: shadow.table }}>
    <Box aria-hidden="true" sx={{ width: 56, height: 56, borderRadius: '16px', background: color.selected, color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="people" size={28} /></Box>
    <Typography component="h2" id="padron-vacio" sx={{ fontSize: 18, fontWeight: 700 }}>Aún no hay personas en el padrón</Typography>
    <Typography sx={{ fontSize: 14, color: color.muted, maxWidth: 460 }}>Da de alta a tu personal uno por uno o sube el CSV de tu sistema de nómina. Después les asignas horario y tarjeta.</Typography>
    {canEdit && <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
      <Button variant="contained" onClick={onCreate} sx={{ minHeight: 42, px: 2.5 }}>Dar de alta</Button>
      {canImport && <ButtonLink to="/personal/importaciones?importar=archivo">Importar CSV</ButtonLink>}
    </Stack>}
  </Box>
}

type PhoneListProps = {
  rows: Employee[]; loading: boolean; failure: ApiError | null; onRetry: () => void; siteName: (id: string | null) => string | undefined; scheduleName: (id: string | null | undefined) => string | undefined
  today: string; onOpen: (id: string, element: HTMLElement) => void; pager: ReactNode; filtered: boolean; onClear: () => void
}

/** En teléfono, una tarjeta por persona. */
function PhoneList({ rows, loading, failure, onRetry, siteName, scheduleName, today, onOpen, pager, filtered, onClear }: PhoneListProps) {
  if (failure) return <ListError error={failure} onRetry={onRetry} />
  if (loading) return <Typography role="status" sx={{ fontSize: 14, color: color.muted, p: 2 }}>Cargando personas…</Typography>
  if (!rows.length) return <Box sx={{ background: color.white, borderRadius: '18px', boxShadow: shadow.card }}><Empty filtered={filtered} onClear={onClear} /></Box>
  return <Box component="section" aria-label="Personas" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map(row => {
        const status = personStatus(row, today)
        return <li key={row.id}>
          <Box component="a" href={`?persona=${row.id}`} onClick={event => { event.preventDefault(); onOpen(row.id, event.currentTarget) }}
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, p: '12px 14px', background: color.white, borderRadius: '18px', boxShadow: shadow.card, textDecoration: 'none', color: `${color.ink} !important` }}>
            <Box sx={{ minWidth: 0 }}>
              <Box component="strong" sx={{ display: 'block', fontSize: 15 }}>{row.displayName}</Box>
              <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{[row.externalId, siteName(row.siteId), scheduleName(row.currentScheduleId), row.activeCardLabel || 'Sin tarjeta'].filter(Boolean).join(' · ')}</Box>
            </Box>
            <Badge tone={status.tone}>{status.label}</Badge>
          </Box>
        </li>
      })}
    </Box>
    <Box sx={{ background: color.white, borderRadius: '18px', boxShadow: shadow.card }}>{pager}</Box>
  </Box>
}

