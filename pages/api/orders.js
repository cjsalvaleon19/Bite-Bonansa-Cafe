import { supabase } from '../../utils/supabaseClient';
import { generateOrderNumber, generateReceiptNumber, buildQRCodeData } from '../../utils/receiptUtils';
import { calcPointsEarned } from '../../utils/loyaltyUtils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { status, limit = 50 } = req.query;
    let query = supabase.from('orders').select(`
      *, 
      order_items(*, menu_items(name, department_id)),
      receipt_customer_details(*)
    `).order('created_at', { ascending: false }).limit(Number(limit));
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const {
      customer_id, customer_name = 'Walk-in', order_type = 'dine_in',
      items, subtotal, total, points_redeemed = 0, cash_amount = 0,
      gcash_amount = 0, change_amount = 0, payment_method = 'cash', notes,
      receipt_details // { address, tin, business_style }
    } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in order' });

    const order_number = generateOrderNumber();
    
    // Create order
    const { data: order, error: orderError } = await supabase.from('orders').insert([{
      order_number, customer_id, customer_name, order_type,
      status: 'pending', subtotal, total,
      points_redeemed, cash_amount, gcash_amount, change_amount, payment_method, notes
    }]).select().single();
    if (orderError) return res.status(400).json({ error: orderError.message });

    // Insert order items
    const itemRows = items.map(item => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      menu_item_name: item.name,
      department_id: item.department_id,
      department_name: item.department_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      special_instructions: item.special_instructions || null
    }));
    await supabase.from('order_items').insert(itemRows);

    // Create receipt
    const receipt_number = generateReceiptNumber();
    const { data: receipt } = await supabase.from('receipt_customer_details').insert([{
      order_id: order.id,
      receipt_number,
      customer_name,
      customer_id: customer_id || null,
      address: receipt_details?.address || null,
      tin: receipt_details?.tin || null,
      business_style: receipt_details?.business_style || null,
      qr_code_data: buildQRCodeData(receipt_number)
    }]).select().single();

    // Handle loyalty points
    if (customer_id) {
      if (points_redeemed > 0) {
        const { data: cust } = await supabase.from('customers').select('points_balance').eq('customer_id', customer_id).single();
        const newBalance = Math.max(0, Number(cust?.points_balance || 0) - points_redeemed);
        await supabase.from('customers').update({ points_balance: newBalance }).eq('customer_id', customer_id);
        await supabase.from('points_transactions').insert([{
          customer_id, amount: -points_redeemed, type: 'redeem',
          description: `Redeemed for order ${order_number}`, order_id: order.id
        }]);
      }
      // Earn points on amount paid (excluding redeemed points)
      const amountForPoints = total - points_redeemed;
      if (amountForPoints > 0) {
        const earned = calcPointsEarned(amountForPoints);
        if (earned > 0) {
          const { data: cust } = await supabase.from('customers').select('points_balance,total_spent').eq('customer_id', customer_id).single();
          await supabase.from('customers').update({
            points_balance: Number(cust?.points_balance || 0) + earned,
            total_spent: Number(cust?.total_spent || 0) + total
          }).eq('customer_id', customer_id);
          await supabase.from('points_transactions').insert([{
            customer_id, amount: earned, type: 'earn',
            description: `Earned from order ${order_number}`, order_id: order.id
          }]);
        }
      }
    }

    // Financial transaction
    await supabase.from('financial_transactions').insert([{
      type: 'sale', amount: total, order_id: order.id,
      description: `Order ${order_number}`, category: 'revenue',
      transaction_date: new Date().toISOString().slice(0, 10)
    }]);

    return res.status(201).json({ order, receipt });
  }

  if (req.method === 'PUT') {
    const { id, status } = req.body;
    const { data, error } = await supabase.from('orders').update({ status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) }).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  res.status(405).end();
}
