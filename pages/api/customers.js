import { createClient } from '@supabase/supabase-js';

// Secure creation of Supabase admin client
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

/**
 * Handles customer lookup by Customer ID.
 * GET /api/customers?customerId=BBC-XXXXX
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customerId } = req.query;

  // Validate ID format
  if (!customerId || !/^BBC-\d{5}$/.test(customerId)) {
    return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable. Please contact support.' });
  }

  // Try fetching the customer
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('full_name, customer_id, loyalty_balance, role, created_at')
    .eq('customer_id', customerId)
    .single();

  if (error) {
    // PostgREST "not found" error
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    // Log for server diagnostics
    console.error('[customers] Lookup error:', error.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }

  // Respond with normalized payload
  return res.status(200).json({
    id: data.customer_id,
    name: data.full_name,
    role: data.role,
    created_at: data.created_at,
    loyaltyBalance: data.loyalty_balance ?? 0,
  });
}
