import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Me, type Page } from './api'
import { todayIn } from './attendanceModel'
import { color, glass, phoneQuery, shadow } from './design'
import { PhoneList } from './Devices'
import { Icon, type IconName } from './Icons'
import { problemText } from './personnelData'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { breakNames, shortDay, weekDayNames } from './settingsModel'
import { Badge, FilterChip, Note, Pager, Pane, SearchBox, SkeletonRows, clickRow, tableSx, visuallyHidden } from './ui'
import { InviteAdministratorModal, NewTenantModal, SuspendModal, type TenantAction, TenantMealModal, TenantPanel, UnlinkAdministratorModal } from './TenantForms'
import { type OperatedTenant, type TenantSummary, type UsageItem, type UsageSummary, administrationNames, administrationText, consoleZone, count, currentMonth, dayOf, monthName, statusNames, tenantFilters, zoneName } from './tenantsModel'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/** `?empresa=<id>` abre su ficha; `?alta=1`, la ventana de alta; `?accion=`, una acción sobre la empresa abierta. */
const tenantParam = 'empresa'
const newParam = 'alta'
const actionParam = 'accion'
export const usagePath = '/empresas/uso'
const pageSize = 25

/**
 * Empresas (CON-01): las que usan Zenit, con su estado, su configuración y
 * quién las administra. La búsqueda, las vistas y sus cifras van al servidor.
 * Sólo quien opera el servicio la abre, y nunca ve datos de las personas.
 */
export function Tenants({ me, context, section, screens, screen }: Props) {
  const allowed = me.roles.includes('operador_saas')
  const phone = useMediaQuery(phoneQuery)
  const cache = useQueryClient()
  const [params, setParams] = useSearchParams()
  const opener = useRef<HTMLElement | null>(null)
  const filter = tenantFilters.find(item => item.slug === params.get('vista')) || tenantFilters[0]
  const query = params.get('q') || ''
  const [text, setText] = useState(query)
  const month = currentMonth(consoleZone)

  const change = (values: Record<string, string | null>, replace = false) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
    return next
  }, { replace })
  const open = (key: string, value: string, element?: HTMLElement) => { if (element) opener.current = element; change({ [key]: value }) }
  const close = (key: string) => { change({ [key]: null }, true); setTimeout(() => opener.current?.focus(), 0) }
  useEffect(() => { setText(query) }, [query])
  useEffect(() => {
    const value = text.trim()
    if (value === query) return
    const timer = setTimeout(() => change({ q: value || null }, true), 300)
    return () => clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const scope = `${filter.slug}|${query}`
  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!
  const listParams = new URLSearchParams({ limit: String(pageSize), ...filter.params })
  if (query) listParams.set('q', query)
  if (cursor) listParams.set('cursor', cursor)
  const list = useQuery({ queryKey: ['tenants', listParams.toString()], enabled: allowed, retry: false, queryFn: () => api<Page<OperatedTenant>>(`/tenants?${listParams}`) })
  const summary = useQuery({ queryKey: ['tenant-summary', query], enabled: allowed, retry: false, queryFn: () => api<TenantSummary>(`/tenants/summary${query ? `?q=${encodeURIComponent(query)}` : ''}`) })
  // Las cifras de arriba son de todo el servicio, sin la búsqueda.
  const totals = useQuery({ queryKey: ['tenant-summary', ''], enabled: allowed, retry: false, queryFn: () => api<TenantSummary>('/tenants/summary') })
  const monthTotals = useQuery({ queryKey: ['tenant-usage', 'summary', month, '', ''], enabled: allowed, retry: false, queryFn: () => api<UsageSummary>(`/tenants/usage/summary?month=${month}`) })
  // El uso del mes pagina igual que la lista mientras no se filtre por administración: misma página, mismas empresas.
  const withUsage = !filter.params.administration
  const usageParams = new URLSearchParams({ month, limit: String(pageSize) })
  if (filter.params.status) usageParams.set('status', filter.params.status)
  if (query) usageParams.set('q', query)
  if (cursor) usageParams.set('cursor', cursor)
  const usage = useQuery({ queryKey: ['tenant-usage', 'page', usageParams.toString()], enabled: allowed && withUsage, retry: false, queryFn: () => api<Page<UsageItem>>(`/tenants/usage?${usageParams}`) })
  // Un 403 es que la cuenta dejó de operar el servicio: se vuelve a preguntar quién es.
  useEffect(() => { if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [list.error, cache])

  if (!allowed) return <>
    <PageHeader context={context} section={section} screens={screens} current={screen} />
    <Note>Sólo quien opera el servicio puede gestionar empresas.</Note>
  </>

  const rows = list.data?.items || []
  const marked = new Map((usage.data?.items || []).map(item => [item.id, item.usage.employeesWithAttendance]))
  const total = summary.data ? filter.count(summary.data) : undefined
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${typeof total === 'number' ? ` de ${total}` : ''} · ${monthName(month)} en curso` : ''
  const pager = <Pager text={list.isPending ? '' : pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />
  const selected = rows.find(tenant => tenant.id === params.get(tenantParam))
  const action = params.get(actionParam) as TenantAction | null
  const shownFilters = tenantFilters.filter(item => item.always || item.slug === filter.slug || (summary.data && item.count(summary.data) > 0))

  const failure = list.isError ? <Box sx={{ p: 2 }}><Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{list.error instanceof ApiError && list.error.status === 403 ? 'Tu cuenta ya no opera el servicio.' : problemText(list.error, 'No pudimos cargar las empresas.')}</Note>
    <Button variant="outlined" onClick={() => void list.refetch()}>Reintentar</Button>
  </Stack></Box> : null
  const empty = <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{query ? 'Ninguna empresa coincide con la búsqueda' : filter.slug !== 'todas' ? 'Ninguna empresa en esta vista' : 'Todavía no hay empresas'}</Typography>
    {!query && filter.slug === 'todas' && <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 440 }}>Da de alta la primera y deja invitada a quien la administrará.</Typography>}
  </Stack>

  const name = (tenant: OperatedTenant) => <Box component="a" data-row-link href={`?${tenantParam}=${tenant.id}`}
    onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); open(tenantParam, tenant.id, event.currentTarget) }}
    sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>{tenant.name}</Box>
  const status = (tenant: OperatedTenant) => <Badge tone={statusNames[tenant.status]?.tone || 'neutral'}>{statusNames[tenant.status]?.label || tenant.status}</Badge>
  const scheduled = (tenant: OperatedTenant) => tenant.breakPolicyChange
    ? <Badge tone="warn">{breakNames[tenant.breakPolicyChange.breakPolicy]} desde {shortDay(tenant.breakPolicyChange.effectiveOn)}</Badge>
    : <Box component="span" sx={{ color: color.subtle }}>—</Box>
  const clip = { maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' } as const

  const filters = <Box component="form" aria-label="Filtros" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }, true) }}
    sx={{ flex: 'none', minWidth: 0, maxWidth: '100%', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', [`@media ${phoneQuery}`]: { flexDirection: 'column', alignItems: 'stretch', flexWrap: 'nowrap' } }}>
    <SearchBox name="q" label="Buscar empresas" placeholder="Nombre o identificador" value={text} onChange={setText} grow={phone} />
    <Box role="group" aria-label="Vista" sx={{ display: 'flex', gap: 0.75, minWidth: 0, maxWidth: '100%', overflowX: 'auto', pb: phone ? 0.5 : 0 }}>
      {shownFilters.map(item => <FilterChip key={item.slug} small={phone} pressed={item.slug === filter.slug} onClick={() => change({ vista: item.slug === 'todas' ? null : item.slug })}>
        {item.label}{summary.data && ` · ${item.count(summary.data)}`}
      </FilterChip>)}
    </Box>
  </Box>

  const counts = totals.data
  return <>
    <PageHeader context={context} section={section} screens={screens} current={screen}
      actions={<Button variant="contained" onClick={event => open(newParam, '1', event.currentTarget)} sx={{ minHeight: 42, px: 2.5 }}>Dar de alta una empresa</Button>} />
    <Box component="section" aria-label="El servicio en cifras" sx={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 1.5,
      [`@media ${phoneQuery}`]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
      <Stat icon="building" value={counts?.active ?? '…'} label={counts?.active === 1 ? 'empresa activa' : 'empresas activas'} to="?vista=activas" />
      <Stat icon="pause" value={counts?.suspended ?? '…'} label={counts?.suspended === 1 ? 'suspendida' : 'suspendidas'} to="?vista=suspendidas" tone={counts?.suspended ? 'warn' : undefined} />
      <Stat icon="person" value={monthTotals.data ? count(monthTotals.data.employeesWithAttendance) : '…'} label={`personas marcaron en ${monthName(month)}`} to={usagePath} />
      <Stat icon="devices" value={monthTotals.data ? count(monthTotals.data.devicesActive) : '…'} label="lectores activos" to={usagePath} />
    </Box>
    {filters}
    {phone ? <PhoneList rows={rows} loading={list.isPending} failure={failure} empty={empty} pager={pager}
      render={tenant => <>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: 15, overflowWrap: 'anywhere' }}>{name(tenant)}</Box>
            <Box component="span" sx={{ fontSize: 12, color: color.muted, overflowWrap: 'anywhere' }}>{tenant.slug}</Box>
          </Box>
          {status(tenant)}
        </Stack>
        <Typography sx={{ fontSize: 13, color: color.muted, overflowWrap: 'anywhere' }}>
          {zoneName(tenant.timeZone)} · {weekDayNames[tenant.weekStartsOn].toLowerCase()} · comida: {breakNames[tenant.breakPolicy].toLowerCase()}{marked.has(tenant.id) ? ` · ${count(marked.get(tenant.id)!)} marcaron` : ''}
        </Typography>
        <Typography sx={{ fontSize: 13, color: color.muted, overflowWrap: 'anywhere' }}>Administra: {administrationText(tenant)} · {administrationNames[tenant.administration.state].label.toLowerCase()}</Typography>
      </>} />
      : <Pane titleId="empresas-tabla" title={list.isPending ? 'Cargando empresas…' : query ? `Resultados de «${query}»` : filter.slug === 'todas' ? 'Todas las empresas' : filter.label}
        detail={!list.isPending && typeof total === 'number' ? String(total) : undefined} footer={rows.length ? pager : undefined}>
        {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando empresas…</Typography>}
        {failure || (!list.isPending && !rows.length ? empty
          : <Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Empresa</th><th scope="col">Estado</th><th scope="col">Alta</th><th scope="col">Zona y semana</th><th scope="col">Comida</th><th scope="col">Cambio programado</th>
              <th scope="col">Quién administra</th>{withUsage && <th scope="col">Marcaron en {monthName(month).slice(0, 3)}</th>}<th scope="col"><Box component="span" sx={visuallyHidden}>Acciones</Box></th></tr></thead>
            <tbody>
              {list.isPending ? <SkeletonRows columns={withUsage ? 9 : 8} rows={6} /> : rows.map(tenant => <tr key={tenant.id} data-selected={tenant.id === selected?.id} onClick={clickRow}>
                <Box component="td" sx={clip} title={`${tenant.name} · ${tenant.slug}`}>{name(tenant)}<Box component="span" sx={{ display: 'block', fontSize: 12, color: color.subtle, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenant.slug}</Box></Box>
                <td>{status(tenant)}</td>
                <Box component="td" sx={{ color: color.muted }}>{dayOf(tenant.createdAt, tenant.timeZone)}</Box>
                <td>{zoneName(tenant.timeZone)} · {weekDayNames[tenant.weekStartsOn].toLowerCase()}</td>
                <td>{breakNames[tenant.breakPolicy]}</td>
                <td>{scheduled(tenant)}</td>
                <Box component="td" sx={clip} title={administrationText(tenant)}>
                  <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{administrationText(tenant)}</Box>
                  <Box component="span" sx={{ fontSize: 12, color: tenant.administration.state === 'linked' ? color.subtle : color.warnText }}>{administrationNames[tenant.administration.state].label}</Box>
                </Box>
                {withUsage && <Box component="td" sx={{ fontVariantNumeric: 'tabular-nums' }}>{marked.has(tenant.id) ? count(marked.get(tenant.id)!) : usage.isPending ? '…' : '—'}</Box>}
                <Box component="td" sx={{ textAlign: 'right' }}><Button size="small" variant="outlined" onClick={event => open(tenantParam, tenant.id, event.currentTarget)} aria-label={`Ver ${tenant.name}`} sx={{ minHeight: 34, borderRadius: 999 }}>Ver</Button></Box>
              </tr>)}
            </tbody>
          </Box>)}
      </Pane>}
    <Typography sx={{ flex: 'none', fontSize: 12.5, color: color.muted }}>Tu cuenta opera el servicio: das de alta empresas y dejas invitada a quien las administra. No ves sus datos internos; del uso, sólo conteos.</Typography>

    {selected && <TenantPanel key={selected.id} tenant={selected} usageTo={`${usagePath}?q=${encodeURIComponent(selected.slug)}`}
      onAction={(key, element) => open(actionParam, key, element)} onClose={() => { change({ [tenantParam]: null, [actionParam]: null }, true); setTimeout(() => opener.current?.focus(), 0) }} />}
    {selected && action === 'comida' && <TenantMealModal tenant={selected} today={todayIn(selected.timeZone)} onClose={() => close(actionParam)} />}
    {selected && action === 'soltar' && <UnlinkAdministratorModal tenant={selected} onClose={() => close(actionParam)} />}
    {selected && action === 'invitar' && <InviteAdministratorModal tenant={selected} onClose={() => close(actionParam)} />}
    {selected && action === 'suspender' && <SuspendModal tenant={selected} onClose={() => close(actionParam)} />}
    {params.get(newParam) && <NewTenantModal onClose={() => close(newParam)}
      // La empresa nueva es la más reciente: se busca por su identificador para abrir su ficha.
      onCreated={tenant => setParams(new URLSearchParams({ q: tenant.slug, [tenantParam]: tenant.id }), { replace: true })} />}
  </>
}

function Stat({ icon, value, label, to, tone }: { icon: IconName; value: ReactNode; label: string; to: string; tone?: 'warn' }) {
  return <Box component={Link} to={to} sx={{ ...glass, borderRadius: '20px', boxShadow: shadow.card, p: '14px 16px', display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: `${color.ink} !important`,
    '&:hover': { boxShadow: `0 0 0 1px ${color.fieldHover}, ${shadow.card}` }, [`@media ${phoneQuery}`]: { p: '12px', gap: 1 } }}>
    <Box aria-hidden="true" sx={{ width: 38, height: 38, flex: 'none', borderRadius: '12px', background: 'linear-gradient(145deg, #EEF4FE 0%, #DCE7FC 100%)', color: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
      [`@media ${phoneQuery}`]: { display: 'none' } }}><Icon name={icon} size={18} /></Box>
    <Box sx={{ minWidth: 0 }}>
      <Box component="strong" sx={{ display: 'block', fontSize: 22, fontWeight: 700, color: tone === 'warn' ? color.warnText : color.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
      <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{label}</Box>
    </Box>
  </Box>
}
