-- ============================================================================
-- Add served status to order_items table
-- This allows tracking individual item serving status for cashier monitoring
-- ============================================================================

-- Add served column to order_items if it doesn't exist
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS served BOOLEAN DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_order_items_served 
ON order_items(order_id, served);

COMMENT ON COLUMN order_items.served IS 'Indicates if this item has been served to the customer';

-- Verification
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_items' 
    AND column_name = 'served'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✓ SUCCESS: served column added to order_items table';
  ELSE
    RAISE WARNING '⚠ WARNING: served column was not added to order_items table';
  END IF;
END $$;
