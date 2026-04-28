-- ============================================================================
-- Migration: 030_cleanup_duplicate_variant_options
-- Description: Clean up duplicate variant options (same option_name for same variant_type_id)
-- Created: 2026-04-28
-- 
-- This migration removes duplicate variant options that have the same
-- option_name for the same variant_type_id, keeping only the most recent one
-- (highest ID).
--
-- Examples of duplicates found:
-- - Calamares Sauce: Mayonnaise, Meaty Sauce, Sinamak (2 of each)
-- - Clubhouse Add-ons: Extra Bacon, Extra Cheese, Fries (2 of each)
-- - Fries Flavor: Cheese, Meaty Sauce, Sour Cream (2 of each)
-- - Siomai Spice Level: Regular, Spicy (3 of each)
-- - Waffles Variety: Blueberry, Chocolate, Nutella, Plain, Strawberry (2 of each)
-- ============================================================================

-- ============================================================================
-- STEP 1: Log current state for audit trail
-- ============================================================================
DO $$
DECLARE
  total_duplicate_options INTEGER;
BEGIN
  -- Count total duplicate variant options
  SELECT COUNT(*) INTO total_duplicate_options
  FROM (
    SELECT 
      variant_type_id,
      option_name,
      COUNT(*) as option_count
    FROM menu_item_variant_options
    GROUP BY variant_type_id, option_name
    HAVING COUNT(*) > 1
  ) duplicates;
  
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'CLEANUP MIGRATION 030 - Starting';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Duplicate variant option groups found: %', total_duplicate_options;
  RAISE NOTICE '================================================================';
END $$;

-- ============================================================================
-- STEP 2: Clean up duplicate variant options
-- ============================================================================
-- For each duplicate, keep the most recent option (highest ID) and delete the rest

DO $$
DECLARE
  duplicate RECORD;
  option_to_keep UUID;
  options_to_delete UUID[];
  deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Cleaning up duplicate variant options...';
  
  -- Find variant options with duplicates (same variant_type_id + option_name)
  FOR duplicate IN
    SELECT 
      variant_type_id,
      option_name,
      COUNT(*) as option_count,
      ARRAY_AGG(id ORDER BY id DESC) as option_ids
    FROM menu_item_variant_options
    GROUP BY variant_type_id, option_name
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent variant option (highest ID)
    option_to_keep := duplicate.option_ids[1];
    options_to_delete := duplicate.option_ids[2:array_length(duplicate.option_ids, 1)];
    
    RAISE NOTICE 'Found % duplicate(s) of option "%" for variant_type_id %. Keeping ID %, deleting %', 
      duplicate.option_count - 1, 
      duplicate.option_name, 
      duplicate.variant_type_id, 
      option_to_keep, 
      options_to_delete;
    
    -- Delete duplicate variant options
    DELETE FROM menu_item_variant_options
    WHERE id = ANY(options_to_delete);
    
    deleted_count := deleted_count + array_length(options_to_delete, 1);
  END LOOP;
  
  RAISE NOTICE 'Total duplicate variant options deleted: %', deleted_count;
END $$;

-- ============================================================================
-- STEP 3: Verify cleanup - should have no duplicates
-- ============================================================================
DO $$
DECLARE
  remaining_duplicates INTEGER;
BEGIN
  -- Count remaining duplicate variant options
  SELECT COUNT(*) INTO remaining_duplicates
  FROM (
    SELECT 
      variant_type_id,
      option_name,
      COUNT(*) as option_count
    FROM menu_item_variant_options
    GROUP BY variant_type_id, option_name
    HAVING COUNT(*) > 1
  ) duplicates;
  
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'CLEANUP MIGRATION 030 - Complete';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Remaining duplicate variant option groups: %', remaining_duplicates;
  
  IF remaining_duplicates > 0 THEN
    RAISE WARNING 'Still have % duplicate variant option groups!', remaining_duplicates;
  ELSE
    RAISE NOTICE 'SUCCESS: All duplicate variant options have been cleaned up!';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;
