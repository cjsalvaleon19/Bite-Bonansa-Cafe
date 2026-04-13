import { supabase } from '../../utils/supabaseClient';
import { calcPointsEarned } from '../../utils/loyaltyUtils';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, customer_id, amount, order_id, points_to_redeem } = req.body;

    if (action === 'earn') {
      const points = calcPointsEarned(Number(amount));
      // Record transaction
      const { error: txError } = await supabase.from('points_transactions').insert([{
        customer_id, amount: points, type: 'earn',
        description: `Earned from order ₱${amount}`, order_id
      }]);
      if (txError) return res.status(400).json({ error: txError.message });
      // Update balance
      const { data: cust } = await supabase.from('customers').select('points_balance,total_spent').eq('customer_id', customer_id).single();
      const newBalance = Number(cust?.points_balance || 0) + points;
      const newSpent = Number(cust?.total_spent || 0) + Number(amount);
      await supabase.from('customers').update({ points_balance: newBalance, total_spent: newSpent }).eq('customer_id', customer_id);
      return res.status(200).json({ points_earned: points, new_balance: newBalance });
    }

    if (action === 'redeem') {
      const { data: cust } = await supabase.from('customers').select('points_balance').eq('customer_id', customer_id).single();
      const currentBalance = Number(cust?.points_balance || 0);
      if (currentBalance < points_to_redeem) return res.status(400).json({ error: 'Insufficient points' });
      const newBalance = currentBalance - points_to_redeem;
      await supabase.from('customers').update({ points_balance: newBalance }).eq('customer_id', customer_id);
      await supabase.from('points_transactions').insert([{
        customer_id, amount: -points_to_redeem, type: 'redeem',
        description: `Redeemed for order`, order_id
      }]);
      return res.status(200).json({ redeemed: points_to_redeem, new_balance: newBalance });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }
  res.status(405).end();
}
