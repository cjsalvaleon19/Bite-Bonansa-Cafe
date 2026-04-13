import { supabase } from '../../utils/supabaseClient';
import { generateCustomerId } from '../../utils/loyaltyUtils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { customer_id, search } = req.query;
    let query = supabase.from('customers').select('*');
    if (customer_id) query = query.eq('customer_id', customer_id).single();
    else if (search) query = query.ilike('full_name', `%${search}%`).limit(20);
    else query = query.order('created_at', { ascending: false }).limit(100);
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { full_name, email, phone } = req.body;
    const customer_id = generateCustomerId();
    const { data, error } = await supabase.from('customers').insert([{ customer_id, full_name, email, phone }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }
  res.status(405).end();
}
