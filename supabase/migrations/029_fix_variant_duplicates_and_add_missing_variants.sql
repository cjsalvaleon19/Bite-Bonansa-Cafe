-- ============================================================================
-- Migration: 029_fix_variant_duplicates_and_add_missing_variants
-- Description: Fix duplicate variant types and add missing variants
-- Created: 2026-04-28
-- 
-- This migration:
-- 1. Removes duplicate "Flavor" variant types for Chicken Platter (keep only the correct 7-option version)
-- 2. Deletes duplicate "Chicken Meal" (old price)
-- 3. Ensures Chicken Burger has exactly 8 flavors and adds "No Vegies" add-on
-- 4. Adds size variant (16oz/22oz) for Fruit Soda & Lemonade items
-- 5. Cleans up any other duplicate variant types across all menu items
-- ============================================================================

-- ============================================================================
-- STEP 1: Log current state for audit trail
-- ============================================================================
DO $$
DECLARE
  chicken_platter_flavor_types INTEGER;
  chicken_meal_count INTEGER;
BEGIN
  -- Count Chicken Platter "Flavor" variant types
  SELECT COUNT(*) INTO chicken_platter_flavor_types
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter'
    AND vt.variant_type_name = 'Flavor';
  
  -- Count Chicken Meal entries
  SELECT COUNT(*) INTO chicken_meal_count
  FROM menu_items_base
  WHERE name = 'Chicken Meal';
  
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'CLEANUP MIGRATION 029 - Starting';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Chicken Platter "Flavor" variant types: %', chicken_platter_flavor_types;
  RAISE NOTICE 'Chicken Meal entries: %', chicken_meal_count;
  RAISE NOTICE '================================================================';
END $$;

-- ============================================================================
-- STEP 2: Delete duplicate Chicken Platter "Flavor" variant type
-- ============================================================================
-- Keep only the variant type with 7 options (correct data)
-- Delete the one with 14 options (duplicate with wrong data)

DO $$
DECLARE
  variant_to_delete INTEGER;
  variant_to_keep INTEGER;
BEGIN
  -- Find the Flavor variant type with more than 7 options (the duplicate)
  SELECT vt.id INTO variant_to_delete
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter'
    AND vt.variant_type_name = 'Flavor'
    AND (
      SELECT COUNT(*) 
      FROM menu_item_variant_options 
      WHERE variant_type_id = vt.id
    ) > 7
  LIMIT 1;
  
  -- Find the Flavor variant type with exactly 7 options (the correct one)
  SELECT vt.id INTO variant_to_keep
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter'
    AND vt.variant_type_name = 'Flavor'
    AND (
      SELECT COUNT(*) 
      FROM menu_item_variant_options 
      WHERE variant_type_id = vt.id
    ) = 7
  LIMIT 1;
  
  IF variant_to_delete IS NOT NULL THEN
    RAISE NOTICE 'Deleting Chicken Platter Flavor variant type ID: %', variant_to_delete;
    RAISE NOTICE 'Keeping Chicken Platter Flavor variant type ID: %', variant_to_keep;
    
    -- Delete variant options first
    DELETE FROM menu_item_variant_options
    WHERE variant_type_id = variant_to_delete;
    
    -- Delete the variant type
    DELETE FROM menu_item_variant_types
    WHERE id = variant_to_delete;
  ELSE
    RAISE NOTICE 'No duplicate Flavor variant type found for Chicken Platter';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Delete duplicate "Chicken Meal" (keep only the newest/highest price)
-- ============================================================================

DO $$
DECLARE
  meals_deleted INTEGER;
BEGIN
  -- Delete older Chicken Meal entries, keep the newest one
  DELETE FROM menu_items_base mb1
  WHERE name = 'Chicken Meal'
    AND EXISTS (
      SELECT 1
      FROM menu_items_base mb2
      WHERE mb2.name = 'Chicken Meal'
        AND mb2.id != mb1.id
        AND (
          mb2.created_at > mb1.created_at
          OR (mb2.created_at = mb1.created_at AND mb2.base_price > mb1.base_price)
          OR (mb2.created_at = mb1.created_at AND mb2.base_price = mb1.base_price AND mb2.id > mb1.id)
        )
    );
  
  GET DIAGNOSTICS meals_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % old Chicken Meal entries', meals_deleted;
END $$;

-- ============================================================================
-- STEP 4: Fix Chicken Burger - ensure exactly 8 flavors
-- ============================================================================

DO $$
DECLARE
  chicken_burger_id INTEGER;
  flavor_variant_id INTEGER;
  addon_variant_id INTEGER;
  current_flavor_count INTEGER;
BEGIN
  -- Get Chicken Burger ID
  SELECT id INTO chicken_burger_id
  FROM menu_items_base
  WHERE name = 'Chicken Burger'
  LIMIT 1;
  
  IF chicken_burger_id IS NOT NULL THEN
    -- Get or create Flavor variant type
    SELECT id INTO flavor_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = chicken_burger_id
      AND variant_type_name = 'Flavor'
    LIMIT 1;
    
    IF flavor_variant_id IS NULL THEN
      INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
      VALUES (chicken_burger_id, 'Flavor', true, false, 1)
      RETURNING id INTO flavor_variant_id;
    END IF;
    
    -- Count current flavors
    SELECT COUNT(*) INTO current_flavor_count
    FROM menu_item_variant_options
    WHERE variant_type_id = flavor_variant_id;
    
    RAISE NOTICE 'Chicken Burger current flavor count: %', current_flavor_count;
    
    -- Delete all existing flavor options to start fresh
    DELETE FROM menu_item_variant_options
    WHERE variant_type_id = flavor_variant_id;
    
    -- Insert exactly 8 flavors
    INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
    VALUES 
      (flavor_variant_id, 'Honey Butter', 0, true, 1),
      (flavor_variant_id, 'Soy Garlic', 0, true, 2),
      (flavor_variant_id, 'Sweet & Sour', 0, true, 3),
      (flavor_variant_id, 'Sweet & Spicy', 0, true, 4),
      (flavor_variant_id, 'Teriyaki', 0, true, 5),
      (flavor_variant_id, 'Buffalo', 0, true, 6),
      (flavor_variant_id, 'Barbecue', 0, true, 7),
      (flavor_variant_id, 'Korean BBQ', 0, true, 8);
    
    -- Get or create Add Ons variant type
    SELECT id INTO addon_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = chicken_burger_id
      AND variant_type_name = 'Add Ons'
    LIMIT 1;
    
    IF addon_variant_id IS NULL THEN
      INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
      VALUES (chicken_burger_id, 'Add Ons', false, false, 2)
      RETURNING id INTO addon_variant_id;
    END IF;
    
    -- Check if "No Vegies" option exists
    IF NOT EXISTS (
      SELECT 1 FROM menu_item_variant_options
      WHERE variant_type_id = addon_variant_id
        AND option_name = 'No Vegies'
    ) THEN
      -- Add "No Vegies" option
      INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
      VALUES (addon_variant_id, 'No Vegies', 0, true, 1);
      
      RAISE NOTICE 'Added "No Vegies" option to Chicken Burger';
    END IF;
    
    RAISE NOTICE 'Fixed Chicken Burger: 8 flavors and "No Vegies" add-on';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Add Size variant for Fruit Soda & Lemonade items
-- ============================================================================

DO $$
DECLARE
  item RECORD;
  size_variant_id INTEGER;
BEGIN
  -- Loop through all Fruit Soda & Lemonade items
  FOR item IN 
    SELECT id, name, base_price
    FROM menu_items_base
    WHERE category = 'Fruit Soda & Lemonade'
  LOOP
    RAISE NOTICE 'Processing: %', item.name;
    
    -- Check if Size variant already exists
    SELECT id INTO size_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = item.id
      AND variant_type_name = 'Size'
    LIMIT 1;
    
    IF size_variant_id IS NULL THEN
      -- Create Size variant type
      INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
      VALUES (item.id, 'Size', true, false, 1)
      RETURNING id INTO size_variant_id;
      
      -- Add size options
      -- 16oz - base price (no modifier)
      -- 22oz - +15 pesos
      INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
      VALUES 
        (size_variant_id, '16oz', 0, true, 1),
        (size_variant_id, '22oz', 15, true, 2);
      
      -- Update has_variants flag
      UPDATE menu_items_base
      SET has_variants = true
      WHERE id = item.id;
      
      RAISE NOTICE 'Added Size variant (16oz/22oz) to: %', item.name;
    ELSE
      RAISE NOTICE 'Size variant already exists for: %', item.name;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Clean up duplicate variant types (same variant_type_name for same menu item)
-- ============================================================================

DO $$
DECLARE
  duplicate RECORD;
  types_to_keep INTEGER;
  types_to_delete INTEGER[];
BEGIN
  RAISE NOTICE 'Checking for duplicate variant types...';
  
  -- Find menu items with duplicate variant types
  FOR duplicate IN
    SELECT 
      menu_item_id,
      variant_type_name,
      COUNT(*) as type_count,
      ARRAY_AGG(id ORDER BY id DESC) as type_ids
    FROM menu_item_variant_types
    GROUP BY menu_item_id, variant_type_name
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent variant type (highest ID)
    types_to_keep := duplicate.type_ids[1];
    types_to_delete := duplicate.type_ids[2:array_length(duplicate.type_ids, 1)];
    
    RAISE NOTICE 'Found duplicate variant type "%" for menu_item_id %. Keeping ID %, deleting %', 
      duplicate.variant_type_name, duplicate.menu_item_id, types_to_keep, types_to_delete;
    
    -- Delete variant options for duplicate types
    DELETE FROM menu_item_variant_options
    WHERE variant_type_id = ANY(types_to_delete);
    
    -- Delete duplicate variant types
    DELETE FROM menu_item_variant_types
    WHERE id = ANY(types_to_delete);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: Verification and Summary
-- ============================================================================

DO $$
DECLARE
  chicken_platter_flavors INTEGER;
  chicken_meal_count INTEGER;
  chicken_burger_flavors INTEGER;
  chicken_burger_has_no_vegies BOOLEAN;
  fruit_soda_with_size INTEGER;
  duplicate_variant_types INTEGER;
BEGIN
  -- Count Chicken Platter flavor options
  SELECT COUNT(vo.id) INTO chicken_platter_flavors
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Chicken Platter'
    AND vt.variant_type_name = 'Flavor';
  
  -- Count Chicken Meal entries
  SELECT COUNT(*) INTO chicken_meal_count
  FROM menu_items_base
  WHERE name = 'Chicken Meal';
  
  -- Count Chicken Burger flavors
  SELECT COUNT(vo.id) INTO chicken_burger_flavors
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Chicken Burger'
    AND vt.variant_type_name = 'Flavor';
  
  -- Check if Chicken Burger has "No Vegies"
  SELECT EXISTS (
    SELECT 1
    FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Chicken Burger'
      AND vo.option_name = 'No Vegies'
  ) INTO chicken_burger_has_no_vegies;
  
  -- Count Fruit Soda items with Size variant
  SELECT COUNT(DISTINCT mb.id) INTO fruit_soda_with_size
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  WHERE mb.category = 'Fruit Soda & Lemonade'
    AND vt.variant_type_name = 'Size';
  
  -- Count remaining duplicate variant types
  SELECT COUNT(*) INTO duplicate_variant_types
  FROM (
    SELECT menu_item_id, variant_type_name
    FROM menu_item_variant_types
    GROUP BY menu_item_id, variant_type_name
    HAVING COUNT(*) > 1
  ) subquery;

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'CLEANUP MIGRATION 029 - Complete';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Chicken Platter flavor options: % (should be 7)', chicken_platter_flavors;
  RAISE NOTICE 'Chicken Meal entries: % (should be 1)', chicken_meal_count;
  RAISE NOTICE 'Chicken Burger flavor options: % (should be 8)', chicken_burger_flavors;
  RAISE NOTICE 'Chicken Burger has "No Vegies": % (should be true)', chicken_burger_has_no_vegies;
  RAISE NOTICE 'Fruit Soda items with Size variant: %', fruit_soda_with_size;
  RAISE NOTICE 'Remaining duplicate variant types: % (should be 0)', duplicate_variant_types;
  RAISE NOTICE '';
  
  IF chicken_platter_flavors = 7 
     AND chicken_meal_count = 1 
     AND chicken_burger_flavors = 8 
     AND chicken_burger_has_no_vegies 
     AND duplicate_variant_types = 0 THEN
    RAISE NOTICE '✓ All variant duplicates successfully removed';
    RAISE NOTICE '✓ All missing variants successfully added';
    RAISE NOTICE '✓ Menu data is clean and correct';
  ELSE
    RAISE WARNING 'Some issues may remain. Please review the counts above.';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;
