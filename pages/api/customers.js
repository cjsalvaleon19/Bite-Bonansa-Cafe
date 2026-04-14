// pages/api/customers.js

import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    console.error('[customers] NEXT_PUBLIC_SUPABASE_URL is not set');
    return null;
  }
  if (typeof url !== 'string' || !url.startsWith('http')) {
    console.error('[customers] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP URL:', url);
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
 * GET  /api/customers?customerId=BBC-XXXXX  – look up by loyalty ID
 * GET  /api/customers?email=user@example.com – look up by email
 * POST /api/customers { customerId } or { email } – same lookup via request body
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    console.error('[customers] Supabase admin client could not be initialized.');
    return res.status(500).json({ error: 'Service unavailable. Please contact support.' });
  }

  // Resolve lookup parameters from query string (GET) or request body (POST)
  const customerId = req.method === 'POST' ? req.body?.customerId : req.query.customerId;
  const email = req.method === 'POST' ? req.body?.email : req.query.email;

  if (!customerId && !email) {
    return res.status(400).json({ error: 'Provide customerId or email to look up a customer.' });
  }

  if (email && (typeof email !== 'string' || !email.trim())) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  let query = supabase
    .from('users')
    .select('id, email, full_name, phone, customer_id, role, address, created_at')
    .eq('role', 'customer');

  if (customerId) {
    if (!/^BBC-\d{5}$/.test(customerId)) {
      return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
    }
    query = query.eq('customer_id', customerId);
  } else {
    query = query.eq('email', email.toLowerCase().trim());
  }

  const { data, error } = await query.limit(1).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    console.error('[customers] Lookup error:', error.message, error);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }

  return res.status(200).json(data);
}
