-- ═══════════════════════════════════════════════════════════════════════════
-- Test Script for Order Number Trigger Fix
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to verify the trigger fix worked correctly
-- ═══════════════════════════════════════════════════════════════════════════

-- Test 1: Verify generate_daily_order_number() function exists and returns VARCHAR(3)
SELECT 
  proname AS function_name,
  pg_catalog.format_type(prorettype, NULL) AS return_type
FROM pg_proc
WHERE proname = 'generate_daily_order_number';
-- Expected: function_name = 'generate_daily_order_number', return_type = 'character varying'

-- Test 2: Verify set_order_number() function exists and returns TRIGGER
SELECT 
  proname AS function_name,
  pg_catalog.format_type(prorettype, NULL) AS return_type
FROM pg_proc
WHERE proname = 'set_order_number';
-- Expected: function_name = 'set_order_number', return_type = 'trigger'

-- Test 3: Verify the trigger exists and uses the correct function
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_set_order_number'
  AND event_object_table = 'orders';
-- Expected: trigger_name = 'trg_set_order_number', 
--           action_statement contains 'set_order_number()'

-- Test 4: Test that generate_daily_order_number() works when called directly
SELECT generate_daily_order_number() AS test_order_number;
-- Expected: Returns a 3-digit string like '000', '001', etc.

-- Test 5: Verify order_number column definition
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name = 'order_number';
-- Expected: data_type = 'character varying', character_maximum_length = 3, is_nullable = 'YES'

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONAL TESTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Test 6: Insert test order WITHOUT order_number (trigger should auto-generate)
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
    VALUES ('test_order_trigger@example.com', '1234567890', 'customer')
    RETURNING id INTO test_user_id;
  END IF;
  
  -- Insert test order without order_number
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
  RAISE NOTICE 'Test 6: Auto-generated order number';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order ID: %', test_order_id;
  RAISE NOTICE 'Generated order_number: %', generated_order_num;
  RAISE NOTICE 'Length: % characters', LENGTH(generated_order_num);
  
  -- Validate format
  IF generated_order_num ~ '^\d{3}$' THEN
    RAISE NOTICE '✓ Order number format is valid (3 digits)';
  ELSE
    RAISE WARNING '✗ Order number format is INVALID: %', generated_order_num;
  END IF;
  
  -- Clean up test order
  DELETE FROM orders WHERE id = test_order_id;
  RAISE NOTICE 'Test order cleaned up';
  RAISE NOTICE '';
  
  -- Clean up test user if we created one
  IF EXISTS (SELECT 1 FROM users WHERE email = 'test_order_trigger@example.com') THEN
    DELETE FROM users WHERE email = 'test_order_trigger@example.com';
    RAISE NOTICE 'Test user cleaned up';
  END IF;
END $$;

-- Test 7: Verify sequential numbering
DO $$
DECLARE
  test_user_id UUID;
  order_num_1 VARCHAR(3);
  order_num_2 VARCHAR(3);
  order_num_3 VARCHAR(3);
  order_id_1 UUID;
  order_id_2 UUID;
  order_id_3 UUID;
BEGIN
  -- Get a valid user_id
  SELECT id INTO test_user_id FROM users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    INSERT INTO users (email, phone, role)
    VALUES ('test_seq_trigger@example.com', '1234567890', 'customer')
    RETURNING id INTO test_user_id;
  END IF;
  
  -- Create 3 orders in sequence
  INSERT INTO orders (customer_id, order_mode, payment_method, status, items, total_amount)
  VALUES (test_user_id, 'dine-in', 'cash', 'pending', '[{"id":"1","name":"Item","price":10,"quantity":1}]'::jsonb, 10.00)
  RETURNING id, order_number INTO order_id_1, order_num_1;
  
  INSERT INTO orders (customer_id, order_mode, payment_method, status, items, total_amount)
  VALUES (test_user_id, 'dine-in', 'cash', 'pending', '[{"id":"1","name":"Item","price":10,"quantity":1}]'::jsonb, 10.00)
  RETURNING id, order_number INTO order_id_2, order_num_2;
  
  INSERT INTO orders (customer_id, order_mode, payment_method, status, items, total_amount)
  VALUES (test_user_id, 'dine-in', 'cash', 'pending', '[{"id":"1","name":"Item","price":10,"quantity":1}]'::jsonb, 10.00)
  RETURNING id, order_number INTO order_id_3, order_num_3;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Test 7: Sequential order numbers';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Order 1: %', order_num_1;
  RAISE NOTICE 'Order 2: %', order_num_2;
  RAISE NOTICE 'Order 3: %', order_num_3;
  
  -- Verify they are sequential
  IF order_num_2::int = order_num_1::int + 1 AND order_num_3::int = order_num_2::int + 1 THEN
    RAISE NOTICE '✓ Order numbers are sequential';
  ELSE
    RAISE WARNING '✗ Order numbers are NOT sequential';
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE id IN (order_id_1, order_id_2, order_id_3);
  RAISE NOTICE 'Test orders cleaned up';
  
  IF EXISTS (SELECT 1 FROM users WHERE email = 'test_seq_trigger@example.com') THEN
    DELETE FROM users WHERE email = 'test_seq_trigger@example.com';
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
  RAISE NOTICE 'Order Number Trigger Test Summary';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests completed. Review the output above to verify:';
  RAISE NOTICE '';
  RAISE NOTICE '1. generate_daily_order_number() returns VARCHAR(3) ✓';
  RAISE NOTICE '2. set_order_number() returns TRIGGER ✓';
  RAISE NOTICE '3. Trigger uses set_order_number() function ✓';
  RAISE NOTICE '4. Order numbers are auto-generated in 3-digit format ✓';
  RAISE NOTICE '5. Order numbers are sequential ✓';
  RAISE NOTICE '';
  RAISE NOTICE 'If all checks passed, the trigger is working correctly!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
