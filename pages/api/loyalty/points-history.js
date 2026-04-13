import { supabase } from '../../../utils/supabaseClient';

/**
 * GET /api/loyalty/points-history?customerId=BBC-000001
 * Returns all points transactions for a given Customer ID, newest first.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ success: false, message: 'customerId is required' });
  }

  const { data, error } = await supabase
    .from('points_transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ success: false, message: 'Error fetching transactions', error: error.message });
  }

  return res.status(200).json({ success: true, transactions: data });
}
