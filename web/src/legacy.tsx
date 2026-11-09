import { useEffect } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Employee, type Me, type Site } from './api'
import { ErrorNotice } from './Directory'
import { showTime, type User, type Week } from './incidentModel'

/**
 * Piezas de las pantallas anteriores que todavía usan Cierres, Dispositivos,
 * Usuarios y Mi asistencia. Se retiran con la última de ellas.
 */

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
