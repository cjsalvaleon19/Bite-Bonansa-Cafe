-- ============================================================================
-- Test and Validate Migration 034 - Items Column
-- ============================================================================

-- Test 1: Verify items column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'items';

-- Expected Output:
-- column_name | data_type | is_nullable | column_default
-- items       | jsonb     | YES         | NULL


-- Test 2: Verify GIN index exists
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'orders' AND indexname = 'idx_orders_items_gin';

-- Expected Output:
-- indexname            | indexdef
-- idx_orders_items_gin | CREATE INDEX idx_orders_items_gin ON public.orders USING gin (items)


-- Test 3: Insert a test order with items (Optional - run only if safe)
-- UNCOMMENT ONLY IF YOU WANT TO TEST WITH ACTUAL DATA
/*
DO $$
DECLARE
  test_customer_id UUID;
  test_order_id UUID;
BEGIN
  -- Get a customer ID (or use a known test customer)
  SELECT id INTO test_customer_id FROM users LIMIT 1;
  
  IF test_customer_id IS NULL THEN
    RAISE EXCEPTION 'No customer found for testing. Please create a test user first.';
  END IF;
  
  -- Insert a test order
  INSERT INTO orders (
    customer_id,
    items,
    delivery_address,
    subtotal,
    total_amount,
    payment_method,
    status,
    order_mode
  ) VALUES (
    test_customer_id,
    '[
      {"id": "test-1", "name": "Test Item 1", "price": 100, "quantity": 2},
      {"id": "test-2", "name": "Test Item 2", "price": 50, "quantity": 1}
    ]'::jsonb,
    'Test Address',
    250.00,
    250.00,
    'cash',
    'order_in_queue',
    'dine-in'
  ) RETURNING id INTO test_order_id;
  
  RAISE NOTICE 'Test order created with ID: %', test_order_id;
  
  -- Query the test order to verify items column
  PERFORM * FROM orders WHERE id = test_order_id;
  
  RAISE NOTICE 'Test order verified successfully!';
  
  -- Clean up test data
  DELETE FROM orders WHERE id = test_order_id;
  RAISE NOTICE 'Test order cleaned up';
  
END $$;
*/


-- Test 4: Query to verify existing orders (if any) can have items added
SELECT 
  id,
  customer_id,
  items,
  total_amount,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 5;

-- If items column shows NULL for existing orders, that's expected
-- New orders from the POS will populate this column


-- Test 5: Check table structure
\d orders

-- This will show all columns including the new 'items' column


-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ items column exists with type jsonb
-- ✅ items column is nullable (allows existing orders to have NULL)
-- ✅ GIN index idx_orders_items_gin exists
-- ✅ Can insert orders with JSONB items data
-- ✅ Can query orders and access items column
