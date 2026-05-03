-- ============================================================================
-- Fix Zero Delivery Fees in Orders Table
-- Fixes: Migration 068 added delivery_fee column with DEFAULT 0, causing
-- all existing orders to have delivery_fee = 0. Migration 069 only updated
-- NULL values, leaving 0 values unchanged. This causes billable delivery fee
-- to show ₱0.00 in rider billing portal.
-- ============================================================================

-- Update all delivery orders that have delivery_fee = 0 to the base fee of ₱30
-- This complements migration 069 which only handled NULL values
-- Note: This assumes 0 values are from the DEFAULT 0 when the column was added,
-- not intentional promotional free deliveries. If you have promotional free deliveries,
-- they should be marked differently (e.g., with a promo_code field)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Only update orders created before this migration runs
  -- This ensures we don't accidentally overwrite intentional 0 fees in the future
  UPDATE orders
  SET delivery_fee = 30
  WHERE order_mode = 'delivery'
    AND delivery_fee = 0
    AND created_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % delivery orders from 0 to base delivery_fee of 30', updated_count;
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
    RAISE WARNING 'Some delivery orders still have 0 or NULL delivery_fee. Please investigate.';
  ELSE
    RAISE NOTICE 'All delivery orders now have valid delivery_fee values!';
  END IF;
END $$;
