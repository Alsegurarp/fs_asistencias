import { lazy, Suspense, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import { api, ApiError, type BreakPolicy, type BreakPolicyChange, type Site, type Tenant } from './api'
import { color } from './design'
import { problemText } from './personnelData'
import {
  type RuleSet, type SiteDraft, type SiteSummary, breakChangeStarts, breakNames, dailyRules, ruleYears, shortDay, siteChanges, siteDraft, siteErrors, sourceText, zoneOptions,
} from './settingsModel'
import { Badge, Modal, Note, SidePanel, tableSx } from './ui'

const SiteMap = lazy(() => import('./SiteMap'))

/** El mapa se carga aparte: Leaflet sólo baja cuando hace falta. */
export function LazyMap(props: React.ComponentProps<typeof SiteMap>) {
  return <Suspense fallback={<Box role="status" sx={{ height: props.height ?? 260, borderRadius: '14px', background: color.page, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: color.muted }}>Cargando el mapa…</Box>}>
    <SiteMap {...props} />
  </Suspense>
}

const fieldError = (error: unknown, field: string) => (error instanceof ApiError ? error.errors.find(item => item.field === field)?.message : undefined)

function refreshSites(cache: ReturnType<typeof useQueryClient>) {
  void cache.invalidateQueries({ queryKey: ['sites'] })
  void cache.invalidateQueries({ queryKey: ['employee-summary'] })
}

/**
 * Agregar o editar una sede (EMP-07): nombre, zona, el punto en el mapa, que
 * se arrastra, latitud, longitud y radio. Quien sólo consulta la ve sin
 * campos editables. Desactivar o reactivar va aparte, en el pie.
 */
export function SitePanel({ site, sites, timeZone, editable, onClose, onSaved }: {
  site: SiteSummary | null; sites: SiteSummary[]; timeZone: string; editable: boolean; onClose: () => void; onSaved: (site: Site) => void
}) {
  const cache = useQueryClient()
  const [draft, setDraft] = useState<SiteDraft>(() => siteDraft(site, timeZone))
  const [tried, setTried] = useState(false)
  const errors = siteErrors(draft)
  const set = <K extends keyof SiteDraft>(key: K, value: SiteDraft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => site ? api<Site>(`/sites/${site.id}`, 'PATCH', body) : api<Site>('/sites', 'POST', body),
    onSuccess: saved => { refreshSites(cache); onSaved(saved) },
  })
  const status = useMutation({
    mutationFn: (next: 'active' | 'inactive') => api<Site>(`/sites/${site!.id}`, 'PATCH', { status: next }),
    onSuccess: saved => { refreshSites(cache); onSaved(saved) },
  })
  const busy = save.isPending || status.isPending
  const others = useMemo(() => sites.filter(item => item.id !== site?.id).map(item => ({ id: item.id, name: item.name, latitude: item.latitude, longitude: item.longitude, radiusMeters: item.radiusMeters, active: item.status === 'active' })), [sites, site?.id])
  const submit = () => {
    setTried(true)
    if (Object.keys(errors).length || busy) return
    const body = siteChanges(site, draft)
    if (!Object.keys(body).length) { onClose(); return }
    save.mutate(body)
  }
  const show = (key: keyof SiteDraft) => (tried ? errors[key] : undefined) || fieldError(save.error, key)
  const latitude = Number(draft.latitude)
  const longitude = Number(draft.longitude)
  const radius = Number(draft.radiusMeters)
  const active = site?.status !== 'inactive'
  const failure = save.error || status.error

  const footer = editable ? <>
    <Button variant="outlined" onClick={onClose} disabled={busy}>Cancelar</Button>
    <Button variant="contained" onClick={submit} disabled={busy}>{save.isPending ? 'Guardando…' : site ? 'Guardar' : 'Agregar sede'}</Button>
  </> : undefined

  return <SidePanel title={site ? site.name : 'Nueva sede'} eyebrow="Sede" onClose={onClose} footer={footer}
    subtitle={site ? <Badge tone={active ? 'ok' : 'neutral'}>{active ? 'Activa' : 'Inactiva'}</Badge> : undefined}>
    <Box component="form" noValidate aria-label={site ? `Editar ${site.name}` : 'Agregar sede'} onSubmit={event => { event.preventDefault(); submit() }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <TextField name="siteName" label="Nombre" value={draft.name} onChange={event => set('name', event.target.value)} required disabled={!editable || busy}
        error={!!show('name')} helperText={show('name')} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField select name="siteTimeZone" label="Zona horaria" value={draft.timeZone} onChange={event => set('timeZone', event.target.value)} disabled={!editable || busy}>
        {zoneOptions(draft.timeZone).map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
      </TextField>
      <Box>
        <LazyMap label="Mapa de la sede" height={220} sites={others}
          editing={Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude, radiusMeters: radius } : null}
          onMove={editable && !busy ? (lat, lng) => setDraft(current => ({ ...current, latitude: String(lat), longitude: String(lng) })) : undefined} />
        {editable && <Typography sx={{ mt: 0.75, fontSize: 12.5, color: color.muted }}>Arrastra el punto para moverlo, o escribe la latitud y la longitud.</Typography>}
      </Box>
      <Stack direction="row" spacing={1.5}>
        <TextField name="latitude" label="Latitud" value={draft.latitude} onChange={event => set('latitude', event.target.value)} disabled={!editable || busy} fullWidth
          error={!!show('latitude')} helperText={show('latitude')} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        <TextField name="longitude" label="Longitud" value={draft.longitude} onChange={event => set('longitude', event.target.value)} disabled={!editable || busy} fullWidth
          error={!!show('longitude')} helperText={show('longitude')} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      </Stack>
      <TextField name="radiusMeters" label="Radio de la zona de marcaje (metros)" type="number" value={draft.radiusMeters} onChange={event => set('radiusMeters', event.target.value)} disabled={!editable || busy}
        error={!!show('radiusMeters')} helperText={show('radiusMeters') || 'De 20 a 2000 m.'} slotProps={{ htmlInput: { min: 20, max: 2000, step: 10 } }} />
      {site && <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25, p: '6px 8px 6px 14px', border: `1px solid ${color.line}`, borderRadius: '14px', fontSize: 14, fontWeight: 600, cursor: editable && !busy ? 'pointer' : 'default' }}>
        <span>Sede activa{status.isPending ? ' · guardando…' : ''}</span>
        {/* Se guarda en el acto, como en el lienzo. */}
        <Switch checked={active} disabled={!editable || busy} onChange={event => status.mutate(event.target.checked ? 'active' : 'inactive')} slotProps={{ input: { 'aria-label': 'Sede activa' } }} />
      </Box>}
      <Note>Una marca hecha fuera del círculo o sin ubicación clara abre una incidencia para revisarla.</Note>
      {failure && <Note tone="error">{problemText(failure, 'No pudimos guardar la sede.')}</Note>}
      <button type="submit" hidden />
    </Box>
  </SidePanel>
}

/**
 * La política de comida (EMP-02): la de hoy y, si hay, el cambio programado,
 * que se puede cancelar antes de que entre. Sin cambio, quien administra
 * programa uno.
 */
export function MealModal({ tenant, editable, onSchedule, onClose }: { tenant: Tenant; editable: boolean; onSchedule: () => void; onClose: () => void }) {
  const cache = useQueryClient()
  const change = tenant.breakPolicyChange
  const cancel = useMutation({
    mutationFn: (item: BreakPolicyChange) => api<void>(`/tenant/break-policy-changes/${item.id}/cancellation`, 'POST'),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['tenant'] }); void cache.invalidateQueries({ queryKey: ['me'] }) },
  })
  const row = (label: string, value: React.ReactNode) => <><Box component="dt" sx={{ color: color.muted }}>{label}</Box><Box component="dd" sx={{ m: 0, fontWeight: 500 }}>{value}</Box></>
  return <Modal id="politica-comida" icon="settings" title="Política de comida" subtitle="Si el personal marca su salida a comer y su regreso" onClose={onClose} onSubmit={onClose} busy={cancel.isPending}
    error={cancel.error ? <Note tone="error">{problemText(cancel.error, 'No pudimos cancelar el cambio.')}</Note> : undefined}
    actions={<>
      {editable && change && <Button variant="outlined" color="error" disabled={cancel.isPending} onClick={() => cancel.mutate(change)} sx={{ mr: 'auto' }}>{cancel.isPending ? 'Cancelando…' : 'Cancelar el cambio'}</Button>}
      {editable && !change && <Button variant="outlined" onClick={onSchedule} sx={{ mr: 'auto' }}>Programar un cambio</Button>}
      <Button variant="contained" type="submit" disabled={cancel.isPending}>Entendido</Button>
    </>}>
    {change ? <>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: color.subtle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cambio programado</Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 160px', p: 1.5, borderRadius: '12px', background: color.page }}>
          <Typography sx={{ fontSize: 12.5, color: color.muted }}>Hoy</Typography>
          <Typography sx={{ fontWeight: 600 }}>{breakNames[tenant.breakPolicy]}</Typography>
        </Box>
        <Box sx={{ flex: '1 1 160px', p: 1.5, borderRadius: '12px', background: color.selected }}>
          <Typography sx={{ fontSize: 12.5, color: color.muted }}>Desde el {shortDay(change.effectiveOn, true)}</Typography>
          <Typography sx={{ fontWeight: 600 }}>{breakNames[change.breakPolicy]}</Typography>
        </Box>
      </Stack>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 1, fontSize: 13.5 }}>
        {row('Programado', shortDay(change.scheduledAt.slice(0, 10), true))}
        {change.scheduledByName && row('Programó', change.scheduledByName)}
        {row('Motivo', change.reason)}
        {row('Aviso', 'El personal lo ve en la app desde que se programó.')}
      </Box>
    </> : <Box sx={{ p: 1.5, borderRadius: '12px', background: color.page }}>
      <Typography sx={{ fontSize: 12.5, color: color.muted }}>Hoy</Typography>
      <Typography sx={{ fontWeight: 600 }}>{breakNames[tenant.breakPolicy]}</Typography>
    </Box>}
    <Note>Un cambio entra el primer día de semana dentro de la siguiente quincena, con al menos 7 días de aviso. Cada marca usa la política de su día y cada semana, la de su primer día; las semanas anteriores no se recalculan.</Note>
  </Modal>
}

/** Programar un cambio de comida (EMP-08): la política nueva, desde cuándo entra y el motivo. */
export function ScheduleMealModal({ tenant, today, onClose, onScheduled }: { tenant: Tenant; today: string; onClose: () => void; onScheduled: () => void }) {
  const cache = useQueryClient()
  const next: BreakPolicy = tenant.breakPolicy === 'marked' ? 'not_considered' : 'marked'
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const text = reason.trim()
  const problem = text.length < 10 ? 'Escribe al menos 10 caracteres.' : undefined
  const starts = breakChangeStarts(today, tenant.weekStartsOn)
  const save = useMutation({
    mutationFn: () => api<BreakPolicyChange>('/tenant/break-policy-changes', 'POST', { breakPolicy: next, reason: text }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['tenant'] }); void cache.invalidateQueries({ queryKey: ['me'] }); onScheduled() },
  })
  const option = (policy: BreakPolicy, detail: string, chosen: boolean) => <Box sx={{ flex: '1 1 180px', p: 1.5, borderRadius: '12px', border: `1.5px solid ${chosen ? color.accent : color.line}`, background: chosen ? color.selected : color.white }}>
    <Typography sx={{ fontWeight: 600 }}>{breakNames[policy]}{chosen ? '' : ' · hoy'}</Typography>
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>{detail}</Typography>
  </Box>
  return <Modal id="programar-comida" icon="settings" title="Programar un cambio de comida" subtitle={`Hoy la comida ${breakNames[tenant.breakPolicy].toLowerCase()}`}
    onClose={onClose} busy={save.isPending} submit="Programar cambio"
    onSubmit={() => { setTried(true); if (!problem) save.mutate() }}
    error={save.error ? <Note tone="error">{problemText(save.error, 'No pudimos programar el cambio.')}</Note> : undefined}>
    <Box role="group" aria-label="Política nueva" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {option(next, next === 'marked' ? 'Cada persona marca su salida a comer y su regreso.' : 'Sólo se marcan la entrada y la salida.', true)}
      {option(tenant.breakPolicy, 'Es la política de hoy.', false)}
    </Box>
    <Box sx={{ p: 1.5, borderRadius: '12px', background: color.page }}>
      <Typography sx={{ fontWeight: 600 }}>Entraría el {shortDay(starts, true)}</Typography>
      <Typography sx={{ fontSize: 12.5, color: color.muted }}>Primer día de semana de la siguiente quincena, con al menos 7 días de aviso. La fecha la confirma el servidor al programarlo.</Typography>
    </Box>
    <TextField name="reason" label="Motivo" value={reason} onChange={event => setReason(event.target.value)} required multiline minRows={2} disabled={save.isPending}
      error={tried && !!problem} helperText={(tried && problem) || fieldError(save.error, 'reason') || 'Obligatorio, de 10 a 500 caracteres; lo ve quien administra la empresa.'}
      slotProps={{ htmlInput: { maxLength: 500 } }} />
    <Note>El personal ve el aviso en la app desde hoy. Puedes cancelarlo antes de que entre.</Note>
  </Modal>
}

/** Reglas laborales (EMP-03), de consulta: topes por año, reglas por día y la fuente. */
export function RulesModal({ sets, today, onClose }: { sets: RuleSet[]; today: string; onClose: () => void }) {
  const years = ruleYears(sets, today)
  const current = years.find(item => item.current) || years.at(-1)
  const sources = (current?.set.sources || []).map(sourceText)
  return <Modal id="reglas-laborales" icon="settings" title="Reglas laborales" subtitle="Las actualiza Zenit; tu empresa las consulta" onClose={onClose} onSubmit={onClose}
    actions={<Button variant="contained" type="submit">Entendido</Button>}>
    <Box component="table" aria-label="Tope por semana" sx={{ ...tableSx, '& td, & th': { ...tableSx['& td'], position: 'static' } }}>
      <thead><tr><th scope="col">Año</th><th scope="col">Ordinarias</th><th scope="col">Extra</th></tr></thead>
      <tbody>{years.map(item => <tr key={item.year} data-selected={item.current}>
        <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>{item.year}{item.current ? ' · vigente' : ''}</th><td>{item.ordinary}</td><td>{item.overtime}</td>
      </tr>)}</tbody>
    </Box>
    {current && <Box>
      <Typography component="h3" sx={{ fontSize: 13, fontWeight: 700, color: color.subtle, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>Por día</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 13.5 }}>{dailyRules(current.set).map(rule => <li key={rule}>{rule}</li>)}</Box>
    </Box>}
    <Note>Cada cierre guarda la versión con la que se calculó; un cambio de reglas no recalcula semanas cerradas.</Note>
    {!!sources.length && <Typography sx={{ fontSize: 12.5, color: color.muted }}>
      Fuente: {sources.map((source, index) => <span key={source.text}>{index ? '; ' : ''}{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.text}</a> : source.text}</span>)}.
    </Typography>}
  </Modal>
}
