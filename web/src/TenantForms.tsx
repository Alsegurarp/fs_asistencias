import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type BreakPolicy, type BreakPolicyChange, type Tenant, type TenantUsage } from './api'
import { color } from './design'
import type { IconName } from './Icons'
import { Icon } from './Icons'
import { problemText } from './personnelData'
import { breakChangeStarts, breakNames, shortDay, weekDayNames } from './settingsModel'
import { Badge, IconTile, Modal, Note, SidePanel } from './ui'
import { type OperatedTenant, administrationNames, count, currentMonth, dayOf, monthName, statusNames, usageColumns, zoneName, zones } from './tenantsModel'

const fieldError = (error: unknown, field: string) => (error instanceof ApiError ? error.errors.find(item => item.field === field)?.message : undefined)
const reasonProblem = (text: string) => (text.length < 10 ? 'Escribe al menos 10 caracteres.' : undefined)

/** Lo que cambia cuando la operación cambia una empresa: la lista, sus cifras y el uso. */
function useRefresh() {
  const cache = useQueryClient()
  return {
    changed: () => { void cache.invalidateQueries({ queryKey: ['tenants'] }); void cache.invalidateQueries({ queryKey: ['tenant-summary'] }); void cache.invalidateQueries({ queryKey: ['tenant-usage'] }) },
    // Un 403 es que la cuenta dejó de operar el servicio: se vuelve a preguntar quién es.
    failed: (error: unknown) => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) },
  }
}

function Reason({ value, onChange, tried, disabled, error, hint }: { value: string; onChange: (value: string) => void; tried: boolean; disabled: boolean; error: unknown; hint: string }) {
  const problem = reasonProblem(value.trim())
  return <TextField name="reason" label="Motivo" value={value} onChange={event => onChange(event.target.value)} required multiline minRows={2} disabled={disabled}
    error={(tried && !!problem) || !!fieldError(error, 'reason')} helperText={(tried && problem) || fieldError(error, 'reason') || hint} slotProps={{ htmlInput: { maxLength: 500 } }} />
}

/** CON-05: alta de una empresa; queda invitada quien la administrará. */
export function NewTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (tenant: Tenant) => void }) {
  const refresh = useRefresh()
  const [policy, setPolicy] = useState<BreakPolicy | ''>('')
  const [tried, setTried] = useState(false)
  const save = useMutation({
    mutationFn: (body: unknown) => api<Tenant>('/tenants', 'POST', body),
    onSuccess: tenant => { refresh.changed(); onCreated(tenant) },
    onError: refresh.failed,
  })
  const busy = save.isPending
  const general = save.isError && !['name', 'slug', 'timeZone', 'weekStartsOn', 'breakPolicy', 'firstAdminEmail'].some(field => fieldError(save.error, field))
  const field = (name: string) => ({ error: !!fieldError(save.error, name), helperText: fieldError(save.error, name) })
  const choice = (value: BreakPolicy, detail: string) => <Box component="label" sx={{ flex: '1 1 200px', display: 'flex', gap: 1, alignItems: 'flex-start', p: '10px 12px', borderRadius: '12px', cursor: 'pointer', fontSize: 13,
    border: `1.5px solid ${policy === value ? color.accent : color.line}`, background: policy === value ? color.selected : color.white }}>
    <Box component="input" type="radio" name="breakPolicy" value={value} checked={policy === value} disabled={busy} onChange={() => setPolicy(value)} sx={{ accentColor: color.link, mt: '2px' }} />
    <span><Box component="strong" sx={{ display: 'block' }}>{breakNames[value]}</Box><Box component="span" sx={{ color: color.muted }}>{detail}</Box></span>
  </Box>
  return <Modal id="alta-empresa" icon="building" title="Dar de alta una empresa" subtitle="Queda invitada su administración" onClose={onClose} submit="Dar de alta e invitar" busy={busy}
    error={general ? <Note tone="error">{problemText(save.error, 'No se pudo dar de alta la empresa.')}</Note> : undefined}
    onSubmit={form => {
      setTried(true)
      if (!policy || !form.reportValidity()) return
      const data = new FormData(form)
      const text = (name: string) => String(data.get(name) || '').trim()
      save.mutate({ name: text('name'), slug: text('slug').toLowerCase(), timeZone: text('timeZone'), weekStartsOn: text('weekStartsOn'), breakPolicy: policy, firstAdminEmail: text('firstAdminEmail').toLowerCase() })
    }}>
    <Stack direction="row" useFlexGap sx={{ gap: 1.25, flexWrap: 'wrap' }}>
      <TextField name="name" label="Nombre" required disabled={busy} size="small" sx={{ flex: '2 1 260px' }} {...field('name')} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField name="slug" label="Identificador" required disabled={busy} size="small" sx={{ flex: '1 1 180px' }} error={!!fieldError(save.error, 'slug')}
        helperText={fieldError(save.error, 'slug') || 'Minúsculas, números y guiones.'} slotProps={{ htmlInput: { maxLength: 60, pattern: '[A-Za-z0-9]+(-[A-Za-z0-9]+)*' } }} />
    </Stack>
    <Stack direction="row" useFlexGap sx={{ gap: 1.25, flexWrap: 'wrap' }}>
      <TextField select name="timeZone" label="Zona horaria" defaultValue={zones[0].value} disabled={busy} size="small" sx={{ flex: '1 1 200px' }} {...field('timeZone')}>
        {zones.map(zone => <MenuItem key={zone.value} value={zone.value}>{zone.label}</MenuItem>)}
      </TextField>
      <TextField select name="weekStartsOn" label="La semana empieza" defaultValue="monday" disabled={busy} size="small" sx={{ flex: '1 1 200px' }} {...field('weekStartsOn')}>
        {Object.entries(weekDayNames).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
    </Stack>
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0 }}>
      <Box component="legend" sx={{ p: 0, mb: 1, fontSize: 13, fontWeight: 600, color: color.inkSoft }}>Política de comida <Box component="span" sx={{ fontWeight: 400, color: color.muted }}>· obligatoria, sin valor por omisión</Box></Box>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        {choice('marked', 'salida a comer y regreso')}
        {choice('not_considered', 'sólo entrada y salida')}
      </Stack>
      {((tried && !policy) || fieldError(save.error, 'breakPolicy')) && <Typography role="alert" sx={{ mt: 0.75, fontSize: 12.5, color: color.error }}>{fieldError(save.error, 'breakPolicy') || 'Elige una política de comida.'}</Typography>}
    </Box>
    <TextField name="firstAdminEmail" label="Correo de quien la administrará" type="email" required disabled={busy} size="small" {...field('firstAdminEmail')} slotProps={{ htmlInput: { maxLength: 254 } }} />
    <Note>Queda invitada al guardar: entra con ese correo verificado y desde ahí invita al resto. No puede ser un correo de operación ni uno que ya esté en otra empresa. El identificador no cambia después.</Note>
  </Modal>
}

/** CON-06: la operación programa el cambio de comida cuando la empresa lo pide. */
export function TenantMealModal({ tenant, today, onClose }: { tenant: Tenant; today: string; onClose: () => void }) {
  const refresh = useRefresh()
  const next: BreakPolicy = tenant.breakPolicy === 'marked' ? 'not_considered' : 'marked'
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const save = useMutation({
    mutationFn: () => api<BreakPolicyChange>(`/tenants/${tenant.id}/break-policy-changes`, 'POST', { breakPolicy: next, reason: reason.trim() }),
    onSuccess: () => { refresh.changed(); onClose() },
    onError: refresh.failed,
  })
  return <Modal id="comida-empresa" icon="clock" title="Programar un cambio de comida" subtitle={`${tenant.name} · hoy ${breakNames[tenant.breakPolicy].toLowerCase()}`} onClose={onClose} submit="Programar cambio" busy={save.isPending}
    error={save.error && !fieldError(save.error, 'reason') ? <Note tone="error">{problemText(save.error, 'No pudimos programar el cambio.')}</Note> : undefined}
    onSubmit={() => { setTried(true); if (!reasonProblem(reason.trim())) save.mutate() }}>
    <Box sx={{ p: 1.5, borderRadius: '12px', border: `1.5px solid ${color.accent}`, background: color.selected }}>
      <Typography sx={{ fontSize: 12.5, color: color.muted }}>Política nueva</Typography>
      <Typography sx={{ fontWeight: 600 }}>{breakNames[next]}</Typography>
      <Typography sx={{ fontSize: 12.5, color: color.muted }}>{next === 'marked' ? 'Cada persona marca su salida a comer y su regreso.' : 'Deja de marcarse la comida.'}</Typography>
    </Box>
    <Box sx={{ p: 1.5, borderRadius: '12px', background: color.page }}>
      <Typography sx={{ fontWeight: 600 }}>Entraría el {shortDay(breakChangeStarts(today, tenant.weekStartsOn), true)}</Typography>
      <Typography sx={{ fontSize: 12.5, color: color.muted }}>Primer día de semana de la siguiente quincena, con al menos 7 días de aviso. La fecha la confirma el servidor al programarlo.</Typography>
    </Box>
    <Reason value={reason} onChange={setReason} tried={tried} disabled={save.isPending} error={save.error} hint="De 10 a 500 caracteres; lo ve la administración de la empresa." />
    <Note>Usa esto sólo cuando la empresa lo pida; queda registrado que lo programó la operación.</Note>
  </Modal>
}

/** CON-07: soltar la liga de quien administra, cuando perdió su cuenta o ya no debe administrarla. */
export function UnlinkAdministratorModal({ tenant, onClose }: { tenant: OperatedTenant; onClose: () => void }) {
  const refresh = useRefresh()
  const linked = tenant.administration.administrators.filter(person => person.status === 'active')
  const [email, setEmail] = useState(linked[0]?.email || '')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const save = useMutation({
    mutationFn: () => api<unknown>(`/tenants/${tenant.id}/administrators/unlink`, 'POST', { email: email.trim().toLowerCase(), reason: reason.trim() }),
    onSuccess: () => { refresh.changed(); onClose() },
    onError: refresh.failed,
  })
  const general = save.error && !fieldError(save.error, 'reason') && !fieldError(save.error, 'email')
  return <Modal id="soltar-administracion" icon="person" title="Soltar a quien administra" subtitle={tenant.name} onClose={onClose} submit="Soltar la liga" busy={save.isPending}
    error={general ? <Note tone="error">{problemText(save.error, 'No pudimos soltar la liga.')}</Note> : undefined}
    onSubmit={form => { setTried(true); if (form.reportValidity() && !reasonProblem(reason.trim())) save.mutate() }}>
    <TextField name="email" label="Correo de quien administra" type="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={save.isPending} size="small"
      error={!!fieldError(save.error, 'email')} helperText={fieldError(save.error, 'email') || (tenant.administration.total > tenant.administration.administrators.length ? 'La ficha lista hasta cinco personas; escribe el correo si es otra.' : undefined)}
      slotProps={{ htmlInput: { maxLength: 254 } }} />
    <Reason value={reason} onChange={setReason} tried={tried} disabled={save.isPending} error={save.error} hint="Obligatorio; queda en la bitácora de la empresa." />
    <Note tone="warn">La cuenta deja de estar ligada a la empresa: la persona vuelve a quedar invitada, conserva sus roles y se liga otra vez si entra con ese correo verificado. Lo que hizo se conserva.</Note>
  </Modal>
}

/** Invitar a otra persona a administrar, sólo cuando nadie la administra con su cuenta. */
export function InviteAdministratorModal({ tenant, onClose }: { tenant: OperatedTenant; onClose: () => void }) {
  const refresh = useRefresh()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const save = useMutation({
    mutationFn: (email: string) => api<unknown>(`/tenants/${tenant.id}/administrators`, 'POST', { email, reason: reason.trim() }),
    onSuccess: () => { refresh.changed(); onClose() },
    onError: refresh.failed,
  })
  const general = save.error && !fieldError(save.error, 'reason') && !fieldError(save.error, 'email')
  return <Modal id="invitar-administracion" icon="users" title="Invitar a otra administración" subtitle={tenant.name} onClose={onClose} submit="Invitar" busy={save.isPending}
    error={general ? <Note tone="error">{problemText(save.error, 'No pudimos invitar a esa persona.')}</Note> : undefined}
    onSubmit={form => {
      setTried(true)
      if (form.reportValidity() && !reasonProblem(reason.trim())) save.mutate(String(new FormData(form).get('email') || '').trim().toLowerCase())
    }}>
    <TextField name="email" label="Correo de quien la administrará" type="email" required disabled={save.isPending} size="small"
      error={!!fieldError(save.error, 'email')} helperText={fieldError(save.error, 'email')} slotProps={{ htmlInput: { maxLength: 254 } }} />
    <Reason value={reason} onChange={setReason} tried={tried} disabled={save.isPending} error={save.error} hint="Obligatorio; queda en la bitácora de la empresa." />
    <Note>Entra con ese correo verificado, como en el alta. Una invitación anterior sigue como estaba: la quita quien entre a administrar.</Note>
  </Modal>
}

const suspensionEffects = [
  'Sus personas pierden los roles de empresa y no entran al portal.',
  'Los códigos para activar lectores dejan de canjearse.',
  'Los lectores ya activos siguen marcando y sincronizando.',
  'El cierre automático no corre; una corrida pendiente termina como fallida.',
  'No se borra nada; al reactivarla todo sigue como estaba.',
]
function Effects() {
  return <Box component="ul" sx={{ m: 0, p: '12px 14px 12px 32px', borderRadius: '14px', background: color.rowHover, fontSize: 13, lineHeight: 1.6, color: color.inkSoft }}>
    {suspensionEffects.map(text => <li key={text}>{text}</li>)}
  </Box>
}

/** CON-08: suspender una empresa, con su motivo. */
export function SuspendModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const refresh = useRefresh()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const save = useMutation({
    mutationFn: () => api<Tenant>(`/tenants/${tenant.id}/suspension`, 'POST', { reason: reason.trim() }),
    onSuccess: () => { refresh.changed(); onClose() },
    onError: refresh.failed,
  })
  return <Modal id="suspender-empresa" icon="pause" title={`Suspender ${tenant.name}`} subtitle="Bloquea administración y cierres" onClose={onClose} busy={save.isPending}
    error={save.error && !fieldError(save.error, 'reason') ? <Note tone="error">{problemText(save.error, 'No pudimos suspender la empresa.')}</Note> : undefined}
    onSubmit={() => { setTried(true); if (!reasonProblem(reason.trim())) save.mutate() }}
    actions={<>
      <Button variant="outlined" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
      <Button variant="contained" color="error" type="submit" disabled={save.isPending} sx={{ px: 3 }}>{save.isPending ? 'Suspendiendo…' : 'Suspender'}</Button>
    </>}>
    <Effects />
    <Reason value={reason} onChange={setReason} tried={tried} disabled={save.isPending} error={save.error} hint="Obligatorio; queda en la bitácora de la empresa." />
  </Modal>
}

export type TenantAction = 'comida' | 'soltar' | 'invitar' | 'suspender'

const heading = { fontSize: 12, fontWeight: 700, color: color.subtle, textTransform: 'uppercase', letterSpacing: '0.05em' } as const

/**
 * CON-02 y CON-03: la ficha de una empresa. Activa: su configuración, quién
 * la administra, el uso del mes y las acciones de operación. Suspendida: qué
 * implica y el motivo para reactivarla. Nunca muestra datos de sus personas.
 */
export function TenantPanel({ tenant, usageTo, onAction, onClose }: { tenant: OperatedTenant; usageTo: string; onAction: (action: TenantAction, element: HTMLElement) => void; onClose: () => void }) {
  const refresh = useRefresh()
  const suspended = tenant.status === 'suspended'
  const month = currentMonth(tenant.timeZone)
  const usage = useQuery({ queryKey: ['tenant-usage', 'one', tenant.id, month], retry: false, queryFn: () => api<TenantUsage>(`/tenants/${tenant.id}/usage?month=${month}`) })
  const change = tenant.breakPolicyChange
  const cancel = useMutation({
    mutationFn: (item: BreakPolicyChange) => api<void>(`/tenants/${tenant.id}/break-policy-changes/${item.id}/cancellation`, 'POST'),
    onSuccess: refresh.changed, onError: refresh.failed,
  })
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const reactivate = useMutation({
    mutationFn: () => api<Tenant>(`/tenants/${tenant.id}/reactivation`, 'POST', { reason: reason.trim() }),
    onSuccess: () => { refresh.changed(); setReason(''); setTried(false) }, onError: refresh.failed,
  })
  const { state, total, administrators } = tenant.administration
  const row = (label: string, value: ReactNode) => <><Box component="dt" sx={{ color: color.muted }}>{label}</Box><Box component="dd" sx={{ m: 0, fontWeight: 500, textAlign: 'right' }}>{value}</Box></>
  const action = (key: TenantAction, icon: IconName, title: string, detail: string) => <Box component="button" type="button" onClick={(event: React.MouseEvent<HTMLButtonElement>) => onAction(key, event.currentTarget)}
    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', minHeight: 52, p: '8px 12px', border: `1px solid ${color.line}`, borderRadius: '14px', background: color.white, color: color.ink, font: 'inherit', textAlign: 'left', cursor: 'pointer',
      '&:hover': { background: color.rowHover }, '&:focus-visible': { outline: `2px solid ${color.accent}`, outlineOffset: 1 } }}>
    <IconTile icon={icon} tone={key === 'suspender' ? 'error' : 'info'} size={34} />
    <Box sx={{ flex: 1, minWidth: 0 }}><Box component="strong" sx={{ display: 'block', fontSize: 14 }}>{title}</Box><Box component="span" sx={{ fontSize: 12.5, color: color.muted }}>{detail}</Box></Box>
    <Icon name="chevron" size={16} />
  </Box>

  return <SidePanel title={tenant.name} icon={<IconTile icon="building" tone="info" />} onClose={onClose}
    subtitle={<Box component="span" sx={{ overflowWrap: 'anywhere' }}>{tenant.slug} · alta el {dayOf(tenant.createdAt, tenant.timeZone)}</Box>}
    footer={suspended ? <Button variant="contained" disabled={reactivate.isPending} onClick={() => { setTried(true); if (!reasonProblem(reason.trim())) reactivate.mutate() }} sx={{ px: 3 }}>{reactivate.isPending ? 'Reactivando…' : 'Reactivar'}</Button> : undefined}>
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}><Badge tone={statusNames[tenant.status]?.tone || 'neutral'}>{statusNames[tenant.status]?.label || tenant.status}</Badge></Stack>
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 1, fontSize: 13.5 }}>
      {row('Zona horaria', zoneName(tenant.timeZone))}
      {row('Semana', `Empieza el ${weekDayNames[tenant.weekStartsOn].toLowerCase()}`)}
      {row('Comida', breakNames[tenant.breakPolicy])}
      {row('Cierre automático', tenant.autoCloseAfterHours === null ? 'Desactivado' : `${tenant.autoCloseAfterHours} h después de la semana`)}
    </Box>

    {suspended && <>
      {tenant.suspension && <Box sx={{ p: '10px 12px', borderRadius: '12px', background: color.errorBg, fontSize: 13.5 }}>
        <Box component="strong" sx={{ display: 'block' }}>Suspendida el {dayOf(tenant.suspension.at, tenant.timeZone)} por {tenant.suspension.byName}</Box>
        <Box component="span" sx={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>Motivo: {tenant.suspension.reason}</Box>
      </Box>}
      <Typography component="h3" sx={heading}>Mientras siga suspendida</Typography>
      <Effects />
    </>}

    <Typography component="h3" sx={heading}>Quién la administra{total > 0 && ` · ${total}`}</Typography>
    {administrators.length ? <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {administrators.map(person => <Box component="li" key={person.email} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, fontSize: 13.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box component="span" sx={{ display: 'block', fontWeight: 500, overflowWrap: 'anywhere' }}>{person.email}</Box>
          <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{person.linkedAt ? `Entró el ${dayOf(person.linkedAt, tenant.timeZone)}` : `Invitada el ${dayOf(person.invitedAt, tenant.timeZone)}`}</Box>
        </Box>
        <Badge tone={person.status === 'active' ? 'ok' : 'warn'}>{person.status === 'active' ? 'Ya entró' : 'Sin entrar'}</Badge>
      </Box>)}
    </Box> : <Note tone="warn">Nadie administra esta empresa con su cuenta.</Note>}
    {total > administrators.length && <Typography sx={{ fontSize: 12.5, color: color.muted }}>Se listan {administrators.length} de {total}.</Typography>}
    {state !== 'linked' && !suspended && <Box><Button variant="outlined" onClick={event => onAction('invitar', event.currentTarget)}>Invitar a otra persona</Button></Box>}
    {state !== 'linked' && !suspended && <Typography sx={{ fontSize: 12.5, color: color.muted }}>{administrationNames[state].label}: mientras nadie entre a administrarla, la operación puede invitar a otra persona.</Typography>}

    <Typography component="h3" sx={heading}>Uso de {monthName(month)} <Box component="span" sx={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {usage.data?.complete ? 'mes completo' : 'mes en curso'}</Box></Typography>
    {usage.isError ? <Note tone="error">{problemText(usage.error, 'No pudimos cargar el uso del mes.')}</Note>
      : <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
        {usageColumns.map(column => <Box key={column.key} sx={{ p: '10px 12px', borderRadius: '12px', background: color.page }}>
          <Box component="strong" sx={{ display: 'block', fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{usage.data ? count(usage.data[column.key]) : '…'}</Box>
          <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{column.short}</Box>
        </Box>)}
      </Box>}
    <Box><Box component={Link} to={usageTo} sx={{ fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Ver el uso de todos los meses</Box></Box>

    {change && <>
      <Typography component="h3" sx={heading}>Cambio de comida programado</Typography>
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', p: '10px 12px', borderRadius: '12px', background: color.warnBg, color: color.noteInk, fontSize: 13.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box component="strong" sx={{ display: 'block' }}>{breakNames[change.breakPolicy]} desde el {shortDay(change.effectiveOn, true)}</Box>
          <Box component="span" sx={{ display: 'block', fontSize: 12.5, overflowWrap: 'anywhere' }}>Motivo: {change.reason}</Box>
          <Box component="span" sx={{ display: 'block', fontSize: 12.5 }}>Programó {change.scheduledByName || 'la operación'} el {dayOf(change.scheduledAt, tenant.timeZone)}</Box>
        </Box>
        {!suspended && <Button variant="outlined" disabled={cancel.isPending} onClick={() => cancel.mutate(change)}>{cancel.isPending ? 'Cancelando…' : 'Cancelar el cambio'}</Button>}
      </Stack>
      {cancel.isError && <Note tone="error">{problemText(cancel.error, 'No pudimos cancelar el cambio.')}</Note>}
    </>}

    {suspended ? <>
      <Typography component="h3" sx={heading}>Reactivarla</Typography>
      <Reason value={reason} onChange={setReason} tried={tried} disabled={reactivate.isPending} error={reactivate.error} hint="Obligatorio; queda en la bitácora de la empresa." />
      {reactivate.isError && !fieldError(reactivate.error, 'reason') && <Note tone="error">{problemText(reactivate.error, 'No pudimos reactivar la empresa.')}</Note>}
    </> : <>
      <Typography component="h3" sx={heading}>Acciones de operación</Typography>
      <Stack spacing={1}>
        {!change && action('comida', 'clock', 'Programar un cambio de comida', 'Si la empresa lo pide por soporte')}
        {administrators.some(person => person.status === 'active') && action('soltar', 'person', 'Soltar a quien administra', 'Cuando esa persona ya no debe administrarla')}
        {action('suspender', 'pause', 'Suspender la empresa', 'Bloquea administración y cierres; no borra nada')}
      </Stack>
    </>}
  </SidePanel>
}
