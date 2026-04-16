/**
 * Service Worker for Bite Bonansa Cafe
 *
 * Strategy:
 *  - Static Next.js assets (/_next/static/): cache-first (immutable, hash-named).
 *  - HTML navigation requests: network-first; fall back to /offline when the
 *    network is unavailable so users see a friendly message instead of the
 *    browser's "Content unavailable. Resource was not cached" error.
 *  - API routes (/api/*): network-only (never cache dynamic data).
 *  - Everything else (fonts, favicon, etc.): stale-while-revalidate.
 */

const CACHE_NAME = 'bite-bonansa-v1';

// Pages and assets to pre-cache on service worker install.
const PRECACHE_URLS = [
  '/offline',
  '/favicon.svg',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests from the same origin.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls: always go to the network; never serve stale data.
  if (url.pathname.startsWith('/api/')) return;

  // Immutable static assets: cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // HTML navigation: network-first; fall back to /offline on failure.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then(
          (cached) =>
            cached ||
            new Response('You are offline. Please check your connection.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            }),
        ),
      ),
    );
    return;
  }

  // All other same-origin requests: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — return the cached copy if available, otherwise
          // let the rejection propagate so the browser can show an error.
          if (cached) return cached;
          throw new Error('Network error and no cache available for: ' + request.url);
        });
      return cached || network;
    }),
  );
});
