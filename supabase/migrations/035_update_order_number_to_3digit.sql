-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Update Order Number to 3-Digit with Daily Reset
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration updates order number generation to use 3-digit format (000-999)
-- instead of 4-digit format (0001-9999), as per new requirements
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trg_set_order_number ON orders;

-- Update the function to generate 3-digit order numbers (000-999)
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

-- Update function comment
COMMENT ON FUNCTION generate_daily_order_number() IS 'Generates a 3-digit order number (000-999) that resets daily';

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

-- Update existing order numbers and column size
DO $$
BEGIN
  -- Check if order_number column exists and update size
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'order_number'
  ) THEN
    -- First, update any existing 4-digit order numbers to 3-digit by taking the last 3 digits
    -- This preserves the numeric sequence while fitting the new format
    UPDATE orders 
    SET order_number = RIGHT(order_number, 3)
    WHERE LENGTH(order_number) > 3;
    
    RAISE NOTICE 'Converted existing order numbers to 3-digit format';
    
    -- Now alter column to ensure it can store 3-digit values
    -- Use USING clause to handle any edge cases
    ALTER TABLE orders 
    ALTER COLUMN order_number TYPE VARCHAR(3)
    USING RIGHT(order_number, 3);
    
    RAISE NOTICE 'Updated order_number column to VARCHAR(3)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order Number Migration (3-digit) completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Order numbers will now be 3-digit (000-999) and reset daily';
  RAISE NOTICE 'Order numbers start at 000 each day';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test by creating a new order';
  RAISE NOTICE '2. Verify order_number starts at 000';
  RAISE NOTICE '3. Check that numbers are sequential (000, 001, 002...)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
