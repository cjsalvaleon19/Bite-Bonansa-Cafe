-- ============================================================================
-- Migration: 027_cleanup_invalid_variant_options
-- Description: Remove invalid and unavailable variant options from the system
-- Created: 2026-04-28
-- 
-- This migration:
-- 1. Deletes variant options that are marked as unavailable (available = false)
-- 2. Deletes orphaned variant types (variant types with no options)
-- 3. Ensures data integrity by removing variant options that shouldn't exist
-- ============================================================================

-- ============================================================================
-- STEP 1: Delete variant options marked as unavailable
-- ============================================================================
-- Rationale: If a variant option is marked as unavailable, it should not appear
-- in the system at all. These should be permanently deleted to avoid confusion.

DELETE FROM menu_item_variant_options
WHERE available = false;

-- ============================================================================
-- STEP 2: Delete orphaned variant types (variant types with no options)
-- ============================================================================
-- Rationale: A variant type without any options is useless and causes errors
-- when customers try to select variants.

DELETE FROM menu_item_variant_types
WHERE id NOT IN (
  SELECT DISTINCT variant_type_id 
  FROM menu_item_variant_options
);

-- ============================================================================
-- STEP 3: Update has_variants flag for items with no variant types
-- ============================================================================
-- Rationale: If all variant types were removed from an item, the has_variants
-- flag should be set to false.

UPDATE menu_items_base
SET has_variants = false
WHERE has_variants = true
  AND id NOT IN (
    SELECT DISTINCT menu_item_id 
    FROM menu_item_variant_types
  );

-- ============================================================================
-- STEP 4: Ensure all items with variant types have has_variants = true
-- ============================================================================
-- This is a safety check to ensure consistency

UPDATE menu_items_base
SET has_variants = true
WHERE id IN (
  SELECT DISTINCT menu_item_id 
  FROM menu_item_variant_types
)
AND (has_variants = false OR has_variants IS NULL);

-- ============================================================================
-- STEP 5: Create a constraint to prevent unavailable options in the future
-- ============================================================================
-- Note: We'll use a trigger instead of a CHECK constraint for flexibility

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS prevent_unavailable_variant_options ON menu_item_variant_options;
DROP FUNCTION IF EXISTS check_variant_option_availability();

-- Create function to check availability
CREATE OR REPLACE FUNCTION check_variant_option_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- If an option is being marked as unavailable, prevent the update
  -- Instead, the option should be deleted
  IF NEW.available = false AND OLD.available = true THEN
    RAISE EXCEPTION 'Cannot mark variant option as unavailable. Delete the option instead to prevent it from appearing in the system.';
  END IF;
  
  -- Prevent inserting unavailable options
  IF NEW.available = false THEN
    RAISE EXCEPTION 'Cannot create unavailable variant options. Only create options that should be available to customers.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER prevent_unavailable_variant_options
  BEFORE INSERT OR UPDATE ON menu_item_variant_options
  FOR EACH ROW
  EXECUTE FUNCTION check_variant_option_availability();

-- ============================================================================
-- STEP 6: Verification and Summary
-- ============================================================================

DO $$
DECLARE
  total_items INTEGER;
  items_with_variants INTEGER;
  total_variant_types INTEGER;
  total_variant_options INTEGER;
  orphaned_types INTEGER;
  items_mismatched INTEGER;
BEGIN
  -- Count various metrics
  SELECT COUNT(*) INTO total_items FROM menu_items_base WHERE available = true;
  SELECT COUNT(*) INTO items_with_variants FROM menu_items_base WHERE has_variants = true AND available = true;
  SELECT COUNT(*) INTO total_variant_types FROM menu_item_variant_types;
  SELECT COUNT(*) INTO total_variant_options FROM menu_item_variant_options;
  
  -- Count orphaned variant types (should be 0 after cleanup)
  SELECT COUNT(*) INTO orphaned_types
  FROM menu_item_variant_types vt
  LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE vo.id IS NULL;
  
  -- Count items with mismatched has_variants flag (should be 0 after cleanup)
  SELECT COUNT(*) INTO items_mismatched
  FROM menu_items_base mb
  WHERE (
    (mb.has_variants = true AND NOT EXISTS (
      SELECT 1 FROM menu_item_variant_types vt WHERE vt.menu_item_id = mb.id
    ))
    OR
    (mb.has_variants = false AND EXISTS (
      SELECT 1 FROM menu_item_variant_types vt WHERE vt.menu_item_id = mb.id
    ))
  );

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'VARIANT OPTIONS CLEANUP COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Total available menu items: %', total_items;
  RAISE NOTICE 'Items with variants: %', items_with_variants;
  RAISE NOTICE 'Total variant types: %', total_variant_types;
  RAISE NOTICE 'Total variant options (all available): %', total_variant_options;
  RAISE NOTICE '';
  RAISE NOTICE 'DATA INTEGRITY CHECKS:';
  RAISE NOTICE 'Orphaned variant types: % (should be 0)', orphaned_types;
  RAISE NOTICE 'Items with mismatched has_variants flag: % (should be 0)', items_mismatched;
  RAISE NOTICE '';
  
  IF orphaned_types = 0 AND items_mismatched = 0 THEN
    RAISE NOTICE '✓ All data integrity checks passed';
    RAISE NOTICE '✓ Trigger created to prevent unavailable options in the future';
    RAISE NOTICE '✓ Only valid, available variant options remain in the system';
  ELSE
    RAISE WARNING 'Some data integrity issues remain. Please investigate.';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;
