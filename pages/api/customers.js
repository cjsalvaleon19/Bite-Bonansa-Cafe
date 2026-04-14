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
 * GET /api/customers?customerId=BBC-XXXXX  → look up a single customer
 * GET /api/customers                        → list all customers (admin use)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable. Check server environment variables.' });
  }

  const { customerId } = req.query;

  if (customerId) {
    // Look up a specific customer by loyalty ID
    if (!/^BBC-\d{5}$/.test(customerId)) {
      return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, customer_id, address, role, created_at')
      .eq('customer_id', customerId)
      .eq('role', 'customer')
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Customer not found.' });
      }
      console.error('[customers] Lookup error:', error.message, error);
      return res.status(500).json({ error: 'Server error. Please try again.' });
    }

    return res.status(200).json(data);
  }

  // No customerId → return all customers
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, phone, customer_id, address, role, created_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[customers] List error:', error.message, error);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }

  return res.status(200).json(data);
}
