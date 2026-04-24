-- ============================================================================
-- Migration: Add Hot/Iced Drinks Category
-- Description: Adds 11 hot and iced coffee/specialty drink items with size,
--              variety (hot/iced), and add-on variants
-- Created: 2026-04-24
-- ============================================================================

-- ============================================================================
-- HOT/ICED DRINKS CATEGORY
-- ============================================================================
-- Items in this category have complex variant structures:
-- - Size/Variety combinations (12oz Hot, 16oz Iced, 22oz Iced, etc.)
-- - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AMERICANO
-- 12oz Hot ₱74, 16oz Iced ₱74, 22oz Iced ₱84
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Americano', 'Hot/Iced Drinks', 74.00, true, 'Classic Americano coffee', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Americano' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Americano' AND vt.variant_type_name = 'Size & Type' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz Hot', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz Iced', 0, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz Iced', 10, true, 3 FROM size_type;

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Americano' AND vt.variant_type_name = 'Add Ons' LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 15, true, 1 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 2. SPANISH LATTE
-- 12oz Hot ₱99, 16oz Iced ₱104, 22oz Iced ₱119
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Spanish Latte', 'Hot/Iced Drinks', 99.00, true, 'Spanish-style latte with condensed milk', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Spanish Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Spanish Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Spanish Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 3. CAFE LATTE
-- 12oz Hot ₱99, 16oz Iced ₱104, 22oz Iced ₱119
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Cafe Latte', 'Hot/Iced Drinks', 99.00, true, 'Classic cafe latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Cafe Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Cafe Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Cafe Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 4. CARAMEL MACCHIATO
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Caramel Macchiato', 'Hot/Iced Drinks', 104.00, true, 'Caramel macchiato with espresso', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Caramel Macchiato' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Caramel Macchiato' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Caramel Macchiato' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 5. CAFE MOCHA
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Cafe Mocha', 'Hot/Iced Drinks', 104.00, true, 'Coffee with chocolate', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Cafe Mocha' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Cafe Mocha' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Cafe Mocha' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 6. MOCHA LATTE
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Mocha Latte', 'Hot/Iced Drinks', 104.00, true, 'Mocha latte with espresso', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Mocha Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mocha Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Mocha Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 7. CARAMEL MOCHA
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Caramel Mocha', 'Hot/Iced Drinks', 104.00, true, 'Caramel mocha coffee', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Caramel Mocha' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Caramel Mocha' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Caramel Mocha' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 8. MATCHA ESPRESSO
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Matcha Espresso', 'Hot/Iced Drinks', 104.00, true, 'Matcha with espresso shot', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Matcha Espresso' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Matcha Espresso' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Matcha Espresso' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 9. WHITE CHOCO MATCHA LATTE
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('White Choco Matcha Latte', 'Hot/Iced Drinks', 104.00, true, 'White chocolate matcha latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'White Choco Matcha Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'White Choco Matcha Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'White Choco Matcha Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 10. DARK CHOCOLATE
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Dark Chocolate', 'Hot/Iced Drinks', 104.00, true, 'Rich dark chocolate drink', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Dark Chocolate' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Dark Chocolate' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Dark Chocolate' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- 11. MATCHA LATTE
-- 12oz Hot ₱104, 16oz Iced ₱114, 22oz Iced ₱129
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Matcha Latte', 'Hot/Iced Drinks', 104.00, true, 'Creamy matcha latte', true);

WITH drink_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Matcha Latte' AND category = 'Hot/Iced Drinks' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size & Type', true, false, 1 FROM drink_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM drink_item;

WITH size_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Matcha Latte' AND vt.variant_type_name = 'Size & Type' LIMIT 1
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
  WHERE mb.name = 'Matcha Latte' AND vt.variant_type_name = 'Add Ons' LIMIT 1
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
-- SUMMARY
-- ============================================================================
-- Total new items: 11
-- Category: Hot/Iced Drinks
-- All items have Size & Type variants and optional Add-ons
-- Price ranges:
--   - Americano: ₱74-₱84
--   - Spanish Latte, Cafe Latte: ₱99-₱119
--   - All others: ₱104-₱129
-- Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)
-- ============================================================================
