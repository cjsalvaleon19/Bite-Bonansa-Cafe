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
import { ONLINE_ORDER_MODES } from '../../../utils/salesCalculations';

function normalizeOrderMode(value) {
  // Canonicalize known online mode variants:
  // pickup / pick-up / pick up -> pickup, dine-in / dine in -> dinein, etc.
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function normalizeOrderStatus(value) {
  // Canonicalize unaccepted status variants:
  // order_in_queue / order-in-queue / order in queue -> order_in_queue.
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

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
  // NOTE: We intentionally do NOT join order_items → menu_items here.
  // PostgREST returns a 500 "relationship not found" error when that FK is
  // missing from its schema cache, which prevents any orders from loading.
  // The kitchen-department data is only used for grouping kitchen print
  // slips; normalizeDepartment() in receiptDepartments.js already falls
  // back gracefully to 'General Kitchen' when that data is absent.
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
        variant_details
      ),
      users:customer_id (
        customer_id,
        full_name,
        phone
      )
    `)
    // Pending online orders are, by definition, not yet accepted by staff.
    // Filter by accepted_at first, then normalize mode/status in JS to handle
    // legacy formatting variants (e.g. pickup/pick-up, pending/Pending).
    // Require customer_id to be set so that POS walk-in orders (customer_id=null,
    // customer_name='Walk-in') are excluded from the online orders queue.
    .is('accepted_at', null)
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[pending-orders] Query error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  const allowedModes = new Set(ONLINE_ORDER_MODES.map(normalizeOrderMode));
  // Only show orders placed by customers (status 'pending').
  // Cashier POS orders are created with status 'order_in_queue' and must NOT appear here.
  const pendingOnlineOrders = (orders || []).filter((order) => {
    const normalizedMode = normalizeOrderMode(order?.order_mode);
    const normalizedStatus = normalizeOrderStatus(order?.status);
    return allowedModes.has(normalizedMode) && normalizedStatus === 'pending';
  });

  return res.status(200).json({ orders: pendingOnlineOrders });
}
