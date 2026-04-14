import { generateCustomerId } from '../../utils/loyaltyUtils';
import { createAdminClient } from '../../lib/supabaseAdmin';

function isValidEmail(email) {
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length === 0 || local.length > 64) return false;
  const domainParts = domain.split('.');
  return domainParts.length >= 2 && domainParts.every((p) => p.length > 0) && domain.length <= 255;
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

  console.log('[1] Starting registration for:', email.replace(/(.{2})[^@]*(@.*)/, '$1***$2'));

  // --- Validation ---
  if (!fullName || !email || !phone || !password) {
    console.log('[2] Missing required fields');
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

  console.log('[3] Validation passed, initializing Supabase admin client...');
  const supabaseAdmin = createAdminClient();

  if (!supabaseAdmin) {
    console.error('[4] Supabase admin client could not be initialized. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    return res.status(500).json({ success: false, error: 'Service unavailable. Please contact support.' });
  }

  // --- Check for existing email in users table ---
  console.log('[5] Checking for existing email...');
  const { data: existingUsers, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .limit(1);

  if (lookupError && lookupError.code !== 'PGRST116') {
    console.error('[6] User lookup error:', lookupError.message, lookupError);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }

  if (existingUsers && existingUsers.length > 0) {
    console.log('[7] Email already exists');
    return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
  }

  // --- Create Supabase Auth user ---
  console.log('[8] Creating auth user...');
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError) {
    if (authError.message && authError.message.toLowerCase().includes('already registered')) {
      console.log('[9] Auth user already exists');
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }
    console.error('[9] Auth create error:', authError.message, authError);
    return res.status(500).json({ success: false, error: authError.message || 'Registration failed. Please try again.' });
  }

  console.log('[10] Auth user created:', authData.user.id);

  // --- Generate unique customer loyalty ID ---
  console.log('[11] Generating customer loyalty ID...');
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

  console.log('[12] Customer ID assigned:', customerId);

  // --- Insert profile into users table ---
  console.log('[13] Inserting user profile...');
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
    console.error('[14] Profile insert error:', profileError.message, profileError);
    return res.status(500).json({ success: false, error: profileError.message || 'Registration failed. Please try again.' });
  }

  console.log('[15] Registration complete for:', email.replace(/(.{2})[^@]*(@.*)/, '$1***$2'));
  return res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    customerId,
  });
}
