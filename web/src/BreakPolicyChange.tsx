import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type BreakPolicy, type BreakPolicyChange, type UpcomingBreakPolicy } from './api'
import { ErrorNotice } from './Directory'

export const breaks: Record<BreakPolicy, string> = { not_considered: 'No se marca', marked: 'Se marca' }

/** «lunes 16 de noviembre de 2026»: el día del calendario de la empresa, sin moverlo de zona. */
export function showDay(day: string) {
  const parts = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(`${day}T12:00:00Z`))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value
  return `${part('weekday')} ${part('day')} de ${part('month')} de ${part('year')}`
}

/** Lo que cambia y desde cuándo, en palabras de quien marca. */
export function upcomingText(change: UpcomingBreakPolicy) {
  return change.breakPolicy === 'marked'
    ? `Desde el ${showDay(change.effectiveOn)} se marcarán el inicio y el fin de la comida.`
    : `Desde el ${showDay(change.effectiveOn)} ya no se marcará la comida: sólo entrada y salida.`
}

export const scheduleRule = 'El cambio no es inmediato: entra el primer día de semana de la empresa dentro de la siguiente quincena, con al menos 7 días de aviso. Las semanas anteriores conservan su cálculo y las personas reciben el aviso.'

/** Política vigente y cambio programado; quien puede, lo programa o lo cancela. */
export function BreakPolicySection({ current, change, basePath, canChange, onChanged }: {
  current: BreakPolicy
  change: BreakPolicyChange | null
  basePath: string
  canChange: boolean
  onChanged: () => void
}) {
  const [scheduling, setScheduling] = useState(false)
  const cancel = useMutation({ mutationFn: (id: string) => api<void>(`${basePath}/${id}/cancellation`, 'POST'), onSuccess: onChanged })
  return <Stack spacing={1}>
    <Typography>Descanso o comida: {breaks[current]}</Typography>
    {change && <Alert severity="info">
      Cambio programado: {breaks[change.breakPolicy].toLowerCase()} desde el {showDay(change.effectiveOn)}. Motivo: {change.reason}
    </Alert>}
    {canChange && (change
      ? <Button disabled={cancel.isPending} onClick={() => cancel.mutate(change.id)}>{cancel.isPending ? 'Cancelando…' : 'Cancelar cambio de comida'}</Button>
      : <Button onClick={() => setScheduling(true)}>Programar cambio de comida</Button>)}
    <ErrorNotice error={cancel.error} />
    {scheduling && <ScheduleDialog current={current} basePath={basePath} onClose={() => setScheduling(false)} onScheduled={onChanged} />}
  </Stack>
}

function ScheduleDialog({ current, basePath, onClose, onScheduled }: { current: BreakPolicy; basePath: string; onClose: () => void; onScheduled: () => void }) {
  const cache = useQueryClient()
  const next: BreakPolicy = current === 'marked' ? 'not_considered' : 'marked'
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 10 && reason.trim().length <= 500
  const save = useMutation({ mutationFn: () => api<BreakPolicyChange>(basePath, 'POST', { breakPolicy: next, reason: reason.trim() }),
    onSuccess: () => { onScheduled(); onClose() },
    onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="break-change-title">
    <form onSubmit={event => { event.preventDefault(); if (!save.isPending && valid) save.mutate() }}>
      <DialogTitle id="break-change-title">Programar cambio de comida</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography>Pasará de «{breaks[current]}» a «{breaks[next]}».</Typography>
        <Alert severity="info">{scheduleRule}</Alert>
        <TextField name="reason" label="Motivo del cambio" value={reason} onChange={event => setReason(event.target.value)} required disabled={save.isPending} helperText="Entre 10 y 500 caracteres. Lo ven quienes administran la empresa." slotProps={{ htmlInput: { maxLength: 500 } }} />
        <ErrorNotice error={save.error} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained" disabled={save.isPending || !valid}>{save.isPending ? 'Programando…' : 'Programar cambio'}</Button></DialogActions>
    </form>
  </Dialog>
}
