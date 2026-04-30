/**
 * Service Worker for Bite Bonansa Cafe
 *
 * Strategy:
 *  - Static Next.js assets (/_next/static/): cache-first (immutable, hash-named).
 *    Falls back to network; if network also fails, returns a 503 so the browser
 *    never sees a rejected respondWith() promise (which would show the browser's
 *    "Content unavailable. Resource was not cached" error page).
 *  - HTML navigation requests: network-first, caching each successful response so
 *    previously-visited pages work offline.  Falls back to the cached copy of the
 *    requested URL, then to /offline, then to an inline 503 text response.
 *    The chain is designed so event.respondWith() is NEVER given a rejected promise.
 *  - API routes (/api/*): network-only (never cache dynamic data).
 *  - Everything else (same-origin fonts, favicon, etc.): stale-while-revalidate.
 *    Returns a 503 on cache-miss + network failure instead of throwing, to prevent
 *    the browser error page.
 *
 * BREAKING CHANGE (v8): Cache version bumped to 'bite-bonansa-v8'.
 *  The activate handler purges all older caches ('bite-bonansa-v1' through 'bite-bonansa-v7')
 *  automatically so stale or corrupt cache entries do not persist.
 *  Added cashier pages to precache list.
 *  Fixed: Skip caching partial responses (HTTP 206) to prevent cache.put() errors.
 */

const CACHE_NAME = 'bite-bonansa-v8';

// Key pages and assets to pre-cache on service worker install so they are
// available offline even on first visit (including the dashboard).
const PRECACHE_URLS = [
  '/',
  '/login',
  '/dashboard',
  '/customer/dashboard',
  '/customer/order',
  '/cashier/dashboard',
  '/cashier/pos',
  '/cashier/orders-queue',
  '/rider/dashboard',
  '/rider/deliveries',
  '/rider/reports',
  '/rider/profile',
  '/offline',
  '/favicon.svg',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker, cache:', CACHE_NAME);
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
              if (response.ok) {
                console.log('[SW] Pre-cached:', url);
                return cache.put(url, response.clone());
              }
              // Returning undefined here is intentional: the outer Promise.all
              // treats it as a resolved (non-fatal) result, keeping the install
              // non-atomic so one bad URL does not prevent the others from caching.
              console.warn('[SW] Pre-cache skipped (non-ok response):', url, response.status);
            })
            .catch((err) => {
              // Non-fatal: if a URL cannot be fetched at install time, skip it.
              // It will be cached on first successful network request.
              console.warn('[SW] Pre-cache fetch failed for:', url, err && err.message);
            }),
        ),
      ),
    ).then(() => {
      console.log('[SW] Install complete, skipping waiting');
      return self.skipWaiting();
    }),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating, purging old caches...');
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
            }),
        ),
      )
      .then(() => {
        console.log('[SW] Activation complete, claiming clients');
        return self.clients.claim();
      }),
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
  // If both cache and network fail, return a 503 instead of letting the promise
  // reject — a rejected respondWith() causes Chrome to show the browser's own
  // "Content unavailable. Resource was not cached" error page.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
              }
              return response;
            })
            .catch((err) => {
              console.warn('[SW] Static asset fetch failed (offline?):', url.pathname, err && err.message);
              // Return a 503 so the browser does not show the "Resource was not
              // cached" error page for a missing JS/CSS chunk.
              return new Response('', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' },
              });
            }),
      ),
    );
    return;
  }

  // HTML navigation: network-first; cache successful responses so previously-
  // visited pages work offline.  On failure, return the cached copy of the
  // specific page, then fall back to /offline, then to an inline 503 response.
  // This chain ALWAYS resolves (never rejects), preventing Chrome's built-in
  // "Content unavailable. Resource was not cached" error page.
  //
  // NOTE: The response is cloned before caching so the original body stream
  // remains available for the browser. Using a single fetch chain (rather than
  // a shared promise referenced by both event.waitUntil and event.respondWith)
  // avoids the subtle race where both consumers try to read the same Response
  // body, which would cause one of them to receive an already-consumed stream.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses; non-ok responses (4xx/5xx) are
          // intentionally skipped to avoid persisting error pages offline.
          if (response.ok) {
            const clone = response.clone();
            // Cache write is best-effort — do not let it delay the response.
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            console.log('[SW] Navigation response cached:', url.pathname);
          } else if (response.status !== 0) {
            // Only log non-ok responses that have actual status codes (not network failures)
            console.warn('[SW] Navigation response not cached (non-ok):', url.pathname, response.status);
          }
          return response;
        })
        .catch((err) => {
          console.warn('[SW] Navigation fetch failed, checking cache:', url.pathname, err && err.message);
          return caches.match(request).then(
            (cached) => {
              if (cached) {
                console.log('[SW] Serving cached navigation page:', url.pathname);
                return cached;
              }
              console.warn('[SW] No cached page, falling back to /offline');
              return caches.match('/offline').then(
                (offlinePage) =>
                  offlinePage ||
                  new Response(
                    [
                      '<!DOCTYPE html>',
                      '<html lang="en"><head><meta charset="utf-8">',
                      '<title>You are offline — Bite Bonansa Cafe</title>',
                      '<style>body{font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0a;color:#fff}',
                      'h1{color:#ffc107}p{color:#aaa}</style></head>',
                      '<body><h1>You are offline</h1>',
                      '<p>This page is not available offline.</p>',
                      '<p>Please check your connection and <a href="" style="color:#ffc107">try again</a>.</p>',
                      '</body></html>',
                    ].join(''),
                    {
                      status: 503,
                      headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    },
                  ),
              );
            },
          );
        }),
    );
    return;
  }

  // All other same-origin requests: stale-while-revalidate.
  // IMPORTANT: The network .catch() must NEVER throw — it must always return a
  // Response.  A thrown error causes event.respondWith() to receive a rejected
  // promise, which makes Chrome replace the page with its built-in
  // "Content unavailable. Resource was not cached" error page.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          // Only cache successful, complete responses (not partial 206 responses)
          if (response.ok && response.status !== 206) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch((err) => {
          // Network failed — return the cached copy if available, otherwise
          // return a 503 so the browser can display a useful error rather than
          // Chrome's "Content unavailable. Resource was not cached" page.
          if (cached) {
            console.warn('[SW] Network failed, serving from cache:', url.pathname);
            return cached;
          }
          console.warn('[SW] Network failed and no cache for:', url.pathname, err && err.message);
          return new Response('Resource unavailable offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      return cached || network;
    }),
  );
});
