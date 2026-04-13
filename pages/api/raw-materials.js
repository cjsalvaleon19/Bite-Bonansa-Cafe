import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    const { name, unit, quantity_on_hand, cost_per_unit, reorder_point, supplier } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('raw_materials')
      .insert({ name, unit, quantity_on_hand: quantity_on_hand || 0, cost_per_unit: cost_per_unit || 0, reorder_point: reorder_point || 0, supplier })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  }

  if (req.method === 'PUT') {
    const { id, name, unit, quantity_on_hand, cost_per_unit, reorder_point, supplier } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { data: existing, error: fetchErr } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr) return res.status(404).json({ error: 'Raw material not found' });

    const updateFields = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateFields.name = name;
    if (unit !== undefined) updateFields.unit = unit;
    if (quantity_on_hand !== undefined) updateFields.quantity_on_hand = quantity_on_hand;
    if (reorder_point !== undefined) updateFields.reorder_point = reorder_point;
    if (supplier !== undefined) updateFields.supplier = supplier;

    // Handle average cost calculation when cost changes
    if (cost_per_unit !== undefined && parseFloat(cost_per_unit) !== parseFloat(existing.cost_per_unit)) {
      const oldCost = parseFloat(existing.cost_per_unit);
      const newCost = parseFloat(cost_per_unit);
      const qty = parseFloat(existing.quantity_on_hand) || 0;
      const newQty = parseFloat(quantity_on_hand ?? existing.quantity_on_hand) || 0;
      // Weighted average cost: only blend if adding new stock (newQty > qty).
      // When quantity decreases (usage/adjustment), the cost structure is unchanged
      // so the average cost equals the new cost_per_unit provided.
      let averageCost;
      if (newQty > qty) {
        const totalOldValue = qty * oldCost;
        const addedQty = newQty - qty;
        averageCost = (totalOldValue + addedQty * newCost) / newQty;
      } else {
        averageCost = newCost;
      }

      updateFields.cost_per_unit = newCost;

      await supabase.from('raw_material_cost_history').insert({
        raw_material_id: id,
        old_cost: oldCost,
        new_cost: newCost,
        average_cost: parseFloat(averageCost.toFixed(4)),
      });
    } else if (cost_per_unit !== undefined) {
      updateFields.cost_per_unit = cost_per_unit;
    }

    const { data, error } = await supabase
      .from('raw_materials')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { error } = await supabase.from('raw_materials').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
