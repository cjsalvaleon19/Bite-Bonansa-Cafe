-- Migration 083: Fix stuck orders in customer queue and improve rider receipt data
-- This migration:
-- 1. Forces specific stuck orders to be marked as delivered
-- 2. Documents the fix for future reference

-- Step 1: Force update the three stuck orders to 'order_delivered' status
-- These orders are stuck in the customer's pending view even after clicking "Order Complete"
UPDATE orders
SET 
  status = 'order_delivered',
  delivered_at = COALESCE(delivered_at, NOW()),
  updated_at = NOW()
WHERE order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004')
  AND status != 'order_delivered';

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % stuck orders to order_delivered status', updated_count;
END $$;

-- Note: The rider receipt issue (item details not showing) will be fixed in the frontend code
-- by updating the DELIVERIES_SELECT_QUERY to include the order_items relation.
