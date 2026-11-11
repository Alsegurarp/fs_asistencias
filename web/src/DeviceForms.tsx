import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, ButtonBase, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { api, ApiError, type Card, type Device, type DeviceEnrollment, type Employee, type Me, type Page } from './api'
import { timeIn } from './attendanceModel'
import { color, font } from './design'
import { deviceName, fingerprintError } from './devicesModel'
import { problemText, refreshPeople, useSites } from './personnelData'
import { Modal, Note, SidePanel } from './ui'

/** Lo que cambia cuando cambia un lector o una tarjeta: listas, conteos, fichas y el padrón. */
export function refreshDevices(cache: ReturnType<typeof useQueryClient>) {
  for (const key of ['devices', 'device-summary', 'card', 'cards', 'card-summary']) void cache.invalidateQueries({ queryKey: [key] })
  refreshPeople(cache)
}

function forbidden(cache: ReturnType<typeof useQueryClient>, error: unknown) {
  if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] })
}

export type Picked = Pick<Employee, 'id' | 'displayName' | 'externalId'>

/**
 * Buscar a una persona activa del padrón, en el servidor. Con `withoutCard`
 * sólo aparece quien no tiene tarjeta vigente.
 */
export function PersonPicker({ label, value, onChange, withoutCard = false, disabled = false }: {
  label: string; value: Picked | null; onChange: (person: Picked | null) => void; withoutCard?: boolean; disabled?: boolean
}) {
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const timer = setTimeout(() => setSearch(text.trim()), 250); return () => clearTimeout(timer) }, [text])
  const params = new URLSearchParams({ status: 'active', limit: '6' })
  if (search) params.set('q', search)
  if (withoutCard) params.set('withoutCard', 'true')
  const found = useQuery({ queryKey: ['employees', 'elegir', params.toString()], enabled: !value && !disabled, retry: false,
    queryFn: () => api<Page<Employee>>(`/employees?${params}`) })
  if (value) return <Stack direction="row" sx={{ alignItems: 'center', gap: 1, p: '8px 12px', border: `1px solid ${color.fieldSoft}`, borderRadius: '10px' }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, color: color.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{value.displayName} <Box component="span" sx={{ color: color.subtle, fontWeight: 400 }}>· {value.externalId}</Box></Typography>
    </Box>
    {!disabled && <Button size="small" onClick={() => onChange(null)}>Cambiar</Button>}
  </Stack>
  const items = found.data?.items || []
  return <Box role="group" aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    <TextField name="buscarPersona" label={label} placeholder="Nombre o número" value={text} onChange={event => setText(event.target.value)} disabled={disabled} size="small"
      slotProps={{ htmlInput: { maxLength: 100, autoComplete: 'off' } }} />
    {found.isPending && !disabled && <Typography role="status" sx={{ fontSize: 13, color: color.muted }}>Buscando…</Typography>}
    {found.isError && <Note tone="error">{problemText(found.error, 'No pudimos buscar en el padrón.')}</Note>}
    {found.isSuccess && !items.length && <Typography sx={{ fontSize: 13, color: color.muted }}>
      {withoutCard ? (search ? 'Nadie sin tarjeta coincide con la búsqueda.' : 'Todas las personas activas tienen tarjeta.') : 'Nadie coincide con la búsqueda.'}
    </Typography>}
    {!!items.length && <Box component="ul" aria-label="Personas encontradas" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {items.map(person => <li key={person.id}>
        <ButtonBase onClick={() => onChange(person)} sx={{ width: '100%', justifyContent: 'flex-start', gap: 1, minHeight: 40, px: 1.5, borderRadius: '10px', fontFamily: font, fontSize: 14, textAlign: 'left',
          '&:hover': { background: color.hover }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } }}>
          <strong>{person.displayName}</strong><Box component="span" sx={{ color: color.subtle }}>{person.externalId}{withoutCard ? ' · sin tarjeta' : ''}</Box>
        </ButtonBase>
      </li>)}
    </Box>}
  </Box>
}

/**
 * PAD-12: una tarjeta entra al inventario con su etiqueta y su huella y, si
 * se quiere, se asigna en el mismo paso a quien no tiene. La huella se
 * escribe a mano (tarjeta simulada); las del piloto las prepara una terminal.
 */
export function RegisterCardModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: (cardId: string) => void }) {
  const cache = useQueryClient()
  const [person, setPerson] = useState<Picked | null>(null)
  const [printError, setPrintError] = useState('')
  const [partial, setPartial] = useState<{ card: Card; problem: string } | null>(null)
  const save = useMutation({
    mutationFn: async ({ label, fingerprint }: { label: string; fingerprint: string }) => {
      const card = await api<Card>('/cards', 'POST', { label, fingerprint })
      if (!person) return { card, problem: '' }
      try { await api(`/cards/${card.id}/assignments`, 'POST', { employeeId: person.id }); return { card, problem: '' } }
      catch (error) { return { card, problem: problemText(error, 'No se pudo asignar.') } }
    },
    onSuccess: ({ card, problem }) => {
      refreshDevices(cache)
      // Abrir la tarjeta cambia la dirección: la ventana ya no está en ella y se cierra sola.
      if (problem) setPartial({ card, problem })
      else onRegistered(card.id)
    },
    onError: error => forbidden(cache, error),
  })
  const taken = save.error instanceof ApiError && save.error.status === 409
  if (partial) return <Modal id="tarjeta-parcial" icon="card" title={`${partial.card.label} quedó en inventario`} onClose={onClose} submit="Abrir la tarjeta"
    onSubmit={() => onRegistered(partial.card.id)}>
    <Note tone="warn">No se asignó a {person?.displayName}: {partial.problem}</Note>
    <Typography sx={{ fontSize: 13, color: color.muted }}>Puedes asignarla desde el detalle de la tarjeta.</Typography>
  </Modal>
  return <Modal id="registrar-tarjeta" icon="card" title="Registrar una tarjeta" subtitle="Entra al inventario de la empresa" onClose={onClose} submit="Registrar" busy={save.isPending}
    error={save.isError && !taken ? <Note tone="error">{problemText(save.error, 'No se pudo registrar la tarjeta.')}</Note> : undefined}
    onSubmit={form => {
      const data = new FormData(form)
      const label = String(data.get('label') || '').trim()
      const fingerprint = String(data.get('fingerprint') || '').trim()
      const problem = fingerprintError(fingerprint)
      setPrintError(problem)
      if (!label || problem) return
      save.mutate({ label, fingerprint })
    }}>
    <TextField name="label" label="Etiqueta" required autoFocus placeholder="T-0063" slotProps={{ htmlInput: { maxLength: 60 } }}
      error={taken} helperText={taken ? 'Ya hay una tarjeta con esa etiqueta o esa huella.' : 'El número impreso en la tarjeta.'} />
    <TextField name="fingerprint" label="Huella de la tarjeta" required slotProps={{ htmlInput: { maxLength: 128, autoComplete: 'off', spellCheck: false } }}
      error={!!printError} helperText={printError || 'La huella identifica la tarjeta sin usar su número público. Se guarda una sola vez y no se puede consultar después.'} />
    <Note>Las tarjetas del piloto no se registran aquí: una terminal las prepara y llegan al inventario con su etiqueta ZC-.</Note>
    <PersonPicker label="Asignarla ahora a (opcional)" value={person} onChange={setPerson} withoutCard disabled={save.isPending} />
  </Modal>
}

/**
 * PAD-02, «Activar un lector»: una terminal de sede o el teléfono de una
 * persona, con un código de un solo uso que se muestra una vez.
 */
export function ActivatePanel({ me, onClose }: { me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const sites = useSites()
  const active = (sites.data || []).filter(site => site.status === 'active')
  const [mode, setMode] = useState<'terminal' | 'personal'>('terminal')
  const [siteId, setSiteId] = useState('')
  const [person, setPerson] = useState<Picked | null>(null)
  const [label, setLabel] = useState('')
  const emit = useMutation({
    mutationFn: () => api<DeviceEnrollment>('/device-enrollments', 'POST', mode === 'terminal'
      ? { mode, siteId, ...(label.trim() ? { label: label.trim() } : {}) }
      : { mode, employeeId: person!.id }),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['devices'] }),
    onError: error => forbidden(cache, error),
  })
  const site = active.find(item => item.id === (siteId || (active.length === 1 ? active[0].id : '')))
  useEffect(() => { if (!siteId && active.length === 1) setSiteId(active[0].id) }, [active.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const ready = mode === 'terminal' ? !!siteId : !!person
  const issued = emit.data
  const target = mode === 'terminal' ? site?.name : person?.displayName
  const choice = (value: 'terminal' | 'personal', text: string) => <ButtonBase role="radio" aria-checked={mode === value} disabled={!!issued || emit.isPending}
    onClick={() => { setMode(value); emit.reset() }}
    sx={{ flex: 1, minHeight: 44, borderRadius: '10px', border: `1px solid ${mode === value ? color.accent : color.fieldSoft}`, background: mode === value ? color.selected : color.white,
      color: mode === value ? color.deep : color.inkSoft, fontFamily: font, fontSize: 14, fontWeight: 600, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}`, outlineOffset: 2 } }}>{text}</ButtonBase>

  return <SidePanel title="Activar un lector" subtitle="Un código de un solo uso para la app" onClose={onClose}
    footer={issued ? <Button variant="outlined" onClick={() => emit.reset()}>Generar otro código</Button>
      : <><Button variant="outlined" onClick={onClose} disabled={emit.isPending}>Cancelar</Button>
        <Button variant="contained" disabled={!ready || emit.isPending} onClick={() => emit.mutate()}>{emit.isPending ? 'Generando…' : 'Generar código'}</Button></>}>
    <Box role="radiogroup" aria-label="Tipo de lector" sx={{ display: 'flex', gap: 1 }}>
      {choice('terminal', 'Terminal de sede')}
      {choice('personal', 'Teléfono personal')}
    </Box>
    {mode === 'terminal' ? <>
      <TextField name="siteId" label="Sede" select value={siteId} onChange={event => { setSiteId(event.target.value); emit.reset() }} disabled={!!issued || sites.isPending} required>
        {active.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
      </TextField>
      {sites.isSuccess && !active.length && <Note tone="warn">No hay sedes activas: da de alta una en Configuración antes de activar una terminal.</Note>}
      <TextField name="label" label="Nombre" placeholder="Terminal Recepción" value={label} onChange={event => setLabel(event.target.value)} disabled={!!issued}
        slotProps={{ htmlInput: { maxLength: 60 } }} helperText="Opcional. Así aparece en la lista y en las marcas." />
    </> : <PersonPicker label="Persona" value={person} onChange={value => { setPerson(value); emit.reset() }} disabled={!!issued} />}
    {emit.isError && <Note tone="error">{problemText(emit.error, 'No se pudo generar el código.')}</Note>}
    {issued && <Box aria-live="polite" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ p: '14px 16px', borderRadius: '14px', background: color.selected, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: color.muted }}>Código de un solo uso</Typography>
        <Typography sx={{ fontFamily: 'monospace', fontSize: 30, fontWeight: 700, letterSpacing: '0.08em', color: color.deep }}>{issued.code}</Typography>
        <Typography sx={{ fontSize: 12.5, color: color.muted }}>Se muestra una sola vez · vence a las {timeIn(issued.expiresAt, me.tenant!.timeZone)}</Typography>
      </Box>
      <Box component="ol" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, fontSize: 13.5, color: color.inkSoft }}>
        <li>Instala Zenit en el teléfono y abre <strong>Dispositivo › Activar</strong>. La dirección del servidor es <strong>{window.location.origin}</strong>.</li>
        <li>Escribe el código. {mode === 'terminal' ? `El teléfono queda ligado a ${target}.` : `El teléfono queda ligado a ${target}: sólo acepta su tarjeta.`}</li>
        <li>Prueba con una tarjeta: la marca aparece en Asistencia.</li>
      </Box>
    </Box>}
  </SidePanel>
}

/** Revocar un lector: deja de autenticarse al momento; sus marcas anteriores se conservan. */
export function RevokeDeviceModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const cache = useQueryClient()
  const [reason, setReason] = useState('')
  const revoke = useMutation({ mutationFn: () => api<Device>(`/devices/${device.id}/revocation`, 'POST', { reason: reason.trim() }),
    onSuccess: () => { refreshDevices(cache); onClose() }, onError: error => forbidden(cache, error) })
  const short = reason.trim().length < 5
  return <Modal id="revocar-lector" icon="devices" title={`Revocar ${deviceName(device)}`} subtitle="El lector deja de enviar marcas al momento" onClose={onClose}
    submit="Revocar" busy={revoke.isPending} error={revoke.isError ? <Note tone="error">{problemText(revoke.error, 'No se pudo revocar el lector.')}</Note> : undefined}
    onSubmit={() => { if (!short) revoke.mutate() }}>
    <Note tone="warn">Revocar es inmediato: el lector deja de autenticarse y ya no puede enviar marcas. Lo que ya marcó se conserva. Para reemplazarlo, activa otro con un código nuevo.</Note>
    <TextField name="reason" label="Motivo" required multiline minRows={2} autoFocus value={reason} onChange={event => setReason(event.target.value)}
      slotProps={{ htmlInput: { minLength: 5, maxLength: 280 } }} helperText={short && reason ? 'Escribe al menos 5 caracteres.' : 'Queda en la bitácora.'} error={short && !!reason} />
  </Modal>
}
