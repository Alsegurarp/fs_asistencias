import { type ReactNode, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, ButtonBase, Checkbox, Stack, TextField, Typography } from '@mui/material'
import { api, ApiError, type Employee, type Me, type Site } from './api'
import { color, font } from './design'
import { type Picked, PersonPicker } from './DeviceForms'
import { Icon } from './Icons'
import { problemText } from './personnelData'
import { initials } from './Shell'
import { FilterChip, Modal, Note, SidePanel, tableSx } from './ui'
import {
  type AccessDraft, type UserRow, accessChanges, accessDraft, accessProblem, permissionRows, sinceText, tenantRoles,
} from './usersModel'

/** Lo que cambia cuando cambia un acceso: la lista, sus cifras, la persona y, si es la propia, la sesión. */
function refreshUsers(cache: ReturnType<typeof useQueryClient>, me: Me, id: string) {
  for (const key of ['users', 'user-summary', 'user']) void cache.invalidateQueries({ queryKey: [key] })
  if (id === me.userId) { void cache.invalidateQueries({ queryKey: ['me'] }); void cache.invalidateQueries({ queryKey: ['dossier-permission'] }) }
}

function forbidden(cache: ReturnType<typeof useQueryClient>, error: unknown) {
  if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] })
}

const legend = { fontSize: 13, fontWeight: 600, color: color.inkSoft, mb: 0.75, p: 0 } as const
const fieldset = { border: 0, m: 0, p: 0, minWidth: 0 } as const

/** Roles como interruptores: una persona puede tener varios. */
function RoleChips({ value, onChange, disabled, detailed = false }: { value: string[]; onChange: (roles: string[]) => void; disabled?: boolean; detailed?: boolean }) {
  const toggle = (role: string) => onChange(value.includes(role) ? value.filter(item => item !== role) : [...value, role])
  if (detailed) return <Box component="fieldset" sx={fieldset}>
    <Box component="legend" sx={legend}>Rol</Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1 }}>
      {tenantRoles.map(role => <Box component="label" key={role.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: '8px 10px 8px 4px', borderRadius: '12px', cursor: 'pointer',
        border: `1px solid ${value.includes(role.key) ? color.fieldHover : color.line}`, background: value.includes(role.key) ? color.selected : color.white }}>
        <Checkbox name="roles" value={role.key} size="small" checked={value.includes(role.key)} disabled={disabled} onChange={() => toggle(role.key)} sx={{ p: 0.5 }} />
        <Box sx={{ pt: '3px' }}><Box component="strong" sx={{ display: 'block', fontSize: 14 }}>{role.label}</Box><Box component="span" sx={{ fontSize: 12, color: color.muted }}>{role.detail}</Box></Box>
      </Box>)}
    </Box>
  </Box>
  return <Box component="fieldset" sx={fieldset}>
    <Box component="legend" sx={legend}>Rol</Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {tenantRoles.map(role => <FilterChip key={role.key} pressed={value.includes(role.key)} onClick={() => { if (!disabled) toggle(role.key) }}>{role.label}</FilterChip>)}
    </Box>
  </Box>
}

/** Las sedes de Supervisión; las inactivas sólo aparecen si ya estaban asignadas. */
function SiteChips({ sites, value, onChange, disabled }: { sites: Site[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const shown = sites.filter(site => site.status === 'active' || value.includes(site.id))
  return <Box component="fieldset" sx={fieldset}>
    <Box component="legend" sx={legend}>Sedes que supervisa</Box>
    {shown.length ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {shown.map(site => <FilterChip key={site.id} pressed={value.includes(site.id)} onClick={() => { if (!disabled) onChange(value.includes(site.id) ? value.filter(id => id !== site.id) : [...value, site.id]) }}>
        {site.name}{site.status !== 'active' && ' (inactiva)'}
      </FilterChip>)}
    </Box> : <Typography sx={{ fontSize: 13, color: color.muted }}>Todavía no hay sedes; agrégalas en Configuración.</Typography>}
    <Typography sx={{ mt: 0.75, fontSize: 12.5, color: value.length ? color.muted : color.warnText }}>Ve y resuelve sólo lo de estas sedes. Sin sedes no ve a nadie.</Typography>
  </Box>
}

/** La fila del padrón ligada a la cuenta, para el rol Trabajador. */
function LinkedPerson({ employeeId, onChange, disabled }: { employeeId: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const current = useQuery({ queryKey: ['employee', employeeId], queryFn: () => api<Employee>(`/employees/${employeeId}`), enabled: !!employeeId && picked?.id !== employeeId, retry: false, staleTime: 60_000 })
  const value: Picked | null = !employeeId ? null : picked?.id === employeeId ? picked
    : current.data ? current.data : { id: employeeId, displayName: current.isError ? 'Persona del padrón' : 'Cargando…', externalId: '' }
  return <PersonPicker label="Su fila del padrón" value={value} disabled={disabled} onChange={person => { setPicked(person); onChange(person?.id || null) }} />
}

function DossierCheck({ checked, onChange, disabled, hint }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; hint: string }) {
  return <Box component="label" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: '10px 12px 10px 6px', borderRadius: '12px', background: color.page, cursor: disabled ? 'default' : 'pointer' }}>
    <Checkbox name="dossierPermission" size="small" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} sx={{ p: 0.5 }} />
    <Box sx={{ pt: '3px' }}>
      <Box component="strong" sx={{ display: 'block', fontSize: 14, color: disabled ? color.muted : color.ink }}>Puede descargar el expediente de la empresa</Box>
      <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{hint}</Box>
    </Box>
  </Box>
}

/**
 * «Editar acceso» (EMP-04): nombre, roles, sedes de Supervisión, la fila del
 * padrón y el permiso del expediente se guardan juntos; la seguridad de la
 * cuenta va aparte, cada acción con su confirmación.
 */
export function AccessPanel({ id, initial, me, sites, onClose }: { id: string; initial?: UserRow; me: Me; sites: Site[]; onClose: () => void }) {
  const user = useQuery({ queryKey: ['user', id], queryFn: () => api<UserRow>(`/users/${id}`), initialData: initial, retry: false, staleTime: initial ? 15_000 : 0 })
  if (!user.data) return <SidePanel title={user.isError ? 'No encontramos a esta persona' : 'Cargando…'} onClose={onClose}>
    {user.isError ? <Note tone="error">{problemText(user.error, 'Puede que la dirección esté incompleta.')}</Note> : <Typography role="status" sx={{ color: color.muted }}>Cargando…</Typography>}
  </SidePanel>
  return <AccessForm key={user.data.id} user={user.data} me={me} sites={sites} onClose={onClose} />
}

type Confirm = 'password' | 'unlink' | 'disable' | 'enable'

function AccessForm({ user, me, sites, onClose }: { user: UserRow; me: Me; sites: Site[]; onClose: () => void }) {
  const cache = useQueryClient()
  const timeZone = me.tenant!.timeZone
  const [draft, setDraft] = useState<AccessDraft>(() => accessDraft(user))
  const [problem, setProblem] = useState<string>()
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const set = <K extends keyof AccessDraft>(key: K, value: AccessDraft[K]) => { setProblem(undefined); setDraft(current => ({ ...current, [key]: value })) }
  const changes = accessChanges(user, draft)
  const changed = Object.keys(changes.body).length > 0 || changes.dossier !== undefined
  const save = useMutation({
    mutationFn: async () => {
      if (Object.keys(changes.body).length) await api<UserRow>(`/users/${user.id}`, 'PATCH', changes.body)
      if (changes.dossier !== undefined) await api(`/users/${user.id}/dossier-permission`, 'PUT', { enabled: changes.dossier })
    },
    onSuccess: () => { refreshUsers(cache, me, user.id); onClose() },
    onError: error => { forbidden(cache, error); refreshUsers(cache, me, user.id) },
  })
  const busy = save.isPending
  const linked = !!user.linkedAt
  const canGrant = user.status === 'active' && linked
  const submit = () => {
    if (busy) return
    const wrong = accessProblem(draft, !!user.displayName)
    if (wrong) { setProblem(wrong); return }
    if (!changed) { onClose(); return }
    save.mutate()
  }
  const label = user.displayName || user.email
  return <>
    <SidePanel title={`Acceso de ${label}`} initials={initials(label)} subtitle={`${user.email} · ${sinceText(user, timeZone)}`} onClose={() => { if (!busy) onClose() }}
      footer={<>
        <Button variant="outlined" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={busy} onClick={submit}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
      </>}>
      <Box component="form" aria-label="Editar acceso" noValidate onSubmit={event => { event.preventDefault(); submit() }} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {user.id === me.userId && <Note tone="warn">Es tu propio acceso: si te quitas Administración dejarás de ver esta sección. La empresa siempre conserva a alguien con Administración.</Note>}
        {user.status === 'disabled' && <Note tone="warn">Su acceso está deshabilitado: no entra al portal aunque tenga roles.</Note>}
        <TextField name="displayName" label="Nombre" value={draft.displayName} onChange={event => set('displayName', event.target.value)} disabled={busy} size="small" slotProps={{ htmlInput: { maxLength: 120 } }} />
        <RoleChips value={draft.roles} onChange={roles => set('roles', roles)} disabled={busy} />
        {draft.roles.includes('supervisor') && <SiteChips sites={sites} value={draft.siteIds} onChange={ids => set('siteIds', ids)} disabled={busy} />}
        {(draft.roles.includes('trabajador') || draft.employeeId) && <Box>
          <LinkedPerson employeeId={draft.employeeId} onChange={value => set('employeeId', value)} disabled={busy} />
          {!draft.roles.includes('trabajador') && draft.employeeId && <Typography sx={{ mt: 0.75, fontSize: 12.5, color: color.muted }}>Sin el rol Trabajador la liga se conserva, pero no ve su asistencia.</Typography>}
        </Box>}
        <DossierCheck checked={draft.dossier} onChange={value => set('dossier', value)} disabled={busy || (!canGrant && !draft.dossier)}
          hint={canGrant || draft.dossier ? 'Permiso aparte del rol; se retira en cualquier momento. Cada descarga pide un código nuevo.' : 'Se concede cuando ya entró con su cuenta y su acceso está activo.'} />
        {problem && <Note tone="error">{problem}</Note>}
        {save.error && <Note tone="error">{problemText(save.error, 'No pudimos guardar el acceso.')}</Note>}
        <Box>
          <Typography component="h3" sx={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, mb: 0.75 }}>Seguridad de la cuenta</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${color.line}`, borderRadius: '14px', overflow: 'hidden' }}>
            <SecurityRow disabled={busy || !canGrant} detail={canGrant ? undefined : 'Cuando ya entró y su acceso está activo.'} onClick={() => setConfirm('password')}>Pedir contraseña nueva en su próximo ingreso</SecurityRow>
            <SecurityRow disabled={busy || !linked} detail={linked ? undefined : 'Todavía no hay cuenta ligada.'} onClick={() => setConfirm('unlink')}>Soltar la liga con su cuenta</SecurityRow>
            {user.status === 'disabled'
              ? <SecurityRow disabled={busy} onClick={() => setConfirm('enable')}>Habilitar su acceso</SecurityRow>
              : <SecurityRow danger disabled={busy} onClick={() => setConfirm('disable')}>Deshabilitar su acceso</SecurityRow>}
          </Box>
        </Box>
      </Box>
    </SidePanel>
    {confirm && <ConfirmModal kind={confirm} user={user} me={me} onClose={() => setConfirm(null)} />}
  </>
}

function SecurityRow({ children, detail, danger, disabled, onClick }: { children: ReactNode; detail?: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return <ButtonBase onClick={onClick} disabled={disabled} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 48, px: 1.75, py: 1, textAlign: 'left', fontFamily: font, fontSize: 14, fontWeight: 600,
    color: danger ? color.error : color.link, '& + &': { borderTop: `1px solid ${color.lineSoft}` }, '&:hover': { background: color.hover }, '&.Mui-disabled': { color: color.subtle },
    '&.Mui-focusVisible': { outline: `2px solid ${color.accent}`, outlineOffset: -2 } }}>
    <Box>{children}{detail && <Box component="span" sx={{ display: 'block', fontSize: 12, fontWeight: 400, color: color.muted }}>{detail}</Box>}</Box>
    <Icon name="chevron" size={16} />
  </ButtonBase>
}

const confirmations: Record<Confirm, { title: string; submit: string; body: (name: string) => ReactNode }> = {
  password: { title: 'Pedir contraseña nueva', submit: 'Pedir contraseña nueva',
    body: name => <>La próxima vez que {name} entre, después de su contraseña actual y su segundo factor, tendrá que elegir una nueva. No recupera una contraseña olvidada ni cierra las sesiones abiertas.</> },
  unlink: { title: 'Soltar la liga con su cuenta', submit: 'Soltar la liga',
    body: name => <>Sirve cuando {name} perdió su cuenta y tiene otra con el mismo correo. Conserva sus roles y su fila del padrón, y vuelve a quedar invitada: se liga otra vez la siguiente vez que entre. <strong>No le quita el acceso</strong>; para eso, deshabilítalo.</> },
  disable: { title: 'Deshabilitar su acceso', submit: 'Deshabilitar',
    body: name => <>{name} deja de entrar al portal de la empresa en su siguiente consulta. Sus roles y su historial se conservan, y se puede habilitar otra vez.</> },
  enable: { title: 'Habilitar su acceso', submit: 'Habilitar',
    body: name => <>{name} vuelve a entrar con los roles que tenía.</> },
}

function ConfirmModal({ kind, user, me, onClose }: { kind: Confirm; user: UserRow; me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const run = useMutation({
    mutationFn: async () => {
      if (kind === 'password') await api<void>(`/users/${user.id}/password-change`, 'POST')
      else if (kind === 'unlink') await api<UserRow>(`/users/${user.id}/unlink`, 'POST')
      else await api<UserRow>(`/users/${user.id}`, 'PATCH', { disabled: kind === 'disable' })
    },
    onSuccess: () => { refreshUsers(cache, me, user.id); if (kind !== 'password') onClose() },
    onError: error => forbidden(cache, error),
  })
  const text = confirmations[kind]
  const name = user.displayName || user.email
  if (kind === 'password' && run.isSuccess) return <Modal id="confirmar-acceso" icon="users" title={text.title} subtitle={user.email} onClose={onClose} onSubmit={onClose}
    actions={<Button variant="contained" onClick={onClose}>Listo</Button>}>
    <Note>Listo: {name} elegirá una contraseña nueva en su próximo ingreso.</Note>
  </Modal>
  return <Modal id="confirmar-acceso" icon="users" title={text.title} subtitle={user.email} onClose={onClose} onSubmit={() => run.mutate()} submit={text.submit} busy={run.isPending}
    error={run.error ? <Note tone="error">{problemText(run.error, 'No pudimos hacerlo.')}</Note> : undefined}>
    <Typography sx={{ fontSize: 14, lineHeight: 1.55 }}>{text.body(name)}</Typography>
    {kind === 'disable' && user.id === me.userId && <Note tone="warn">Es tu propio acceso: al deshabilitarlo saldrás de la empresa.</Note>}
  </Modal>
}

/**
 * EMP-05: invitar con nombre, correo, roles y, para Supervisión, sus sedes.
 * No se manda correo: la persona entra con ese correo verificado y su cuenta
 * se liga la primera vez. El expediente se concede después, ya ligada.
 */
export function InviteModal({ me, sites, onClose, onInvited }: { me: Me; sites: Site[]; onClose: () => void; onInvited: (id: string) => void }) {
  const cache = useQueryClient()
  const [roles, setRoles] = useState<string[]>([])
  const [siteIds, setSiteIds] = useState<string[]>([])
  const [employeeId, setEmployee] = useState<string | null>(null)
  const [problem, setProblem] = useState<{ field?: string; text: string }>()
  const invite = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<UserRow>('/users', 'POST', body),
    onSuccess: created => { for (const key of ['users', 'user-summary']) void cache.invalidateQueries({ queryKey: [key] }); onInvited(created.id) },
    onError: error => forbidden(cache, error),
  })
  const fieldError = (field: string) => problem?.field === field ? problem.text
    : invite.error instanceof ApiError ? invite.error.errors.find(item => item.field === field)?.message
      || (field === 'email' && invite.error.code === 'email_unavailable' ? 'Este correo ya tiene acceso a una empresa.' : undefined) : undefined
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form)
    const displayName = String(data.get('displayName') || '').trim()
    const email = String(data.get('email') || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setProblem({ field: 'email', text: 'Escribe un correo válido.' }); return }
    if (!roles.length) { setProblem({ field: 'roles', text: 'Elige al menos un rol.' }); return }
    setProblem(undefined)
    invite.mutate({ email, roles, ...(displayName ? { displayName } : {}), ...(roles.includes('supervisor') && siteIds.length ? { siteIds } : {}), ...(roles.includes('trabajador') && employeeId ? { employeeId } : {}) })
  }
  const busy = invite.isPending
  const general = invite.error && !fieldError('email') && !(invite.error instanceof ApiError && invite.error.errors.length) ? <Note tone="error">{problemText(invite.error, 'No pudimos enviar la invitación.')}</Note> : undefined
  return <Modal id="invitar-titulo" icon="users" title="Invitar a alguien de tu equipo" subtitle="Entra con su correo, una contraseña y su segundo factor" onClose={onClose} onSubmit={submit}
    submit="Invitar" busy={busy} error={general} closable>
    <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: 'wrap', '& > *': { flex: '1 1 200px' } }}>
      <TextField name="displayName" label="Nombre" disabled={busy} size="small" error={!!fieldError('displayName')} helperText={fieldError('displayName')} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField name="email" label="Correo" type="email" required disabled={busy} size="small" error={!!fieldError('email')} helperText={fieldError('email')} slotProps={{ htmlInput: { maxLength: 254 } }}
        onChange={() => { if (problem?.field === 'email') setProblem(undefined) }} />
    </Stack>
    <RoleChips detailed value={roles} onChange={value => { setRoles(value); if (problem?.field === 'roles') setProblem(undefined) }} disabled={busy} />
    {fieldError('roles') && <Note tone="error">{fieldError('roles')}</Note>}
    {roles.includes('supervisor') && <SiteChips sites={sites} value={siteIds} onChange={setSiteIds} disabled={busy} />}
    {roles.includes('trabajador') && <LinkedPerson employeeId={employeeId} onChange={setEmployee} disabled={busy} />}
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>
      {me.tenant?.name ? `Queda invitada a ${me.tenant.name}. ` : ''}No le llega un correo: compártele la dirección del portal. El permiso del expediente se concede después de que entre por primera vez.
    </Typography>
  </Modal>
}

/** EMP-06: qué deja hacer cada rol. Es de consulta. */
export function PermissionsModal({ onClose }: { onClose: () => void }) {
  const heads = ['Administración', 'RH', 'Supervisión', 'Auditoría']
  return <Modal id="permisos-titulo" icon="users" title="Qué puede hacer cada rol" subtitle="Una persona puede tener varios roles; suma lo de cada uno" onClose={onClose} onSubmit={onClose} wide closable
    actions={<Button variant="contained" onClick={onClose}>Entendido</Button>}>
    <Box sx={{ overflowX: 'auto', mx: -1 }}>
      <Box component="table" sx={{ ...tableSx, '& th': { ...tableSx['& th'], position: 'static' }, '& td:not(:first-of-type), & th:not(:first-of-type)': { textAlign: 'center' } }}>
        <thead><tr><th scope="col">Acción</th>{heads.map(head => <th key={head} scope="col">{head}</th>)}</tr></thead>
        <tbody>{permissionRows.map(row => <tr key={row.action}>
          <th scope="row" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, color: color.ink, fontWeight: 600 }}>{row.action}</th>
          {row.values.map((value, index) => <Box component="td" key={index} sx={{ color: value === '—' ? color.subtle : value === 'Sí' ? color.ok : color.inkSoft, fontWeight: value === 'Sí' ? 600 : 400 }}>{value}</Box>)}
        </tr>)}</tbody>
      </Box>
    </Box>
    <Note>El expediente de la empresa no depende del rol: lo descarga sólo quien tenga ese permiso. Trabajador sólo ve su propia asistencia y acusa sus cierres.</Note>
  </Modal>
}

