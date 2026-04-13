import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { includeOutOfStock, department } = req.query;
    let query = supabase
      .from('menu_items')
      .select(`*, menu_item_ingredients(*), menu_item_labor(*), menu_item_overhead(*)`)
      .order('name');

    if (includeOutOfStock !== 'true') {
      query = query.eq('status', 'active');
    }
    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    const { name, description, department, selling_price, status, ingredients, labor, overhead } = req.body;
    if (!name || !department) return res.status(400).json({ error: 'name and department are required' });

    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .insert({ name, description, department, selling_price: selling_price || 0, status: status || 'active' })
      .select()
      .single();

    if (itemError) return res.status(500).json({ error: itemError.message });

    if (ingredients && ingredients.length > 0) {
      const rows = ingredients.map(i => ({ ...i, menu_item_id: item.id }));
      const { error: ingErr } = await supabase.from('menu_item_ingredients').insert(rows);
      if (ingErr) return res.status(500).json({ error: ingErr.message });
    }

    if (labor) {
      const { error: labErr } = await supabase
        .from('menu_item_labor')
        .insert({ ...labor, menu_item_id: item.id });
      if (labErr) return res.status(500).json({ error: labErr.message });
    }

    if (overhead) {
      const { error: ovhErr } = await supabase
        .from('menu_item_overhead')
        .insert({ ...overhead, menu_item_id: item.id });
      if (ovhErr) return res.status(500).json({ error: ovhErr.message });
    }

    return res.status(201).json({ success: true, data: item });
  }

  if (req.method === 'PUT') {
    const { id, ingredients, labor, overhead, ...fields } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updateFields = {};
    ['name','description','department','selling_price','status'].forEach(k => {
      if (fields[k] !== undefined) updateFields[k] = fields[k];
    });
    updateFields.updated_at = new Date().toISOString();

    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (itemError) return res.status(500).json({ error: itemError.message });

    if (ingredients !== undefined) {
      await supabase.from('menu_item_ingredients').delete().eq('menu_item_id', id);
      if (ingredients.length > 0) {
        const rows = ingredients.map(i => ({ ...i, menu_item_id: id }));
        await supabase.from('menu_item_ingredients').insert(rows);
      }
    }

    if (labor !== undefined) {
      await supabase.from('menu_item_labor').delete().eq('menu_item_id', id);
      if (labor) await supabase.from('menu_item_labor').insert({ ...labor, menu_item_id: id });
    }

    if (overhead !== undefined) {
      await supabase.from('menu_item_overhead').delete().eq('menu_item_id', id);
      if (overhead) await supabase.from('menu_item_overhead').insert({ ...overhead, menu_item_id: id });
    }

    return res.status(200).json({ success: true, data: item });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
