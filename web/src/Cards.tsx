import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, MenuItem, Stack, TextField, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Card, type Me, type Page, permissions } from './api'
import { todayIn } from './attendanceModel'
import { color, phoneQuery } from './design'
import { DevicesHeader, PhoneList } from './Devices'
import { type Picked, PersonPicker, refreshDevices } from './DeviceForms'
import {
  type CardDetail, type CardSummary, cardCount, cardFilters, cardHolder, cardSince, cardStatus, readText, revocable, revocationReasons,
} from './devicesModel'
import { dateInZone } from './incidentModel'
import { problemText } from './personnelData'
import { shortDate } from './personnelModel'
import type { Screen, Section } from './sections'
import { Badge, IconTile, Note, Pager, Pane, SearchBox, SidePanel, SkeletonRows, StatusTabs, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

const pageSize = 25

/**
 * Tarjetas (PAD-11): pestañas por estado con sus cifras, quién tiene cada
 * tarjeta y desde cuándo, y su detalle a un lado con el historial, la última
 * lectura, asignar, reponer y revocar. Estado y búsqueda van al servidor.
 */
export function Cards(props: Props) {
  const { me } = props
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const filter = cardFilters.find(item => item.slug === params.get('estado')) || cardFilters[0]
  const query = params.get('q') || ''
  const selected = params.get('tarjeta')
  const [text, setText] = useState(query)
  const opener = useRef<HTMLElement | null>(null)

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
  for (const status of filter.statuses) listParams.append('status', status)
  if (query) listParams.set('q', query)
  if (cursor) listParams.set('cursor', cursor)
  const list = useQuery({ queryKey: ['cards', 'lista', listParams.toString()], queryFn: () => api<Page<Card>>(`/cards?${listParams}`), retry: false })
  const summary = useQuery({ queryKey: ['card-summary', query], queryFn: () => api<CardSummary>(`/cards/summary${query ? `?${new URLSearchParams({ q: query })}` : ''}`), retry: false })

  const rows = list.data?.items || []
  const total = cardCount(filter, summary.data)
  const start = (cursors.length - 1) * pageSize
  const pageText = rows.length ? `${start + 1}–${start + rows.length}${typeof total === 'number' ? ` de ${total}` : list.data?.nextCursor ? ' y más' : ''}` : ''
  const pager = <Pager text={list.isPending ? '' : pageText} hasPrevious={cursors.length > 1} hasNext={!!list.data?.nextCursor}
    onPrevious={() => setPages({ scope, cursors: cursors.slice(0, -1) })} onNext={() => setPages({ scope, cursors: [...cursors, list.data!.nextCursor!] })} />
  const open = (id: string, element: HTMLElement) => { opener.current = element; change({ tarjeta: id }) }
  const close = () => { change({ tarjeta: null }); setTimeout(() => opener.current?.focus(), 0) }
  const tabLink = (slug: string) => {
    const next = new URLSearchParams(params)
    if (slug === 'todas') next.delete('estado'); else next.set('estado', slug)
    next.delete('tarjeta')
    return `?${next}`
  }

  const failure = list.isError ? <Box sx={{ p: 2 }}><Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
    <Note tone="error">{list.error instanceof ApiError && list.error.status === 403 ? 'Tu rol ya no puede consultar las tarjetas.' : problemText(list.error, 'No pudimos cargar las tarjetas.')}</Note>
    <Button variant="outlined" onClick={() => void list.refetch()}>Reintentar</Button>
  </Stack></Box> : null
  const empty = <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 600 }}>{query ? 'Ninguna tarjeta coincide con la búsqueda' : filter.slug === 'todas' ? 'Todavía no hay tarjetas' : `No hay tarjetas ${filter.label.toLowerCase()}`}</Typography>
    {!query && filter.slug === 'todas' && <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 440 }}>Regístralas en el inventario o prepáralas en una terminal; después se asignan a cada persona.</Typography>}
  </Stack>
  const name = (card: Card) => <Box component={Link} to={`?${withCard(params, card.id)}`} aria-current={card.id === selected ? 'true' : undefined}
    onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); open(card.id, event.currentTarget) }}
    sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>{card.label}</Box>
  const holder = (card: Card) => {
    const who = cardHolder(card, timeZone)
    return who ? <Box component="span" sx={{ color: who.past ? color.muted : undefined }}>{who.text}</Box> : <Box component="span" sx={{ color: color.subtle }}>—</Box>
  }
  const since = (card: Card) => { const value = cardSince(card); return value ? sinceDay(value, timeZone, today) : '—' }

  return <>
    <DevicesHeader {...props} />
    <Stack direction="row" useFlexGap sx={{ flex: 'none', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', [`@media ${phoneQuery}`]: { flexDirection: 'column', alignItems: 'stretch' } }}>
      <Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>
        <StatusTabs label="Estado de las tarjetas" current={filter.slug}
          options={cardFilters.map(item => ({ key: item.slug, to: tabLink(item.slug), label: `${item.label}${typeof cardCount(item, summary.data) === 'number' ? ` · ${cardCount(item, summary.data)}` : ''}` }))} />
      </Box>
      <Box component="form" aria-label="Buscar tarjeta" onSubmit={event => { event.preventDefault(); change({ q: text.trim() || null }, true) }} sx={{ display: 'flex', flex: phone ? 'none' : '0 1 280px' }}>
        <SearchBox name="q" label="Buscar tarjeta" placeholder="Etiqueta o persona" value={text} onChange={setText} grow />
      </Box>
    </Stack>
    {phone ? <PhoneList rows={rows} loading={list.isPending} failure={failure} empty={empty} pager={pager}
      render={card => <>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>{name(card)}<Badge tone={cardStatus(card.status).tone}>{cardStatus(card.status).label}</Badge></Stack>
        <Box component="span" sx={{ fontSize: 13 }}>{holder(card)} <Box component="span" sx={{ color: color.subtle }}>· {since(card)}</Box></Box>
      </>} />
      : <Pane titleId="tarjetas-tabla" title={list.isPending ? 'Cargando tarjetas…' : query ? `Resultados de «${query}»` : filter.label} detail={!list.isPending && typeof total === 'number' ? String(total) : undefined}
        footer={rows.length ? pager : undefined}>
        {list.isPending && <Typography role="status" sx={visuallyHidden}>Cargando tarjetas…</Typography>}
        {failure || (!list.isPending && !rows.length ? empty
          : <Box component="table" sx={tableSx}>
            <thead><tr><th scope="col">Tarjeta</th><th scope="col">Estado</th><th scope="col">Asignada a</th><th scope="col">Desde</th></tr></thead>
            <tbody>
              {list.isPending ? <SkeletonRows columns={4} rows={8} /> : rows.map(card => <tr key={card.id} data-selected={card.id === selected}>
                <td>{name(card)}</td>
                <td><Badge tone={cardStatus(card.status).tone}>{cardStatus(card.status).label}</Badge></td>
                <td>{holder(card)}</td>
                <Box component="td" sx={{ color: color.muted }}>{since(card)}</Box>
              </tr>)}
            </tbody>
          </Box>)}
      </Pane>}
    {selected && <CardSheet key={selected} me={me} cardId={selected} row={rows.find(card => card.id === selected)} today={today} onClose={close} />}
  </>
}

function withCard(params: URLSearchParams, id: string) { const next = new URLSearchParams(params); next.set('tarjeta', id); return next.toString() }

function sinceDay(instant: string, timeZone: string, today: string) {
  const day = dateInZone(instant, timeZone)
  return day === today ? 'hoy' : shortDate(day).replace(` ${today.slice(0, 4)}`, '')
}

type Action = 'asignar' | 'reponer' | 'revocar' | null

/**
 * Detalle de una tarjeta: quién la tiene y desde cuándo, quién la registró,
 * su última lectura y su historial. Una tarjeta que ya tuvo titular no pasa
 * a otra persona: se revoca y se repone con otra del inventario.
 */
function CardSheet({ me, cardId, row, today, onClose }: { me: Me; cardId: string; row?: Card; today: string; onClose: () => void }) {
  const allowed = permissions(me.roles)
  const timeZone = me.tenant!.timeZone
  const detail = useQuery({ queryKey: ['card', cardId], queryFn: () => api<CardDetail>(`/cards/${cardId}`), retry: false })
  const [action, setAction] = useState<Action>(null)
  const card = detail.data
  const title = card?.label || row?.label || 'Tarjeta'
  if (detail.isError) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404
    return <SidePanel title={title} eyebrow="Tarjeta" onClose={onClose}><Note tone="error">{missing ? 'Esta tarjeta no existe.' : problemText(detail.error, 'No pudimos cargar la tarjeta.')}</Note></SidePanel>
  }
  if (!card) return <SidePanel title={title} eyebrow="Tarjeta" onClose={onClose}><Typography role="status" sx={{ fontSize: 14, color: color.muted }}>Cargando la tarjeta…</Typography></SidePanel>

  const status = cardStatus(card.status)
  const holder = card.assignment
  const edit = allowed.editDirectory
  const registered = `${shortDate(dateInZone(card.createdAt!, timeZone))}${card.registeredBy?.name ? ` · ${card.registeredBy.name}` : card.registeredBy?.type === 'device' ? ' · una terminal' : ''}`
  const footer = edit && !action ? <>
    {card.status === 'inventory' && <Button variant="contained" onClick={() => setAction('asignar')}>Asignar</Button>}
    {holder && <Button variant="outlined" onClick={() => setAction('reponer')}>Reponer con otra del inventario</Button>}
    {revocable(card.status) && <Button variant="outlined" color="error" onClick={() => setAction('revocar')}>Revocar</Button>}
  </> : undefined

  return <SidePanel title={card.label} eyebrow="Tarjeta" subtitle={<Badge tone={status.tone}>{status.label}</Badge>} icon={<IconTile icon="card" tone={status.tone === 'ok' ? 'info' : status.tone} />} onClose={onClose} footer={footer}>
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 1, fontSize: 13.5, '& dt': { color: color.muted }, '& dd': { m: 0, fontWeight: 500 } }}>
      <dt>Asignada a</dt><dd>{holder ? `${holder.employeeName} · ${holder.employeeExternalId}` : '—'}</dd>
      <dt>Desde</dt><dd>{holder?.since ? shortDate(dateInZone(holder.since, timeZone)) : '—'}</dd>
      <dt>Registrada</dt><dd>{registered}</dd>
      <dt>Última lectura</dt><dd>{card.lastRead ? `${readText(card.lastRead.observedAt, timeZone, today)} · ${card.lastRead.deviceName}` : 'Todavía no se ha leído'}</dd>
    </Box>
    {action === 'asignar' && <AssignForm card={card} onDone={() => setAction(null)} />}
    {action === 'reponer' && holder && <ReplaceForm card={card} holderName={holder.employeeName || 'la persona'} employeeId={holder.employeeId} onDone={() => setAction(null)} />}
    {action === 'revocar' && <RevokeForm card={card} onDone={() => setAction(null)} />}
    <Box component="section" aria-labelledby={`historial-${card.id}`}>
      <Typography component="h3" id={`historial-${card.id}`} sx={{ fontSize: 13, fontWeight: 700, color: color.subtle, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>Historial</Typography>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {history(card, timeZone).map(item => <Box component="li" key={item.key} sx={{ display: 'flex', flexDirection: 'column', pl: 1.5, borderLeft: `2px solid ${color.line}` }}>
          <Box component="span" sx={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</Box>
          <Box component="span" sx={{ fontSize: 12.5, color: color.muted }}>{item.detail}</Box>
        </Box>)}
      </Box>
    </Box>
  </SidePanel>
}

/** Lo que pasó con la tarjeta, de lo más reciente a lo primero. */
function history(card: CardDetail, timeZone: string) {
  const day = (instant: string) => shortDate(dateInZone(instant, timeZone))
  const items: { key: string; title: string; detail: string }[] = []
  const ended = !['inventory', 'assigned', 'active'].includes(card.status)
  card.assignments.forEach((item, index) => {
    if (item.until) {
      const why = index === 0 && ended ? cardStatus(card.status).label.toLowerCase() : 'terminó'
      items.push({ key: `fin-${item.since}`, title: `Dejó de estar con ${item.employeeName}`, detail: `${day(item.until)} · ${why}` })
    }
    items.push({ key: `asignada-${item.since}`, title: `Asignada a ${item.employeeName}`, detail: `${day(item.since)}${item.replacedCardId ? ' · reemplazó otra tarjeta' : ''}` })
  })
  if (!card.assignments.length && ended) items.push({ key: 'fin', title: cardStatus(card.status).label, detail: day(card.updatedAt!) })
  items.push({ key: 'registrada', title: 'Registrada en inventario', detail: `${day(card.createdAt!)}${card.registeredBy?.name ? ` · ${card.registeredBy.name}` : ''}` })
  return items
}

function FormBox({ label, children }: { label: string; children: ReactNode }) {
  return <Box component="section" aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: '12px 14px', borderRadius: '14px', background: color.selected }}>{children}</Box>
}

function AssignForm({ card, onDone }: { card: CardDetail; onDone: () => void }) {
  const cache = useQueryClient()
  const [person, setPerson] = useState<Picked | null>(null)
  const assign = useMutation({ mutationFn: () => api(`/cards/${card.id}/assignments`, 'POST', { employeeId: person!.id }), onSuccess: () => { refreshDevices(cache); onDone() } })
  return <FormBox label={`Asignar ${card.label}`}>
    <PersonPicker label="Persona sin tarjeta" value={person} onChange={setPerson} withoutCard disabled={assign.isPending} />
    {assign.isError && <Note tone="error">{problemText(assign.error, 'No se pudo asignar la tarjeta.')}</Note>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
      <Button onClick={onDone} disabled={assign.isPending}>Cancelar</Button>
      <Button variant="contained" disabled={!person || assign.isPending} onClick={() => assign.mutate()}>{assign.isPending ? 'Asignando…' : 'Asignar'}</Button>
    </Stack>
  </FormBox>
}

/** Reponer: otra tarjeta del inventario pasa a la misma persona y esta queda reemplazada. */
function ReplaceForm({ card, holderName, employeeId, onDone }: { card: CardDetail; holderName: string; employeeId: string; onDone: () => void }) {
  const cache = useQueryClient()
  const [replacement, setReplacement] = useState('')
  const inventory = useQuery({ queryKey: ['cards', 'inventario'], retry: false, queryFn: () => api<Page<Card>>('/cards?status=inventory&limit=50') })
  const replace = useMutation({ mutationFn: () => api(`/cards/${replacement}/assignments`, 'POST', { employeeId }), onSuccess: () => { refreshDevices(cache); onDone() } })
  const items = inventory.data?.items || []
  return <FormBox label={`Reponer ${card.label}`}>
    <Typography sx={{ fontSize: 13 }}>{holderName} recibe otra tarjeta del inventario; {card.label} queda reemplazada y deja de marcar.</Typography>
    <TextField name="replacementId" label="Tarjeta nueva" select size="small" value={replacement} onChange={event => setReplacement(event.target.value)} disabled={inventory.isPending || replace.isPending}>
      {items.map(item => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
    </TextField>
    {inventory.isSuccess && !items.length && <Note tone="warn">No hay tarjetas en inventario: registra o prepara una primero.</Note>}
    {replace.isError && <Note tone="error">{problemText(replace.error, 'No se pudo reponer la tarjeta.')}</Note>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
      <Button onClick={onDone} disabled={replace.isPending}>Cancelar</Button>
      <Button variant="contained" disabled={!replacement || replace.isPending} onClick={() => replace.mutate()}>{replace.isPending ? 'Reponiendo…' : 'Reponer'}</Button>
    </Stack>
  </FormBox>
}

function RevokeForm({ card, onDone }: { card: CardDetail; onDone: () => void }) {
  const cache = useQueryClient()
  const [reason, setReason] = useState<string>('lost')
  const [note, setNote] = useState('')
  const revoke = useMutation({ mutationFn: () => api(`/cards/${card.id}/revocation`, 'POST', { reason, ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: () => { refreshDevices(cache); onDone() } })
  return <FormBox label={`Revocar ${card.label}`}>
    <TextField name="reason" label="Motivo" select size="small" value={reason} onChange={event => setReason(event.target.value)} disabled={revoke.isPending}>
      {revocationReasons.map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
    </TextField>
    <TextField name="note" label="Nota (opcional)" size="small" value={note} onChange={event => setNote(event.target.value)} disabled={revoke.isPending} slotProps={{ htmlInput: { maxLength: 280 } }} />
    <Note tone="warn">Una tarjeta revocada no vuelve a funcionar; para reponerla asigna otra del inventario.</Note>
    {revoke.isError && <Note tone="error">{problemText(revoke.error, 'No se pudo revocar la tarjeta.')}</Note>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
      <Button onClick={onDone} disabled={revoke.isPending}>Cancelar</Button>
      <Button variant="contained" color="error" disabled={revoke.isPending} onClick={() => revoke.mutate()}>{revoke.isPending ? 'Revocando…' : 'Revocar'}</Button>
    </Stack>
  </FormBox>
}
