-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Fix Order Number to Start at 001 Instead of 000
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration fixes the order number generation to start at 001 instead of 000
-- for the first order of the day
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trg_set_order_number ON orders;

-- Update the function to start order numbers at 001 instead of 000
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
  SELECT COALESCE(MAX(CAST(order_number AS INTEGER)), 0)
  INTO max_order_num
  FROM orders
  WHERE DATE(created_at) = today_date
    AND order_number ~ '^\d{3}$';  -- Only consider valid 3-digit numbers
  
  -- Calculate next number (starts at 001, not 000)
  next_num := max_order_num + 1;
  
  -- If we've exceeded 999, reset to 1
  IF next_num > 999 THEN
    next_num := 1;
  END IF;
  
  -- Format as 3-digit string with leading zeros
  order_num_str := LPAD(next_num::TEXT, 3, '0');
  
  RETURN order_num_str;
  -- Lock will be released automatically at end of transaction
END;
$$ LANGUAGE plpgsql;

-- Update function comment
COMMENT ON FUNCTION generate_daily_order_number() IS 'Generates a 3-digit order number (001-999) that resets daily, starting at 001';

-- Recreate trigger function (no changes needed)
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

-- Recreate trigger
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order Number Fix (Start at 001) completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Order numbers will now start at 001 (not 000) for the first order each day';
  RAISE NOTICE 'Order numbers are 3-digit (001-999) and reset daily';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test by creating a new order';
  RAISE NOTICE '2. Verify order_number starts at 001 for the first order of the day';
  RAISE NOTICE '3. Check that numbers are sequential (001, 002, 003...)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
