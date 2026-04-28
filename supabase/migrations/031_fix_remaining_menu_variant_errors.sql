-- ============================================================================
-- Migration: 031_fix_remaining_menu_variant_errors
-- Description: Fix remaining menu item variant errors
-- Created: 2026-04-28
-- 
-- This migration addresses the following issues:
-- 1. Fries: Remove duplicate Barbeque flavor (should only be 1)
-- 2. Spag Solo: Delete Garlic Bread, Extra Cheese, and Meatballs add-ons, keep only "Meaty Sauce"
-- 3. Samyang Carbonara & Chicken: Delete Extra Egg and Extra Cheese, keep Spam, Egg, and Cheese
-- 4. Chicken Burger: Delete Korean BBQ Flavor, add Original Flavor
-- 5. Delete Chicken Meal menu item entirely
-- 6. Footlong: Delete all Add Ons except "No Vegies"
-- 7. Clubhouse: Delete all Add Ons except "No Vegies" and "Spam"
-- 8. Waffles: Delete Plain and Nutella varieties, add Lotus Biscoff, Oreo, and Mallows
-- 9. All Frappe Series: Add Size and Add Ons variants
-- ============================================================================

-- ============================================================================
-- STEP 1: Log current state for audit trail
-- ============================================================================
DO $$
DECLARE
  fries_barbeque_count INTEGER;
  spag_solo_addons INTEGER;
  samyang_addons INTEGER;
  chicken_burger_flavors INTEGER;
  chicken_meal_count INTEGER;
  footlong_addons INTEGER;
  clubhouse_addons INTEGER;
  waffles_varieties INTEGER;
  frappe_with_size INTEGER;
  frappe_with_addons INTEGER;
BEGIN
  -- Count Fries Barbeque flavors
  SELECT COUNT(*) INTO fries_barbeque_count
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Fries' 
    AND vt.variant_type_name = 'Flavor' 
    AND vo.option_name = 'Barbeque';
  
  -- Count Spag Solo add-ons
  SELECT COUNT(*) INTO spag_solo_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Spag Solo' 
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Count Samyang add-ons
  SELECT COUNT(*) INTO samyang_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name LIKE 'Samyang%Carbonara%Chicken%'
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Count Chicken Burger flavors
  SELECT COUNT(*) INTO chicken_burger_flavors
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Chicken Burger' 
    AND vt.variant_type_name = 'Flavor';
  
  -- Count Chicken Meal entries
  SELECT COUNT(*) INTO chicken_meal_count
  FROM menu_items_base
  WHERE name = 'Chicken Meal';
  
  -- Count Footlong add-ons
  SELECT COUNT(*) INTO footlong_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Footlong' 
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Count Clubhouse add-ons
  SELECT COUNT(*) INTO clubhouse_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Clubhouse' 
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Count Waffles varieties
  SELECT COUNT(*) INTO waffles_varieties
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Waffles' 
    AND vt.variant_type_name = 'Variety';
  
  -- Count Frappe items with Size variant
  SELECT COUNT(DISTINCT mb.id) INTO frappe_with_size
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  WHERE mb.category = 'Frappe Series'
    AND vt.variant_type_name = 'Size';
  
  -- Count Frappe items with Add Ons variant
  SELECT COUNT(DISTINCT mb.id) INTO frappe_with_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  WHERE mb.category = 'Frappe Series'
    AND vt.variant_type_name = 'Add Ons';
  
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'MIGRATION 031 - Starting';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Fries Barbeque flavor count: % (should be 1)', fries_barbeque_count;
  RAISE NOTICE 'Spag Solo add-ons count: %', spag_solo_addons;
  RAISE NOTICE 'Samyang Carbonara & Chicken add-ons count: %', samyang_addons;
  RAISE NOTICE 'Chicken Burger flavors count: %', chicken_burger_flavors;
  RAISE NOTICE 'Chicken Meal entries: % (will be deleted)', chicken_meal_count;
  RAISE NOTICE 'Footlong add-ons count: %', footlong_addons;
  RAISE NOTICE 'Clubhouse add-ons count: %', clubhouse_addons;
  RAISE NOTICE 'Waffles varieties count: %', waffles_varieties;
  RAISE NOTICE 'Frappe items with Size variant: %', frappe_with_size;
  RAISE NOTICE 'Frappe items with Add Ons variant: %', frappe_with_addons;
  RAISE NOTICE '================================================================';
END $$;

-- ============================================================================
-- STEP 2: Fix Fries - Remove duplicate Barbeque flavor
-- ============================================================================
DO $$
DECLARE
  fries_id UUID;
  flavor_variant_id UUID;
  barbeque_to_keep UUID;
  barbeque_to_delete UUID[];
BEGIN
  -- Get Fries menu item ID
  SELECT id INTO fries_id
  FROM menu_items_base
  WHERE name = 'Fries'
  LIMIT 1;
  
  IF fries_id IS NOT NULL THEN
    -- Get Flavor variant type ID
    SELECT id INTO flavor_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = fries_id
      AND variant_type_name = 'Flavor'
    LIMIT 1;
    
    IF flavor_variant_id IS NOT NULL THEN
      -- Find duplicate Barbeque flavors
      SELECT 
        ARRAY_AGG(id ORDER BY id DESC) INTO barbeque_to_delete
      FROM menu_item_variant_options
      WHERE variant_type_id = flavor_variant_id
        AND option_name = 'Barbeque';
      
      -- Keep the most recent one (highest ID), delete the rest
      IF array_length(barbeque_to_delete, 1) > 1 THEN
        barbeque_to_keep := barbeque_to_delete[1];
        barbeque_to_delete := barbeque_to_delete[2:array_length(barbeque_to_delete, 1)];
        
        DELETE FROM menu_item_variant_options
        WHERE id = ANY(barbeque_to_delete);
        
        RAISE NOTICE 'Deleted % duplicate Barbeque flavor(s) for Fries, keeping ID %', 
          array_length(barbeque_to_delete, 1), barbeque_to_keep;
      ELSE
        RAISE NOTICE 'Fries: Only 1 Barbeque flavor found, no duplicates to remove';
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Fix Spag Solo - Keep only "Meaty Sauce" add-on
-- ============================================================================
DO $$
DECLARE
  spag_solo_id UUID;
  addon_variant_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Get Spag Solo menu item ID
  SELECT id INTO spag_solo_id
  FROM menu_items_base
  WHERE name = 'Spag Solo'
  LIMIT 1;
  
  IF spag_solo_id IS NOT NULL THEN
    -- Get Add Ons variant type ID
    SELECT id INTO addon_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = spag_solo_id
      AND variant_type_name ILIKE '%Add%'
    LIMIT 1;
    
    IF addon_variant_id IS NOT NULL THEN
      -- Delete all add-ons except "Meaty Sauce"
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id = addon_variant_id
        AND option_name NOT IN ('Meaty Sauce');
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE 'Spag Solo: Deleted % add-ons (kept only Meaty Sauce)', deleted_count;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Fix Samyang Carbonara & Chicken - Keep Spam, Egg, and Cheese only
-- ============================================================================
DO $$
DECLARE
  samyang_id UUID;
  addon_variant_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Get Samyang Carbonara & Chicken menu item ID
  SELECT id INTO samyang_id
  FROM menu_items_base
  WHERE name LIKE 'Samyang%Carbonara%Chicken%'
  LIMIT 1;
  
  IF samyang_id IS NOT NULL THEN
    -- Get Add Ons variant type ID
    SELECT id INTO addon_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = samyang_id
      AND variant_type_name ILIKE '%Add%'
    LIMIT 1;
    
    IF addon_variant_id IS NOT NULL THEN
      -- Delete all add-ons except Spam, Egg, and Cheese
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id = addon_variant_id
        AND option_name NOT IN ('Spam', 'Egg', 'Cheese');
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE 'Samyang Carbonara & Chicken: Deleted % add-ons (kept Spam, Egg, Cheese)', deleted_count;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Fix Chicken Burger - Delete Korean BBQ, add Original Flavor
-- ============================================================================
DO $$
DECLARE
  chicken_burger_id UUID;
  flavor_variant_id UUID;
  original_exists BOOLEAN;
BEGIN
  -- Get Chicken Burger menu item ID
  SELECT id INTO chicken_burger_id
  FROM menu_items_base
  WHERE name = 'Chicken Burger'
  LIMIT 1;
  
  IF chicken_burger_id IS NOT NULL THEN
    -- Get Flavor variant type ID
    SELECT id INTO flavor_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = chicken_burger_id
      AND variant_type_name = 'Flavor'
    LIMIT 1;
    
    IF flavor_variant_id IS NOT NULL THEN
      -- Delete Korean BBQ flavor
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id = flavor_variant_id
        AND option_name = 'Korean BBQ';
      
      RAISE NOTICE 'Chicken Burger: Deleted Korean BBQ flavor';
      
      -- Check if Original flavor already exists
      SELECT EXISTS (
        SELECT 1 FROM menu_item_variant_options
        WHERE variant_type_id = flavor_variant_id
          AND option_name = 'Original'
      ) INTO original_exists;
      
      -- Add Original flavor if it doesn't exist
      IF NOT original_exists THEN
        INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
        VALUES (flavor_variant_id, 'Original', 0, true, 1);
        
        RAISE NOTICE 'Chicken Burger: Added Original flavor';
      ELSE
        RAISE NOTICE 'Chicken Burger: Original flavor already exists';
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Delete Chicken Meal menu item entirely
-- ============================================================================
DO $$
DECLARE
  chicken_meal_ids UUID[];
  meal_id UUID;
  deleted_count INTEGER := 0;
BEGIN
  -- Get all Chicken Meal IDs
  SELECT ARRAY_AGG(id) INTO chicken_meal_ids
  FROM menu_items_base
  WHERE name = 'Chicken Meal';
  
  IF chicken_meal_ids IS NOT NULL THEN
    -- Loop through each Chicken Meal entry
    FOREACH meal_id IN ARRAY chicken_meal_ids
    LOOP
      -- Delete variant options first
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id IN (
        SELECT id FROM menu_item_variant_types
        WHERE menu_item_id = meal_id
      );
      
      -- Delete variant types
      DELETE FROM menu_item_variant_types
      WHERE menu_item_id = meal_id;
      
      -- Delete the menu item
      DELETE FROM menu_items_base
      WHERE id = meal_id;
      
      deleted_count := deleted_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Deleted % Chicken Meal menu item(s)', deleted_count;
  ELSE
    RAISE NOTICE 'No Chicken Meal items found to delete';
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Fix Footlong - Keep only "No Vegies" add-on
-- ============================================================================
DO $$
DECLARE
  footlong_id UUID;
  addon_variant_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Get Footlong menu item ID
  SELECT id INTO footlong_id
  FROM menu_items_base
  WHERE name = 'Footlong'
  LIMIT 1;
  
  IF footlong_id IS NOT NULL THEN
    -- Get Add Ons variant type ID
    SELECT id INTO addon_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = footlong_id
      AND variant_type_name ILIKE '%Add%'
    LIMIT 1;
    
    IF addon_variant_id IS NOT NULL THEN
      -- Delete all add-ons except "No Vegies"
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id = addon_variant_id
        AND option_name NOT IN ('No Vegies');
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE 'Footlong: Deleted % add-ons (kept only No Vegies)', deleted_count;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Fix Clubhouse - Keep only "No Vegies" and "Spam" add-ons
-- ============================================================================
DO $$
DECLARE
  clubhouse_id UUID;
  addon_variant_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Get Clubhouse menu item ID
  SELECT id INTO clubhouse_id
  FROM menu_items_base
  WHERE name = 'Clubhouse'
  LIMIT 1;
  
  IF clubhouse_id IS NOT NULL THEN
    -- Get Add Ons variant type ID
    SELECT id INTO addon_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = clubhouse_id
      AND variant_type_name ILIKE '%Add%'
    LIMIT 1;
    
    IF addon_variant_id IS NOT NULL THEN
      -- Delete all add-ons except "No Vegies" and "Spam"
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id = addon_variant_id
        AND option_name NOT IN ('No Vegies', 'Spam');
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE 'Clubhouse: Deleted % add-ons (kept No Vegies and Spam)', deleted_count;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 9: Fix Waffles - Replace varieties
-- ============================================================================
DO $$
DECLARE
  waffles_id UUID;
  variety_variant_id UUID;
  deleted_count INTEGER;
  lotus_exists BOOLEAN;
  oreo_exists BOOLEAN;
  mallows_exists BOOLEAN;
BEGIN
  -- Get Waffles menu item ID
  SELECT id INTO waffles_id
  FROM menu_items_base
  WHERE name = 'Waffles'
  LIMIT 1;
  
  IF waffles_id IS NOT NULL THEN
    -- Get Variety variant type ID
    SELECT id INTO variety_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = waffles_id
      AND variant_type_name = 'Variety'
    LIMIT 1;
    
    IF variety_variant_id IS NOT NULL THEN
      -- Delete Plain and Nutella varieties
      DELETE FROM menu_item_variant_options
      WHERE variant_type_id = variety_variant_id
        AND option_name IN ('Plain', 'Nutella');
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE 'Waffles: Deleted % varieties (Plain and Nutella)', deleted_count;
      
      -- Check if new varieties already exist
      SELECT EXISTS (
        SELECT 1 FROM menu_item_variant_options
        WHERE variant_type_id = variety_variant_id
          AND option_name = 'Lotus Biscoff'
      ) INTO lotus_exists;
      
      SELECT EXISTS (
        SELECT 1 FROM menu_item_variant_options
        WHERE variant_type_id = variety_variant_id
          AND option_name = 'Oreo'
      ) INTO oreo_exists;
      
      SELECT EXISTS (
        SELECT 1 FROM menu_item_variant_options
        WHERE variant_type_id = variety_variant_id
          AND option_name = 'Mallows'
      ) INTO mallows_exists;
      
      -- Add new varieties if they don't exist
      IF NOT lotus_exists THEN
        INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
        VALUES (variety_variant_id, 'Lotus Biscoff', 0, true, 100);
        RAISE NOTICE 'Waffles: Added Lotus Biscoff variety';
      END IF;
      
      IF NOT oreo_exists THEN
        INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
        VALUES (variety_variant_id, 'Oreo', 0, true, 101);
        RAISE NOTICE 'Waffles: Added Oreo variety';
      END IF;
      
      IF NOT mallows_exists THEN
        INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
        VALUES (variety_variant_id, 'Mallows', 0, true, 102);
        RAISE NOTICE 'Waffles: Added Mallows variety';
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 10: Add Size and Add Ons variants to all Frappe Series items
-- ============================================================================
DO $$
DECLARE
  frappe_item RECORD;
  size_variant_id UUID;
  addon_variant_id UUID;
  total_frappe_count INTEGER;
  frappe_processed INTEGER := 0;
BEGIN
  -- Count total Frappe items
  SELECT COUNT(*) INTO total_frappe_count
  FROM menu_items_base
  WHERE category = 'Frappe Series';
  
  RAISE NOTICE 'Processing % Frappe Series items...', total_frappe_count;
  
  -- Loop through all Frappe Series items
  FOR frappe_item IN 
    SELECT id, name
    FROM menu_items_base
    WHERE category = 'Frappe Series'
    ORDER BY name
  LOOP
    frappe_processed := frappe_processed + 1;
    
    -- Check if Size variant already exists
    SELECT id INTO size_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = frappe_item.id
      AND variant_type_name = 'Size'
    LIMIT 1;
    
    -- Add Size variant if it doesn't exist
    IF size_variant_id IS NULL THEN
      -- Create Size variant type
      INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
      VALUES (frappe_item.id, 'Size', true, false, 1)
      RETURNING id INTO size_variant_id;
      
      -- Add size options (16oz and 22oz)
      INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
      VALUES 
        (size_variant_id, '16oz', 0, true, 1),
        (size_variant_id, '22oz', 15, true, 2);
      
      RAISE NOTICE '  [%/%] %: Added Size variant (16oz/22oz)', 
        frappe_processed, total_frappe_count, frappe_item.name;
    ELSE
      RAISE NOTICE '  [%/%] %: Size variant already exists', 
        frappe_processed, total_frappe_count, frappe_item.name;
    END IF;
    
    -- Check if Add Ons variant already exists
    SELECT id INTO addon_variant_id
    FROM menu_item_variant_types
    WHERE menu_item_id = frappe_item.id
      AND variant_type_name = 'Add Ons'
    LIMIT 1;
    
    -- Add Add Ons variant if it doesn't exist
    IF addon_variant_id IS NULL THEN
      -- Create Add Ons variant type
      INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
      VALUES (frappe_item.id, 'Add Ons', false, true, 2)
      RETURNING id INTO addon_variant_id;
      
      -- Add add-on options (Coffee Jelly, Pearls, Cream Cheese)
      INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
      VALUES 
        (addon_variant_id, 'Coffee Jelly', 15, true, 1),
        (addon_variant_id, 'Pearls', 15, true, 2),
        (addon_variant_id, 'Cream Cheese', 15, true, 3);
      
      RAISE NOTICE '  [%/%] %: Added Add Ons variant (Coffee Jelly, Pearls, Cream Cheese)', 
        frappe_processed, total_frappe_count, frappe_item.name;
    ELSE
      RAISE NOTICE '  [%/%] %: Add Ons variant already exists', 
        frappe_processed, total_frappe_count, frappe_item.name;
    END IF;
    
    -- Update has_variants flag
    UPDATE menu_items_base
    SET has_variants = true
    WHERE id = frappe_item.id;
  END LOOP;
  
  RAISE NOTICE 'Completed processing all % Frappe Series items', total_frappe_count;
END $$;

-- ============================================================================
-- STEP 11: Verification and Summary
-- ============================================================================
DO $$
DECLARE
  fries_barbeque_count INTEGER;
  spag_solo_addons INTEGER;
  samyang_addons INTEGER;
  chicken_burger_has_original BOOLEAN;
  chicken_burger_has_korean_bbq BOOLEAN;
  chicken_meal_count INTEGER;
  footlong_addons INTEGER;
  clubhouse_addons INTEGER;
  waffles_has_plain BOOLEAN;
  waffles_has_nutella BOOLEAN;
  waffles_has_lotus BOOLEAN;
  waffles_has_oreo BOOLEAN;
  waffles_has_mallows BOOLEAN;
  frappe_total INTEGER;
  frappe_with_size INTEGER;
  frappe_with_addons INTEGER;
BEGIN
  -- Verify Fries Barbeque count
  SELECT COUNT(*) INTO fries_barbeque_count
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Fries' 
    AND vt.variant_type_name = 'Flavor' 
    AND vo.option_name = 'Barbeque';
  
  -- Verify Spag Solo add-ons (should only have Meaty Sauce)
  SELECT COUNT(*) INTO spag_solo_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Spag Solo' 
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Verify Samyang add-ons (should only have Spam, Egg, Cheese)
  SELECT COUNT(*) INTO samyang_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name LIKE 'Samyang%Carbonara%Chicken%'
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Verify Chicken Burger has Original flavor
  SELECT EXISTS (
    SELECT 1
    FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Chicken Burger' 
      AND vt.variant_type_name = 'Flavor'
      AND vo.option_name = 'Original'
  ) INTO chicken_burger_has_original;
  
  -- Verify Chicken Burger doesn't have Korean BBQ
  SELECT EXISTS (
    SELECT 1
    FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Chicken Burger' 
      AND vt.variant_type_name = 'Flavor'
      AND vo.option_name = 'Korean BBQ'
  ) INTO chicken_burger_has_korean_bbq;
  
  -- Verify Chicken Meal deleted
  SELECT COUNT(*) INTO chicken_meal_count
  FROM menu_items_base
  WHERE name = 'Chicken Meal';
  
  -- Verify Footlong add-ons (should only have No Vegies)
  SELECT COUNT(*) INTO footlong_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Footlong' 
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Verify Clubhouse add-ons (should only have No Vegies and Spam)
  SELECT COUNT(*) INTO clubhouse_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE mb.name = 'Clubhouse' 
    AND vt.variant_type_name ILIKE '%Add%';
  
  -- Verify Waffles varieties
  SELECT EXISTS (
    SELECT 1 FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Waffles' 
      AND vt.variant_type_name = 'Variety'
      AND vo.option_name = 'Plain'
  ) INTO waffles_has_plain;
  
  SELECT EXISTS (
    SELECT 1 FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Waffles' 
      AND vt.variant_type_name = 'Variety'
      AND vo.option_name = 'Nutella'
  ) INTO waffles_has_nutella;
  
  SELECT EXISTS (
    SELECT 1 FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Waffles' 
      AND vt.variant_type_name = 'Variety'
      AND vo.option_name = 'Lotus Biscoff'
  ) INTO waffles_has_lotus;
  
  SELECT EXISTS (
    SELECT 1 FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Waffles' 
      AND vt.variant_type_name = 'Variety'
      AND vo.option_name = 'Oreo'
  ) INTO waffles_has_oreo;
  
  SELECT EXISTS (
    SELECT 1 FROM menu_items_base mb
    JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    WHERE mb.name = 'Waffles' 
      AND vt.variant_type_name = 'Variety'
      AND vo.option_name = 'Mallows'
  ) INTO waffles_has_mallows;
  
  -- Verify Frappe Series
  SELECT COUNT(*) INTO frappe_total
  FROM menu_items_base
  WHERE category = 'Frappe Series';
  
  SELECT COUNT(DISTINCT mb.id) INTO frappe_with_size
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  WHERE mb.category = 'Frappe Series'
    AND vt.variant_type_name = 'Size';
  
  SELECT COUNT(DISTINCT mb.id) INTO frappe_with_addons
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  WHERE mb.category = 'Frappe Series'
    AND vt.variant_type_name = 'Add Ons';
  
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'MIGRATION 031 - Complete';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Fries Barbeque flavor count: % (should be 1)', fries_barbeque_count;
  RAISE NOTICE '2. Spag Solo add-ons count: % (should be 1 - Meaty Sauce)', spag_solo_addons;
  RAISE NOTICE '3. Samyang add-ons count: % (should be 3 - Spam, Egg, Cheese)', samyang_addons;
  RAISE NOTICE '4. Chicken Burger has Original: % (should be true)', chicken_burger_has_original;
  RAISE NOTICE '4. Chicken Burger has Korean BBQ: % (should be false)', chicken_burger_has_korean_bbq;
  RAISE NOTICE '5. Chicken Meal count: % (should be 0)', chicken_meal_count;
  RAISE NOTICE '6. Footlong add-ons count: % (should be 1 - No Vegies)', footlong_addons;
  RAISE NOTICE '7. Clubhouse add-ons count: % (should be 2 - No Vegies, Spam)', clubhouse_addons;
  RAISE NOTICE '8. Waffles has Plain: % (should be false)', waffles_has_plain;
  RAISE NOTICE '8. Waffles has Nutella: % (should be false)', waffles_has_nutella;
  RAISE NOTICE '8. Waffles has Lotus Biscoff: % (should be true)', waffles_has_lotus;
  RAISE NOTICE '8. Waffles has Oreo: % (should be true)', waffles_has_oreo;
  RAISE NOTICE '8. Waffles has Mallows: % (should be true)', waffles_has_mallows;
  RAISE NOTICE '9. Total Frappe items: %', frappe_total;
  RAISE NOTICE '9. Frappe items with Size variant: % (should equal total)', frappe_with_size;
  RAISE NOTICE '9. Frappe items with Add Ons variant: % (should equal total)', frappe_with_addons;
  RAISE NOTICE '';
  
  IF fries_barbeque_count = 1 
     AND spag_solo_addons = 1
     AND samyang_addons = 3
     AND chicken_burger_has_original = true
     AND chicken_burger_has_korean_bbq = false
     AND chicken_meal_count = 0
     AND footlong_addons = 1
     AND clubhouse_addons = 2
     AND waffles_has_plain = false
     AND waffles_has_nutella = false
     AND waffles_has_lotus = true
     AND waffles_has_oreo = true
     AND waffles_has_mallows = true
     AND frappe_with_size = frappe_total
     AND frappe_with_addons = frappe_total THEN
    RAISE NOTICE '✓ All menu variant errors have been fixed successfully!';
    RAISE NOTICE '✓ Menu data is now clean and correct';
  ELSE
    RAISE WARNING 'Some issues may remain. Please review the counts above.';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;
