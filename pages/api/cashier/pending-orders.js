/**
 * GET /api/cashier/pending-orders
 *
 * Returns all pending online orders for the cashier dashboard.
 * Uses the service-role Supabase client so that it bypasses Row-Level
 * Security entirely — this is the correct fix for the RLS infinite-recursion
 * bug on the orders table (see migration 132).  The route still validates
 * that the caller is an authenticated cashier or admin before returning data.
 */
import { createClient } from '@supabase/supabase-js';
import { ONLINE_ORDER_MODES, UNACCEPTED_ORDER_STATUSES } from '../../../utils/salesCalculations';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    console.error('[pending-orders] NEXT_PUBLIC_SUPABASE_URL is not set or invalid');
    return null;
  }
  if (!serviceRoleKey) {
    console.error('[pending-orders] SUPABASE_SERVICE_ROLE_KEY is not set');
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable. Check server configuration.' });
  }

  // --- Authenticate the caller ---
  // The anon client reads the JWT from the Authorization header to identify the user.
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);

  // Validate the token and get the user id.
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // Verify the caller is a cashier or admin using the admin client (bypasses RLS on users).
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Could not verify role' });
  }
  // Only cashiers and admins may view the pending orders queue.
  // 'superadmin' is included as it has full admin access.
  if (!['cashier', 'admin', 'superadmin'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // --- Fetch pending online orders ---
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        menu_item_id,
        name,
        price,
        quantity,
        subtotal,
        notes,
        variant_details,
        menu_items:menu_item_id (
          category,
          kitchen_departments:kitchen_department_id (
            department_name,
            department_code
          )
        )
      ),
      users:customer_id (
        customer_id,
        phone
      )
    `)
    .in('order_mode', ONLINE_ORDER_MODES)
    .in('status', UNACCEPTED_ORDER_STATUSES)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[pending-orders] Query error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ orders: orders || [] });
}
