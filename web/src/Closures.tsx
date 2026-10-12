import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Employee, type Me, type Page } from './api'
import { EntitySelect, ErrorNotice } from './Directory'
import { RecordName, type IncidentTarget } from './Incidents'
import { dateInZone, showTime } from './incidentModel'
import { closeBody, reopenBody, runBody, runPollInterval, type Closure, type ClosureResult, type ClosureRun } from './closureModel'

const statusLabels = { closed: 'Cerrada', reopened: 'Reabierta', queued: 'En cola', running: 'En curso', done: 'Terminada', failed: 'Fallida' }
const blockedLabels: Record<string, string> = { open_incidents: 'Incidencias abiertas', open_segment: 'Tramo sin salida' }
const failureLabels: Record<string, string> = { job_abandoned: 'El trabajo agotó sus reintentos.', tenant_not_active: 'La empresa está suspendida.' }

export function Closures({ me, onIncidents }: { me: Me; onIncidents: (target: IncidentTarget) => void }) {
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const [week, setWeek] = useState(dateInZone(new Date(Date.now() - 7 * 86_400_000).toISOString(), me.tenant!.timeZone))
  const [employeeId, setEmployee] = useState('')
  const [command, setCommand] = useState<'selected' | 'run' | null>(null)
  const [closureId, setClosure] = useState<string | null>(null)
  const [runId, setRun] = useState<string | null>(null)
  const list = useInfiniteQuery({ queryKey: ['week-closures', week, employeeId], initialPageParam: '', queryFn: ({ pageParam }) => {
    const params = new URLSearchParams({ week })
    if (employeeId) params.set('employeeId', employeeId)
    if (pageParam) params.set('cursor', pageParam)
    return api<Page<Closure>>(`/week-closures?${params}`)
  }, getNextPageParam: page => page.nextCursor || undefined, enabled: !!week, retry: false })
  const runs = useInfiniteQuery({ queryKey: ['closure-runs', week], initialPageParam: '', queryFn: ({ pageParam }) => {
    const params = new URLSearchParams({ week })
    if (pageParam) params.set('cursor', pageParam)
    return api<Page<ClosureRun>>(`/week-closure-runs?${params}`)
  }, getNextPageParam: page => page.nextCursor || undefined, enabled: !!week, retry: false,
    refetchInterval: query => !query.state.error && query.state.data?.pages.some(page => page.items.some(run => runPollInterval(run.status, null))) ? 5000 : false,
  })
  const rows = list.data?.pages.flatMap(page => page.items) || []
  const runRows = runs.data?.pages.flatMap(page => page.items) || []
  const activeRuns = runRows.some(run => runPollInterval(run.status, null))
  const hadActive = useRef(false)
  useEffect(() => {
    if (hadActive.current && !activeRuns) {
      void cache.invalidateQueries({ queryKey: ['week-closures'] })
      void cache.invalidateQueries({ queryKey: ['incidents'] })
      void cache.invalidateQueries({ queryKey: ['attendance'] })
    }
    hadActive.current = activeRuns
  }, [activeRuns, cache])
  useEffect(() => {
    if ([list.error, runs.error].some(error => error instanceof ApiError && error.status === 403)) void cache.invalidateQueries({ queryKey: ['me'] })
  }, [list.error, runs.error, cache])
  return <Stack spacing={2}>
    <Typography variant="h5">Cierres semanales</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField name="closureWeek" label="Fecha de la semana" type="date" value={week} onChange={event => setWeek(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Stack sx={{ minWidth: 220 }}><EntitySelect kind="employees" name="employeeFilter" label="Empleado" value={employeeId} onChange={setEmployee} /></Stack>
      {allowed.closeWeeks && <><Button disabled={!week} variant="contained" onClick={() => setCommand('selected')}>Cerrar empleados</Button><Button disabled={!week} variant="outlined" onClick={() => setCommand('run')}>Cerrar empresa o sede</Button></>}
    </Stack>
    <Typography>Se muestran todas las versiones de la semana; las reabiertas conservan su cálculo original.</Typography>
    <ErrorNotice error={list.error} />{list.isError && <Button onClick={() => void list.refetch()}>Reintentar cierres</Button>}
    {list.isPending && week && <Typography role="status">Cargando cierres…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">No hay cierres para esta consulta.</Alert>}
    {!!rows.length && <TableContainer><Table aria-label="Cierres registrados"><TableHead><TableRow><TableCell>Empleado</TableCell><TableCell>Semana</TableCell><TableCell>Versión</TableCell><TableCell>Estado</TableCell><TableCell>Trabajo</TableCell><TableCell>Cerrado por</TableCell><TableCell>Detalle</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(closure => <TableRow key={closure.id}><TableCell><RecordName kind="employee" id={closure.employeeId} me={me} /></TableCell><TableCell>{closure.weekStart}</TableCell><TableCell>{closure.version}</TableCell><TableCell>{statusLabels[closure.status]}</TableCell><TableCell>{closure.totals.workedMinutes} min</TableCell><TableCell>{closure.closedBy ? <RecordName kind="user" id={closure.closedBy} me={me} /> : 'Cierre programado'}</TableCell><TableCell><Button onClick={() => setClosure(closure.id)}>Ver cierre</Button></TableCell></TableRow>)}</TableBody>
    </Table></TableContainer>}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más cierres</Button>}
    <Typography variant="h6">Corridas de empresa o sede</Typography>
    <ErrorNotice error={runs.error} />{runs.isError && <Button onClick={() => void runs.refetch()}>Reintentar corridas</Button>}
    {runs.isPending && week && <Typography role="status">Cargando corridas…</Typography>}
    {runs.isSuccess && !runRows.length && <Typography>No hay corridas para esta semana.</Typography>}
    {runRows.map(run => <Stack key={run.id} direction={{ xs: 'column', md: 'row' }} spacing={1}>
      <Typography>{run.weekStart} · {run.origin === 'scheduled' ? 'Programada' : 'Solicitada'} · {statusLabels[run.status]} · Cerrados: {run.closed} · Bloqueados: {run.blocked.openIncidents + run.blocked.openSegment}</Typography>
      <Typography component="div">{run.siteId ? <RecordName kind="site" id={run.siteId} me={me} /> : 'Toda la empresa'}</Typography>
      <Button onClick={() => setRun(run.id)}>Ver avance</Button>
    </Stack>)}
    {runs.hasNextPage && <Button disabled={runs.isFetchingNextPage} onClick={() => void runs.fetchNextPage()}>Cargar más corridas</Button>}
    {command && allowed.closeWeeks && <CloseCommand key={command} mode={command} initialWeek={week} me={me} onClose={() => setCommand(null)} onIncidents={onIncidents} onClosure={setClosure} onRun={id => { setCommand(null); setRun(id) }} onWeek={value => { setWeek(value); setEmployee('') }} />}
    {closureId && <ClosureDetail key={closureId} id={closureId} me={me} onClose={() => setClosure(null)} />}
    {runId && <RunDetail key={runId} id={runId} me={me} onClose={() => setRun(null)} onIncidents={onIncidents} onRun={setRun} />}
  </Stack>
}

function CloseCommand({ mode, initialWeek, me, onClose, onIncidents, onClosure, onRun, onWeek }: {
  mode: 'selected' | 'run'; initialWeek: string; me: Me; onClose: () => void; onIncidents: (target: IncidentTarget) => void;
  onClosure: (id: string) => void; onRun: (id: string) => void; onWeek: (week: string) => void;
}) {
  const cache = useQueryClient()
  const [week, setWeek] = useState(initialWeek)
  const [site, setSite] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<ClosureResult | null>(null)
  const employees = useInfiniteQuery({ queryKey: ['employees', 'closure', site], initialPageParam: '', queryFn: ({ pageParam }) => {
    const params = new URLSearchParams()
    if (site) params.set('siteId', site)
    if (pageParam) params.set('cursor', pageParam)
    return api<Page<Employee>>(`/employees?${params}`)
  }, getNextPageParam: page => page.nextCursor || undefined, enabled: mode === 'selected', retry: false })
  const save = useMutation<ClosureResult | ClosureRun, Error, unknown>({ mutationFn: (body: unknown) => mode === 'selected' ? api<ClosureResult>('/week-closures', 'POST', body) : api<ClosureRun>('/week-closure-runs', 'POST', body),
    onSuccess: async data => {
      onWeek(data.weekStart)
      if ('blocked' in data && 'closed' in data && Array.isArray(data.closed)) setResult(data as ClosureResult)
      else onRun((data as ClosureRun).id)
      await Promise.all([cache.invalidateQueries({ queryKey: ['week-closures'] }), cache.invalidateQueries({ queryKey: ['closure-runs'] }), cache.invalidateQueries({ queryKey: ['incidents'] }), cache.invalidateQueries({ queryKey: ['attendance'] })])
    }, onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) },
  })
  useEffect(() => { if (employees.error instanceof ApiError && employees.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [employees.error, cache])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending || !permissions(me.roles).closeWeeks) return
    setError(null)
    try { save.mutate(mode === 'selected' ? closeBody(week, selected) : runBody(week, site)) } catch (error) { setError(error as Error) }
  }
  return <Dialog open fullWidth maxWidth="md" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="close-command-title">
    <form onSubmit={submit}><DialogTitle id="close-command-title">{mode === 'selected' ? 'Cerrar empleados seleccionados' : 'Solicitar corrida de cierre'}</DialogTitle>
      <DialogContent><Stack spacing={2}>
        <Alert severity="info">Cerrar congela el cálculo. Las incidencias abiertas y los tramos sin salida bloquean a cada empleado afectado.</Alert>
        <TextField name="requestWeek" label="Fecha de la semana a cerrar" type="date" value={week} onChange={event => setWeek(event.target.value)} required disabled={save.isPending} slotProps={{ inputLabel: { shrink: true } }} />
        <EntitySelect kind="sites" name="closureSite" label={mode === 'selected' ? 'Filtrar empleados por sede' : 'Alcance de la corrida'} value={site} disabled={save.isPending} onChange={value => { setSite(value); setSelected([]) }} />
        {mode === 'run' ? <Typography>Sin seleccionar sede se cerrará toda la empresa. La corrida conserva lo ya cerrado si falla.</Typography> : <>
          <Typography>Seleccionados: {selected.length} de un máximo de 500.</Typography>
          <ErrorNotice error={employees.error} />{employees.isError && <Button onClick={() => void employees.refetch()}>Reintentar empleados</Button>}
          {employees.isPending && <Typography role="status">Cargando empleados…</Typography>}
          {employees.data?.pages.flatMap(page => page.items).map(employee => <FormControlLabel key={employee.id} label={`${employee.displayName} · ${employee.externalId}${employee.status === 'inactive' ? ' (inactivo)' : ''}`} control={<Checkbox checked={selected.includes(employee.id)} disabled={save.isPending || (!selected.includes(employee.id) && selected.length >= 500)} onChange={(_, checked) => setSelected(current => checked ? [...current, employee.id] : current.filter(id => id !== employee.id))} />} />)}
          {employees.hasNextPage && <Button disabled={employees.isFetchingNextPage || save.isPending} onClick={() => void employees.fetchNextPage()}>Cargar más empleados</Button>}
        </>}
        <ErrorNotice error={save.error} /><ErrorNotice error={error} />
        {result && <>
          <Alert severity={result.blocked.length ? 'warning' : 'success'}>Semana {result.weekStart}: {result.closed.length} cierres vigentes y {result.blocked.length} bloqueados.</Alert>
          {result.closed.map(closure => <Stack key={closure.id} direction="row" spacing={1}><Typography component="div"><RecordName kind="employee" id={closure.employeeId} me={me} /> · Versión {closure.version}</Typography><Button onClick={() => onClosure(closure.id)}>Ver cierre</Button></Stack>)}
          {result.blocked.map(blocked => <Stack key={blocked.employeeId} spacing={1}>
            <Typography component="div"><RecordName kind="employee" id={blocked.employeeId} me={me} /> · {blockedLabels[blocked.reason] || blocked.reason}</Typography>
            {blocked.incidentIds.map((incidentId, index) => <Button key={incidentId} onClick={() => onIncidents({ week: result.weekStart, incidentId })}>Revisar incidencia {index + 1}</Button>)}
            {!blocked.incidentIds.length && <Typography>No hay una incidencia ligada al tramo. Puede proceder de un ajuste sin marcaje original; se requiere revisar ese ajuste.</Typography>}
          </Stack>)}
        </>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={save.isPending} onClick={onClose}>Cerrar</Button><Button type="submit" variant="contained" disabled={save.isPending || (mode === 'selected' && !selected.length)}>{save.isPending ? 'Procesando…' : mode === 'selected' ? 'Confirmar cierre' : 'Confirmar corrida'}</Button></DialogActions>
    </form>
  </Dialog>
}

function ClosureDetail({ id, me, onClose }: { id: string; me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const detail = useQuery({ queryKey: ['week-closure', id], queryFn: () => api<Closure>(`/week-closures/${id}`), retry: false })
  const [localError, setError] = useState<Error | null>(null)
  const reopen = useMutation({ mutationFn: (body: { reason: string }) => api<Closure>(`/week-closures/${id}/reopen`, 'POST', body),
    onSuccess: async data => {
      cache.setQueryData(['week-closure', id], data)
      await Promise.all([cache.invalidateQueries({ queryKey: ['week-closures'] }), cache.invalidateQueries({ queryKey: ['attendance', data.employeeId] })])
    }, onError: error => {
      if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] })
      if (error instanceof ApiError && error.code === 'closure_not_closed') void cache.invalidateQueries({ queryKey: ['week-closure', id] })
    },
  })
  useEffect(() => { if (detail.error instanceof ApiError && detail.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [detail.error, cache])
  const closure = detail.data
  const canReopen = permissions(me.roles).reopenClosures && closure?.status === 'closed'
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canReopen || reopen.isPending) return
    setError(null)
    try { reopen.mutate(reopenBody(String(new FormData(event.currentTarget).get('reason') || ''))) } catch (error) { setError(error as Error) }
  }
  return <Dialog open fullWidth maxWidth="md" onClose={() => { if (!reopen.isPending) onClose() }} aria-labelledby="closure-detail-title">
    <DialogTitle id="closure-detail-title">Detalle del cierre semanal</DialogTitle><DialogContent><Stack spacing={2}>
      <ErrorNotice error={detail.error} />{detail.isError && <Button onClick={() => void detail.refetch()}>Reintentar cierre</Button>}{detail.isPending && <Typography role="status">Cargando cierre…</Typography>}
      {closure && <>
        <Typography component="div"><RecordName kind="employee" id={closure.employeeId} me={me} /> · Semana {closure.weekStart} · Versión {closure.version} · {statusLabels[closure.status]}</Typography>
        <Typography>Totales congelados: trabajo {closure.totals.workedMinutes} min · descanso {closure.totals.breakMinutes} min · ordinarios {closure.totals.ordinaryMinutes} min · extraordinarios {closure.totals.overtimeMinutes} min</Typography>
        <Typography component="div">Cerrado: {showTime(closure.closedAt, me.tenant!.timeZone)} · {closure.closedBy ? <RecordName kind="user" id={closure.closedBy} me={me} /> : 'Cierre programado'}</Typography>
        <Typography>Versión de reglas: {closure.ruleSet.version}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>Huella del cierre: {closure.hash}</Typography>
        {closure.acknowledgement ? <Alert severity={closure.acknowledgement.type === 'objected' ? 'warning' : 'info'}>Acuse: {closure.acknowledgement.type === 'agreed' ? 'Conforme' : 'Objetado'} · {showTime(closure.acknowledgement.at, me.tenant!.timeZone)}{closure.acknowledgement.note && ` · ${closure.acknowledgement.note}`}</Alert> : <Typography>Sin acuse del trabajador.</Typography>}
        <ErrorNotice error={reopen.error} /><ErrorNotice error={localError} />
        {reopen.isSuccess && <Alert severity="success">Semana reabierta. La versión anterior se conserva; el siguiente cierre creará otra.</Alert>}
        {canReopen && <form onSubmit={submit}><Stack spacing={2}><Alert severity="warning">Reabrir permite ajustar la semana. El cálculo y el acuse de esta versión se conservan.</Alert><TextField name="reason" label="Motivo de reapertura" multiline required disabled={reopen.isPending} slotProps={{ htmlInput: { minLength: 10, maxLength: 500 } }} helperText="Entre 10 y 500 caracteres." /><Button type="submit" variant="contained" disabled={reopen.isPending}>{reopen.isPending ? 'Reabriendo…' : 'Confirmar reapertura'}</Button></Stack></form>}
      </>}
    </Stack></DialogContent><DialogActions><Button disabled={reopen.isPending} onClick={onClose}>Cerrar</Button></DialogActions>
  </Dialog>
}

function RunDetail({ id, me, onClose, onIncidents, onRun }: { id: string; me: Me; onClose: () => void; onIncidents: (target: IncidentTarget) => void; onRun: (id: string) => void }) {
  const cache = useQueryClient()
  const detail = useQuery({ queryKey: ['closure-run', id], queryFn: () => api<ClosureRun>(`/week-closure-runs/${id}`), retry: false, refetchInterval: query => runPollInterval(query.state.data?.status, query.state.error) })
  const run = detail.data
  const retry = useMutation({ mutationFn: () => api<ClosureRun>('/week-closure-runs', 'POST', runBody(run!.weekStart, run!.siteId || '')),
    onSuccess: data => { cache.setQueryData(['closure-run', data.id], data); void cache.invalidateQueries({ queryKey: ['closure-runs'] }); onRun(data.id) },
    onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) },
  })
  useEffect(() => {
    if (run?.status === 'done' || run?.status === 'failed') {
      void cache.invalidateQueries({ queryKey: ['week-closures'] }); void cache.invalidateQueries({ queryKey: ['closure-runs'] })
      void cache.invalidateQueries({ queryKey: ['incidents'] }); void cache.invalidateQueries({ queryKey: ['attendance'] })
    }
  }, [run?.status, cache])
  useEffect(() => { if (detail.error instanceof ApiError && detail.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [detail.error, cache])
  const processed = run ? run.closed + run.blocked.openIncidents + run.blocked.openSegment : 0
  return <Dialog open fullWidth maxWidth="md" onClose={() => { if (!retry.isPending) onClose() }} aria-labelledby="run-detail-title"><DialogTitle id="run-detail-title">Avance de corrida</DialogTitle><DialogContent><Stack spacing={2}>
    <ErrorNotice error={detail.error} />{detail.isError && <><Typography>El seguimiento está pausado. Lo ya cerrado se conserva.</Typography><Button onClick={() => void detail.refetch()}>Reintentar avance</Button></>}
    {detail.isPending && <Typography role="status">Consultando corrida…</Typography>}
    {run && <>
      <Typography>Semana {run.weekStart} · {run.origin === 'scheduled' ? 'Cierre programado' : 'Solicitada por una persona'} · {statusLabels[run.status]}</Typography>
      <Typography component="div">Alcance: {run.siteId ? <RecordName kind="site" id={run.siteId} me={me} /> : 'Toda la empresa'}</Typography>
      <Typography>Cerrados: {run.closed} · Incidencias abiertas: {run.blocked.openIncidents} · Tramos sin salida: {run.blocked.openSegment}</Typography>
      {run.total === null ? <Typography>En espera de conocer el total.</Typography> : <><Typography>Procesados: {processed} de {run.total}</Typography><LinearProgress variant="determinate" value={run.total ? Math.min(100, processed / run.total * 100) : 100} aria-label="Avance del cierre" /></>}
      {(run.status === 'queued' || run.status === 'running') && <Typography>El avance se consulta cada cinco segundos mientras esta pantalla esté visible.</Typography>}
      {run.status === 'failed' && <Alert severity="error">{failureLabels[run.failure || ''] || 'La corrida no pudo terminar.'} Lo ya cerrado se conserva. Puedes solicitar otra corrida con la misma semana y alcance.</Alert>}
      <ErrorNotice error={retry.error} />
      {run.status === 'failed' && permissions(me.roles).closeWeeks && <Button disabled={retry.isPending} onClick={() => retry.mutate()}>{retry.isPending ? 'Solicitando…' : 'Solicitar otra corrida con el mismo alcance'}</Button>}
      {(run.blocked.openIncidents > 0 || run.blocked.openSegment > 0) && <><Alert severity="warning">El API entrega conteos de bloqueados, no su lista nominal. Revisa las incidencias abiertas de la semana.</Alert><Button onClick={() => onIncidents({ week: run.weekStart, ...(run.siteId ? { siteId: run.siteId } : {}) })}>Revisar incidencias abiertas</Button></>}
    </>}
  </Stack></DialogContent><DialogActions><Button disabled={retry.isPending} onClick={onClose}>Cerrar</Button></DialogActions></Dialog>
}
