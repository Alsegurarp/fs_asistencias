import { useEffect, useState } from 'react'
import { Alert, Box, Button } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { auth, authReady } from './auth'
import { ApiError, api, type Me } from './api'
import { Portal } from './Portal'
import { clearDossierVerification } from './dossierFlow'
import { gradient } from './design'
import { forgetAccount, rememberAccount } from './offline'
import { CompanySuspended, FullPageLoading, IdentityUnavailable, NoCompany, SessionEnded, StateCard } from './States'
import { sessionEndedPath } from './sections'

type Session = 'starting' | 'signedIn' | 'signedOut' | 'ended' | 'unavailable'

// Un solo viaje al inicio de sesión, también con el montaje doble de StrictMode.
let signingIn = false

/**
 * Vuelve a la misma pantalla después de iniciar sesión, con lo elegido en la
 * dirección (semana, filtros, persona), salvo desde «sesión terminada».
 */
export function returnUrl() {
  if (window.location.pathname === sessionEndedPath) return `${window.location.origin}/`
  return `${window.location.origin}${window.location.pathname}${window.location.search}`
}

export function App() {
  const cache = useQueryClient()
  const [session, setSession] = useState<Session>('starting')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    auth.onAuthLogout = () => { clearDossierVerification(); cache.clear(); forgetAccount(); setSession('ended') }
    authReady.then(() => setSession(auth.authenticated ? 'signedIn' : window.location.pathname === sessionEndedPath ? 'ended' : 'signedOut'))
      .catch(() => setSession('unavailable'))
    const timer = window.setInterval(() => {
      if (auth.authenticated && navigator.onLine) void auth.updateToken(60).catch(() => auth.clearToken())
    }, 30_000)
    return () => { window.clearInterval(timer); auth.onAuthLogout = undefined }
  }, [cache])

  const signIn = () => {
    if (signingIn) return
    signingIn = true
    void auth.login({ redirectUri: returnUrl() }).catch(() => { signingIn = false; setSession('unavailable') })
  }
  // ACC-01 es la pantalla del servicio de identidad: el portal no pone otra antes.
  useEffect(() => { if (session === 'signedOut') signIn() }, [session])

  const signOut = () => {
    clearDossierVerification(); cache.clear(); forgetAccount(); setNotice('')
    void auth.logout({ redirectUri: `${window.location.origin}${sessionEndedPath}` })
      .catch(() => setNotice('No se pudo cerrar la sesión en el proveedor de identidad. Intenta de nuevo.'))
  }

  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), enabled: session === 'signedIn', retry: false })
  const userId = me.data?.userId
  useEffect(() => { if (userId) rememberAccount(userId) }, [userId])

  if (session === 'starting') return <FullPageLoading label="Preparando el inicio de sesión" />
  if (session === 'unavailable') return <IdentityUnavailable />
  if (session === 'ended') return <SessionEnded onSignIn={signIn} />
  if (session === 'signedOut') return <FullPageLoading label="Abriendo el inicio de sesión" />
  if (me.isPending) return <FullPageLoading label="Cargando tu cuenta" />
  if (me.isError) return <Box sx={{ minHeight: '100dvh', display: 'flex', p: 2, background: gradient.page }}>
    <StateCard icon="alert" eyebrow="Error" title="Algo salió mal de nuestro lado"
      reference={me.error instanceof ApiError ? me.error.correlationId : undefined}
      actions={<Button variant="contained" sx={{ minHeight: 46, px: 2.75 }} onClick={() => void me.refetch()}>Reintentar</Button>}>
      No pudimos cargar tu cuenta. Intenta de nuevo en un momento; si se repite, comparte la referencia con soporte.
    </StateCard>
  </Box>
  const email = typeof auth.tokenParsed?.email === 'string' ? auth.tokenParsed.email : undefined
  if (me.data.access === 'suspended') return <CompanySuspended company={me.data.suspendedTenantName} onSignOut={signOut} />
  if (!me.data.tenant && !me.data.roles.includes('operador_saas')) return <NoCompany email={email} onSignOut={signOut} />
  return <Portal me={me.data} email={email} onSignOut={signOut} notice={notice && <Alert severity="error">{notice}</Alert>} />
}
