/**
 * GET /api/health
 * Returns the configuration status of required environment variables.
 * Values are never exposed — only whether each variable is set and valid.
 */

/** Minimum character length to consider a Supabase key valid. */
const MIN_KEY_LENGTH = 10;

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: {
      set: Boolean(supabaseUrl),
      valid: Boolean(supabaseUrl && supabaseUrl.startsWith('http')),
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      set: Boolean(anonKey),
      valid: Boolean(anonKey && anonKey.length > MIN_KEY_LENGTH),
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      set: Boolean(serviceRoleKey),
      valid: Boolean(serviceRoleKey && serviceRoleKey.length > MIN_KEY_LENGTH),
    },
  };

  const allValid = Object.values(checks).every((c) => c.set && c.valid);

  return res.status(allValid ? 200 : 503).json({
    status: allValid ? 'ok' : 'misconfigured',
    checks,
    hint: allValid
      ? 'All required environment variables are configured.'
      : 'One or more required environment variables are missing or invalid. ' +
        'Set them in Vercel: Project Settings → Environment Variables. ' +
        'See .env.example for the required variable names.',
  });
}
