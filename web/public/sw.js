// Service worker del portal de Zenit (TEL-03, EST-06). Abre sin red la
// aplicación y lo último que se consultó. Sólo lectura: lo que escribe (POST,
// PUT, PATCH, DELETE) pasa directo y no se encola; los archivos descargados y
// el expediente no se guardan. El portal borra lo guardado al cerrar sesión.
const SHELL = 'zenit-shell-v1'
const API = 'zenit-api-v1'
const NO_GUARDAR = /\/(download|manifest|challenges|authorizations)$|^\/api\/v1\/dossiers|^\/api\/v1\/exports\/[^/]+\/file/

// Al instalarse guarda la página y los archivos que carga, para abrir sin red.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL)
    const page = await fetch('/', { cache: 'no-store' })
    const html = await page.clone().text()
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]))]
    await cache.put('/', page)
    await cache.addAll(['/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', ...assets])
  })())
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== SHELL && key !== API) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data === 'limpiar') event.waitUntil(caches.delete(API))
})

const guardar = (nombre, request, response) => {
  const copia = response.clone()
  return caches.open(nombre).then(cache => cache.put(request, copia))
}

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    if (NO_GUARDAR.test(url.pathname)) return
    // Primero la red; sin red, lo último que respondió el servidor.
    event.respondWith(fetch(request).then(response => {
      if (response.ok && (response.headers.get('content-type') || '').includes('json')) event.waitUntil(guardar(API, request, response))
      return response
    }).catch(async () => (await caches.match(request, { cacheName: API, ignoreVary: true })) || Response.error()))
    return
  }

  if (request.mode === 'navigate') {
    // Toda dirección del portal es la misma página; sin red se abre la guardada.
    event.respondWith(fetch(request).then(response => {
      if (response.ok) event.waitUntil(guardar(SHELL, '/', response))
      return response
    }).catch(async () => (await caches.match('/', { cacheName: SHELL })) || Response.error()))
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    // Los archivos de la compilación llevan su huella en el nombre: no cambian.
    event.respondWith(caches.match(request, { cacheName: SHELL }).then(hit => hit || fetch(request).then(response => {
      if (response.ok) event.waitUntil(guardar(SHELL, request, response))
      return response
    })))
  }
})
