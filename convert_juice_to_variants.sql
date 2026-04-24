-- ============================================================================
-- Convert Individual Juice Items to Variant-Based System
-- This script helps if you have individual juice items that should be variants
-- ============================================================================

-- Example: If you have "Lemon Blueberry Juice", "Lemonade Juice", etc.
-- as separate items, this converts them to variants of a base "Juice" item

-- ============================================================================
-- STEP 1: Identify existing juice items in old table
-- ============================================================================
SELECT id, name, category, price, available
FROM menu_items
WHERE category = 'Beverages' 
  AND (
    name ILIKE '%juice%' OR
    name ILIKE '%lemon%' OR
    name ILIKE '%blueberry%'
  )
ORDER BY name;

-- ============================================================================
-- STEP 2: Create base "Juice" item if it doesn't exist
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Fruit Juice', 'Beverages', 54.00, true, 'Fresh fruit juices with your choice of flavor and size', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Add Flavor variant type for Fruit Juice
-- ============================================================================
WITH juice_item AS (
  SELECT id FROM menu_items_base 
  WHERE name = 'Fruit Juice' AND category = 'Beverages' 
  LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM juice_item
ON CONFLICT DO NOTHING;

-- Add Flavor options (based on what you have in your menu)
WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fruit Juice' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Lemon', 0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Blueberry', 0, true, 2 FROM flavor_type
UNION ALL
SELECT id, 'Lemon Blueberry', 0, true, 3 FROM flavor_type
UNION ALL
SELECT id, 'Strawberry', 0, true, 4 FROM flavor_type
UNION ALL
SELECT id, 'Mango', 0, true, 5 FROM flavor_type
UNION ALL
SELECT id, 'Orange', 0, true, 6 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Add Size variant type for Fruit Juice
-- ============================================================================
WITH juice_item AS (
  SELECT id FROM menu_items_base 
  WHERE name = 'Fruit Juice' AND category = 'Beverages' 
  LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 2 FROM juice_item
ON CONFLICT DO NOTHING;

-- Add Size options
WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fruit Juice' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz (Regular)', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz (Large)', 10, true, 2 FROM size_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Add optional Add-ons variant type
-- ============================================================================
WITH juice_item AS (
  SELECT id FROM menu_items_base 
  WHERE name = 'Fruit Juice' AND category = 'Beverages' 
  LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 3 FROM juice_item
ON CONFLICT DO NOTHING;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fruit Juice' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Fruit', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Nata de Coco', 10, true, 2 FROM addon_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 6: (OPTIONAL) Disable old individual juice items
-- ============================================================================
-- Uncomment these lines if you want to hide old individual juice items
-- UPDATE menu_items 
-- SET available = false
-- WHERE category = 'Beverages' 
--   AND (
--     name ILIKE '%lemon%juice%' OR
--     name ILIKE '%blueberry%juice%' OR
--     name = 'Lemonade Juice'
--   );

-- ============================================================================
-- STEP 7: Verify the setup
-- ============================================================================
SELECT 
  mb.name as item_name,
  mb.base_price,
  mb.has_variants,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  vo.option_name,
  vo.price_modifier
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Fruit Juice'
ORDER BY vt.display_order, vo.display_order;

-- ============================================================================
-- EXPECTED RESULT AFTER RUNNING THIS SCRIPT:
-- ============================================================================
-- 1. One "Fruit Juice" item in menu_items_base with has_variants=true
-- 2. Three variant types:
--    - Flavor (required, single) with 6 options
--    - Size (required, single) with 2 options  
--    - Add-ons (optional, multiple) with 2 options
-- 3. When customers click "Fruit Juice", they see a modal to select:
--    - Flavor: Lemon, Blueberry, Lemon Blueberry, etc.
--    - Size: 16oz or 22oz (+₱10)
--    - Add-ons: Extra Fruit (+₱15), Nata de Coco (+₱10)
-- 4. Cart and receipt will show: "Fruit Juice - Lemon Blueberry, 22oz, Extra Fruit"
-- ============================================================================
