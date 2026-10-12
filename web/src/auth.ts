import Keycloak from 'keycloak-js'

export const auth = new Keycloak({
  url: import.meta.env.VITE_IDENTITY_URL || 'http://localhost:8082',
  realm: 'zenit',
  clientId: 'zenit-portal',
})

// Una sola inicialización, también durante el montaje doble de StrictMode.
export const authReady = auth.init({ pkceMethod: 'S256', checkLoginIframe: false })

export async function accessToken() {
  if (!auth.authenticated) throw new Error('Inicia sesión para continuar.')
  try {
    await auth.updateToken(30)
  } catch {
    auth.clearToken()
    throw new Error('La sesión venció. Vuelve a iniciar sesión.')
  }
  if (!auth.token) throw new Error('La sesión venció. Vuelve a iniciar sesión.')
  return auth.token
}
