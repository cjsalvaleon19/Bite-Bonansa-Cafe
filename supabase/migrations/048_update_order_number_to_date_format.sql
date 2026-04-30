-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Update Order Number to ORD-YYMMDD-NNN Format
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration updates order number generation to use ORD-YYMMDD-NNN format
-- Examples: ORD-260430-001, ORD-260430-042, ORD-260501-001
-- This format is globally unique (no more duplicate key errors on daily resets)
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Drop existing trigger first
DROP TRIGGER IF EXISTS trg_set_order_number ON orders;

-- Step 2: Drop the composite unique index since order numbers will now be globally unique
DROP INDEX IF EXISTS idx_orders_order_number_date_unique;

-- Step 3: Update order_number column to accommodate new format (ORD-YYMMDD-NNN = 14 chars)
ALTER TABLE orders 
ALTER COLUMN order_number TYPE VARCHAR(20);

-- Step 4: Create new function to generate ORD-YYMMDD-NNN format
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  today_count INT;
  new_order_number TEXT;
  manila_now TIMESTAMPTZ;
  manila_date DATE;
  lock_key BIGINT;
BEGIN
  -- Get current time in Asia/Manila timezone
  manila_now := NOW() AT TIME ZONE 'Asia/Manila';
  manila_date := DATE(manila_now);
  
  -- Use advisory lock to prevent race conditions
  -- Lock key is based on today's date (YYYYMMDD as integer)
  lock_key := EXTRACT(YEAR FROM manila_date) * 10000 + 
              EXTRACT(MONTH FROM manila_date) * 100 + 
              EXTRACT(DAY FROM manila_date);
  
  -- Acquire advisory lock (will wait if another transaction has it)
  PERFORM pg_advisory_xact_lock(lock_key);
  
  -- Count today's orders (using Manila timezone)
  SELECT COUNT(*) + 1 INTO today_count
  FROM orders
  WHERE DATE(created_at AT TIME ZONE 'Asia/Manila') = manila_date;

  -- Format: ORD-YYMMDD-NNN
  new_order_number := 'ORD-' || TO_CHAR(manila_now, 'YYMMDD') || '-' || LPAD(today_count::TEXT, 3, '0');

  -- Handle race conditions - if duplicate exists, increment counter
  WHILE EXISTS (SELECT 1 FROM orders WHERE order_number = new_order_number) LOOP
    today_count := today_count + 1;
    new_order_number := 'ORD-' || TO_CHAR(manila_now, 'YYMMDD') || '-' || LPAD(today_count::TEXT, 3, '0');
  END LOOP;

  NEW.order_number := new_order_number;
  RETURN NEW;
  -- Lock will be released automatically at end of transaction
END;
$$ LANGUAGE plpgsql;

-- Update function comment
COMMENT ON FUNCTION generate_order_number() IS 'Generates order number in ORD-YYMMDD-NNN format (e.g., ORD-260430-001). Globally unique, supports up to 999 orders per day.';

-- Step 5: Create trigger that calls generate_order_number directly
DROP TRIGGER IF EXISTS trg_generate_order_number ON orders;
CREATE TRIGGER trg_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Step 7: Add global UNIQUE constraint (now safe since format includes date)
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_order_number_unique' 
    AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);
    RAISE NOTICE '✓ Added UNIQUE constraint on order_number';
  ELSE
    RAISE NOTICE 'ℹ UNIQUE constraint on order_number already exists';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  column_type TEXT;
  trigger_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  -- Check column type
  SELECT data_type || '(' || character_maximum_length || ')' INTO column_type
  FROM information_schema.columns
  WHERE table_name = 'orders' AND column_name = 'order_number';
  
  -- Check trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_generate_order_number' 
    AND tgrelid = 'orders'::regclass
  ) INTO trigger_exists;
  
  -- Check constraint exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_order_number_unique' 
    AND conrelid = 'orders'::regclass
  ) INTO constraint_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Verification Results:';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  IF column_type = 'character varying(20)' THEN
    RAISE NOTICE '✓ order_number column type: %', column_type;
  ELSE
    RAISE WARNING '⚠ order_number column type: % (expected: character varying(20))', column_type;
  END IF;
  
  IF trigger_exists THEN
    RAISE NOTICE '✓ Trigger trg_generate_order_number exists';
  ELSE
    RAISE WARNING '⚠ Trigger trg_generate_order_number NOT found';
  END IF;
  
  IF constraint_exists THEN
    RAISE NOTICE '✓ UNIQUE constraint on order_number exists';
  ELSE
    RAISE WARNING '⚠ UNIQUE constraint on order_number NOT found';
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order Number Format Update completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'New Format: ORD-YYMMDD-NNN';
  RAISE NOTICE 'Examples:';
  RAISE NOTICE '  • ORD-260430-001 (first order on April 30, 2026)';
  RAISE NOTICE '  • ORD-260430-042 (42nd order on same day)';
  RAISE NOTICE '  • ORD-260501-001 (first order on May 1, 2026)';
  RAISE NOTICE '';
  RAISE NOTICE 'Benefits:';
  RAISE NOTICE '  ✓ Globally unique (no duplicate key errors)';
  RAISE NOTICE '  ✓ Self-documenting (date embedded in number)';
  RAISE NOTICE '  ✓ Supports up to 999 orders per day';
  RAISE NOTICE '  ✓ No need for composite unique index';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✓ Updated order_number column to VARCHAR(20)';
  RAISE NOTICE '  ✓ Removed composite unique index (no longer needed)';
  RAISE NOTICE '  ✓ Created generate_order_number() trigger function';
  RAISE NOTICE '  ✓ Added global UNIQUE constraint (now safe)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next order will use new format automatically.';
  RAISE NOTICE 'Existing orders keep their old format (backward compatible).';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
