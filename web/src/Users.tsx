import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Me, type Page, type TenantUser } from './api'
import { EntitySelect, ErrorNotice } from './Directory'
import { RecordName } from './Incidents'
import { showTime } from './incidentModel'

const roles: Record<string, string> = { admin_empresa: 'Administración', rh: 'RH', supervisor: 'Supervisión', trabajador: 'Trabajador', auditor: 'Auditoría' }
const statuses = { invited: 'Invitado', active: 'Activo', disabled: 'Deshabilitado' }
type Action = { kind: 'invite' } | { kind: 'edit' | 'unlink'; user: TenantUser } | { kind: 'password'; user: TenantUser }

export function Users({ me }: { me: Me }) {
  const cache = useQueryClient()
  const allowed = permissions(me.roles).users
  const [action, setAction] = useState<Action | null>(null)
  const list = useInfiniteQuery({ queryKey: ['users'], initialPageParam: '', enabled: allowed,
    queryFn: ({ pageParam }) => api<Page<TenantUser>>(`/users${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`), getNextPageParam: page => page.nextCursor || undefined, retry: false })
  useEffect(() => { if (list.error instanceof ApiError && list.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [list.error, cache])
  if (!allowed) return <Alert severity="info">Sólo quien administra la empresa puede gestionar usuarios.</Alert>
  const rows = list.data?.pages.flatMap(page => page.items) || []
  return <Stack spacing={2}>
    <Typography variant="h5">Usuarios y roles</Typography>
    <Alert severity="info">Estos accesos pertenecen a tu empresa. Invitar no crea la cuenta ni envía correo: la cuenta con correo verificado, su contraseña y segundo factor se administran en Keycloak.</Alert>
    <Button variant="contained" onClick={() => setAction({ kind: 'invite' })}>Invitar usuario</Button>
    <ErrorNotice error={list.error} />{list.isError && <Button onClick={() => void list.refetch()}>Reintentar usuarios</Button>}
    {list.isPending && <Typography role="status">Cargando usuarios…</Typography>}
    {list.isSuccess && !rows.length && <Alert severity="info">Todavía no hay usuarios.</Alert>}
    {!!rows.length && <TableContainer><Table aria-label="Usuarios de la empresa"><TableHead><TableRow>{['Usuario', 'Roles', 'Estado', 'Empleado', 'Acciones'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {rows.map(user => <TableRow key={user.id}>
        <TableCell>{user.displayName || user.email}{user.id === me.userId && ' (Tu cuenta)'}<br />{user.email}</TableCell>
        <TableCell>{user.roles.map(role => roles[role] || role).join(', ')}</TableCell><TableCell>{statuses[user.status]}</TableCell>
        <TableCell>{user.employeeId ? <RecordName kind="employee" id={user.employeeId} me={me} /> : 'Sin vínculo'}</TableCell>
        <TableCell><Button onClick={() => setAction({ kind: 'edit', user })}>Editar {user.email}</Button>{user.linkedAt && <Button onClick={() => setAction({ kind: 'unlink', user })}>Desvincular {user.email}</Button>}{user.linkedAt && user.status === 'active' && <Button onClick={() => setAction({ kind: 'password', user })}>Exigir cambio de contraseña a {user.email}</Button>}</TableCell>
      </TableRow>)}
    </TableBody></Table></TableContainer>}
    {list.hasNextPage && <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Cargar más usuarios</Button>}
    {action?.kind === 'password' ? <PasswordChangeDialog user={action.user} me={me} onClose={() => setAction(null)} /> : action && <UserForm key={action.kind + ('user' in action ? action.user.id : '')} action={action} me={me} onClose={() => setAction(null)} />}
  </Stack>
}

function PasswordChangeDialog({ user, me, onClose }: { user: TenantUser; me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const save = useMutation({ mutationFn: () => api<void>(`/users/${user.id}/password-change`, 'POST'),
    onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="password-change-title">
    <DialogTitle id="password-change-title">Exigir cambio de contraseña</DialogTitle>
    <DialogContent><Stack spacing={2}>
      <Typography>{user.displayName || user.email} · {user.email}</Typography>
      {save.isSuccess ? <Alert severity="success">Cambio obligatorio confirmado. La cuenta deberá establecer una contraseña nueva en su próximo ingreso.</Alert> : <>
        <Alert severity="info">La persona necesita autenticarse con su acceso actual y OTP. Esta acción no recupera una contraseña olvidada, no envía correo y no cierra sesiones existentes.</Alert>
        <FormControlLabel label="Confirmo exigir una contraseña nueva en el próximo ingreso" control={<Checkbox name="confirmPasswordChange" checked={confirmed} disabled={save.isPending} onChange={(_, value) => setConfirmed(value)} />} />
        <ErrorNotice error={save.error} />
      </>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={save.isPending} onClick={onClose}>{save.isSuccess ? 'Listo' : 'Cancelar'}</Button>{!save.isSuccess && <Button variant="contained" disabled={!confirmed || save.isPending} onClick={() => { if (confirmed && !save.isPending && permissions(me.roles).users) save.mutate() }}>{save.isPending ? 'Confirmando…' : 'Confirmar cambio obligatorio'}</Button>}</DialogActions>
  </Dialog>
}

function UserForm({ action, me, onClose }: { action: Exclude<Action, { kind: 'password' }>; me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const user = 'user' in action ? action.user : undefined
  const [selected, setSelected] = useState(user?.roles || [])
  const [employeeId, setEmployee] = useState(user?.employeeId || '')
  const [disabled, setDisabled] = useState(user?.status === 'disabled')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const save = useMutation({ mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) => api<TenantUser>(path, method, body),
    onSuccess: async updated => {
      onClose()
      await Promise.all([cache.invalidateQueries({ queryKey: ['users'] }), cache.invalidateQueries({ queryKey: ['user', updated.id] }), ...(updated.id === me.userId ? [cache.invalidateQueries({ queryKey: ['me'] })] : [])])
    }, onError: failure => { if (failure instanceof ApiError && failure.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending || !permissions(me.roles).users) return
    setError(null)
    if (action.kind === 'unlink') {
      if (confirmed) save.mutate({ path: `/users/${user!.id}/unlink`, method: 'POST' })
      return
    }
    if (!selected.length) { setError(new Error('Selecciona al menos un rol.')); return }
    const data = new FormData(event.currentTarget)
    const displayName = String(data.get('displayName') || '').trim()
    if (user?.displayName && !displayName) { setError(new Error('El nombre existente no puede quedar vacío.')); return }
    if (action.kind === 'invite') {
      save.mutate({ path: '/users', method: 'POST', body: { email: String(data.get('email') || '').trim().toLowerCase(), displayName, roles: selected, ...(employeeId ? { employeeId } : {}) } })
    } else {
      const body = { ...(displayName !== user!.displayName ? { displayName } : {}), ...(selected.slice().sort().join(',') !== user!.roles.slice().sort().join(',') ? { roles: selected } : {}),
        ...(disabled !== (user!.status === 'disabled') ? { disabled } : {}), ...(employeeId !== (user!.employeeId || '') ? { employeeId: employeeId || null } : {}) }
      if (!Object.keys(body).length) { setError(new Error('Cambia al menos un campo.')); return }
      save.mutate({ path: `/users/${user!.id}`, method: 'PATCH', body })
    }
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="user-form-title">
    <form onSubmit={submit}><DialogTitle id="user-form-title">{action.kind === 'invite' ? 'Invitar usuario' : action.kind === 'edit' ? 'Editar usuario' : 'Desvincular cuenta'}</DialogTitle>
      <DialogContent><Stack spacing={2}>
        {action.kind === 'unlink' ? <>
          <Typography>{user!.email}</Typography>
          <Alert severity="warning">Desvincular conserva los roles y no revoca el acceso. Desactiva primero la cuenta anterior en Keycloak: si sigue activa con el mismo correo verificado, puede vincularse otra vez. Para bloquear el acceso a esta empresa, usa Deshabilitar acceso.</Alert>
          <FormControlLabel control={<Checkbox name="confirmUnlink" checked={confirmed} disabled={save.isPending} onChange={(_, value) => setConfirmed(value)} />} label="Confirmo que la cuenta anterior fue desactivada en Keycloak" />
        </> : <>
          <TextField name="email" label="Correo" type="email" defaultValue={user?.email || ''} required disabled={save.isPending || !!user} />
          <TextField name="displayName" label="Nombre visible" defaultValue={user?.displayName || ''} disabled={save.isPending} slotProps={{ htmlInput: { maxLength: 120 } }} />
          <Typography id="user-roles-label">Roles (selecciona al menos uno)</Typography>
          <FormGroup aria-labelledby="user-roles-label">{Object.entries(roles).map(([role, label]) => <FormControlLabel key={role} label={label} control={<Checkbox name="roles" value={role} checked={selected.includes(role)} disabled={save.isPending} onChange={(_, checked) => setSelected(current => checked ? [...current, role] : current.filter(value => value !== role))} />} />)}</FormGroup>
          <EntitySelect kind="employees" name="userEmployeeId" label="Empleado vinculado (opcional)" value={employeeId} onChange={setEmployee} disabled={save.isPending} emptyLabel="Sin empleado vinculado" />
          <Typography>El vínculo identifica al empleado para el rol Trabajador; los roles se asignan por separado.</Typography>
          {user && <>
            <Typography>Estado: {statuses[user.status]} · Alta: {showTime(user.createdAt, me.tenant!.timeZone)}{user.linkedAt && ` · Cuenta vinculada: ${showTime(user.linkedAt, me.tenant!.timeZone)}`}</Typography>
            <FormControlLabel label="Deshabilitar acceso a esta empresa" control={<Checkbox name="disabled" checked={disabled} disabled={save.isPending} onChange={(_, value) => setDisabled(value)} />} />
            <Alert severity="info">La empresa debe conservar al menos un administrador habilitado. El servidor comprueba esta regla al guardar.</Alert>
            {user.id === me.userId && <Alert severity="warning">Estás editando tu propio acceso. Al guardar, tus permisos se actualizarán y podrías perder acceso a esta sección.</Alert>}
          </>}
        </>}
        <ErrorNotice error={error} /><ErrorNotice error={save.error} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained" disabled={save.isPending || (action.kind === 'unlink' && !confirmed)}>{save.isPending ? 'Guardando…' : action.kind === 'unlink' ? 'Confirmar desvinculación' : 'Guardar usuario'}</Button></DialogActions>
    </form>
  </Dialog>
}
