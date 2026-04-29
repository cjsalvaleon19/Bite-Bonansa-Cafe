-- ============================================================================
-- Add Order Completion and Delivery Timestamps
-- Adds timestamp columns to track when orders are completed or delivered
-- ============================================================================

-- Add completed_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_at TIMESTAMP;
    COMMENT ON COLUMN orders.completed_at IS 'Timestamp when order was marked as completed/served';
  END IF;
END $$;

-- Add out_for_delivery_at column if it doesn't exist (for delivery tracking)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'out_for_delivery_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN out_for_delivery_at TIMESTAMP;
    COMMENT ON COLUMN orders.out_for_delivery_at IS 'Timestamp when order was sent out for delivery or marked ready for pickup';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);
CREATE INDEX IF NOT EXISTS idx_orders_out_for_delivery_at ON orders(out_for_delivery_at);
