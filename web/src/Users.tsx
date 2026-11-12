import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Me, type Page, permissions } from './api'
import { color, glass, phoneQuery, shadow } from './design'
import { PhoneList } from './Devices'
import { Icon, type IconName } from './Icons'
import { problemText, useSites } from './personnelData'
import { initials, PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, FilterChip, Note, Pager, Pane, SearchBox, SkeletonRows, clickRow, tableSx, visuallyHidden } from './ui'
import { AccessPanel, InviteModal, PermissionsModal } from './UserForms'
import { type UserRow, type UserSummary, accountText, dayText, roleCount, roleFilters, rolesOf, scopeText, statusNames } from './usersModel'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/** `?persona=<id>` abre «Editar acceso»; `?invitar=1` y `?permisos=1`, sus ventanas. */
export const personParam = 'persona'
export const inviteParam = 'invitar'
const permissionsParam = 'permisos'
/** Filtros que llegan desde las cifras: `?estado=invitadas` y `?expediente=1`. */
const statusFilters = { invitadas: { status: 'invited', label: 'Invitaciones sin aceptar' }, deshabilitadas: { status: 'disabled', label: 'Deshabilitadas' } } as const

const pageSize = 25

/**
 * Usuarios y roles (EMP-04): quién de la empresa entra al portal, con qué
 * rol, qué alcanza a ver y si su cuenta ya está ligada. Las pestañas, sus
 * cifras y la búsqueda van al servidor. Sólo Administración la abre.
 */
export function Users({ me, context, section, screens, screen }: Props) {
  const timeZone = me.tenant!.timeZone
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const opener = useRef<HTMLElement | null>(null)
  const filter = roleFilters.find(item => item.slug === params.get('rol')) || roleFilters[0]
  const statusKey = params.get('estado') as keyof typeof statusFilters | null
  const status = statusKey && statusKey in statusFilters ? statusFilters[statusKey] : null
  const dossierOnly = params.get('expediente') === '1'
  const query = params.get('q') || ''
  const [text, setText] = useState(query)
  const sites = useSites()
  const siteName = useMemo(() => { const names = new Map((sites.data || []).map(site => [site.id, site.name])); return (id: string) => names.get(id) }, [sites.data])

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

  const scope = `${filter.slug}|${status?.status || ''}|${dossierOnly}|${query}`
  const [pages, setPages] = useState<{ scope: string; cursors: string[] }>({ scope, cursors: [''] })
  const cursors = pages.scope === scope ? pages.cursors : ['']
  const cursor = cursors.at(-1)!
  const listParams = new URLSearchParams({ limit: String(pageSize) })
  if (filter.role) listParams.set('role', filter.role)
  if (status) listParams.set('status', status.status)
  if (dossierOnly) listParams.set('dossierPermission', 'true')
  if (query) listParams.set('q', query)
  if (cursor) listParams.set('cursor', cursor)
  const list = useQuery({ queryKey: ['users', listParams.toString()], queryFn: () => api<Page<UserRow>>(`/users?${listParams}`), retry: false })
  const summaryParams = query ? `?q=${encodeURIComponent(query)}` : ''
  const summary = useQuery({ queryKey: ['user-summary', query], queryFn: () => api<UserSummary>(`/users/summary${summaryParams}`), retry: false })
  // Las cifras de arriba son de toda la empresa, sin la búsqueda.
  const totals = useQuery({ queryKey: ['user-summary', ''], queryFn: () => api<UserSummary>('/users/summary'), retry: false })

  const rows = list.data?.items || []
  const filtered = !!status || dossierOnly
  const total = filtered ? undefined : roleCount(filter, summary.data)
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${typeof total === 'number' ? ` de ${total}` : list.data?.nextCursor ? ' y más' : ''}` : ''
  const pager = <Pager text={list.isPending ? '' : pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />
  const selectedId = params.get(personParam)
  const shownFilters = roleFilters.filter(item => item.role !== 'trabajador' || !!summary.data?.byRole.trabajador || item.slug === filter.slug)

  const failure = list.isError ? <Box sx={{ p: 2 }}><Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{list.error instanceof ApiError && list.error.status === 403 ? 'Tu rol ya no puede administrar los usuarios.' : problemText(list.error, 'No pudimos cargar los usuarios.')}</Note>
    <Button variant="outlined" onClick={() => void list.refetch()}>Reintentar</Button>
  </Stack></Box> : null
  const empty = <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{query ? 'Nadie coincide con la búsqueda' : filtered || filter.role ? 'Nadie en esta vista' : 'Todavía no hay nadie con acceso'}</Typography>
    {!query && !filtered && !filter.role && <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 440 }}>Invita a quien de tu equipo deba entrar al portal y elige su rol.</Typography>}
  </Stack>

  const name = (user: UserRow) => <Box component="a" data-row-link href={`?${personParam}=${user.id}`}
    onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); open(personParam, user.id, event.currentTarget) }}
    sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>
    {user.displayName || user.email}{user.id === me.userId && <Box component="span" sx={{ fontWeight: 400, color: color.muted }}> (tú)</Box>}
  </Box>
  const editButton = (user: UserRow) => <Button size="small" variant="outlined" onClick={event => open(personParam, user.id, event.currentTarget)}
    aria-label={`Editar acceso de ${user.displayName || user.email}`} sx={{ minHeight: 34, borderRadius: 999 }}>Editar acceso</Button>
  const dossier = (user: UserRow) => user.dossierPermission ? 'Sí' : <Box component="span" sx={{ color: color.muted }}>—</Box>

  const filters = <Box component="form" aria-label="Filtros" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }, true) }}
    sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', [`@media ${phoneQuery}`]: { flexDirection: 'column', alignItems: 'stretch' } }}>
    <SearchBox name="q" label="Buscar usuario" placeholder="Nombre o correo" value={text} onChange={setText} grow={phone} />
    <Box role="group" aria-label="Rol" sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: phone ? 0.5 : 0 }}>
      {shownFilters.map(item => <FilterChip key={item.slug} small={phone} pressed={item.slug === filter.slug} onClick={() => change({ rol: item.slug === 'todos' ? null : item.slug })}>
        {item.label}{typeof roleCount(item, summary.data) === 'number' && ` · ${roleCount(item, summary.data)}`}
      </FilterChip>)}
    </Box>
    {status && <FilterChip pressed onClick={() => change({ estado: null })}>{status.label}<Icon name="close" size={14} /></FilterChip>}
    {dossierOnly && <FilterChip pressed onClick={() => change({ expediente: null })}>Pueden descargar el expediente<Icon name="close" size={14} /></FilterChip>}
  </Box>

  const counts = totals.data
  const supervisors = counts?.byRole.supervisor ?? 0
  return <>
    <PageHeader context={context} section={section} screens={screens} current={screen}
      description="quién de tu equipo entra al portal y qué puede hacer"
      actions={<>
        <Button variant="outlined" onClick={event => open(permissionsParam, '1', event.currentTarget)} sx={{ minHeight: 42, px: 2.25 }}>Permisos por rol</Button>
        <Button variant="contained" onClick={event => open(inviteParam, '1', event.currentTarget)} sx={{ minHeight: 42, px: 2.5 }}>Invitar</Button>
      </>} />
    <Box component="section" aria-label="Accesos en cifras" sx={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 1.5,
      [`@media ${phoneQuery}`]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
      <Stat icon="users" value={counts ? counts.active + counts.invited : '…'} label={counts ? `Con acceso · ${counts.active} ${counts.active === 1 ? 'activa' : 'activas'}` : 'Con acceso'} to="?" />
      <Stat icon="notice" value={counts?.invited ?? '…'} label={counts?.invited === 1 ? 'Invitación sin aceptar' : 'Invitaciones sin aceptar'} to="?estado=invitadas" />
      <Stat icon="location" value={counts ? `${supervisors - counts.supervisorsWithoutSites} de ${supervisors}` : '…'} label="Supervisión con sedes" to="?rol=supervision"
        tone={counts?.supervisorsWithoutSites ? 'warn' : undefined} />
      <Stat icon="reports" value={counts?.dossierPermission ?? '…'} label="Pueden descargar el expediente" to="?expediente=1" />
    </Box>
    {filters}
    {phone ? <PhoneList rows={rows} loading={list.isPending} failure={failure} empty={empty} pager={pager}
      render={user => <>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: 15 }}>{name(user)}</Box>
            <Box component="span" sx={{ fontSize: 12, color: color.muted, overflowWrap: 'anywhere' }}>{user.email}</Box>
          </Box>
          <Badge tone={statusNames[user.status].tone}>{statusNames[user.status].label}</Badge>
        </Stack>
        <Typography sx={{ fontSize: 13, color: color.muted }}>{rolesOf(user)} · {scopeText(user, siteName)} · {accountText(user)}{user.dossierPermission ? ' · expediente' : ''}</Typography>
      </>} />
      : <Pane titleId="usuarios-tabla" title={list.isPending ? 'Cargando usuarios…' : query ? `Resultados de «${query}»` : status?.label || (dossierOnly ? 'Pueden descargar el expediente' : filter.role ? filter.label : 'Todas las personas con acceso')}
        detail={!list.isPending && typeof total === 'number' ? String(total) : undefined} footer={rows.length ? pager : undefined}>
        {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando usuarios…</Typography>}
        {failure || (!list.isPending && !rows.length ? empty
          : <Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Persona</th><th scope="col">Rol</th><th scope="col">Alcance</th><th scope="col">Estado</th><th scope="col">Invitada</th>
              <th scope="col">Cuenta</th><th scope="col">Expediente</th><th scope="col"><Box component="span" sx={visuallyHidden}>Acciones</Box></th></tr></thead>
            <tbody>
              {list.isPending ? <SkeletonRows columns={8} rows={6} /> : rows.map(user => <tr key={user.id} data-selected={user.id === selectedId} onClick={clickRow}>
                <td><Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                  <Avatar name={user.displayName || user.email} />
                  <Box sx={{ minWidth: 0 }}>{name(user)}<Box component="span" sx={{ display: 'block', fontSize: 12, color: color.subtle }}>{user.email}</Box></Box>
                </Stack></td>
                <td>{rolesOf(user)}</td>
                <Box component="td" sx={{ color: color.muted }}>{scopeText(user, siteName)}</Box>
                <td><Badge tone={statusNames[user.status].tone}>{statusNames[user.status].label}</Badge></td>
                <Box component="td" sx={{ color: color.muted }}>{dayText(user.createdAt, timeZone)}</Box>
                <Box component="td" sx={{ color: color.muted }}>{accountText(user)}</Box>
                <td>{dossier(user)}</td>
                <Box component="td" sx={{ textAlign: 'right' }}>{editButton(user)}</Box>
              </tr>)}
            </tbody>
          </Box>)}
      </Pane>}
    <Typography sx={{ flex: 'none', fontSize: 12.5, color: color.muted }}>Invitar no envía correo: la persona entra al portal con ese correo verificado, su contraseña y su segundo factor, y su cuenta queda ligada la primera vez.</Typography>

    {selectedId && <AccessPanel key={selectedId} id={selectedId} initial={rows.find(user => user.id === selectedId)} me={me} sites={sites.data || []} onClose={() => close(personParam)} />}
    {params.get(inviteParam) && <InviteModal me={me} sites={sites.data || []} onClose={() => close(inviteParam)} onInvited={id => change({ [inviteParam]: null, [personParam]: id }, true)} />}
    {params.get(permissionsParam) && <PermissionsModal onClose={() => close(permissionsParam)} />}
  </>
}

function Avatar({ name }: { name: string }) {
  return <Box aria-hidden="true" sx={{ width: 34, height: 34, flex: 'none', borderRadius: '50%', background: 'linear-gradient(145deg, #EEF4FE 0%, #DCE7FC 100%)', color: color.deep, fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(name)}</Box>
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
