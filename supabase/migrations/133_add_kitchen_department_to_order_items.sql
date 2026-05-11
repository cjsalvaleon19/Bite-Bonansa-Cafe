-- Migration 133: Add kitchen_department column to order_items
-- Purpose: Store the kitchen department string on each order line so that
--          the cashier print logic can split order slips per department even
--          for customer online orders (which do not carry the JSONB orders.items blob).

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS kitchen_department TEXT DEFAULT NULL;

COMMENT ON COLUMN order_items.kitchen_department IS
  'Kitchen department responsible for preparing this item (e.g. Drinks, Fryer 1, Fryer 2, Pastries). '
  'Copied from menu_items at order time so slips can be routed per department without a runtime join.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'kitchen_department'
  ) THEN
    RAISE NOTICE '✓ SUCCESS: kitchen_department column added to order_items table';
  ELSE
    RAISE WARNING '⚠ WARNING: kitchen_department column was not added to order_items table';
  END IF;
END
$$;
