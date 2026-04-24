-- ============================================================================
-- Complete Menu Variants Migration Script - All Menu Items
-- This script adds all missing menu item variants based on the problem statement
-- Run this AFTER menu_variants_schema.sql
-- ============================================================================

-- ============================================================================
-- BEVERAGES SECTION
-- ============================================================================

-- ============================================================================
-- 1. MILKTEA SERIES (Size + Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Milktea', 'Beverages', 59.00, true, 'Delicious milktea with your choice of size and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Size variant type (required)
WITH milktea_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Milktea' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM milktea_item;

-- Add size options
WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Milktea' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz (Regular)', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz (Large)', 20, true, 2 FROM size_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH milktea_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Milktea' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM milktea_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Milktea' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Pearls', 10, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Nata de Coco', 10, true, 3 FROM addon_type
UNION ALL
SELECT id, 'Pudding', 15, true, 4 FROM addon_type;

-- ============================================================================
-- 2. HOT/ICED DRINKS (Size + Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Hot/Iced Drinks', 'Beverages', 49.00, true, 'Choose from hot or iced beverages', true)
ON CONFLICT DO NOTHING;

-- Add Size variant type (required)
WITH drinks_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Hot/Iced Drinks' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM drinks_item;

-- Add size options
WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Hot/Iced Drinks' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '12oz (Small)', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '16oz (Medium)', 15, true, 2 FROM size_type
UNION ALL
SELECT id, '22oz (Large)', 25, true, 3 FROM size_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH drinks_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Hot/Iced Drinks' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM drinks_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Hot/Iced Drinks' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Shot', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Whipped Cream', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Caramel Drizzle', 10, true, 3 FROM addon_type;

-- ============================================================================
-- 3. FRAPPE SERIES (Size + Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Frappe', 'Beverages', 69.00, true, 'Refreshing frappe with your choice of size and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Size variant type (required)
WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Frappe' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM frappe_item;

-- Add size options
WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Frappe' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz (Regular)', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz (Large)', 20, true, 2 FROM size_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH frappe_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Frappe' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM frappe_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Frappe' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Whipped Cream', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Chocolate Drizzle', 10, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Extra Shot', 20, true, 3 FROM addon_type;

-- ============================================================================
-- 4. FRUIT SODA & LEMONADE (Size + Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Fruit Soda & Lemonade', 'Beverages', 49.00, true, 'Refreshing fruit sodas and lemonades', true)
ON CONFLICT DO NOTHING;

-- Add Size variant type (required)
WITH soda_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Fruit Soda & Lemonade' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM soda_item;

-- Add size options
WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fruit Soda & Lemonade' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz (Regular)', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz (Large)', 15, true, 2 FROM size_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH soda_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Fruit Soda & Lemonade' AND category = 'Beverages' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM soda_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fruit Soda & Lemonade' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Fruit', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Nata de Coco', 10, true, 2 FROM addon_type;

-- ============================================================================
-- APPETIZERS SECTION - UPDATES
-- ============================================================================

-- ============================================================================
-- 5. NACHOS (Dip Sauce + Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Nachos', 'Appetizers', 99.00, true, 'Crispy nachos with your choice of dip sauce and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Dip Sauce variant type (required)
WITH nachos_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Nachos' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Dip Sauce', true, false, 1 FROM nachos_item;

-- Add dip sauce options
WITH sauce_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Nachos' AND vt.variant_type_name = 'Dip Sauce'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Cheese Sauce', 0, true, 1 FROM sauce_type
UNION ALL
SELECT id, 'Salsa', 0, true, 2 FROM sauce_type
UNION ALL
SELECT id, 'Sour Cream', 0, true, 3 FROM sauce_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH nachos_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Nachos' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM nachos_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Nachos' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Cheese', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Jalapeños', 10, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Ground Beef', 25, true, 3 FROM addon_type;

-- ============================================================================
-- 6. FRIES - ADD ADD-ONS VARIANT (Already has Flavor from migrate_menu_variants.sql)
-- ============================================================================
-- Add Add-ons variant type (optional, multiple selection)
WITH fries_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Fries' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM fries_item
WHERE EXISTS (SELECT 1 FROM menu_items_base WHERE name = 'Fries' AND category = 'Appetizers');

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fries' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Cheese', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Bacon Bits', 20, true, 2 FROM addon_type;

-- ============================================================================
-- 7. SIOMAI - ADD SPICY/REGULAR VARIANT (Already has Style from migrate_menu_variants.sql)
-- ============================================================================
-- Add Spicy Level variant type (required)
WITH siomai_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Siomai' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 2 FROM siomai_item
WHERE EXISTS (SELECT 1 FROM menu_items_base WHERE name = 'Siomai' AND category = 'Appetizers');

-- Add spice level options
WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Siomai' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Regular', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

-- ============================================================================
-- 8. CALAMARES - ADD ADD-ONS VARIANT (Already has Sauce from migrate_menu_variants.sql)
-- ============================================================================
-- Add Add-ons variant type (optional, multiple selection)
WITH calamares_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Calamares' AND category = 'Appetizers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM calamares_item
WHERE EXISTS (SELECT 1 FROM menu_items_base WHERE name = 'Calamares' AND category = 'Appetizers');

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Calamares' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Sauce', 10, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Lemon Wedges', 5, true, 2 FROM addon_type;

-- ============================================================================
-- PASTA & NOODLES SECTION
-- ============================================================================

-- ============================================================================
-- 9. SPAG SOLO (Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Spag Solo', 'Pasta & Noodles', 89.00, true, 'Spaghetti solo with optional add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Add-ons variant type (optional, multiple selection)
WITH spag_solo_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Spag Solo' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 1 FROM spag_solo_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Spag Solo' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Garlic Bread', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Extra Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Meatballs', 25, true, 3 FROM addon_type;

-- ============================================================================
-- 10. SPAG & CHICKEN (Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Spag & Chicken', 'Pasta & Noodles', 149.00, true, 'Spaghetti with chicken and optional add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Add-ons variant type (optional, multiple selection)
WITH spag_chicken_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Spag & Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 1 FROM spag_chicken_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Spag & Chicken' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Garlic Bread', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Extra Cheese', 15, true, 2 FROM addon_type;

-- ============================================================================
-- 11. RAMYEON (Solo/Overload + Add-ons + Spicy Level)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Ramyeon', 'Pasta & Noodles', 79.00, true, 'Korean-style ramen with your choice of size, spice level, and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Serving Size variant type (required)
WITH ramyeon_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Ramyeon' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Serving Size', true, false, 1 FROM ramyeon_item;

-- Add serving size options
WITH serving_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ramyeon' AND vt.variant_type_name = 'Serving Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Solo', 0, true, 1 FROM serving_type
UNION ALL
SELECT id, 'Overload', 30, true, 2 FROM serving_type;

-- Add Spice Level variant type (required)
WITH ramyeon_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Ramyeon' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 2 FROM ramyeon_item;

-- Add spice level options
WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ramyeon' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Less Spicy', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH ramyeon_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Ramyeon' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 3 FROM ramyeon_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ramyeon' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Egg', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Sausage', 20, true, 3 FROM addon_type;

-- ============================================================================
-- 12. SAMYANG CARBONARA (Solo/Overload + Add-ons + Spicy Level)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Samyang Carbonara', 'Pasta & Noodles', 89.00, true, 'Spicy carbonara noodles with your choice of size, spice level, and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Serving Size variant type (required)
WITH samyang_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Serving Size', true, false, 1 FROM samyang_item;

-- Add serving size options
WITH serving_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara' AND vt.variant_type_name = 'Serving Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Solo', 0, true, 1 FROM serving_type
UNION ALL
SELECT id, 'Overload', 30, true, 2 FROM serving_type;

-- Add Spice Level variant type (required)
WITH samyang_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 2 FROM samyang_item;

-- Add spice level options
WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Less Spicy', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH samyang_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 3 FROM samyang_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Egg', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Sausage', 20, true, 3 FROM addon_type;

-- ============================================================================
-- 13. SAMYANG CARBONARA & CHICKEN (Add-ons + Spicy Level)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Samyang Carbonara & Chicken', 'Pasta & Noodles', 149.00, true, 'Spicy carbonara noodles with chicken, your choice of spice level and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Spice Level variant type (required)
WITH samyang_chicken_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara & Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM samyang_chicken_item;

-- Add spice level options
WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara & Chicken' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Less Spicy', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH samyang_chicken_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara & Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM samyang_chicken_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara & Chicken' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Egg', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Extra Cheese', 15, true, 2 FROM addon_type;

-- ============================================================================
-- 14. TTEOKBOKKI (Solo/Overload + Add-ons + Spicy Level)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Tteokbokki', 'Pasta & Noodles', 89.00, true, 'Korean rice cakes with your choice of size, spice level, and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Serving Size variant type (required)
WITH tteokbokki_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Tteokbokki' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Serving Size', true, false, 1 FROM tteokbokki_item;

-- Add serving size options
WITH serving_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Tteokbokki' AND vt.variant_type_name = 'Serving Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Solo', 0, true, 1 FROM serving_type
UNION ALL
SELECT id, 'Overload', 30, true, 2 FROM serving_type;

-- Add Spice Level variant type (required)
WITH tteokbokki_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Tteokbokki' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 2 FROM tteokbokki_item;

-- Add spice level options
WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Tteokbokki' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Less Spicy', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH tteokbokki_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Tteokbokki' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 3 FROM tteokbokki_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Tteokbokki' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Boiled Egg', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Fish Cake', 20, true, 3 FROM addon_type;

-- ============================================================================
-- CHICKEN SECTION - ADD ADD-ONS TO EXISTING ITEMS
-- ============================================================================

-- ============================================================================
-- 15. CHICKEN MEALS - ADD ADD-ONS VARIANT (Already has Flavor from migrate_menu_variants.sql)
-- ============================================================================
WITH chicken_meal_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Meal' AND category = 'Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM chicken_meal_item
WHERE EXISTS (SELECT 1 FROM menu_items_base WHERE name = 'Chicken Meal' AND category = 'Chicken');

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Meal' AND mb.category = 'Chicken' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Rice', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Gravy', 10, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Coleslaw', 15, true, 3 FROM addon_type;

-- ============================================================================
-- 16. CHICKEN PLATTER - ADD ADD-ONS VARIANT (Already has Flavor from migrate_menu_variants.sql)
-- ============================================================================
WITH chicken_platter_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Platter' AND category = 'Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM chicken_platter_item
WHERE EXISTS (SELECT 1 FROM menu_items_base WHERE name = 'Chicken Platter' AND category = 'Chicken');

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter' AND mb.category = 'Chicken' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Rice', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Gravy', 10, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Coleslaw', 15, true, 3 FROM addon_type;

-- ============================================================================
-- 17. CHICKEN BURGER - ADD ADD-ONS VARIANT (Already has Flavor from migrate_menu_variants.sql)
-- ============================================================================
WITH burger_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Burger' AND category = 'Burgers' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM burger_item
WHERE EXISTS (SELECT 1 FROM menu_items_base WHERE name = 'Chicken Burger' AND category = 'Burgers');

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Burger' AND mb.category = 'Burgers' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Fries', 30, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Extra Patty', 35, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 15, true, 3 FROM addon_type;

-- ============================================================================
-- RICE MEALS SECTION
-- ============================================================================

-- ============================================================================
-- 18. SILOG MEALS - ADD ADD-ONS VARIANT (Already has Meat/Variety from migrate_menu_variants.sql)
-- ============================================================================
WITH silog_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Silog' AND category = 'Rice Meals' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM silog_item
WHERE EXISTS (SELECT 1 FROM menu_items_base WHERE name = 'Silog' AND category = 'Rice Meals');

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Silog' AND mb.category = 'Rice Meals' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Extra Rice', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Extra Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Atchara', 10, true, 3 FROM addon_type;

-- ============================================================================
-- BREAKFAST/SNACKS SECTION
-- ============================================================================

-- ============================================================================
-- 19. WAFFLES (Variety)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Waffles', 'Breakfast & Snacks', 79.00, true, 'Delicious waffles with your choice of variety', true)
ON CONFLICT DO NOTHING;

-- Add Variety variant type (required)
WITH waffles_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Waffles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Variety', true, false, 1 FROM waffles_item;

-- Add variety options
WITH variety_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Waffles' AND vt.variant_type_name = 'Variety'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Plain', 0, true, 1 FROM variety_type
UNION ALL
SELECT id, 'Chocolate', 10, true, 2 FROM variety_type
UNION ALL
SELECT id, 'Strawberry', 10, true, 3 FROM variety_type
UNION ALL
SELECT id, 'Blueberry', 15, true, 4 FROM variety_type
UNION ALL
SELECT id, 'Nutella', 20, true, 5 FROM variety_type;

-- ============================================================================
-- SANDWICHES/BURGERS SECTION
-- ============================================================================

-- ============================================================================
-- 20. CLUBHOUSE (Add-ons)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Clubhouse', 'Sandwiches', 129.00, true, 'Classic clubhouse sandwich with optional add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Add-ons variant type (optional, multiple selection)
WITH clubhouse_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Clubhouse' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 1 FROM clubhouse_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Clubhouse' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Fries', 30, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Extra Bacon', 25, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Extra Cheese', 15, true, 3 FROM addon_type;

-- ============================================================================
-- 21. FOOTLONG (Spicy/Regular + Add-ons + No Veggies option)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Footlong', 'Sandwiches', 99.00, true, 'Footlong sandwich with your choice of spice level and add-ons', true)
ON CONFLICT DO NOTHING;

-- Add Spice Level variant type (required)
WITH footlong_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Footlong' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM footlong_item;

-- Add spice level options
WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Footlong' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Regular', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

-- Add Add-ons variant type (optional, multiple selection)
WITH footlong_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Footlong' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add-ons', false, true, 2 FROM footlong_item;

-- Add add-on options
WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Footlong' AND vt.variant_type_name = 'Add-ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Fries', 30, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Extra Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'No Veggies', 0, true, 3 FROM addon_type;

-- ============================================================================
-- ITEMS WITHOUT VARIANTS (Just base items, no subcategories)
-- ============================================================================

-- ============================================================================
-- 22. SPAM MUSUBI (No variants)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Spam Musubi', 'Japanese', 69.00, false, 'Hawaiian-style spam musubi', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 23. SUSHI (No variants)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Sushi', 'Japanese', 149.00, false, 'Fresh sushi rolls', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 24. CAESAR SALAD (No variants)
-- ============================================================================
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Caesar Salad', 'Salads', 99.00, false, 'Classic Caesar salad', true)
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
  vt.allow_multiple,
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
  RAISE NOTICE 'Complete Menu Variants Migration Finished!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'All menu items have been migrated with their variants:';
  RAISE NOTICE '- Beverages: Milktea, Hot/Iced Drinks, Frappe, Fruit Soda & Lemonade';
  RAISE NOTICE '- Appetizers: Nachos, Fries, Siomai, Calamares (with updates)';
  RAISE NOTICE '- Pasta & Noodles: All items with Solo/Overload, Spicy levels, Add-ons';
  RAISE NOTICE '- Chicken: All items with Flavors and Add-ons';
  RAISE NOTICE '- Rice Meals: Silog with varieties and Add-ons';
  RAISE NOTICE '- Sandwiches: Clubhouse, Footlong with variants';
  RAISE NOTICE '- Breakfast & Snacks: Waffles with varieties';
  RAISE NOTICE '- Items without variants: Spam Musubi, Sushi, Caesar Salad';
  RAISE NOTICE '============================================================';
END $$;
