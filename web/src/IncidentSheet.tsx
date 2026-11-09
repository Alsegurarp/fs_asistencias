import { type FormEvent, useId, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Stack, Typography } from '@mui/material'
import { api, ApiError, permissions, type Employee, type Me } from './api'
import { type Mark, type PersonWeek, type Schedule, addDays, dayMonth, deviceText, longDate, markEvidence, markTypes, scheduleSummary, shortWeekLabel, timeIn } from './attendanceModel'
import { color, font } from './design'
import { type Incident, dateInZone, resolutionBody, zonedInstants } from './incidentModel'
import { adjustmentText, dayMarks, incidentDay, incidentIcons, incidentTitle, outcomes, severityOf } from './incidentsView'
import { allPages } from './lists'
import { roleLabel } from './sections'
import { Badge, IconTile, Note, SidePanel, toneText } from './ui'

type Assignee = { id: string; displayName: string | null; roles: string[] }
type Props = { id: string; me: Me; today: string; siteName: (id: string | null) => string | undefined; onClose: () => void; onChanged: () => void }

/**
 * Detalle de una incidencia (OPE-03, OPE-06, TEL-02): quién, qué marcas tuvo
 * ese día, a quién está asignada y, para quien puede, el formulario para
 * resolverla. Una resuelta muestra la decisión y su historial.
 */
export function IncidentSheet({ id, me, today, siteName, onClose, onChanged }: Props) {
  const timeZone = me.tenant!.timeZone
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const detail = useQuery({ queryKey: ['incident', id], queryFn: () => api<Incident>(`/incidents/${id}`), retry: false })
  const incident = detail.data
  const day = incident ? incidentDay(incident, timeZone) : undefined
  const employeeId = incident?.employeeId || undefined
  const employee = useQuery({ queryKey: ['employee', employeeId], queryFn: () => api<Employee>(`/employees/${employeeId}`), enabled: !!employeeId, retry: false })
  const schedules = useQuery({ queryKey: ['schedules', 'all'], queryFn: () => allPages<Schedule>('/schedules'), retry: false, staleTime: 60_000 })
  const from = day ? zonedInstants(`${day}T00:00`, timeZone)[0] : undefined
  const until = day ? zonedInstants(`${addDays(day, 1)}T00:00`, timeZone)[0] : undefined
  const marks = useQuery({ queryKey: ['incident-marks', employeeId, day], enabled: !!employeeId && !!from && !!until, retry: false,
    queryFn: () => api<{ items: Mark[] }>(`/attendance-events?${new URLSearchParams({ employeeId: employeeId!, from: from!, to: until!, limit: '200' })}`) })
  const writable = allowed.resolveIncidents && incident?.status === 'open'
  const assignees = useQuery({ queryKey: ['incident-assignees', id], queryFn: () => allPages<Assignee>(`/incidents/${id}/assignees`), enabled: writable, retry: false })

  const refresh = (updated: Incident) => {
    cache.setQueryData(['incident', id], updated)
    onChanged()
    for (const key of ['attendance-weeks', 'attendance-summary', 'employee-week', 'employee-marks']) void cache.invalidateQueries({ queryKey: [key] })
  }
  const assign = useMutation({
    mutationFn: (assigneeUserId: string | null) => api<Incident>(`/incidents/${id}`, 'PATCH', { assigneeUserId }),
    onSuccess: refresh,
    onError: error => { if (error instanceof ApiError && error.code === 'incident_already_resolved') void detail.refetch() },
  })
  const [resolved, setResolved] = useState(false)
  const formId = useId()

  if (!incident) return <SidePanel title={detail.isError ? 'No se pudo abrir' : 'Cargando…'} onClose={onClose}>
    {detail.error instanceof ApiError ? <Note tone="error">{detail.error.status === 404 ? 'Esa incidencia no existe o no está en tus sedes.' : `No pudimos cargarla. ${detail.error.message}`}</Note>
      : <Typography role="status" sx={{ fontSize: 13, color: color.muted }}>Cargando la incidencia…</Typography>}
  </SidePanel>

  const severity = severityOf(incident.severity)
  const schedule = employee.data?.currentScheduleId ? schedules.data?.find(item => item.id === employee.data!.currentScheduleId) : undefined
  const ofDay = dayMarks(marks.data?.items || [], day!, timeZone)
  const week = `/asistencia?${new URLSearchParams({ semana: day!, ...(employeeId ? { persona: employeeId } : {}) })}`
  const weekLink = employeeId ? <Button variant="outlined" component={Link} to={week} sx={{ mr: 'auto' }}>Ver su semana</Button> : null

  if (incident.status === 'resolved') return <SidePanel title={incidentTitle(incident.type)} eyebrow={`${incident.employeeName} · ${longDate(day!)}`} onClose={onClose} footer={weekLink}>
    {resolved && <Note>Listo: la incidencia quedó resuelta.</Note>}
    <Resolution incident={incident} timeZone={timeZone} marks={ofDay.marks} day={day!} />
  </SidePanel>

  return <SidePanel title={incidentTitle(incident.type)} subtitle={`${incident.employeeName} · ${incident.employeeExternalId} · ${longDate(day!)}`}
    icon={<IconTile icon={incidentIcons[incident.type] || 'alert'} tone={severity.tone} />} onClose={onClose}
    footer={writable ? <><Button variant="outlined" onClick={onClose}>Cancelar</Button><SubmitButton formId={formId} /></> : weekLink}>
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px 14px', fontSize: 13, '& dt': { color: color.subtle, fontSize: 12 }, '& dd': { m: '2px 0 0' } }}>
      <div><dt>Severidad</dt><Box component="dd" sx={{ fontWeight: 600, color: toneText[severity.tone] }}>{severity.label}</Box></div>
      <div><dt>Sede</dt><dd>{siteName(incident.siteId) || 'Sin sede'}</dd></div>
      <div><dt>Abierta</dt><dd>{when(incident.openedAt, timeZone, today)} · sistema</dd></div>
      <div><dt>Horario</dt><dd>{schedule ? `${schedule.name} · ${scheduleSummary(schedule)}` : employee.isPending && employeeId ? '…' : 'Sin horario'}</dd></div>
      <Box sx={{ gridColumn: 'span 2' }}><dt id={`${formId}-asignada`}>Asignada a</dt><dd>
        {writable ? <AssigneeSelect labelledBy={`${formId}-asignada`} incident={incident} me={me} options={assignees.data} loading={assignees.isPending} pending={assign.isPending} onChange={value => assign.mutate(value)} />
          : incident.assigneeUserId ? incident.assigneeName || 'Sin nombre' : 'Sin asignar'}
      </dd></Box>
    </Box>
    {assign.error instanceof ApiError && <Note tone="error">{assign.error.code === 'assignee_cannot_resolve' ? 'Esa persona no puede resolver incidencias de esta sede.' : assign.error.code === 'incident_already_resolved' ? 'Otra persona ya la resolvió.' : `No se pudo asignar. ${assign.error.message}`}</Note>}
    {incident.blocksClosure && <Note tone="warn">Bloquea el cierre de la semana de {incident.employeeName}: mientras siga abierta, esa semana no se puede cerrar.</Note>}
    <DayMarks marks={ofDay.marks} missingExit={incident.type === 'missing_pair' && ofDay.missingExit} incident={incident} timeZone={timeZone} siteName={siteName} loading={marks.isPending && !!employeeId}
      week={writable && employeeId ? week : undefined} />
    {writable ? <ResolveForm key={incident.id} formId={formId} incident={incident} day={day!} marks={ofDay.marks} timeZone={timeZone}
      onResolved={updated => { setResolved(true); refresh(updated) }} onConflict={() => void detail.refetch()} />
      : <Note>{allowed.resolveIncidents ? 'Ya está resuelta.' : 'Auditoría consulta; resolver lo hacen Administración, RH y Supervisión.'}</Note>}
  </SidePanel>
}

function when(instant: string, timeZone: string, today: string) {
  const date = dateInZone(instant, timeZone)
  return `${date === today ? 'hoy' : dayMonth(date)} ${timeIn(instant, timeZone)}`
}

function SubmitButton({ formId }: { formId: string }) {
  return <Button type="submit" form={formId} variant="contained" sx={{ color: `${color.white} !important` }}>Guardar resolución</Button>
}

function AssigneeSelect({ labelledBy, incident, me, options, loading, pending, onChange }: {
  labelledBy: string; incident: Incident; me: Me; options?: Assignee[]; loading: boolean; pending: boolean; onChange: (value: string | null) => void
}) {
  const current = incident.assigneeUserId
  const listed = !current || options?.some(option => option.id === current)
  return <Box component="select" aria-labelledby={labelledBy} value={current || ''} disabled={loading || pending} onChange={event => onChange((event.target as HTMLSelectElement).value || null)}
    sx={{ width: '100%', minHeight: 40, px: 1, border: `1px solid ${color.fieldSoft}`, borderRadius: '10px', background: color.white, fontFamily: font, fontSize: 13, color: color.ink }}>
    <option value="">Sin asignar</option>
    {!listed && <option value={current!} disabled>{incident.assigneeName || 'Responsable actual'} (ya no puede resolverla)</option>}
    {(options || []).map(option => <option key={option.id} value={option.id}>
      {option.displayName || 'Sin nombre'}{option.id === me.userId ? ' (yo)' : ''} · {option.roles.map(roleLabel).join(', ')}
    </option>)}
  </Box>
}

function DayMarks({ marks, missingExit, incident, timeZone, siteName, loading, week }: {
  marks: Mark[]; missingExit: boolean; incident: Incident; timeZone: string; siteName: (id: string | null) => string | undefined; loading: boolean; week?: string
}) {
  return <Box sx={{ background: color.rowHover, borderRadius: '14px', p: '12px 14px' }}>
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 1 }}>
      <Typography component="h3" sx={{ fontSize: 13, fontWeight: 600 }}>Marcas del día</Typography>
      {week && <Box component={Link} to={week} sx={{ fontSize: 13, fontWeight: 600 }}>Ver su semana</Box>}
    </Stack>
    {loading ? <Typography role="status" sx={{ fontSize: 13, color: color.muted }}>Cargando las marcas…</Typography>
      : !marks.length && !missingExit ? <Typography sx={{ fontSize: 13, color: color.muted }}>No hay marcas de ese día.</Typography>
        : <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75, fontSize: 13 }}>
          {marks.map(mark => {
            const opened = incident.eventIds.includes(mark.id)
            return <Box component="li" key={mark.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}>
              <Box aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '50%', background: opened ? color.error : color.accent }} />
              <Box component="strong" sx={{ minWidth: 58 }}>{markTypes[mark.type]}</Box>{timeIn(mark.observedAt, timeZone)}
              <Box component="span" sx={{ color: color.muted }}>· {deviceText(mark, siteName)} · {markEvidence(mark).toLowerCase()}{opened ? ' · abrió la incidencia' : ''}</Box>
            </Box>
          })}
          {missingExit && <Box component="li" sx={{ display: 'flex', alignItems: 'center', columnGap: 1 }}>
            <Box aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '50%', border: `2px dashed ${color.error}` }} />
            <Box component="strong" sx={{ minWidth: 58 }}>Salida</Box><Box component="span" sx={{ color: color.error, fontWeight: 600 }}>Sin marca</Box>
          </Box>}
        </Box>}
  </Box>
}

const fieldSx = { minHeight: 40, border: `1px solid ${color.fieldSoft}`, borderRadius: '10px', px: 1, fontFamily: font, fontSize: 13, color: color.ink, background: color.white, width: '100%' } as const
const labelSx = { display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 12, fontWeight: 600, color: color.muted } as const

function ResolveForm({ formId, incident, day, marks, timeZone, onResolved, onConflict }: {
  formId: string; incident: Incident; day: string; marks: Mark[]; timeZone: string; onResolved: (updated: Incident) => void; onConflict: () => void
}) {
  const missingPair = incident.type === 'missing_pair'
  const [decision, setDecision] = useState(missingPair ? 'adjusted' : 'justified')
  const [kind, setKind] = useState('add_event')
  const [eventType, setEventType] = useState(missingPair ? 'clock_out' : 'clock_in')
  const [date, setDate] = useState(day)
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [local, setLocal] = useState<string | null>(null)
  const candidates = date && time ? zonedInstants(`${date}T${time}`, timeZone) : []
  const save = useMutation({
    mutationFn: (body: unknown) => api<Incident>(`/incidents/${incident.id}`, 'PATCH', body),
    onSuccess: onResolved,
    onError: error => { if (error instanceof ApiError && error.code === 'incident_already_resolved') onConflict() },
  })
  const failure = save.error instanceof ApiError ? save.error : null
  const fieldError = (name: string) => failure?.errors.find(error => error.field === name)?.message
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (save.isPending) return
    setLocal(null)
    try { save.mutate(resolutionBody(new FormData(event.currentTarget))) } catch (error) { setLocal((error as Error).message) }
  }
  const choice = (value: string, label: string) => <Box component="label" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, minHeight: 38, borderRadius: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    color: decision === value ? color.deep : color.muted, background: decision === value ? color.white : 'transparent', boxShadow: decision === value ? '0 1px 3px rgba(18,35,63,0.12)' : 'none',
    '&:focus-within': { outline: `2px solid ${color.accent}` } }}>
    <input type="radio" name="decision" value={value} checked={decision === value} onChange={() => setDecision(value)} style={{ accentColor: color.link }} />{label}
  </Box>
  return <Box component="form" id={formId} aria-label="Resolver la incidencia" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0 }}>
      <Box component="legend" sx={{ fontSize: 14, fontWeight: 600, mb: 1 }}>Resolver como</Box>
      <Box sx={{ display: 'flex', gap: '2px', background: color.hover, borderRadius: '12px', p: '3px' }}>
        {choice('justified', 'Justificada')}{choice('confirmed', 'Confirmada')}{choice('adjusted', 'Ajustada')}
      </Box>
    </Box>
    {decision === 'adjusted' && <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'flex-end' }}>
      <Box component="label" sx={{ ...labelSx, flex: '1 1 130px' }}>Ajuste
        <Box component="select" name="kind" value={kind} onChange={event => setKind((event.target as HTMLSelectElement).value)} sx={fieldSx}>
          <option value="add_event">Agregar marca</option><option value="exclude_event">Excluir marca</option><option value="retype_event">Cambiar tipo</option>
        </Box>
      </Box>
      {kind !== 'exclude_event' && <Box component="label" sx={{ ...labelSx, flex: '1 1 110px' }}>Tipo
        <Box component="select" name="eventType" value={eventType} onChange={event => setEventType((event.target as HTMLSelectElement).value)} sx={fieldSx}>
          {Object.entries(markTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Box>
      </Box>}
      {kind === 'add_event' ? <>
        <Box component="label" sx={{ ...labelSx, flex: '1 1 130px' }}>Fecha
          <Box component="input" type="date" name="date" value={date} required onChange={event => setDate((event.target as HTMLInputElement).value)} sx={fieldSx} />
        </Box>
        <Box component="label" sx={{ ...labelSx, flex: '1 1 100px' }}>Hora
          <Box component="input" type="time" name="time" value={time} required onChange={event => setTime((event.target as HTMLInputElement).value)} sx={fieldSx} />
        </Box>
        {candidates.length > 1 ? <Box component="label" sx={{ ...labelSx, flex: '1 1 100%' }}>La hora se repite por el cambio de horario: elige cuál
          <Box component="select" name="occurredAt" defaultValue="" required sx={fieldSx}>
            <option value="">Elige la ocurrencia</option>
            {candidates.map((candidate, index) => <option key={candidate} value={candidate}>{index === 0 ? 'La primera' : 'La segunda'}</option>)}
          </Box>
        </Box> : <input type="hidden" name="occurredAt" value={candidates[0] || ''} />}
        {date && time && !candidates.length && <Box sx={{ flex: '1 1 100%' }}><Note tone="error">Esa hora no existe en ese día por el cambio de horario.</Note></Box>}
      </> : <Box component="label" sx={{ ...labelSx, flex: '2 1 200px' }}>Marca
        <Box component="select" name="eventId" defaultValue={incident.eventIds.find(eventId => marks.some(mark => mark.id === eventId)) || ''} required sx={fieldSx}
          aria-invalid={!!fieldError('resolution.adjustment.eventId')}>
          <option value="">Elige la marca</option>
          {marks.map(mark => <option key={mark.id} value={mark.id}>{markTypes[mark.type]} {timeIn(mark.observedAt, timeZone)}</option>)}
        </Box>
      </Box>}
    </Stack>}
    <Box component="label" sx={{ ...labelSx, fontSize: 14, color: color.ink }}>Motivo
      <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: color.muted }}>Obligatorio, de 10 a 500 caracteres; queda en la bitácora con tu nombre y la hora.</Box>
      <Box component="textarea" name="reason" rows={3} required minLength={10} maxLength={500} value={reason} onChange={event => setReason((event.target as HTMLTextAreaElement).value)}
        aria-invalid={!!fieldError('resolution.reason')} sx={{ ...fieldSx, p: '10px 12px', fontSize: 14, resize: 'vertical', borderColor: fieldError('resolution.reason') ? color.error : color.fieldSoft }} />
      {fieldError('resolution.reason') && <Box component="span" sx={{ color: color.error, fontWeight: 600 }}>{fieldError('resolution.reason')}</Box>}
    </Box>
    {local && <Note tone="error">{local}</Note>}
    {failure && <Note tone={failure.code === 'week_closed' ? 'warn' : 'error'}>
      {failure.code === 'week_closed' ? 'La semana de esta persona ya está cerrada: pide a Administración que la reabra en Cierres. Lo que escribiste sigue aquí.'
        : failure.code === 'incident_already_resolved' ? 'Otra persona ya la resolvió; abajo está lo que decidió.'
          : failure.status === 422 ? 'Revisa los datos marcados.' : `No se pudo guardar. ${failure.message}`}
      {failure.correlationId && <> Referencia: <Box component="code" sx={{ fontFamily: 'monospace' }}>{failure.correlationId}</Box>.</>}
    </Note>}
    {save.isPending && <Typography role="status" sx={{ fontSize: 13, color: color.muted }}>Guardando la resolución…</Typography>}
    <Note>La marca original no se modifica: el ajuste se guarda aparte y la semana se recalcula. Si la semana ya está cerrada, primero se reabre.</Note>
  </Box>
}

/** OPE-06: la decisión, quién la tomó y el historial que guarda la incidencia. */
function Resolution({ incident, timeZone, marks, day }: { incident: Incident; timeZone: string; marks: Mark[]; day: string }) {
  const resolution = incident.resolution!
  const adjusted = resolution.decision === 'adjusted'
  const week = useQuery({ queryKey: ['employee-week', incident.employeeId, day], enabled: adjusted && !!incident.employeeId, retry: false,
    queryFn: () => api<PersonWeek>(`/employees/${incident.employeeId}/attendance?week=${day}`) })
  const at = (instant: string) => `${dayMonth(dateInZone(instant, timeZone))}, ${timeIn(instant, timeZone)}`
  const outcome = (outcomes[resolution.decision] || resolution.decision).toLowerCase()
  const history = [
    { label: 'Abierta', detail: `${at(incident.openedAt)} · sistema` },
    ...(incident.assignedAt ? [{ label: `Asignada a ${incident.assigneeName || 'otra persona'}`, detail: `${at(incident.assignedAt)} · ${incident.assignedByName || 'sin nombre'}` }] : []),
    { label: `Resuelta como ${outcome}`, detail: `${at(resolution.resolvedAt)} · ${resolution.resolvedByName || 'sin nombre'}` },
    ...(adjusted ? [{ label: 'Semana recalculada', detail: `${at(resolution.resolvedAt)} · sistema` }] : []),
  ]
  return <>
    <Box><Badge tone="ok">Resuelta como {outcome}</Badge></Box>
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 13, '& dt': { color: color.subtle }, '& dd': { m: 0 } }}>
      <dt>Resolvió</dt><dd>{resolution.resolvedByName || 'Sin nombre'}, {at(resolution.resolvedAt)}</dd>
      {resolution.adjustment && <><dt>Ajuste</dt><dd>{adjustmentText(resolution.adjustment, timeZone, marks)}</dd></>}
      {adjusted && week.data && <><dt>Semana</dt><dd>{shortWeekLabel(week.data.weekStart)}, {week.data.closure?.status === 'closed' ? 'cerrada después' : 'recalculada'}</dd></>}
    </Box>
    <Box sx={{ background: color.rowHover, borderRadius: '12px', p: '10px 12px', fontSize: 13 }}>Motivo: {resolution.reason}</Box>
    <Typography component="h3" sx={{ fontSize: 13, fontWeight: 600 }}>Historial</Typography>
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25, position: 'relative',
      '&::before': { content: '""', position: 'absolute', left: 4, top: 6, bottom: 6, width: 2, background: color.tile } }}>
      {history.map(item => <Box component="li" key={item.label} sx={{ position: 'relative', pl: 2.75, fontSize: 13 }}>
        <Box aria-hidden="true" sx={{ position: 'absolute', left: 0, top: 4, width: 10, height: 10, borderRadius: '50%', background: color.accent }} />
        <Box sx={{ fontWeight: 600 }}>{item.label}</Box><Box sx={{ color: color.muted, fontSize: 12 }}>{item.detail}</Box>
      </Box>)}
    </Box>
    <Note>La marca original no cambió{adjusted ? '; el ajuste quedó aparte' : ''}. Para cambiar esta resolución después del cierre hay que reabrir la semana.</Note>
    {!incident.employeeId && <Typography sx={{ fontSize: 12, color: color.muted }}>Sin persona del padrón ligada.</Typography>}
  </>
}
