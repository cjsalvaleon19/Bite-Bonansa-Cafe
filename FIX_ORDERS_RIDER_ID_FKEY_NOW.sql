-- ═══════════════════════════════════════════════════════════════════════════
-- QUICK FIX: Resolve orders_rider_id_fkey Error NOW
-- ═══════════════════════════════════════════════════════════════════════════
-- Copy this ENTIRE file and paste into Supabase SQL Editor, then click RUN
-- This will fix the rider assignment error in less than 1 minute
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🚀 QUICK FIX: Resolving orders_rider_id_fkey Error';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'This script will:';
  RAISE NOTICE '  1. Make customer_id nullable (riders don''t need it)';
  RAISE NOTICE '  2. Sync riders from auth to public database';
  RAISE NOTICE '  3. Fix role assignments';
  RAISE NOTICE '  4. Clean up data integrity issues';
  RAISE NOTICE '';
  RAISE NOTICE 'Starting in 3... 2... 1...';
  RAISE NOTICE '';
END $$;

-- Fix 1: Make customer_id nullable
DO $$
BEGIN
  RAISE NOTICE '[ 1/4 ] Making customer_id nullable...';
  
  BEGIN
    ALTER TABLE public.users ALTER COLUMN customer_id DROP NOT NULL;
    RAISE NOTICE '        ✓ customer_id is now nullable';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '        ℹ customer_id was already nullable or doesn''t exist';
  END;
END $$;

-- Fix 2: Sync riders from auth.users to public.users
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '[ 2/4 ] Syncing riders from auth to public database...';
  
  WITH synced AS (
    INSERT INTO public.users (id, email, full_name, role, customer_id)
    SELECT 
      a.id,
      a.email,
      COALESCE(
        a.raw_user_meta_data->>'full_name',
        CASE 
          WHEN a.email LIKE '%johndave%' THEN 'John Dave Salvaleon'
          ELSE 'Rider User'
        END
      ) as full_name,
      'rider' as role,
      NULL as customer_id
    FROM auth.users a
    WHERE a.email IN (
      'johndave0991@bitebonansacafe.com',
      'johndave0991@gmail.com',
      'rider@youremail.com'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.users p WHERE p.id = a.id
    )
    ON CONFLICT (id) DO UPDATE 
    SET role = EXCLUDED.role
    RETURNING *
  )
  SELECT COUNT(*) INTO v_count FROM synced;
  
  IF v_count > 0 THEN
    RAISE NOTICE '        ✓ Synced % rider(s)', v_count;
  ELSE
    RAISE NOTICE '        ✓ Riders already synced';
  END IF;
END $$;

-- Fix 3: Ensure correct roles for rider emails
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '[ 3/4 ] Fixing rider roles...';
  
  WITH updated AS (
    UPDATE public.users
    SET role = 'rider'
    WHERE email IN (
      'johndave0991@bitebonansacafe.com',
      'johndave0991@gmail.com',
      'rider@youremail.com'
    )
    AND (role IS NULL OR role != 'rider')
    RETURNING *
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  
  IF v_count > 0 THEN
    RAISE NOTICE '        ✓ Fixed % rider role(s)', v_count;
  ELSE
    RAISE NOTICE '        ✓ All rider roles are correct';
  END IF;
END $$;

-- Fix 4: Clean invalid rider_id in orders
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '[ 4/4 ] Cleaning invalid rider assignments...';
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rider_id'
  ) THEN
    WITH cleaned AS (
      UPDATE orders
      SET rider_id = NULL
      WHERE rider_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM users WHERE id = orders.rider_id)
      RETURNING *
    )
    SELECT COUNT(*) INTO v_count FROM cleaned;
    
    IF v_count > 0 THEN
      RAISE NOTICE '        ✓ Cleaned % invalid assignment(s)', v_count;
    ELSE
      RAISE NOTICE '        ✓ All assignments are valid';
    END IF;
  ELSE
    RAISE NOTICE '        ✓ Orders table not ready yet';
  END IF;
END $$;

-- Verification
DO $$
DECLARE
  v_rider_count INTEGER;
  v_is_nullable TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ VERIFICATION REPORT';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  
  -- Check customer_id
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'customer_id';
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 Database Status:';
  RAISE NOTICE '   customer_id nullable: %', 
    CASE WHEN v_is_nullable = 'YES' THEN '✓ YES' ELSE '✗ NO' END;
  
  -- Check riders
  SELECT COUNT(*) INTO v_rider_count
  FROM public.users
  WHERE role = 'rider';
  
  RAISE NOTICE '   Riders in database: %', v_rider_count;
  RAISE NOTICE '';
END $$;

-- Show available riders
SELECT 
  '🏍️  AVAILABLE RIDERS' AS status,
  u.email,
  u.full_name,
  CASE 
    WHEN r.id IS NOT NULL THEN '✓ Has Profile' 
    ELSE '⚠️  Needs Profile'
  END as profile_status,
  CASE 
    WHEN r.is_available THEN '✓ Available'
    WHEN r.is_available = false THEN '✗ Busy'
    ELSE '⚠️  Unknown'
  END as availability
FROM public.users u
LEFT JOIN riders r ON u.id = r.user_id
WHERE u.role = 'rider'
ORDER BY u.email;

-- Final message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 FIX COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'What to do next:';
  RAISE NOTICE '';
  RAISE NOTICE '  1️⃣  REFRESH your browser (Ctrl+Shift+R or Cmd+Shift+R)';
  RAISE NOTICE '  2️⃣  Go to Cashier Dashboard → Orders Queue';
  RAISE NOTICE '  3️⃣  Try assigning a rider to a delivery order';
  RAISE NOTICE '';
  RAISE NOTICE 'If rider shows "⚠️  Needs Profile" above:';
  RAISE NOTICE '  → Log in as that rider';
  RAISE NOTICE '  → Visit /rider/profile';
  RAISE NOTICE '  → Complete the profile form';
  RAISE NOTICE '  → Then try assignment again';
  RAISE NOTICE '';
  RAISE NOTICE 'The orders_rider_id_fkey error should now be RESOLVED! 🎊';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
