import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, MenuItem, Stack, TextField, Typography, useMediaQuery } from '@mui/material'
import { api, ApiError, type Me, type Tenant, permissions } from './api'
import { todayIn } from './attendanceModel'
import { color, phoneQuery, shadow } from './design'
import type { DeviceSummary } from './devicesModel'
import { allPages } from './lists'
import { problemText } from './personnelData'
import type { EmployeeSummary } from './personnelModel'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { LazyMap, MealModal, RulesModal, ScheduleMealModal, SitePanel } from './SettingsForms'
import {
  type RuleSet, type SiteSummary, type WeekDay, breakText, ruleYears, rulesText, shortDay, weekDayNames, zoneLabel, zoneOptions,
} from './settingsModel'
import { Badge, Note, Pane, SkeletonRows, clickRow, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/** `?sede=<id>` abre una sede y `?sede=nueva` agrega una; `?comida=1`, `?comida=programar` y `?reglas=1` abren sus ventanas. */
const siteParam = 'sede'
const newSite = 'nueva'

const card = { background: color.white, borderRadius: '20px', boxShadow: shadow.card, p: '18px 20px', display: 'flex', flexDirection: 'column', gap: 1.75 } as const
const heading = { fontSize: 15, fontWeight: 700 } as const

/**
 * Configuración (EMP-01): la empresa, sus políticas y reglas, y las sedes con
 * su zona de marcaje en un mapa. Sólo Administración cambia; los demás roles
 * la consultan.
 */
export function Settings({ me, context, section, screens, screen }: Props) {
  const allowed = permissions(me.roles)
  const editable = allowed.editSettings
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const opener = useRef<HTMLElement | null>(null)
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: () => api<Tenant>('/tenant'), retry: false })
  const sites = useQuery({ queryKey: ['sites', 'all'], queryFn: () => allPages<SiteSummary>('/sites'), retry: false, staleTime: 60_000 })
  const people = useQuery({ queryKey: ['employee-summary', 'activas'], queryFn: () => api<EmployeeSummary>('/employees/summary?status=active'), retry: false, staleTime: 30_000 })
  const devices = useQuery({ queryKey: ['device-summary'], queryFn: () => api<DeviceSummary>('/devices/summary'), enabled: allowed.devices, retry: false, staleTime: 30_000 })
  const rules = useQuery({ queryKey: ['rule-sets', 'all'], queryFn: () => api<{ items: RuleSet[] }>('/rule-sets').then(result => result.items), retry: false, staleTime: 3_600_000 })

  const open = (key: string, value: string, element?: HTMLElement) => {
    if (element) opener.current = element
    setParams(current => { const next = new URLSearchParams(current); next.set(key, value); return next })
  }
  const close = (key: string) => {
    setParams(current => { const next = new URLSearchParams(current); next.delete(key); return next }, { replace: true })
    setTimeout(() => opener.current?.focus(), 0)
  }

  const siteRows = sites.data || []
  const selectedId = params.get(siteParam)
  const selected = selectedId && selectedId !== newSite ? siteRows.find(site => site.id === selectedId) : undefined
  const meal = params.get('comida')
  const company = tenant.data
  const mapSites = useMemo(() => siteRows.map(site => ({ id: site.id, name: site.name, latitude: site.latitude, longitude: site.longitude, radiusMeters: site.radiusMeters, active: site.status === 'active' })), [siteRows])

  if (tenant.isError) return <>
    <PageHeader context={context} section={section} screens={screens} current={screen} />
    <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Note tone="error">{tenant.error instanceof ApiError && tenant.error.status === 403 ? 'Tu rol ya no puede consultar la configuración.' : problemText(tenant.error, 'No pudimos cargar la configuración.')}</Note>
      <Button variant="outlined" onClick={() => void tenant.refetch()}>Reintentar</Button>
    </Stack>
  </>

  const years = ruleYears(rules.data || [], today)
  return <>
    <PageHeader context={context} section={section} screens={screens} current={screen}
      description={editable ? 'sólo Administración puede cambiarla; los demás roles la consultan' : 'la consultas; sólo Administración puede cambiarla'} />
    <Box sx={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
      {company ? <CompanyCard key={company.id} tenant={company} editable={editable}
        counts={{ sites: sites.data?.length, people: people.data?.active, devices: devices.data?.active }} />
        : <Box sx={card} role="status"><Typography sx={{ color: color.muted }}>Cargando la empresa…</Typography></Box>}
      <Box component="section" aria-labelledby="politicas" sx={card}>
        <Typography component="h2" id="politicas" sx={heading}>Políticas y reglas</Typography>
        <Policy title="Política de comida" detail={company ? breakText(company) : '…'}
          action={<Button variant="outlined" disabled={!company} onClick={event => open('comida', '1', event.currentTarget)}>{editable ? 'Ver o cambiar' : 'Ver'}</Button>} />
        <Policy title="Reglas laborales" detail={rules.isError ? 'No pudimos cargar las reglas.' : rules.data ? `${rulesText(years)}` : '…'}
          action={<Button variant="outlined" disabled={!rules.data} onClick={event => open('reglas', '1', event.currentTarget)}>Ver reglas</Button>} />
        {company?.breakPolicyChange && <Note>El inicio de semana no se puede cambiar mientras haya un cambio de comida pendiente.</Note>}
      </Box>
    </Box>

    <Pane titleId="sedes" title="Sedes y zonas de marcaje" detail={sites.data ? String(siteRows.length) : undefined}
      actions={allowed.editSites ? <Button variant="contained" onClick={event => open(siteParam, newSite, event.currentTarget)}>Agregar sede</Button> : undefined}>
      {sites.isError ? <Box sx={{ p: 2 }}><Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Note tone="error">{problemText(sites.error, 'No pudimos cargar las sedes.')}</Note>
        <Button variant="outlined" onClick={() => void sites.refetch()}>Reintentar</Button>
      </Stack></Box> : <>
        {!!siteRows.length && <Box sx={{ p: '0 16px 12px' }}>
          <LazyMap label="Mapa de las sedes" sites={mapSites} height={phone ? 200 : 260} onSelect={id => open(siteParam, id)} />
        </Box>}
        {sites.isPending && <Typography role="status" sx={visuallyHidden}>Cargando sedes…</Typography>}
        {!sites.isPending && !siteRows.length ? <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600 }}>Todavía no hay sedes</Typography>
          <Typography sx={{ fontSize: 13, color: color.muted, maxWidth: 440 }}>Agrega la primera con su punto en el mapa y el radio donde se puede marcar.</Typography>
        </Stack> : phone ? <Box component="ul" sx={{ listStyle: 'none', m: 0, p: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {siteRows.map(site => <Box component="li" key={site.id} onClick={clickRow} sx={{ p: '12px 14px', borderRadius: '14px', border: `1px solid ${color.line}`, cursor: 'pointer' }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <SiteLink site={site} onOpen={element => open(siteParam, site.id, element)} />
              <Badge tone={site.status === 'active' ? 'ok' : 'neutral'}>{site.status === 'active' ? 'Activa' : 'Inactiva'}</Badge>
            </Stack>
            <Typography sx={{ fontSize: 13, color: color.muted }}>Círculo de {site.radiusMeters} m · {site.terminals ?? '—'} terminales · {site.people ?? '—'} personas</Typography>
          </Box>)}
        </Box> : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={tableSx}>
          <thead><tr><th scope="col">Sede</th><th scope="col">Zona de marcaje</th><th scope="col">Zona horaria</th><th scope="col">Terminales</th><th scope="col">Personas</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody>
            {sites.isPending ? <SkeletonRows columns={7} rows={3} /> : siteRows.map(site => <tr key={site.id} data-selected={site.id === selectedId} onClick={clickRow}>
              <td><SiteLink site={site} onOpen={element => open(siteParam, site.id, element)} /></td>
              <td>Círculo de {site.radiusMeters} m</td>
              <td>{zoneLabel(site.timeZone)}</td>
              <td>{site.terminals ?? '—'}</td>
              <td>{site.people ?? '—'}</td>
              <td><Badge tone={site.status === 'active' ? 'ok' : 'neutral'}>{site.status === 'active' ? 'Activa' : 'Inactiva'}</Badge></td>
              <td><Button variant="outlined" size="small" aria-label={`${allowed.editSites ? 'Editar' : 'Ver'} ${site.name}`} onClick={event => { event.stopPropagation(); open(siteParam, site.id, event.currentTarget) }}
                sx={{ minHeight: 30, px: 1.5, borderRadius: 999, fontSize: 12 }}>{allowed.editSites ? 'Editar' : 'Ver'}</Button></td>
            </tr>)}
          </tbody>
        </Box></Box>}
        <Box sx={{ p: '10px 16px 14px' }}><Typography sx={{ fontSize: 12.5, color: color.muted }}>Una marca sin ubicación concluyente o hecha en otra sede abre una incidencia para revisarla.</Typography></Box>
      </>}
    </Pane>

    {selectedId && (selectedId === newSite ? allowed.editSites : !!selected) && <SitePanel key={selectedId} site={selected || null} sites={siteRows} timeZone={timeZone}
      editable={allowed.editSites} onClose={() => close(siteParam)} onSaved={saved => open(siteParam, saved.id)} />}
    {company && meal === '1' && <MealModal tenant={company} editable={editable} onClose={() => close('comida')} onSchedule={() => open('comida', 'programar')} />}
    {company && editable && meal === 'programar' && <ScheduleMealModal tenant={company} today={today} onClose={() => open('comida', '1')} onScheduled={() => open('comida', '1')} />}
    {rules.data && params.get('reglas') && <RulesModal sets={rules.data} today={today} onClose={() => close('reglas')} />}
  </>
}

function SiteLink({ site, onOpen }: { site: SiteSummary; onOpen: (element: HTMLElement) => void }) {
  return <Box component="a" data-row-link href={`?${siteParam}=${site.id}`} onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onOpen(event.currentTarget) }}
    sx={{ fontWeight: 600, textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { textDecoration: 'underline' } }}>{site.name}</Box>
}

function Policy({ title, detail, action }: { title: string; detail: ReactNode; action: ReactNode }) {
  return <Stack direction="row" useFlexGap sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', p: '12px 14px', borderRadius: '14px', background: color.page }}>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13, color: color.muted }}>{detail}</Typography>
    </Box>
    {action}
  </Stack>
}

type Draft = { name: string; timeZone: string; weekStartsOn: WeekDay; autoClose: string }

function draftOf(tenant: Tenant): Draft {
  return { name: tenant.name, timeZone: tenant.timeZone, weekStartsOn: tenant.weekStartsOn, autoClose: tenant.autoCloseAfterHours === null ? '' : String(tenant.autoCloseAfterHours) }
}

/** Los datos de la empresa: nombre, zona, inicio de semana y cierre automático. */
function CompanyCard({ tenant, editable, counts }: { tenant: Tenant; editable: boolean; counts: { sites?: number; people?: number; devices?: number } }) {
  const cache = useQueryClient()
  const initial = draftOf(tenant)
  // Un refresco de la empresa no pisa lo que se está escribiendo; al guardar, el borrador toma lo guardado.
  const [draft, setDraft] = useState<Draft>(initial)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (saved) { const timer = setTimeout(() => setSaved(false), 4000); return () => clearTimeout(timer) } }, [saved])
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setSaved(false); setDraft(current => ({ ...current, [key]: value })) }
  const hours = draft.autoClose.trim()
  const hoursProblem = hours !== '' && (!/^\d+$/.test(hours) || Number(hours) < 1 || Number(hours) > 168) ? 'De 1 a 168 horas, sin decimales.' : undefined
  const nameProblem = !draft.name.trim() ? 'Escribe el nombre de la empresa.' : undefined
  const body: Record<string, unknown> = {}
  if (draft.name.trim() !== tenant.name) body.name = draft.name.trim()
  if (draft.timeZone !== tenant.timeZone) body.timeZone = draft.timeZone
  if (draft.weekStartsOn !== tenant.weekStartsOn) body.weekStartsOn = draft.weekStartsOn
  const autoClose = hours === '' ? null : Number(hours)
  if (autoClose !== tenant.autoCloseAfterHours) body.autoCloseAfterHours = autoClose
  const changed = Object.keys(body).length > 0
  const save = useMutation({
    mutationFn: () => api<Tenant>('/tenant', 'PATCH', body),
    onSuccess: updated => { cache.setQueryData(['tenant'], updated); setDraft(draftOf(updated)); setSaved(true); void cache.invalidateQueries({ queryKey: ['me'] }) },
  })
  const busy = save.isPending
  const disabled = !editable || busy
  const fact = (value: number | undefined, one: string, many: string) => typeof value === 'number' ? `${value} ${value === 1 ? one : many}` : `… ${many}`
  const fieldError = (field: string) => save.error instanceof ApiError ? save.error.errors.find(item => item.field === field)?.message : undefined
  return <Box component="form" noValidate aria-labelledby="empresa" onSubmit={event => { event.preventDefault(); if (!disabled && changed && !hoursProblem && !nameProblem) save.mutate() }} sx={card}>
    <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography component="h2" id="empresa" sx={heading}>Empresa</Typography>
      <Badge tone={tenant.status === 'active' ? 'ok' : 'warn'}>{tenant.status === 'active' ? 'Activa' : 'Suspendida'}</Badge>
    </Stack>
    <Typography sx={{ fontSize: 13, color: color.muted, mt: -1 }}>
      {fact(counts.sites, 'sede', 'sedes')} · {fact(counts.people, 'persona', 'personas')} · {fact(counts.devices, 'lector', 'lectores')} · en Zenit desde el {shortDay(tenant.createdAt.slice(0, 10)).replace(/^\S+ /, '')}
    </Typography>
    <TextField name="name" label="Nombre" value={draft.name} onChange={event => set('name', event.target.value)} disabled={disabled} required
      error={!!(nameProblem || fieldError('name'))} helperText={nameProblem || fieldError('name')} slotProps={{ htmlInput: { maxLength: 120 } }} />
    <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: 'wrap', '& > *': { flex: '1 1 180px' } }}>
      <TextField select name="timeZone" label="Zona horaria" value={draft.timeZone} onChange={event => set('timeZone', event.target.value)} disabled={disabled} helperText={fieldError('timeZone')} error={!!fieldError('timeZone')}>
        {zoneOptions(draft.timeZone).map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
      </TextField>
      <TextField select name="weekStartsOn" label="Inicio de semana" value={draft.weekStartsOn} onChange={event => set('weekStartsOn', event.target.value as WeekDay)} disabled={disabled || !!tenant.breakPolicyChange}
        helperText={fieldError('weekStartsOn') || (tenant.breakPolicyChange ? 'Hay un cambio de comida pendiente.' : undefined)} error={!!fieldError('weekStartsOn')}>
        {(Object.keys(weekDayNames) as WeekDay[]).map(day => <MenuItem key={day} value={day}>{weekDayNames[day]}</MenuItem>)}
      </TextField>
    </Stack>
    <TextField name="autoCloseAfterHours" label="Cerrar la semana sola (horas después de que termina)" value={draft.autoClose} onChange={event => set('autoClose', event.target.value)} disabled={disabled}
      error={!!(hoursProblem || fieldError('autoCloseAfterHours'))} helperText={hoursProblem || fieldError('autoCloseAfterHours') || 'De 1 a 168. Vacío: sólo la cierra una persona.'}
      slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
    {save.error && !(save.error instanceof ApiError && save.error.errors.length) && <Note tone="error">{problemText(save.error, 'No pudimos guardar la empresa.')}</Note>}
    {editable && <Stack direction="row" useFlexGap sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {saved && <Typography role="status" sx={{ fontSize: 13, color: color.ok, fontWeight: 600 }}>Guardado</Typography>}
      {changed && !busy && <Button variant="text" onClick={() => { setDraft(initial); save.reset() }}>Descartar</Button>}
      <Button type="submit" variant="contained" disabled={busy || !changed}>{busy ? 'Guardando…' : 'Guardar'}</Button>
    </Stack>}
  </Box>
}
