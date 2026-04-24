-- ============================================================================
-- Migration: Update Menu for Multiple Add-ons and New Items
-- Description: 
--   1. Update all Add-ons variant types to allow multiple selection
--   2. Remove "No Add Ons" option from all items
--   3. Add "Extra Rice" to Silog Meals add-ons
--   4. Remove Add-ons from Nachos
--   5. Add new Frappe Series items (7 items)
--   6. Add new Fruit Soda & Lemonade items (11 items)
-- Created: 2026-04-24
-- ============================================================================

-- ============================================================================
-- PART 1: Update existing Add-ons to allow multiple selection
-- ============================================================================

-- Update all "Add Ons" variant types to allow multiple selection
UPDATE menu_item_variant_types
SET allow_multiple = true
WHERE variant_type_name = 'Add Ons';

-- ============================================================================
-- PART 2: Remove "No Add Ons" option from all items
-- ============================================================================

DELETE FROM menu_item_variant_options
WHERE option_name = 'No Add Ons';

-- ============================================================================
-- PART 3: Add "Extra Rice" add-on to Silog Meals
-- ============================================================================

-- Add Extra Rice option to Silog Meals Add-ons
WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Silog Meals' AND mb.category = 'Rice & More' 
    AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Rice', 10, true, 1 FROM addon_type
WHERE EXISTS (SELECT 1 FROM addon_type);

-- ============================================================================
-- PART 4: Remove Add-ons from Nachos
-- ============================================================================

-- Delete Add-ons variant type and its options from Nachos
DELETE FROM menu_item_variant_types
WHERE id IN (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Nachos' AND vt.variant_type_name IN ('Add-ons', 'Add Ons')
);

-- ============================================================================
-- PART 5: Add new Frappe Series items
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RED VELVET FRAPPE (16oz ₱119, 22oz ₱134)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Red Velvet Frappe', 'Frappe Series', 119.00, true, 'Red velvet flavored frappe', true);

WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Red Velvet Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item
UNION ALL
SELECT id, 'Add Ons', false, true, 2 FROM frappe_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Red Velvet Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Red Velvet Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 2. UBE TARO FRAPPE (16oz ₱119, 22oz ₱134)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Ube Taro Frappe', 'Frappe Series', 119.00, true, 'Ube taro flavored frappe', true);

WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Ube Taro Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item
UNION ALL
SELECT id, 'Add Ons', false, true, 2 FROM frappe_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ube Taro Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ube Taro Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 3. DARK CHOCOLATE FRAPPE (16oz ₱124, 22oz ₱139)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Dark Chocolate Frappe', 'Frappe Series', 124.00, true, 'Rich dark chocolate frappe', true);

WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Dark Chocolate Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item
UNION ALL
SELECT id, 'Add Ons', false, true, 2 FROM frappe_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Dark Chocolate Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Dark Chocolate Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 4. MOCHA FRAPPE (16oz ₱124, 22oz ₱139)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Mocha Frappe', 'Frappe Series', 124.00, true, 'Mocha flavored frappe', true);

WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Mocha Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item
UNION ALL
SELECT id, 'Add Ons', false, true, 2 FROM frappe_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mocha Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mocha Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 5. MOCHA LATTE FRAPPE (16oz ₱124, 22oz ₱139)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Mocha Latte Frappe', 'Frappe Series', 124.00, true, 'Mocha latte frappe', true);

WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Mocha Latte Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item
UNION ALL
SELECT id, 'Add Ons', false, true, 2 FROM frappe_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mocha Latte Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mocha Latte Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 6. LOTUS BISCOFF FRAPPE (16oz ₱134, 22oz ₱149)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Lotus Biscoff Frappe', 'Frappe Series', 134.00, true, 'Lotus biscoff flavored frappe', true);

WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Lotus Biscoff Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item
UNION ALL
SELECT id, 'Add Ons', false, true, 2 FROM frappe_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lotus Biscoff Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lotus Biscoff Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 7. MANGO GRAHAM FRAPPE (16oz ₱134, 22oz ₱149)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Mango Graham Frappe', 'Frappe Series', 134.00, true, 'Mango graham flavored frappe', true);

WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Mango Graham Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item
UNION ALL
SELECT id, 'Add Ons', false, true, 2 FROM frappe_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mango Graham Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mango Graham Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
-- Note: Mango Graham Frappe only has Pearls and Cream Cheese add-ons (no Coffee Jelly)
-- This matches the menu specification provided
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Pearls', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 2 FROM addon_type;

-- ============================================================================
-- PART 6: Add new Fruit Soda & Lemonade items (No Add-ons)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STRAWBERRY SODA (16oz ₱54, 22oz ₱69)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Strawberry Soda', 'Fruit Soda & Lemonade', 54.00, true, 'Refreshing strawberry soda', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Strawberry Soda' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Strawberry Soda' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 2. GREEN APPLE SODA (16oz ₱54, 22oz ₱69)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Green Apple Soda', 'Fruit Soda & Lemonade', 54.00, true, 'Refreshing green apple soda', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Green Apple Soda' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Green Apple Soda' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 3. BLUE LEMONADE SODA (16oz ₱54, 22oz ₱69)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Blue Lemonade Soda', 'Fruit Soda & Lemonade', 54.00, true, 'Refreshing blue lemonade soda', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Blue Lemonade Soda' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Blue Lemonade Soda' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 4. LYCHEE SODA (16oz ₱54, 22oz ₱69)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Lychee Soda', 'Fruit Soda & Lemonade', 54.00, true, 'Refreshing lychee soda', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Lychee Soda' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lychee Soda' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 5. BLUEBERRY SODA (16oz ₱64, 22oz ₱79)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Blueberry Soda', 'Fruit Soda & Lemonade', 64.00, true, 'Refreshing blueberry soda', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Blueberry Soda' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Blueberry Soda' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 6. PASSION FRUIT SODA (16oz ₱74, 22oz ₱89)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Passion Fruit Soda', 'Fruit Soda & Lemonade', 74.00, true, 'Refreshing passion fruit soda', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Passion Fruit Soda' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Passion Fruit Soda' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 7. LEMONADE JUICE (16oz ₱54, 22oz ₱69)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Lemonade Juice', 'Fruit Soda & Lemonade', 54.00, true, 'Fresh lemonade juice', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Lemonade Juice' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lemonade Juice' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 8. LEMON STRAWBERRY JUICE (16oz ₱64, 22oz ₱79)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Lemon Strawberry Juice', 'Fruit Soda & Lemonade', 64.00, true, 'Lemon strawberry juice blend', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Lemon Strawberry Juice' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lemon Strawberry Juice' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 9. LEMON BLUEBERRY JUICE (16oz ₱64, 22oz ₱79)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Lemon Blueberry Juice', 'Fruit Soda & Lemonade', 64.00, true, 'Lemon blueberry juice blend', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Lemon Blueberry Juice' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lemon Blueberry Juice' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 10. LEMON PASSION FRUIT JUICE (16oz ₱84, 22oz ₱99)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Lemon Passion Fruit Juice', 'Fruit Soda & Lemonade', 84.00, true, 'Lemon passion fruit juice blend', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Lemon Passion Fruit Juice' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lemon Passion Fruit Juice' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ----------------------------------------------------------------------------
-- 11. LEMON YOGURT SLUSH (16oz ₱94, 22oz ₱109)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Lemon Yogurt Slush', 'Fruit Soda & Lemonade', 94.00, true, 'Lemon yogurt slush', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Lemon Yogurt Slush' AND category = 'Fruit Soda & Lemonade' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Lemon Yogurt Slush' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Updates Made:
-- 1. All Add-ons variant types now allow multiple selection
-- 2. Removed "No Add Ons" from all menu items
-- 3. Added "Extra Rice" add-on (₱10) to Silog Meals
-- 4. Removed Add-ons from Nachos
--
-- New Items Added:
-- Frappe Series (7 items):
--   - Red Velvet Frappe, Ube Taro Frappe (₱119-₱134)
--   - Dark Chocolate Frappe, Mocha Frappe, Mocha Latte Frappe (₱124-₱139)
--   - Lotus Biscoff Frappe, Mango Graham Frappe (₱134-₱149)
--   - All frappes: 16oz/22oz, add-ons: Coffee Jelly/Pearls/Cream Cheese (₱15 each)
--
-- Fruit Soda & Lemonade (11 items):
--   - Strawberry Soda, Green Apple Soda, Blue Lemonade Soda, Lychee Soda (₱54-₱69)
--   - Blueberry Soda (₱64-₱79)
--   - Passion Fruit Soda (₱74-₱89)
--   - Lemonade Juice (₱54-₱69)
--   - Lemon Strawberry Juice, Lemon Blueberry Juice (₱64-₱79)
--   - Lemon Passion Fruit Juice (₱84-₱99)
--   - Lemon Yogurt Slush (₱94-₱109)
--   - All items: 16oz/22oz, NO add-ons
--
-- Total new items in this migration: 18
-- Running total: 62 + 18 = 80 menu items
-- ============================================================================
