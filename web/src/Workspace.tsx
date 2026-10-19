import { useState } from 'react'
import { Alert, Stack, Tab, Tabs } from '@mui/material'
import { type Me, permissions } from './api'
import { Directory } from './Directory'
import { Incidents, type IncidentTarget } from './Incidents'
import { Closures } from './Closures'
import { Exports } from './Exports'
import { Users } from './Users'
import { Schedules } from './Schedules'
import { Imports } from './Imports'
import { Devices } from './Devices'
import { Tenants } from './Tenants'

const sections = ['sites', 'employees', 'schedules', 'imports', 'cards', 'devices', 'incidents', 'closures', 'exports', 'users'] as const
const labels = { sites: 'Sedes', employees: 'Empleados', schedules: 'Horarios', imports: 'Importar empleados', cards: 'Tarjetas', devices: 'Dispositivos', incidents: 'Incidencias', closures: 'Cierres', exports: 'Exportes', users: 'Usuarios' }

export function Workspace({ me }: { me: Me }) {
  const [selected, setSelected] = useState<string>('sites')
  const [incidentTarget, setIncidentTarget] = useState<IncidentTarget | undefined>()
  const allowed = permissions(me.roles)
  const tabs = me.tenant ? sections.filter(key => allowed[key]) : []
  const active = tabs.find(key => key === selected) || tabs[0]

  if (!me.tenant) return me.roles.includes('operador_saas') ? <Tenants me={me} /> : <Alert severity="info">Tu cuenta no tiene acceso a una empresa. Solicita una invitación a quien la administra.</Alert>
  if (!active) return <Alert severity="info">Tu cuenta está activa. Las pantallas de tu rol se implementarán en una etapa posterior.</Alert>

  return <>
    <Tabs value={active} onChange={(_, value: string) => setSelected(value)} variant="scrollable" scrollButtons="auto" aria-label="Secciones de empresa">
      {tabs.map(key => <Tab key={key} value={key} label={labels[key]} id={`tab-${key}`} aria-controls={`panel-${key}`} />)}
    </Tabs>
    <Stack role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} spacing={2}>
      {active === 'sites' || active === 'employees' || active === 'cards'
        ? <Directory key={active} kind={active} me={me} />
        : active === 'incidents' ? <Incidents me={me} initial={incidentTarget} />
        : active === 'closures' ? <Closures me={me} onIncidents={target => { setIncidentTarget(target); setSelected('incidents') }} /> : active === 'exports' ? <Exports me={me} /> : active === 'users' ? <Users me={me} /> : active === 'schedules' ? <Schedules me={me} /> : active === 'devices' ? <Devices me={me} /> : <Imports me={me} />}
    </Stack>
  </>
}
