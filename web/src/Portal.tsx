import { type ReactNode, useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, CircularProgress, Stack } from '@mui/material'
import { api, type Me, permissions } from './api'
import { Attendance } from './Attendance'
import { color } from './design'
import { Cards } from './Cards'
import { Closures } from './Closures'
import { Devices } from './Devices'
import { Dossiers, dossierOwner, dossierPermissionKey } from './Dossiers'
import { clearDossierVerification } from './dossierFlow'
import { AuditReport } from './AuditReport'
import { Payroll } from './Payroll'
import { Reports } from './Reports'
import { Imports } from './Imports'
import { Incidents, type IncidentSummary } from './Incidents'
import { PersonalAttendance } from './PersonalAttendance'
import { Schedules } from './Schedules'
import { Personnel } from './Personnel'
import { Sources } from './Sources'
import { Tenants } from './Tenants'
import { TenantUsage } from './TenantUsage'
import { Settings } from './Settings'
import { Users } from './Users'
import { upcomingText } from './BreakPolicyChange'
import { LegacyScreen, PageHeader, Shell, rolesText } from './Shell'
import { StateCard } from './States'
import { More } from './More'
import { NoticesButton, useNotices } from './Notices'
import { Panel } from './Panel'
import { CreateMenu, GlobalSearch } from './TopBar'
import {
  type Allowed, type Screen, type Section, companyGroups, consoleGroups, dossierCallbackPath, homePath, joinNames,
  personalScreen, personalSection, roleLabel, rolesFor, sessionEndedPath, visibleGroups, visibleScreens,
} from './sections'

type PortalProps = { me: Me; email?: string; onSignOut: () => void; notice?: ReactNode }

/** El portal con sesión: menú según el rol y una dirección por pantalla. */
export function Portal({ me, email, onSignOut, notice }: PortalProps) {
  const operator = !me.tenant && me.roles.includes('operador_saas')
  const permission = useQuery({ queryKey: dossierPermissionKey(me), queryFn: () => api<{ enabled: boolean }>('/me/dossier-permission'), enabled: !!me.tenant, retry: false })
  useEffect(() => { if (permission.isSuccess && !permission.data.enabled) clearDossierVerification() }, [permission.isSuccess, permission.data])
  // Sin empresa no hay permisos de empresa, aunque el token traiga roles.
  const allowed: Allowed = { ...permissions(me.tenant ? me.roles : []), dossier: !!me.tenant && permission.data?.enabled === true }
  const roles = me.tenant ? me.roles : me.roles.filter(role => role === 'operador_saas')
  const source = operator ? consoleGroups : me.tenant ? companyGroups : []
  const groups = visibleGroups(source, allowed, roles)
  const home = homePath(source, allowed, roles)
  const context = me.tenant?.name || 'Operación'
  const firstPath = (section: Section) => visibleScreens(section, allowed, roles)[0].path
  const all = [...companyGroups, ...consoleGroups].flatMap(group => group.sections)
  const dossierPending = !!me.tenant && permission.isPending

  const page = (section: Section, screen: Screen, callback = false) =>
    <ScreenPage me={me} section={section} screen={screen} allowed={allowed} roles={roles} context={context} home={home} dossierPending={dossierPending} callback={callback} />

  const upcoming = me.tenant?.upcomingBreakPolicy
  const { pathname } = useLocation()
  // El Panel lleva el aviso de la comida en su propio banner.
  const breakNotice = upcoming && pathname !== '/panel'
  // La campana (CTA-03) es de quien ve la operación de la empresa; los avisos salen de las mismas rutas del Panel.
  const notices = useNotices(me, !!me.tenant && allowed.attendance)
  // Las incidencias abiertas, junto a su sección en el menú.
  const incidentCount = useQuery({ queryKey: ['incident-summary', ''], queryFn: () => api<IncidentSummary>('/incidents/summary'), enabled: allowed.incidents, retry: false, staleTime: 60_000 })
  const open = incidentCount.data?.open.total
  const counts = open ? { incidencias: { value: open, label: `${open} ${open === 1 ? 'abierta' : 'abiertas'}` } } : {}
  return <Routes>
    <Route element={<Shell me={me} email={email} groups={groups} firstPath={firstPath} context={context} onSignOut={onSignOut} counts={counts}
      bell={me.tenant && allowed.attendance ? <NoticesButton notices={notices} /> : undefined}
      search={me.tenant ? <GlobalSearch me={me} /> : undefined} create={me.tenant ? <CreateMenu me={me} /> : undefined}
      notice={<>{notice}{breakNotice && <Alert severity="info" role="status" aria-live="polite">Aviso sobre la comida: {upcomingText(upcoming)}</Alert>}</>} />}>
      <Route index element={home ? <Navigate to={home} replace /> : <NoScreens me={me} />} />
      {all.flatMap(section => section.screens.map(screen => <Route key={screen.path} path={screen.path} element={page(section, screen)} />))}
      <Route path={personalScreen.path} element={page(personalSection, personalScreen)} />
      <Route path={dossierCallbackPath} element={page(all.find(section => section.key === 'reportes')!, all.flatMap(section => section.screens).find(screen => screen.key === 'dossier')!, true)} />
      <Route path="/mas" element={<More me={me} groups={groups} firstPath={firstPath} context={context} personal={allowed.personal} onSignOut={onSignOut} />} />
      <Route path={sessionEndedPath} element={<Navigate to="/" replace />} />
      {/* Las sedes ahora viven dentro de Configuración (EMP-01). */}
      <Route path="/configuracion/sedes" element={<Navigate to="/configuracion" replace />} />
      <Route path="*" element={<NotFound home={home} />} />
    </Route>
  </Routes>
}

type ScreenPageProps = { me: Me; section: Section; screen: Screen; allowed: Allowed; roles: string[]; context: string; home: string | null; dossierPending: boolean; callback: boolean }

function ScreenPage({ me, section, screen, allowed, roles, context, home, dossierPending, callback }: ScreenPageProps) {
  if (screen.key === 'dossier' && dossierPending) return <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><CircularProgress aria-label="Revisando el permiso del expediente" /></Stack>
  if (!screen.allowed(allowed, roles)) {
    if (callback) return <StateCard icon="alert" eyebrow="Expediente" title="La verificación fue descartada" actions={<HomeButton home={home} />}>
      La cuenta o el permiso del expediente cambió. La verificación fue descartada.
    </StateCard>
    return <NoPermission me={me} section={section} screen={screen} home={home} />
  }
  const screens = section.key === personalSection.key ? [screen] : visibleScreens(section, allowed, roles)
  // Las pantallas ya reconstruidas con el lienzo llevan su propio encabezado.
  if (screen.key === 'panel') return <Panel me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'attendance') return <Attendance me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'incidents') return <Incidents me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'closures') return <Closures me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'employees') return <Personnel me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'schedules') return <Schedules me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'sources') return <Sources me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'imports') return <Imports me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'devices') return <Devices me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'cards') return <Cards me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'settings') return <Settings me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'users') return <Users me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'exports') return <Reports me={me} context={context} section={section} screens={screens} screen={screen} dossier={allowed.dossier} />
  if (screen.key === 'payroll') return <Payroll me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'audit') return <AuditReport me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'tenants') return <Tenants me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'tenantUsage') return <TenantUsage me={me} context={context} section={section} screens={screens} screen={screen} />
  if (screen.key === 'dossier') return <Dossiers key={dossierOwner(me)} me={me} context={context} section={section} screen={screen} />
  return <>
    <PageHeader context={context} section={section} screens={screens} current={screen} />
    <LegacyScreen><Legacy screen={screen.key} me={me} /></LegacyScreen>
  </>
}

/** Las pantallas anteriores del portal, cada una en su dirección. */
function Legacy({ screen, me }: { screen: Screen['key']; me: Me }) {
  switch (screen) {
    case 'personal': return <PersonalAttendance me={me} />
    case 'tenants': case 'tenantUsage': case 'users': case 'exports': case 'payroll': case 'audit': case 'dossier': case 'panel': case 'attendance': case 'incidents': case 'closures': case 'employees': case 'schedules': case 'imports': case 'sources': case 'devices': case 'cards': case 'settings': return null
  }
}

function HomeButton({ home }: { home: string | null }) {
  return <Button variant="contained" component={Link} to={home || '/'} sx={{ minHeight: 46, px: 2.75, color: `${color.white} !important` }}>Ir al inicio</Button>
}

/** EST-03. */
function NoPermission({ me, section, screen, home }: { me: Me; section: Section; screen: Screen; home: string | null }) {
  useEffect(() => { document.title = 'Sin permiso · Zenit' }, [])
  const who = rolesFor(screen).map(roleLabel)
  const name = section.screens.length > 1 ? screen.tab : section.label
  const reason = screen.key === 'dossier'
    ? 'El expediente sólo lo descarga quien tiene el permiso explícito; si lo necesitas, pídeselo a Administración.'
    : `${name} sólo lo ${who.length > 1 ? 'ven' : 've'} ${joinNames(who)}; si lo necesitas, pide a Administración que te dé ese rol.`
  const mine = me.tenant ? rolesText(me) : me.roles.includes('operador_saas') ? roleLabel('operador_saas') : ''
  return <StateCard icon="closures" eyebrow="Sin permiso" title="Esta sección no está disponible para tu rol" actions={<HomeButton home={home} />}>
    {mine && `Tu rol es ${mine}. `}{reason}
  </StateCard>
}

/** EST-04. */
function NotFound({ home }: { home: string | null }) {
  useEffect(() => { document.title = 'Página no encontrada · Zenit' }, [])
  return <StateCard icon="search" eyebrow="Página no encontrada" title="No encontramos esa página" actions={<HomeButton home={home} />}>
    Puede que el enlace esté incompleto o que lo que buscas se haya dado de baja.
  </StateCard>
}

/** Cuenta vigente cuyo rol no tiene pantallas en el portal. */
function NoScreens({ me }: { me: Me }) {
  return <StateCard icon="person" eyebrow="Tu cuenta" title="Tu cuenta está activa">
    {me.roles.length ? `Tu rol es ${rolesText(me)} y todavía no tiene pantallas en el portal.` : 'Tu cuenta todavía no tiene un rol con pantallas en el portal.'} Pide a Administración el rol que necesitas.
  </StateCard>
}
