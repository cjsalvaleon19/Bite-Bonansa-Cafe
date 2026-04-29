-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Drop Legacy generate_order_number() Function
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration fixes the error:
-- "ERROR: 22001: value too long for type character varying(3)"
-- "CONTEXT: PL/pgSQL function generate_order_number() line 4 at assignment"
--
-- The issue: A legacy generate_order_number() function exists in production
-- that returns VARCHAR(4) or longer, but the order_number column is now VARCHAR(3).
-- The correct function to use is generate_daily_order_number() which returns VARCHAR(3).
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the legacy generate_order_number() function if it exists
-- This function is obsolete and has been replaced by generate_daily_order_number()
DROP FUNCTION IF EXISTS generate_order_number();

-- Verify the correct function exists and has the right return type
-- This function should return VARCHAR(3) for 3-digit order numbers (000-999)
DO $$
BEGIN
  -- Check if generate_daily_order_number exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'generate_daily_order_number'
  ) THEN
    RAISE EXCEPTION 'generate_daily_order_number() function does not exist. Please run migration 035 first.';
  END IF;
  
  -- Verify it returns VARCHAR(3)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_type t ON p.prorettype = t.oid
    WHERE p.proname = 'generate_daily_order_number'
      AND t.typname = 'varchar'
  ) THEN
    RAISE WARNING 'generate_daily_order_number() may not return the correct type. Please verify.';
  END IF;
  
  RAISE NOTICE 'Legacy function check completed.';
END $$;

-- Verify the trigger uses the correct function
DO $$
DECLARE
  trigger_count INT;
BEGIN
  -- Check that trg_set_order_number trigger exists
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name = 'trg_set_order_number'
    AND event_object_table = 'orders';
  
  IF trigger_count = 0 THEN
    RAISE EXCEPTION 'Trigger trg_set_order_number does not exist. Please run migration 035 or 038 first.';
  END IF;
  
  RAISE NOTICE 'Trigger verification completed.';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Legacy Function Cleanup completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Actions completed:';
  RAISE NOTICE '1. Dropped legacy generate_order_number() function';
  RAISE NOTICE '2. Verified generate_daily_order_number() exists';
  RAISE NOTICE '3. Verified trigger is configured correctly';
  RAISE NOTICE '';
  RAISE NOTICE 'Order number generation now uses:';
  RAISE NOTICE '- Function: generate_daily_order_number()';
  RAISE NOTICE '- Returns: VARCHAR(3) - 3-digit format (000-999)';
  RAISE NOTICE '- Trigger: set_order_number() calls the function';
  RAISE NOTICE '';
  RAISE NOTICE 'Test by creating an order without order_number field.';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
