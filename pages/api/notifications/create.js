// API endpoint to create notifications
// Usage: POST /api/notifications/create

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      user_id,         // Optional: specific user or null for all customers
      type,            // Required: 'announcement', 'new_menu_item', 'anniversary', etc.
      title,           // Required
      message,         // Required
      related_id,      // Optional
      related_type     // Optional
    } = req.body;

    // Validate required fields
    if (!type || !title || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, title, and message are required' 
      });
    }

    // If user_id is provided, send to specific user
    if (user_id) {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id,
          type,
          title,
          message,
          related_id,
          related_type
        })
        .select()
        .single();

      if (error) {
        console.error('[Create Notification] Error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ 
        success: true, 
        notification: data,
        message: 'Notification created successfully' 
      });
    }

    // If no user_id, send to all customers
    const { data: customers, error: customersError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'customer');

    if (customersError) {
      console.error('[Create Notification] Error fetching customers:', customersError);
      return res.status(500).json({ error: customersError.message });
    }

    if (!customers || customers.length === 0) {
      return res.status(404).json({ error: 'No customers found' });
    }

    // Create notification for each customer
    const notifications = customers.map(customer => ({
      user_id: customer.id,
      type,
      title,
      message,
      related_id,
      related_type
    }));

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) {
      console.error('[Create Notification] Error creating bulk notifications:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ 
      success: true, 
      count: data.length,
      message: `Notification sent to ${data.length} customers` 
    });

  } catch (error) {
    console.error('[Create Notification] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
