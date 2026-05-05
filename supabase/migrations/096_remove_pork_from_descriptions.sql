-- ============================================================================
-- Migration 096: Remove "pork" from menu item descriptions in live database
-- ============================================================================
-- The word "pork" was removed from seed/migration files but the live database
-- rows still contain old descriptions. This migration updates them directly.

-- Update menu_items_base table (used by variant-based menu system)
UPDATE menu_items_base
SET description = REPLACE(description, 'pork ', '')
WHERE description ILIKE '%pork%';

-- Update menu_items table (used by legacy/POS menu system)
UPDATE menu_items
SET description = REPLACE(description, 'pork ', '')
WHERE description ILIKE '%pork%';

-- Verify no "pork" remains
DO $$
DECLARE
  base_count INT;
  items_count INT;
BEGIN
  SELECT COUNT(*) INTO base_count FROM menu_items_base WHERE description ILIKE '%pork%';
  SELECT COUNT(*) INTO items_count FROM menu_items WHERE description ILIKE '%pork%';

  IF base_count > 0 OR items_count > 0 THEN
    RAISE WARNING 'Some rows still contain "pork" after migration: menu_items_base=%, menu_items=%', base_count, items_count;
  ELSE
    RAISE NOTICE 'Migration 096: All "pork" references successfully removed from menu descriptions.';
  END IF;
END $$;
