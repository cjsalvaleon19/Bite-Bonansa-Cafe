-- ============================================================================
-- Migration 075: Backfill Missing Delivery Fees from Total
-- ============================================================================
-- Purpose: Fix delivery orders showing ₱0.00 delivery fee in EOD Report
-- Problem: Some delivery orders have delivery_fee=0 even though total includes the fee
-- Solution: Calculate delivery_fee from (total_amount - subtotal) for affected orders
-- ============================================================================

-- Update delivery orders where delivery_fee is 0 but total > subtotal
-- This indicates the delivery fee is included in total but not stored separately
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE orders
  SET delivery_fee = total_amount - subtotal
  WHERE order_mode = 'delivery'
    AND (delivery_fee = 0 OR delivery_fee IS NULL)
    AND total_amount > subtotal
    AND subtotal > 0; -- Ensure we have valid data
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % delivery orders with calculated delivery fee from total - subtotal', updated_count;
END $$;

-- Verify the fix
DO $$
DECLARE
  delivery_orders_count INTEGER;
  orders_with_fee_count INTEGER;
  orders_with_zero_fee_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO delivery_orders_count
  FROM orders
  WHERE order_mode = 'delivery';
  
  SELECT COUNT(*) INTO orders_with_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee > 0;
  
  SELECT COUNT(*) INTO orders_with_zero_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND (delivery_fee = 0 OR delivery_fee IS NULL);
  
  RAISE NOTICE '=== Delivery Fee Status After Backfill ===';
  RAISE NOTICE 'Total delivery orders: %', delivery_orders_count;
  RAISE NOTICE 'Orders with delivery_fee > 0: %', orders_with_fee_count;
  RAISE NOTICE 'Orders with delivery_fee = 0 or NULL: %', orders_with_zero_fee_count;
  
  IF orders_with_zero_fee_count > 0 THEN
    RAISE WARNING 'Still have % orders with zero/null fees. These may be test orders or have invalid data.', 
      orders_with_zero_fee_count;
  ELSE
    RAISE NOTICE 'All delivery orders now have valid delivery_fee values!';
  END IF;
END $$;

COMMENT ON COLUMN orders.delivery_fee IS 'Delivery fee charged to customer. Should be > 0 for delivery orders. Calculated from coordinates or defaults to ₱30.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 075: Backfill Missing Delivery Fees - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  + Calculated delivery_fee from (total - subtotal) for affected orders';
  RAISE NOTICE '  + Updated orders where delivery_fee was 0 but total > subtotal';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes: Delivery fee showing ₱0.00 in EOD Report';
  RAISE NOTICE '================================================================';
END $$;
