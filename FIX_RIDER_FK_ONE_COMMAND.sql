-- ═══════════════════════════════════════════════════════════════════════════
-- ONE-COMMAND FIX: Rider Assignment FK Constraint Error
-- ═══════════════════════════════════════════════════════════════════════════
-- Copy and paste this ENTIRE file into Supabase SQL Editor and click RUN
-- This will fix the rider assignment error in one step
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'FIXING: Rider Assignment FK Constraint Error';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Make customer_id nullable
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '[1/3] Making customer_id nullable...';
END $$;

ALTER TABLE public.users 
  ALTER COLUMN customer_id DROP NOT NULL;

DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'customer_id';
  
  IF v_is_nullable = 'YES' THEN
    RAISE NOTICE '      ✓ customer_id is now nullable';
  ELSE
    RAISE EXCEPTION '✗ FAILED: customer_id is still NOT NULL';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Create missing rider users from auth.users
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[2/3] Creating missing rider users...';
  
  -- Insert riders from auth.users that don't exist in public.users
  INSERT INTO public.users (id, email, full_name, role, customer_id)
  SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Rider'),
    'rider',
    NULL  -- Riders don't need customer_id
  FROM auth.users au
  LEFT JOIN public.users u ON au.id = u.id
  WHERE u.id IS NULL  -- User doesn't exist in public.users
    AND (
      au.email ILIKE '%rider%' 
      OR au.email ILIKE '%johndave%'
      OR au.email = 'johndave0991@bitebonansacafe.com'
      OR au.email = 'johndave0991@gmail.com'
      OR au.email = 'rider@youremail.com'
    )
  ON CONFLICT (id) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  IF v_count > 0 THEN
    RAISE NOTICE '      ✓ Created % rider user(s)', v_count;
  ELSE
    RAISE NOTICE '      ℹ No missing rider users (they already exist)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Verify the fix
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[3/3] Verifying fix...';
END $$;

-- Show rider users
DO $$
DECLARE
  rider_record RECORD;
  rider_count INTEGER := 0;
BEGIN
  FOR rider_record IN
    SELECT 
      u.id,
      u.email,
      u.full_name,
      u.role
    FROM public.users u
    WHERE u.role = 'rider'
    ORDER BY u.email
  LOOP
    rider_count := rider_count + 1;
    RAISE NOTICE '      ✓ Rider #%: % (%) - ID: %', 
      rider_count, rider_record.full_name, rider_record.email, rider_record.id;
  END LOOP;
  
  IF rider_count = 0 THEN
    RAISE WARNING '      ⚠ No riders found! Check if rider emails are correct.';
  END IF;
END $$;

-- Final status
SELECT 
  '=== FINAL VERIFICATION ===' AS status,
  column_name,
  is_nullable,
  CASE 
    WHEN is_nullable = 'YES' THEN '✓ PASS: customer_id is nullable'
    ELSE '✗ FAIL: customer_id is still NOT NULL'
  END AS customer_id_status
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'customer_id';

SELECT 
  '=== RIDER USERS ===' AS status,
  COUNT(*) as rider_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ PASS: Riders exist and can be assigned'
    ELSE '✗ FAIL: No riders found'
  END AS riders_status
FROM public.users
WHERE role = 'rider';

-- Show riders with details
SELECT 
  '=== ASSIGNABLE RIDERS ===' AS info,
  u.id as rider_id,
  u.email as rider_email,
  u.full_name as rider_name,
  u.role,
  u.customer_id,
  'Ready to assign! ✓' as status
FROM public.users u
WHERE u.role = 'rider'
ORDER BY u.email;

-- Summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ FIX COMPLETE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'What was fixed:';
  RAISE NOTICE '  1. customer_id is now nullable (only customers need it)';
  RAISE NOTICE '  2. Rider users created in public.users table';
  RAISE NOTICE '  3. Riders can now be assigned to delivery orders';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)';
  RAISE NOTICE '  2. Go to cashier Orders Queue page';
  RAISE NOTICE '  3. Try assigning rider to a delivery order';
  RAISE NOTICE '  4. Should work now! ✓';
  RAISE NOTICE '';
  RAISE NOTICE 'If still not working:';
  RAISE NOTICE '  - Check if rider email matches the emails searched above';
  RAISE NOTICE '  - Rider may need to logout and login again';
  RAISE NOTICE '  - Check the "ASSIGNABLE RIDERS" table above';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
END $$;
