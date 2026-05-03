-- ============================================================================
-- Add delivery_fee Column to Orders Table and Backfill Existing Data
-- Fixes: Billable Delivery Fee showing ₱0.00 because delivery_fee column
-- was missing from orders table
-- ============================================================================

-- Add delivery_fee column to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN orders.delivery_fee IS 'Delivery fee charged to customer for delivery orders';
    RAISE NOTICE 'Added delivery_fee column to orders table';
  ELSE
    RAISE NOTICE 'delivery_fee column already exists in orders table';
  END IF;
END $$;

-- Create index on delivery_fee for reporting queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_fee ON orders(delivery_fee) WHERE delivery_fee > 0;

-- Backfill delivery_fee for existing delivery orders
-- Set ₱30 as the base delivery fee (60% of ₱30 = ₱18 billable fee as expected)
-- Only update NULL values to preserve any explicit 0 values (e.g., promotional free deliveries)
UPDATE orders
SET delivery_fee = 30
WHERE order_mode = 'delivery'
  AND delivery_fee IS NULL;

-- Log the number of records updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled delivery_fee for % existing delivery orders', updated_count;
END $$;

-- Verify the backfill
DO $$
DECLARE
  delivery_orders_count INTEGER;
  orders_with_fee_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO delivery_orders_count
  FROM orders
  WHERE order_mode = 'delivery';
  
  SELECT COUNT(*) INTO orders_with_fee_count
  FROM orders
  WHERE order_mode = 'delivery' AND delivery_fee > 0;
  
  RAISE NOTICE 'Total delivery orders: %, Orders with delivery_fee: %', 
    delivery_orders_count, orders_with_fee_count;
END $$;
