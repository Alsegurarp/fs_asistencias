import { type FormEvent, useId, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Typography } from '@mui/material'
import { api, ApiError, permissions, type Me } from './api'
import { type PersonWeek, type RuleSet, dayMonth, hours, shortWeekLabel, timeIn } from './attendanceModel'
import { type Closure, acknowledgementBadge, reopenBody } from './closureModel'
import { color, font } from './design'
import { dateInZone } from './incidentModel'
import { Badge, Note, SidePanel } from './ui'

type Props = { id: string; me: Me; timeZone: string; onClose: () => void; onReopened: () => void }

/**
 * Cierre de una persona (OPE-04): lo que congeló, sus días trabajados, el
 * acuse y, para Administración, reabrirlo con motivo.
 */
export function ClosureSheet({ id, me, timeZone, onClose, onReopened }: Props) {
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const detail = useQuery({ queryKey: ['week-closure', id], queryFn: () => api<Closure>(`/week-closures/${id}`), retry: false })
  const closure = detail.data
  // Los días son los que congeló el cierre vigente; en una versión reabierta ya no son los suyos.
  const week = useQuery({ queryKey: ['employee-week', closure?.employeeId, closure?.weekStart], enabled: closure?.status === 'closed', retry: false,
    queryFn: () => api<PersonWeek>(`/employees/${closure!.employeeId}/attendance?week=${closure!.weekStart}`) })
  const rules = useQuery({ queryKey: ['rule-sets', 'all'], queryFn: () => api<{ items: RuleSet[] }>('/rule-sets').then(result => result.items), retry: false, staleTime: 3_600_000 })
  const [reason, setReason] = useState('')
  const [local, setLocal] = useState<string | null>(null)
  const formId = useId()
  const reopen = useMutation({
    mutationFn: (body: { reason: string }) => api<Closure>(`/week-closures/${id}/reopen`, 'POST', body),
    onSuccess: updated => { cache.setQueryData(['week-closure', id], updated); onReopened() },
    onError: error => { if (error instanceof ApiError && error.code === 'closure_not_closed') void detail.refetch() },
  })

  if (!closure) return <SidePanel title={detail.isError ? 'No se pudo abrir' : 'Cargando…'} onClose={onClose}>
    {detail.error instanceof ApiError ? <Note tone="error">{detail.error.status === 404 ? 'Ese cierre no existe o no está en tus sedes.' : `No pudimos cargarlo. ${detail.error.message}`}</Note>
      : <Typography role="status" sx={{ fontSize: 13, color: color.muted }}>Cargando el cierre…</Typography>}
  </SidePanel>

  const at = (instant: string) => `${dayMonth(dateInZone(instant, timeZone))}, ${timeIn(instant, timeZone)}`
  const rule = rules.data?.find(item => item.id === closure.ruleSet.id)
  const frozenDays = closure.status === 'closed' && week.data?.closure?.id === closure.id ? week.data.days : undefined
  const workedDays = frozenDays ? String(frozenDays.filter(day => day.workedMinutes > 0).length) : closure.status === 'closed' && week.isPending ? '…' : '—'
  const ack = closure.acknowledgement
  const badge = acknowledgementBadge(closure)
  const firstName = (closure.employeeName || '').split(' ')[0] || 'la persona'
  const canReopen = allowed.reopenClosures && closure.status === 'closed'
  const marks = `/asistencia?${new URLSearchParams({ semana: closure.weekStart, persona: closure.employeeId, ficha: 'marcajes' })}`
  const failure = reopen.error instanceof ApiError ? reopen.error : null
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (reopen.isPending) return
    setLocal(null)
    try { reopen.mutate(reopenBody(reason)) } catch (error) { setLocal((error as Error).message) }
  }

  return <SidePanel title={closure.employeeName || 'Persona'} eyebrow={`Cierre versión ${closure.version} · ${shortWeekLabel(closure.weekStart)}`} onClose={onClose}
    footer={<>
      <Button variant="outlined" component={Link} to={marks}>Ver marcajes</Button>
      {canReopen && <Button type="submit" form={formId} variant="contained" disabled={reopen.isPending} sx={{ color: `${color.white} !important` }}>{reopen.isPending ? 'Reabriendo…' : 'Reabrir semana'}</Button>}
    </>}>
    {reopen.isSuccess && <Note>Listo: la semana quedó reabierta y se recalcula. Este cierre queda en el historial.</Note>}
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', background: color.rowHover, borderRadius: '16px', textAlign: 'center' }}>
      <Tile value={hours(closure.totals.ordinaryMinutes)} label="Ordinarias" />
      <Tile value={hours(closure.totals.overtimeMinutes)} label="Extra" divided />
      <Tile value={workedDays} label="Días trabajados" divided />
    </Box>
    {closure.status === 'reopened' ? <Note>Reabierta: este cierre ya no vale y su acuse tampoco. La semana se calcula de nuevo hasta el siguiente cierre.</Note>
      : ack?.type === 'objected' ? <Box sx={{ border: `1px solid ${color.errorBg}`, background: '#FFF7F6', borderRadius: '14px', p: '12px 14px', fontSize: 13 }}>
        <Box sx={{ color: color.error, fontWeight: 600 }}>Objeción · {at(ack.at)}, desde la app</Box>
        {ack.note && <Box sx={{ mt: 0.5 }}>«{ack.note}»</Box>}
      </Box>
        : ack ? <Note>Conforme · {at(ack.at)}, desde la app{ack.note ? `: «${ack.note}»` : ''}.</Note>
          : <Note>Sin acuse todavía: {firstName} lo da desde la app.</Note>}
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 13, '& dt': { color: color.subtle }, '& dd': { m: 0 } }}>
      <dt>Cerró</dt><dd>{closure.closedBy === null ? 'Cierre programado' : closure.closedByName || 'Sin nombre'}, {at(closure.closedAt)}</dd>
      <dt>Reglas</dt><dd>{rule ? `${rule.validFrom.slice(0, 4)}, ` : ''}versión {closure.ruleSet.version}</dd>
      <dt>Huella</dt><dd><Box component="code" title={closure.hash} sx={{ fontFamily: 'ui-monospace, monospace' }}>{closure.hash.slice(0, 6)}…{closure.hash.slice(-6)}</Box></dd>
      <dt>Acuse</dt><dd><Badge tone={badge.tone}>{badge.label}</Badge></dd>
    </Box>
    {canReopen ? <Box component="form" id={formId} aria-label="Reabrir la semana" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pt: 1.5, borderTop: `1px solid ${color.line}` }}>
      <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 14, fontWeight: 600 }}>Motivo para reabrir
        <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: color.muted }}>Sólo Administración. Obligatorio, de 10 a 500 caracteres.</Box>
        <Box component="textarea" name="reason" rows={3} required minLength={10} maxLength={500} value={reason} onChange={event => setReason((event.target as HTMLTextAreaElement).value)}
          aria-invalid={!!failure?.errors.length} sx={{ minHeight: 40, border: `1px solid ${failure?.errors.length ? color.error : color.fieldSoft}`, borderRadius: '10px', p: '10px 12px', fontFamily: font, fontSize: 14, color: color.ink, resize: 'vertical' }} />
      </Box>
      <Typography sx={{ fontSize: 12, color: color.muted }}>Al reabrir, el acuse deja de valer, la semana se recalcula y {firstName} podrá dar su acuse al cierre nuevo. Este cierre queda en el historial.</Typography>
      {local && <Note tone="error">{local}</Note>}
      {failure && <Note tone="error">{failure.code === 'closure_not_closed' ? 'Otra persona ya la reabrió.' : failure.errors[0]?.message || `No se pudo reabrir. ${failure.message}`}{failure.correlationId && ` Referencia: ${failure.correlationId}.`}</Note>}
    </Box>
      : closure.status === 'closed' && !allowed.reopenClosures && <Typography sx={{ fontSize: 12, color: color.muted }}>Reabrir una semana sólo lo puede hacer Administración.</Typography>}
  </SidePanel>
}

function Tile({ value, label, divided }: { value: string; label: string; divided?: boolean }) {
  return <Box sx={{ p: '10px 4px', borderLeft: divided ? `1px solid ${color.line}` : 0 }}>
    <Box sx={{ fontSize: 19, fontWeight: 700 }}>{value}</Box>
    <Box sx={{ fontSize: 12, color: color.muted }}>{label}</Box>
  </Box>
}
