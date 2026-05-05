-- ============================================================================
-- Complete Menu Variants Migration Script
-- Migrates existing menu items to use the variants system
-- Run this AFTER menu_variants_schema.sql
-- ============================================================================

-- ============================================================================
-- 1. FRIES MIGRATION
-- ============================================================================
-- Create base Fries item
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Fries', 'Appetizers', 89.00, true, 'Crispy fries with your choice of flavor', true)
ON CONFLICT DO NOTHING;

-- Create Flavor variant type for Fries
WITH fries_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Fries' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM fries_item
ON CONFLICT DO NOTHING;

-- Add Flavor options for Fries
WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fries' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Cheese', 0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Meaty Sauce', 0, true, 2 FROM flavor_type
UNION ALL
SELECT id, 'Sour Cream', 0, true, 3 FROM flavor_type
UNION ALL
SELECT id, 'Barbecue', 0, true, 4 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. SIOMAI MIGRATION
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Siomai', 'Appetizers', 69.00, true, 'Delicious dumplings - choose your style', true)
ON CONFLICT DO NOTHING;

WITH siomai_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Siomai' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Style', true, false, 1 FROM siomai_item
ON CONFLICT DO NOTHING;

WITH style_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Siomai' AND vt.variant_type_name = 'Style'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Steamed', 0, true, 1 FROM style_type
UNION ALL
SELECT id, 'Fried', 0, true, 2 FROM style_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CALAMARES MIGRATION
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Calamares', 'Appetizers', 89.00, true, 'Fried squid rings with your choice of sauce', true)
ON CONFLICT DO NOTHING;

WITH calamares_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Calamares' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Sauce', true, false, 1 FROM calamares_item
ON CONFLICT DO NOTHING;

WITH sauce_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Calamares' AND vt.variant_type_name = 'Sauce'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Meaty Sauce', 0, true, 1 FROM sauce_type
UNION ALL
SELECT id, 'Sinamak', 0, true, 2 FROM sauce_type
UNION ALL
SELECT id, 'Mayonnaise', 0, true, 3 FROM sauce_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. CHICKEN MEALS MIGRATION (₱79)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Chicken Meal', 'Chicken', 79.00, true, 'Delicious chicken meal with your choice of flavor', true)
ON CONFLICT DO NOTHING;

WITH chicken_meal_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Meal' AND category = 'Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM chicken_meal_item
ON CONFLICT DO NOTHING;

WITH chicken_flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Meal' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Barbecue', 0, true, 1 FROM chicken_flavor_type
UNION ALL
SELECT id, 'Buffalo Wings', 0, true, 2 FROM chicken_flavor_type
UNION ALL
SELECT id, 'Honey Butter', 0, true, 3 FROM chicken_flavor_type
UNION ALL
SELECT id, 'Sweet & Sour', 0, true, 4 FROM chicken_flavor_type
UNION ALL
SELECT id, 'Sweet & Spicy', 0, true, 5 FROM chicken_flavor_type
UNION ALL
SELECT id, 'Soy Garlic', 0, true, 6 FROM chicken_flavor_type
UNION ALL
SELECT id, 'Teriyaki', 0, true, 7 FROM chicken_flavor_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. CHICKEN PLATTER MIGRATION (₱249)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Chicken Platter', 'Chicken', 249.00, true, 'Generous chicken platter with your choice of flavor', true)
ON CONFLICT DO NOTHING;

WITH chicken_platter_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Platter' AND category = 'Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM chicken_platter_item
ON CONFLICT DO NOTHING;

WITH platter_flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Barbecue', 0, true, 1 FROM platter_flavor_type
UNION ALL
SELECT id, 'Buffalo Wings', 0, true, 2 FROM platter_flavor_type
UNION ALL
SELECT id, 'Honey Butter', 0, true, 3 FROM platter_flavor_type
UNION ALL
SELECT id, 'Sweet & Sour', 0, true, 4 FROM platter_flavor_type
UNION ALL
SELECT id, 'Sweet & Spicy', 0, true, 5 FROM platter_flavor_type
UNION ALL
SELECT id, 'Soy Garlic', 0, true, 6 FROM platter_flavor_type
UNION ALL
SELECT id, 'Teriyaki', 0, true, 7 FROM platter_flavor_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. CHICKEN BURGER MIGRATION (₱99)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Chicken Burger', 'Burgers', 99.00, true, 'Tasty chicken burger with your choice of flavor', true)
ON CONFLICT DO NOTHING;

WITH burger_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Burger' AND category = 'Burgers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM burger_item
ON CONFLICT DO NOTHING;

WITH burger_flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Burger' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Barbecue', 0, true, 1 FROM burger_flavor_type
UNION ALL
SELECT id, 'Buffalo Wings', 0, true, 2 FROM burger_flavor_type
UNION ALL
SELECT id, 'Honey Butter', 0, true, 3 FROM burger_flavor_type
UNION ALL
SELECT id, 'Sweet & Sour', 0, true, 4 FROM burger_flavor_type
UNION ALL
SELECT id, 'Sweet & Spicy', 0, true, 5 FROM burger_flavor_type
UNION ALL
SELECT id, 'Soy Garlic', 0, true, 6 FROM burger_flavor_type
UNION ALL
SELECT id, 'Teriyaki', 0, true, 7 FROM burger_flavor_type
UNION ALL
SELECT id, 'Original', 0, true, 8 FROM burger_flavor_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. SILOG (RICE MEALS) MIGRATION (₱109)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Silog', 'Rice Meals', 109.00, true, 'Sinangag and Itlog with your choice of meat', true)
ON CONFLICT DO NOTHING;

WITH silog_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Silog' AND category = 'Rice Meals' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Meat', true, false, 1 FROM silog_item
ON CONFLICT DO NOTHING;

WITH meat_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Silog' AND vt.variant_type_name = 'Meat'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Bangus (Bangsilog)', 0, true, 1 FROM meat_type
UNION ALL
SELECT id, 'Corned Beef (Cornsilog)', 0, true, 2 FROM meat_type
UNION ALL
SELECT id, 'Tocino (Tocilog)', 0, true, 3 FROM meat_type
UNION ALL
SELECT id, 'Chicken (Chicsilog)', 0, true, 4 FROM meat_type
UNION ALL
SELECT id, 'Tapa (Tapsilog)', 0, true, 5 FROM meat_type
UNION ALL
SELECT id, 'Hotdog (Hotsilog)', 0, true, 6 FROM meat_type
UNION ALL
SELECT id, 'Siomai (Siomaisilog)', 0, true, 7 FROM meat_type
UNION ALL
SELECT id, 'Luncheon Meat (Luncheonsilog)', 0, true, 8 FROM meat_type
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count base items with variants
SELECT 
  COUNT(*) as total_base_items,
  COUNT(CASE WHEN has_variants THEN 1 END) as items_with_variants
FROM menu_items_base;

-- List all items with their variant counts
SELECT 
  mb.name,
  mb.category,
  mb.base_price,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types_count,
  COUNT(vo.id) as total_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.id, mb.name, mb.category, mb.base_price, mb.has_variants
ORDER BY mb.category, mb.name;

-- Display full variant structure for verification
SELECT 
  mb.name as item_name,
  mb.category,
  mb.base_price,
  vt.variant_type_name,
  vt.is_required,
  vo.option_name,
  vo.price_modifier,
  vo.display_order
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
ORDER BY mb.category, mb.name, vt.display_order, vo.display_order;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Menu Variants Migration Complete!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Review the verification queries above';
  RAISE NOTICE '2. Update frontend to use menu_items_base table';
  RAISE NOTICE '3. Implement variant selection modal';
  RAISE NOTICE '4. Test thoroughly before disabling old menu_items';
  RAISE NOTICE '============================================================';
END $$;
