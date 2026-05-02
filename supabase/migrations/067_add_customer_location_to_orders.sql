-- =============================================================================
-- Migration 067: Add Customer Location and Phone to Orders Table
-- =============================================================================
-- Purpose: Add missing columns that rider delivery system expects
-- 
-- Problem: Migration 065 (assign_rider_to_order function) expects:
--          - customer_phone
--          - customer_latitude  
--          - customer_longitude
--          But these columns don't exist in orders table!
--
-- Solution: Add these columns to orders table
-- =============================================================================

-- Add customer_phone column (alias for contact_number for consistency)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(20);
    COMMENT ON COLUMN orders.customer_phone IS 'Customer phone number for delivery orders';
    
    -- Copy data from contact_number if it exists
    UPDATE orders SET customer_phone = contact_number WHERE contact_number IS NOT NULL;
  END IF;
END $$;

-- Add customer_latitude column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_latitude'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_latitude DECIMAL(10,8);
    COMMENT ON COLUMN orders.customer_latitude IS 'Customer delivery location latitude (WGS84)';
  END IF;
END $$;

-- Add customer_longitude column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_longitude'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_longitude DECIMAL(11,8);
    COMMENT ON COLUMN orders.customer_longitude IS 'Customer delivery location longitude (WGS84)';
  END IF;
END $$;

-- Create index for geospatial queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_orders_customer_location 
ON orders(customer_latitude, customer_longitude)
WHERE customer_latitude IS NOT NULL AND customer_longitude IS NOT NULL;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 067: Add Customer Location to Orders - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Added columns to orders table:';
  RAISE NOTICE '  + customer_phone VARCHAR(20) - phone number for deliveries';
  RAISE NOTICE '  + customer_latitude DECIMAL(10,8) - delivery location lat';
  RAISE NOTICE '  + customer_longitude DECIMAL(11,8) - delivery location lng';
  RAISE NOTICE '';
  RAISE NOTICE 'These columns fix:';
  RAISE NOTICE '  - Phone number showing N/A in rider interface';
  RAISE NOTICE '  - Route map showing "Customer location not available"';
  RAISE NOTICE '  - assign_rider_to_order function errors';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Update order creation code to populate these columns!';
  RAISE NOTICE '================================================================';
END $$;
