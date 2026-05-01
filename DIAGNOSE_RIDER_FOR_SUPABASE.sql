-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnostic Script: Rider Foreign Key Constraint Violation
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO USE: Copy and paste this ENTIRE script into Supabase SQL Editor and run
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Check if the user exists in public.users table
SELECT 
  '=== STEP 1: Checking public.users table ===' AS diagnostic_step,
  id,
  email,
  full_name,
  role,
  created_at,
  CASE 
    WHEN role = 'rider' THEN '✓ Role is correct'
    ELSE '✗ Role should be ''rider'' but is ''' || role || ''''
  END AS status
FROM public.users
WHERE email = 'johndave0991@bitebonansacafe.com';

-- Expected: Should return ONE row with role = 'rider'
-- If NO rows: User does not exist in public.users table - THIS IS THE PROBLEM
-- If role != 'rider': User has wrong role

-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 2: Check if user exists in auth.users (Supabase Auth)
SELECT 
  '=== STEP 2: Checking auth.users (Supabase Auth) ===' AS diagnostic_step,
  id,
  email,
  created_at,
  confirmed_at
FROM auth.users
WHERE email = 'johndave0991@bitebonansacafe.com';

-- Expected: Should return ONE row (user authenticated successfully)
-- If NO rows: User never signed up

-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 3: Check ID consistency between auth.users and public.users
SELECT 
  '=== STEP 3: Checking ID consistency ===' AS diagnostic_step,
  a.id AS auth_id,
  a.email AS auth_email,
  p.id AS public_id,
  p.email AS public_email,
  p.role AS public_role,
  CASE 
    WHEN a.id = p.id AND p.role = 'rider' THEN '✓ IDs MATCH and role is correct - READY'
    WHEN a.id = p.id AND p.role != 'rider' THEN '⚠ IDs match but role is wrong'
    WHEN a.id IS NULL THEN '✗ User not in auth.users'
    WHEN p.id IS NULL THEN '✗ User not in public.users - THIS IS THE PROBLEM'
    ELSE '✗ ID MISMATCH - THIS IS THE PROBLEM'
  END AS status
FROM auth.users a
FULL OUTER JOIN public.users p ON a.email = p.email
WHERE a.email = 'johndave0991@bitebonansacafe.com' 
   OR p.email = 'johndave0991@bitebonansacafe.com';

-- Expected: status = '✓ IDs MATCH and role is correct'
-- If 'User not in public.users': Run FIX_RIDER_FOR_SUPABASE.sql
-- If 'ID MISMATCH': Run FIX_RIDER_FOR_SUPABASE.sql
-- If 'role is wrong': Run FIX_RIDER_FOR_SUPABASE.sql

-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 4: Check riders table for this user
SELECT 
  '=== STEP 4: Checking riders table ===' AS diagnostic_step,
  r.id AS rider_id,
  r.user_id,
  u.email,
  u.full_name,
  u.role,
  r.vehicle_type,
  r.is_available,
  CASE 
    WHEN r.user_id = u.id THEN '✓ FK Valid'
    WHEN r.user_id IS NULL THEN '✗ No rider record'
    ELSE '✗ FK Invalid'
  END AS fk_status
FROM riders r
LEFT JOIN users u ON r.user_id = u.id
WHERE u.email = 'johndave0991@bitebonansacafe.com'
   OR r.user_id IN (
     SELECT id FROM users WHERE email = 'johndave0991@bitebonansacafe.com'
   );

-- Expected: Should return ONE row with fk_status = '✓ FK Valid'
-- If NO rows: Rider profile not created (rider needs to visit /rider/profile)
-- If fk_status = '✗ FK Invalid': user_id doesn't match users.id

-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 5: Summary - What to do next
DO $$
BEGIN
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNOSIS COMPLETE - Review the results above';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'WHAT TO DO BASED ON RESULTS:';
  RAISE NOTICE '';
  RAISE NOTICE '1. If STEP 1 shows NO rows:';
  RAISE NOTICE '   → User missing from public.users';
  RAISE NOTICE '   → ACTION: Run FIX_RIDER_FOR_SUPABASE.sql';
  RAISE NOTICE '';
  RAISE NOTICE '2. If STEP 1 shows role != ''rider'':';
  RAISE NOTICE '   → User has wrong role';
  RAISE NOTICE '   → ACTION: Run FIX_RIDER_FOR_SUPABASE.sql';
  RAISE NOTICE '';
  RAISE NOTICE '3. If STEP 3 shows ID MISMATCH:';
  RAISE NOTICE '   → Data corruption between auth and public tables';
  RAISE NOTICE '   → ACTION: Run FIX_RIDER_FOR_SUPABASE.sql';
  RAISE NOTICE '';
  RAISE NOTICE '4. If STEP 4 shows NO rows:';
  RAISE NOTICE '   → Rider profile not created yet';
  RAISE NOTICE '   → ACTION: Rider must login and visit /rider/profile';
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
END $$;
