import { createClient } from '@supabase/supabase-js';
import { generateCustomerId } from '../../utils/loyaltyUtils';

// Validate environment variables and create the admin client lazily so that
// a missing/invalid NEXT_PUBLIC_SUPABASE_URL does not throw an unhandled
// exception at module-import time (which would surface as a 500 with no
// useful message to the caller).
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    console.error('[register] NEXT_PUBLIC_SUPABASE_URL is not set or invalid:', url);
    return null;
  }
  if (!serviceRoleKey) {
    console.error('[register] SUPABASE_SERVICE_ROLE_KEY is not set');
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  // Prevent browsers from caching API responses; stale cached responses
  // can trigger "Content unavailable. Resource was not cached" errors.
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fullName, email, phone, password, address } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable. Please contact support.' });
  }

  try {
    // Check if the user already exists
    const { data: userExists } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (userExists) {
      return res.status(400).json({ error: 'A user with this email address has already been registered.' });
    }

    // Register user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      // Supabase returns 400 for lots of reasons ("Password too short", "Invalid email", etc)
      return res.status(400).json({ error: error.message });
    }

    // Generate a unique loyalty customer ID and persist the user profile
    const customerId = generateCustomerId();
    await supabaseAdmin.from('users').insert([{
      id: data.user.id,
      email,
      full_name: fullName || null,
      phone: phone || null,
      address: address || null,
      customer_id: customerId,
      loyalty_balance: 0,
      role: 'customer',
    }]);

    return res.status(200).json({ success: true, customerId, user: data.user });
  } catch (err) {
    // Log the error server-side for debugging
    console.error('Registration API error:', err);
    return res.status(500).json({ error: 'Unexpected server error during registration.' });
  }
}

/*
Environment variables required:
- NEXT_PUBLIC_SUPABASE_URL (from Supabase > Project > Settings > API)
- SUPABASE_SERVICE_ROLE_KEY (from Supabase > Project > Settings > API > Service Role)

Required package:
- @supabase/supabase-js

Your Supabase table with user emails must be called 'users' (change above if your schema differs).
To test locally, add the .env.local file to your Next.js project with the same variable names and values.
*/
