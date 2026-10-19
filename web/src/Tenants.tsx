import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Me, type Page, type Tenant } from './api'
import { ErrorNotice } from './Directory'
import { showTime } from './incidentModel'

const days = { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' }
const breaks = { not_considered: 'No se marca', marked: 'Se marca' }
const statuses: Record<string, string> = { active: 'Activa', suspended: 'Suspendida' }

/** Pantalla de quien opera el servicio: da de alta empresas y deja invitada a quien las administra. */
export function Tenants({ me }: { me: Me }) {
  const cache = useQueryClient()
  const [creating, setCreating] = useState(false)
  const list = useInfiniteQuery({ queryKey: ['tenants'], initialPageParam: '',
    queryFn: ({ pageParam }) => api<Page<Tenant>>(`/tenants${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: page => page.nextCursor || undefined, retry: false })
  useEffect(() => { if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [list.error, cache])
  const rows = list.data?.pages.flatMap(page => page.items) || []
  return <Stack spacing={2}>
    <Typography variant="h5">Empresas</Typography>
    <Alert severity="info">Tu cuenta opera el servicio: das de alta empresas y dejas invitada a quien las administra. No ves sus datos internos.</Alert>
    <Button variant="contained" onClick={() => setCreating(true)}>Dar de alta empresa</Button>
    <ErrorNotice error={list.error} />{list.isError && <Button onClick={() => void list.refetch()}>Reintentar empresas</Button>}
    {list.isPending && <Typography role="status">Cargando empresas…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">Todavía no hay empresas.</Alert>}
    {!!rows.length && <TableContainer><Table aria-label="Empresas del servicio"><TableHead><TableRow>{['Empresa', 'Zona horaria', 'Semana', 'Descanso', 'Estado', 'Alta'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {rows.map(tenant => <TableRow key={tenant.id}>
        <TableCell>{tenant.name}<br />{tenant.slug}</TableCell><TableCell>{tenant.timeZone}</TableCell>
        <TableCell>Empieza en {days[tenant.weekStartsOn].toLowerCase()}</TableCell><TableCell>{breaks[tenant.breakPolicy]}</TableCell>
        <TableCell>{statuses[tenant.status] || tenant.status}</TableCell><TableCell>{showTime(tenant.createdAt, tenant.timeZone)}</TableCell>
      </TableRow>)}
    </TableBody></Table></TableContainer>}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más empresas</Button>}
    {creating && <TenantForm me={me} onClose={() => setCreating(false)} />}
  </Stack>
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
