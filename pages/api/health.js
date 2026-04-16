// pages/api/health.js
// Diagnostic endpoint to verify required Supabase environment variables are configured.
// Visit /api/health to check server configuration without exposing secret values.

export default function handler(req, res) {
  // Prevent browsers and CDNs from caching health-check responses.
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: (() => {
      if (!supabaseUrl) return { ok: false, message: 'Not set' };
      if (typeof supabaseUrl !== 'string' || !supabaseUrl.startsWith('http')) {
        return { ok: false, message: 'Invalid format — must start with http:// or https://' };
      }
      return { ok: true };
    })(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      ok: !!supabaseAnonKey,
      message: supabaseAnonKey ? undefined : 'Not set',
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      ok: !!serviceRoleKey,
      message: serviceRoleKey ? undefined : 'Not set',
    },
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'misconfigured',
    checks,
  });
}
