import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Device, type DeviceEnrollment, type Me, type Page } from './api'
import { EntitySelect, ErrorNotice } from './Directory'
import { RecordName } from './Incidents'
import { showTime } from './incidentModel'

const modes = { personal: 'Teléfono personal', terminal: 'Terminal compartida' }
const statuses = { active: 'Activo', revoked: 'Revocado', replaced: 'Reemplazado' }

export function Devices({ me }: { me: Me }) {
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const [action, setAction] = useState<{ kind: 'enroll' } | { kind: 'revoke'; device: Device } | null>(null)
  const list = useInfiniteQuery({ queryKey: ['devices'], initialPageParam: '', enabled: allowed.devices,
    queryFn: ({ pageParam }) => api<Page<Device>>(`/devices${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: page => page.nextCursor || undefined, retry: false })
  useEffect(() => { if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [list.error, cache])
  if (!allowed.devices) return <Alert severity="info">Tu rol no consulta dispositivos.</Alert>
  const rows = list.data?.pages.flatMap(page => page.items) || []
  return <Stack spacing={2}>
    <Typography variant="h5">Dispositivos</Typography>
    <Alert severity="info">Para activar un teléfono, emite un código y escríbelo en la app junto con la dirección del servidor: <strong>{window.location.origin}</strong>. El código vale una sola vez y por poco tiempo, y sólo se muestra al emitirlo.</Alert>
    {allowed.manageDevices && <Button variant="contained" onClick={() => setAction({ kind: 'enroll' })}>Emitir código</Button>}
    <ErrorNotice error={list.error} />{list.isError && <Button onClick={() => void list.refetch()}>Reintentar dispositivos</Button>}
    {list.isPending && <Typography role="status">Cargando dispositivos…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">Todavía no hay dispositivos activados.</Alert>}
    {!!rows.length && <TableContainer><Table aria-label="Dispositivos de la empresa"><TableHead><TableRow>{['Modalidad', 'Asignado a', 'Teléfono', 'Estado', 'Activado', 'Última conexión', ...(allowed.manageDevices ? ['Acciones'] : [])].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {rows.map(device => <TableRow key={device.id}>
        <TableCell>{modes[device.mode]}{device.label && <><br />{device.label}</>}</TableCell>
        <TableCell>{device.mode === 'personal' ? <RecordName kind="employee" id={device.employeeId} me={me} /> : <RecordName kind="site" id={device.siteId} me={me} />}</TableCell>
        <TableCell>{device.model}{device.appVersion && <><br />App {device.appVersion}</>}</TableCell>
        <TableCell>{statuses[device.status]}{device.revokedAt && <><br />{showTime(device.revokedAt, me.tenant!.timeZone)}</>}</TableCell>
        <TableCell>{showTime(device.enrolledAt, me.tenant!.timeZone)}</TableCell>
        <TableCell>{device.lastSeenAt ? showTime(device.lastSeenAt, me.tenant!.timeZone) : 'Sin conexión todavía'}</TableCell>
        {allowed.manageDevices && <TableCell>{device.status === 'active' && <Button onClick={() => setAction({ kind: 'revoke', device })}>Revocar {device.model}</Button>}</TableCell>}
      </TableRow>)}
    </TableBody></Table></TableContainer>}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más dispositivos</Button>}
    {action?.kind === 'enroll' && <EnrollForm me={me} onClose={() => setAction(null)} />}
    {action?.kind === 'revoke' && <RevokeForm device={action.device} onClose={() => setAction(null)} />}
  </Stack>
}

function EnrollForm({ me, onClose }: { me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const [mode, setMode] = useState<'personal' | 'terminal'>('personal')
  const [target, setTarget] = useState('')
  const emit = useMutation({ mutationFn: (body: unknown) => api<DeviceEnrollment>('/device-enrollments', 'POST', body),
    onError: failure => { if (failure instanceof ApiError && failure.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (emit.isPending || !target) return
    const label = String(new FormData(event.currentTarget).get('label') || '').trim()
    emit.mutate(mode === 'personal' ? { mode, employeeId: target } : { mode, siteId: target, ...(label ? { label } : {}) })
  }
  const issued = emit.data
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!emit.isPending) onClose() }} aria-labelledby="enroll-form-title">
    <form onSubmit={submit}><DialogTitle id="enroll-form-title">Emitir código de activación</DialogTitle>
      <DialogContent><Stack spacing={2}>
        {issued ? <>
          <Alert severity="success">Código para {modes[issued.mode].toLowerCase()}: <strong style={{ fontFamily: 'monospace', fontSize: '1.4em' }}>{issued.code}</strong></Alert>
          <Typography>Vence: {showTime(issued.expiresAt, me.tenant!.timeZone)}. Se usa una sola vez; si vence, emite otro.</Typography>
          <Typography>Dirección del servidor en la app: {window.location.origin}</Typography>
        </> : <>
          <TextField select name="mode" label="Modalidad" value={mode} disabled={emit.isPending} onChange={event => { setMode(event.target.value as 'personal' | 'terminal'); setTarget('') }}>
            {Object.entries(modes).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          {mode === 'personal'
            ? <EntitySelect key="employees" kind="employees" name="enrollEmployeeId" label="Persona que usará el teléfono" value={target} onChange={setTarget} required disabled={emit.isPending} emptyLabel="Selecciona una persona" />
            : <>
              <EntitySelect key="sites" kind="sites" name="enrollSiteId" label="Sede de la terminal" value={target} onChange={setTarget} required disabled={emit.isPending} emptyLabel="Selecciona una sede" />
              <TextField name="label" label="Nombre de la terminal (opcional)" disabled={emit.isPending} slotProps={{ htmlInput: { maxLength: 60 } }} />
            </>}
          <ErrorNotice error={emit.error} />
        </>}
      </Stack></DialogContent>
      <DialogActions>{issued
        ? <Button variant="contained" onClick={() => { onClose(); void cache.invalidateQueries({ queryKey: ['devices'] }) }}>Listo</Button>
        : <><Button disabled={emit.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained" disabled={emit.isPending || !target}>{emit.isPending ? 'Emitiendo…' : 'Emitir código'}</Button></>}
      </DialogActions>
    </form>
  </Dialog>
}

function RevokeForm({ device, onClose }: { device: Device; onClose: () => void }) {
  const cache = useQueryClient()
  const revoke = useMutation({ mutationFn: (reason: string) => api<Device>(`/devices/${device.id}/revocation`, 'POST', { reason }),
    onSuccess: async () => { onClose(); await cache.invalidateQueries({ queryKey: ['devices'] }) },
    onError: failure => { if (failure instanceof ApiError && failure.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!revoke.isPending) revoke.mutate(String(new FormData(event.currentTarget).get('reason') || '').trim())
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!revoke.isPending) onClose() }} aria-labelledby="revoke-form-title">
    <form onSubmit={submit}><DialogTitle id="revoke-form-title">Revocar dispositivo</DialogTitle>
      <DialogContent><Stack spacing={2}>
        <Typography>{device.model} · {modes[device.mode]}</Typography>
        <Alert severity="warning">El teléfono deja de poder marcar y sincronizar. Sus marcajes anteriores se conservan. Para volver a usarlo hay que activarlo con un código nuevo.</Alert>
        <TextField name="reason" label="Motivo" required multiline minRows={2} disabled={revoke.isPending} slotProps={{ htmlInput: { minLength: 5, maxLength: 280 } }} />
        <ErrorNotice error={revoke.error} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={revoke.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" color="error" variant="contained" disabled={revoke.isPending}>{revoke.isPending ? 'Revocando…' : 'Confirmar revocación'}</Button></DialogActions>
    </form>
  </Dialog>
}
