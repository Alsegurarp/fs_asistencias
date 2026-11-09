import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material'
import { api, ApiError, type Me, type Page, permissions, type Site } from './api'
import { type AttendanceSummary, type HoursRow, type RuleSet, hours, limitHours, shortWeekLabel, timeIn } from './attendanceModel'
import { upcomingText } from './BreakPolicyChange'
import type { ClosureSummary } from './closureModel'
import { color, gradient, phoneQuery, shadow } from './design'
import { DoneMark, Icon } from './Icons'
import type { Incident } from './incidentModel'
import { incidentTitle, severityOf } from './incidentsView'
import { allPages } from './lists'
import { usePanelData } from './Notices'
import { type AuditEntry, type Step, activityText, dateLine, firstName, firstSteps, incidentNotice, pendingNotices } from './panelModel'
import { PageHeader } from './Shell'
import type { Screen, Section } from './sections'
import { Badge, IconTile, Note, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/**
 * Panel (OPE-01, TEL-01): lo de hoy, la semana anterior por cerrar, lo que
 * pide atención, quién lleva más horas y la actividad reciente. Cada tarjeta
 * sale de una ruta que ya existe y se oculta si el rol no la puede leer. Una
 * empresa sin personal ve sus primeros pasos (OPE-12).
 */
export function Panel({ me, context, section, screens, screen }: Props) {
  const allowed = permissions(me.roles)
  const { timeZone, today, summary, closures, incidents } = usePanelData(me, true)
  const sites = useQuery({ queryKey: ['sites', 'all'], queryFn: () => allPages<Site>('/sites'), retry: false, staleTime: 60_000 })
  const weekStart = summary.data?.weekStart
  const rules = useQuery({ queryKey: ['rule-set', weekStart], enabled: !!weekStart, retry: false, staleTime: 3_600_000,
    queryFn: () => api<{ items: RuleSet[] }>(`/rule-sets?effectiveOn=${weekStart}`).then(result => result.items[0] || null) })
  const readsLog = me.roles.some(role => role === 'admin_empresa' || role === 'auditor')
  const activity = useQuery({ queryKey: ['audit-log', 'panel'], enabled: readsLog, retry: false, staleTime: 60_000, queryFn: () => api<Page<AuditEntry>>('/audit-log?limit=5') })
  const newCompany = summary.data?.people === 0 && me.roles.includes('admin_empresa')
  const siteName = (id: string | null) => (id ? sites.data?.find(site => site.id === id)?.name : undefined)

  const header = <PageHeader context={context} section={section} screens={screens} current={screen} title={`Hola, ${firstName(me.displayName)}`}
    description={newCompany ? 'deja lista tu empresa en el orden en que Zenit lo necesita' : dateLine(today, timeZone)} />
  const upcoming = me.tenant?.upcomingBreakPolicy
  const banner = upcoming ? <Box role="status" sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, p: '14px 18px', borderRadius: '18px', background: gradient.banner, color: color.white, boxShadow: shadow.banner }}>
      <Icon name="notice" size={22} />
      <Box sx={{ flex: '1 1 260px' }}>
        <Box component="strong" sx={{ display: 'block', fontSize: 14.5 }}>Aviso sobre la comida: {upcomingText(upcoming)}</Box>
        <Box component="span" sx={{ fontSize: 13, opacity: 0.9 }}>El personal ya ve el aviso en la app; las semanas anteriores conservan su cálculo.</Box>
      </Box>
      {allowed.settings && <Box component={Link} to="/configuracion" sx={{ minHeight: 40, px: 2, display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: color.white, color: `${color.link} !important`, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Ver el cambio</Box>}
    </Box> : null

  if (summary.isError) {
    const error = summary.error instanceof ApiError ? summary.error : null
    return <>{header}{banner}<Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Note tone="error">No pudimos cargar el panel. {error?.message}{error?.correlationId && <> Referencia: <Box component="code" sx={{ fontFamily: 'monospace' }}>{error.correlationId}</Box>.</>}</Note>
      <Button variant="outlined" onClick={() => void summary.refetch()}>Reintentar</Button>
    </Stack></>
  }
  if (summary.isPending) return <>{header}{banner}<Typography role="status" sx={visuallyHidden}>Cargando el panel…</Typography><Loading /></>
  if (newCompany) return <>{header}{banner}<FirstSteps sites={sites.data || []} devices={summary.data.devices?.active || 0} /></>

  const data = summary.data
  const attention = [
    ...(incidents.data?.items || []).slice(0, 4).map(incident => ({ incident, notice: incidentNotice(incident, timeZone, today) })),
    ...pendingNotices({ summary: data, closures: closures.data }).map(notice => ({ incident: null as Incident | null, notice })),
  ]
  return <>
    {header}
    {banner}
    <Box sx={{ flex: 'none', display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 1fr)', [`@media (max-width:1180px)`]: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }, [`@media ${phoneQuery}`]: { gridTemplateColumns: 'minmax(0, 1fr)' } }}>
      <Today summary={data} />
      <PreviousWeek summary={data} closures={closures.data} canClose={allowed.closeWeeks} />
      <Stats summary={data} />
    </Box>
    <Box sx={{ flex: 'none', display: 'grid', gap: 1.5, gridTemplateColumns: readsLog ? 'minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 0.95fr)' : 'minmax(0, 1.15fr) minmax(0, 1fr)',
      [`@media (max-width:1180px)`]: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }, [`@media ${phoneQuery}`]: { gridTemplateColumns: 'minmax(0, 1fr)' } }}>
      <Card id="panel-atencion" title="Requiere atención" action={allowed.incidents ? <CardLink to="/incidencias">Ver todas</CardLink> : undefined}>
        {incidents.isPending ? <Lines /> : attention.length === 0
          ? <Typography sx={{ fontSize: 13, color: color.muted, py: 1 }}>Todo en orden: no hay incidencias abiertas ni cierres pendientes.</Typography>
          : <List>{attention.map(({ incident, notice }) => <Box component="li" key={notice.key}>
            <Box component={Link} to={notice.to} sx={rowLinkSx}>
              <IconTile icon={notice.icon} tone={notice.tone} size={34} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box component="strong" sx={{ display: 'block', fontSize: 13.5 }}>{incident ? incidentTitle(incident.type) : notice.title}</Box>
                <Box component="span" sx={{ display: 'block', fontSize: 12.5, color: color.muted }}>
                  {incident ? [incident.employeeName, siteName(incident.siteId), notice.when].filter(Boolean).join(' · ') : notice.text}
                </Box>
              </Box>
              {incident ? <Badge tone={severityOf(incident.severity).tone}>{severityOf(incident.severity).label}</Badge> : <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: color.link, whiteSpace: 'nowrap' }}>Revisar</Box>}
            </Box>
          </Box>)}</List>}
      </Card>
      <Hours rows={data.mostHours || []} people={data.people} rule={rules.data || null} />
      {readsLog && <Card id="panel-actividad" title="Actividad reciente">
        {activity.isPending ? <Lines /> : activity.isError ? <Typography sx={{ fontSize: 13, color: color.muted }}>No pudimos cargar la actividad.</Typography>
          : !activity.data.items.length ? <Typography sx={{ fontSize: 13, color: color.muted }}>Todavía no hay actividad.</Typography>
            : <List>{activity.data.items.map(entry => {
              const { who, what } = activityText(entry)
              return <Box component="li" key={entry.id} sx={{ display: 'flex', gap: 1.25, py: 0.75, fontSize: 13 }}>
                <Box component="time" dateTime={entry.at} sx={{ flex: 'none', width: 42, color: color.subtle, fontVariantNumeric: 'tabular-nums' }}>{timeIn(entry.at, timeZone)}</Box>
                <Box sx={{ minWidth: 0, color: color.inkSoft }}><Box component="strong" sx={{ color: color.ink }}>{who}</Box> {what}</Box>
              </Box>
            })}</List>}
      </Card>}
    </Box>
  </>
}

const rowLinkSx = { display: 'flex', alignItems: 'center', gap: 1.25, p: '8px', mx: '-8px', borderRadius: '12px', textDecoration: 'none', color: `${color.ink} !important`, '&:hover': { background: color.hover } } as const

function Card({ id, title, detail, action, children }: { id: string; title: string; detail?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <Box component="section" aria-labelledby={id} sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, p: '14px 16px', background: color.white, borderRadius: '20px', boxShadow: shadow.card }}>
    <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
      <Typography component="h2" id={id} sx={{ fontSize: 14, fontWeight: 600 }}>{title}{detail && <Box component="span" sx={{ fontWeight: 400, color: color.muted }}> · {detail}</Box>}</Typography>
      {action}
    </Stack>
    {children}
  </Box>
}

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return <Box component={Link} to={to} sx={{ fontSize: 13, fontWeight: 600, color: `${color.link} !important`, textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}>{children}</Box>
}

function List({ children }: { children: ReactNode }) {
  return <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
}

/** Una cifra pequeña con su nombre; con `to`, lleva a donde se ve completa. */
function Figure({ value, label, to, tone }: { value: ReactNode; label: string; to?: string; tone?: 'warn' }) {
  const body = <><Box component="strong" sx={{ display: 'block', fontSize: 20, fontWeight: 700, color: tone === 'warn' ? color.warnText : color.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
    <Box component="span" sx={{ fontSize: 12.5, color: color.muted }}>{label}</Box></>
  const sx = { display: 'block', p: '10px 12px', borderRadius: '14px', background: color.rowHover, textDecoration: 'none', color: `${color.ink} !important` } as const
  return to ? <Box component={Link} to={to} sx={{ ...sx, '&:hover': { background: color.hover } }}>{body}</Box> : <Box sx={sx}>{body}</Box>
}

function Today({ summary }: { summary: AttendanceSummary }) {
  const { day, week, people } = summary
  return <Card id="panel-hoy" title="Asistencia de hoy">
    <Box component={Link} to="/asistencia" sx={{ textDecoration: 'none', color: `${color.ink} !important` }}>
      <Box component="span" sx={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{day.marked}</Box>
      <Box component="span" sx={{ fontSize: 18, fontWeight: 600, color: color.subtle }}> / {people}</Box>
      <Box component="span" sx={{ display: 'block', fontSize: 13, color: color.muted }}>personas con entrada registrada</Box>
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
      <Figure value={day.attendanceEvents} label="marcajes" />
      <Figure value={week.missingExit} label="sin salida" to={week.missingExit ? '/asistencia?filtro=alertas' : undefined} tone={week.missingExit ? 'warn' : undefined} />
      <Figure value={day.foreignSite} label="fuera de su sede" to={day.foreignSite ? '/incidencias?tipo=foreign_site' : undefined} tone={day.foreignSite ? 'warn' : undefined} />
    </Box>
  </Card>
}

function PreviousWeek({ summary, closures, canClose }: { summary: AttendanceSummary; closures?: ClosureSummary; canClose: boolean }) {
  const previous = summary.previousWeek
  if (!previous) return null
  const pending = previous.people - previous.closed
  const none = previous.closed - previous.agreed - previous.objected
  const share = previous.people ? Math.round((previous.closed / previous.people) * 100) : 0
  const link = `/cierres?semana=${previous.weekStart}`
  return <Card id="panel-semana-anterior" title="Semana anterior" detail={shortWeekLabel(previous.weekStart)}>
    <Box>
      <Box component="span" sx={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{previous.closed}</Box>
      <Box component="span" sx={{ fontSize: 14, color: color.muted }}> de {previous.people} cerradas</Box>
    </Box>
    <Box role="img" aria-label={`${share} % cerrada`} sx={{ height: 8, borderRadius: 999, background: color.lineSoft, overflow: 'hidden' }}>
      <Box sx={{ width: `${share}%`, height: '100%', background: color.accent, borderRadius: 999 }} />
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, [`@media (max-width:420px)`]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
      <Figure value={closures ? closures.blocked : '—'} label="Bloqueadas" to={closures?.blocked ? `${link}&pestana=bloqueadas` : undefined} tone={closures?.blocked ? 'warn' : undefined} />
      <Figure value={previous.agreed} label="Conformes" />
      <Figure value={previous.objected} label="Objeción" to={previous.objected ? `${link}&acuse=objecion` : undefined} tone={previous.objected ? 'warn' : undefined} />
      <Figure value={none} label="Sin acuse" />
    </Box>
    {canClose && pending > 0
      ? <Button variant="contained" component={Link} to={link} sx={{ alignSelf: 'flex-start', minHeight: 42, px: 2.5, color: `${color.white} !important` }}>Terminar el cierre</Button>
      : <CardLink to={link}>Ver los cierres</CardLink>}
  </Card>
}

function Stats({ summary }: { summary: AttendanceSummary }) {
  const ordinary = Math.round(summary.week.ordinaryMinutes / 60).toLocaleString('es-MX')
  const devices = summary.devices
  return <Box component="section" aria-label="La semana en cifras" sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
    <Stat value={summary.incidents?.open ?? '—'} label="Incidencias abiertas" to="/incidencias" tone={summary.incidents?.open ? 'warn' : undefined} />
    <Stat value={`${ordinary} h`} label="Ordinarias en la semana" to="/asistencia" />
    <Stat value={summary.week.withOvertime} label="Con tiempo extra" to="/asistencia?filtro=extra" />
    {devices && <Stat value={`${devices.active - devices.silent} / ${devices.active}`} label="Lectores con señal" to="/dispositivos" tone={devices.silent ? 'warn' : undefined} />}
  </Box>
}

function Stat({ value, label, to, tone }: { value: ReactNode; label: string; to: string; tone?: 'warn' }) {
  return <Box component={Link} to={to} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', minHeight: 84, p: '12px 14px', background: color.white, borderRadius: '18px', boxShadow: shadow.card, textDecoration: 'none',
    color: `${color.ink} !important`, '&:hover': { boxShadow: `0 0 0 1px ${color.fieldHover}, ${shadow.card}` } }}>
    <Box component="strong" sx={{ fontSize: 22, fontWeight: 700, color: tone === 'warn' ? color.warnText : color.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
    <Box component="span" sx={{ fontSize: 12.5, color: color.muted }}>{label}</Box>
  </Box>
}

/** Quienes más horas llevan, con sus ordinarias y su extra contra el tope de la semana. */
function Hours({ rows, people, rule }: { rows: HoursRow[]; people: number; rule: RuleSet | null }) {
  const max = rule?.weeklyOrdinaryMaxMinutes
  const scale = Math.max(max ? max * 1.15 : 0, ...rows.map(row => row.ordinaryMinutes + row.overtimeMinutes), 1)
  return <Card id="panel-horas" title="Horas de la semana" detail={max && rule ? `tope ${limitHours(max)} h (${rule.validFrom.slice(0, 4)})` : undefined}>
    {rows.length === 0 ? <Typography sx={{ fontSize: 13, color: color.muted }}>Nadie ha trabajado esta semana todavía.</Typography> : <List>
      {rows.map(row => <Box component="li" key={row.employeeId} sx={{ py: 0.75 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, fontSize: 13 }}>
          <Box component={Link} to={`/asistencia?persona=${row.employeeId}`} sx={{ fontWeight: 600, color: `${color.ink} !important`, textDecoration: 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}>{row.displayName}</Box>
          <Box component="span" sx={{ flex: 'none', color: color.muted, fontVariantNumeric: 'tabular-nums' }}>{hours(row.ordinaryMinutes)}{row.overtimeMinutes > 0 && <Box component="span" sx={{ color: color.warnText, fontWeight: 600 }}> + {hours(row.overtimeMinutes)}</Box>}</Box>
        </Stack>
        <Box role="img" aria-label={`${hours(row.ordinaryMinutes)} ordinarias y ${hours(row.overtimeMinutes)} extra`} sx={{ position: 'relative', display: 'flex', gap: '2px', height: 8, mt: 0.5, borderRadius: 999, background: color.lineSoft, overflow: 'hidden' }}>
          <Box sx={{ width: `${(row.ordinaryMinutes / scale) * 100}%`, background: color.accent }} />
          {row.overtimeMinutes > 0 && <Box sx={{ width: `${(row.overtimeMinutes / scale) * 100}%`, background: color.overtime }} />}
          {max && <Box aria-hidden="true" sx={{ position: 'absolute', top: 0, bottom: 0, left: `${(max / scale) * 100}%`, width: '2px', background: color.ink, opacity: 0.35 }} />}
        </Box>
      </Box>)}
    </List>}
    {people > 0 && <CardLink to="/asistencia">Ver la semana de {people === 1 ? 'la persona' : `las ${people} personas`}</CardLink>}
  </Card>
}

function Lines() {
  return <Stack spacing={1} aria-hidden="true">{[70, 55, 80].map(width => <Skeleton key={width} variant="rounded" height={12} width={`${width}%`} sx={{ borderRadius: 999, bgcolor: color.lineSoft }} />)}</Stack>
}

/** Tarjetas de espera mientras llega el panel (EST-09). */
function Loading() {
  return <Box aria-hidden="true" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
    {[0, 1, 2].map(item => <Box key={item} sx={{ p: '14px 16px', background: color.white, borderRadius: '20px', boxShadow: shadow.card }}><Lines /></Box>)}
  </Box>
}

/** OPE-12: una empresa sin personal deja lista su configuración paso por paso. */
function FirstSteps({ sites, devices }: { sites: Site[]; devices: number }) {
  const schedules = useQuery({ queryKey: ['schedules', 'all'], queryFn: () => allPages<{ id: string }>('/schedules'), retry: false, staleTime: 60_000 })
  const employees = useQuery({ queryKey: ['employee-summary', 'panel'], queryFn: () => api<{ active: number }>('/employees/summary'), retry: false })
  const cards = useQuery({ queryKey: ['card-summary', 'panel'], queryFn: () => api<{ byStatus: { assigned: number; active: number } }>('/cards/summary'), retry: false })
  const users = useQuery({ queryKey: ['user-summary', 'panel'], queryFn: () => api<{ total: number }>('/users/summary'), retry: false })
  const steps = firstSteps({
    sites, schedules: schedules.data?.length || 0, employees: employees.data?.active || 0,
    cards: cards.data ? cards.data.byStatus.assigned + cards.data.byStatus.active : 0, devices, users: users.data?.total || 0,
  })
  const done = steps.filter(step => step.done).length
  return <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', alignItems: 'start', [`@media ${phoneQuery}`]: { gridTemplateColumns: 'minmax(0, 1fr)' } }}>
    <Card id="panel-primeros-pasos" title="Primeros pasos" detail={`${done} de ${steps.length} listos`}>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' }}>
        {steps.map((step, index) => <StepRow key={step.key} step={step} number={index + 1} />)}
      </Box>
    </Card>
    <Stack spacing={1.5}>
      <Card id="panel-asi-funciona" title="Así funciona Zenit">
        <Box component="ol" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1, fontSize: 13, color: color.inkSoft, lineHeight: 1.5 }}>
          <li>Tu personal marca con su tarjeta en un lector de la sede.</li>
          <li>Zenit calcula la semana con las reglas laborales y te avisa lo que no cuadra.</li>
          <li>Cierras la semana: cada quien da su acuse y exportas para nómina.</li>
        </Box>
      </Card>
      <Card id="panel-padron" title="¿Tienes tu padrón en otro sistema?">
        <Typography sx={{ fontSize: 13, color: color.inkSoft, lineHeight: 1.5 }}>Descarga la plantilla, pégale tus personas y súbela; antes de aplicarla te mostramos qué filas tienen error.</Typography>
        <CardLink to="/personal/importaciones">Ir a la plantilla</CardLink>
      </Card>
    </Stack>
  </Box>
}

function StepRow({ step, number }: { step: Step; number: number }) {
  return <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderTop: number > 1 ? `1px solid ${color.lineSoft}` : 0 }}>
    {step.done ? <DoneMark label="Listo" />
      : <Box aria-hidden="true" sx={{ width: 18, height: 18, flex: 'none', borderRadius: '50%', border: `1.5px solid ${color.field}`, color: color.muted, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{number}</Box>}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box component="strong" sx={{ display: 'block', fontSize: 14, color: step.done ? color.muted : color.ink }}>{step.title}{!step.done && <Box component="span" sx={visuallyHidden}>, pendiente</Box>}</Box>
      <Box component="span" sx={{ fontSize: 12.5, color: color.muted }}>{step.detail}</Box>
    </Box>
    <Box component={Link} to={step.to} aria-label={`${step.action}: ${step.title}`} sx={{ flex: 'none', minHeight: 36, px: 1.75, display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: `1px solid ${color.fieldSoft}`,
      color: `${color.link} !important`, fontSize: 13, fontWeight: 600, textDecoration: 'none', '&:hover': { background: color.hover } }}>{step.action}</Box>
  </Box>
}
