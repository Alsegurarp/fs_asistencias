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
// Sin red no se intenta: revisar la sesión lleva al navegador al servicio de
// identidad y, sin señal, la página quedaría en blanco (EST-06).
export const authReady = typeof navigator !== 'undefined' && navigator.onLine === false
  ? Promise.reject(new Error('Sin conexión'))
  : auth.init({ onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false })
// Quien la usa trata el error; aquí sólo se evita el aviso de promesa sin atender.
authReady.catch(() => undefined)

export async function accessToken() {
  if (!auth.authenticated) throw new Error('Inicia sesión para continuar.')
  try {
    await auth.updateToken(30)
  } catch {
    // Sin red no se puede renovar; la sesión sigue y el service worker responde con lo guardado.
    if (!navigator.onLine && auth.token) return auth.token
    clearDossierVerification()
    auth.clearToken()
    throw new Error('La sesión venció. Vuelve a iniciar sesión.')
  }
  if (!auth.token) throw new Error('La sesión venció. Vuelve a iniciar sesión.')
  return auth.token
}
