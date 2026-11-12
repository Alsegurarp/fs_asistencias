import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, ButtonBase, Checkbox, Stack, Typography, useMediaQuery } from '@mui/material'
import { api, apiDownload, ApiError, type Me, type Tenant } from './api'
import { addDays, hours, timeIn, todayIn, weekLabel } from './attendanceModel'
import { type BlockingIncident, type Closure, type ClosureSummary, blockedPeople } from './closureModel'
import { color, font, gradient, phoneQuery, shadow } from './design'
import { saveFile } from './files'
import { Icon } from './Icons'
import { dateInZone, incidentTypes } from './incidentModel'
import { allPages } from './lists'
import { problemText } from './personnelData'
import { FormatSwitch, ReportSheet, SheetFigures, SheetHeader, Stepper, printSheet } from './ReportSheet'
import {
  type ExportRecord, type PaperKey, type PayrollGroup, type PayrollOptions, acknowledgementText, defaultOptions, exportStatusOf, groupBySite, hoursText, shortHash, totalsOf,
} from './reportsModel'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import type { SiteSummary } from './settingsModel'
import { shortDay } from './settingsModel'
import { FilterChip, Note, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

const steps = ['Semana y alcance', 'Contenido', 'Vista previa y descarga']
const card = { background: color.white, borderRadius: '20px', boxShadow: shadow.card, p: '18px 20px', display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 } as const
const heading = { fontSize: 15, fontWeight: 700 } as const

/** Cuántas semanas terminadas se ofrecen, de la más reciente hacia atrás. */
const weeksBack = 5

/**
 * Reporte para nómina (REP-02 a 04): un asistente de tres pasos. Sólo entran
 * los cierres vigentes de la semana. El PDF es la vista previa impresa desde
 * el navegador; el archivo oficial es el CSV del servidor, con su huella.
 * `?paso=`, `?semana=` y `?sede=` viven en la dirección.
 */
export function Payroll({ me, context, section, screen }: Props) {
  const timeZone = me.tenant!.timeZone
  const today = todayIn(timeZone)
  const phone = useMediaQuery(phoneQuery)
  const [params, setParams] = useSearchParams()
  const step = Math.min(3, Math.max(1, Number(params.get('paso')) || 1))
  const siteId = params.get('sede') || ''
  const [options, setOptions] = useState<PayrollOptions>(defaultOptions)
  const change = (values: Record<string, string | null>, replace = false) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
    return next
  }, { replace })

  const sites = useQuery({ queryKey: ['sites', 'all'], queryFn: () => allPages<SiteSummary>('/sites'), retry: false, staleTime: 60_000 })
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: () => api<Tenant>('/tenant'), retry: false, staleTime: 60_000 })
  const siteName = (id: string | null) => (id ? sites.data?.find(site => site.id === id)?.name : undefined)
  // Las últimas semanas que ya terminaron, con sus cierres y bloqueadas en el alcance elegido.
  const dates = Array.from({ length: weeksBack }, (_, index) => addDays(today, -7 * (index + 1)))
  const summaries = useQueries({ queries: dates.map(date => {
    const scope = new URLSearchParams({ week: date, ...(siteId ? { siteId } : {}) })
    return { queryKey: ['closure-summary', scope.toString()], queryFn: () => api<ClosureSummary>(`/week-closures/summary?${scope}`), retry: false, staleTime: 30_000 }
  }) })
  const weeks = summaries.flatMap(item => item.data ? [item.data] : [])
  const requested = params.get('semana')
  const weekStart = requested || weeks.find(item => item.closed > 0)?.weekStart || weeks[0]?.weekStart || ''
  const summary = weeks.find(item => item.weekStart === weekStart)
  const scope = new URLSearchParams({ week: weekStart, ...(siteId ? { siteId } : {}) })
  const otherSummary = useQuery({ queryKey: ['closure-summary', scope.toString()], enabled: !!weekStart && !summary, retry: false,
    queryFn: () => api<ClosureSummary>(`/week-closures/summary?${scope}`) })
  const counts = summary || otherSummary.data

  const closures = useQuery({ queryKey: ['payroll', 'cierres', scope.toString()], enabled: !!weekStart, retry: false, staleTime: 30_000,
    queryFn: () => allPages<Closure>(`/week-closures?${new URLSearchParams({ week: weekStart, status: 'closed', ...(siteId ? { siteId } : {}) })}`) })
  // Para agrupar por sede: los cierres de cada sede. Son tantas consultas como sedes, no como personas.
  const siteList = (sites.data || []).filter(site => !siteId || site.id === siteId)
  const perSite = useQueries({ queries: siteList.map(site => ({
    queryKey: ['payroll', 'cierres', new URLSearchParams({ week: weekStart, siteId: site.id }).toString()], enabled: !!weekStart && !siteId, retry: false, staleTime: 30_000,
    queryFn: () => allPages<Closure>(`/week-closures?${new URLSearchParams({ week: weekStart, status: 'closed', siteId: site.id })}`),
  })) })
  const blocking = useQuery({ queryKey: ['incidents', 'bloquean', scope.toString()], enabled: !!weekStart, retry: false,
    queryFn: () => allPages<BlockingIncident>(`/incidents?${new URLSearchParams({ week: weekStart, blocksClosure: 'true', status: 'open', ...(siteId ? { siteId } : {}) })}`) })
  const blocked = blockedPeople(blocking.data || [])

  const rows = useMemo(() => closures.data || [], [closures.data])
  const bySite = siteId ? siteList.map(site => ({ id: site.id, name: site.name, rows })) : siteList.map((site, index) => ({ id: site.id, name: site.name, rows: perSite[index]?.data || [] }))
  const groupsReady = siteId || perSite.every(item => !item.isPending)
  const groups = groupBySite(rows, bySite, options.bySite && !!groupsReady)
  const totals = totalsOf(rows)
  const loading = !weekStart || closures.isPending
  const failure = closures.error || summaries.find(item => item.error)?.error
  const breaksMarked = tenant.data?.breakPolicy === 'marked'
  useEffect(() => { if (breaksMarked) setOptions(current => ({ ...current, breaks: true })) }, [breaksMarked])

  const go = (next: number) => change({ paso: next === 1 ? null : String(next) })
  const ready = !loading && rows.length > 0
  const scopeName = siteName(siteId) || 'Toda la empresa'

  return <>
    <PageHeader context={context} section={section} screens={[screen]} current={screen} title="Reporte para nómina"
      description="horas ordinarias y extra de una semana cerrada"
      actions={<Button variant="text" component={Link} to="/reportes" startIcon={<Icon name="back" size={16} />}>Elegir otro reporte</Button>} />
    <Stepper steps={steps} step={step} enabled={ready} onStep={go} phone={phone} />
    {failure && <Note tone="error">{failure instanceof ApiError && failure.status === 403 ? 'Tu rol ya no puede generar este reporte.' : problemText(failure, 'No pudimos cargar los cierres.')}</Note>}

    {step === 1 && <Box sx={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 0.9fr) minmax(0, 1.4fr)', gap: 2, alignItems: 'start' }}>
      <Box component="section" aria-labelledby="alcance" sx={card}>
        <Typography component="h2" id="alcance" sx={heading}>¿De quién?</Typography>
        <Box role="group" aria-label="Alcance" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          <FilterChip pressed={!siteId} onClick={() => change({ sede: null })}>Toda la empresa</FilterChip>
          {(sites.data || []).filter(site => site.status === 'active' || site.id === siteId).map(site => <FilterChip key={site.id} pressed={site.id === siteId} onClick={() => change({ sede: site.id })}>{site.name}</FilterChip>)}
        </Box>
        <Typography component="h2" id="semana" sx={{ ...heading, mt: 1 }}>¿Qué semana? <Box component="span" sx={{ fontSize: 13, fontWeight: 500, color: color.muted }}>· sólo semanas cerradas</Box></Typography>
        <Box component="ul" aria-labelledby="semana" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {summaries.some(item => item.isPending) && !weeks.length && <Typography component="li" role="status" sx={{ fontSize: 13, color: color.muted }}>Cargando semanas…</Typography>}
          {weeks.map(week => <li key={week.weekStart}>
            <ButtonBase aria-pressed={week.weekStart === weekStart} disabled={!week.closed} onClick={() => change({ semana: week.weekStart })}
              sx={{ width: '100%', justifyContent: 'space-between', gap: 1, p: '10px 14px', borderRadius: '14px', fontFamily: font, textAlign: 'left',
                border: `1px solid ${week.weekStart === weekStart ? color.fieldHover : color.line}`, background: week.weekStart === weekStart ? color.selected : color.white,
                '&.Mui-disabled': { opacity: 0.6 }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}`, outlineOffset: 2 } }}>
              <Box component="strong" sx={{ fontSize: 14 }}>{weekLabel(week.weekStart)}</Box>
              <Box component="span" sx={{ fontSize: 12.5, color: week.blocked ? color.warnText : color.muted }}>{weekCounts(week)}</Box>
            </ButtonBase>
          </li>)}
        </Box>
      </Box>
      <Box component="section" aria-labelledby="entra" sx={card}>
        <Typography component="h2" id="entra" sx={heading}>Lo que entra en el reporte</Typography>
        {loading ? <Typography role="status" sx={{ color: color.muted, fontSize: 13 }}>Cargando los cierres…</Typography> : <>
          <Figures items={[
            { value: String(totals.people), label: totals.people === 1 ? 'persona incluida' : 'personas incluidas' },
            { value: hoursText(totals.ordinary), label: 'ordinarias' },
            { value: hoursText(totals.overtime), label: 'extra' },
            { value: String(counts?.blocked ?? blocked.length), label: 'bloqueadas, no entran', warn: !!(counts?.blocked ?? blocked.length) },
          ]} />
          {!siteId && groupsReady && siteList.length > 0 && <SiteTable sites={siteList} rows={bySite} blocked={blocked} all={rows} />}
          {!rows.length && <Note tone="warn">Nadie tiene la semana cerrada todavía{siteId ? ' en esta sede' : ''}. Ciérrala en Cierres semanales para poder generar el reporte.</Note>}
          {blocked.length > 0 && <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>No entran hasta que se cierre su semana</Typography>
              <Button size="small" component={Link} to={`/cierres?${new URLSearchParams({ semana: weekStart, ...(siteId ? { sede: siteId } : {}), pestana: 'bloqueadas' })}`}>Resolver en Cierres</Button>
            </Stack>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, border: `1px solid ${color.line}`, borderRadius: '12px' }}>
              {blocked.slice(0, 8).map(person => <Box component="li" key={person.employeeId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, p: '8px 12px', fontSize: 13, '& + &': { borderTop: `1px solid ${color.lineSoft}` } }}>
                <span><strong>{person.name}</strong>{siteName(person.siteId) && <Box component="span" sx={{ color: color.muted }}> · {siteName(person.siteId)}</Box>}</span>
                <Box component="span" sx={{ color: color.warnText }}>{person.incidents.length === 1 ? incidentTypes[person.incidents[0].type] || '1 incidencia abierta' : `${person.incidents.length} incidencias abiertas`}</Box>
              </Box>)}
            </Box>
            {blocked.length > 8 && <Typography sx={{ mt: 0.5, fontSize: 12.5, color: color.muted }}>y {blocked.length - 8} más</Typography>}
          </Box>}
          {!!counts && counts.blocked > blocked.length && <Typography sx={{ fontSize: 12.5, color: color.muted }}>
            {counts.blocked - blocked.length === 1 ? 'Una persona más tiene' : `${counts.blocked - blocked.length} personas más tienen`} un tramo abierto sin cerrar.
          </Typography>}
        </>}
      </Box>
    </Box>}

    {step === 2 && <Box sx={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 0.8fr) minmax(0, 1.5fr)', gap: 2, alignItems: 'start' }}>
      <Box component="section" aria-labelledby="columnas" sx={card}>
        <Typography component="h2" id="columnas" sx={heading}>Columnas</Typography>
        <Option checked disabled label="Horas ordinarias" detail="hasta el tope de la semana" />
        <Option checked disabled label="Tiempo extra" detail="diario y semanal, sin contar doble" />
        <Option checked={options.worked} onChange={worked => setOptions({ ...options, worked })} label="Tiempo trabajado" detail="todo lo registrado en la semana" />
        <Option checked={options.breaks} onChange={breaks => setOptions({ ...options, breaks })} label="Comida y descansos" detail={breaksMarked ? 'la empresa marca la comida' : 'la empresa no marca la comida'} />
        <Option checked={options.acknowledgement} onChange={acknowledgement => setOptions({ ...options, acknowledgement })} label="Acuse" detail="conforme, objeción o sin acuse" />
        <Typography component="h2" id="presentacion" sx={{ ...heading, mt: 1 }}>Presentación</Typography>
        <Option checked={options.bySite} onChange={bySite => setOptions({ ...options, bySite })} label="Agrupar por sede" detail="con subtotal" />
        <Option checked={options.hashes} onChange={hashes => setOptions({ ...options, hashes })} label="Anexo de huellas" detail="para comprobar que nada cambió" />
        <Option checked={options.signature} onChange={signature => setOptions({ ...options, signature })} label="Línea de firma" detail="de quien autoriza la nómina" />
      </Box>
      <Box component="section" aria-labelledby="muestra" sx={{ ...card, p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: '14px 18px 0' }}>
          <Typography component="h2" id="muestra" sx={heading}>Así quedan las columnas</Typography>
          <Typography sx={{ fontSize: 13, color: color.muted }}>Primeras filas de {totals.people}{options.bySite && groups.length > 1 ? ' · agrupado por sede' : ''}</Typography>
        </Box>
        <Box sx={{ overflowX: 'auto', p: '8px 18px 16px' }}>
          <PayrollTable groups={groups.map(group => ({ ...group, rows: group.rows.slice(0, 5) }))} counts={Object.fromEntries(groups.map(group => [group.key, group.rows.length]))} options={options} screen />
        </Box>
      </Box>
    </Box>}

    {step === 3 && <PreviewStep me={me} weekStart={weekStart} siteId={siteId} scopeName={scopeName} groups={groups} rows={rows} options={options}
      blocked={counts?.blocked ?? blocked.length} ruleVersion={rows[0]?.ruleSet.version} />}

    <Stack direction="row" sx={{ flex: 'none', justifyContent: 'space-between', gap: 1, pb: 1 }}>
      <Button variant="outlined" disabled={step === 1} onClick={() => go(step - 1)}>Anterior</Button>
      {step < 3 && <Button variant="contained" disabled={!ready} onClick={() => go(step + 1)}>Siguiente</Button>}
    </Stack>
  </>
}

function weekCounts(week: ClosureSummary) {
  const parts = [`${week.closed} ${week.closed === 1 ? 'cerrada' : 'cerradas'}`]
  if (week.blocked) parts.push(`${week.blocked} ${week.blocked === 1 ? 'bloqueada' : 'bloqueadas'}`)
  if (!week.closed && !week.blocked) return 'sin cierres'
  return parts.join(' · ')
}

function Figures({ items }: { items: { value: string; label: string; warn?: boolean }[] }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1 }}>
    {items.map(item => <Box key={item.label} sx={{ p: '10px 12px', borderRadius: '14px', background: color.page }}>
      <Box component="strong" sx={{ display: 'block', fontSize: 20, fontWeight: 700, color: item.warn ? color.warnText : color.ink, fontVariantNumeric: 'tabular-nums' }}>{item.value}</Box>
      <Box component="span" sx={{ fontSize: 12, color: color.muted }}>{item.label}</Box>
    </Box>)}
  </Box>
}

function SiteTable({ sites, rows, blocked, all }: { sites: SiteSummary[]; rows: { id: string; rows: Closure[] }[]; blocked: ReturnType<typeof blockedPeople>; all: Closure[] }) {
  const lines = sites.map(site => {
    const closures = rows.find(item => item.id === site.id)?.rows || []
    const totals = totalsOf(closures)
    return { site, totals, blocked: blocked.filter(person => person.siteId === site.id).length }
  }).filter(line => line.totals.people || line.blocked || line.site.status === 'active')
  const sum = totalsOf(all)
  return <Box sx={{ overflowX: 'auto' }}>
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, '& th': { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: color.subtle, fontWeight: 600, p: '6px 8px', borderBottom: `1px solid ${color.line}` },
      '& td': { p: '7px 8px', borderBottom: `1px solid ${color.lineSoft}`, fontVariantNumeric: 'tabular-nums' }, '& .num': { textAlign: 'right' }, '& tfoot td': { fontWeight: 700, borderBottom: 0 } }}>
      <thead><tr><th scope="col">Sede</th><th scope="col" className="num">Personas</th><th scope="col" className="num">Entran</th><th scope="col" className="num">Bloqueadas</th><th scope="col" className="num">Ordinarias</th><th scope="col" className="num">Extra</th></tr></thead>
      <tbody>{lines.map(line => <tr key={line.site.id}>
        <td>{line.site.name}</td><td className="num">{line.site.people ?? '—'}</td><td className="num">{line.totals.people}</td><td className="num">{line.blocked}</td>
        <td className="num">{hoursText(line.totals.ordinary)}</td><td className="num">{hoursText(line.totals.overtime)}</td>
      </tr>)}</tbody>
      <tfoot><tr><td>Total</td><td className="num">{lines.reduce((total, line) => total + (line.site.people || 0), 0)}</td><td className="num">{sum.people}</td><td className="num">{blocked.length}</td>
        <td className="num">{hoursText(sum.ordinary)}</td><td className="num">{hoursText(sum.overtime)}</td></tr></tfoot>
    </Box>
  </Box>
}

function Option({ label, detail, checked, disabled, onChange }: { label: string; detail: string; checked: boolean; disabled?: boolean; onChange?: (value: boolean) => void }) {
  return <Box component="label" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, cursor: disabled ? 'default' : 'pointer' }}>
    <Checkbox size="small" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} sx={{ p: 0.5 }} />
    <Box sx={{ pt: '4px', fontSize: 14 }}><strong>{label}</strong><Box component="span" sx={{ color: color.muted }}> · {detail}</Box></Box>
  </Box>
}

/** La tabla del reporte, en pantalla (paso 2) o en la hoja (paso 3). */
function PayrollTable({ groups, counts, options, screen = false }: { groups: PayrollGroup[]; counts: Record<string, number>; options: PayrollOptions; screen?: boolean }) {
  const head = <tr>
    <th scope="col">No.</th><th scope="col">Persona</th><th scope="col" className="num">Ordinarias</th><th scope="col" className="num">Extra</th>
    {options.worked && <th scope="col" className="num">Trabajado</th>}{options.breaks && <th scope="col" className="num">Comida</th>}{options.acknowledgement && <th scope="col">Acuse</th>}
  </tr>
  const columns = 4 + Number(options.worked) + Number(options.breaks) + Number(options.acknowledgement)
  const screenSx = screen ? { width: '100%', borderCollapse: 'collapse', fontSize: 13,
    '& th': { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: color.subtle, fontWeight: 600, p: '6px 8px', borderBottom: `1px solid ${color.line}`, whiteSpace: 'nowrap' },
    '& td': { p: '7px 8px', borderBottom: `1px solid ${color.lineSoft}`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }, '& .num': { textAlign: 'right' },
    '& .group td': { fontWeight: 700, background: color.page }, '& .total td': { fontWeight: 700 } } : undefined
  return <Box component="table" sx={screenSx}>
    <thead>{head}</thead>
    {groups.map(group => {
      const totals = totalsOf(group.rows)
      const shown = counts[group.key] ?? group.rows.length
      return <tbody key={group.key}>
        {group.name && <tr className="group"><td colSpan={columns}>{group.name} · {shown} {shown === 1 ? 'persona' : 'personas'}</td></tr>}
        {group.rows.map(row => <tr key={row.id}>
          <td className="muted">{row.employeeExternalId || '—'}</td><td>{row.employeeName || 'Persona'}</td>
          <td className="num">{hours(row.totals.ordinaryMinutes)}</td><td className="num">{hours(row.totals.overtimeMinutes)}</td>
          {options.worked && <td className="num">{hours(row.totals.workedMinutes)}</td>}{options.breaks && <td className="num">{hours(row.totals.breakMinutes)}</td>}
          {options.acknowledgement && <td>{acknowledgementText(row)}</td>}
        </tr>)}
        {screen && shown > group.rows.length && <tr><td colSpan={columns} className="muted">… {shown - group.rows.length} más</td></tr>}
        {!screen && group.name && options.bySite && <tr className="total">
          <td colSpan={2}>Subtotal {group.name}</td><td className="num">{hours(totals.ordinary)}</td><td className="num">{hours(totals.overtime)}</td>
          {options.worked && <td className="num">{hours(totals.worked)}</td>}{options.breaks && <td className="num">{hours(totals.breaks)}</td>}{options.acknowledgement && <td />}
        </tr>}
      </tbody>
    })}
  </Box>
}

/** Paso 3: la hoja para imprimir o guardar como PDF, o el CSV oficial del servidor. */
function PreviewStep({ me, weekStart, siteId, scopeName, groups, rows, options, blocked, ruleVersion }: {
  me: Me; weekStart: string; siteId: string; scopeName: string; groups: PayrollGroup[]; rows: Closure[]; options: PayrollOptions; blocked: number; ruleVersion?: number
}) {
  const timeZone = me.tenant!.timeZone
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf')
  const [paper, setPaper] = useState<PaperKey>('carta-h')
  const [generated] = useState(() => new Date().toISOString())
  const totals = totalsOf(rows)
  const sheet = <>
    <SheetHeader company={me.tenant!.name} title="Reporte de asistencia para nómina" lines={[
      `Semana ${weekLabel(weekStart)} · ${scopeName}${ruleVersion ? ` · reglas laborales, versión ${ruleVersion}` : ''}`,
      `Generado por ${me.displayName} el ${shortDay(dateInZone(generated, timeZone), true).replace(/^\S+ /, '')}, ${timeIn(generated, timeZone)}`,
    ]} />
    <SheetFigures items={[
      { value: String(totals.people), label: 'personas incluidas' }, { value: hoursText(totals.ordinary), label: 'ordinarias' }, { value: hoursText(totals.overtime), label: 'extra' },
      { value: `${totals.agreed} · ${totals.objected} · ${totals.none}`, label: 'conformes · objeción · sin acuse' }, { value: String(blocked), label: 'bloqueadas, no incluidas' },
    ]} />
    <PayrollTable groups={groups} counts={{}} options={options} />
    {options.hashes && <>
      <h2>Anexo de huellas</h2>
      <table><thead><tr><th scope="col">No.</th><th scope="col">Persona</th><th scope="col">Versión</th><th scope="col">Huella del cierre (SHA-256)</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td className="muted">{row.employeeExternalId}</td><td>{row.employeeName}</td><td>{row.version}</td><td style={{ fontFamily: 'monospace', fontSize: '7.5pt', wordBreak: 'break-all' }}>{row.hash}</td></tr>)}</tbody></table>
    </>}
    {options.signature && <Box sx={{ mt: '28pt', display: 'flex', gap: '40pt', breakInside: 'avoid' }}>
      {['Elaboró', 'Autoriza la nómina'].map(label => <Box key={label} sx={{ flex: 1, borderTop: '0.8pt solid #12233F', pt: '3pt', fontSize: '8.5pt', color: '#4A5A75' }}>{label}</Box>)}
    </Box>}
    <Box sx={{ mt: '14pt', fontSize: '7.5pt', color: '#5E6E89' }}>Sólo semanas cerradas. Esta hoja se imprimió desde el portal; el archivo oficial para nómina es el CSV con huella que entrega Zenit.</Box>
  </>
  return <Stack spacing={1.5} sx={{ minHeight: 0 }}>
    <FormatSwitch value={format} onChange={value => setFormat(value as 'pdf' | 'csv')} options={[{ key: 'pdf', label: 'PDF' }, { key: 'csv', label: 'CSV' }]} />
    {format === 'pdf' ? <>
      <ReportSheet title="Reporte para nómina" paper={paper} onPaper={setPaper}>{sheet}</ReportSheet>
      <Note>«Descargar PDF» abre la impresión del navegador: elige «Guardar como PDF». La hoja no queda registrada como descarga; para tu sistema de nómina usa el CSV.</Note>
      <Stack direction="row" useFlexGap sx={{ gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={printSheet}>Imprimir</Button>
        <Button variant="contained" onClick={printSheet}>Descargar PDF</Button>
      </Stack>
    </> : <CsvExport me={me} weekStart={weekStart} siteId={siteId} scopeName={scopeName} people={totals.people} />}
  </Stack>
}

/**
 * El CSV oficial: se pide al servidor, se prepara en cola y se descarga una
 * sola vez, con su huella y su manifiesto. La descarga queda en la bitácora.
 */
function CsvExport({ me, weekStart, siteId, scopeName, people }: { me: Me; weekStart: string; siteId: string; scopeName: string; people: number }) {
  const cache = useQueryClient()
  const timeZone = me.tenant!.timeZone
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [id, setId] = useState('')
  useEffect(() => { setId(''); setKey(crypto.randomUUID()) }, [weekStart, siteId])
  const request = useMutation({ mutationFn: () => api<ExportRecord>('/exports', 'POST', { weekStart, format: 'csv', ...(siteId ? { siteId } : {}) }, key),
    onSuccess: record => { cache.setQueryData(['export', record.id], record); setId(record.id); setKey(crypto.randomUUID()); void cache.invalidateQueries({ queryKey: ['exports'] }) } })
  const detail = useQuery({ queryKey: ['export', id], queryFn: () => api<ExportRecord>(`/exports/${id}`), enabled: !!id, retry: false,
    refetchInterval: query => query.state.error ? false : query.state.data?.status === 'queued' ? 3000 : false })
  const download = useMutation({ mutationFn: () => apiDownload(`/exports/${id}/download`),
    onSuccess: ({ blob, filename }) => { saveFile(blob, filename); void detail.refetch(); void cache.invalidateQueries({ queryKey: ['exports'] }) }, onError: () => { void detail.refetch() } })
  const manifest = useMutation({ mutationFn: () => apiDownload(`/exports/${id}/manifest`), onSuccess: ({ blob }) => saveFile(blob, `zenit-${id}-manifest.json`) })
  const record = detail.data
  const busy = request.isPending || download.isPending || manifest.isPending
  const status = record ? exportStatusOf(record) : null
  let body: ReactNode
  if (!record) body = <>
    <Typography sx={{ fontSize: 14 }}>Zenit prepara el CSV de {people} {people === 1 ? 'persona' : 'personas'} ({scopeName}, {weekLabel(weekStart)}) con la huella de cada cierre. Se descarga <strong>una sola vez</strong> y vence a los 15 minutos.</Typography>
    <Box><Button variant="contained" disabled={busy} onClick={() => request.mutate()}>{request.isPending ? 'Pidiendo…' : 'Preparar el CSV'}</Button></Box>
  </>
  else if (record.status === 'queued') body = <Typography role="status" sx={{ fontSize: 14 }}>Preparando el CSV… se actualiza solo.</Typography>
  else if (record.status === 'ready') body = <>
    <Typography role="status" sx={{ fontSize: 14 }}>Listo: {record.rowCount} {record.rowCount === 1 ? 'fila' : 'filas'}{record.expiresAt ? `, se puede descargar hasta las ${timeIn(record.expiresAt, timeZone)}` : ''}.</Typography>
    <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
      <Button variant="contained" disabled={busy} onClick={() => download.mutate()}>{download.isPending ? 'Descargando…' : 'Descargar CSV (una vez)'}</Button>
      {record.fileHash && <Button variant="outlined" disabled={busy} onClick={() => manifest.mutate()}>Descargar manifiesto</Button>}
    </Stack>
  </>
  else body = <>
    <Typography role="status" sx={{ fontSize: 14 }}>{record.status === 'failed' ? 'No se pudo preparar el CSV.' : record.downloadedAt ? 'Ya se descargó; para otra copia, pide uno nuevo.' : 'Venció sin descargarse.'}</Typography>
    <Box><Button variant="contained" disabled={busy} onClick={() => request.mutate()}>{record.status === 'failed' ? 'Reintentar' : 'Pedir de nuevo'}</Button></Box>
  </>
  return <Box component="section" aria-labelledby="csv" sx={card}>
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
      <Typography component="h2" id="csv" sx={heading}>CSV para tu sistema de nómina</Typography>
      {status && <Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: color.muted }}>· {status.label}</Box>}
    </Stack>
    {body}
    {record?.fileHash && <Typography sx={{ fontSize: 12.5, color: color.muted, overflowWrap: 'anywhere' }}>Huella del archivo (SHA-256): <Box component="span" title={record.fileHash} sx={{ fontFamily: 'monospace' }}>{shortHash(record.fileHash)}</Box></Typography>}
    {[request.error, detail.error, download.error, manifest.error].filter(Boolean).map((error, index) => <Note key={index} tone="error">
      {error instanceof ApiError && error.code === 'no_closed_weeks' ? 'Esa semana no tiene cierres vigentes en este alcance.' : problemText(error, 'No pudimos preparar el CSV.')}
    </Note>)}
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>Columnas: número, nombre, sede, minutos trabajados, de descanso, ordinarios y extra, acuse, fecha y huella del cierre, con la empresa, la semana, la zona horaria y la versión de las reglas.</Typography>
  </Box>
}
