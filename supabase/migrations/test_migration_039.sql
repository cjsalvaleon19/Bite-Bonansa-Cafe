-- ═══════════════════════════════════════════════════════════════════════════
-- Test Script for Migration 039: Legacy Function Cleanup
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to verify the migration worked correctly
-- ═══════════════════════════════════════════════════════════════════════════

-- Test 1: Verify legacy generate_order_number() function does NOT exist
SELECT 'Test 1: Check legacy function is dropped' AS test;
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ Legacy generate_order_number() function has been dropped'
    ELSE '✗ WARNING: Legacy generate_order_number() function still exists!'
  END AS result
FROM pg_proc
WHERE proname = 'generate_order_number';

-- Test 2: Verify generate_daily_order_number() function exists
SELECT 'Test 2: Check correct function exists' AS test;
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ generate_daily_order_number() function exists'
    ELSE '✗ ERROR: generate_daily_order_number() function does NOT exist!'
  END AS result
FROM pg_proc
WHERE proname = 'generate_daily_order_number';

-- Test 3: Verify generate_daily_order_number() returns VARCHAR
SELECT 'Test 3: Check function return type' AS test;
SELECT 
  proname AS function_name,
  pg_catalog.format_type(prorettype, NULL) AS return_type,
  CASE 
    WHEN pg_catalog.format_type(prorettype, NULL) LIKE '%varchar%' 
      OR pg_catalog.format_type(prorettype, NULL) LIKE '%character varying%'
    THEN '✓ Returns VARCHAR type'
    ELSE '✗ WARNING: Does not return VARCHAR type'
  END AS verification
FROM pg_proc
WHERE proname = 'generate_daily_order_number';

-- Test 4: Verify order_number column is VARCHAR(3)
SELECT 'Test 4: Check order_number column type' AS test;
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  CASE 
    WHEN data_type = 'character varying' AND character_maximum_length = 3
    THEN '✓ Column is VARCHAR(3) - correct!'
    ELSE '✗ WARNING: Column type mismatch - expected VARCHAR(3)'
  END AS verification
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name = 'order_number';

-- Test 5: Verify set_order_number() trigger function exists
SELECT 'Test 5: Check trigger function exists' AS test;
SELECT 
  proname AS function_name,
  pg_catalog.format_type(prorettype, NULL) AS return_type,
  CASE 
    WHEN pg_catalog.format_type(prorettype, NULL) = 'trigger'
    THEN '✓ Trigger function exists and returns TRIGGER type'
    ELSE '✗ WARNING: Trigger function issue'
  END AS verification
FROM pg_proc
WHERE proname = 'set_order_number';

-- Test 6: Verify trigger is configured correctly
SELECT 'Test 6: Check trigger configuration' AS test;
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  CASE 
    WHEN action_statement LIKE '%set_order_number%'
    THEN '✓ Trigger uses set_order_number() function'
    ELSE '✗ WARNING: Trigger may not be configured correctly'
  END AS verification
FROM information_schema.triggers
WHERE trigger_name = 'trg_set_order_number'
  AND event_object_table = 'orders';

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONAL TEST: Create a test order
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'Test 7: Functional test - Create order with auto-generated number' AS test;

DO $$
DECLARE
  test_user_id UUID;
  test_order_id UUID;
  generated_order_num VARCHAR(3);
BEGIN
  -- Get a valid user_id for testing
  SELECT id INTO test_user_id FROM users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'WARNING: No users found. Creating a test user...';
    INSERT INTO users (email, phone, role)
    VALUES ('test_migration_039@example.com', '1234567890', 'customer')
    RETURNING id INTO test_user_id;
  END IF;
  
  -- Insert test order without order_number (should auto-generate)
  BEGIN
    INSERT INTO orders (
      customer_id,
      order_mode,
      payment_method,
      status,
      items,
      total_amount
    ) VALUES (
      test_user_id,
      'dine-in',
      'cash',
      'pending',
      '[{"id": "test", "name": "Test Item", "price": 100, "quantity": 1}]'::jsonb,
      100.00
    ) RETURNING id, order_number INTO test_order_id, generated_order_num;
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'Test 7 Results: Order Creation Test';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ Order created successfully!';
    RAISE NOTICE 'Order ID: %', test_order_id;
    RAISE NOTICE 'Generated order_number: %', generated_order_num;
    RAISE NOTICE 'Order number length: % characters', LENGTH(generated_order_num);
    
    -- Validate format
    IF generated_order_num ~ '^\d{3}$' THEN
      RAISE NOTICE '✓ Order number format is valid (3 digits)';
    ELSE
      RAISE WARNING '✗ Order number format is INVALID: %', generated_order_num;
    END IF;
    
    IF LENGTH(generated_order_num) = 3 THEN
      RAISE NOTICE '✓ Order number length is correct (3 characters)';
    ELSE
      RAISE WARNING '✗ Order number length is INCORRECT: % characters (expected 3)', LENGTH(generated_order_num);
    END IF;
    
    -- Clean up test order
    DELETE FROM orders WHERE id = test_order_id;
    RAISE NOTICE 'Test order cleaned up';
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✗ ERROR creating order: %', SQLERRM;
      RAISE NOTICE 'Error details: %', SQLSTATE;
      RAISE NOTICE '';
      RAISE NOTICE 'This may indicate that the legacy function still exists or';
      RAISE NOTICE 'there is another issue with the order number generation.';
  END;
  
  -- Clean up test user if we created one
  IF EXISTS (SELECT 1 FROM users WHERE email = 'test_migration_039@example.com') THEN
    DELETE FROM users WHERE email = 'test_migration_039@example.com';
    RAISE NOTICE 'Test user cleaned up';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 039 Test Summary';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests completed. Review the output above to verify:';
  RAISE NOTICE '';
  RAISE NOTICE '1. ✓ Legacy generate_order_number() function dropped';
  RAISE NOTICE '2. ✓ generate_daily_order_number() function exists';
  RAISE NOTICE '3. ✓ Function returns VARCHAR type';
  RAISE NOTICE '4. ✓ order_number column is VARCHAR(3)';
  RAISE NOTICE '5. ✓ set_order_number() trigger function exists';
  RAISE NOTICE '6. ✓ Trigger is configured correctly';
  RAISE NOTICE '7. ✓ Order creation works without errors';
  RAISE NOTICE '';
  RAISE NOTICE 'If all checks passed, migration 039 is working correctly!';
  RAISE NOTICE 'Orders should now create successfully with 3-digit order numbers.';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
