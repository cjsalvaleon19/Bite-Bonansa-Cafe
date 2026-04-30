-- ============================================================================
-- Add variant_details column to order_items table
-- This stores the variant selections made for each order item as JSONB
-- Required for EOD Report and other features that need to display variants
-- ============================================================================

-- Add variant_details column to order_items if it doesn't exist
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS variant_details JSONB;

-- Add index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_order_items_variant_details 
ON order_items USING GIN (variant_details);

COMMENT ON COLUMN order_items.variant_details IS 'Variant selections for this item stored as JSONB (e.g., {"Size": "Large", "Temperature": "Iced"})';

-- Verification
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_items' 
    AND column_name = 'variant_details'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✓ SUCCESS: variant_details column added to order_items table';
  ELSE
    RAISE WARNING '⚠ WARNING: variant_details column was not added to order_items table';
  END IF;
END $$;
