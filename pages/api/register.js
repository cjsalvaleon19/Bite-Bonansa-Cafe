import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    // Check if the user already exists
    const { data: userExists, error: fetchError } = await supabaseAdmin
      .from('users') // make sure this table name matches your Supabase table!
      .select('id')
      .eq('email', email)
      .single();

    if (userExists) {
      return res.status(400).json({ error: 'A user with this email address has already been registered.' });
    }

    // Register user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Adjust if you want a verification email or not
    });

    if (error) {
      // Supabase returns 400 for lots of reasons ("Password too short", "Invalid email", etc)
      return res.status(400).json({ error: error.message });
    }

    // Add to your 'users' table if you track custom profile fields
    // await supabaseAdmin.from('users').insert([{ email, ...extraProfileFields }])

    return res.status(200).json({ user: data.user });
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
