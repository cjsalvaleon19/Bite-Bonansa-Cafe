-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Fix Order Number Trigger Function Type
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration fixes the error:
-- "ERROR: 42P17: function generate_daily_order_number must return type trigger"
-- 
-- The issue occurs when generate_daily_order_number() is incorrectly used
-- directly as a trigger function. It should only be called by set_order_number().
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop any incorrect trigger that might be using generate_daily_order_number directly
DROP TRIGGER IF EXISTS trg_set_order_number ON orders;

-- Ensure the set_order_number() trigger function exists with correct signature
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

-- Recreate the trigger using the correct trigger function
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION set_order_number();

-- Add helpful comment
COMMENT ON FUNCTION set_order_number() IS 'Trigger function that calls generate_daily_order_number() to set order_number on INSERT';

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order Number Trigger Fix completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'The trigger now correctly uses set_order_number() which';
  RAISE NOTICE 'returns TRIGGER type and calls generate_daily_order_number()';
  RAISE NOTICE '';
  RAISE NOTICE 'Trigger details:';
  RAISE NOTICE '- Trigger name: trg_set_order_number';
  RAISE NOTICE '- Trigger function: set_order_number()';
  RAISE NOTICE '- Helper function: generate_daily_order_number()';
  RAISE NOTICE '';
  RAISE NOTICE 'Test by inserting an order without order_number field';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
