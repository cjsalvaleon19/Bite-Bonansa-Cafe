import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('kitchen_departments').select('*').order('name');
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { name, printer_id } = req.body;
    const { data, error } = await supabase.from('kitchen_departments').insert([{ name, printer_id }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const { error } = await supabase.from('kitchen_departments').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).end();
}
