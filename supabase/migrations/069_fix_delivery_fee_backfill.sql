-- ============================================================================
-- Fix Delivery Fee Backfill for All Delivery Orders
-- Fixes: Migration 068 was too restrictive and only backfilled orders with
-- specific statuses, causing billable delivery fee to show ₱0.00 in rider
-- interface for orders with other statuses (pending, accepted, in_progress)
-- ============================================================================

-- Backfill delivery_fee for ALL delivery orders that are missing it
-- Set ₱30 as the base delivery fee (60% of ₱30 = ₱18 billable fee as expected)
-- Only update NULL values to preserve any explicit 0 values (e.g., promotional free deliveries)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE orders
  SET delivery_fee = 30
  WHERE order_mode = 'delivery'
    AND delivery_fee IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled delivery_fee for % additional delivery orders', updated_count;
END $$;

-- Verify the backfill
DO $$
DECLARE
  delivery_orders_count INTEGER;
  orders_with_fee_count INTEGER;
  orders_with_zero_fee_count INTEGER;
  orders_with_null_fee_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO delivery_orders_count
  FROM orders
  WHERE order_mode = 'delivery';
  
  SELECT COUNT(*) INTO orders_with_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee IS NOT NULL;
  
  SELECT COUNT(*) INTO orders_with_zero_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee = 0;
  
  SELECT COUNT(*) INTO orders_with_null_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee IS NULL;
  
  RAISE NOTICE 'Total delivery orders: %', delivery_orders_count;
  RAISE NOTICE 'Orders with delivery_fee set (including 0): %', orders_with_fee_count;
  RAISE NOTICE 'Orders with 0 delivery_fee: %', orders_with_zero_fee_count;
  RAISE NOTICE 'Orders with NULL delivery_fee (should be 0 after backfill): %', orders_with_null_fee_count;
END $$;
