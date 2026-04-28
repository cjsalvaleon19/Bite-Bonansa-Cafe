-- ============================================================================
-- Migration: 028_cleanup_duplicate_menu_items_and_variants
-- Description: Remove duplicate menu items with old prices and duplicate variants
-- Created: 2026-04-28
-- 
-- This migration:
-- 1. Identifies and deletes duplicate menu items, keeping only the newest version
-- 2. Specifically handles Chicken Platter duplicate variants (old "Add-ons" vs new "Add Ons")
-- 3. Ensures only the correct, updated menu items and variants remain
-- ============================================================================

-- ============================================================================
-- STEP 1: Identify and log duplicate menu items for audit trail
-- ============================================================================
DO $$
DECLARE
  duplicate_count INTEGER;
  chicken_platter_count INTEGER;
BEGIN
  -- Count duplicate menu items
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT name, category
    FROM menu_items_base
    WHERE available = true
    GROUP BY name, category
    HAVING COUNT(*) > 1
  ) subquery;
  
  -- Count Chicken Platter entries
  SELECT COUNT(*) INTO chicken_platter_count
  FROM menu_items_base
  WHERE name = 'Chicken Platter';
  
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'CLEANUP MIGRATION 028 - Starting';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Duplicate menu item groups found: %', duplicate_count;
  RAISE NOTICE 'Chicken Platter entries found: %', chicken_platter_count;
  RAISE NOTICE '================================================================';
END $$;

-- ============================================================================
-- STEP 2: Delete old Chicken Platter variant options FIRST
-- ============================================================================
-- We need to delete variant options before variant types due to foreign key constraints
-- Delete old "Add-ons" variant options (from migration 012: Extra Rice, Gravy, Coleslaw)

DO $$
BEGIN
  RAISE NOTICE 'Deleting old Chicken Platter variant options...';
END $$;

-- Delete old "Add-ons" variant type options (Migration 012)
DELETE FROM menu_item_variant_options
WHERE variant_type_id IN (
  SELECT vt.id
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter'
    AND vt.variant_type_name = 'Add-ons'  -- Old variant type name (with lowercase 'ons')
);

-- Delete old "Flavor" variant options that are duplicates
-- Keep only the variants from the newer entry (migration 013)
-- The old Chicken Platter entry (₱249) will be identified by created_at timestamp
DELETE FROM menu_item_variant_options
WHERE variant_type_id IN (
  SELECT vt.id
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter'
    AND mb.base_price = 249.00  -- Old price from migration 012
    AND vt.variant_type_name = 'Flavor'
);

-- ============================================================================
-- STEP 3: Delete old Chicken Platter variant types
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Deleting old Chicken Platter variant types...';
END $$;

-- Delete the old "Add-ons" variant type (Migration 012)
DELETE FROM menu_item_variant_types
WHERE id IN (
  SELECT vt.id
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter'
    AND vt.variant_type_name = 'Add-ons'  -- Old variant type name
);

-- Delete variant types associated with old Chicken Platter (₱249)
DELETE FROM menu_item_variant_types
WHERE menu_item_id IN (
  SELECT id
  FROM menu_items_base
  WHERE name = 'Chicken Platter'
    AND base_price = 249.00  -- Old price
);

-- ============================================================================
-- STEP 4: Delete old Chicken Platter menu item (₱249)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Deleting old Chicken Platter menu item...';
END $$;

DELETE FROM menu_items_base
WHERE name = 'Chicken Platter'
  AND base_price = 249.00;  -- Keep only the ₱254 version

-- ============================================================================
-- STEP 5: Delete OTHER duplicate menu items (keep newest)
-- ============================================================================
-- For all other duplicate menu items, keep the one with the latest created_at
-- and highest base_price (assuming newer = updated price)

DO $$
BEGIN
  RAISE NOTICE 'Deleting other duplicate menu items...';
END $$;

-- First, delete variant options for old menu items
DELETE FROM menu_item_variant_options
WHERE variant_type_id IN (
  SELECT vt.id
  FROM menu_item_variant_types vt
  WHERE vt.menu_item_id IN (
    SELECT mb1.id
    FROM menu_items_base mb1
    WHERE EXISTS (
      SELECT 1
      FROM menu_items_base mb2
      WHERE mb2.name = mb1.name
        AND mb2.category = mb1.category
        AND mb2.id != mb1.id
        AND (
          mb2.created_at > mb1.created_at
          OR (mb2.created_at = mb1.created_at AND mb2.base_price > mb1.base_price)
          OR (mb2.created_at = mb1.created_at AND mb2.base_price = mb1.base_price AND mb2.id > mb1.id)
        )
    )
    AND mb1.name != 'Chicken Platter'  -- Already handled above
  )
);

-- Then delete variant types for old menu items
DELETE FROM menu_item_variant_types
WHERE menu_item_id IN (
  SELECT mb1.id
  FROM menu_items_base mb1
  WHERE EXISTS (
    SELECT 1
    FROM menu_items_base mb2
    WHERE mb2.name = mb1.name
      AND mb2.category = mb1.category
      AND mb2.id != mb1.id
      AND (
        mb2.created_at > mb1.created_at
        OR (mb2.created_at = mb1.created_at AND mb2.base_price > mb1.base_price)
        OR (mb2.created_at = mb1.created_at AND mb2.base_price = mb1.base_price AND mb2.id > mb1.id)
      )
  )
  AND mb1.name != 'Chicken Platter'  -- Already handled above
);

-- Finally, delete the old duplicate menu items themselves
DELETE FROM menu_items_base mb1
WHERE EXISTS (
  SELECT 1
  FROM menu_items_base mb2
  WHERE mb2.name = mb1.name
    AND mb2.category = mb1.category
    AND mb2.id != mb1.id
    AND (
      mb2.created_at > mb1.created_at
      OR (mb2.created_at = mb1.created_at AND mb2.base_price > mb1.base_price)
      OR (mb2.created_at = mb1.created_at AND mb2.base_price = mb1.base_price AND mb2.id > mb1.id)
    )
)
AND mb1.name != 'Chicken Platter';  -- Already handled above

-- ============================================================================
-- STEP 6: Cleanup orphaned data (just in case)
-- ============================================================================
-- Delete any orphaned variant types (types with no menu item)
DELETE FROM menu_item_variant_types
WHERE menu_item_id NOT IN (
  SELECT id FROM menu_items_base
);

-- Delete any orphaned variant options (options with no variant type)
DELETE FROM menu_item_variant_options
WHERE variant_type_id NOT IN (
  SELECT id FROM menu_item_variant_types
);

-- ============================================================================
-- STEP 7: Verification and Summary
-- ============================================================================
DO $$
DECLARE
  total_items INTEGER;
  duplicate_items INTEGER;
  chicken_platter_count INTEGER;
  chicken_variant_types INTEGER;
  chicken_variant_options INTEGER;
BEGIN
  -- Count metrics after cleanup
  SELECT COUNT(*) INTO total_items FROM menu_items_base WHERE available = true;
  
  SELECT COUNT(*) INTO duplicate_items FROM (
    SELECT name, category
    FROM menu_items_base
    WHERE available = true
    GROUP BY name, category
    HAVING COUNT(*) > 1
  ) subquery;
  
  SELECT COUNT(*) INTO chicken_platter_count
  FROM menu_items_base
  WHERE name = 'Chicken Platter';
  
  SELECT COUNT(DISTINCT vt.id) INTO chicken_variant_types
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter';
  
  SELECT COUNT(*) INTO chicken_variant_options
  FROM menu_item_variant_options vo
  JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter';

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'CLEANUP MIGRATION 028 - Complete';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Total available menu items: %', total_items;
  RAISE NOTICE 'Remaining duplicate menu items: % (should be 0)', duplicate_items;
  RAISE NOTICE 'Chicken Platter entries: % (should be 1)', chicken_platter_count;
  RAISE NOTICE 'Chicken Platter variant types: %', chicken_variant_types;
  RAISE NOTICE 'Chicken Platter variant options: %', chicken_variant_options;
  RAISE NOTICE '';
  
  IF duplicate_items = 0 AND chicken_platter_count = 1 THEN
    RAISE NOTICE '✓ All duplicates successfully removed';
    RAISE NOTICE '✓ Only updated menu items and variants remain';
  ELSE
    RAISE WARNING 'Some duplicates may still exist. Please investigate.';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;

-- ============================================================================
-- STEP 8: Display remaining Chicken Platter details for verification
-- ============================================================================
DO $$
DECLARE
  cp_price NUMERIC;
  cp_variant_summary TEXT;
BEGIN
  -- Get Chicken Platter price
  SELECT base_price INTO cp_price
  FROM menu_items_base
  WHERE name = 'Chicken Platter'
  LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE 'CHICKEN PLATTER VERIFICATION:';
  RAISE NOTICE 'Current price: ₱%', cp_price;
  RAISE NOTICE '';
  RAISE NOTICE 'Variant types and options:';
  
  -- This will be shown in the query results, not in NOTICE
END $$;

-- Show final Chicken Platter configuration
SELECT 
  mb.name as menu_item,
  mb.base_price,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  vo.option_name,
  vo.price_modifier,
  vo.available
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Platter'
ORDER BY vt.display_order, vo.display_order;
