import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Stack, Typography } from '@mui/material'
import { api, type Me, permissions } from './api'
import { todayIn } from './attendanceModel'
import { color } from './design'
import { PersonnelHeader } from './Personnel'
import { useSchedules } from './personnelData'
import { AssignScheduleModal, ScheduleModal } from './PersonnelForms'
import { type EmployeeSummary, type ScheduleWithValidity, breakText, daysText, hoursText, isCurrent, shiftKind, validityText } from './personnelModel'
import type { Screen, Section } from './sections'
import { Badge, Note, Pane, SkeletonRows, StatusTabs, tableSx, visuallyHidden } from './ui'

type Props = { me: Me; context: string; section: Section; screens: Screen[]; screen: Screen }

/**
 * Horarios (PAD-07): los vigentes y los históricos, con sus días, entrada y
 * salida, comida, jornada, vigencia y cuántas personas activas tienen cada uno
 * hoy. Un horario no se edita: se crea otro y se asigna desde una fecha, así
 * las semanas ya calculadas conservan el suyo.
 */
export function Schedules(props: Props) {
  const { me } = props
  const allowed = permissions(me.roles)
  const today = todayIn(me.tenant!.timeZone)
  const [params] = useSearchParams()
  const tab = params.get('vigencia') === 'historicos' ? 'historicos' : 'vigentes'
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState<ScheduleWithValidity | null>(null)
  const schedules = useSchedules()
  const counts = useQuery({ queryKey: ['employee-summary', 'status=active'], queryFn: () => api<EmployeeSummary>('/employees/summary?status=active'), retry: false })
  const all = schedules.data || []
  const current = all.filter(item => isCurrent(item, today))
  const past = all.filter(item => !isCurrent(item, today))
  const shown = tab === 'vigentes' ? current : past
  const people = (id: string) => counts.data?.bySchedule.find(item => item.scheduleId === id)?.people ?? 0
  return <>
    <PersonnelHeader {...props} />
    <Stack direction="row" useFlexGap sx={{ flex: 'none', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
      <StatusTabs label="Horarios por vigencia" current={tab} options={[
        { key: 'vigentes', label: `Vigentes · ${current.length}`, to: '?' },
        { key: 'historicos', label: `Históricos · ${past.length}`, to: '?vigencia=historicos' },
      ]} />
      {allowed.editDirectory && <Button variant="outlined" onClick={() => setCreating(true)} sx={{ minHeight: 40 }}>Crear horario</Button>}
    </Stack>
    <Pane titleId="horarios-tabla" title={schedules.isPending ? 'Cargando horarios…' : `${shown.length} ${shown.length === 1 ? 'horario' : 'horarios'} ${tab === 'vigentes' ? 'vigentes' : 'históricos'}`}
      footer={<Typography sx={{ flex: 'none', p: '10px 16px', fontSize: 12.5, color: color.subtle, borderTop: `1px solid ${color.lineSoft}` }}>
        {all.length} {all.length === 1 ? 'horario' : 'horarios'} · uno que terminó se conserva para las semanas que ya calculó
      </Typography>}>
      {schedules.isPending && <Typography role="status" sx={visuallyHidden}>Cargando horarios…</Typography>}
      {schedules.isError ? <Box sx={{ p: 2 }}><Note tone="error">No pudimos cargar los horarios.</Note></Box>
        : !schedules.isPending && !shown.length ? <Stack spacing={1} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600 }}>{tab === 'vigentes' ? 'Todavía no hay horarios' : 'No hay horarios históricos'}</Typography>
          <Typography sx={{ fontSize: 13, color: color.muted }}>{tab === 'vigentes' ? 'Crea uno con sus días, entrada, salida y comida; después se asigna a cada persona desde una fecha.' : 'Aquí quedan los horarios cuya vigencia ya terminó.'}</Typography>
        </Stack>
          : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={tableSx}>
            <thead><tr>
              <th scope="col">Horario</th><th scope="col">Días</th><th scope="col">Entrada y salida</th><th scope="col">Comida</th><th scope="col">Jornada</th><th scope="col">Vigencia</th><th scope="col">Personas</th>
              {allowed.editDirectory && tab === 'vigentes' && <th scope="col"><Box component="span" sx={visuallyHidden}>Acciones</Box></th>}
            </tr></thead>
            <tbody>
              {schedules.isPending ? <SkeletonRows columns={7} rows={4} /> : shown.map(item => <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{daysText(item.days)}</td>
                <td>{hoursText(item.days)}</td>
                <td>{breakText(item.days)}</td>
                <td><Badge tone={shiftKind(item.days) === 'Diurna' ? 'info' : 'neutral'}>{shiftKind(item.days)}</Badge></td>
                <Box component="td" sx={{ color: color.muted }}>{validityText(item.validFrom, item.validTo)}</Box>
                <td>{tab === 'vigentes' ? people(item.id) : <Badge tone="neutral">Histórico</Badge>}</td>
                {allowed.editDirectory && tab === 'vigentes' && <td><Button size="small" onClick={() => setAssigning(item)} aria-label={`Asignar ${item.name}`}>Asignar</Button></td>}
              </tr>)}
            </tbody>
          </Box></Box>}
    </Pane>
    {creating && <ScheduleModal me={me} onClose={() => setCreating(false)} />}
    {assigning && <AssignScheduleModal me={me} people={[]} schedules={all} scheduleId={assigning.id} today={today} onClose={() => setAssigning(null)} />}
  </>
}
