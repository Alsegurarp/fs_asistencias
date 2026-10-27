import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Stack, Tab, Tabs } from '@mui/material'
import { api, type Me, permissions } from './api'
import { Dossiers, dossierOwner, dossierPermissionKey } from './Dossiers'
import { clearDossierVerification } from './dossierFlow'
import { Directory } from './Directory'
import { Incidents, type IncidentTarget } from './Incidents'
import { Closures } from './Closures'
import { Exports } from './Exports'
import { Users } from './Users'
import { Schedules } from './Schedules'
import { Imports } from './Imports'
import { Devices } from './Devices'
import { Tenants } from './Tenants'
import { TenantSettings } from './TenantSettings'
import { PersonalAttendance } from './PersonalAttendance'

const sections = ['personal', 'sites', 'employees', 'schedules', 'imports', 'cards', 'devices', 'incidents', 'closures', 'exports', 'dossier', 'users', 'settings'] as const
const labels = { personal: 'Mi asistencia', sites: 'Sedes', employees: 'Empleados', schedules: 'Horarios', imports: 'Importar empleados', cards: 'Tarjetas', devices: 'Dispositivos', incidents: 'Incidencias', closures: 'Cierres', exports: 'Exportes', dossier: 'Expediente empresarial', users: 'Usuarios', settings: 'Configuración' }

export function Workspace({ me }: { me: Me }) {
  const [selected, setSelected] = useState<string>(() => window.location.pathname === '/dossier/callback' ? 'dossier' : 'sites')
  const [incidentTarget, setIncidentTarget] = useState<IncidentTarget | undefined>()
  const permission = useQuery({ queryKey: dossierPermissionKey(me), queryFn: () => api<{ enabled: boolean }>('/me/dossier-permission'), enabled: !!me.tenant, retry: false })
  useEffect(() => { if (permission.isSuccess && !permission.data.enabled) clearDossierVerification() }, [permission.isSuccess, permission.data])
  const allowed = { ...permissions(me.roles), dossier: permission.data?.enabled === true }
  const tabs = me.tenant ? sections.filter(key => allowed[key]) : []
  const active = tabs.find(key => key === selected) || tabs[0]

  if (!me.tenant) return me.roles.includes('operador_saas') ? <Tenants me={me} /> : <Alert severity="info">Tu cuenta no tiene acceso a una empresa. Solicita una invitación a quien la administra.</Alert>
  if (!active) return <Alert severity="info">Tu cuenta está activa. Las pantallas de tu rol se implementarán en una etapa posterior.</Alert>

  return <>
    {window.location.pathname === '/dossier/callback' && permission.isSuccess && !allowed.dossier && <Alert severity="error">La cuenta o el permiso del expediente cambió. La verificación fue descartada.</Alert>}
    <Tabs value={active} onChange={(_, value: string) => setSelected(value)} variant="scrollable" scrollButtons="auto" aria-label="Secciones de empresa">
      {tabs.map(key => <Tab key={key} value={key} label={labels[key]} id={`tab-${key}`} aria-controls={`panel-${key}`} />)}
    </Tabs>
    <Stack role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} spacing={2}>
      {active === 'dossier' && <Dossiers key={dossierOwner(me)} me={me} />}
      {active === 'personal' ? <PersonalAttendance me={me} /> : active === 'sites' || active === 'employees' || active === 'cards'
        ? <Directory key={active} kind={active} me={me} />
        : active === 'incidents' ? <Incidents me={me} initial={incidentTarget} />
        : active === 'closures' ? <Closures me={me} onIncidents={target => { setIncidentTarget(target); setSelected('incidents') }} /> : active === 'exports' ? <Exports me={me} /> : active === 'users' ? <Users me={me} /> : active === 'schedules' ? <Schedules me={me} /> : active === 'devices' ? <Devices me={me} /> : active === 'settings' ? <TenantSettings me={me} /> : active === 'imports' ? <Imports me={me} /> : null}
    </Stack>
  </>
}
