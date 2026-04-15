// pages/api/customers.js

import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    console.error(
      '[customers] NEXT_PUBLIC_SUPABASE_URL is missing or not a valid URL.',
      'Set it in Vercel: Project Settings → Environment Variables.',
      'Current value:', url || '(not set)'
    );
    return null;
  }
  if (!serviceRoleKey) {
    console.error(
      '[customers] SUPABASE_SERVICE_ROLE_KEY is not set.',
      'Set it in Vercel: Project Settings → Environment Variables.',
      'Find the key at: Supabase Dashboard → Project Settings → API → service_role.'
    );
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

  if (!customerId || !/^BBC-\d{5}$/.test(customerId)) {
    return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    console.error('[customers] Admin client unavailable. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. See /api/health for configuration status.');
    return res.status(500).json({
      error: 'Service unavailable. Please contact support.',
      hint: 'Visit /api/health to check server configuration.',
    });
  }

  const { data: customer, error } = await supabaseAdmin
    .from('users')
    .select('full_name, customer_id, role, created_at')
    .eq('customer_id', customerId)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    console.error('[customers] Lookup error:', error.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }

  return res.status(200).json(customer);
}
