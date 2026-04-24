-- ============================================================================
-- Migration: 013_Update_Menu_Pricing_Complete
-- Description: Update menu pricing with complete variant system
-- Created: 2026-04-24
-- 
-- This migration:
-- 1. Deletes existing menu items and their variants
-- 2. Seeds new menu with updated pricing from spreadsheet
-- 3. Includes all variants: sizes, varieties, spice levels, flavors, sauces, add-ons
-- ============================================================================

-- Clear existing data
DELETE FROM menu_item_variant_options;
DELETE FROM menu_item_variant_types;
DELETE FROM menu_items_base;

-- ============================================================================
-- SNACKS & BITES CATEGORY
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NACHOS (₱94 base) - Sauce variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Nachos', 'Snacks & Bites', 94.00, true, 'Crispy nachos with your choice of sauce', true);

WITH nachos_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Nachos' AND category = 'Snacks & Bites' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Sauce', true, false, 1 FROM nachos_item;

WITH sauce_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Nachos' AND vt.variant_type_name = 'Sauce'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Sinamak', 0, true, 1 FROM sauce_type
UNION ALL
SELECT id, 'Meaty Sauce', 0, true, 2 FROM sauce_type
UNION ALL
SELECT id, 'Mayonnaise', 0, true, 3 FROM sauce_type;

-- ----------------------------------------------------------------------------
-- 2. FRIES (₱94 base) - Flavor variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Fries', 'Snacks & Bites', 94.00, true, 'Crispy fries with your choice of flavor', true);

WITH fries_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Fries' AND category = 'Snacks & Bites' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM fries_item;

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
SELECT id, 'Barbeque', 0, true, 4 FROM flavor_type;

-- ----------------------------------------------------------------------------
-- 3. SIOMAI (₱74 base) - Variety and Spice Level variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Siomai', 'Snacks & Bites', 74.00, true, 'Delicious pork dumplings', true);

WITH siomai_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Siomai' AND category = 'Snacks & Bites' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Variety', true, false, 1 FROM siomai_item
UNION ALL
SELECT id, 'Spice Level', true, false, 2 FROM siomai_item;

WITH variety_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Siomai' AND vt.variant_type_name = 'Variety'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Steamed', 0, true, 1 FROM variety_type
UNION ALL
SELECT id, 'Fried', 0, true, 2 FROM variety_type;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Siomai' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Spicy', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Regular', 0, true, 2 FROM spice_type;

-- ----------------------------------------------------------------------------
-- 4. CALAMARES (₱94 base) - Sauce variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Calamares', 'Snacks & Bites', 94.00, true, 'Fried squid rings with your choice of sauce', true);

WITH calamares_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Calamares' AND category = 'Snacks & Bites' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Sauce', true, false, 1 FROM calamares_item;

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
SELECT id, 'Mayonnaise', 0, true, 3 FROM sauce_type;

-- ============================================================================
-- NOODLES CATEGORY
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5. SPAG SOLO (₱94 base) - Add On variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Spag Solo', 'Noodles', 94.00, true, 'Classic spaghetti solo', true);

WITH spag_solo_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Spag Solo' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add Ons', false, false, 1 FROM spag_solo_item;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Spag Solo' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Meaty Sauce', 15, true, 1 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 6. SPAG & CHICKEN (₱134 base) - Add On variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Spag & Chicken', 'Noodles', 134.00, true, 'Spaghetti with chicken', true);

WITH spag_chicken_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Spag & Chicken' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add Ons', false, false, 1 FROM spag_chicken_item;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Spag & Chicken' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Meaty Sauce', 15, true, 1 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 7. RAMYEON SOLO (₱104 base) - Spice Level and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Ramyeon Solo', 'Noodles', 104.00, true, 'Korean instant noodles', true);

WITH ramyeon_solo_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Ramyeon Solo' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM ramyeon_solo_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM ramyeon_solo_item;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ramyeon Solo' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ramyeon Solo' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Spam', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 20, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 8. RAMYEON OVERLOAD (₱139 base) - Spice Level and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Ramyeon Overload', 'Noodles', 139.00, true, 'Loaded Korean instant noodles', true);

WITH ramyeon_overload_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Ramyeon Overload' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM ramyeon_overload_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM ramyeon_overload_item;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ramyeon Overload' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Ramyeon Overload' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Spam', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 20, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 9. SAMYANG CARBONARA SOLO (₱134-139) - Spice Level and Add Ons variants
-- Note: Base price ₱134, Cheese add-on makes it ₱139
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Samyang Carbonara Solo', 'Noodles', 134.00, true, 'Spicy carbonara noodles', true);

WITH samyang_solo_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara Solo' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM samyang_solo_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM samyang_solo_item;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara Solo' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara Solo' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Spam', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 20, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 10. SAMYANG CARBONARA OVERLOAD (₱174 base) - Spice Level and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Samyang Carbonara Overload', 'Noodles', 174.00, true, 'Loaded spicy carbonara noodles', true);

WITH samyang_overload_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara Overload' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM samyang_overload_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM samyang_overload_item;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara Overload' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara Overload' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Spam', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 20, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 11. SAMYANG CARBONARA & CHICKEN (₱174 base) - Spice Level and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Samyang Carbonara & Chicken', 'Noodles', 174.00, true, 'Spicy carbonara noodles with chicken', true);

WITH samyang_chicken_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Samyang Carbonara & Chicken' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM samyang_chicken_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM samyang_chicken_item;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara & Chicken' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Samyang Carbonara & Chicken' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Spam', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 20, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 12. TTEOKBOKKI SOLO (₱144 base) - Spice Level and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Tteokbokki Solo', 'Noodles', 144.00, true, 'Korean rice cakes in spicy sauce', true);

WITH tteokbokki_solo_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Tteokbokki Solo' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM tteokbokki_solo_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM tteokbokki_solo_item;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Tteokbokki Solo' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Tteokbokki Solo' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Spam', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 20, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 13. TTEOKBOKKI OVERLOAD (₱179 base) - Spice Level and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Tteokbokki Overload', 'Noodles', 179.00, true, 'Loaded Korean rice cakes in spicy sauce', true);

WITH tteokbokki_overload_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Tteokbokki Overload' AND category = 'Noodles' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM tteokbokki_overload_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM tteokbokki_overload_item;

WITH spice_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Tteokbokki Overload' AND vt.variant_type_name = 'Spice Level'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 1 FROM spice_type
UNION ALL
SELECT id, 'Spicy', 0, true, 2 FROM spice_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Tteokbokki Overload' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Spam', 20, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Egg', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Cheese', 20, true, 3 FROM addon_type;

-- ============================================================================
-- CHICKEN CATEGORY
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 14. CHICKEN MEALS (₱84 base) - Flavor and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Chicken Meals', 'Chicken', 84.00, true, 'Delicious chicken meal with your choice of flavor', true);

WITH chicken_meals_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Meals' AND category = 'Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM chicken_meals_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM chicken_meals_item;

WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Meals' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Honey Butter', 0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Soy Garlic', 0, true, 2 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Sour', 0, true, 3 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Spicy', 0, true, 4 FROM flavor_type
UNION ALL
SELECT id, 'Teriyaki', 0, true, 5 FROM flavor_type
UNION ALL
SELECT id, 'Buffalo', 0, true, 6 FROM flavor_type
UNION ALL
SELECT id, 'Barbecue', 0, true, 7 FROM flavor_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Meals' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Rice', 15, true, 1 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 15. CHICKEN PLATTER (₱254 base) - Flavor and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Chicken Platter', 'Chicken', 254.00, true, 'Generous chicken platter with your choice of flavor', true);

WITH chicken_platter_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Platter' AND category = 'Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM chicken_platter_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM chicken_platter_item;

WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Honey Butter', 0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Soy Garlic', 0, true, 2 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Sour', 0, true, 3 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Spicy', 0, true, 4 FROM flavor_type
UNION ALL
SELECT id, 'Teriyaki', 0, true, 5 FROM flavor_type
UNION ALL
SELECT id, 'Buffalo', 0, true, 6 FROM flavor_type
UNION ALL
SELECT id, 'Barbecue', 0, true, 7 FROM flavor_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Platter' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Rice', 15, true, 1 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 16. CHICKEN BURGER (₱104 base) - Flavor variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Chicken Burger', 'Chicken', 104.00, true, 'Tasty chicken burger with your choice of flavor', true);

WITH chicken_burger_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Burger' AND category = 'Chicken' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM chicken_burger_item;

WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Burger' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Honey Butter', 0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Soy Garlic', 0, true, 2 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Sour', 0, true, 3 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Spicy', 0, true, 4 FROM flavor_type
UNION ALL
SELECT id, 'Teriyaki', 0, true, 5 FROM flavor_type
UNION ALL
SELECT id, 'Buffalo', 0, true, 6 FROM flavor_type
UNION ALL
SELECT id, 'Barbecue', 0, true, 7 FROM flavor_type
UNION ALL
SELECT id, 'Original', 0, true, 8 FROM flavor_type;

-- ============================================================================
-- RICE & MORE CATEGORY
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 17. SILOG MEALS (₱114 base) - Variety variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Silog Meals', 'Rice & More', 114.00, true, 'Filipino breakfast meals', true);

WITH silog_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Silog Meals' AND category = 'Rice & More' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Variety', true, false, 1 FROM silog_item;

WITH variety_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Silog Meals' AND vt.variant_type_name = 'Variety'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Luncheonsilog', 0, true, 1 FROM variety_type
UNION ALL
SELECT id, 'Tapsilog', 0, true, 2 FROM variety_type
UNION ALL
SELECT id, 'Tocilog', 0, true, 3 FROM variety_type
UNION ALL
SELECT id, 'Cornsilog', 0, true, 4 FROM variety_type
UNION ALL
SELECT id, 'Chicsilog', 0, true, 5 FROM variety_type
UNION ALL
SELECT id, 'Hotsilog', 0, true, 6 FROM variety_type
UNION ALL
SELECT id, 'Siomaisilog', 0, true, 7 FROM variety_type;

-- ----------------------------------------------------------------------------
-- 18. WAFFLES (₱104 base) - Variety variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Waffles', 'Rice & More', 104.00, true, 'Fresh waffles with toppings', true);

WITH waffles_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Waffles' AND category = 'Rice & More' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Variety', true, false, 1 FROM waffles_item;

WITH variety_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Waffles' AND vt.variant_type_name = 'Variety'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Biscoff', 0, true, 1 FROM variety_type
UNION ALL
SELECT id, 'Strawberry', 0, true, 2 FROM variety_type
UNION ALL
SELECT id, 'Oreo', 0, true, 3 FROM variety_type
UNION ALL
SELECT id, 'Mallows', 0, true, 4 FROM variety_type;

-- ----------------------------------------------------------------------------
-- 19. CLUBHOUSE (₱104 base) - Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Clubhouse', 'Rice & More', 104.00, true, 'Classic clubhouse sandwich', true);

WITH clubhouse_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Clubhouse' AND category = 'Rice & More' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Add Ons', false, false, 1 FROM clubhouse_item;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Clubhouse' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No veggies', 0, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Spam', 15, true, 2 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 20. FOOTLONG (₱94 base) - Spice Level and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Footlong', 'Rice & More', 94.00, true, 'Footlong hotdog sandwich', true);

WITH footlong_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Footlong' AND category = 'Rice & More' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Spice Level', true, false, 1 FROM footlong_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM footlong_item;

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

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Footlong' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No veggies', 0, true, 1 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 21. SPAM MUSUBI (₱104 base)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Spam Musubi', 'Rice & More', 104.00, false, 'Japanese-Hawaiian rice and spam snack', true);

-- ----------------------------------------------------------------------------
-- 22. SUSHI (₱104 base)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Sushi', 'Rice & More', 104.00, false, 'Fresh sushi', true);

-- ----------------------------------------------------------------------------
-- 23. CAESAR SALAD (₱104 base)
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Caesar Salad', 'Rice & More', 104.00, false, 'Classic Caesar salad', true);

-- ============================================================================
-- MILKTEA SERIES CATEGORY
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 24. BROWN SUGAR MILKTEA - Size and Add Ons variants
-- Base price ₱99 for 16oz, ₱114 for 22oz
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Brown Sugar Milktea', 'Milktea Series', 99.00, true, 'Brown sugar milktea with your choice of size and add-ons', true);

WITH milktea_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Brown Sugar Milktea' AND category = 'Milktea Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM milktea_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM milktea_item;

WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Brown Sugar Milktea' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Brown Sugar Milktea' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 25. WINTERMELON MILKTEA - Size and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Wintermelon Milktea', 'Milktea Series', 99.00, true, 'Wintermelon milktea with your choice of size and add-ons', true);

WITH milktea_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Wintermelon Milktea' AND category = 'Milktea Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM milktea_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM milktea_item;

WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Wintermelon Milktea' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Wintermelon Milktea' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 26. OKINAWA MILKTEA - Size and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Okinawa Milktea', 'Milktea Series', 99.00, true, 'Okinawa milktea with your choice of size and add-ons', true);

WITH milktea_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Okinawa Milktea' AND category = 'Milktea Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM milktea_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM milktea_item;

WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Okinawa Milktea' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Okinawa Milktea' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 3 FROM addon_type;

-- ----------------------------------------------------------------------------
-- 27. HOKKAIDO MILKTEA - Size and Add Ons variants
-- ----------------------------------------------------------------------------
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, available)
VALUES ('Hokkaido Milktea', 'Milktea Series', 99.00, true, 'Hokkaido milktea with your choice of size and add-ons', true);

WITH milktea_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Hokkaido Milktea' AND category = 'Milktea Series' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Size', true, false, 1 FROM milktea_item
UNION ALL
SELECT id, 'Add Ons', false, false, 2 FROM milktea_item;

WITH size_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Hokkaido Milktea' AND vt.variant_type_name = 'Size'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, '16oz', 0, true, 1 FROM size_type
UNION ALL
SELECT id, '22oz', 15, true, 2 FROM size_type;

WITH addon_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Hokkaido Milktea' AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'No Add Ons', 0, true, 0 FROM addon_type
UNION ALL
SELECT id, 'Pearls', 15, true, 1 FROM addon_type
UNION ALL
SELECT id, 'Cream Cheese', 15, true, 2 FROM addon_type
UNION ALL
SELECT id, 'Coffee Jelly', 15, true, 3 FROM addon_type;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Total items: 27
-- Categories: Snacks & Bites (4), Noodles (9), Chicken (3), Rice & More (7), Milktea Series (4)
-- All prices updated according to the spreadsheet
-- All variants properly configured
-- Milktea items have Size variants (16oz/22oz) and Add-ons (Pearls, Cream Cheese, Coffee Jelly)
-- ============================================================================
