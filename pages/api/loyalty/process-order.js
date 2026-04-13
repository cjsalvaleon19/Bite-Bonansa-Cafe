import { createClient } from '@supabase/supabase-js';
import { calculatePointsEarned, calculateRedemption } from '../../../utils/pointsCalculator';

// Use service role key so we can write to customers table server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/loyalty/process-order
 * Body: {
 *   customerId: string,       // Customer ID (e.g. BBC-000001) — optional for guest orders
 *   items: array,             // Cart items
 *   totalAmount: number,      // Order total in pesos
 *   pointsToRedeem: number,   // Points the customer wants to use (0 if none)
 *   paymentMethod: string,    // 'Cash' | 'GCash' | 'Points' | 'Points+Cash' | 'Points+GCash'
 *   orderType: string,        // 'online' | 'cashier'
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { customerId, items, totalAmount, pointsToRedeem = 0, paymentMethod, orderType } = req.body;

  if (!items || typeof totalAmount !== 'number' || !paymentMethod || !orderType) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  let customer = null;
  let pointsApplied = 0;
  let remainingBalance = totalAmount;

  // Look up customer if a Customer ID was provided
  if (customerId) {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('customer_id, name, points_balance')
      .eq('customer_id', customerId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    customer = data;

    // Calculate redemption
    if (pointsToRedeem > 0) {
      const redemption = calculateRedemption(totalAmount, pointsToRedeem, customer.points_balance);
      pointsApplied = redemption.pointsApplied;
      remainingBalance = redemption.remainingBalance;
    }
  }

  // Calculate earned points (based on the cash portion of the order)
  const pointsEarned = calculatePointsEarned(remainingBalance);

  // Determine payment breakdown
  const cashAmount = paymentMethod.includes('Cash') ? remainingBalance : 0;
  const gcashAmount = paymentMethod.includes('GCash') ? remainingBalance : 0;

  // Insert order record
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      customer_id: customerId || null,
      items,
      total_amount: totalAmount,
      points_used: pointsApplied,
      cash_amount: cashAmount,
      gcash_amount: gcashAmount,
      payment_method: paymentMethod,
      order_type: orderType,
      order_status: 'Pending',
      points_earned: pointsEarned,
    })
    .select()
    .single();

  if (orderError) {
    return res.status(500).json({ success: false, message: 'Error creating order', error: orderError.message });
  }

  // Update customer points if a customer was found
  if (customer) {
    const newBalance = parseFloat(
      (customer.points_balance - pointsApplied + pointsEarned).toFixed(4)
    );

    await supabaseAdmin
      .from('customers')
      .update({ points_balance: newBalance })
      .eq('customer_id', customerId);

    // Record points earned transaction
    if (pointsEarned > 0) {
      await supabaseAdmin.from('points_transactions').insert({
        customer_id: customerId,
        type: 'earn',
        points: pointsEarned,
        order_amount: remainingBalance,
        order_id: order.id,
        payment_method: paymentMethod,
        description: `Points earned on ₱${remainingBalance.toFixed(2)} order`,
      });
    }

    // Record points redeemed transaction
    if (pointsApplied > 0) {
      await supabaseAdmin.from('points_transactions').insert({
        customer_id: customerId,
        type: 'redeem',
        points: pointsApplied,
        order_amount: totalAmount,
        order_id: order.id,
        payment_method: paymentMethod,
        description: `Points redeemed for ₱${pointsApplied.toFixed(2)} payment`,
      });
    }
  }

  return res.status(201).json({
    success: true,
    order,
    pointsApplied,
    pointsEarned,
    remainingBalance,
    newPointsBalance: customer ? newBalance : null,
  });
}
