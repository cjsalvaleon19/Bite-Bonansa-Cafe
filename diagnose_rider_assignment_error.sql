-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnostic Script: Rider Assignment Error Investigation
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Diagnose why rider assignment is failing with "Object" error
-- Run this in Supabase SQL Editor to identify the root cause
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNOSTIC: Rider Assignment Error Investigation';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK 1: customer_id Column Constraint
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '--- CHECK 1: customer_id Column Constraint ---';
  RAISE NOTICE '';
END $$;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN is_nullable = 'YES' THEN '✓ PASS: customer_id is nullable (riders can be created)'
    ELSE '✗ FAIL: customer_id is NOT NULL (blocking rider creation)'
  END AS status,
  CASE
    WHEN is_nullable = 'NO' THEN 'ACTION REQUIRED: Run Migration 061 to make customer_id nullable'
    ELSE 'No action needed'
  END AS action
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'customer_id';

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK 2: Rider Accounts in auth.users vs public.users
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '--- CHECK 2: Rider Accounts Sync Status ---';
  RAISE NOTICE '';
END $$;

SELECT 
  au.email AS rider_email,
  au.id AS auth_id,
  u.id AS public_id,
  u.role AS public_role,
  u.customer_id,
  CASE 
    WHEN u.id IS NULL THEN '✗ FAIL: Rider missing from public.users'
    WHEN u.role IS NULL THEN '✗ FAIL: Rider has NULL role'
    WHEN u.role != 'rider' THEN '✗ FAIL: Wrong role (' || u.role || ')'
    ELSE '✓ PASS: Rider exists with correct role'
  END AS status,
  CASE
    WHEN u.id IS NULL THEN 'ACTION: Create user record in public.users OR logout/login to trigger auto-create'
    WHEN u.role != 'rider' THEN 'ACTION: Update role to ''rider'' in public.users'
    ELSE 'No action needed'
  END AS action
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email ILIKE '%rider%' 
   OR au.email ILIKE '%johndave%'
ORDER BY au.email;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK 3: Rider Profiles in riders Table
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '--- CHECK 3: Rider Profile Completion ---';
  RAISE NOTICE '';
END $$;

SELECT 
  u.email AS rider_email,
  u.id AS user_id,
  u.role,
  r.id AS rider_profile_id,
  r.driver_id,
  r.vehicle_type,
  r.is_available,
  CASE 
    WHEN u.role != 'rider' THEN '⊗ N/A: Not a rider'
    WHEN r.id IS NULL THEN '⚠️ WARNING: No profile in riders table'
    WHEN r.driver_id IS NULL OR r.vehicle_type IS NULL THEN '⚠️ WARNING: Incomplete profile'
    ELSE '✓ PASS: Profile complete'
  END AS status,
  CASE
    WHEN u.role = 'rider' AND r.id IS NULL THEN 'ACTION: Rider should visit /rider/profile to complete profile'
    WHEN r.driver_id IS NULL OR r.vehicle_type IS NULL THEN 'ACTION: Rider should complete profile fields'
    ELSE 'No action needed'
  END AS action
FROM public.users u
LEFT JOIN public.riders r ON u.id = r.user_id
WHERE u.email ILIKE '%rider%' 
   OR u.email ILIKE '%johndave%'
ORDER BY u.email;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK 4: Foreign Key Constraints
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '--- CHECK 4: Foreign Key Constraints ---';
  RAISE NOTICE '';
END $$;

SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  a.attname AS column_name,
  af.attname AS referenced_column,
  confupdtype AS on_update,
  confdeltype AS on_delete,
  CASE 
    WHEN conname = 'orders_rider_id_fkey' THEN 
      CASE 
        WHEN confrelid::regclass::text = 'users' THEN '✓ PASS: orders.rider_id references users.id'
        ELSE '✗ FAIL: Wrong reference'
      END
    WHEN conname = 'riders_user_id_fkey' THEN
      CASE
        WHEN confdeltype = 'c' THEN '✓ PASS: CASCADE delete configured'
        ELSE '⚠️ WARNING: No CASCADE delete (see migration 060)'
      END
    ELSE 'INFO'
  END AS status
FROM pg_constraint
JOIN pg_attribute a ON a.attnum = ANY(conkey) AND a.attrelid = conrelid
JOIN pg_attribute af ON af.attnum = ANY(confkey) AND af.attrelid = confrelid
WHERE contype = 'f' 
  AND (conname LIKE '%rider%' OR conrelid::regclass::text IN ('orders', 'riders'))
ORDER BY conname;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK 5: Test Atomic Assignment Function
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '--- CHECK 5: Atomic Assignment Function Test ---';
  RAISE NOTICE '';
END $$;

-- Check if function exists
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type,
  CASE 
    WHEN routine_name = 'assign_rider_to_order' THEN '✓ PASS: Function exists'
    ELSE 'INFO'
  END AS status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'assign_rider_to_order';

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK 6: Sample Test Assignment (Safe - No Side Effects)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '--- CHECK 6: Simulated Assignment Test ---';
  RAISE NOTICE '';
  RAISE NOTICE 'Testing what would happen with a sample assignment...';
  RAISE NOTICE '';
END $$;

-- Find a sample delivery order and rider for testing
SELECT 
  o.id AS order_id,
  o.status AS order_status,
  o.order_mode,
  u.id AS rider_id,
  u.email AS rider_email,
  u.role AS rider_role,
  CASE 
    WHEN o.id IS NULL THEN '⚠️ No delivery orders found'
    WHEN u.id IS NULL THEN '✗ FAIL: No riders found in users table'
    WHEN u.role != 'rider' THEN '✗ FAIL: User exists but role is ' || u.role
    ELSE '✓ PASS: Ready for assignment test'
  END AS test_status,
  CASE
    WHEN u.id IS NULL THEN 'Create rider user in public.users first'
    WHEN u.role != 'rider' THEN 'Fix rider role in public.users'
    ELSE 'Can test: SELECT assign_rider_to_order(''' || o.id || ''', ''' || u.id || ''');'
  END AS next_step
FROM (
  SELECT id, status, order_mode 
  FROM orders 
  WHERE order_mode = 'delivery' 
    AND status IN ('pending', 'preparing')
  LIMIT 1
) o
CROSS JOIN (
  SELECT id, email, role
  FROM public.users
  WHERE role = 'rider'
  LIMIT 1
) u;

-- ═══════════════════════════════════════════════════════════════════════════
-- SUMMARY AND RECOMMENDATIONS
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNOSTIC COMPLETE - Next Steps';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '1. Review all checks above for ✗ FAIL or ⚠️ WARNING statuses';
  RAISE NOTICE '2. Most common issue: customer_id NOT NULL blocking rider creation';
  RAISE NOTICE '   FIX: Run Migration 061 (see FIX_CUSTOMER_ID_NOT_NULL.sql)';
  RAISE NOTICE '';
  RAISE NOTICE '3. If rider missing from public.users:';
  RAISE NOTICE '   FIX: Logout and login again to trigger auto-create';
  RAISE NOTICE '   OR: Manually insert rider record (see DIAGNOSE_RIDER_ASSIGNMENT_ERROR.md)';
  RAISE NOTICE '';
  RAISE NOTICE '4. If rider profile incomplete:';
  RAISE NOTICE '   INFO: Rider can still be assigned (fallback logic exists)';
  RAISE NOTICE '   RECOMMENDED: Rider should visit /rider/profile to complete profile';
  RAISE NOTICE '';
  RAISE NOTICE '5. After fixes, test assignment with the SQL command from CHECK 6';
  RAISE NOTICE '';
  RAISE NOTICE 'Documentation: See DIAGNOSE_RIDER_ASSIGNMENT_ERROR.md for detailed guide';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
END $$;
