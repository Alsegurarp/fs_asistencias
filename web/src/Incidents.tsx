import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Employee, type Me, type Page, type Site } from './api'
import { EntitySelect, ErrorNotice } from './Directory'
import { dateInZone, decisions, eventTypes, incidentTypes, resolutionBody, showTime, zonedInstants, type AttendanceEvent, type Incident, type User, type Week } from './incidentModel'

const severity: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta' }
const status = { open: 'Abierta', resolved: 'Resuelta' }
const adjustmentLabels = { add_event: 'Agregar marcaje', exclude_event: 'Excluir marcaje', retype_event: 'Cambiar tipo de marcaje' }
const locationLabels: Record<string, string> = { inside: 'Dentro de sede', outside: 'Fuera de sede', inconclusive: 'Inconclusa', not_evaluated: 'Sin evaluar' }

export function RecordName({ kind, id, me }: { kind: 'employee' | 'site' | 'user'; id: string | null; me: Me }) {
  const cache = useQueryClient()
  const self = kind === 'user' && id === me.userId
  const canRead = kind !== 'user' || me.roles.includes('admin_empresa')
  const record = useQuery({ queryKey: [kind, id], queryFn: () => api<Employee | Site | User>(`/${kind === 'employee' ? 'employees' : kind === 'site' ? 'sites' : 'users'}/${id}`), enabled: !!id && canRead && !self, retry: false })
  useEffect(() => { if (record.error instanceof ApiError && record.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [record.error, cache])
  if (!id) return <>Sin asignar</>
  if (self) return <>{me.displayName}</>
  if (!canRead) return <>Otra persona de la empresa</>
  if (record.isError) return <><ErrorNotice error={record.error} /><Button onClick={() => void record.refetch()}>Reintentar nombre</Button></>
  if (!record.data) return <>Cargando…</>
  return <>{'name' in record.data ? record.data.name : record.data.displayName}</>
}

export function WeekSummary({ week }: { week: Week }) {
  return <Stack spacing={1}>
    <Alert severity="info">El cálculo es una referencia; los topes de jornada requieren revisión jurídica.</Alert>
    <Typography>Inicio de semana: {week.weekStart} · Zona: {week.timeZone}</Typography>
    <Typography>Trabajo: {week.totals.workedMinutes} min · Descanso: {week.totals.breakMinutes} min · Ordinarios: {week.totals.ordinaryMinutes} min · Extraordinarios: {week.totals.overtimeMinutes} min</Typography>
    {week.closure && <Alert severity={week.closure.status === 'closed' ? 'warning' : 'info'}>{week.closure.status === 'closed' ? 'Semana cerrada: debe reabrirse antes de ajustar.' : 'Semana reabierta.'} Versión {week.closure.version}.</Alert>}
    {week.alerts.map((item, index) => <Alert key={`${item.code}-${index}`} severity={item.severity === 'critical' ? 'error' : item.severity === 'warning' ? 'warning' : 'info'}>{item.message}</Alert>)}
    {week.segments.map(segment => <Typography key={segment.id}>{segment.kind === 'break' ? 'Descanso' : 'Trabajo'}: {showTime(segment.startAt, week.timeZone)} → {segment.endAt ? showTime(segment.endAt, week.timeZone) : 'Sin salida'} · {segment.minutes} min</Typography>)}
    {!week.segments.length && <Typography>No hay tramos para esta semana.</Typography>}
    <Typography>Incidencias abiertas en esta semana: {week.openIncidentIds.length}</Typography>
  </Stack>
}

export type IncidentTarget = { week: string; siteId?: string; incidentId?: string }

export function Incidents({ me, initial }: { me: Me; initial?: IncidentTarget }) {
  const cache = useQueryClient()
  const [filters, setFilters] = useState({ status: 'open', type: '', siteId: initial?.siteId || '', week: initial?.week || '' })
  const [selected, setSelected] = useState<string | null>(initial?.incidentId || null)
  const list = useInfiniteQuery({
    queryKey: ['incidents', filters], initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
      if (pageParam) params.set('cursor', pageParam)
      return api<Page<Incident>>(`/incidents?${params}`)
    },
    getNextPageParam: page => page.nextCursor || undefined, retry: false,
  })
  useEffect(() => {
    if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] })
  }, [list.error, cache])
  const rows = list.data?.pages.flatMap(page => page.items) || []
  const field = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }))
  return <Stack spacing={2}>
    <Typography variant="h5">Incidencias</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField select name="statusFilter" label="Estado" value={filters.status} onChange={event => field('status', event.target.value)}><MenuItem value="">Todos</MenuItem>{Object.entries(status).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField select label="Tipo de incidencia" value={filters.type} onChange={event => field('type', event.target.value)}><MenuItem value="">Todos</MenuItem>{Object.entries(incidentTypes).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <Stack sx={{ minWidth: 180 }}><EntitySelect kind="sites" name="siteId" label="Sede" value={filters.siteId} onChange={value => field('siteId', value)} /></Stack>
      <TextField name="weekFilter" label="Fecha de la semana" type="date" value={filters.week} onChange={event => field('week', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Button onClick={() => setFilters({ status: 'open', type: '', siteId: '', week: '' })}>Restablecer filtros</Button>
    </Stack>
    <ErrorNotice error={list.error} />
    {list.isError && <Button onClick={() => void list.refetch()}>Reintentar incidencias</Button>}
    {list.isPending && <Typography role="status">Cargando incidencias…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">No hay incidencias con estos filtros.</Alert>}
    {!!rows.length && <TableContainer><Table aria-label="Incidencias"><TableHead><TableRow><TableCell>Empleado</TableCell><TableCell>Tipo</TableCell><TableCell>Gravedad</TableCell><TableCell>Sede</TableCell><TableCell>Estado</TableCell><TableCell>Abierta el</TableCell><TableCell>Detalle</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.id}>
        <TableCell><RecordName kind="employee" id={row.employeeId} me={me} /></TableCell><TableCell>{incidentTypes[row.type] || row.type}</TableCell><TableCell>{severity[row.severity] || row.severity}</TableCell>
        <TableCell><RecordName kind="site" id={row.siteId} me={me} /></TableCell><TableCell>{status[row.status]}</TableCell><TableCell>{showTime(row.openedAt, me.tenant!.timeZone)}</TableCell>
        <TableCell><Button onClick={() => setSelected(row.id)}>Ver detalle</Button></TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer>}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más incidencias</Button>}
    {selected && <IncidentDetail key={selected} id={selected} me={me} initialWeek={filters.week} onClose={() => setSelected(null)} />}
  </Stack>
}

function IncidentDetail({ id, me, initialWeek, onClose }: { id: string; me: Me; initialWeek: string; onClose: () => void }) {
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const zone = me.tenant!.timeZone
  const [weekDate, setWeekDate] = useState(initialWeek || dateInZone(new Date().toISOString(), zone))
  const [decision, setDecision] = useState('justified')
  const [kind, setKind] = useState('add_event')
  const [eventType, setEventType] = useState('clock_in')
  const [localTime, setLocalTime] = useState('')
  const [localError, setLocalError] = useState<Error | null>(null)
  const detail = useQuery({ queryKey: ['incident', id], queryFn: () => api<Incident>(`/incidents/${id}`), retry: false })
  const incident = detail.data
  const week = useQuery({ queryKey: ['attendance', incident?.employeeId, weekDate], queryFn: () => api<Week>(`/employees/${incident!.employeeId}/attendance?week=${weekDate}`), enabled: !!incident?.employeeId && !!weekDate, retry: false })
  const marks = useInfiniteQuery({
    queryKey: ['attendance-events', incident?.employeeId, week.data?.weekStart, week.data?.timeZone], initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const start = Date.parse(`${week.data!.weekStart}T00:00:00Z`)
      // Un margen de un día cubre los desplazamientos IANA; se muestran sólo las fechas de la semana del servidor.
      const params = new URLSearchParams({ employeeId: incident!.employeeId!, from: new Date(start - 86_400_000).toISOString(), to: new Date(start + 8 * 86_400_000).toISOString() })
      if (pageParam) params.set('cursor', pageParam)
      return api<Page<AttendanceEvent>>(`/attendance-events?${params}`)
    },
    getNextPageParam: page => page.nextCursor || undefined, enabled: !!week.data && !!incident?.employeeId, retry: false,
  })
  const users = useInfiniteQuery({ queryKey: ['users'], initialPageParam: '', queryFn: ({ pageParam }) => api<Page<User>>(`/users${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: page => page.nextCursor || undefined, enabled: me.roles.includes('admin_empresa') && incident?.status === 'open', retry: false })
  const save = useMutation({
    mutationFn: (body: unknown) => api<Incident>(`/incidents/${id}`, 'PATCH', body),
    onSuccess: async updated => {
      cache.setQueryData(['incident', id], updated)
      await Promise.all([cache.invalidateQueries({ queryKey: ['incidents'] }), cache.invalidateQueries({ queryKey: ['attendance', updated.employeeId] })])
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] })
      if (error instanceof ApiError && error.code === 'incident_already_resolved') {
        void cache.invalidateQueries({ queryKey: ['incident', id] }); void cache.invalidateQueries({ queryKey: ['incidents'] })
      }
      if (error instanceof ApiError && error.code === 'week_closed') void cache.invalidateQueries({ queryKey: ['attendance', incident?.employeeId] })
    },
  })
  useEffect(() => {
    if ([detail.error, week.error, marks.error, users.error].some(error => error instanceof ApiError && error.status === 403)) void cache.invalidateQueries({ queryKey: ['me'] })
  }, [detail.error, week.error, marks.error, users.error, cache])
  const writable = allowed.resolveIncidents && incident?.status === 'open'
  const endDate = week.data ? new Date(Date.parse(`${week.data.weekStart}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10) : ''
  const events = (marks.data?.pages.flatMap(page => page.items) || []).filter(mark => {
    const date = dateInZone(mark.observedAt, week.data!.timeZone)
    return date >= week.data!.weekStart && date < endDate
  })
  const related = events.filter(mark => incident?.eventIds.includes(mark.id))
  const candidates = zonedInstants(localTime, zone)
  const fieldError = (name: string) => save.error instanceof ApiError ? save.error.errors.find(error => error.field === name)?.message : undefined
  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!writable || save.isPending) return
    setLocalError(null)
    try { save.mutate(resolutionBody(new FormData(event.currentTarget))) } catch (error) { setLocalError(error as Error) }
  }
  const assign = (assigneeUserId: string | null) => { if (writable && !save.isPending) { setLocalError(null); save.mutate({ assigneeUserId }) } }
  return <Dialog open fullWidth maxWidth="lg" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="incident-detail-title">
    <DialogTitle id="incident-detail-title">Detalle de incidencia</DialogTitle>
    <DialogContent><Stack spacing={2}>
      {detail.isPending && <Typography role="status">Cargando detalle…</Typography>}
      <ErrorNotice error={detail.error} />{detail.isError && <Button onClick={() => void detail.refetch()}>Reintentar detalle</Button>}
      {incident && <>
        <Typography variant="h6">{incidentTypes[incident.type] || incident.type} · {severity[incident.severity]} · {status[incident.status]}</Typography>
        <Typography component="div">Empleado: <RecordName kind="employee" id={incident.employeeId} me={me} /></Typography>
        <Typography component="div">Sede: <RecordName kind="site" id={incident.siteId} me={me} /></Typography>
        <Typography>Abierta: {showTime(incident.openedAt, zone)}</Typography>
        <Typography component="div">Responsable: <RecordName kind="user" id={incident.assigneeUserId} me={me} /></Typography>
        {incident.resolution && <Alert severity="success">
          {decisions[incident.resolution.decision]}: {incident.resolution.reason}<br />
          Resuelta por <RecordName kind="user" id={incident.resolution.resolvedBy} me={me} /> · {showTime(incident.resolution.resolvedAt, zone)}
          {incident.resolution.adjustment && <div>{adjustmentLabels[incident.resolution.adjustment.kind]}{incident.resolution.adjustment.eventType && ` · ${eventTypes[incident.resolution.adjustment.eventType]}`}{incident.resolution.adjustment.occurredAt && ` · ${showTime(incident.resolution.adjustment.occurredAt, zone)}`}</div>}
        </Alert>}
        {incident.employeeId && <>
          {writable && incident.type === 'missing_pair' && week.data?.segments.some(segment => segment.kind === 'work' && !segment.endAt) && <Alert severity="warning" action={<Button disabled={save.isPending} onClick={() => { setDecision('adjusted'); setKind('add_event'); setEventType('clock_out') }}>Agregar salida faltante</Button>}>
            La jornada tiene una entrada sin salida. Justificar o confirmar la incidencia no completa el tramo: agrega la salida real con fecha, hora y motivo.
          </Alert>}
          <Typography variant="h6">Semana del empleado</Typography>
          <TextField name="weekDate" label="Fecha de la semana a consultar" type="date" value={weekDate} onChange={event => setWeekDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} helperText="Elige una fecha del marcaje; la fecha de apertura puede ser posterior si llegó tarde." />
          <ErrorNotice error={week.error} />{week.isError && <Button onClick={() => void week.refetch()}>Reintentar semana</Button>}
          {week.isFetching && <Typography role="status">Consultando semana…</Typography>}
          {week.data && <WeekSummary week={week.data} />}
          <Typography variant="h6">Marcajes relacionados</Typography>
          <ErrorNotice error={marks.error} />{marks.isError && <Button onClick={() => void marks.refetch()}>Reintentar marcajes</Button>}
          {related.map(mark => <Typography key={mark.id}>{showTime(mark.observedAt, zone)} · {eventTypes[mark.type] || mark.type} · Ubicación: {locationLabels[mark.locationVerdict] || mark.locationVerdict}{mark.accuracyMeters !== null && ` · Precisión: ${mark.accuracyMeters} m`}</Typography>)}
          {marks.isSuccess && !related.length && <Alert severity="info">El marcaje relacionado no aparece en los datos cargados. Consulta otra semana o carga más marcajes.</Alert>}
          {marks.isFetching && <Typography role="status">Cargando marcajes…</Typography>}
          {marks.hasNextPage && <Button disabled={marks.isFetchingNextPage} onClick={() => void marks.fetchNextPage()}>Cargar más marcajes</Button>}
        </>}
        <ErrorNotice error={save.error} /><ErrorNotice error={localError} />
        {save.isSuccess && <Alert severity="success">Incidencia actualizada.</Alert>}
        {save.error instanceof ApiError && save.error.code === 'week_closed' && <Alert severity="warning">Solicita al administrador reabrir la semana antes de aplicar el ajuste. El formulario conserva tus datos.</Alert>}
        {writable && <>
          <Stack direction="row" spacing={1}><Button disabled={save.isPending || incident.assigneeUserId === me.userId} onClick={() => assign(me.userId)}>Asignarme</Button><Button disabled={save.isPending || !incident.assigneeUserId} onClick={() => assign(null)}>Quitar asignación</Button></Stack>
          {me.roles.includes('admin_empresa') && <form onSubmit={event => { event.preventDefault(); assign(String(new FormData(event.currentTarget).get('assigneeUserId')) || null) }}>
            <Stack spacing={1}><TextField key={incident.assigneeUserId || 'unassigned'} select name="assigneeUserId" label="Asignar a" defaultValue={incident.assigneeUserId || ''} disabled={save.isPending}>
              <MenuItem value="">Sin asignar</MenuItem>
              {incident.assigneeUserId && !users.data?.pages.some(page => page.items.some(user => user.id === incident.assigneeUserId && user.status !== 'disabled')) && <MenuItem value={incident.assigneeUserId} disabled>Responsable actual</MenuItem>}
              {users.data?.pages.flatMap(page => page.items).filter(user => user.status !== 'disabled').map(user => <MenuItem key={user.id} value={user.id}>{user.displayName || user.email}</MenuItem>)}
            </TextField><ErrorNotice error={users.error} />{users.isError && <Button onClick={() => void users.refetch()}>Reintentar responsables</Button>}{users.hasNextPage && <Button disabled={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>Cargar más responsables</Button>}
            <Button type="submit" disabled={save.isPending || users.isPending || users.isError}>Guardar responsable</Button></Stack>
          </form>}
          <form onSubmit={resolve}><Stack spacing={2}>
            <Typography variant="h6">Resolver incidencia</Typography>
            <TextField select name="decision" label="Decisión" value={decision} onChange={event => setDecision(event.target.value)} disabled={save.isPending}>{Object.entries(decisions).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
            <TextField name="reason" label="Motivo" multiline required disabled={save.isPending} slotProps={{ htmlInput: { minLength: 10, maxLength: 500 } }} error={!!fieldError('resolution.reason')} helperText={fieldError('resolution.reason') || 'Entre 10 y 500 caracteres.'} />
            {decision === 'adjusted' && <>
              <Alert severity="info">El ajuste conserva el marcaje original y agrega una corrección con tu motivo.</Alert>
              <TextField select name="kind" label="Tipo de ajuste" value={kind} onChange={event => setKind(event.target.value)} disabled={save.isPending}>{Object.entries(adjustmentLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
              {kind !== 'add_event' && <TextField key={weekDate} select name="eventId" label="Marcaje a ajustar" defaultValue="" required disabled={save.isPending} error={!!fieldError('resolution.adjustment.eventId')} helperText={fieldError('resolution.adjustment.eventId')}><MenuItem value="">Selecciona un marcaje</MenuItem>{events.map(mark => <MenuItem key={mark.id} value={mark.id}>{showTime(mark.observedAt, zone)} · {eventTypes[mark.type] || mark.type}</MenuItem>)}</TextField>}
              {kind !== 'exclude_event' && <TextField select name="eventType" label="Tipo de marcaje" value={eventType} onChange={event => setEventType(event.target.value)} disabled={save.isPending}>{Object.entries(eventTypes).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>}
              {kind === 'add_event' && <>
                <TextField autoFocus name="localTime" label={`Fecha y hora (${zone})`} type="datetime-local" value={localTime} onChange={event => setLocalTime(event.target.value)} required disabled={save.isPending} slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 1 } }} error={!!fieldError('resolution.adjustment.occurredAt')} helperText={fieldError('resolution.adjustment.occurredAt')} />
                {localTime && !candidates.length && <Alert severity="error">La fecha u hora no es válida o no existe por un cambio horario.</Alert>}
                {candidates.length > 1 ? <TextField key={localTime} select name="occurredAt" label="La hora se repite: elige la ocurrencia" defaultValue="" required disabled={save.isPending}><MenuItem value="">Selecciona una ocurrencia</MenuItem>{candidates.map((candidate, index) => <MenuItem key={candidate} value={candidate}>{index === 0 ? 'Primera' : 'Segunda'} · {new Intl.DateTimeFormat('es-MX', { timeZone: zone, timeStyle: 'long' }).format(new Date(candidate))}</MenuItem>)}</TextField> : <input type="hidden" name="occurredAt" value={candidates[0] || ''} />}
              </>}
            </>}
            <Button type="submit" variant="contained" disabled={save.isPending || (decision === 'adjusted' && (!incident.employeeId || (kind === 'add_event' && !candidates.length)))}>{save.isPending ? 'Guardando…' : 'Guardar resolución'}</Button>
          </Stack></form>
        </>}
      </>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={save.isPending} onClick={onClose}>Cerrar</Button></DialogActions>
  </Dialog>
}
