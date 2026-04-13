import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('delivery_settings').select('*').eq('id', 1).single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'PUT') {
    const { enabled } = req.body;
    const { data, error } = await supabase.from('delivery_settings').update({ enabled, updated_at: new Date().toISOString() }).eq('id', 1).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  res.status(405).end();
}
