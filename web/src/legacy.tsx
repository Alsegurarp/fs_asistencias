import { Alert, Stack, Typography } from '@mui/material'
import { ApiError } from './api'
import { showTime, type Week } from './incidentModel'

/**
 * Piezas de las pantallas anteriores que todavía usan el expediente, la Consola
 * y Mi asistencia. Se retiran con la última de ellas.
 */

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

export function ErrorNotice({ error }: { error: Error | null }) {
  if (!error) return null
  return <Alert severity="error">{error.message}{error instanceof ApiError && <>
    {error.errors.map((item, index) => <div key={index}>{item.field}: {item.message}</div>)}
    {error.correlationId && <div>Referencia: {error.correlationId}</div>}
  </>}</Alert>
}
