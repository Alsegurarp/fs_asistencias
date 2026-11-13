import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { api, ApiError, type Card, type Employee, type Me, type Page, permissions, type Site } from './api'
import { color } from './design'
import { initials } from './Shell'
import { problemText, refreshPeople } from './personnelData'
import { type Assignment, type ScheduleWithValidity, breakText, dayCells, personStatus, shiftKind, shortDate, sources, validityText } from './personnelModel'
import { AssignScheduleModal } from './PersonnelForms'
import { Badge, Note, SidePanel } from './ui'

type Props = {
  me: Me; employeeId: string; row?: Employee; today: string; siteName: (id: string | null) => string | undefined
  sites: Site[]; schedules: ScheduleWithValidity[]; onClose: () => void
}

/**
 * Ficha de una persona (PAD-01): sus datos, el horario vigente con sus días y
 * los anteriores, su tarjeta y la baja con fecha efectiva. Quien edita el
 * padrón cambia nombre y sede, asigna horario y tarjeta, da de baja y
 * reactiva; Supervisión y Auditoría consultan.
 */
export function EmployeeSheet({ me, employeeId, row, today, siteName, sites, schedules, onClose }: Props) {
  const allowed = permissions(me.roles)
  const cache = useQueryClient()
  const loaded = useQuery({ queryKey: ['employee', employeeId], queryFn: () => api<Employee>(`/employees/${employeeId}`), retry: false })
  const employee = loaded.data || row
  const history = useQuery({ queryKey: ['schedule-assignments', employeeId], queryFn: () => api<{ items: Assignment[] }>(`/employees/${employeeId}/schedule-assignments`), retry: false })
  const [editing, setEditing] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const name = employee?.displayName || 'Persona'

  if (loaded.isError && !row) {
    const missing = loaded.error instanceof ApiError && loaded.error.status === 404
    return <SidePanel title="Persona" onClose={onClose}><Note tone="error">{missing ? 'Esta persona no existe o no está en tus sedes.' : problemText(loaded.error, 'No pudimos cargar a la persona.')}</Note></SidePanel>
  }
  if (!employee) return <SidePanel title="Persona" onClose={onClose}><Typography role="status" sx={{ fontSize: 14, color: color.muted }}>Cargando la persona…</Typography></SidePanel>

  const status = personStatus(employee, today)
  const active = employee.status === 'active'
  const assignments = history.data?.items || []
  const schedule = (id: string) => schedules.find(item => item.id === id)
  const current = assignments.find(item => item.validFrom <= today && (!item.validTo || item.validTo >= today))
  const upcoming = assignments.filter(item => item.validFrom > today).at(-1)
  const previous = assignments.filter(item => item !== current && item !== upcoming && item.validFrom < today)
  const subtitle = [employee.externalId, siteName(employee.siteId) || 'Sin sede', `alta ${shortDate(employee.employmentStart)}`].join(' · ')

  return <SidePanel title={name} subtitle={subtitle} initials={initials(name)} onClose={onClose}>
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
      <Badge tone={status.tone}>{status.label}</Badge>
      <Badge tone="neutral">Origen: {sources[employee.source] || employee.source}</Badge>
      <Box sx={{ flex: 1 }} />
      {allowed.attendance && <SheetLink to={`/asistencia?persona=${employee.id}`}>Ver su asistencia</SheetLink>}
      {allowed.editDirectory && !editing && <Button size="small" variant="outlined" onClick={() => setEditing(true)}>Editar</Button>}
    </Stack>
    {editing && <EditForm employee={employee} sites={sites} onDone={() => { setEditing(false); refreshPeople(cache) }} onCancel={() => setEditing(false)} />}

    <Block title="Horario vigente" action={allowed.editDirectory && active ? <Button size="small" onClick={() => setAssigning(true)}>{current || upcoming ? 'Cambiar desde una fecha' : 'Asignar horario'}</Button> : undefined}>
      {history.isPending ? <Typography role="status" sx={{ fontSize: 13, color: color.muted }}>Cargando sus horarios…</Typography>
        : current && schedule(current.scheduleId) ? <ScheduleCard schedule={schedule(current.scheduleId)!} assignment={current} />
          : <Typography sx={{ fontSize: 13, color: color.muted }}>{active ? 'Sin horario hoy: su semana se calcula sin turno programado.' : 'Sin horario.'}</Typography>}
      {upcoming && <Note>Desde el {shortDate(upcoming.validFrom)}: {schedule(upcoming.scheduleId)?.name || 'otro horario'}.</Note>}
      {previous.length > 0 && <Box component="ul" aria-label="Horarios anteriores" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 12.5, color: color.muted }}>
        {previous.map(item => <li key={item.id}>Antes: {schedule(item.scheduleId)?.name || 'Horario'} · {validityText(item.validFrom, item.validTo)}</li>)}
      </Box>}
    </Block>

    <CardBlock me={me} employee={employee} />

    {allowed.editDirectory && (active ? <Deactivate employee={employee} today={today} onDone={() => refreshPeople(cache)} />
      : <Reactivate employee={employee} onDone={() => refreshPeople(cache)} />)}
    {assigning && <AssignScheduleModal me={me} people={[{ id: employee.id, displayName: employee.displayName, externalId: employee.externalId, currentScheduleId: employee.currentScheduleId || null }]}
      schedules={schedules} today={today} onClose={() => setAssigning(false)} />}
  </SidePanel>
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <Box component="section" aria-label={title} sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: '12px 14px', borderRadius: '14px', border: `1px solid ${color.lineSoft}` }}>
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Typography component="h3" sx={{ fontSize: 14, fontWeight: 600 }}>{title}</Typography>{action}
    </Stack>
    {children}
  </Box>
}

function SheetLink({ to, children }: { to: string; children: ReactNode }) {
  return <Box component={Link} to={to} sx={{ fontSize: 13, fontWeight: 600, color: `${color.link} !important`, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{children}</Box>
}

function ScheduleCard({ schedule, assignment }: { schedule: ScheduleWithValidity; assignment: Assignment }) {
  return <>
    <Typography sx={{ fontSize: 13.5 }}><strong>{schedule.name}</strong> · jornada {shiftKind(schedule.days).toLowerCase()} · comida {breakText(schedule.days).toLowerCase()} · {validityText(assignment.validFrom, assignment.validTo)}</Typography>
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
      {dayCells(schedule).map(cell => <Box key={cell.long} sx={{ textAlign: 'center', p: '6px 2px', borderRadius: '10px', background: cell.working ? color.selected : color.rowHover }}>
        <Box component="dt" sx={{ fontSize: 11, fontWeight: 700, color: color.muted }}><abbr title={cell.long} style={{ textDecoration: 'none' }}>{cell.letter}</abbr></Box>
        <Box component="dd" sx={{ m: 0, fontSize: 12, fontWeight: 600, color: cell.working ? color.deep : color.subtle }}>{cell.text}</Box>
      </Box>)}
    </Box>
  </>
}

function EditForm({ employee, sites, onDone, onCancel }: { employee: Employee; sites: Site[]; onDone: () => void; onCancel: () => void }) {
  const save = useMutation({ mutationFn: (body: object) => api<Employee>(`/employees/${employee.id}`, 'PATCH', body), onSuccess: onDone })
  return <Box component="form" aria-label="Editar persona" noValidate onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    save.mutate({ displayName: String(data.get('displayName') || '').trim(), siteId: String(data.get('siteId') || '') || null })
  }} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: '12px 14px', borderRadius: '14px', background: color.rowHover }}>
    <TextField name="displayName" label="Nombre completo" defaultValue={employee.displayName} required size="small" slotProps={{ htmlInput: { maxLength: 160 } }} />
    <TextField name="siteId" label="Sede" select defaultValue={employee.siteId || ''} size="small">
      <MenuItem value="">Sin sede</MenuItem>
      {sites.filter(site => site.status === 'active' || site.id === employee.siteId).map(site => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
    </TextField>
    {save.isError && <Note tone="error">{problemText(save.error, 'No se pudo guardar.')}</Note>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
      <Button variant="outlined" onClick={onCancel} disabled={save.isPending}>Cancelar</Button>
      <Button variant="contained" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</Button>
    </Stack>
  </Box>
}

/** La tarjeta vigente; quien gestiona tarjetas asigna una del inventario a quien no tiene. */
function CardBlock({ me, employee }: { me: Me; employee: Employee }) {
  const allowed = permissions(me.roles)
  const cache = useQueryClient()
  const [choosing, setChoosing] = useState(false)
  const label = employee.activeCardLabel
  const card = useQuery({ queryKey: ['cards', 'de', employee.id, label], enabled: allowed.cards && !!label, retry: false,
    queryFn: () => api<Page<Card>>(`/cards?${new URLSearchParams({ q: label || '', limit: '5' })}`).then(page => page.items.find(item => item.assignment?.employeeId === employee.id) || null) })
  const inventory = useQuery({ queryKey: ['cards', 'inventario'], enabled: choosing, retry: false, queryFn: () => api<Page<Card>>('/cards?status=inventory&limit=50') })
  const assign = useMutation({ mutationFn: (cardId: string) => api(`/cards/${cardId}/assignments`, 'POST', { employeeId: employee.id }), onSuccess: () => { setChoosing(false); refreshPeople(cache) } })
  const since = card.data?.assignment?.since
  return <Block title={label ? `Tarjeta ${label}` : 'Tarjeta'} action={label && allowed.cards ? <SheetLink to={card.data ? `/dispositivos/tarjetas?tarjeta=${encodeURIComponent(card.data.id)}` : '/dispositivos/tarjetas'}>Ver tarjeta</SheetLink> : undefined}>
    {label ? <Typography sx={{ fontSize: 13, color: color.muted }}>Activa{since ? ` desde el ${shortDate(since.slice(0, 10))}` : ''}.</Typography>
      : <Typography sx={{ fontSize: 13, color: employee.status === 'active' ? color.warnText : color.muted, fontWeight: employee.status === 'active' ? 600 : 400 }}>{employee.status === 'active' ? 'Sin tarjeta: no puede marcar en un lector.' : 'Sin tarjeta.'}</Typography>}
    {!label && employee.status === 'active' && allowed.manageDevices && (!choosing
      ? <Button size="small" variant="outlined" onClick={() => setChoosing(true)} sx={{ alignSelf: 'flex-start' }}>Asignar tarjeta</Button>
      : <Box component="form" aria-label="Asignar tarjeta" onSubmit={event => { event.preventDefault(); const id = String(new FormData(event.currentTarget).get('cardId') || ''); if (id) assign.mutate(id) }}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <TextField name="cardId" label="Tarjeta en inventario" select size="small" defaultValue="" sx={{ minWidth: 200 }} disabled={inventory.isPending}>
            {(inventory.data?.items || []).map(item => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
          </TextField>
          {inventory.data && !inventory.data.items.length && <Typography sx={{ fontSize: 13, color: color.muted }}>No hay tarjetas en inventario: regístralas en Dispositivos y tarjetas.</Typography>}
          <Button size="small" type="submit" variant="contained" disabled={assign.isPending}>Asignar</Button>
          <Button size="small" onClick={() => setChoosing(false)}>Cancelar</Button>
          {assign.isError && <Note tone="error">{problemText(assign.error, 'No se pudo asignar la tarjeta.')}</Note>}
        </Box>)}
  </Block>
}

function Deactivate({ employee, today, onDone }: { employee: Employee; today: string; onDone: () => void }) {
  const [date, setDate] = useState(today)
  const [open, setOpen] = useState(false)
  const save = useMutation({ mutationFn: () => api<Employee>(`/employees/${employee.id}`, 'PATCH', { status: 'inactive', employmentEnd: date }), onSuccess: () => { setOpen(false); onDone() } })
  if (!open) return <Button variant="outlined" color="error" onClick={() => setOpen(true)} sx={{ alignSelf: 'flex-start' }}>Dar de baja</Button>
  const card = employee.activeCardLabel
  return <Block title="Dar de baja">
    <TextField name="employmentEnd" label="Fecha efectiva" type="date" size="small" value={date} onChange={event => setDate(event.target.value)}
      helperText="Hoy o antes, nunca futura" slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }} sx={{ maxWidth: 220 }} />
    <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: color.inkSoft, lineHeight: 1.6 }}>
      <li>{card ? `Revoca la tarjeta ${card} y cierra` : 'Cierra'} su horario desde esa fecha.</li>
      <li>Conserva marcajes, cierres y acuses; nada se borra.</li>
      <li>Si se reactiva, necesitará una tarjeta nueva.</li>
    </Box>
    {save.isError && <Note tone="error">{problemText(save.error, 'No se pudo dar de baja.')}</Note>}
    <Stack direction="row" spacing={1}>
      <Button variant="contained" color="error" onClick={() => save.mutate()} disabled={save.isPending || !date || date > today}>{save.isPending ? 'Guardando…' : 'Confirmar baja'}</Button>
      <Button onClick={() => setOpen(false)} disabled={save.isPending}>Cancelar</Button>
    </Stack>
  </Block>
}

function Reactivate({ employee, onDone }: { employee: Employee; onDone: () => void }) {
  const save = useMutation({ mutationFn: () => api<Employee>(`/employees/${employee.id}`, 'PATCH', { status: 'active', employmentEnd: null }), onSuccess: onDone })
  return <Block title="Dada de baja">
    <Typography sx={{ fontSize: 13, color: color.muted }}>{employee.employmentEnd ? `Baja efectiva el ${shortDate(employee.employmentEnd)}. ` : ''}Al reactivarla vuelve al padrón; necesitará horario y una tarjeta nueva.</Typography>
    {save.isError && <Note tone="error">{problemText(save.error, 'No se pudo reactivar.')}</Note>}
    <Button variant="outlined" onClick={() => save.mutate()} disabled={save.isPending} sx={{ alignSelf: 'flex-start' }}>{save.isPending ? 'Guardando…' : 'Reactivar'}</Button>
  </Block>
}
