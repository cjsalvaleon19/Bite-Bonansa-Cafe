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

-- Create or replace function to generate daily 4-digit order numbers
CREATE OR REPLACE FUNCTION generate_daily_order_number()
RETURNS TRIGGER AS $$
DECLARE
  today_start TIMESTAMP;
  today_end TIMESTAMP;
  max_order_num INT;
  new_order_num VARCHAR(10);
BEGIN
  -- Get today's date range
  today_start := DATE_TRUNC('day', NOW());
  today_end := today_start + INTERVAL '1 day';
  
  -- Find the maximum order number for today
  SELECT COALESCE(MAX(CAST(order_number AS INT)), 0) INTO max_order_num
  FROM orders
  WHERE created_at >= today_start 
    AND created_at < today_end
    AND order_number IS NOT NULL
    AND order_number ~ '^\d+$'; -- Only numeric order numbers
  
  -- Generate new order number (increment by 1, pad to 4 digits)
  new_order_num := LPAD((max_order_num + 1)::TEXT, 4, '0');
  
  -- Assign to the new row
  NEW.order_number := new_order_num;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_generate_order_number ON orders;

-- Create trigger to auto-generate order numbers on insert
CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_daily_order_number();

COMMENT ON FUNCTION generate_daily_order_number() IS 'Auto-generates 4-digit daily order numbers';
