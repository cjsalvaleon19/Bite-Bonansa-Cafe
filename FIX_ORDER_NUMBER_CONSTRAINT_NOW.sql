-- ============================================================================
-- CORRECTED FIX: Remove Global UNIQUE Constraint on order_number
-- This version has the syntax error fixed
-- ============================================================================

-- Step 1: Drop the problematic global unique constraint
DO $$
DECLARE
  constraint_exists BOOLEAN;
  constraint_name TEXT;
BEGIN
  -- Check if constraint exists
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
    RAISE NOTICE '✓ Dropped global unique constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'ℹ No global unique constraint found on order_number';
  END IF;
END $$;

-- Step 2: Create composite unique index (per-day uniqueness)
-- This allows order numbers to reset daily while preventing duplicates on same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;

-- Step 3: Verify the fix
DO $$
DECLARE
  old_constraint_exists BOOLEAN;
  new_index_exists BOOLEAN;
BEGIN
  -- Check if old constraint is gone
  SELECT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'orders' 
      AND c.contype = 'u'
      AND a.attname = 'order_number'
  ) INTO old_constraint_exists;
  
  -- Check if new index exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND indexname = 'idx_orders_order_number_date_unique'
  ) INTO new_index_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  IF NOT old_constraint_exists AND new_index_exists THEN
    RAISE NOTICE '✓✓✓ SUCCESS: Order number constraint fix completed! ✓✓✓';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ Global UNIQUE constraint removed';
    RAISE NOTICE '✓ Composite unique index created (per-day uniqueness)';
    RAISE NOTICE '';
    RAISE NOTICE 'Order numbers can now reset daily without errors.';
    RAISE NOTICE 'The duplicate key error should be resolved.';
  ELSE
    RAISE WARNING '⚠ Fix may not be complete:';
    IF old_constraint_exists THEN
      RAISE WARNING '  - Old constraint still exists - try running again';
    END IF;
    IF NOT new_index_exists THEN
      RAISE WARNING '  - New index was not created - check permissions';
    END IF;
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
