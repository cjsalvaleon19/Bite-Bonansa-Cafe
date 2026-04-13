import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { online } = req.query; // if online=1, hide out_of_stock
    let query = supabase.from('menu_items').select(`
      *,
      kitchen_departments(id, name),
      menu_item_ingredients(*),
      menu_item_labor(*),
      menu_item_overhead(*)
    `).order('name');
    if (online === '1') query = query.eq('status', 'available');
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { name, description, selling_price, department_id, status, category, image_url,
            ingredients, labor, overhead } = req.body;
    const { data: item, error } = await supabase.from('menu_items')
      .insert([{ name, description, selling_price, department_id, status, category, image_url }])
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    // Insert ingredients
    if (ingredients?.length) {
      const rows = ingredients.map(i => ({ ...i, menu_item_id: item.id }));
      await supabase.from('menu_item_ingredients').insert(rows);
    }
    if (labor?.length) {
      const rows = labor.map(l => ({ ...l, menu_item_id: item.id }));
      await supabase.from('menu_item_labor').insert(rows);
    }
    if (overhead?.length) {
      const rows = overhead.map(o => ({ ...o, menu_item_id: item.id }));
      await supabase.from('menu_item_overhead').insert(rows);
    }
    return res.status(201).json(item);
  }
  if (req.method === 'PUT') {
    const { id, status, name, description, selling_price, department_id, category, image_url } = req.body;
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (selling_price !== undefined) updates.selling_price = selling_price;
    if (department_id !== undefined) updates.department_id = department_id;
    if (category !== undefined) updates.category = category;
    if (image_url !== undefined) updates.image_url = image_url;
    const { data, error } = await supabase.from('menu_items').update(updates).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).end();
}
