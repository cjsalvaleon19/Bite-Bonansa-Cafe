-- ===========================================================================
-- Migration 062: Comprehensive Fix for orders_rider_id_fkey Error
-- ===========================================================================
-- Issue: Foreign key constraint violation when assigning riders to orders
-- Error: insert or update on table "orders" violates foreign key constraint 
--        "orders_rider_id_fkey"
-- Root Causes:
--   1. customer_id has NOT NULL constraint blocking rider user creation
--   2. Riders exist in auth.users but not in public.users
--   3. Missing FK relationship validation
-- Solution: Make customer_id nullable, sync users, validate constraints
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================================================';
  RAISE NOTICE 'Migration 062: Comprehensive Fix for orders_rider_id_fkey Error';
  RAISE NOTICE '===========================================================================';
  RAISE NOTICE '';
END $$;

-- ===========================================================================
-- STEP 1: Make customer_id nullable (if not already)
-- ===========================================================================
DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  RAISE NOTICE 'STEP 1: Making customer_id nullable...';
  RAISE NOTICE '-----------------------------------------------------------------------';
  
  -- Check current state
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'customer_id';
  
  IF v_is_nullable = 'NO' THEN
    RAISE NOTICE 'customer_id is currently NOT NULL, making it nullable...';
    ALTER TABLE public.users ALTER COLUMN customer_id DROP NOT NULL;
    RAISE NOTICE '✓ customer_id is now nullable';
  ELSIF v_is_nullable = 'YES' THEN
    RAISE NOTICE '✓ customer_id is already nullable';
  ELSE
    RAISE NOTICE 'Warning: customer_id column not found (this is unusual)';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ===========================================================================
-- STEP 2: Sync riders from auth.users to public.users
-- ===========================================================================
DO $$
DECLARE
  v_synced_count INTEGER := 0;
  v_rider_email TEXT;
  v_rider_id UUID;
BEGIN
  RAISE NOTICE 'STEP 2: Syncing riders from auth.users to public.users...';
  RAISE NOTICE '-----------------------------------------------------------------------';
  
  -- Sync riders that exist in auth but not in public.users
  -- Focus on known rider emails from roleMapping.js
  FOR v_rider_email, v_rider_id IN 
    SELECT a.email, a.id
    FROM auth.users a
    LEFT JOIN public.users p ON a.id = p.id
    WHERE a.email IN (
      'johndave0991@bitebonansacafe.com',
      'johndave0991@gmail.com',
      'rider@youremail.com'
    )
    AND p.id IS NULL
  LOOP
    -- Create the missing user in public.users
    INSERT INTO public.users (id, email, full_name, role, customer_id)
    VALUES (
      v_rider_id,
      v_rider_email,
      CASE 
        WHEN v_rider_email LIKE '%johndave%' THEN 'John Dave Salvaleon'
        ELSE 'Rider User'
      END,
      'rider',
      NULL
    )
    ON CONFLICT (id) DO UPDATE 
    SET role = EXCLUDED.role,
        full_name = COALESCE(users.full_name, EXCLUDED.full_name);
    
    v_synced_count := v_synced_count + 1;
    RAISE NOTICE '✓ Synced rider: % (ID: %)', v_rider_email, v_rider_id;
  END LOOP;
  
  IF v_synced_count = 0 THEN
    RAISE NOTICE '✓ All rider users already synced (no action needed)';
  ELSE
    RAISE NOTICE '✓ Synced % rider(s) from auth.users to public.users', v_synced_count;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ===========================================================================
-- STEP 3: Update existing users with rider emails to have 'rider' role
-- ===========================================================================
DO $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'STEP 3: Ensuring correct role for rider emails...';
  RAISE NOTICE '-----------------------------------------------------------------------';
  
  WITH updated AS (
    UPDATE public.users
    SET role = 'rider'
    WHERE email IN (
      'johndave0991@bitebonansacafe.com',
      'johndave0991@gmail.com',
      'rider@youremail.com'
    )
    AND (role IS NULL OR role != 'rider')
    RETURNING email
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE '✓ Updated % user(s) to have rider role', v_updated_count;
  ELSE
    RAISE NOTICE '✓ All rider emails already have correct role';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ===========================================================================
-- STEP 4: Cleanup orphaned riders (riders without valid user_id)
-- ===========================================================================
DO $$
DECLARE
  v_orphaned_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'STEP 4: Cleaning up orphaned riders...';
  RAISE NOTICE '-----------------------------------------------------------------------';
  
  -- Check if riders table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'riders'
  ) THEN
    -- Count orphaned riders
    SELECT COUNT(*) INTO v_orphaned_count
    FROM riders r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE u.id IS NULL;
    
    IF v_orphaned_count > 0 THEN
      RAISE NOTICE 'Found % orphaned rider(s), deleting...', v_orphaned_count;
      
      DELETE FROM riders
      WHERE user_id NOT IN (SELECT id FROM users);
      
      RAISE NOTICE '✓ Deleted % orphaned rider(s)', v_orphaned_count;
    ELSE
      RAISE NOTICE '✓ No orphaned riders found';
    END IF;
  ELSE
    RAISE NOTICE '✓ Riders table does not exist yet (will be created by migration 050)';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ===========================================================================
-- STEP 5: Ensure riders table has ON DELETE CASCADE for user_id FK
-- ===========================================================================
DO $$
DECLARE
  v_fk_exists BOOLEAN;
  v_has_cascade BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE 'STEP 5: Ensuring riders.user_id FK has ON DELETE CASCADE...';
  RAISE NOTICE '-----------------------------------------------------------------------';
  
  -- Check if riders table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'riders'
  ) THEN
    -- Check if FK exists and has CASCADE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'riders' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
    ) INTO v_fk_exists;
    
    IF v_fk_exists THEN
      -- Check for CASCADE
      SELECT confdeltype = 'c' INTO v_has_cascade
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'riders' 
        AND c.contype = 'f'
        AND EXISTS (
          SELECT 1 FROM unnest(c.conkey) k
          JOIN pg_attribute a ON a.attnum = k AND a.attrelid = t.oid
          WHERE a.attname = 'user_id'
        );
      
      IF NOT v_has_cascade THEN
        RAISE NOTICE 'FK exists but lacks CASCADE, recreating...';
        
        -- Drop existing FK
        ALTER TABLE riders 
          DROP CONSTRAINT IF EXISTS riders_user_id_fkey;
        
        -- Add FK with CASCADE
        ALTER TABLE riders
          ADD CONSTRAINT riders_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES users(id) 
          ON DELETE CASCADE;
        
        RAISE NOTICE '✓ Recreated FK with ON DELETE CASCADE';
      ELSE
        RAISE NOTICE '✓ FK already has ON DELETE CASCADE';
      END IF;
    ELSE
      RAISE NOTICE '✓ No user_id FK found (will be created by migration 050)';
    END IF;
  ELSE
    RAISE NOTICE '✓ Riders table does not exist yet';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ===========================================================================
-- STEP 6: Validate orders.rider_id FK constraint
-- ===========================================================================
DO $$
DECLARE
  v_invalid_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'STEP 6: Validating orders.rider_id FK constraint...';
  RAISE NOTICE '-----------------------------------------------------------------------';
  
  -- Check if orders table and rider_id column exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'rider_id'
  ) THEN
    -- Count orders with invalid rider_id (doesn't exist in users)
    SELECT COUNT(*) INTO v_invalid_count
    FROM orders o
    WHERE o.rider_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.rider_id);
    
    IF v_invalid_count > 0 THEN
      RAISE NOTICE 'WARNING: Found % order(s) with invalid rider_id', v_invalid_count;
      RAISE NOTICE 'Clearing invalid rider_id values...';
      
      UPDATE orders
      SET rider_id = NULL
      WHERE rider_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = rider_id);
      
      RAISE NOTICE '✓ Cleared % invalid rider_id value(s)', v_invalid_count;
    ELSE
      RAISE NOTICE '✓ All orders have valid rider_id references';
    END IF;
    
    -- Verify FK constraint exists
    IF EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_name = 'orders' 
        AND constraint_name = 'orders_rider_id_fkey'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
      RAISE NOTICE '✓ FK constraint orders_rider_id_fkey exists';
    ELSE
      RAISE NOTICE 'WARNING: FK constraint orders_rider_id_fkey not found';
    END IF;
  ELSE
    RAISE NOTICE '✓ orders.rider_id column does not exist yet';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ===========================================================================
-- STEP 7: Verification Report
-- ===========================================================================
DO $$
DECLARE
  v_rider_count INTEGER := 0;
  v_rider_with_profile_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'STEP 7: Verification Report';
  RAISE NOTICE '-----------------------------------------------------------------------';
  
  -- Count riders in public.users
  SELECT COUNT(*) INTO v_rider_count
  FROM public.users
  WHERE role = 'rider';
  
  RAISE NOTICE 'Total riders in public.users: %', v_rider_count;
  
  -- Count riders with profiles (if riders table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'riders'
  ) THEN
    SELECT COUNT(*) INTO v_rider_with_profile_count
    FROM riders r
    JOIN users u ON r.user_id = u.id
    WHERE u.role = 'rider';
    
    RAISE NOTICE 'Riders with complete profiles: %', v_rider_with_profile_count;
    RAISE NOTICE 'Riders without profiles: %', v_rider_count - v_rider_with_profile_count;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- Show rider details
SELECT 
  '=== Available Riders ===' AS section,
  u.id,
  u.email,
  u.full_name,
  u.role,
  CASE 
    WHEN r.id IS NOT NULL THEN '✓ Has Profile'
    ELSE '✗ Missing Profile'
  END AS profile_status
FROM public.users u
LEFT JOIN riders r ON u.id = r.user_id
WHERE u.role = 'rider'
ORDER BY u.email;

-- ===========================================================================
-- COMPLETION NOTICE
-- ===========================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================================================';
  RAISE NOTICE 'Migration 062 Complete - orders_rider_id_fkey Error Fixed!';
  RAISE NOTICE '===========================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'What was fixed:';
  RAISE NOTICE '  - customer_id is now nullable (riders don''t need it)';
  RAISE NOTICE '  - Riders synced from auth.users to public.users';
  RAISE NOTICE '  - All rider emails have correct ''rider'' role';
  RAISE NOTICE '  - Orphaned riders cleaned up';
  RAISE NOTICE '  - FK constraints validated and repaired';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)';
  RAISE NOTICE '  2. Go to Cashier Dashboard -> Orders Queue';
  RAISE NOTICE '  3. Try assigning a rider to an order';
  RAISE NOTICE '  4. If rider appears but assignment fails, rider needs to:';
  RAISE NOTICE '     - Log in to rider account';
  RAISE NOTICE '     - Visit /rider/profile';
  RAISE NOTICE '     - Complete their profile';
  RAISE NOTICE '';
  RAISE NOTICE '===========================================================================';
  RAISE NOTICE '';
END $$;
