// pages/api/customers.js

import { createClient } from '@supabase/supabase-js';

const CUSTOMER_FIELDS = 'id, email, full_name, phone, customer_id, address, role, created_at';

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
 * Verifies the Bearer JWT from the Authorization header and returns the
 * authenticated user's profile from the users table, or null if invalid.
 */
async function getAuthenticatedUser(req, supabaseAdmin) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return null;
  }
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, role, customer_id')
    .eq('id', user.id)
    .limit(1)
    .single();
  if (profileError) {
    console.error('[customers] Profile lookup error:', profileError.message, profileError);
    return null;
  }
  return profile || null;
}

/**
 * GET /api/customers?customerId=BBC-XXXXX  → look up a single customer (admin or self)
 * GET /api/customers                        → list all customers (admin only)
 *
 * Requires Authorization: Bearer <supabase-jwt> header.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable. Check server environment variables.' });
  }

  const caller = await getAuthenticatedUser(req, supabaseAdmin);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const isAdmin = caller.role === 'admin';
  const { customerId } = req.query;

  if (customerId) {
    // Look up a specific customer by loyalty ID
    if (!/^BBC-\d{5}$/.test(customerId)) {
      return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
    }

    // Non-admins may only look up their own loyalty ID
    if (!isAdmin && caller.customer_id !== customerId) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select(CUSTOMER_FIELDS)
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

  // No customerId → list all customers (admin only)
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(CUSTOMER_FIELDS)
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[customers] List error:', error.message, error);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }

  return res.status(200).json(data);
}
