/**
 * POST /api/customer/notify-cashiers
 *
 * Called by the customer order page immediately after a new order is placed.
 * Creates a "new_online_order" notification for every cashier and admin user
 * so the notification bell on the Cashier Dashboard lights up instantly.
 *
 * Auth: requires a valid Supabase Bearer token from the customer session.
 */

import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { order_id, order_number, customer_name, order_mode } = req.body || {};

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[notify-cashiers] Service role client could not be created');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // Verify the caller is an authenticated user (any role is fine for placing orders)
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    // Fetch all cashier and admin users to notify
    const { data: staff, error: staffError } = await admin
      .from('users')
      .select('id')
      .in('role', ['cashier', 'admin']);

    if (staffError) {
      console.error('[notify-cashiers] Error fetching staff:', staffError);
      return res.status(500).json({ error: staffError.message });
    }

    if (!staff || staff.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const displayNumber = order_number || order_id.slice(0, 8);
    const modeLabel = order_mode ? ` (${order_mode})` : '';
    const title = 'New Online Order';
    const message = `Order #${displayNumber}${modeLabel} from ${customer_name || 'a customer'} is waiting for your review.`;

    const notifications = staff.map((s) => ({
      user_id: s.id,
      type: 'new_online_order',
      title,
      message,
      related_id: order_id,
      related_type: 'order',
    }));

    const { data, error: insertError } = await admin
      .from('notifications')
      .insert(notifications)
      .select('id');

    if (insertError) {
      console.error('[notify-cashiers] Error inserting notifications:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(200).json({ success: true, count: data?.length ?? 0 });
  } catch (err) {
    console.error('[notify-cashiers] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
