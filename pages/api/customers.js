// pages/api/customers.js

import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    console.error('[customers] NEXT_PUBLIC_SUPABASE_URL is not set or invalid:', url);
    return null;
  }
  if (!serviceRoleKey) {
    console.error('[customers] SUPABASE_SERVICE_ROLE_KEY is not set');
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Handles customer lookup by Customer ID or email.
 * GET /api/customers?customerId=BBC-XXXXX  — lookup by loyalty ID
 * GET /api/customers?email=user@example.com — lookup by email
 */
export default async function handler(req, res) {
  console.log('[customers] Request method:', req.method);

  if (req.method !== 'GET') {
    console.log('[customers] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customerId, email } = req.query;
  console.log('[customers] Query params - customerId:', customerId, 'email:', email ? email.replace(/(.{2})[^@]*(@.*)/, '$1***$2') : undefined);

  if (!customerId && !email) {
    console.log('[customers] Missing query parameter');
    return res.status(400).json({ error: 'Provide customerId or email as a query parameter.' });
  }

  if (customerId && !/^BBC-\d{5}$/.test(customerId)) {
    console.log('[customers] Invalid customerId format:', customerId);
    return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
  }

  console.log('[customers] Initializing Supabase admin client...');
  const supabase = createAdminClient();

  if (!supabase) {
    console.error('[customers] Supabase admin client could not be initialized. Check environment variables.');
    return res.status(500).json({ error: 'Service unavailable. Please contact support.' });
  }

  try {
    let query = supabase
      .from('users')
      .select('id, email, full_name, phone, customer_id, role, address, loyalty_points, created_at')
      .limit(1);

    if (customerId) {
      console.log('[customers] Looking up by customer_id:', customerId);
      query = query.eq('customer_id', customerId);
    } else {
      console.log('[customers] Looking up by email...');
      query = query.eq('email', email.toLowerCase().trim());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[customers] Supabase query error:', error.message, error);
      return res.status(500).json({ error: 'Database error. Please try again.' });
    }

    console.log('[customers] Query result count:', data ? data.length : 0);

    if (!data || data.length === 0) {
      console.log('[customers] Customer not found');
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const customer = data[0];
    console.log('[customers] Found customer:', customer.customer_id);
    // Return only safe public fields — omit internal database id
    return res.status(200).json({
      email: customer.email,
      full_name: customer.full_name,
      phone: customer.phone,
      customer_id: customer.customer_id,
      role: customer.role,
      address: customer.address,
      loyalty_points: customer.loyalty_points,
      created_at: customer.created_at,
    });
  } catch (err) {
    console.error('[customers] Unexpected error:', err.message, err);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}
