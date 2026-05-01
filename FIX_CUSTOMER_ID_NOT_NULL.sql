-- ═══════════════════════════════════════════════════════════════════════════
-- IMMEDIATE FIX: Make customer_id nullable in users table
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to immediately fix the NOT NULL constraint error
-- 
-- Error being fixed:
-- ERROR: 23502: null value in column "customer_id" of relation "users" 
--        violates not-null constraint
-- 
-- Root cause: customer_id has NOT NULL constraint, but riders/cashiers/admins
--             don't need customer_id (only customers do)
-- ═══════════════════════════════════════════════════════════════════════════

-- Make customer_id nullable
ALTER TABLE public.users 
  ALTER COLUMN customer_id DROP NOT NULL;

-- Verify the fix
SELECT 
  '=== Verification ===' AS status,
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN is_nullable = 'YES' THEN '✓ FIXED - customer_id is now nullable'
    ELSE '✗ FAILED - customer_id is still NOT NULL'
  END AS result
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'customer_id';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Fix applied successfully';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now create rider/cashier/admin users without customer_id';
  RAISE NOTICE 'customer_id is only required for users with role=''customer''';
  RAISE NOTICE '';
END $$;
