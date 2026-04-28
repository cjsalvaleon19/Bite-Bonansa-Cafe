-- ============================================================================
-- Migration: 032_standardize_addon_variant_names
-- Description: Standardize all "Add-ons" variant type names to "Add Ons"
-- Created: 2026-04-28
-- 
-- This migration addresses:
-- - Delete all variant types named "Add-ons" (with hyphen) and retain "Add Ons" (with space)
-- - Ensures consistency across all menu items
-- ============================================================================

-- ============================================================================
-- STEP 1: Log current state for audit trail
-- ============================================================================
DO $$
DECLARE
  addons_count INTEGER;
  add_ons_count INTEGER;
BEGIN
  -- Count "Add-ons" variant types (with hyphen)
  SELECT COUNT(*) INTO addons_count
  FROM menu_item_variant_types
  WHERE variant_type_name = 'Add-ons';
  
  -- Count "Add Ons" variant types (with space)
  SELECT COUNT(*) INTO add_ons_count
  FROM menu_item_variant_types
  WHERE variant_type_name = 'Add Ons';
  
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'MIGRATION 032 - Standardize Add-on Variant Names';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '"Add-ons" (with hyphen) count: %', addons_count;
  RAISE NOTICE '"Add Ons" (with space) count: %', add_ons_count;
  RAISE NOTICE '================================================================';
END $$;

-- ============================================================================
-- STEP 2: Standardize variant type names
-- Strategy: For each menu item, if both "Add-ons" and "Add Ons" exist,
-- merge their options into "Add Ons" and delete "Add-ons"
-- If only "Add-ons" exists, rename it to "Add Ons"
-- ============================================================================
DO $$
DECLARE
  menu_item RECORD;
  addons_variant_id UUID;
  add_ons_variant_id UUID;
  option_record RECORD;
  merged_count INTEGER := 0;
  renamed_count INTEGER := 0;
BEGIN
  -- Loop through all menu items
  FOR menu_item IN 
    SELECT DISTINCT mb.id, mb.name
    FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    WHERE vt.variant_type_name IN ('Add-ons', 'Add Ons')
    ORDER BY mb.name
  LOOP
    -- Find "Add-ons" variant type for this item
    SELECT id INTO addons_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = menu_item.id
      AND variant_type_name = 'Add-ons'
    LIMIT 1;
    
    -- Find "Add Ons" variant type for this item
    SELECT id INTO add_ons_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = menu_item.id
      AND variant_type_name = 'Add Ons'
    LIMIT 1;
    
    -- Case 1: Both exist - merge options from "Add-ons" to "Add Ons"
    IF addons_variant_id IS NOT NULL AND add_ons_variant_id IS NOT NULL THEN
      RAISE NOTICE 'Menu item "%" has both "Add-ons" and "Add Ons" - merging', menu_item.name;
      
      -- Move options from "Add-ons" to "Add Ons" (only if they don't already exist)
      FOR option_record IN
        SELECT option_name, price_modifier, available, display_order
        FROM menu_item_variant_options
        WHERE variant_type_id = addons_variant_id
      LOOP
        -- Check if this option already exists in "Add Ons"
        IF NOT EXISTS (
          SELECT 1 FROM menu_item_variant_options
          WHERE variant_type_id = add_ons_variant_id
            AND option_name = option_record.option_name
        ) THEN
          -- Insert the option into "Add Ons"
          INSERT INTO menu_item_variant_options (
            variant_type_id, option_name, price_modifier, available, display_order
          ) VALUES (
            add_ons_variant_id, 
            option_record.option_name, 
            option_record.price_modifier, 
            option_record.available, 
            option_record.display_order
          );
          RAISE NOTICE '  - Moved option "%" from "Add-ons" to "Add Ons"', option_record.option_name;
        ELSE
          RAISE NOTICE '  - Option "%" already exists in "Add Ons", skipping', option_record.option_name;
        END IF;
      END LOOP;
      
      -- Delete all options from "Add-ons"
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id = addons_variant_id;
      
      -- Delete "Add-ons" variant type
      DELETE FROM menu_item_variant_types
      WHERE id = addons_variant_id;
      
      merged_count := merged_count + 1;
      RAISE NOTICE '  ✓ Deleted "Add-ons" variant type for "%"', menu_item.name;
      
    -- Case 2: Only "Add-ons" exists - rename it to "Add Ons"
    ELSIF addons_variant_id IS NOT NULL AND add_ons_variant_id IS NULL THEN
      RAISE NOTICE 'Menu item "%" has only "Add-ons" - renaming to "Add Ons"', menu_item.name;
      
      UPDATE menu_item_variant_types
      SET variant_type_name = 'Add Ons'
      WHERE id = addons_variant_id;
      
      renamed_count := renamed_count + 1;
      RAISE NOTICE '  ✓ Renamed "Add-ons" to "Add Ons" for "%"', menu_item.name;
    END IF;
    
    -- Reset for next iteration
    addons_variant_id := NULL;
    add_ons_variant_id := NULL;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Summary: Merged % items, Renamed % items', merged_count, renamed_count;
END $$;

-- ============================================================================
-- STEP 3: Verify no "Add-ons" variant types remain
-- ============================================================================
DO $$
DECLARE
  remaining_addons INTEGER;
  final_add_ons INTEGER;
BEGIN
  -- Count remaining "Add-ons" variant types
  SELECT COUNT(*) INTO remaining_addons
  FROM menu_item_variant_types
  WHERE variant_type_name = 'Add-ons';
  
  -- Count final "Add Ons" variant types
  SELECT COUNT(*) INTO final_add_ons
  FROM menu_item_variant_types
  WHERE variant_type_name = 'Add Ons';
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'MIGRATION 032 - VERIFICATION';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Remaining "Add-ons" (with hyphen): % (should be 0)', remaining_addons;
  RAISE NOTICE 'Final "Add Ons" (with space): %', final_add_ons;
  
  IF remaining_addons > 0 THEN
    RAISE EXCEPTION 'Migration failed: % "Add-ons" variant types still exist', remaining_addons;
  ELSE
    RAISE NOTICE '✓ SUCCESS: All "Add-ons" variant types have been standardized to "Add Ons"';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;
