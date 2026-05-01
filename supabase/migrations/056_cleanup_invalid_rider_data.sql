-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 056: Clean Up Invalid Rider Data
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem: Riders table may have entries with null user_id or invalid references
-- Solution: Clean up invalid data to prevent FK constraint violations
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Cleaning up invalid rider data...';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Remove riders with NULL user_id
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  null_user_id_count INT;
BEGIN
  -- Check if riders table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'riders'
  ) THEN
    -- Count riders with null user_id
    SELECT COUNT(*) INTO null_user_id_count
    FROM riders
    WHERE user_id IS NULL;
    
    IF null_user_id_count > 0 THEN
      RAISE WARNING '→ Found % riders with NULL user_id', null_user_id_count;
      
      -- Delete riders with null user_id
      DELETE FROM riders
      WHERE user_id IS NULL;
      
      RAISE NOTICE '✓ Removed % riders with NULL user_id', null_user_id_count;
    ELSE
      RAISE NOTICE '✓ No riders with NULL user_id found';
    END IF;
  ELSE
    RAISE NOTICE '→ Riders table does not exist, skipping cleanup';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Remove riders where user_id doesn't exist in users table
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  orphaned_count INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'riders'
  ) THEN
    -- Count orphaned riders
    SELECT COUNT(*) INTO orphaned_count
    FROM riders r
    WHERE NOT EXISTS (
      SELECT 1 FROM users u WHERE u.id = r.user_id
    );
    
    IF orphaned_count > 0 THEN
      RAISE WARNING '→ Found % riders with invalid user_id references', orphaned_count;
      
      -- Delete orphaned riders
      DELETE FROM riders
      WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = riders.user_id
      );
      
      RAISE NOTICE '✓ Removed % riders with invalid user_id references', orphaned_count;
    ELSE
      RAISE NOTICE '✓ All riders have valid user_id references';
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Ensure user_id is NOT NULL constraint
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'riders'
  ) THEN
    -- Check if user_id column allows NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'riders' 
        AND column_name = 'user_id'
        AND is_nullable = 'YES'
    ) THEN
      -- Alter column to NOT NULL (safe now after cleanup)
      ALTER TABLE riders 
      ALTER COLUMN user_id SET NOT NULL;
      
      RAISE NOTICE '✓ Set user_id column to NOT NULL';
    ELSE
      RAISE NOTICE '✓ user_id column already has NOT NULL constraint';
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Clear invalid rider_id references from orders table
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  invalid_orders_count INT;
BEGIN
  -- Count orders with rider_id that don't exist in users
  SELECT COUNT(*) INTO invalid_orders_count
  FROM orders
  WHERE rider_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.id = orders.rider_id
    );
  
  IF invalid_orders_count > 0 THEN
    RAISE WARNING '→ Found % orders with invalid rider_id', invalid_orders_count;
    
    -- Clear invalid rider_id (set to NULL)
    UPDATE orders
    SET rider_id = NULL
    WHERE rider_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = orders.rider_id
      );
    
    RAISE NOTICE '✓ Cleared invalid rider_id from % orders', invalid_orders_count;
  ELSE
    RAISE NOTICE '✓ All order rider_id references are valid';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 056 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'What this migration does:';
  RAISE NOTICE '  1. Removed riders with NULL user_id';
  RAISE NOTICE '  2. Removed riders with invalid user_id references';
  RAISE NOTICE '  3. Set user_id column to NOT NULL constraint';
  RAISE NOTICE '  4. Cleared invalid rider_id from orders table';
  RAISE NOTICE '';
  RAISE NOTICE 'RESULT:';
  RAISE NOTICE '  - riders table now has clean, valid data';
  RAISE NOTICE '  - All rider user_id values exist in users table';
  RAISE NOTICE '  - user_id cannot be NULL going forward';
  RAISE NOTICE '  - orders table has no invalid rider references';
  RAISE NOTICE '';
  RAISE NOTICE 'This prevents FK constraint violations when assigning riders!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
