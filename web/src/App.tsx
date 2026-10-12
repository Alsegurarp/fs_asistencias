import { useEffect, useState } from 'react'
import { Alert, AppBar, Button, CircularProgress, Container, Stack, Toolbar, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { auth, authReady } from './auth'
import { api, type Me } from './api'
import { ErrorNotice } from './Directory'
import { Workspace } from './Workspace'

export function App() {
  const cache = useQueryClient()
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState('')
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
          <Workspace me={me.data} />
        </>}
      </Stack>}
    </Container>
  </>
}
