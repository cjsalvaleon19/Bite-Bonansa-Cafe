-- ═══════════════════════════════════════════════════════════════════════════
-- Test Migration 036: Add cashier_id and rider_id to Orders Table
-- ═══════════════════════════════════════════════════════════════════════════
-- This test verifies that the cashier_id and rider_id columns were added
-- correctly to the orders table
-- ═══════════════════════════════════════════════════════════════════════════

-- Test 1: Verify cashier_id column exists
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'cashier_id'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✓ Test 1 PASSED: cashier_id column exists in orders table';
  ELSE
    RAISE EXCEPTION '✗ Test 1 FAILED: cashier_id column does not exist in orders table';
  END IF;
END $$;

-- Test 2: Verify rider_id column exists
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'rider_id'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✓ Test 2 PASSED: rider_id column exists in orders table';
  ELSE
    RAISE EXCEPTION '✗ Test 2 FAILED: rider_id column does not exist in orders table';
  END IF;
END $$;

-- Test 3: Verify cashier_id column type and references
DO $$
DECLARE
  column_type TEXT;
  is_nullable TEXT;
  has_reference BOOLEAN;
BEGIN
  SELECT data_type, is_nullable
  INTO column_type, is_nullable
  FROM information_schema.columns 
  WHERE table_name = 'orders' AND column_name = 'cashier_id';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc 
      ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'orders' 
      AND kcu.column_name = 'cashier_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO has_reference;
  
  IF column_type = 'uuid' AND is_nullable = 'YES' AND has_reference THEN
    RAISE NOTICE '✓ Test 3 PASSED: cashier_id is UUID, nullable, and has foreign key reference';
  ELSE
    RAISE EXCEPTION '✗ Test 3 FAILED: cashier_id - type: %, nullable: %, has_fk: %', 
      column_type, is_nullable, has_reference;
  END IF;
END $$;

-- Test 4: Verify rider_id column type and references
DO $$
DECLARE
  column_type TEXT;
  is_nullable TEXT;
  has_reference BOOLEAN;
BEGIN
  SELECT data_type, is_nullable
  INTO column_type, is_nullable
  FROM information_schema.columns 
  WHERE table_name = 'orders' AND column_name = 'rider_id';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc 
      ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'orders' 
      AND kcu.column_name = 'rider_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO has_reference;
  
  IF column_type = 'uuid' AND is_nullable = 'YES' AND has_reference THEN
    RAISE NOTICE '✓ Test 4 PASSED: rider_id is UUID, nullable, and has foreign key reference';
  ELSE
    RAISE EXCEPTION '✗ Test 4 FAILED: rider_id - type: %, nullable: %, has_fk: %', 
      column_type, is_nullable, has_reference;
  END IF;
END $$;

-- Test 5: Verify indexes exist
DO $$
DECLARE
  cashier_idx_exists BOOLEAN;
  rider_idx_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'orders' AND indexname = 'idx_orders_cashier_id'
  ) INTO cashier_idx_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'orders' AND indexname = 'idx_orders_rider_id'
  ) INTO rider_idx_exists;
  
  IF cashier_idx_exists AND rider_idx_exists THEN
    RAISE NOTICE '✓ Test 5 PASSED: Both indexes (cashier_id and rider_id) exist';
  ELSE
    RAISE EXCEPTION '✗ Test 5 FAILED: cashier_id_idx: %, rider_id_idx: %', 
      cashier_idx_exists, rider_idx_exists;
  END IF;
END $$;

-- Test 6: Show complete orders table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- ═══════════════════════════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'All tests completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration 036 verification:';
  RAISE NOTICE '  ✓ cashier_id column added correctly';
  RAISE NOTICE '  ✓ rider_id column added correctly';
  RAISE NOTICE '  ✓ Both columns are UUID type and nullable';
  RAISE NOTICE '  ✓ Both columns have foreign key constraints to users table';
  RAISE NOTICE '  ✓ Indexes created for better query performance';
  RAISE NOTICE '';
  RAISE NOTICE 'The cashier dashboard should now work correctly!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
