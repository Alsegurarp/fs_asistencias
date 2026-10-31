import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Me, type Page, type Tenant, type TenantUsage } from './api'
import { ErrorNotice } from './Directory'
import { showTime } from './incidentModel'

export const days = { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' }
export const breaks = { not_considered: 'No se marca', marked: 'Se marca' }
const statuses: Record<string, string> = { active: 'Activa', suspended: 'Suspendida' }

/** Pantalla de quien opera el servicio: da de alta empresas y deja invitada a quien las administra. */
export function Tenants({ me }: { me: Me }) {
  const cache = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [reactivating, setReactivating] = useState<Tenant | null>(null)
  const [usageOf, setUsageOf] = useState<Tenant | null>(null)
  const allowed = me.roles.includes('operador_saas')
  const list = useInfiniteQuery({ queryKey: ['tenants'], initialPageParam: '', enabled: allowed,
    queryFn: ({ pageParam }) => api<Page<Tenant>>(`/tenants${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: page => page.nextCursor || undefined, retry: false })
  useEffect(() => { if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [list.error, cache])
  if (!allowed) return <Alert severity="info">Sólo quien opera el servicio puede gestionar empresas.</Alert>
  const rows = list.data?.pages.flatMap(page => page.items) || []
  return <Stack spacing={2}>
    <Typography variant="h5">Empresas</Typography>
    <Alert severity="info">Tu cuenta opera el servicio: das de alta empresas y dejas invitada a quien las administra. No ves sus datos internos.</Alert>
    <Button variant="contained" onClick={() => setCreating(true)}>Dar de alta empresa</Button>
    <ErrorNotice error={list.error} />{list.isError && <Button onClick={() => void list.refetch()}>Reintentar empresas</Button>}
    {list.isPending && <Typography role="status">Cargando empresas…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">Todavía no hay empresas.</Alert>}
    {!!rows.length && <TableContainer><Table aria-label="Empresas del servicio"><TableHead><TableRow>{['Empresa', 'Zona horaria', 'Semana', 'Descanso', 'Estado', 'Alta', 'Acciones'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {rows.map(tenant => <TableRow key={tenant.id}>
        <TableCell>{tenant.name}<br />{tenant.slug}</TableCell><TableCell>{tenant.timeZone}</TableCell>
        <TableCell>Empieza en {days[tenant.weekStartsOn].toLowerCase()}</TableCell><TableCell>{breaks[tenant.breakPolicy]}</TableCell>
        <TableCell>{statuses[tenant.status] || tenant.status}</TableCell><TableCell>{showTime(tenant.createdAt, tenant.timeZone)}</TableCell>
        <TableCell><Button onClick={() => setUsageOf(tenant)}>Uso de {tenant.name}</Button>{tenant.status === 'suspended' && <Button onClick={() => setReactivating(tenant)}>Reactivar {tenant.name}</Button>}</TableCell>
      </TableRow>)}
    </TableBody></Table></TableContainer>}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más empresas</Button>}
    {creating && <TenantForm me={me} onClose={() => setCreating(false)} />}
    {reactivating && <ReactivationForm tenant={reactivating} me={me} onClose={() => setReactivating(null)} />}
    {usageOf && <UsageDialog tenant={usageOf} onClose={() => setUsageOf(null)} />}
  </Stack>
}

/** Mes en curso en la zona horaria de la empresa, como AAAA-MM. */
export function currentMonth(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now)
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`
}

const usageRows: [keyof TenantUsage, string][] = [
  ['employeesWithAttendance', 'Personas que marcaron en el mes'],
  ['employeesInPeriod', 'Personas con relación laboral vigente en el mes'],
  ['cardsAssigned', 'Tarjetas asignadas en el mes'],
  ['devicesActive', 'Teléfonos y terminales activos en el mes'],
  ['attendanceEvents', 'Marcajes del mes'],
]

/** Conteos de un mes para facturar fuera del servicio; nunca muestra datos de personas. */
function UsageDialog({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const latest = currentMonth(tenant.timeZone)
  const [month, setMonth] = useState(latest)
  const valid = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)
  const usage = useQuery({ queryKey: ['tenant-usage', tenant.id, month], enabled: valid, retry: false,
    queryFn: () => api<TenantUsage>(`/tenants/${tenant.id}/usage?month=${encodeURIComponent(month)}`) })
  return <Dialog open fullWidth maxWidth="sm" onClose={onClose} aria-labelledby="usage-title">
    <DialogTitle id="usage-title">Uso de {tenant.name}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Typography>Conteos del mes en la zona horaria de la empresa ({tenant.timeZone}). No incluyen datos de personas; qué se cobra lo decide el precio.</Typography>
      <TextField name="month" label="Mes" type="month" value={month} onChange={event => setMonth(event.target.value)} required helperText={valid ? 'Desde el alta de la empresa hasta el mes en curso.' : 'Elige un mes en la forma AAAA-MM.'} error={!valid} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: latest } }} />
      <ErrorNotice error={usage.error} />
      {usage.isFetching && <Typography role="status">Cargando uso…</Typography>}
      {usage.data && <>
        <Table aria-label={`Uso de ${tenant.name} en ${usage.data.month}`}><TableBody>
          {usageRows.map(([key, label]) => <TableRow key={key}><TableCell component="th" scope="row">{label}</TableCell><TableCell align="right">{String(usage.data[key])}</TableCell></TableRow>)}
        </TableBody></Table>
        <Alert severity={usage.data.complete ? 'success' : 'info'}>{usage.data.complete ? 'Mes terminado: estos conteos ya no cambian.' : 'Mes en curso: los conteos siguen creciendo hasta que termine.'}</Alert>
      </>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
  </Dialog>
}

function ReactivationForm({ tenant, me, onClose }: { tenant: Tenant; me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const [reason, setReason] = useState('')
  const save = useMutation({ mutationFn: () => api<Tenant>(`/tenants/${tenant.id}/reactivation`, 'POST', { reason: reason.trim() }),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['tenants'] }); onClose() },
    onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="reactivation-title">
    <form onSubmit={event => { event.preventDefault(); if (!save.isPending && me.roles.includes('operador_saas') && reason.trim().length >= 10 && reason.trim().length <= 500) save.mutate() }}>
      <DialogTitle id="reactivation-title">Reactivar empresa</DialogTitle>
      <DialogContent><Stack spacing={2}>
        <Typography>Confirma la reactivación de {tenant.name}. Se restablecerá su acceso al servicio y el motivo quedará en la bitácora.</Typography>
        <TextField name="reason" label="Motivo de reactivación" value={reason} onChange={event => setReason(event.target.value)} required disabled={save.isPending} helperText="Entre 10 y 500 caracteres." slotProps={{ htmlInput: { maxLength: 500 } }} />
        <ErrorNotice error={save.error} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained" disabled={save.isPending || reason.trim().length < 10 || reason.trim().length > 500}>{save.isPending ? 'Reactivando…' : 'Confirmar reactivación'}</Button></DialogActions>
    </form>
  </Dialog>
}

function TenantForm({ me, onClose }: { me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const create = useMutation({ mutationFn: (body: unknown) => api<Tenant>('/tenants', 'POST', body),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['tenants'] }),
    onError: failure => { if (failure instanceof ApiError && failure.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (create.isPending || !me.roles.includes('operador_saas')) return
    const data = new FormData(event.currentTarget)
    const text = (name: string) => String(data.get(name) || '').trim()
    create.mutate({ name: text('name'), slug: text('slug').toLowerCase(), timeZone: text('timeZone'), weekStartsOn: text('weekStartsOn'), breakPolicy: text('breakPolicy'), firstAdminEmail: text('firstAdminEmail').toLowerCase() })
  }
  const created = create.data
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!create.isPending) onClose() }} aria-labelledby="tenant-form-title">
    <form onSubmit={submit}><DialogTitle id="tenant-form-title">Dar de alta empresa</DialogTitle>
      <DialogContent><Stack spacing={2}>
        {created ? <Alert severity="success">Se dio de alta {created.name}. Quien la administra entra con una cuenta cuyo correo esté verificado y sea el que indicaste; desde ahí invita al resto.</Alert> : <>
          <TextField name="name" label="Nombre" required disabled={create.isPending} slotProps={{ htmlInput: { maxLength: 120 } }} />
          <TextField name="slug" label="Identificador" required disabled={create.isPending} helperText="Minúsculas, números y guiones; no se cambia después." slotProps={{ htmlInput: { maxLength: 60, pattern: '[A-Za-z0-9]+(-[A-Za-z0-9]+)*' } }} />
          <TextField name="timeZone" label="Zona horaria" required defaultValue="America/Mexico_City" disabled={create.isPending} />
          <TextField select name="weekStartsOn" label="La semana empieza en" defaultValue="monday" disabled={create.isPending}>
            {Object.entries(days).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField select name="breakPolicy" label="Descanso o comida" defaultValue="" required disabled={create.isPending} helperText="Se elige al dar de alta; no tiene valor por defecto.">
            <MenuItem value="">Selecciona una opción</MenuItem>
            {Object.entries(breaks).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField name="firstAdminEmail" label="Correo de quien la administrará" type="email" required disabled={create.isPending} slotProps={{ htmlInput: { maxLength: 254 } }} />
          <ErrorNotice error={create.error} />
        </>}
      </Stack></DialogContent>
      <DialogActions>{created
        ? <Button variant="contained" onClick={onClose}>Listo</Button>
        : <><Button disabled={create.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained" disabled={create.isPending}>{create.isPending ? 'Guardando…' : 'Guardar empresa'}</Button></>}
      </DialogActions>
    </form>
  </Dialog>
}
