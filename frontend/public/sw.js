const CACHE_NAME = 'boai-music-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(requestUrl) {
  return (
    requestUrl.origin === self.location.origin &&
    (requestUrl.pathname === '/' ||
      requestUrl.pathname.endsWith('.html') ||
      requestUrl.pathname.endsWith('.js') ||
      requestUrl.pathname.endsWith('.css') ||
      requestUrl.pathname.endsWith('.svg') ||
      requestUrl.pathname.endsWith('.json') ||
      requestUrl.pathname.endsWith('.webmanifest') ||
      requestUrl.pathname.startsWith('/assets/'))
  )
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone))
          return response
        })
        .catch(async () => (await caches.match(event.request)) || caches.match('/index.html') || Response.error()),
    )
    return
  }

  if (!isStaticAsset(requestUrl)) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          }

          return response
        })
        .catch(() => Response.error())
    }),
  )
})
