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
      // Allow same-origin service workers (sw.js served from /public).
      "worker-src 'self'",
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
        // The service worker must never be served from a stale HTTP cache,
        // otherwise browsers keep running an outdated version.
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
