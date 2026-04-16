// ─── Security Notes ──────────────────────────────────────────────────────────
// Next.js version: 15.5.15 (patched release — 0 known vulnerabilities).
// See README "Dependency Upgrades & Migration Notes" for the full upgrade path
// (14.2.10 → 14.2.35 → 15.5.15) and migration considerations.
//
// MIGRATION NOTE (14.x → 15.x, Pages Router):
//   - Pages Router API is unchanged; no code updates were needed for this app.
//   - 'unsafe-inline' is still required in the CSP script-src directive for
//     Next.js Pages Router hydration scripts (same as before).
//   - If you migrate to the App Router in the future, replace 'unsafe-inline'
//     with a nonce-based CSP using Next.js middleware.
// ─────────────────────────────────────────────────────────────────────────────

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    // Disallows eval(), new Function(), and string-based setTimeout/setInterval.
    // 'unsafe-inline' is required for Next.js inline hydration scripts (pages router).
    // Remove 'unsafe-inline' and use nonces if you migrate to the App Router with middleware.
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Prevent browsers from caching HTML pages and API responses.
        // This stops the browser from showing "Content unavailable. Resource was not
        // cached" when a previously visited page can no longer be fetched from the network.
        // Static assets under /_next/static/ are intentionally excluded here because
        // Next.js already sets long-lived immutable cache headers for them.
        source: '/((?!_next/static|_next/image).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
