-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnostic Script: Rider Foreign Key Constraint Violation
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Identify why rider assignment fails with FK constraint violation
-- Run this script to understand the root cause of the issue
-- ═══════════════════════════════════════════════════════════════════════════

\echo '═══════════════════════════════════════════════════════════════════════════'
\echo 'DIAGNOSTIC REPORT: Rider FK Constraint Violation'
\echo '═══════════════════════════════════════════════════════════════════════════'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Check if the user exists in public.users table
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 1: Checking public.users table for johndave0991@bitebonansacafe.com'
\echo '------------------------------------------------------------------------'
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.users
WHERE email = 'johndave0991@bitebonansacafe.com';

\echo ''
\echo 'Expected: Should return ONE row with role = ''rider'''
\echo 'If NO rows: User does not exist in public.users table'
\echo 'If role != ''rider'': User has wrong role'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Check if user exists in auth.users (Supabase Auth)
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 2: Checking auth.users (Supabase Auth) table'
\echo '------------------------------------------------------------------------'
SELECT 
  id,
  email,
  created_at,
  confirmed_at
FROM auth.users
WHERE email = 'johndave0991@bitebonansacafe.com';

\echo ''
\echo 'Expected: Should return ONE row (user authenticated successfully)'
\echo 'If NO rows: User never signed up'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Check ID consistency between auth.users and public.users
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 3: Checking ID consistency between auth.users and public.users'
\echo '------------------------------------------------------------------------'
SELECT 
  a.id AS auth_id,
  a.email AS auth_email,
  p.id AS public_id,
  p.email AS public_email,
  p.role AS public_role,
  CASE 
    WHEN a.id = p.id THEN '✓ IDs MATCH'
    WHEN a.id IS NULL THEN '✗ User not in auth.users'
    WHEN p.id IS NULL THEN '✗ User not in public.users'
    ELSE '✗ ID MISMATCH - THIS IS THE PROBLEM'
  END AS status
FROM auth.users a
FULL OUTER JOIN public.users p ON a.email = p.email
WHERE a.email = 'johndave0991@bitebonansacafe.com' 
   OR p.email = 'johndave0991@bitebonansacafe.com';

\echo ''
\echo 'Expected: status = ''✓ IDs MATCH'''
\echo 'If ID MISMATCH: auth.id and public.id are different - THIS IS THE ROOT CAUSE'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Check riders table for this user
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 4: Checking riders table'
\echo '------------------------------------------------------------------------'
SELECT 
  r.id AS rider_id,
  r.user_id,
  u.email,
  u.full_name,
  u.role,
  r.vehicle_type,
  r.is_available,
  CASE 
    WHEN r.user_id = u.id THEN '✓ FK Valid'
    ELSE '✗ FK Invalid'
  END AS fk_status
FROM riders r
LEFT JOIN users u ON r.user_id = u.id
WHERE u.email = 'johndave0991@bitebonansacafe.com'
   OR r.user_id IN (
     SELECT id FROM users WHERE email = 'johndave0991@bitebonansacafe.com'
   );

\echo ''
\echo 'Expected: Should return ONE row with fk_status = ''✓ FK Valid'''
\echo 'If NO rows: Rider profile not created (needs to visit /rider/profile)'
\echo 'If fk_status = ''✗ FK Invalid'': user_id doesn''t match users.id'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Check the orders.rider_id foreign key constraint
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 5: Checking orders.rider_id foreign key constraint definition'
\echo '------------------------------------------------------------------------'
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  a.attname AS column_name,
  confrelid::regclass AS referenced_table,
  af.attname AS referenced_column
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.conname = 'orders_rider_id_fkey';

\echo ''
\echo 'Expected: orders.rider_id -> users.id'
\echo 'This shows which table and column rider_id references'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Test the atomic assignment function
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 6: Testing atomic assignment function with actual user ID'
\echo '------------------------------------------------------------------------'
\echo 'Getting user ID for johndave0991@bitebonansacafe.com...'
DO $$
DECLARE
  v_user_id UUID;
  v_test_order_id TEXT := 'ORD-test-' || floor(random() * 1000000)::text;
  v_result JSON;
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'johndave0991@bitebonansacafe.com';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: User not found in public.users table';
    RAISE NOTICE 'ACTION REQUIRED: Run the fix SQL to create user in public.users';
  ELSE
    RAISE NOTICE 'User ID found: %', v_user_id;
    RAISE NOTICE '';
    RAISE NOTICE 'Testing assign_rider_to_order function...';
    RAISE NOTICE '(This will fail if no test order exists, which is expected)';
    
    -- Test the function
    SELECT assign_rider_to_order(v_test_order_id, v_user_id) INTO v_result;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Function result: %', v_result;
    RAISE NOTICE '';
    
    IF (v_result->>'error')::text = 'ORDER_NOT_FOUND' THEN
      RAISE NOTICE '✓ Function works correctly - returned ORDER_NOT_FOUND (expected for test order)';
    ELSIF (v_result->>'error')::text = 'INVALID_RIDER_ROLE' THEN
      RAISE NOTICE '✗ PROBLEM FOUND: User role is not ''rider''';
      RAISE NOTICE 'Actual role: %', v_result->>'actual_role';
      RAISE NOTICE 'ACTION REQUIRED: Update user role to ''rider''';
    ELSIF (v_result->>'error')::text = 'RIDER_NOT_FOUND' THEN
      RAISE NOTICE '✗ PROBLEM FOUND: User not found in users table';
      RAISE NOTICE 'ACTION REQUIRED: Create user in public.users table';
    ELSIF (v_result->>'error')::text = 'FK_VIOLATION' THEN
      RAISE NOTICE '✗ PROBLEM FOUND: Foreign key violation';
      RAISE NOTICE 'Details: %', v_result->>'message';
    ELSE
      RAISE NOTICE 'Unexpected result: %', v_result;
    END IF;
  END IF;
END $$;

\echo ''
\echo '═══════════════════════════════════════════════════════════════════════════'
\echo 'DIAGNOSIS COMPLETE'
\echo '═══════════════════════════════════════════════════════════════════════════'
\echo ''
\echo 'Review the results above to identify the issue:'
\echo ''
\echo '1. If STEP 1 shows NO rows:'
\echo '   → User does not exist in public.users table'
\echo '   → ACTION: Run fix_rider_user_missing.sql'
\echo ''
\echo '2. If STEP 1 shows role != ''rider'':'
\echo '   → User has wrong role'
\echo '   → ACTION: Run UPDATE users SET role = ''rider'' WHERE email = ''johndave0991@bitebonansacafe.com'';'
\echo ''
\echo '3. If STEP 3 shows ID MISMATCH:'
\echo '   → auth.users.id != public.users.id (DATA CORRUPTION)'
\echo '   → ACTION: Delete and recreate user in public.users with correct ID from auth.users'
\echo ''
\echo '4. If STEP 4 shows NO rows:'
\echo '   → Rider profile not created'
\echo '   → ACTION: Have rider visit /rider/profile and complete their profile'
\echo ''
\echo '═══════════════════════════════════════════════════════════════════════════'
