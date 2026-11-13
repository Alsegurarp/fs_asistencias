import { useEffect, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Portal instalable y sin conexión (TEL-03, EST-06). El service worker
 * (`public/sw.js`) guarda lo último que se consultó para verlo sin red; nada
 * que escriba se guarda ni se encola. Lo guardado se borra al cerrar sesión y
 * cuando entra otra cuenta en el mismo equipo.
 */

const accountKey = 'zenit.cuenta-sin-conexion'
const dismissedKey = 'zenit.instalar-ahora-no'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
let installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event as InstallEvent; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; notify() })
}

/** Registra el service worker en la versión publicada; en desarrollo no hace falta. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined) })
}

/** Borra lo guardado para ver sin red. */
export async function clearOfflineData() {
  try {
    navigator.serviceWorker?.controller?.postMessage('limpiar')
    if ('caches' in window) await caches.delete('zenit-api-v1')
  } catch { /* sin almacenamiento: no hay nada que borrar */ }
}

/** Si entra otra cuenta en el mismo equipo, lo guardado de la anterior se borra. */
export function rememberAccount(userId: string) {
  try {
    const previous = window.localStorage.getItem(accountKey)
    if (previous && previous !== userId) void clearOfflineData()
    window.localStorage.setItem(accountKey, userId)
  } catch { /* sin almacenamiento: se borra al cerrar sesión */ }
}

export function forgetAccount() {
  try { window.localStorage.removeItem(accountKey) } catch { /* nada que olvidar */ }
  void clearOfflineData()
}

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback) }
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

/** La hora de los datos más recientes que trajo el servidor. */
export function useDataTime() {
  const cache = useQueryClient().getQueryCache()
  const latest = () => Math.max(0, ...cache.getAll().map(query => query.state.dataUpdatedAt))
  const [time, setTime] = useState(latest)
  useEffect(() => cache.subscribe(() => setTime(latest())), [cache]) // eslint-disable-line react-hooks/exhaustive-deps
  return time || null
}

export function useInstall() {
  const subscribe = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback) } }
  const available = useSyncExternalStore(subscribe, () => !!deferred, () => false)
  const done = useSyncExternalStore(subscribe, () => installed, () => false)
  const install = async () => {
    const event = deferred
    if (!event) return
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') { deferred = null; installed = true }
    notify()
  }
  return { available, installed: done, install }
}

export function installDismissed() {
  try { return window.localStorage.getItem(dismissedKey) === '1' } catch { return false }
}

export function dismissInstall() {
  try { window.localStorage.setItem(dismissedKey, '1') } catch { /* sólo dura la visita */ }
}
