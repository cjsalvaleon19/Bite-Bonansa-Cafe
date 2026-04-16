/**
 * Service Worker for Bite Bonansa Cafe
 *
 * Strategy:
 *  - Static assets (/_next/static/): cache-first (they are content-hashed and never change).
 *  - HTML navigation requests: network-first, fall back to cached version, then offline.html.
 *  - Everything else: network-first with cache fallback.
 *
 * This ensures the app is available offline after the first visit and prevents
 * "Content unavailable. Resource was not cached" by always storing a copy of
 * visited pages and handing back the cached response when the network is absent.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `bite-bonansa-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// ---------- install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => {
        console.log('[SW] Installed and offline page cached.');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Install failed – could not cache offline page:', err);
      })
  );
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests from the same origin.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // --- Cache-first for immutable Next.js static assets ---
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // --- Network-first for HTML navigation and everything else ---
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        console.warn('[SW] Network failed for', request.url, '– checking cache');
        return caches.match(request).then((cached) => {
          if (cached) {
            console.log('[SW] Serving from cache:', request.url);
            return cached;
          }
          // For navigation requests show the offline page.
          if (request.mode === 'navigate') {
            console.warn('[SW] No cache for navigation, returning offline page');
            return caches.match(OFFLINE_URL);
          }
          // For other resources return an empty 503 so the page can handle it.
          return new Response('Resource unavailable offline.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});
