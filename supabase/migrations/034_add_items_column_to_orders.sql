-- ============================================================================
-- Add Missing 'items' Column to Orders Table
-- Fixes: "Could not find the 'items' column of 'orders' in the schema cache"
-- ============================================================================

-- The orders table is missing the 'items' column which stores order item data
-- This column should contain a JSONB array of {id, name, price, quantity}
-- This is required for the POS checkout functionality

-- Add items column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'items'
  ) THEN
    -- Add the column as JSONB
    ALTER TABLE orders ADD COLUMN items JSONB;
    
    COMMENT ON COLUMN orders.items IS 'Array of order items: {id, name, price, quantity}';
    
    -- Create a GIN index for efficient JSONB queries
    CREATE INDEX IF NOT EXISTS idx_orders_items_gin ON orders USING GIN (items);
    
    RAISE NOTICE 'Added items column to orders table';
  ELSE
    RAISE NOTICE 'items column already exists in orders table';
  END IF;
END $$;

-- Verify the column was added
DO $$
DECLARE
  col_exists BOOLEAN;
  col_type TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'items'
  ) INTO col_exists;
  
  IF col_exists THEN
    SELECT data_type INTO col_type
    FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'items';
    
    RAISE NOTICE 'Verification: items column exists with type: %', col_type;
  ELSE
    RAISE EXCEPTION 'VERIFICATION FAILED: items column was not created';
  END IF;
END $$;
