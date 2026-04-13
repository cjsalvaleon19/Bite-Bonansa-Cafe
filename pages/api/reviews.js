import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { status, receipt_number } = req.query;
    let query = supabase.from('customer_reviews').select(`
      *,
      review_helpful_votes(count)
    `).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (receipt_number) query = query.eq('receipt_number', receipt_number);
    // For public: only approved + public
    if (req.query.public === '1') {
      query = query.eq('status', 'approved').eq('visibility', 'public');
    }
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { receipt_number, customer_name, customer_id, rating, review_text, recommended } = req.body;
    // Look up receipt
    const { data: receipt } = await supabase.from('receipt_customer_details').select('id').eq('receipt_number', receipt_number).single();
    const { data, error } = await supabase.from('customer_reviews').insert([{
      receipt_id: receipt?.id, receipt_number, customer_name, customer_id,
      rating, review_text, recommended, status: 'pending', visibility: 'public'
    }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, status, visibility, action } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (visibility) updates.visibility = visibility;
    if (action === 'approve') { updates.status = 'approved'; updates.approved_at = new Date().toISOString(); }
    if (action === 'reject') updates.status = 'rejected';
    if (action === 'hide') updates.visibility = 'hidden';
    if (action === 'show') updates.visibility = 'public';
    const { data, error } = await supabase.from('customer_reviews').update(updates).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const { error } = await supabase.from('customer_reviews').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).end();
}
