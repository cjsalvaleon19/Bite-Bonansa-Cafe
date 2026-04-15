import { createClient } from '@supabase/supabase-js';
import { generateCustomerId } from '../../utils/loyaltyUtils';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return null;
  }
  if (!serviceRoleKey) {
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fullName, email, phone, password, address } = req.body;

  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: 'Missing required fields: fullName, email, phone, and password are all required.' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable. Please contact support.' });
  }

  try {
    // Check if the user already exists in the users table
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'A user with this email address has already been registered.' });
    }

    // Register user with Supabase Auth
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Generate a unique customer loyalty ID
    const customerId = generateCustomerId();

    // Insert profile into the users table
    const { error: insertError } = await supabaseAdmin.from('users').insert([{
      id: data.user.id,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      phone: phone.trim(),
      address: address ? address.trim() : null,
      customer_id: customerId,
      role: 'customer',
      loyalty_points: 0,
    }]);

    if (insertError) {
      // Auth user was created; attempt rollback to avoid orphaned auth records
      await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch((rollbackErr) => {
        console.error('[register] Auth rollback failed:', rollbackErr.message);
      });
      console.error('[register] Profile insert error:', insertError.message);
      return res.status(500).json({ error: 'Account setup failed. Please try again.' });
    }

    return res.status(200).json({ success: true, customerId });
  } catch (err) {
    console.error('Registration API error:', err);
    return res.status(500).json({ error: 'Unexpected server error during registration.' });
  }
}
