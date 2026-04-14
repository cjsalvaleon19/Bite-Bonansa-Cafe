// pages/api/customers.js

import { createClient } from '@supabase/supabase-js';
import { generateCustomerId } from '../../utils/loyaltyUtils';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    console.error('[customers] NEXT_PUBLIC_SUPABASE_URL is not set or invalid:', url);
    return null;
  }
  if (!serviceRoleKey) {
    console.error('[customers] SUPABASE_SERVICE_ROLE_KEY is not set');
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET  /api/customers?customerId=BBC-XXXXX  — look up a customer by loyalty ID
 * GET  /api/customers?email=...             — look up a customer by email
 * POST /api/customers                       — create a new customer record
 */
export default async function handler(req, res) {
  console.log('[customers] Incoming request:', req.method, JSON.stringify(req.query));

  const supabase = createAdminClient();
  if (!supabase) {
    console.error('[customers] Supabase client could not be initialized. Check environment variables.');
    return res.status(500).json({ error: 'Service unavailable. Please contact support.' });
  }

  // --- GET: look up a customer ---
  if (req.method === 'GET') {
    const { customerId, email } = req.query;

    if (customerId) {
      console.log('[customers] Looking up by customerId:', customerId);
      if (!/^BBC-\d{5}$/.test(customerId)) {
        return res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, customer_id, loyalty_points, address, created_at')
        .eq('customer_id', customerId)
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[customers] Customer not found for customerId:', customerId);
          return res.status(404).json({ error: 'Customer not found.' });
        }
        console.error('[customers] Supabase error on GET by customerId:', error.message, error);
        return res.status(500).json({ error: 'Failed to look up customer. Please try again.' });
      }

      console.log('[customers] Found customer:', data.customer_id);
      return res.status(200).json(data);
    }

    if (email) {
      const safeEmail = String(email).length > 2 ? email.replace(/(.{2})[^@]*(@.*)/, '$1***$2') : '***';
      console.log('[customers] Looking up by email:', safeEmail);

      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, customer_id, loyalty_points, address, created_at')
        .eq('email', email.toLowerCase().trim())
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[customers] Customer not found for email');
          return res.status(404).json({ error: 'Customer not found.' });
        }
        console.error('[customers] Supabase error on GET by email:', error.message, error);
        return res.status(500).json({ error: 'Failed to look up customer. Please try again.' });
      }

      console.log('[customers] Found customer:', data.customer_id);
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Provide customerId or email query parameter.' });
  }

  // --- POST: create a new customer record ---
  if (req.method === 'POST') {
    console.log('[customers] Creating new customer record...');
    const { fullName, email, phone, address, userId } = req.body || {};

    if (!fullName || !email || !phone || !userId) {
      console.log('[customers] Missing required fields');
      return res.status(400).json({ error: 'fullName, email, phone, and userId are required.' });
    }

    // Generate a unique customer loyalty ID
    let customerId;
    let attempts = 0;
    while (attempts < 10) {
      const candidate = generateCustomerId();
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('customer_id', candidate)
        .limit(1);
      if (!existing || existing.length === 0) {
        customerId = candidate;
        break;
      }
      attempts++;
    }

    if (!customerId) {
      // Fallback: derive from userId UUID to guarantee uniqueness
      const uuidHex = /^[0-9a-f-]{32,36}$/i.test(userId) ? userId.replace(/-/g, '') : null;
      if (uuidHex) {
        const num = parseInt(uuidHex.slice(0, 8), 16) % 90000 + 10000;
        customerId = `BBC-${num}`;
      } else {
        // Last resort: random 5-digit suffix
        customerId = `BBC-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      }
    }

    console.log('[customers] Assigned customer ID:', customerId);

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        phone: phone.trim(),
        customer_id: customerId,
        role: 'customer',
        address: address ? address.trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, email, full_name, phone, customer_id, address, created_at')
      .single();

    if (error) {
      console.error('[customers] Supabase insert error:', error.message, error);
      return res.status(500).json({ error: 'Failed to create customer. Please try again.' });
    }

    console.log('[customers] Customer created:', customerId);
    return res.status(201).json({ success: true, customer: data, customerId });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
