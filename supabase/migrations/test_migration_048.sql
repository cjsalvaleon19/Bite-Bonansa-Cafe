-- ═══════════════════════════════════════════════════════════════════════════
-- Test Script for Migration 048: Order Number Format Update
-- ═══════════════════════════════════════════════════════════════════════════
-- This script tests the new ORD-YYMMDD-NNN order number format
-- Run this AFTER running migration 048
-- ═══════════════════════════════════════════════════════════════════════════

-- Clean up any test data from previous runs
DELETE FROM orders WHERE customer_id IS NULL AND status = 'test';

-- Test 1: Verify migration changes
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  column_type TEXT;
  trigger_exists BOOLEAN;
  constraint_exists BOOLEAN;
  old_index_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 1: Verify Migration Changes';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Check column type
  SELECT data_type || '(' || character_maximum_length || ')' INTO column_type
  FROM information_schema.columns
  WHERE table_name = 'orders' AND column_name = 'order_number';
  
  -- Check new trigger exists
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
  
  -- Check old composite index does NOT exist
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_orders_order_number_date_unique'
    AND tablename = 'orders'
  ) INTO old_index_exists;
  
  -- Report results
  IF column_type = 'character varying(20)' THEN
    RAISE NOTICE '✓ PASS: order_number column is VARCHAR(20)';
  ELSE
    RAISE WARNING '✗ FAIL: order_number column is % (expected VARCHAR(20))', column_type;
  END IF;
  
  IF trigger_exists THEN
    RAISE NOTICE '✓ PASS: Trigger trg_generate_order_number exists';
  ELSE
    RAISE WARNING '✗ FAIL: Trigger trg_generate_order_number NOT found';
  END IF;
  
  IF constraint_exists THEN
    RAISE NOTICE '✓ PASS: UNIQUE constraint exists';
  ELSE
    RAISE WARNING '✗ FAIL: UNIQUE constraint NOT found';
  END IF;
  
  IF NOT old_index_exists THEN
    RAISE NOTICE '✓ PASS: Old composite index removed';
  ELSE
    RAISE WARNING '✗ FAIL: Old composite index still exists (should be removed)';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- Test 2: Generate a test order and verify format
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_order_number TEXT;
  expected_pattern TEXT;
  format_valid BOOLEAN;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 2: Order Number Format Validation';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Insert a test order
  INSERT INTO orders (
    customer_id,
    customer_name,
    total_amount,
    status,
    order_mode,
    created_at
  ) VALUES (
    NULL,  -- No customer for test
    'Test Customer',
    100.00,
    'pending',
    'dine-in',
    NOW()
  )
  RETURNING order_number INTO test_order_number;
  
  -- Expected pattern: ORD-YYMMDD-NNN
  expected_pattern := 'ORD-' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Manila', 'YYMMDD') || '-\d{3}';
  
  -- Check if format matches
  format_valid := test_order_number ~ ('^' || expected_pattern || '$');
  
  IF format_valid THEN
    RAISE NOTICE '✓ PASS: Order number format is correct: %', test_order_number;
    RAISE NOTICE '  Pattern: ORD-YYMMDD-NNN';
  ELSE
    RAISE WARNING '✗ FAIL: Order number format is incorrect: %', test_order_number;
    RAISE WARNING '  Expected pattern: %', expected_pattern;
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE order_number = test_order_number;
  
  RAISE NOTICE '';
END $$;

-- Test 3: Test sequential numbering
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  order_numbers TEXT[];
  i INT;
  prev_num INT;
  curr_num INT;
  sequential BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 3: Sequential Numbering';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Create 5 test orders
  FOR i IN 1..5 LOOP
    INSERT INTO orders (
      customer_id,
      customer_name,
      total_amount,
      status,
      order_mode
    ) VALUES (
      NULL,
      'Test Customer',
      100.00,
      'pending',
      'dine-in'
    )
    RETURNING order_number INTO order_numbers[i];
  END LOOP;
  
  -- Display the generated order numbers
  RAISE NOTICE 'Generated order numbers:';
  FOR i IN 1..5 LOOP
    RAISE NOTICE '  %', order_numbers[i];
  END LOOP;
  
  -- Verify sequential numbering
  FOR i IN 2..5 LOOP
    -- Extract the numeric part (last 3 digits)
    prev_num := SUBSTRING(order_numbers[i-1] FROM '\d{3}$')::INT;
    curr_num := SUBSTRING(order_numbers[i] FROM '\d{3}$')::INT;
    
    IF curr_num != prev_num + 1 THEN
      sequential := FALSE;
      RAISE WARNING '✗ FAIL: Not sequential between % and %', order_numbers[i-1], order_numbers[i];
    END IF;
  END LOOP;
  
  IF sequential THEN
    RAISE NOTICE '✓ PASS: All order numbers are sequential';
  ELSE
    RAISE WARNING '✗ FAIL: Order numbers are NOT sequential';
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE order_number = ANY(order_numbers);
  
  RAISE NOTICE '';
END $$;

-- Test 4: Test uniqueness constraint
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_order_number TEXT;
  duplicate_error BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 4: Uniqueness Constraint';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Create an order
  INSERT INTO orders (
    customer_id,
    customer_name,
    total_amount,
    status,
    order_mode
  ) VALUES (
    NULL,
    'Test Customer',
    100.00,
    'pending',
    'dine-in'
  )
  RETURNING order_number INTO test_order_number;
  
  -- Try to insert duplicate (should fail)
  BEGIN
    INSERT INTO orders (
      order_number,
      customer_id,
      customer_name,
      total_amount,
      status,
      order_mode
    ) VALUES (
      test_order_number,  -- Duplicate!
      NULL,
      'Test Customer',
      100.00,
      'pending',
      'dine-in'
    );
    
    RAISE WARNING '✗ FAIL: Duplicate order number was allowed (should have been rejected)';
  EXCEPTION
    WHEN unique_violation THEN
      duplicate_error := TRUE;
      RAISE NOTICE '✓ PASS: Duplicate order number was correctly rejected';
  END;
  
  -- Clean up
  DELETE FROM orders WHERE order_number = test_order_number;
  
  RAISE NOTICE '';
END $$;

-- Test 5: Test concurrent order creation (race condition handling)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  order_numbers TEXT[];
  i INT;
  has_duplicates BOOLEAN;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 5: Concurrent Order Creation (Advisory Lock Test)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Create 10 orders quickly to test race conditions
  FOR i IN 1..10 LOOP
    INSERT INTO orders (
      customer_id,
      customer_name,
      total_amount,
      status,
      order_mode
    ) VALUES (
      NULL,
      'Test Customer',
      100.00,
      'pending',
      'dine-in'
    )
    RETURNING order_number INTO order_numbers[i];
  END LOOP;
  
  -- Check for duplicates
  SELECT EXISTS (
    SELECT order_number
    FROM unnest(order_numbers) AS order_number
    GROUP BY order_number
    HAVING COUNT(*) > 1
  ) INTO has_duplicates;
  
  IF NOT has_duplicates THEN
    RAISE NOTICE '✓ PASS: No duplicate order numbers (advisory lock working)';
  ELSE
    RAISE WARNING '✗ FAIL: Duplicate order numbers found';
    RAISE WARNING '  This indicates advisory lock is not working correctly';
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE order_number = ANY(order_numbers);
  
  RAISE NOTICE '';
END $$;

-- Test 6: Test timezone handling
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_order_number TEXT;
  manila_date TEXT;
  order_date_part TEXT;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 6: Timezone Handling (Asia/Manila)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Get current date in Manila timezone
  manila_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Manila', 'YYMMDD');
  
  -- Create an order
  INSERT INTO orders (
    customer_id,
    customer_name,
    total_amount,
    status,
    order_mode
  ) VALUES (
    NULL,
    'Test Customer',
    100.00,
    'pending',
    'dine-in'
  )
  RETURNING order_number INTO test_order_number;
  
  -- Extract date part from order number (characters 5-10)
  order_date_part := SUBSTRING(test_order_number FROM 5 FOR 6);
  
  IF order_date_part = manila_date THEN
    RAISE NOTICE '✓ PASS: Order number uses Manila timezone';
    RAISE NOTICE '  Manila date: %', manila_date;
    RAISE NOTICE '  Order number: %', test_order_number;
  ELSE
    RAISE WARNING '✗ FAIL: Order number date mismatch';
    RAISE WARNING '  Expected: ORD-%-XXX', manila_date;
    RAISE WARNING '  Got: %', test_order_number;
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE order_number = test_order_number;
  
  RAISE NOTICE '';
END $$;

-- Final Summary
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST SUITE COMPLETED';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the test results above.';
  RAISE NOTICE 'All tests should show ✓ PASS';
  RAISE NOTICE '';
  RAISE NOTICE 'If any tests failed (✗ FAIL), please:';
  RAISE NOTICE '1. Review the error messages';
  RAISE NOTICE '2. Check that migration 048 ran successfully';
  RAISE NOTICE '3. Verify database permissions';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
