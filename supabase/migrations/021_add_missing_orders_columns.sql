-- ============================================================================
-- Add Missing Columns to Orders Table
-- Adds order_mode, order_number, customer_name, contact_number, customer_address
-- ============================================================================

-- Add order_mode column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'order_mode'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_mode VARCHAR(50);
    COMMENT ON COLUMN orders.order_mode IS 'Type of order: dine-in, take-out, pick-up, delivery';
  END IF;
END $$;

-- Add order_number column if it doesn't exist (for 4-digit daily numbers)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_number VARCHAR(10);
    COMMENT ON COLUMN orders.order_number IS '4-digit daily order number (e.g., 0001)';
  END IF;
END $$;

-- Add customer_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_name VARCHAR(255);
    COMMENT ON COLUMN orders.customer_name IS 'Customer full name from registration or walk-in';
  END IF;
END $$;

-- Add contact_number column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'contact_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN contact_number VARCHAR(20);
    COMMENT ON COLUMN orders.contact_number IS 'Customer contact number';
  END IF;
END $$;

-- Add customer_address column if it doesn't exist (separate from delivery_address)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_address TEXT;
    COMMENT ON COLUMN orders.customer_address IS 'Customer address for delivery orders';
  END IF;
END $$;

-- Create index on order_mode for filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_mode ON orders(order_mode);

-- Create index on order_number for searching
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Note: The generate_daily_order_number() function and trigger already exist from migration 017
-- We don't need to recreate them here. Migration 017 handles order number generation.
