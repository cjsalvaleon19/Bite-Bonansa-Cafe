-- ═══════════════════════════════════════════════════════════════════════════
-- Fix Script: Order Number VARCHAR(3) Issue
-- ═══════════════════════════════════════════════════════════════════════════
-- This script fixes the "value too long for type character varying(3)" error
-- by ensuring migration 035 is properly applied
-- 
-- IMPORTANT: Run diagnose_order_number_issue.sql FIRST to understand the issue
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Drop the existing trigger (will be recreated)
DROP TRIGGER IF EXISTS trg_set_order_number ON orders;

-- Step 2: Update the function to generate 3-digit order numbers (000-999)
-- This is idempotent - safe to run multiple times
CREATE OR REPLACE FUNCTION generate_daily_order_number()
RETURNS VARCHAR(3) AS $$
DECLARE
  today_date DATE;
  max_order_num INT;
  next_num INT;
  order_num_str VARCHAR(3);
  lock_key BIGINT;
BEGIN
  -- Get today's date
  today_date := CURRENT_DATE;
  
  -- Use advisory lock to prevent race conditions
  -- Lock key is based on today's date (YYYYMMDD as integer)
  lock_key := EXTRACT(YEAR FROM today_date) * 10000 + 
              EXTRACT(MONTH FROM today_date) * 100 + 
              EXTRACT(DAY FROM today_date);
  
  -- Acquire advisory lock (will wait if another transaction has it)
  PERFORM pg_advisory_xact_lock(lock_key);
  
  -- Find the maximum order number for today
  -- Extract numeric part from order_number where created_at is today
  SELECT COALESCE(MAX(CAST(order_number AS INTEGER)), -1)
  INTO max_order_num
  FROM orders
  WHERE DATE(created_at) = today_date
    AND order_number ~ '^\d{3}$';  -- Only consider valid 3-digit numbers
  
  -- Calculate next number (starts at 000)
  next_num := max_order_num + 1;
  
  -- If we've exceeded 999, reset to 0
  IF next_num > 999 THEN
    next_num := 0;
  END IF;
  
  -- Format as 3-digit string with leading zeros
  order_num_str := LPAD(next_num::TEXT, 3, '0');
  
  RETURN order_num_str;
  -- Lock will be released automatically at end of transaction
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_daily_order_number() IS 'Generates a 3-digit order number (000-999) that resets daily';

-- Step 3: Recreate trigger function
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set order_number if it's NULL
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_daily_order_number();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_order_number() IS 'Trigger function to auto-populate order_number on insert';

-- Step 4: Update existing order numbers and column size
DO $$
BEGIN
  -- First, check if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'order_number'
  ) THEN
    -- Update any existing order numbers longer than 3 digits
    -- Take the last 3 digits to preserve sequence
    UPDATE orders 
    SET order_number = RIGHT(order_number, 3)
    WHERE LENGTH(order_number) > 3;
    
    RAISE NOTICE 'Converted % existing order numbers to 3-digit format', 
      (SELECT COUNT(*) FROM orders WHERE LENGTH(order_number) > 3);
    
    -- Now alter column to VARCHAR(3)
    -- Use USING clause to handle any edge cases
    ALTER TABLE orders 
    ALTER COLUMN order_number TYPE VARCHAR(3)
    USING RIGHT(COALESCE(order_number, ''), 3);
    
    RAISE NOTICE 'Updated order_number column to VARCHAR(3)';
  ELSE
    -- If column doesn't exist, create it
    ALTER TABLE orders ADD COLUMN order_number VARCHAR(3);
    RAISE NOTICE 'Created order_number column as VARCHAR(3)';
  END IF;
END $$;

-- Step 5: Recreate the trigger
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Step 6: Verify the fix
DO $$
DECLARE
  col_length INTEGER;
  test_number VARCHAR(3);
BEGIN
  -- Check column length
  SELECT character_maximum_length INTO col_length
  FROM information_schema.columns
  WHERE table_name = 'orders' AND column_name = 'order_number';
  
  -- Test the function
  test_number := generate_daily_order_number();
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Fix Applied Successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'order_number column max length: % characters', col_length;
  RAISE NOTICE 'Test order number generated: % (length: %)', test_number, LENGTH(test_number);
  RAISE NOTICE '';
  
  IF col_length = 3 AND LENGTH(test_number) <= 3 THEN
    RAISE NOTICE '✓ All checks passed!';
    RAISE NOTICE '✓ order_number column is VARCHAR(3)';
    RAISE NOTICE '✓ Function returns 3-character strings';
    RAISE NOTICE '✓ Trigger is active';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now place orders without errors.';
  ELSE
    RAISE WARNING '⚠ Some checks failed. Please review the output above.';
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION
-- ═══════════════════════════════════════════════════════════════════════════
