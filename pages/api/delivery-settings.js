import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('delivery_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ enabled: data ? data.enabled : true, data });
  }

  if (req.method === 'POST') {
    const { enabled, updated_by } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const { data: existing } = await supabase
      .from('delivery_settings')
      .select('id')
      .limit(1)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('delivery_settings')
        .update({ enabled, updated_at: new Date().toISOString(), updated_by: updated_by || null })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('delivery_settings')
        .insert({ enabled, updated_by: updated_by || null })
        .select()
        .single();
    }

    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.status(200).json({ success: true, data: result.data });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
