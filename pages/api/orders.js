import { supabase } from '../../lib/supabase';
import { calcPointsEarned } from '../../utils/loyaltyUtils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { customer_id, status, limit = 50 } = req.query;
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (customer_id) query = query.eq('customer_id', customer_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    const {
      customer_id, order_type, payment_method,
      items, subtotal, points_used, cash_amount, total_amount,
    } = req.body;

    if (!items || !items.length) return res.status(400).json({ error: 'items are required' });

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: customer_id || null,
        order_type: order_type || 'cashier',
        payment_method: payment_method || 'cash',
        subtotal: subtotal || 0,
        points_used: points_used || 0,
        cash_amount: cash_amount || 0,
        total_amount: total_amount || subtotal || 0,
        status: 'completed',
      })
      .select()
      .single();

    if (orderErr) return res.status(500).json({ error: orderErr.message });

    // Insert order items
    const orderItems = items.map(i => ({
      order_id: order.id,
      menu_item_id: i.menu_item_id || null,
      menu_item_name: i.name || i.menu_item_name,
      quantity: i.quantity || 1,
      unit_price: i.unit_price || i.selling_price || 0,
      department: i.department || null,
      special_instructions: i.special_instructions || null,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) return res.status(500).json({ error: itemsErr.message });

    // Financial transaction: sale
    await supabase.from('financial_transactions').insert({
      type: 'sale',
      amount: total_amount || subtotal || 0,
      date: new Date().toISOString().split('T')[0],
      order_id: order.id,
      category: 'revenue',
      description: `Order ${order.id}`,
    });

    // Points redemption debit
    if (customer_id && points_used && parseFloat(points_used) > 0) {
      const { data: cust } = await supabase
        .from('customers')
        .select('points_balance')
        .eq('customer_id', customer_id)
        .single();

      if (cust) {
        const newBalance = Math.max(0, parseFloat(cust.points_balance) - parseFloat(points_used));
        await supabase.from('customers').update({ points_balance: newBalance }).eq('customer_id', customer_id);
        await supabase.from('customer_points_transactions').insert({
          customer_id,
          type: 'redeem',
          amount: parseFloat(points_used),
          order_id: order.id,
          description: `Points redeemed for order ${order.id}`,
        });
      }
    }

    // Points earning
    if (customer_id) {
      const pointsEarned = calcPointsEarned(total_amount || subtotal || 0);
      if (pointsEarned > 0) {
        const { data: cust } = await supabase
          .from('customers')
          .select('points_balance')
          .eq('customer_id', customer_id)
          .single();

        if (cust) {
          const newBalance = parseFloat(cust.points_balance) + pointsEarned;
          await supabase.from('customers').update({ points_balance: newBalance }).eq('customer_id', customer_id);
          await supabase.from('customer_points_transactions').insert({
            customer_id,
            type: 'earn',
            amount: pointsEarned,
            order_id: order.id,
            description: `Points earned from order ${order.id}`,
          });
        }
      }
    }

    return res.status(201).json({ success: true, data: order });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
