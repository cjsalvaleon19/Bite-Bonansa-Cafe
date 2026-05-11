-- ============================================================================
-- Migration: 138_add_others_category_menu_items
-- Description: Add "Others" menu category with canned drinks and juices,
--              each with a "Flavor" subvariant where applicable.
--
-- Items added:
--   Coke in Can         ₱55  — Flavor: Regular, Zero
--   Pepsi in Can        ₱55  — Flavor: Regular
--   Minute Maid         ₱55  — Flavor: Orange, Orange Mango
--   Rite 'N Lite        ₱55  — Flavor: Cucumber, Lemon, Root Beer
--   Mismo               ₱25  — Flavor: Coke
--   Del Monte Juice in Can ₱55 — Flavor: Pineapple, Four Seasons,
--                                        Pineapple Fiber, Pineapple Orange, Mango
--   Calamansi Juice     ₱35  — (no subvariant)
-- ============================================================================

-- ── 1. COKE IN CAN ───────────────────────────────────────────────────────────

INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
VALUES ('Coke in Can', 'Others', 55.00, true, true)
ON CONFLICT DO NOTHING;

WITH item AS (
  SELECT id FROM menu_items_base WHERE name = 'Coke in Can' AND category = 'Others' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM item
ON CONFLICT DO NOTHING;

WITH flavor_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Coke in Can' AND mb.category = 'Others'
    AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Regular', 0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Zero',    0, true, 2 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ── 2. PEPSI IN CAN ──────────────────────────────────────────────────────────

INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
VALUES ('Pepsi in Can', 'Others', 55.00, true, true)
ON CONFLICT DO NOTHING;

WITH item AS (
  SELECT id FROM menu_items_base WHERE name = 'Pepsi in Can' AND category = 'Others' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM item
ON CONFLICT DO NOTHING;

WITH flavor_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Pepsi in Can' AND mb.category = 'Others'
    AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Regular', 0, true, 1 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ── 3. MINUTE MAID ───────────────────────────────────────────────────────────

INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
VALUES ('Minute Maid', 'Others', 55.00, true, true)
ON CONFLICT DO NOTHING;

WITH item AS (
  SELECT id FROM menu_items_base WHERE name = 'Minute Maid' AND category = 'Others' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM item
ON CONFLICT DO NOTHING;

WITH flavor_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Minute Maid' AND mb.category = 'Others'
    AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Orange',       0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Orange Mango', 0, true, 2 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ── 4. RITE 'N LITE ──────────────────────────────────────────────────────────

INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
VALUES ('Rite ''N Lite', 'Others', 55.00, true, true)
ON CONFLICT DO NOTHING;

WITH item AS (
  SELECT id FROM menu_items_base WHERE name = 'Rite ''N Lite' AND category = 'Others' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM item
ON CONFLICT DO NOTHING;

WITH flavor_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Rite ''N Lite' AND mb.category = 'Others'
    AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Cucumber', 0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Lemon',    0, true, 2 FROM flavor_type
UNION ALL
SELECT id, 'Root Beer', 0, true, 3 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ── 5. MISMO ─────────────────────────────────────────────────────────────────

INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
VALUES ('Mismo', 'Others', 25.00, true, true)
ON CONFLICT DO NOTHING;

WITH item AS (
  SELECT id FROM menu_items_base WHERE name = 'Mismo' AND category = 'Others' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM item
ON CONFLICT DO NOTHING;

WITH flavor_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Mismo' AND mb.category = 'Others'
    AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Coke', 0, true, 1 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ── 6. DEL MONTE JUICE IN CAN ────────────────────────────────────────────────

INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
VALUES ('Del Monte Juice in Can', 'Others', 55.00, true, true)
ON CONFLICT DO NOTHING;

WITH item AS (
  SELECT id FROM menu_items_base WHERE name = 'Del Monte Juice in Can' AND category = 'Others' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM item
ON CONFLICT DO NOTHING;

WITH flavor_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Del Monte Juice in Can' AND mb.category = 'Others'
    AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Pineapple',        0, true, 1 FROM flavor_type
UNION ALL
SELECT id, 'Four Seasons',     0, true, 2 FROM flavor_type
UNION ALL
SELECT id, 'Pineapple Fiber',  0, true, 3 FROM flavor_type
UNION ALL
SELECT id, 'Pineapple Orange', 0, true, 4 FROM flavor_type
UNION ALL
SELECT id, 'Mango',            0, true, 5 FROM flavor_type
ON CONFLICT DO NOTHING;

-- ── 7. CALAMANSI JUICE ───────────────────────────────────────────────────────

INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
VALUES ('Calamansi Juice', 'Others', 35.00, false, true)
ON CONFLICT DO NOTHING;

-- ── 8. Assign all "Others" items to the Drinks kitchen department ─────────────

UPDATE menu_items_base
SET kitchen_department_id = (
  SELECT id FROM kitchen_departments WHERE department_code = 'DRNK'
)
WHERE category = 'Others'
  AND kitchen_department_id IS NULL;
