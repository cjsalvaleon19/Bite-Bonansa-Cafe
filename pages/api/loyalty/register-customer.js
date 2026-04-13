import { createClient } from '@supabase/supabase-js';
import { generateCustomerId } from '../../../utils/pointsCalculator';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/loyalty/register-customer
 * Body: { userId: string, name: string, email: string, phone: string }
 * Creates a customer profile with an auto-generated unique Customer ID.
 *
 * Customer ID generation uses the Supabase `customer_id_seq` sequence (if present)
 * or falls back to a timestamp+random value to avoid race conditions.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { userId, name, email, phone } = req.body;
  if (!userId || !name || !email) {
    return res.status(400).json({ success: false, message: 'userId, name, and email are required' });
  }

  // Idempotency: return existing Customer ID if the user already has a profile
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('customer_id')
    .eq('id', userId)
    .single();

  if (existing) {
    return res.status(200).json({ success: true, customerId: existing.customer_id });
  }

  // Generate a unique Customer ID.
  // Try to use the database sequence first; fall back to timestamp+random.
  let customerId;
  try {
    const { data: seqData } = await supabaseAdmin.rpc('nextval_customer_id_seq');
    customerId = seqData ? generateCustomerId(seqData) : null;
  } catch (_) {
    customerId = null;
  }

  if (!customerId) {
    // Timestamp (ms) + 3-digit random to minimise collision probability
    const rand = Math.floor(Math.random() * 900) + 100;
    customerId = `BBC-${Date.now()}${rand}`;
  }

  const { error } = await supabaseAdmin.from('customers').insert({
    id: userId,
    customer_id: customerId,
    name,
    email,
    phone: phone || null,
    points_balance: 0,
  });

  if (error) {
    return res.status(500).json({ success: false, message: 'Error creating customer', error: error.message });
  }

  return res.status(201).json({ success: true, customerId });
}

