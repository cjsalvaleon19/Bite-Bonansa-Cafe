-- ============================================================================
-- Fix Zero Delivery Fees in Orders Table
-- Fixes: Migration 068 added delivery_fee column with DEFAULT 0, causing
-- all existing orders to have delivery_fee = 0. Migration 069 only updated
-- NULL values, leaving 0 values unchanged. This causes billable delivery fee
-- to show ₱0.00 in rider billing portal.
-- ============================================================================

-- Update all delivery orders that have delivery_fee = 0 to the base fee of ₱30
-- This complements migration 069 which only handled NULL values
-- 
-- Root cause: Migration 068 added delivery_fee column with DEFAULT 0, causing all 
-- existing orders to have delivery_fee = 0 instead of NULL. Migration 069 only 
-- updated NULL values, so the 0 values were left unchanged.
--
-- Safety: The POS code always sets a non-zero delivery_fee for delivery orders 
-- (either calculated or DELIVERY_FEE_DEFAULT=30). Therefore, any delivery order 
-- with delivery_fee = 0 is incorrect and should be updated.
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE orders
  SET delivery_fee = 30
  WHERE order_mode = 'delivery'
    AND delivery_fee = 0;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % delivery orders from delivery_fee=0 to delivery_fee=30', updated_count;
END $$;

-- Verify the fix
DO $$
DECLARE
  delivery_orders_count INTEGER;
  orders_with_positive_fee_count INTEGER;
  orders_with_zero_fee_count INTEGER;
  orders_with_null_fee_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO delivery_orders_count
  FROM orders
  WHERE order_mode = 'delivery';
  
  SELECT COUNT(*) INTO orders_with_positive_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee > 0;
  
  SELECT COUNT(*) INTO orders_with_zero_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee = 0;
  
  SELECT COUNT(*) INTO orders_with_null_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee IS NULL;
  
  RAISE NOTICE '=== Delivery Fee Status After Fix ===';
  RAISE NOTICE 'Total delivery orders: %', delivery_orders_count;
  RAISE NOTICE 'Orders with delivery_fee > 0: %', orders_with_positive_fee_count;
  RAISE NOTICE 'Orders with delivery_fee = 0: % (should be 0 for normal deliveries)', orders_with_zero_fee_count;
  RAISE NOTICE 'Orders with NULL delivery_fee: % (should be 0)', orders_with_null_fee_count;
  
  IF orders_with_zero_fee_count > 0 OR orders_with_null_fee_count > 0 THEN
    RAISE WARNING 'Found % orders with zero fees and % orders with NULL fees. Please investigate these orders.', 
      orders_with_zero_fee_count, orders_with_null_fee_count;
  ELSE
    RAISE NOTICE 'All delivery orders now have valid delivery_fee values!';
  END IF;
END $$;
