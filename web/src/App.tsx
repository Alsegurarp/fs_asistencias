import { useEffect, useState } from 'react'
import { Alert, AppBar, Button, CircularProgress, Container, Stack, Tab, Tabs, Toolbar, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { auth, authReady } from './auth'
import { api, type Me, permissions } from './api'
import { Directory, ErrorNotice } from './Directory'

export function App() {
  const cache = useQueryClient()
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('sites')
  useEffect(() => {
    auth.onAuthLogout = () => { setSignedIn(false); cache.clear() }
    authReady.then(() => { setSignedIn(!!auth.authenticated); setReady(true) })
      .catch(() => { setError('No se pudo conectar con el proveedor de identidad.'); setReady(true) })
    const timer = window.setInterval(() => {
      if (auth.authenticated) void auth.updateToken(60).catch(() => auth.clearToken())
    }, 30_000)
    return () => { window.clearInterval(timer); auth.onAuthLogout = undefined }
  }, [cache])
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), enabled: signedIn, retry: false })
  const allowed = permissions(me.data?.roles || [])
  const tabs = (['sites', 'employees', 'cards'] as const).filter(key => allowed[key])
  const activeTab = tabs.find(key => key === tab) || tabs[0]
  const labels = { sites: 'Sedes', employees: 'Empleados', cards: 'Tarjetas' }
  return <>
    <AppBar position="static"><Toolbar sx={{ gap: 2 }}>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>Zenit · {me.data?.tenant?.name || 'fastSolution'}</Typography>
      {signedIn && <Button color="inherit" onClick={() => { cache.clear(); void auth.logout({ redirectUri: `${window.location.origin}/` }).catch(() => setError('No se pudo cerrar la sesión en el proveedor de identidad.')) }}>Cerrar sesión</Button>}
    </Toolbar></AppBar>
    <Container maxWidth="lg" component="main" sx={{ py: 4 }}>
      {!ready ? <CircularProgress aria-label="Preparando inicio de sesión" /> : !signedIn ? <Stack spacing={3} sx={{ maxWidth: 540, mx: 'auto', py: 6 }}>
        <Typography variant="h3">Control de jornada</Typography>
        <Typography>Accede con tu cuenta de empresa para administrar sedes, empleados y tarjetas.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="contained" onClick={() => void auth.login({ redirectUri: `${window.location.origin}/` }).catch(() => setError('No se pudo iniciar sesión.'))}>Iniciar sesión</Button>
      </Stack> : <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        {me.isPending && <CircularProgress aria-label="Cargando cuenta" />}
        <ErrorNotice error={me.error} />
        {me.isError && <Button onClick={() => void me.refetch()}>Reintentar</Button>}
        {me.data && <>
          <Typography variant="h5">Hola, {me.data.displayName}</Typography>
          {!me.data.tenant && <Alert severity="info">{me.data.roles.includes('operador_saas') ? 'Tu cuenta opera el servicio. La administración de empresas se implementará en una etapa posterior.' : 'Tu cuenta no tiene acceso a una empresa. Solicita una invitación a quien la administra.'}</Alert>}
          {me.data.tenant && !tabs.length && <Alert severity="info">Tu cuenta está activa. Las pantallas de tu rol se implementarán en una etapa posterior.</Alert>}
          {!!tabs.length && <>
            <Tabs value={activeTab} onChange={(_, value: string) => setTab(value)} aria-label="Configuración de empresa">{tabs.map(key => <Tab key={key} value={key} label={labels[key]} />)}</Tabs>
            <Directory key={activeTab} kind={activeTab} me={me.data} />
          </>}
        </>}
      </Stack>}
    </Container>
  </>
}
