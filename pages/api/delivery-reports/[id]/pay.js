import { supabase } from '../../../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the report ID from the URL
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    // Get the authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify user is a cashier or admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !['cashier', 'admin'].includes(userData.role)) {
      return res.status(403).json({ error: 'Only cashiers and admins can pay reports' });
    }

    // Get the report to verify it exists and is pending
    const { data: report, error: reportError } = await supabase
      .from('delivery_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.status !== 'pending') {
      return res.status(400).json({ error: 'Report has already been processed' });
    }

    // Update the report status to paid
    const { error: updateError } = await supabase
      .from('delivery_reports')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Create notification for the rider
    const { data: riderData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', report.rider_id)
      .single();

    await supabase
      .from('notifications')
      .insert({
        user_id: report.rider_id,
        type: 'report_paid',
        title: '✅ Report Paid',
        message: `Your delivery report for ₱${report.rider_earnings.toFixed(2)} has been paid by the cashier.`,
        related_id: report.id,
        related_type: 'delivery_report',
      });

    return res.status(200).json({
      success: true,
      message: 'Report marked as paid successfully',
      report: {
        id: report.id,
        status: 'paid',
        rider_earnings: report.rider_earnings,
      },
    });
  } catch (error) {
    console.error('[API] Pay delivery report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
