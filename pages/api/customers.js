import { supabase } from '../../lib/supabase';

function generateCustomerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'BBC-';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { customer_id, email, user_id } = req.query;

    let query = supabase.from('customers').select('*');
    if (customer_id) query = query.eq('customer_id', customer_id);
    else if (email) query = query.eq('email', email);
    else if (user_id) query = query.eq('user_id', user_id);
    else return res.status(400).json({ error: 'customer_id, email, or user_id is required' });

    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Customer not found' });

    // Fetch points transactions
    const { data: transactions } = await supabase
      .from('customer_points_transactions')
      .select('*')
      .eq('customer_id', data.customer_id)
      .order('created_at', { ascending: false })
      .limit(50);

    return res.status(200).json({ data: { ...data, transactions: transactions || [] } });
  }

  if (req.method === 'POST') {
    const { user_id, name, email, phone } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

    // Generate unique customer ID
    let customer_id;
    let attempts = 0;
    do {
      customer_id = generateCustomerId();
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('customer_id', customer_id)
        .single();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const { data, error } = await supabase
      .from('customers')
      .insert({ customer_id, user_id: user_id || null, name, email, phone: phone || null, points_balance: 0 })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
