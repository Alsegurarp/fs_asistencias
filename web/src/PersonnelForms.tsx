import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, ButtonBase, Checkbox, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { api, ApiError, type Card, type Employee, type Me, type Page, permissions } from './api'
import { todayIn } from './attendanceModel'
import { color, font } from './design'
import { Icon } from './Icons'
import { problemText, refreshPeople, useSchedules, useSites } from './personnelData'
import {
  type DayDraft, type ScheduleWithValidity, assignmentPreview, hoursAndMinutes, isCurrent, scheduleBody, shiftKind, weekDays, weeklyMinutes,
} from './personnelModel'
import { Modal, Note, SearchBox } from './ui'

const fieldError = (error: unknown, field: string) => (error instanceof ApiError ? error.errors.find(item => item.field === field)?.message : undefined)

/**
 * PAD-03: alta de una persona. El horario y la tarjeta son opcionales; si el
 * alta entra pero uno de ellos falla, se dice cuál y la persona ya existe.
 */
export function NewPersonModal({ me, onClose, onCreated }: { me: Me; onClose: () => void; onCreated?: (id: string) => void }) {
  const allowed = permissions(me.roles)
  const cache = useQueryClient()
  const today = todayIn(me.tenant!.timeZone)
  const sites = useSites()
  const schedules = useSchedules()
  const cards = useQuery({ queryKey: ['cards', 'inventario'], enabled: allowed.manageDevices, retry: false, queryFn: () => api<Page<Card>>('/cards?status=inventory&limit=50') })
  const [start, setStart] = useState(today)
  const [scheduleId, setScheduleId] = useState('')
  const [partial, setPartial] = useState<{ id: string; problems: string[] } | null>(null)
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const value = (name: string) => String(form.get(name) || '').trim()
      const employee = await api<Employee>('/employees', 'POST', { externalId: value('externalId'), displayName: value('displayName'), siteId: value('siteId') || null, employmentStart: value('employmentStart') })
      const problems: string[] = []
      if (value('scheduleId')) {
        try { await api(`/employees/${employee.id}/schedule-assignments`, 'POST', { scheduleId: value('scheduleId'), validFrom: value('scheduleFrom') || value('employmentStart') }) }
        catch (error) { problems.push(`No se asignó el horario: ${problemText(error, 'falló la petición.')}`) }
      }
      if (value('cardId')) {
        try { await api(`/cards/${value('cardId')}/assignments`, 'POST', { employeeId: employee.id }) }
        catch (error) { problems.push(`No se asignó la tarjeta: ${problemText(error, 'falló la petición.')}`) }
      }
      return { employee, problems }
    },
    onSuccess: ({ employee, problems }) => {
      refreshPeople(cache)
      if (problems.length) setPartial({ id: employee.id, problems })
      else { onCreated?.(employee.id); onClose() }
    },
  })
  const taken = save.error instanceof ApiError && save.error.code === 'external_id_taken'
  const current = (schedules.data || []).filter(item => isCurrent(item, today))
  if (partial) return <Modal id="alta-parcial" icon="people" title="Se dio de alta, con pendientes" onClose={onClose} submit="Abrir su ficha"
    onSubmit={() => { onCreated?.(partial.id); onClose() }}>
    {partial.problems.map(problem => <Note key={problem} tone="warn">{problem}</Note>)}
    <Typography sx={{ fontSize: 13, color: color.muted }}>Lo que falta se asigna desde su ficha.</Typography>
  </Modal>
  return <Modal id="alta-persona" icon="people" title="Dar de alta a una persona" subtitle="Entra al padrón de la empresa" onClose={onClose} submit="Dar de alta" busy={save.isPending}
    error={save.isError && !taken && !fieldError(save.error, 'externalId') ? <Note tone="error">{problemText(save.error, 'No se pudo dar de alta.')}</Note> : undefined}
    onSubmit={form => save.mutate(new FormData(form))}>
    <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' } }}>
      <TextField name="externalId" label="Número de empleado" required autoFocus slotProps={{ htmlInput: { maxLength: 64 } }}
        error={taken || !!fieldError(save.error, 'externalId')} helperText={taken ? 'Ese número ya es de otra persona.' : fieldError(save.error, 'externalId')} />
      <TextField name="displayName" label="Nombre completo" required slotProps={{ htmlInput: { maxLength: 160 } }}
        error={!!fieldError(save.error, 'displayName')} helperText={fieldError(save.error, 'displayName')} />
    </Box>
    <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <TextField name="siteId" label="Sede" select defaultValue={sites.data?.length === 1 ? sites.data[0].id : ''} key={sites.data?.length || 0}>
        {(sites.data || []).filter(site => site.status === 'active').map(site => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
        <MenuItem value="">Sin sede por ahora</MenuItem>
      </TextField>
      <TextField name="employmentStart" label="Fecha de ingreso" type="date" required value={start} onChange={event => setStart(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }} error={!!fieldError(save.error, 'employmentStart')} helperText={fieldError(save.error, 'employmentStart')} />
    </Box>
    <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
      <TextField name="scheduleId" label="Horario" select value={scheduleId} onChange={event => setScheduleId(event.target.value)}>
        {current.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
        <MenuItem value="">Asignarlo después</MenuItem>
      </TextField>
      <TextField name="scheduleFrom" label="Desde" type="date" disabled={!scheduleId} defaultValue={start} key={start} slotProps={{ inputLabel: { shrink: true } }} />
    </Box>
    {allowed.manageDevices && <TextField name="cardId" label="Tarjeta" select defaultValue="" disabled={cards.isPending}>
      {(cards.data?.items || []).map(card => <MenuItem key={card.id} value={card.id}>{card.label} · en inventario</MenuItem>)}
      <MenuItem value="">Asignarla después</MenuItem>
    </TextField>}
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>El número es el que usa tu sistema de nómina y no se puede repetir.</Typography>
  </Modal>
}

type Person = { id: string; displayName: string; externalId: string; currentScheduleId: string | null }

/**
 * PAD-08: un horario desde una fecha, a una o varias personas. Se asigna una
 * por una con la ruta del contrato; si alguna falla, se dice quién y por qué
 * y las demás quedan asignadas.
 */
export function AssignScheduleModal({ me, people: initial, schedules, today, scheduleId: chosen = '', onClose }: {
  me: Me; people: Person[]; schedules: ScheduleWithValidity[]; today: string; scheduleId?: string; onClose: () => void
}) {
  const cache = useQueryClient()
  const [people, setPeople] = useState(initial)
  const [scheduleId, setScheduleId] = useState(chosen)
  const [from, setFrom] = useState(today)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [failures, setFailures] = useState<{ person: Person; problem: string }[]>([])
  useEffect(() => { const timer = setTimeout(() => setSearch(text.trim()), 250); return () => clearTimeout(timer) }, [text])
  const found = useQuery({ queryKey: ['employees', 'buscar', search], enabled: search.length > 1, retry: false,
    queryFn: () => api<Page<Employee>>(`/employees?${new URLSearchParams({ q: search, status: 'active', limit: '6' })}`) })
  const save = useMutation({
    mutationFn: async () => {
      const failed: { person: Person; problem: string }[] = []
      for (const person of people) {
        try { await api(`/employees/${person.id}/schedule-assignments`, 'POST', { scheduleId, validFrom: from }) }
        catch (error) { failed.push({ person, problem: problemText(error, 'falló la petición.') }) }
      }
      return failed
    },
    onSuccess: failed => {
      refreshPeople(cache)
      if (failed.length) { setFailures(failed); setPeople(failed.map(item => item.person)) } else onClose()
    },
  })
  const next = schedules.find(item => item.id === scheduleId)
  const name = (id: string | null) => schedules.find(item => item.id === id)?.name
  const single = people.length === 1 ? people[0] : null
  const preview = single && next && from ? assignmentPreview(single.currentScheduleId ? { name: name(single.currentScheduleId) || 'Su horario actual' } : null, next.name, from) : []
  const options = schedules.filter(item => isCurrent(item, today))
  const missing = !people.length ? 'Agrega al menos una persona.' : !scheduleId ? 'Elige el horario.' : !from ? 'Elige desde cuándo.' : ''
  const [tried, setTried] = useState(false)
  return <Modal id="asignar-horario" icon="attendance" title="Asignar horario" subtitle="Desde una fecha" onClose={onClose} submit="Asignar" busy={save.isPending}
    onSubmit={() => { setTried(true); if (!missing) save.mutate() }}
    error={tried && missing ? <Note tone="error">{missing}</Note> : failures.length ? <Note tone="error">
      No se asignó a {failures.length === 1 ? 'una persona' : `${failures.length} personas`}: {failures.map(item => `${item.person.displayName} (${item.problem})`).join('; ')}
    </Note> : undefined}>
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box component="legend" sx={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, mb: 1 }}>Personas</Box>
      <Box component="ul" aria-label="Personas elegidas" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {people.map(person => <li key={person.id}><Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, pl: 1.25, pr: 0.25, minHeight: 32, borderRadius: 999, background: color.selected, fontSize: 13, fontWeight: 600, color: color.deep }}>
          {person.displayName} · {person.externalId}
          <ButtonBase aria-label={`Quitar a ${person.displayName}`} onClick={() => setPeople(list => list.filter(item => item.id !== person.id))}
            sx={{ width: 28, height: 28, borderRadius: '50%', color: color.muted, '&:hover': { background: color.white }, '&.Mui-focusVisible': { outline: `2px solid ${color.accent}` } }}><Icon name="close" size={14} /></ButtonBase>
        </Box></li>)}
      </Box>
      <SearchBox name="agregar" label="Agregar personas por nombre o número" placeholder="Agregar personas" value={text} onChange={setText} grow />
      {search.length > 1 && <Box component="ul" aria-label="Resultados" sx={{ listStyle: 'none', m: 0, p: 0, border: `1px solid ${color.lineSoft}`, borderRadius: '12px', overflow: 'hidden' }}>
        {found.isPending ? <Typography component="li" role="status" sx={{ p: 1.25, fontSize: 13, color: color.muted }}>Buscando…</Typography>
          : !(found.data?.items.length) ? <Typography component="li" sx={{ p: 1.25, fontSize: 13, color: color.muted }}>Nadie activo coincide.</Typography>
            : found.data.items.map(item => {
              const added = people.some(person => person.id === item.id)
              return <li key={item.id}><ButtonBase disabled={added} onClick={() => { setPeople(list => [...list, { id: item.id, displayName: item.displayName, externalId: item.externalId, currentScheduleId: item.currentScheduleId || null }]); setText('') }}
                sx={{ width: '100%', justifyContent: 'space-between', p: '10px 12px', fontFamily: font, fontSize: 13, textAlign: 'left', '&:hover': { background: color.hover }, '&.Mui-disabled': { color: color.subtle } }}>
                <span><strong>{item.displayName}</strong> · {item.externalId}</span><span>{added ? 'Ya está' : name(item.currentScheduleId || null) || 'Sin horario'}</span>
              </ButtonBase></li>
            })}
      </Box>}
    </Box>
    <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
      <TextField name="scheduleId" label="Horario nuevo" select value={scheduleId} onChange={event => setScheduleId(event.target.value)} required>
        {options.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
      </TextField>
      <TextField name="validFrom" label="Desde" type="date" value={from} onChange={event => setFrom(event.target.value)} required slotProps={{ inputLabel: { shrink: true } }} />
    </Box>
    {preview.length > 0 && <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, '& th, & td': { textAlign: 'left', p: '6px 8px', borderBottom: `1px solid ${color.lineSoft}` }, '& th': { color: color.subtle, fontWeight: 600, fontSize: 12 } }}>
      <thead><tr><th scope="col">Periodo</th><th scope="col">Horario</th></tr></thead>
      <tbody>{preview.map(row => <tr key={row.period}><td>{row.period}</td><td><strong>{row.schedule}</strong></td></tr>)}</tbody>
    </Box>}
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>Las semanas ya cerradas no cambian; las abiertas se calculan con el horario de cada día.</Typography>
  </Modal>
}

const defaultDays = (): DayDraft[] => weekDays.map(day => ({ dayOfWeek: day.key, on: !['saturday', 'sunday'].includes(day.key), startTime: '09:00', endTime: '18:00', breakMinutes: '60' }))

/** PAD-07: un horario nuevo con sus días, entrada, salida, comida y vigencia. */
export function ScheduleModal({ me, onClose }: { me: Me; onClose: () => void }) {
  const cache = useQueryClient()
  const today = todayIn(me.tenant!.timeZone)
  const [days, setDays] = useState(defaultDays)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({ mutationFn: (body: object) => api<ScheduleWithValidity>('/schedules', 'POST', body),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['schedules'] }); onClose() } })
  const chosen = days.filter(day => day.on && /^\d{2}:\d{2}$/.test(day.startTime) && /^\d{2}:\d{2}$/.test(day.endTime) && day.startTime !== day.endTime)
    .map(day => ({ ...day, breakMinutes: Number(day.breakMinutes || 0) || 0 }))
  const update = (index: number, change: Partial<DayDraft>) => setDays(list => list.map((day, i) => (i === index ? { ...day, ...change } : day)))
  return <Modal id="crear-horario" icon="clock" title="Crear horario" subtitle="Horario nuevo" wide onClose={onClose} submit="Crear horario" busy={save.isPending}
    error={save.isError ? <Note tone="error">{problemText(save.error, 'No se pudo crear el horario.')}</Note> : Object.keys(errors).length ? <Note tone="error">{Object.values(errors)[0]}</Note> : undefined}
    onSubmit={form => {
      const data = new FormData(form)
      const result = scheduleBody(String(data.get('name') || ''), me.tenant!.timeZone, String(data.get('validFrom') || ''), String(data.get('validTo') || ''), days)
      setErrors(result.errors)
      if (!Object.keys(result.errors).length) save.mutate(result.body)
    }}>
    <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' } }}>
      <TextField name="name" label="Nombre" required autoFocus error={!!errors.name} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField name="validFrom" label="Vigente desde" type="date" defaultValue={today} required error={!!errors.validFrom} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField name="validTo" label="Hasta (opcional)" type="date" error={!!errors.validTo} slotProps={{ inputLabel: { shrink: true } }} />
    </Box>
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, '& th': { textAlign: 'left', color: color.subtle, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', p: '6px 6px' }, '& td': { p: '4px 6px' } }}>
      <caption style={{ textAlign: 'left', fontSize: 13, fontWeight: 600, color: color.inkSoft, paddingBottom: 6 }}>Días</caption>
      <thead><tr><th scope="col">Día</th><th scope="col">Entrada</th><th scope="col">Salida</th><th scope="col">Comida (min)</th></tr></thead>
      <tbody>{days.map((day, index) => {
        const label = weekDays[index].long
        return <tr key={day.dayOfWeek}>
          <td><Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: errors[day.dayOfWeek] ? color.error : color.ink }}>
            <Checkbox size="small" checked={day.on} onChange={event => update(index, { on: event.target.checked })} />{label}
          </Box></td>
          <td><TextField type="time" size="small" value={day.startTime} disabled={!day.on} onChange={event => update(index, { startTime: event.target.value })} slotProps={{ htmlInput: { 'aria-label': `Entrada del ${label.toLowerCase()}` } }} /></td>
          <td><TextField type="time" size="small" value={day.endTime} disabled={!day.on} onChange={event => update(index, { endTime: event.target.value })} slotProps={{ htmlInput: { 'aria-label': `Salida del ${label.toLowerCase()}` } }} /></td>
          <td><TextField type="number" size="small" value={day.breakMinutes} disabled={!day.on} onChange={event => update(index, { breakMinutes: event.target.value })} sx={{ maxWidth: 110 }}
            slotProps={{ htmlInput: { min: 0, max: 240, 'aria-label': `Comida del ${label.toLowerCase()} en minutos` } }} /></td>
        </tr>
      })}</tbody>
    </Box>
    <Stack direction="row" useFlexGap spacing={3} sx={{ flexWrap: 'wrap', fontSize: 13, color: color.muted }} aria-live="polite">
      <span>Jornada <strong style={{ color: color.ink }}>{chosen.length ? shiftKind(chosen).toLowerCase() : '—'}</strong></span>
      <span><strong style={{ color: color.ink }}>{hoursAndMinutes(weeklyMinutes(chosen))}</strong> por semana</span>
    </Stack>
    <Typography sx={{ fontSize: 12.5, color: color.muted }}>Si la salida es antes que la entrada, el turno termina al día siguiente. Nadie cambia de horario hasta que se lo asignes.</Typography>
  </Modal>
}
