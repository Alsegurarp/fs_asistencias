import { useEffect, useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Me } from './api'
import { ErrorNotice } from './Directory'
import { WeekSummary } from './Incidents'
import { dateInZone, showTime, type Week } from './incidentModel'

export function PersonalAttendance({ me }: { me: Me }) {
  const cache = useQueryClient()
  const allowed = !!me.tenant && me.roles.includes('trabajador')
  const [date, setDate] = useState(() => dateInZone(new Date().toISOString(), me.tenant?.timeZone || 'UTC'))
  const [requested, setRequested] = useState(date)
  const week = useQuery({ queryKey: ['my-attendance', me.userId, requested],
    queryFn: () => api<Week>(`/me/attendance?week=${encodeURIComponent(requested)}`), enabled: allowed, retry: false })
  useEffect(() => { if (week.error instanceof ApiError && week.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [week.error, cache])
  if (!allowed) return <Alert severity="info">La consulta personal requiere el rol Trabajador y acceso a una empresa.</Alert>
  const acknowledgement = week.data?.closure?.status === 'closed' ? week.data.acknowledgement : null
  return <Stack spacing={2}>
    <Typography variant="h5">Mi asistencia</Typography>
    <form onSubmit={event => { event.preventDefault(); if (date && !week.isFetching) { if (date === requested) void week.refetch(); else setRequested(date) } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField name="personalWeek" label="Fecha de la semana" type="date" required value={date} onChange={event => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button type="submit" disabled={!date || week.isFetching}>Consultar semana</Button>
      </Stack>
    </form>
    {week.isFetching && <Typography role="status">Consultando mi semana…</Typography>}
    <ErrorNotice error={week.error} />
    {week.error instanceof ApiError && week.error.status === 403 && <Alert severity="info">Solicita a la administración que revise tu acceso y vínculo con el padrón.</Alert>}
    {week.isError && <Button onClick={() => void week.refetch()}>Reintentar mi semana</Button>}
    {week.data && !week.isError && <>
      <WeekSummary week={week.data} />
      {acknowledgement ? <Alert severity={acknowledgement.type === 'agreed' ? 'success' : 'warning'}>
        {acknowledgement.type === 'agreed' ? 'Conformidad registrada' : 'Diferencia reportada'} · {showTime(acknowledgement.at, week.data.timeZone)}
        <Typography>Comentario: {acknowledgement.note || 'Sin comentario'}</Typography>
        <Typography>Acuse: {acknowledgement.id} · Referencia: {acknowledgement.evidenceHash}</Typography>
      </Alert> : <Typography>{week.data.closure?.status === 'closed' ? (week.data.acknowledgement === undefined ? 'Esta versión del servidor no informa acuses en la consulta semanal.' : 'Sin acuse registrado para este cierre.') : 'La semana no tiene un cierre vigente para responder.'}</Typography>}
      <Typography>Esta consulta muestra los registros del servidor; los marcajes pendientes del teléfono todavía no están incluidos. Para reportar diferencias contacta a RH.</Typography>
    </>}
  </Stack>
}
