import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Employee, type Me, type Page } from './api'
import { EntitySelect, ErrorNotice } from './Directory'
import { dateInZone } from './incidentModel'

const weekdays: Record<string, string> = { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' }
export type Schedule = { id: string; name: string; timeZone: string; validFrom: string; validTo: string | null; days: { dayOfWeek: string; startTime: string; endTime: string; breakMinutes: number }[] }
type Assignment = { id: string; employeeId: string; scheduleId: string; validFrom: string; validTo: string | null }

export function Schedules({ me }: { me: Me }) {
  const allowed = permissions(me.roles)
  const cache = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState<Schedule | null>(null)
  const list = useInfiniteQuery({ queryKey: ['schedules'], initialPageParam: '', enabled: allowed.schedules, queryFn: ({ pageParam }) => api<Page<Schedule>>(`/schedules${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: page => page.nextCursor || undefined, retry: false })
  useEffect(() => { if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [list.error, cache])
  if (!allowed.schedules) return <Alert severity="info">Tu rol no permite consultar horarios.</Alert>
  const rows = list.data?.pages.flatMap(page => page.items) || []
  return <Stack spacing={2}>
    <Typography variant="h5">Horarios y asignaciones</Typography>
    <Alert severity="info">Los horarios conservan su vigencia. Para cambiarlos, crea otro horario y asígnalo desde una nueva fecha. El cálculo de asistencia aún no compara marcajes contra el horario para determinar retardos o faltas.</Alert>
    {allowed.editDirectory && <Button variant="contained" onClick={() => setCreating(true)}>Crear horario</Button>}
    <ErrorNotice error={list.error} />{list.isError && <Button onClick={() => void list.refetch()}>Reintentar horarios</Button>}
    {list.isPending && <Typography role="status">Cargando horarios…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">Todavía no hay horarios.</Alert>}
    {rows.map(schedule => <Stack key={schedule.id} spacing={1} sx={{ border: 1, borderColor: 'divider', p: 2, borderRadius: 1 }}>
      <Typography variant="h6">{schedule.name}</Typography><Typography>{schedule.timeZone} · Desde {schedule.validFrom} · Hasta {schedule.validTo || 'Sin fecha de fin'}</Typography>
      {schedule.days.map(day => <Typography key={day.dayOfWeek}>{weekdays[day.dayOfWeek]}: {day.startTime}–{day.endTime}{day.endTime < day.startTime && ' (salida al día siguiente)'} · Descanso: {day.breakMinutes} min</Typography>)}
      {allowed.editDirectory && <Button onClick={() => setAssigning(schedule)}>Asignar {schedule.name}</Button>}
    </Stack>)}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más horarios</Button>}
    {creating && <ScheduleForm me={me} onClose={() => setCreating(false)} />}
    {assigning && <AssignmentForm key={assigning.id} schedule={assigning} me={me} onClose={() => setAssigning(null)} />}
  </Stack>
}

function ScheduleForm({ me, onClose }: { me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const [days, setDays] = useState(Object.keys(weekdays).slice(0, 5))
  const [error, setError] = useState<Error | null>(null)
  const save = useMutation({ mutationFn: (body: unknown) => api<Schedule>('/schedules', 'POST', body), onSuccess: async () => { onClose(); await cache.invalidateQueries({ queryKey: ['schedules'] }) }, onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (save.isPending || !permissions(me.roles).editDirectory) return
    setError(null)
    if (!days.length) { setError(new Error('Selecciona al menos un día.')); return }
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) || '').trim()
    save.mutate({ name: value('scheduleName'), timeZone: value('scheduleZone'), validFrom: value('scheduleFrom'), validTo: value('scheduleTo') || null,
      days: days.map(dayOfWeek => ({ dayOfWeek, startTime: value(`${dayOfWeek}-start`), endTime: value(`${dayOfWeek}-end`), breakMinutes: Number(value(`${dayOfWeek}-break`)) })) })
  }
  return <Dialog open fullWidth maxWidth="md" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="schedule-title"><form onSubmit={submit}>
    <DialogTitle id="schedule-title">Crear horario</DialogTitle><DialogContent><Stack spacing={2}>
      <TextField name="scheduleName" label="Nombre del horario" required disabled={save.isPending} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField name="scheduleZone" label="Zona horaria" defaultValue={me.tenant!.timeZone} required disabled={save.isPending} />
      <TextField name="scheduleFrom" label="Vigente desde" type="date" defaultValue={dateInZone(new Date().toISOString(), me.tenant!.timeZone)} required disabled={save.isPending} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField name="scheduleTo" label="Vigente hasta (opcional)" type="date" disabled={save.isPending} slotProps={{ inputLabel: { shrink: true } }} />
      <Typography>Selecciona los días laborables. Una salida anterior a la entrada corresponde al día siguiente.</Typography>
      {Object.entries(weekdays).map(([day, label]) => <Stack key={day} spacing={1}>
        <FormControlLabel label={label} control={<Checkbox name="scheduleDay" value={day} checked={days.includes(day)} disabled={save.isPending} onChange={(_, checked) => setDays(current => checked ? [...current, day] : current.filter(value => value !== day))} />} />
        {days.includes(day) && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField name={`${day}-start`} label="Entrada" type="time" defaultValue="09:00" required disabled={save.isPending} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField name={`${day}-end`} label="Salida" type="time" defaultValue="17:00" required disabled={save.isPending} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField name={`${day}-break`} label="Descanso (minutos)" type="number" defaultValue={0} required disabled={save.isPending} slotProps={{ htmlInput: { min: 0, max: 480, step: 1 } }} />
        </Stack>}
      </Stack>)}
      <ErrorNotice error={error} /><ErrorNotice error={save.error} />
    </Stack></DialogContent><DialogActions><Button disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar horario'}</Button></DialogActions>
  </form></Dialog>
}

function AssignmentForm({ schedule, me, onClose }: { schedule: Schedule; me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const [employeeId, setEmployee] = useState('')
  const [result, setResult] = useState<Assignment | null>(null)
  const employee = useQuery({ queryKey: ['employee', employeeId], queryFn: () => api<Employee & { currentScheduleId: string | null }>(`/employees/${employeeId}`), enabled: !!employeeId, retry: false })
  const current = useQuery({ queryKey: ['schedule', employee.data?.currentScheduleId], queryFn: () => api<Schedule>(`/schedules/${employee.data!.currentScheduleId}`), enabled: !!employee.data?.currentScheduleId, retry: false })
  const save = useMutation({ mutationFn: (body: unknown) => api<Assignment>(`/employees/${employeeId}/schedule-assignments`, 'POST', body), onSuccess: async row => { setResult(row); await Promise.all([cache.invalidateQueries({ queryKey: ['employees'] }), cache.invalidateQueries({ queryKey: ['employee', row.employeeId] })]) }, onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  useEffect(() => { if ([employee.error, current.error].some(error => error instanceof ApiError && error.status === 403)) void cache.invalidateQueries({ queryKey: ['me'] }) }, [employee.error, current.error, cache])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (save.isPending || result || !employeeId || !permissions(me.roles).editDirectory) return
    save.mutate({ scheduleId: schedule.id, validFrom: String(new FormData(event.currentTarget).get('assignmentFrom')) })
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="assignment-title"><form onSubmit={submit}>
    <DialogTitle id="assignment-title">Asignar {schedule.name}</DialogTitle><DialogContent><Stack spacing={2}>
      <Alert severity="warning">La asignación anterior, si existe y se cruza con esta fecha, termina el día previo. La nueva fecha debe ser posterior al inicio de la última asignación.</Alert>
      <EntitySelect kind="employees" name="assignmentEmployee" label="Empleado" value={employeeId} required emptyLabel="Selecciona un empleado" disabled={save.isPending || !!result} onChange={value => { setEmployee(value); save.reset() }} />
      {employee.isFetching && <Typography role="status">Consultando empleado…</Typography>}
      <ErrorNotice error={employee.error} />{employee.isError && <Button onClick={() => void employee.refetch()}>Reintentar empleado</Button>}
      {employee.data && <Typography>Horario vigente hoy: {employee.data.currentScheduleId ? current.data?.name || 'Consultando horario…' : 'Sin horario vigente'}</Typography>}
      <ErrorNotice error={current.error} />{current.isError && <Button onClick={() => void current.refetch()}>Reintentar horario vigente</Button>}
      <TextField name="assignmentFrom" label="Asignar desde" type="date" defaultValue={schedule.validFrom} required disabled={save.isPending || !!result} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: schedule.validFrom, ...(schedule.validTo ? { max: schedule.validTo } : {}) } }} />
      <Typography>Hasta: {schedule.validTo || 'Sin fecha de fin'}</Typography>
      <ErrorNotice error={save.error} />
      {result && <Alert severity="success">Horario asignado desde {result.validFrom} hasta {result.validTo || 'sin fecha de fin'}.</Alert>}
    </Stack></DialogContent><DialogActions><Button disabled={save.isPending} onClick={onClose}>Cerrar</Button><Button type="submit" variant="contained" disabled={save.isPending || !!result || !employeeId || employee.isPending || employee.isError}>{save.isPending ? 'Asignando…' : 'Confirmar asignación'}</Button></DialogActions>
  </form></Dialog>
}
