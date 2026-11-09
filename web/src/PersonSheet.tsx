import { useQueries, useQuery } from '@tanstack/react-query'
import { Box, Typography } from '@mui/material'
import { api, ApiError, type Employee } from './api'
import {
  type Closure, type Mark, type PersonWeek, type RuleSet, type Schedule, type WeekRow,
  addDays, dayLabel, dayLines, deviceText, hours, limitHours, markEvidence, markTypes, scheduleSummary, shortDay, shortHash, shortWeekLabel, timeIn, weekContains,
} from './attendanceModel'
import { color } from './design'
import { DoneMark } from './Icons'
import { zonedInstants } from './incidentModel'
import { initials } from './Shell'
import { Badge, Note, SidePanel } from './ui'

const tabs = [{ key: 'semana', label: 'Semana' }, { key: 'marcajes', label: 'Marcajes' }, { key: 'cierres', label: 'Cierres y acuses' }]
/** Semanas de cierres que consulta la ficha: la elegida y las cinco anteriores. */
const closureWeeks = 6

type Props = {
  employeeId: string; weekStart: string; today: string; timeZone: string; row?: WeekRow
  siteName: (id: string | null) => string | undefined; scheduleOf: (id: string | null) => Schedule | undefined
  rule: RuleSet | null; tab: string; onTab: (key: string) => void; onClose: () => void
}

/**
 * Ficha de una persona en Asistencia (OPE-02, OPE-07, OPE-08, TEL-08): su
 * semana día por día, sus marcajes con la evidencia y sus cierres con el acuse.
 */
export function PersonSheet({ employeeId, weekStart, today, timeZone, row, siteName, scheduleOf, rule, tab, onTab, onClose }: Props) {
  const employee = useQuery({ queryKey: ['employee', employeeId], queryFn: () => api<Employee>(`/employees/${employeeId}`), retry: false, enabled: !row })
  const week = useQuery({ queryKey: ['employee-week', employeeId, weekStart], queryFn: () => api<PersonWeek>(`/employees/${employeeId}/attendance?week=${weekStart}`), retry: false })
  const from = zonedInstants(`${weekStart}T00:00`, timeZone)[0]
  const until = zonedInstants(`${addDays(weekStart, 7)}T00:00`, timeZone)[0]
  const marks = useQuery({ queryKey: ['employee-marks', employeeId, weekStart], enabled: !!from && !!until, retry: false,
    queryFn: () => api<{ items: Mark[]; nextCursor: string | null }>(`/attendance-events?${new URLSearchParams({ employeeId, from, to: until, limit: '200' })}`) })
  const closures = useQueries({ queries: Array.from({ length: closureWeeks }, (_, index) => addDays(weekStart, -7 * index)).map(start => ({
    queryKey: ['employee-closures', employeeId, start], enabled: tab === 'cierres', retry: false,
    queryFn: () => api<{ items: Closure[] }>(`/week-closures?${new URLSearchParams({ week: start, employeeId, limit: '50' })}`),
  })) })

  const name = row?.displayName || employee.data?.displayName || 'Persona'
  const number = row?.externalId || employee.data?.externalId
  const siteId = row ? row.siteId : employee.data?.siteId ?? null
  const schedule = scheduleOf(row ? row.scheduleId : employee.data?.currentScheduleId ?? null)
  const subtitle = [number, siteName(siteId), schedule ? scheduleSummary(schedule) : undefined].filter(Boolean).join(' · ')
  const failure = [week.error, employee.error].find((error): error is ApiError => error instanceof ApiError)

  return <SidePanel title={name} subtitle={subtitle} initials={initials(name)} tabs={tabs} tab={tabs.some(item => item.key === tab) ? tab : 'semana'} onTab={onTab} onClose={onClose}>
    {failure ? <Note tone="error">{failure.status === 403 ? 'Esta persona no está en tus sedes o ya no puedes consultarla.' : failure.status === 404 ? 'No encontramos a esta persona en tu empresa.' : `No pudimos cargar su semana. ${failure.message}`}</Note>
      : tab === 'marcajes' ? <Marks marks={marks.data?.items} loading={marks.isPending} error={marks.error} timeZone={timeZone} siteName={siteName} />
        : tab === 'cierres' ? <Closures name={name} results={closures.map(item => item.data?.items)} loading={closures.some(item => item.isPending)} error={closures.find(item => item.error)?.error || null} />
          : <WeekTab week={week.data} loading={week.isPending} row={row} rule={rule} schedule={schedule} today={today} marks={marks.data?.items} siteName={siteName} />}
  </SidePanel>
}

function Loading({ children }: { children: string }) {
  return <Typography role="status" sx={{ fontSize: 13, color: color.muted }}>{children}</Typography>
}

function WeekTab({ week, loading, row, rule, schedule, today, marks, siteName }: {
  week?: PersonWeek; loading: boolean; row?: WeekRow; rule: RuleSet | null; schedule?: Schedule; today: string; marks?: Mark[]; siteName: (id: string | null) => string | undefined
}) {
  if (loading || !week) return <Loading>Cargando la semana…</Loading>
  const current = weekContains(week.weekStart, today)
  const onShift = row?.today ? row.today.state === 'on_shift' || row.today.state === 'on_break'
    : current && week.segments.some(segment => segment.endAt === null && Date.now() - Date.parse(segment.startAt) < 16 * 3_600_000)
  const lines = dayLines(week, schedule, today, onShift)
  const ordinaryMax = rule?.weeklyOrdinaryMaxMinutes
  const overtimeMax = rule ? Number(rule.parameters.weeklyOvertimeMaxMinutes) || undefined : undefined
  // Las alertas que piden atención; el tramo del turno en curso no es una.
  const notes = week.alerts.filter(alert => alert.severity !== 'info' && !(alert.code === 'open_segment' && onShift))
  const first = current ? marks?.filter(mark => mark.observedAt && dayOf(mark.observedAt, week.timeZone) === today).sort((a, b) => a.observedAt.localeCompare(b.observedAt))[0] : undefined
  const closure = week.closure ? (week.closure.status === 'closed' ? `semana cerrada, versión ${week.closure.version}` : `semana reabierta, versión ${week.closure.version}`) : 'semana sin cierre'
  return <>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', background: color.rowHover, borderRadius: '16px', textAlign: 'center' }}>
      <Tile value={hours(week.totals.ordinaryMinutes)} label={`Ordinarias${ordinaryMax ? ` / ${limitHours(ordinaryMax)} h` : ''}`} />
      <Tile value={hours(week.totals.overtimeMinutes)} label={`Extra${overtimeMax ? ` / ${limitHours(overtimeMax)} h` : ''}`} divided />
      <Tile value={String(week.openIncidentIds.length)} label="Incidencias" divided />
    </Box>
    {notes.map((alert, index) => <Note key={`${alert.code}-${index}`} tone={alert.severity === 'critical' ? 'error' : 'warn'}><strong>Aviso:</strong> {alert.message}</Note>)}
    {lines.length ? <Box component="ul" aria-label="Días de la semana" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {lines.map((line, index) => <Box component="li" key={line.date} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, fontSize: 13, borderBottom: index < lines.length - 1 ? `1px solid ${color.lineSoft}` : 0 }}>
        <Box component="strong" sx={{ width: 84, flex: 'none' }}>{dayLabel(line.date)}</Box>
        <Box component="span" sx={{ flex: 1, color: line.state === 'planned' || line.state === 'pending' ? color.subtle : line.state === 'absent' ? color.warnText : color.muted }}>{line.range}</Box>
        {line.workedMinutes !== null && line.state !== 'open' && <span>{hours(line.workedMinutes)}</span>}
        {line.state === 'done' && <DoneMark />}
        {line.state === 'open' && <Badge tone="info">Abierto</Badge>}
        {line.state === 'missing' && <Badge tone="error">Sin salida</Badge>}
      </Box>)}
    </Box> : <Typography sx={{ fontSize: 13, color: color.muted }}>Sin marcas ni horario en esta semana.</Typography>}
    {first && <Box sx={{ background: color.rowHover, borderRadius: '14px', p: '10px 12px', fontSize: 12, color: color.muted, lineHeight: 1.5 }}>
      <Box component="strong" sx={{ color: color.ink }}>Evidencia de hoy:</Box> {markTypes[first.type].toLowerCase()} {timeIn(first.observedAt, week.timeZone)} · {deviceText(first, siteName)} · {markEvidence(first).charAt(0).toLowerCase() + markEvidence(first).slice(1)}
    </Box>}
    <Typography sx={{ fontSize: 12, color: color.subtle }}>
      Calculada con reglas laborales {rule ? rule.validFrom.slice(0, 4) : ''}, versión {week.ruleSet.version} · {closure}. El tiempo de cada día es el trabajado; la división en ordinario y extra es de la semana.
    </Typography>
  </>
}

function dayOf(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
}

function Tile({ value, label, divided }: { value: string; label: string; divided?: boolean }) {
  return <Box sx={{ p: '10px 4px', borderLeft: divided ? `1px solid ${color.line}` : 0 }}>
    <Box sx={{ fontSize: 19, fontWeight: 700 }}>{value}</Box>
    <Box sx={{ fontSize: 12, color: color.muted }}>{label}</Box>
  </Box>
}

function Marks({ marks, loading, error, timeZone, siteName }: { marks?: Mark[]; loading: boolean; error: Error | null; timeZone: string; siteName: (id: string | null) => string | undefined }) {
  if (error) return <Note tone="error">No pudimos cargar los marcajes. {error.message}</Note>
  if (loading || !marks) return <Loading>Cargando los marcajes…</Loading>
  const sorted = [...marks].sort((a, b) => b.observedAt.localeCompare(a.observedAt))
  return <>
    <Typography sx={{ fontSize: 13, color: color.muted }}>{sorted.length === 1 ? '1 marca' : `${sorted.length} marcas`} de la semana con su evidencia.</Typography>
    {sorted.length > 0 && <Box component="ul" aria-label="Marcajes de la semana" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {sorted.map((mark, index) => <Box component="li" key={mark.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1.25, fontSize: 13, borderBottom: index < sorted.length - 1 ? `1px solid ${color.lineSoft}` : 0 }}>
        <Box sx={{ width: 56, flex: 'none', color: color.muted }}>{shortDay(dayOf(mark.observedAt, timeZone))}<Box sx={{ fontSize: 15, fontWeight: 600, color: color.ink }}>{timeIn(mark.observedAt, timeZone)}</Box></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box>{markTypes[mark.type]} · {deviceText(mark, siteName)}</Box>
          <Box sx={{ color: color.muted }}>{markEvidence(mark)}</Box>
        </Box>
        {mark.outcome === 'accepted' ? <Badge tone="ok">Aceptada</Badge>
          : <Badge tone="warn" to={`/incidencias?incidencia=${mark.incidentIds[0]}`}>Con incidencia</Badge>}
      </Box>)}
    </Box>}
    <Note>Una marca no se edita; si falta o sobra, se corrige con una incidencia y queda el ajuste aparte.</Note>
  </>
}

function Closures({ name, results, loading, error }: { name: string; results: (Closure[] | undefined)[]; loading: boolean; error: Error | null }) {
  if (error) return <Note tone="error">No pudimos cargar los cierres. {error.message}</Note>
  if (loading) return <Loading>Cargando los cierres…</Loading>
  // De la semana más reciente a la más antigua y, en cada una, la versión más nueva primero.
  const all = results.flatMap(items => items || []).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.version - a.version)
  return <>
    <Typography sx={{ fontSize: 13, color: color.muted }}>Semanas cerradas de {name} y su acuse, en las últimas {closureWeeks} semanas.</Typography>
    {all.length ? <Box component="ul" aria-label="Cierres" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {all.map((closure, index) => <Box component="li" key={closure.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.25, fontSize: 13, borderBottom: index < all.length - 1 ? `1px solid ${color.lineSoft}` : 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ fontSize: 14, fontWeight: 600 }}>{shortWeekLabel(closure.weekStart)}</Box>
          <Box sx={{ color: color.muted }}>
            {hours(closure.totals.ordinaryMinutes)}{closure.totals.overtimeMinutes > 0 ? ` + ${hours(closure.totals.overtimeMinutes)} extra` : ''} · huella <Box component="code" sx={{ fontFamily: 'ui-monospace, monospace' }}>{shortHash(closure.hash)}</Box>
            {closure.version > 1 ? ` · versión ${closure.version}` : ''}{closure.status === 'reopened' ? ' · reabierta' : ''}
          </Box>
        </Box>
        <Acknowledged closure={closure} />
      </Box>)}
    </Box> : <Typography sx={{ fontSize: 13 }}>Todavía no tiene semanas cerradas en ese periodo.</Typography>}
    <Note>El acuse lo da cada persona desde la app; aquí sólo se consulta. Una objeción se atiende reabriendo la semana en Cierres.</Note>
  </>
}

function Acknowledged({ closure }: { closure: Closure }) {
  if (closure.status === 'reopened') return <Badge tone="neutral">Reabierta</Badge>
  const ack = closure.acknowledgement
  if (!ack) return <Badge tone="neutral">Sin acuse</Badge>
  return ack.type === 'agreed' ? <Badge tone="ok">Conforme</Badge> : <Badge tone="warn">Con objeción</Badge>
}
