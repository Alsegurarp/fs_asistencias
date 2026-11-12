import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api, ApiError, type Employee, type Page, type Site } from './api'
import { showTime, type Week } from './incidentModel'

/**
 * Piezas de las pantallas anteriores que todavía usan Reportes, la Consola y
 * Mi asistencia. Se retiran con la última de ellas.
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

export function EntitySelect({ kind, name, label, value = '', required = false, onChange, disabled = false, emptyLabel }: { kind: 'sites' | 'employees'; name: string; label: string; value?: string; required?: boolean; onChange?: (value: string) => void; disabled?: boolean; emptyLabel?: string }) {
  const options = useInfiniteQuery({
    queryKey: [kind], initialPageParam: '',
    queryFn: ({ pageParam }) => api<Page<Site | Employee>>(`/${kind}${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: page => page.nextCursor || undefined, retry: false,
  })
  const items = options.data?.pages.flatMap(page => page.items) || []
  return <>
    <TextField select name={name} label={label} {...(onChange ? { value } : { defaultValue: value })} onChange={event => onChange?.(event.target.value)} required={required} disabled={disabled || options.isPending}>
      <MenuItem value="">{emptyLabel || (onChange ? kind === 'sites' ? 'Todas las sedes' : 'Todos los empleados' : required ? 'Selecciona una persona' : 'Sin sede')}</MenuItem>
      {value && !items.some(item => item.id === value) && <MenuItem value={value}>Asignación actual</MenuItem>}
      {items.map(item => <MenuItem key={item.id} value={item.id}>{'name' in item ? item.name : `${item.displayName} · ${item.externalId}`}{item.status === 'inactive' ? ' (inactivo)' : ''}</MenuItem>)}
    </TextField>
    <ErrorNotice error={options.error} />
    {options.isError && <Button onClick={() => void options.refetch()}>Reintentar opciones</Button>}
    {options.hasNextPage && <Button disabled={options.isFetchingNextPage} onClick={() => void options.fetchNextPage()}>Cargar más opciones</Button>}
  </>
}

export function ErrorNotice({ error }: { error: Error | null }) {
  if (!error) return null
  return <Alert severity="error">{error.message}{error instanceof ApiError && <>
    {error.errors.map((item, index) => <div key={index}>{item.field}: {item.message}</div>)}
    {error.correlationId && <div>Referencia: {error.correlationId}</div>}
  </>}</Alert>
}
