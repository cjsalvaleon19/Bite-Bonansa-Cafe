-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 4-Digit Order Number with Daily Reset
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds:
-- 1. A function to generate 4-digit order numbers (0001-9999)
-- 2. Order numbers reset to 0001 every day
-- 3. Sequential numbering per day
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to generate the next 4-digit order number for today
CREATE OR REPLACE FUNCTION generate_daily_order_number()
RETURNS VARCHAR(4) AS $$
DECLARE
  today_date DATE;
  max_order_num INT;
  next_num INT;
  order_num_str VARCHAR(4);
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
    AND order_number ~ '^\d{4}$';  -- Only consider valid 4-digit numbers
  
  -- Calculate next number
  next_num := max_order_num + 1;
  
  -- If we've exceeded 9999, reset to 1
  IF next_num > 9999 THEN
    next_num := 1;
  END IF;
  
  -- Format as 4-digit string with leading zeros
  order_num_str := LPAD(next_num::TEXT, 4, '0');
  
  RETURN order_num_str;
  -- Lock will be released automatically at end of transaction
END;
$$ LANGUAGE plpgsql;

-- Add comment to function
COMMENT ON FUNCTION generate_daily_order_number() IS 'Generates a 4-digit order number (0001-9999) that resets daily';

-- Create trigger function to auto-populate order_number on insert
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_set_order_number ON orders;

-- Create trigger to auto-set order_number
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Add comment to trigger function
COMMENT ON FUNCTION set_order_number() IS 'Trigger function to auto-populate order_number on insert';

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order Number Migration completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Order numbers will now be 4-digit (0001-9999) and reset daily';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test by creating a new order';
  RAISE NOTICE '2. Verify order_number is auto-populated';
  RAISE NOTICE '3. Check that numbers are sequential';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
