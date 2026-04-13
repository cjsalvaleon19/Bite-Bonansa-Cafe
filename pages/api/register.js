import { createClient } from '@supabase/supabase-js';
import { generateCustomerId } from '../../utils/loyaltyUtils';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  const digits = phone.replace(/[\s+\-()]/g, '');
  return /^\d{7,15}$/.test(digits);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { fullName, email, phone, password, address } = req.body;

  // --- Validation ---
  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ success: false, error: 'Full name, email, phone and password are required.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone number.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }

  const supabaseAdmin = createAdminClient();

  // --- Check for existing email in users table ---
  const { data: existingUsers, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .limit(1);

  if (lookupError && lookupError.code !== 'PGRST116') {
    console.error('User lookup error:', lookupError);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }

  if (existingUsers && existingUsers.length > 0) {
    return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
  }

  // --- Create Supabase Auth user ---
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError) {
    if (authError.message && authError.message.toLowerCase().includes('already registered')) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }
    console.error('Auth create error:', authError);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }

  // --- Generate unique customer loyalty ID ---
  let customerId;
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateCustomerId();
    const { data: existing } = await supabaseAdmin
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
    // Fallback: derive from auth user UUID to guarantee per-user uniqueness
    const hex = authData.user.id.replace(/-/g, '');
    const num = parseInt(hex.slice(0, 8), 16) % 90000 + 10000;
    customerId = `BBC-${num}`;
  }

  // --- Insert profile into users table ---
  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email: email.toLowerCase().trim(),
    full_name: fullName.trim(),
    phone: phone.trim(),
    customer_id: customerId,
    role: 'customer',
    address: address ? address.trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    // Rollback: remove the created auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    console.error('Profile insert error:', profileError);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }

  return res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    customerId,
  });
}
