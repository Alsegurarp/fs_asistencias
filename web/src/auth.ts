import Keycloak from 'keycloak-js'
import { captureDossierCallback, clearDossierVerification } from './dossierFlow'

export const identityBase = import.meta.env.VITE_IDENTITY_URL || 'http://localhost:8082'
captureDossierCallback()

export const auth = new Keycloak({
  url: identityBase,
  realm: 'zenit',
  clientId: 'zenit-portal',
})

// Una sola inicialización, también durante el montaje doble de StrictMode.
export const authReady = auth.init({ onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false })

export async function accessToken() {
  if (!auth.authenticated) throw new Error('Inicia sesión para continuar.')
  try {
    await auth.updateToken(30)
  } catch {
    clearDossierVerification()
    auth.clearToken()
    throw new Error('La sesión venció. Vuelve a iniciar sesión.')
  }
  if (!auth.token) throw new Error('La sesión venció. Vuelve a iniciar sesión.')
  return auth.token
}
