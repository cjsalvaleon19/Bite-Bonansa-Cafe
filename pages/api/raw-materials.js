import { supabase } from '../../utils/supabaseClient';
import { calcAverageCost } from '../../utils/costingUtils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { search } = req.query;
    let query = supabase.from('raw_materials').select('*').order('name');
    if (search) query = query.ilike('name', `%${search}%`).limit(20);
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { name, unit, quantity_on_hand, cost_per_unit, reorder_point, supplier } = req.body;
    const { data, error } = await supabase.from('raw_materials')
      .insert([{ name, unit, quantity_on_hand, cost_per_unit, reorder_point, supplier }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, quantity_on_hand, cost_per_unit, new_qty, new_cost, name, unit, reorder_point, supplier } = req.body;
    const { data: mat } = await supabase.from('raw_materials').select('*').eq('id', id).single();
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (unit !== undefined) updates.unit = unit;
    if (reorder_point !== undefined) updates.reorder_point = reorder_point;
    if (supplier !== undefined) updates.supplier = supplier;
    if (quantity_on_hand !== undefined) updates.quantity_on_hand = quantity_on_hand;
    
    // Average cost method when new stock arrives
    if (new_qty !== undefined && new_cost !== undefined && mat) {
      const avg = calcAverageCost(mat.quantity_on_hand, mat.cost_per_unit, new_qty, new_cost);
      updates.cost_per_unit = avg;
      updates.quantity_on_hand = Number(mat.quantity_on_hand) + Number(new_qty);
      // Record history
      await supabase.from('raw_material_cost_history').insert([{
        material_id: id, old_cost: mat.cost_per_unit, new_cost, average_cost: avg
      }]);
    } else if (cost_per_unit !== undefined) {
      updates.cost_per_unit = cost_per_unit;
    }
    
    const { data, error } = await supabase.from('raw_materials').update(updates).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const { error } = await supabase.from('raw_materials').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).end();
}
