import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, permissions, type Me, type Tenant } from './api'
import { ErrorNotice } from './Directory'
import { days, breaks } from './Tenants'

export function TenantSettings({ me }: { me: Me }) {
  const cache = useQueryClient()
  const allowed = permissions(me.roles)
  const [editing, setEditing] = useState(false)
  const query = useQuery({ queryKey: ['tenant'], queryFn: () => api<Tenant>('/tenant'), enabled: allowed.settings, retry: false })
  useEffect(() => { if (query.error instanceof ApiError && query.error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) }, [query.error, cache])
  if (!allowed.settings) return <Alert severity="info">Tu rol no permite consultar la configuración de empresa.</Alert>
  const tenant = query.data
  return <Stack spacing={2}>
    <Typography variant="h5">Configuración de empresa</Typography>
    <ErrorNotice error={query.error} />
    {query.isError && <Button onClick={() => void query.refetch()}>Reintentar configuración</Button>}
    {query.isPending && <Typography role="status">Cargando configuración…</Typography>}
    {tenant && <>
      <Typography variant="h6">{tenant.name}</Typography>
      <Typography>Identificador: {tenant.slug}</Typography>
      <Typography>Zona horaria: {tenant.timeZone}</Typography>
      <Typography>La semana empieza en {days[tenant.weekStartsOn].toLowerCase()}</Typography>
      <Typography>Descanso o comida: {breaks[tenant.breakPolicy]}</Typography>
      <Typography>Cierre programado: {tenant.autoCloseAfterHours === null ? 'Desactivado' : `${tenant.autoCloseAfterHours} horas después del fin de la semana`}</Typography>
      {allowed.editSettings && <Button variant="contained" onClick={() => setEditing(true)}>Editar configuración</Button>}
      {editing && allowed.editSettings && <SettingsForm tenant={tenant} me={me} onClose={() => setEditing(false)} />}
    </>}
  </Stack>
}

function SettingsForm({ tenant: initialTenant, me, onClose }: { tenant: Tenant; me: Me; onClose: () => void }) {
  const [tenant] = useState(initialTenant)
  const cache = useQueryClient()
  const [unchanged, setUnchanged] = useState(false)
  const save = useMutation({ mutationFn: (body: unknown) => api<Tenant>('/tenant', 'PATCH', body),
    onSuccess: updated => { cache.setQueryData(['tenant'], updated); onClose(); void cache.invalidateQueries() },
    onError: error => { if (error instanceof ApiError && error.status === 403) void cache.invalidateQueries({ queryKey: ['me'] }) } })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending || !permissions(me.roles).editSettings) return
    const data = new FormData(event.currentTarget)
    const text = (name: string) => String(data.get(name) || '').trim()
    const values = { name: text('name'), timeZone: text('timeZone'), weekStartsOn: text('weekStartsOn'), breakPolicy: text('breakPolicy'), autoCloseAfterHours: text('autoCloseAfterHours') === '' ? null : Number(text('autoCloseAfterHours')) }
    const body = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== tenant[key as keyof Tenant]))
    setUnchanged(!Object.keys(body).length)
    if (Object.keys(body).length) save.mutate(body)
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!save.isPending) onClose() }} aria-labelledby="settings-title"><form onSubmit={submit}>
    <DialogTitle id="settings-title">Editar configuración</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Alert severity="warning">Cambiar la zona horaria, el inicio de semana o los descansos afecta la operación de la empresa. Revisa los valores antes de guardar.</Alert>
      <TextField name="name" label="Nombre de la empresa" defaultValue={tenant.name} required disabled={save.isPending} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField name="timeZone" label="Zona horaria" defaultValue={tenant.timeZone} required disabled={save.isPending} />
      <TextField select name="weekStartsOn" label="La semana empieza en" defaultValue={tenant.weekStartsOn} disabled={save.isPending}>
        {Object.entries(days).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
      <TextField select name="breakPolicy" label="Descanso o comida" defaultValue={tenant.breakPolicy} disabled={save.isPending}>
        {Object.entries(breaks).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
      <TextField name="autoCloseAfterHours" label="Horas hasta el cierre programado" type="number" defaultValue={tenant.autoCloseAfterHours ?? ''} disabled={save.isPending} helperText="Desde el fin de la semana. Vacío desactiva el cierre programado; sólo se cierran semanas sin incidencias pendientes." slotProps={{ htmlInput: { min: 1, max: 168, step: 1 } }} />
      {unchanged && <Alert severity="info">No hay cambios para guardar.</Alert>}
      <ErrorNotice error={save.error} />
    </Stack></DialogContent>
    <DialogActions><Button disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar configuración'}</Button></DialogActions>
  </form></Dialog>
}
