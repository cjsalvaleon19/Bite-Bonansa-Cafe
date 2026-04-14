// pages/api/customers.js

import { createClient } from '@supabase/supabase-js';

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
 * @param {string} customerId - The Customer ID to look up (format: BBC-XXXXX)
 * @returns {Object|null} - Returns customer object if found, null otherwise.
 */
export default async function handler(req, res) {
  const { customerId } = req.query;

  if (!customerId || !/^BBC-\d{5}$/.test(customerId)) {
    return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Service unavailable. Please contact support.' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, customer_id, role, address, created_at')
    .eq('customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    return res.status(500).json({ error: 'Failed to retrieve customer.' });
  }

  return res.status(200).json(data);
}
