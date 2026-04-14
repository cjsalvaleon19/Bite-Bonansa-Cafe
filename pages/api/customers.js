// pages/api/customers.js

import { createAdminClient } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  console.log('[customers] Handler called, method:', req.method);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const customerId =
    req.method === 'GET'
      ? req.query.customerId
      : req.body && typeof req.body === 'object'
        ? req.body.customerId
        : undefined;

  console.log('[customers] Looking up customerId:', customerId);

  if (!customerId || !/^BBC-\d{5}$/.test(customerId)) {
    return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
  }

  const supabase = createAdminClient();

  if (!supabase) {
    console.error('[customers] Supabase client could not be initialized. Check environment variables.');
    return res.status(503).json({ error: 'Service unavailable. Database not configured.' });
  }

  console.log('[customers] Supabase client initialized, querying users table...');

  const { data: user, error } = await supabase
    .from('users')
    .select('customer_id, full_name, email, phone, address, created_at')
    .eq('customer_id', customerId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[customers] Supabase query error:', error.message, error);
    return res.status(500).json({
      error: 'Database query failed.',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }

  if (!user) {
    console.log('[customers] Customer not found:', customerId);
    return res.status(404).json({ error: 'Customer not found.' });
  }

  console.log('[customers] Customer found:', user.customer_id);
  return res.status(200).json({
    id: user.customer_id,
    name: user.full_name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    createdAt: user.created_at,
  });
}

