-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 061: Make customer_id nullable in users table
-- ═══════════════════════════════════════════════════════════════════════════
-- Issue: customer_id has NOT NULL constraint in users table, but riders and
--        cashiers don't need customer_id (only customers do).
-- Error: null value in column "customer_id" of relation "users" violates 
--        not-null constraint when creating rider/cashier users
-- Solution: Make customer_id nullable since not all user roles need it
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE 'Migration 061: Making customer_id nullable in users table';
END $$;

-- Step 1: Check if customer_id column exists and its current state
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_is_nullable TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'customer_id'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    SELECT is_nullable INTO v_is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'customer_id';
    
    RAISE NOTICE 'customer_id column exists. Currently nullable: %', v_is_nullable;
  ELSE
    RAISE NOTICE 'customer_id column does not exist yet';
  END IF;
END $$;

-- Step 2: Make customer_id nullable if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'customer_id'
  ) THEN
    -- Drop NOT NULL constraint if it exists
    ALTER TABLE public.users 
      ALTER COLUMN customer_id DROP NOT NULL;
    
    RAISE NOTICE '✓ customer_id is now nullable';
  ELSE
    RAISE NOTICE 'Skipping: customer_id column does not exist';
  END IF;
END $$;

-- Step 3: Verify the change
DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'customer_id'
  ) THEN
    SELECT is_nullable INTO v_is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'customer_id';
    
    IF v_is_nullable = 'YES' THEN
      RAISE NOTICE '✓ Verification successful: customer_id is nullable';
    ELSE
      RAISE EXCEPTION 'FAILED: customer_id is still NOT NULL';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 061 Complete';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '- customer_id column in users table is now nullable';
  RAISE NOTICE '- Riders, cashiers, and admins can now have NULL customer_id';
  RAISE NOTICE '- Only customer role users need a customer_id value';
  RAISE NOTICE '';
END $$;
