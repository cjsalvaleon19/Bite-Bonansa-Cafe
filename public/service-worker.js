/**
 * Service Worker for Bite Bonansa Cafe
 *
 * Strategy:
 *  - Static Next.js assets (/_next/static/): cache-first (immutable, hash-named).
 *  - HTML navigation requests: network-first, caching each successful response so
 *    previously-visited pages are available offline; falls back to the cached copy
 *    of the requested URL, then to /offline, to prevent the browser's
 *    "Content unavailable. Resource was not cached" error.
 *  - API routes (/api/*): network-only (never cache dynamic data).
 *  - Everything else (fonts, favicon, etc.): stale-while-revalidate.
 *
 * BREAKING CHANGE (v2): Cache version bumped to 'bite-bonansa-v2'.
 *  The activate handler purges the old 'bite-bonansa-v1' cache automatically.
 */

const CACHE_NAME = 'bite-bonansa-v2';

// Key pages and assets to pre-cache on service worker install so they are
// available offline even on first visit.
const PRECACHE_URLS = [
  '/',
  '/login',
  '/offline',
  '/favicon.svg',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Pre-cache each URL individually so a single fetch failure does NOT abort
  // the entire install (unlike cache.addAll which is atomic).
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url)
            .then((response) => {
              // Clone the response before caching: a Response body can only be
              // consumed once, and cache.put reads the body internally.
              // Non-ok responses (4xx/5xx) are intentionally skipped — only
              // successful responses are worth caching for offline use.
              if (response.ok) return cache.put(url, response.clone());
              // Returning undefined here is intentional: the outer Promise.all
              // treats it as a resolved (non-fatal) result, keeping the install
              // non-atomic so one bad URL does not prevent the others from caching.
            })
            .catch(() => {
              // Non-fatal: if a URL cannot be fetched at install time, skip it.
              // It will be cached on first successful network request.
            }),
        ),
      ),
    ).then(() => self.skipWaiting()),
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

  // HTML navigation: network-first; cache successful responses so previously-
  // visited pages work offline.  On failure, return the cached copy of the
  // specific page, then fall back to /offline, preventing the browser's
  // "Content unavailable. Resource was not cached" error.
  if (request.mode === 'navigate') {
    const networkFetch = fetch(request);

    // Extend the service worker lifetime so the cache write fully completes
    // even if the page load finishes quickly.  Caching is best-effort.
    event.waitUntil(
      networkFetch
        .then((response) => {
          // Only cache successful responses; non-ok responses (4xx/5xx) are
          // intentionally skipped to avoid persisting error pages offline.
          if (!response.ok) return;
          return caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, response.clone()));
        })
        .catch(() => {}), // swallow errors — caching is best-effort
    );

    // Respond with the live network response, or fall back gracefully.
    event.respondWith(
      networkFetch.catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            caches.match('/offline').then(
              (offlinePage) =>
                offlinePage ||
                new Response('You are offline. Please check your connection.', {
                  status: 503,
                  headers: { 'Content-Type': 'text/plain' },
                }),
            ),
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
