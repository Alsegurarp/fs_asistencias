import { useState } from 'react'
import { Alert, Stack, Tab, Tabs, Typography } from '@mui/material'
import { type Me, permissions } from './api'
import { Directory } from './Directory'
import { Incidents } from './Incidents'

const sections = ['sites', 'employees', 'cards', 'incidents', 'closures', 'exports'] as const
const labels = { sites: 'Sedes', employees: 'Empleados', cards: 'Tarjetas', incidents: 'Incidencias', closures: 'Cierres', exports: 'Exportes' }

export function Workspace({ me }: { me: Me }) {
  const [selected, setSelected] = useState<string>('sites')
  const allowed = permissions(me.roles)
  const tabs = me.tenant ? sections.filter(key => allowed[key]) : []
  const active = tabs.find(key => key === selected) || tabs[0]

  if (!me.tenant) return <Alert severity="info">{me.roles.includes('operador_saas') ? 'Tu cuenta opera el servicio. La administración de empresas se implementará en una etapa posterior.' : 'Tu cuenta no tiene acceso a una empresa. Solicita una invitación a quien la administra.'}</Alert>
  if (!active) return <Alert severity="info">Tu cuenta está activa. Las pantallas de tu rol se implementarán en una etapa posterior.</Alert>

  return <>
    <Tabs value={active} onChange={(_, value: string) => setSelected(value)} variant="scrollable" scrollButtons="auto" aria-label="Secciones de empresa">
      {tabs.map(key => <Tab key={key} value={key} label={labels[key]} id={`tab-${key}`} aria-controls={`panel-${key}`} />)}
    </Tabs>
    <Stack role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} spacing={2}>
      {active === 'sites' || active === 'employees' || active === 'cards'
        ? <Directory key={active} kind={active} me={me} />
        : active === 'incidents' ? <Incidents me={me} /> : <>
          <Typography variant="h5">{labels[active]}</Typography>
          <Alert severity="info">Esta sección está en preparación. Sus funciones estarán disponibles en la siguiente etapa.</Alert>
        </>}
    </Stack>
  </>
}
