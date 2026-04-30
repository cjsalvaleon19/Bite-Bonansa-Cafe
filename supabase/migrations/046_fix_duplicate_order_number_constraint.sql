-- ============================================================================
-- Fix Duplicate Order Number Constraint Issue
-- Remove global UNIQUE constraint on order_number since numbers reset daily
-- Add composite unique constraint for order_number + date if needed
-- ============================================================================

-- Drop the global unique constraint on order_number if it exists
-- This constraint causes duplicate key errors when order numbers reset daily
DO $$
DECLARE
  constraint_exists BOOLEAN;
  constraint_name TEXT;
BEGIN
  -- Check if a unique constraint exists on order_number
  SELECT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'orders' 
      AND c.contype = 'u'
      AND a.attname = 'order_number'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    -- Get the constraint name
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'orders' 
      AND c.contype = 'u'
      AND a.attname = 'order_number'
    LIMIT 1;
    
    -- Drop the constraint
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE '✓ Dropped global unique constraint on order_number: %', constraint_name;
  ELSE
    RAISE NOTICE 'ℹ No global unique constraint found on order_number';
  END IF;
END $$;

-- Create a partial unique index that allows the same order_number on different days
-- This ensures uniqueness within a single day while allowing daily resets
-- Using ::date cast instead of DATE() function because it's IMMUTABLE
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;

COMMENT ON INDEX idx_orders_order_number_date_unique IS 'Ensures order_number is unique per day (allows daily reset from 001)';

-- Verification
DO $$
DECLARE
  index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND indexname = 'idx_orders_order_number_date_unique'
  ) INTO index_exists;
  
  IF index_exists THEN
    RAISE NOTICE '✓ SUCCESS: Unique index on order_number per date created';
  ELSE
    RAISE WARNING '⚠ WARNING: Unique index was not created';
  END IF;
END $$;

-- ============================================================================
-- COMPLETION NOTICE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order Number Constraint Fix completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '✓ Removed global UNIQUE constraint on order_number';
  RAISE NOTICE '✓ Added unique index for order_number per date';
  RAISE NOTICE '';
  RAISE NOTICE 'This allows order numbers to reset daily (001, 002, 003...)';
  RAISE NOTICE 'while still preventing duplicate order numbers on the same day.';
  RAISE NOTICE '';
  RAISE NOTICE 'The error "duplicate key value violates unique constraint';
  RAISE NOTICE 'orders_order_number_key" should now be resolved.';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
