import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Card, type Employee, type Me, type Page, type Site } from './api'

type Kind = 'sites' | 'employees' | 'cards'
type Row = Site | Employee | Card
type Action = { mode: 'create' | 'edit' | 'assign' | 'revoke'; row?: Row }
const names = { sites: 'Sedes', employees: 'Empleados', cards: 'Tarjetas' }
const statuses: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', inventory: 'Inventario', assigned: 'Asignada', revoked: 'Revocada', lost: 'Extraviada', damaged: 'Dañada', replaced: 'Reemplazada' }

function EntitySelect({ kind, name, label, value = '', required = false }: { kind: 'sites' | 'employees'; name: string; label: string; value?: string; required?: boolean }) {
  const options = useInfiniteQuery({
    queryKey: [kind], initialPageParam: '',
    queryFn: ({ pageParam }) => api<Page<Site | Employee>>(`/${kind}${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: page => page.nextCursor || undefined, retry: false,
  })
  const items = options.data?.pages.flatMap(page => page.items) || []
  return <>
    <TextField select name={name} label={label} defaultValue={value} required disabled={options.isPending}>
      <MenuItem value="">{required ? 'Selecciona una persona' : 'Sin sede'}</MenuItem>
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

export function Directory({ kind, me }: { kind: Kind; me: Me }) {
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const writable = kind === 'sites' ? allowed.editSites : allowed.editDirectory
  const [action, setAction] = useState<Action | null>(null)
  const list = useInfiniteQuery({
    queryKey: [kind], initialPageParam: '',
    queryFn: ({ pageParam }) => api<Page<Row>>(`/${kind}${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: page => page.nextCursor || undefined, retry: false,
  })
  const rows = list.data?.pages.flatMap(page => page.items) || []
  useEffect(() => {
    if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] })
  }, [list.error, cache])
  const save = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body: unknown }) => api(path, method, body),
    onSuccess: async () => {
      setAction(null)
      await Promise.all([cache.invalidateQueries({ queryKey: [kind] }), cache.invalidateQueries({ queryKey: ['employees'] })])
    },
    onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) },
  })
  const open = (next: Action) => { save.reset(); setAction(next) }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action || save.isPending || !writable) return
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) || '').trim()
    let path = `/${kind}`
    let method = 'POST'
    let body: unknown
    if (action.mode === 'assign') {
      path += `/${action.row!.id}/assignments`
      body = { employeeId: value('employeeId') }
    } else if (action.mode === 'revoke') {
      path += `/${action.row!.id}/revocation`
      body = { reason: value('reason'), note: value('note') }
    } else if (kind === 'sites') {
      body = { name: value('name'), timeZone: value('timeZone'), latitude: Number(value('latitude')), longitude: Number(value('longitude')), radiusMeters: Number(value('radiusMeters')), ...(action.mode === 'edit' ? { status: value('status') } : {}) }
    } else if (kind === 'employees') {
      body = { displayName: value('displayName'), siteId: value('siteId') || null,
        ...(action.mode === 'create' ? { externalId: value('externalId'), employmentStart: value('employmentStart') } : { status: value('status'), employmentEnd: value('employmentEnd') || null }) }
    } else body = { label: value('label'), fingerprint: value('fingerprint') }
    if (action.mode === 'edit') { path += `/${action.row!.id}`; method = 'PATCH' }
    save.mutate({ path, method, body })
  }
  const site = action?.row as Site | undefined
  const employee = action?.row as Employee | undefined
  return <Stack spacing={2}>
    <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="h5">{names[kind]}</Typography>{writable && <Button variant="contained" onClick={() => open({ mode: 'create' })}>Agregar</Button>}</Stack>
    <ErrorNotice error={list.error} />
    {list.isError && <Button onClick={() => void list.refetch()}>Reintentar</Button>}
    {list.isPending && <Typography role="status">Cargando…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">Todavía no hay registros.</Alert>}
    {!!rows.length && <TableContainer><Table aria-label={names[kind]}>
      <TableHead><TableRow><TableCell>{kind === 'employees' ? 'Empleado' : 'Nombre / número'}</TableCell><TableCell>Detalle</TableCell><TableCell>Estado</TableCell>{writable && <TableCell>Acciones</TableCell>}</TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.id}>
        <TableCell>{'displayName' in row ? row.displayName : 'name' in row ? row.name : row.label}</TableCell>
        <TableCell>{'radiusMeters' in row ? `${row.timeZone} · Radio ${row.radiusMeters} m` : 'externalId' in row ? `${row.externalId} · Alta ${row.employmentStart}` : row.assignment ? `Empleado: ${row.assignment.employeeId}` : 'Sin asignar'}</TableCell>
        <TableCell>{statuses[row.status] || row.status}</TableCell>
        {writable && <TableCell>{kind !== 'cards' ? <Button onClick={() => open({ mode: 'edit', row })}>Editar</Button> : <>
          {row.status === 'inventory' && <Button onClick={() => open({ mode: 'assign', row })}>Asignar</Button>}
          {!['revoked', 'lost', 'damaged', 'replaced'].includes(row.status) && <Button color="error" onClick={() => open({ mode: 'revoke', row })}>Revocar</Button>}
        </>}</TableCell>}
      </TableRow>)}</TableBody>
    </Table></TableContainer>}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más</Button>}
    <Dialog open={!!action && writable} onClose={() => { if (!save.isPending) setAction(null) }} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>{action?.mode === 'create' ? 'Agregar registro' : action?.mode === 'edit' ? 'Editar registro' : action?.mode === 'assign' ? 'Asignar tarjeta' : 'Revocar tarjeta'}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <ErrorNotice error={save.error} />
          {action?.mode === 'assign' ? <>
            <Alert severity="info">Si el empleado tiene otra tarjeta, será reemplazada al confirmar.</Alert>
            <EntitySelect kind="employees" name="employeeId" label="Empleado" required />
          </> : action?.mode === 'revoke' ? <>
            <Alert severity="warning">La tarjeta dejará de permitir marcajes. Esta operación no se puede deshacer.</Alert>
            <TextField select name="reason" label="Motivo" defaultValue="revoked">{['revoked', 'lost', 'damaged'].map(value => <MenuItem key={value} value={value}>{statuses[value]}</MenuItem>)}</TextField>
            <TextField name="note" label="Nota" slotProps={{ htmlInput: { maxLength: 280 } }} />
          </> : kind === 'sites' ? <>
            <TextField name="name" label="Nombre" required defaultValue={site?.name || ''} slotProps={{ htmlInput: { maxLength: 120 } }} />
            <TextField name="timeZone" label="Zona horaria" required defaultValue={site?.timeZone || me.tenant?.timeZone || 'America/Mexico_City'} />
            <TextField name="latitude" label="Latitud" type="number" required defaultValue={site?.latitude ?? ''} slotProps={{ htmlInput: { min: -90, max: 90, step: 'any' } }} />
            <TextField name="longitude" label="Longitud" type="number" required defaultValue={site?.longitude ?? ''} slotProps={{ htmlInput: { min: -180, max: 180, step: 'any' } }} />
            <TextField name="radiusMeters" label="Radio de geocerca (metros)" type="number" required defaultValue={site?.radiusMeters ?? 100} slotProps={{ htmlInput: { min: 20, max: 2000, step: 1 } }} />
            {action?.mode === 'edit' && <TextField select name="status" label="Estado" defaultValue={site?.status}>{['active', 'inactive'].map(value => <MenuItem key={value} value={value}>{statuses[value]}</MenuItem>)}</TextField>}
          </> : kind === 'employees' ? <>
            {action?.mode === 'create' && <TextField name="externalId" label="Identificador externo" required slotProps={{ htmlInput: { maxLength: 64 } }} />}
            <TextField name="displayName" label="Nombre" required defaultValue={employee?.displayName || ''} slotProps={{ htmlInput: { maxLength: 160 } }} />
            <EntitySelect kind="sites" name="siteId" label="Sede" value={employee?.siteId || ''} />
            {action?.mode === 'create' ? <TextField name="employmentStart" label="Fecha de alta" type="date" required slotProps={{ inputLabel: { shrink: true } }} /> : <>
              <TextField select name="status" label="Estado" defaultValue={employee?.status}>{['active', 'inactive'].map(value => <MenuItem key={value} value={value}>{statuses[value]}</MenuItem>)}</TextField>
              <TextField name="employmentEnd" label="Fecha de baja (opcional)" type="date" defaultValue={employee?.employmentEnd || ''} slotProps={{ inputLabel: { shrink: true } }} />
            </>}
          </> : <>
            <TextField name="label" label="Número impreso" required slotProps={{ htmlInput: { maxLength: 40 } }} />
            <TextField name="fingerprint" label="Huella de tarjeta" required slotProps={{ htmlInput: { minLength: 16, maxLength: 128 } }} helperText="Se registra una vez; no se podrá consultar después." />
          </>}
        </Stack></DialogContent>
        <DialogActions><Button disabled={save.isPending} onClick={() => setAction(null)}>Cancelar</Button><Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Confirmar'}</Button></DialogActions>
      </form>
    </Dialog>
  </Stack>
}
