const CACHE_NAME = 'swl-attendance-v10'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/company-logo.png',
  '/softwind-logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/favicon-64.png'
]

// 1. Install: Activate immediately without waiting for old instances
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
})

// 2. Activate: Wipe ALL previous caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key)
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// 3. Message handling for instant client updates
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data === 'CLEAR_CACHE' || event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)))
    }).then(() => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.navigate(c.url))
      })
    })
  }
})

// 4. Fetch: Strict Network-First for HTML, Scripts, Styles, Navigation
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  // Skip Firestore API, Firebase Auth, and Chrome extensions
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('identitytoolkit.googleapis.com') ||
    url.origin.includes('firebaseapp.com') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return
  }

  // Network-First for HTML, JS bundles, and CSS stylesheets (Always fetch latest code!)
  const isCodeAsset = (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.includes('/assets/')
  )

  if (isCodeAsset) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return networkResponse
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : null)
          })
        })
    )
    return
  }

  // Stale-While-Revalidate for images, icons, and fonts
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    })
  )
})
