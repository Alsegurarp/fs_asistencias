import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Device, type Me, type Page, permissions } from './api'
import { color, phoneQuery, shadow } from './design'
import { ActivatePanel, RegisterCardModal, RevokeDeviceModal } from './DeviceForms'
import {
  type CardSummary, type DeviceSummary, deviceCount, deviceDetail, deviceFilters, deviceModes, deviceName, deviceStatus, silent, sinceText,
} from './devicesModel'
import { problemText, useSites } from './personnelData'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, FilterChip, Note, Pager, Pane, SearchBox, SkeletonRows, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/** `?activar=1` abre el panel para activar un lector; `?registrar=1`, la ventana para registrar una tarjeta. */
export const activateParam = 'activar'
export const registerParam = 'registrar'

/**
 * Encabezado de Dispositivos y tarjetas: el mismo en sus dos pestañas, con
 * los lectores activos y las tarjetas, y «Registrar tarjeta» y «Activar
 * lector» para quien los gestiona. Las ventanas viven en la dirección.
 */
export function DevicesHeader({ me, context, section, screens, screen }: Props) {
  const allowed = permissions(me.roles)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const devices = useQuery({ queryKey: ['device-summary'], queryFn: () => api<DeviceSummary>('/devices/summary'), enabled: allowed.devices, retry: false, staleTime: 30_000 })
  const cards = useQuery({ queryKey: ['card-summary', ''], queryFn: () => api<CardSummary>('/cards/summary'), enabled: allowed.cards, retry: false, staleTime: 30_000 })
  const opener = useRef<HTMLElement | null>(null)
  const open = (key: string, element: HTMLElement) => { opener.current = element; setParams(current => { const next = new URLSearchParams(current); next.set(key, '1'); return next }) }
  const close = (key: string) => {
    setParams(current => { const next = new URLSearchParams(current); next.delete(key); return next }, { replace: true })
    setTimeout(() => opener.current?.focus(), 0)
  }
  const manage = allowed.manageDevices
  return <>
    <PageHeader context={context} section={section} screens={screens} current={screen}
      counts={{ devices: devices.data?.active, cards: cards.data?.total }}
      actions={manage ? <>
        {allowed.editDirectory && <Button variant="outlined" onClick={event => open(registerParam, event.currentTarget)} sx={{ minHeight: 42, px: 2.25 }}>Registrar tarjeta</Button>}
        <Button variant="contained" onClick={event => open(activateParam, event.currentTarget)} sx={{ minHeight: 42, px: 2.5 }}>Activar lector</Button>
      </> : undefined} />
    {manage && params.get(activateParam) && <ActivatePanel me={me} onClose={() => close(activateParam)} />}
    {allowed.editDirectory && params.get(registerParam) && <RegisterCardModal onClose={() => close(registerParam)}
      onRegistered={id => navigate(`/dispositivos/tarjetas?tarjeta=${id}`, { replace: true })} />}
  </>
}

const pageSize = 25

/**
 * Lectores (PAD-02): las terminales de sede y los teléfonos personales con
 * su sede o persona, la versión de la app y su última señal. Las pestañas,
 * sus cifras y la búsqueda van al servidor; revocar pide un motivo.
 */
export function Devices(props: Props) {
  const { me } = props
  const allowed = permissions(me.roles)
  const timeZone = me.tenant!.timeZone
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const filter = deviceFilters.find(item => item.slug === params.get('estado')) || deviceFilters[0]
  const query = params.get('q') || ''
  const [text, setText] = useState(query)
  const [revoking, setRevoking] = useState<Device | null>(null)
  const now = useMemo(() => new Date(), [])
  const sites = useSites()
  const siteName = useMemo(() => { const names = new Map((sites.data || []).map(site => [site.id, site.name])); return (id: string | null) => (id ? names.get(id) : undefined) }, [sites.data])

  const change = (values: Record<string, string | null>, replace = false) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
    return next
  }, { replace })
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
  const listParams = new URLSearchParams({ limit: String(pageSize) })
  for (const status of filter.query.status) listParams.append('status', status)
  if ('silent' in filter.query) listParams.set('silent', 'true')
  if (query) listParams.set('q', query)
  if (cursor) listParams.set('cursor', cursor)
  const list = useQuery({ queryKey: ['devices', listParams.toString()], queryFn: () => api<Page<Device>>(`/devices?${listParams}`), retry: false })
  const summary = useQuery({ queryKey: ['device-summary'], queryFn: () => api<DeviceSummary>('/devices/summary'), retry: false })

  const rows = list.data?.items || []
  const total = deviceCount(filter, summary.data)
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${typeof total === 'number' && !query ? ` de ${total}` : list.data?.nextCursor ? ' y más' : ''}` : ''
  const pager = <Pager text={list.isPending ? '' : pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />
  const where = (device: Device) => device.mode === 'terminal' ? siteName(device.siteId) || 'Sede' : device.employeeName || 'Persona'
  const manage = allowed.manageDevices
  const failure = list.isError ? <Box sx={{ p: 2 }}><Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{list.error instanceof ApiError && list.error.status === 403 ? 'Tu rol ya no puede consultar los lectores.' : problemText(list.error, 'No pudimos cargar los lectores.')}</Note>
    <Button variant="outlined" onClick={() => void list.refetch()}>Reintentar</Button>
  </Stack></Box> : null
  const empty = <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{query ? 'Ningún lector coincide con la búsqueda' : filter.slug === 'activos' ? 'Todavía no hay lectores activos' : filter.slug === 'sin-senal' ? 'Todos los lectores tienen señal' : 'No hay lectores revocados ni reemplazados'}</Typography>
    {!query && filter.slug === 'activos' && <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 440 }}>Activa una terminal de sede o el teléfono de una persona con un código de un solo uso.</Typography>}
  </Stack>

  const filters = <Box component="form" aria-label="Filtros" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }, true) }}
    sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', [`@media ${phoneQuery}`]: { flexDirection: 'column', alignItems: 'stretch' } }}>
    <SearchBox name="q" label="Buscar lector" placeholder="Nombre, modelo o persona" value={text} onChange={setText} grow={phone} />
    <Box role="group" aria-label="Estado" sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: phone ? 0.5 : 0 }}>
      {deviceFilters.map(item => <FilterChip key={item.slug} small={phone} pressed={item.slug === filter.slug} onClick={() => change({ estado: item.slug === 'activos' ? null : item.slug })}>
        {item.label}{typeof deviceCount(item, summary.data) === 'number' && ` · ${deviceCount(item, summary.data)}`}
      </FilterChip>)}
    </Box>
  </Box>

  const signal = (device: Device) => <Box component="span" sx={{ color: silent(device, now) ? color.warnText : undefined, fontWeight: silent(device, now) ? 600 : undefined }}>
    {device.status === 'active' ? sinceText(device.lastSeenAt, now) : deviceStatus(device, now).label}
  </Box>
  const revokeButton = (device: Device) => manage && device.status === 'active'
    ? <Button size="small" color="error" onClick={() => setRevoking(device)} aria-label={`Revocar ${deviceName(device)}`}>Revocar</Button> : null

  return <>
    <DevicesHeader {...props} />
    {filters}
    {phone ? <PhoneList rows={rows} loading={list.isPending} failure={failure} empty={empty} pager={pager}
      render={device => <>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box component="strong" sx={{ display: 'block', fontSize: 15 }}>{deviceName(device)}</Box>
            <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{[deviceModes[device.mode], where(device), `app ${device.appVersion}`].join(' · ')}</Box>
          </Box>
          <Badge tone={deviceStatus(device, now).tone}>{deviceStatus(device, now).label}</Badge>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span>Última señal: {signal(device)}</span>{revokeButton(device)}
        </Stack>
      </>} />
      : <Pane titleId="lectores-tabla" title={list.isPending ? 'Cargando lectores…' : query ? `Resultados de «${query}»` : filter.label}
        detail={!list.isPending && typeof total === 'number' && !query ? String(total) : undefined} footer={rows.length ? pager : undefined}>
        {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando lectores…</Typography>}
        {failure || (!list.isPending && !rows.length ? empty
          : <Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Lector</th><th scope="col">Tipo</th><th scope="col">Sede o persona</th><th scope="col">App</th><th scope="col">Última señal</th>
              {manage && <th scope="col"><Box component="span" sx={visuallyHidden}>Acciones</Box></th>}</tr></thead>
            <tbody>
              {list.isPending ? <SkeletonRows columns={manage ? 6 : 5} rows={6} /> : rows.map(device => <tr key={device.id}>
                <td><Box component="strong" sx={{ display: 'block' }}>{deviceName(device)}</Box><Box component="span" sx={{ fontSize: 12, color: color.subtle }}>{deviceDetail(device, timeZone)}</Box></td>
                <td>{deviceModes[device.mode]}</td>
                <td>{where(device)}</td>
                <Box component="td" sx={{ color: color.muted }}>{device.appVersion}</Box>
                <td>{signal(device)}</td>
                {manage && <Box component="td" sx={{ textAlign: 'right' }}>{revokeButton(device)}</Box>}
              </tr>)}
            </tbody>
          </Box>)}
      </Pane>}
    {manage && <Typography sx={{ flex: 'none', fontSize: 12.5, color: color.muted }}>Revocar es inmediato: el lector deja de autenticarse y ya no puede enviar marcas. Para reemplazarlo, activa otro con un código nuevo.</Typography>}
    {revoking && <RevokeDeviceModal device={revoking} onClose={() => setRevoking(null)} />}
  </>
}

/** En teléfono, una tarjeta por fila. La compartan Lectores y Tarjetas. */
export function PhoneList<T extends { id: string }>({ rows, loading, failure, empty, pager, render }: {
  rows: T[]; loading: boolean; failure: ReactNode; empty: ReactNode; pager: ReactNode; render: (row: T) => ReactNode
}) {
  const card = { background: color.white, borderRadius: '18px', boxShadow: shadow.card } as const
  if (failure) return <Box sx={card}>{failure}</Box>
  if (loading) return <Typography role="status" sx={{ fontSize: 14, color: color.muted, p: 2 }}>Cargando…</Typography>
  if (!rows.length) return <Box sx={card}>{empty}</Box>
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map(row => <Box component="li" key={row.id} sx={{ ...card, p: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0.75 }}>{render(row)}</Box>)}
    </Box>
    <Box sx={card}>{pager}</Box>
  </Box>
}
