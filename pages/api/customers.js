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
 * Handles customer lookup by Customer ID (GET) or lists all customers (GET without customerId).
 * Customer ID format: BBC-XXXXX
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Service unavailable. Please contact support.' });
  }

  const { customerId } = req.query;

  if (customerId) {
    if (!/^BBC-\d{5}$/.test(customerId)) {
      return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
    }

    const { data: customer, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, phone, customer_id, address, created_at')
      .eq('customer_id', customerId)
      .eq('role', 'customer')
      .single();

    if (error || !customer) {
      console.error('[customers] Customer not found:', customerId, error?.message);
      return res.status(404).json({ error: 'Customer not found.' });
    }

    return res.status(200).json(customer);
  }

  // No customerId provided: return list of all customers
  const { data: customers, error: listError } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, phone, customer_id, address, created_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  if (listError) {
    console.error('[customers] List error:', listError.message);
    return res.status(500).json({ error: 'Failed to fetch customers.' });
  }

  return res.status(200).json(customers || []);
}
