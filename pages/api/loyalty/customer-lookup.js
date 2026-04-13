import { supabase } from '../../../utils/supabaseClient';

/**
 * GET /api/loyalty/customer-lookup?customerId=BBC-000001
 * Look up a customer by their unique Customer ID and return name + points balance.
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
    .from('customers')
    .select('customer_id, name, email, points_balance')
    .eq('customer_id', customerId)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  return res.status(200).json({ success: true, customer: data });
}
