-- ============================================================================
-- Migration: Add Extended Hot/Iced Drinks and Frappe Series
-- Description: Adds 8 additional hot/iced drinks and complete Frappe Series
-- Created: 2026-04-24
-- ============================================================================

-- ============================================================================
-- ADDITIONAL HOT/ICED DRINKS (8 items)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STRAWBERRY LATTE
-- 12oz Hot ₱99, 16oz Iced ₱104, 22oz Iced ₱119
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Strawberry Latte', 'Hot/Iced Drinks', 99.00, true, 'Sweet strawberry latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Strawberry Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Strawberry Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 5, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 20, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Strawberry Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 2. BLUEBERRY LATTE
-- 12oz Hot ₱99, 16oz Iced ₱104, 22oz Iced ₱119
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Blueberry Latte', 'Hot/Iced Drinks', 99.00, true, 'Blueberry flavored latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Blueberry Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Blueberry Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 5, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 20, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Blueberry Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 3. UBE TARO LATTE
-- 12oz Hot ₱99, 16oz Iced ₱104, 22oz Iced ₱119
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Ube Taro Latte', 'Hot/Iced Drinks', 99.00, true, 'Filipino ube taro latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Ube Taro Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ube Taro Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 5, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 20, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ube Taro Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 4. BISCOFF LATTE
-- 12oz Hot ₱99, 16oz Iced ₱109, 22oz Iced ₱124
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Biscoff Latte', 'Hot/Iced Drinks', 99.00, true, 'Biscoff cookie flavored latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Biscoff Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Biscoff Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 10, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 25, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Biscoff Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 5. BISCOFF MATCHA LATTE
-- 12oz Hot ₱104, 16oz Iced ₱119, 22oz Iced ₱134
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Biscoff Matcha Latte', 'Hot/Iced Drinks', 104.00, true, 'Biscoff meets matcha latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Biscoff Matcha Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Biscoff Matcha Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 15, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 30, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Biscoff Matcha Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 6. BISCOFF CAFE LATTE
-- 12oz Hot ₱104, 16oz Iced ₱119, 22oz Iced ₱134
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Biscoff Cafe Latte', 'Hot/Iced Drinks', 104.00, true, 'Biscoff flavored cafe latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Biscoff Cafe Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Biscoff Cafe Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 15, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 30, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Biscoff Cafe Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 7. PASSION FRUIT LATTE
-- 12oz Hot ₱99, 16oz Iced ₱104, 22oz Iced ₱119
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Passion Fruit Latte', 'Hot/Iced Drinks', 99.00, true, 'Tropical passion fruit latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Passion Fruit Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Passion Fruit Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 5, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 20, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Passion Fruit Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 8. OREO LATTE
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Oreo Latte', 'Hot/Iced Drinks', 104.00, true, 'Oreo cookie latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Oreo Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Oreo Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 10, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 25, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Oreo Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 4 FROM addon_type;

-- ============================================================================
-- FRAPPE SERIES CATEGORY
-- ============================================================================
-- All frappes come in 2 sizes: 16oz and 22oz (no hot option)
-- All have 3 add-ons: Coffee Jelly, Pearls, Cream Cheese (+₱15 each)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CARAMEL MACCHIATO FRAPPE
-- 16oz ₱124, 22oz ₱139
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Caramel Macchiato Frappe', 'Frappe Series', 124.00, true, 'Frozen caramel macchiato', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Caramel Macchiato Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Caramel Macchiato Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Caramel Macchiato Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 2. COOKIES & CREAM FRAPPE
-- 16oz ₱124, 22oz ₱139
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Cookies & Cream Frappe', 'Frappe Series', 124.00, true, 'Frozen cookies and cream', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Cookies & Cream Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Cookies & Cream Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Cookies & Cream Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 3. MATCHA FRAPPE
-- 16oz ₱124, 22oz ₱139
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Matcha Frappe', 'Frappe Series', 124.00, true, 'Frozen matcha drink', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Matcha Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Matcha Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Matcha Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 4. STRAWBERRY FRAPPE
-- 16oz ₱119, 22oz ₱134
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Strawberry Frappe', 'Frappe Series', 119.00, true, 'Frozen strawberry drink', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Strawberry Frappe' AND category = 'Frappe Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Strawberry Frappe' AND vt.variant_type_name = 'Size' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Strawberry Frappe' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 3 FROM addon_type;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Additional Hot/Iced Drinks: 8 items
--   - Strawberry Latte, Blueberry Latte, Ube Taro Latte (₱99-₱119)
--   - Biscoff Latte (₱99-₱124)
--   - Biscoff Matcha Latte, Biscoff Cafe Latte (₱104-₱134)
--   - Passion Fruit Latte (₱99-₱119)
--   - Oreo Latte (₱104-₱129)
--
-- New Category - Frappe Series: 4 items
--   - Caramel Macchiato Frappe, Cookies & Cream Frappe, Matcha Frappe (₱124-₱139)
--   - Strawberry Frappe (₱119-₱134)
--   - All frappes: 16oz/22oz only (no hot), add-ons: Coffee Jelly/Pearls/Cream Cheese
--
-- Total new items in this migration: 12
-- Running total: 50 + 12 = 62 menu items
-- ============================================================================
