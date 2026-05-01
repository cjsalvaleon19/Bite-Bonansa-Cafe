-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnostic Script: Rider Foreign Key Constraint Violation
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Identify why rider assignment fails with FK constraint violation
-- Run this script to understand the root cause of the issue
-- NOTE: This version is compatible with Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNOSTIC REPORT: Rider FK Constraint Violation';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Check if the user exists in public.users table
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'STEP 1: Checking public.users table for johndave0991@bitebonansacafe.com';
  RAISE NOTICE '------------------------------------------------------------------------';
END $$;

SELECT 
  '=== STEP 1: public.users ===' AS diagnostic_step,
  id,
  email,
  full_name,
  role,
  created_at,
  CASE 
    WHEN role = 'rider' THEN '✓ Role is correct'
    ELSE '✗ Wrong role: ' || COALESCE(role, 'NULL')
  END AS status
FROM public.users
WHERE email = 'johndave0991@bitebonansacafe.com';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: Should return ONE row with role = ''rider''';
  RAISE NOTICE 'If NO rows: User does not exist in public.users table';
  RAISE NOTICE 'If role != ''rider'': User has wrong role';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Check if user exists in auth.users (Supabase Auth)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'STEP 2: Checking auth.users (Supabase Auth) table';
  RAISE NOTICE '------------------------------------------------------------------------';
END $$;

SELECT 
  '=== STEP 2: auth.users ===' AS diagnostic_step,
  id,
  email,
  created_at,
  confirmed_at,
  CASE 
    WHEN confirmed_at IS NOT NULL THEN '✓ Email confirmed'
    ELSE '✗ Email not confirmed'
  END AS status
FROM auth.users
WHERE email = 'johndave0991@bitebonansacafe.com';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: Should return ONE row (user authenticated successfully)';
  RAISE NOTICE 'If NO rows: User never signed up';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Check ID consistency between auth.users and public.users
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'STEP 3: Checking ID consistency between auth.users and public.users';
  RAISE NOTICE '------------------------------------------------------------------------';
END $$;

SELECT 
  '=== STEP 3: ID Consistency ===' AS diagnostic_step,
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

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: status = ''✓ IDs MATCH''';
  RAISE NOTICE 'If ID MISMATCH: auth.id and public.id are different - THIS IS THE ROOT CAUSE';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Check riders table for this user
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'STEP 4: Checking riders table';
  RAISE NOTICE '------------------------------------------------------------------------';
END $$;

SELECT 
  '=== STEP 4: riders table ===' AS diagnostic_step,
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

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: Should return ONE row with fk_status = ''✓ FK Valid''';
  RAISE NOTICE 'If NO rows: Rider profile not created (needs to visit /rider/profile)';
  RAISE NOTICE 'If fk_status = ''✗ FK Invalid'': user_id doesn''t match users.id';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Check the orders.rider_id foreign key constraint
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'STEP 5: Checking orders.rider_id foreign key constraint definition';
  RAISE NOTICE '------------------------------------------------------------------------';
END $$;

SELECT
  '=== STEP 5: FK Constraint ===' AS diagnostic_step,
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  a.attname AS column_name,
  confrelid::regclass AS referenced_table,
  af.attname AS referenced_column,
  '✓ Configured' AS status
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.conname = 'orders_rider_id_fkey';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: orders.rider_id -> users.id';
  RAISE NOTICE 'This shows which table and column rider_id references';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Test the atomic assignment function
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'STEP 6: Testing atomic assignment function with actual user ID';
  RAISE NOTICE '------------------------------------------------------------------------';
  RAISE NOTICE 'Getting user ID for johndave0991@bitebonansacafe.com...';
END $$;

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

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNOSIS COMPLETE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the results above to identify the issue:';
  RAISE NOTICE '';
  RAISE NOTICE '1. If STEP 1 shows NO rows:';
  RAISE NOTICE '   → User does not exist in public.users table';
  RAISE NOTICE '   → ACTION: Run fix_rider_user_sync.sql';
  RAISE NOTICE '';
  RAISE NOTICE '2. If STEP 1 shows role != ''rider'':';
  RAISE NOTICE '   → User has wrong role';
  RAISE NOTICE '   → ACTION: Run UPDATE users SET role = ''rider'' WHERE email = ''johndave0991@bitebonansacafe.com'';';
  RAISE NOTICE '';
  RAISE NOTICE '3. If STEP 3 shows ID MISMATCH:';
  RAISE NOTICE '   → auth.users.id != public.users.id (DATA CORRUPTION)';
  RAISE NOTICE '   → ACTION: Delete and recreate user in public.users with correct ID from auth.users';
  RAISE NOTICE '';
  RAISE NOTICE '4. If STEP 4 shows NO rows:';
  RAISE NOTICE '   → Rider profile not created';
  RAISE NOTICE '   → ACTION: Have rider visit /rider/profile and complete their profile';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
END $$;
