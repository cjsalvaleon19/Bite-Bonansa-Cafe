-- Migration 134: Assign kitchen departments to menu items
-- Purpose: Add kitchen_department_id to menu_items_base, expose it through the
--          menu_items view (plus a convenience kitchen_department text column),
--          update the view triggers, and assign every menu item to its correct
--          kitchen department so that order-slip routing works per department.
--
-- Kitchen departments:
--   DRNK  – Drinks    (milkteas, hot/iced, frappes, sodas, juices)
--   FRY1  – Fryer 1   (nachos, fries, calamares, spag, ramyeon, chicken, silog)
--   FRY2  – Fryer 2   (samyang, tteokbokki, siomai, clubhouse, footlong, spam musubi, sushi, caesar)
--   PAST  – Pastries  (waffles)

-- ── 1. Add kitchen_department_id to menu_items_base ──────────────────────────

ALTER TABLE menu_items_base
  ADD COLUMN IF NOT EXISTS kitchen_department_id UUID REFERENCES kitchen_departments(id);

CREATE INDEX IF NOT EXISTS idx_menu_items_base_kitchen_dept
  ON menu_items_base(kitchen_department_id);

-- ── 2. Ensure all four kitchen departments exist ─────────────────────────────

INSERT INTO kitchen_departments (department_name, department_code, description) VALUES
  ('Drinks',   'DRNK', 'Beverages: milkteas, hot/iced drinks, frappes, sodas, juices'),
  ('Fryer 1',  'FRY1', 'Fryer 1: nachos, fries, calamares, spaghetti, ramyeon, chicken, silog'),
  ('Fryer 2',  'FRY2', 'Fryer 2: samyang, tteokbokki, siomai, sandwiches, Japanese items'),
  ('Pastries', 'PAST', 'Pastries and baked goods')
ON CONFLICT (department_code) DO UPDATE
  SET department_name = EXCLUDED.department_name,
      description     = EXCLUDED.description;

-- ── 3. Assign departments to every named menu item ───────────────────────────

-- 3a. Kitchen Department: Drinks
UPDATE menu_items_base
SET kitchen_department_id = (
  SELECT id FROM kitchen_departments WHERE department_code = 'DRNK'
)
WHERE name IN (
  -- Milktea Series (1.01–1.16)
  'Brown Sugar Milktea',
  'Wintermelon Milktea',
  'Okinawa Milktea',
  'Hokkaido Milktea',
  'Ube Taro Milktea',
  'Red Velvet Milktea',
  'Strawberry Milktea',
  'Matcha Milktea',
  'Cookies & Cream Milktea',
  'Dark Chocolate Milktea',
  'Strawberry Matcha Milktea',
  'Blueberry Matcha Milktea',
  'Oreo Matcha Milktea',
  'Mocha Milktea',
  'Caramel Macchiato Milktea',
  'Brown Sugar Coffee Milktea',
  -- Hot/Iced Drinks (1.17–1.35)
  'Americano',
  'Spanish Latte',
  'Cafe Latte',
  'Caramel Macchiato',
  'Cafe Mocha',
  'Mocha Latte',
  'Caramel Mocha',
  'Matcha Espresso',
  'White Choco Matcha Latte',
  'Dark Chocolate',
  'Matcha Latte',
  'Strawberry Latte',
  'Blueberry Latte',
  'Ube Taro Latte',
  'Biscoff Latte',
  'Biscoff Matcha Latte',
  'Biscoff Cafe Latte',
  'Passion Fruit Latte',
  'Oreo Latte',
  -- Frappe Series (1.36–1.46)
  'Caramel Macchiato Frappe',
  'Cookies & Cream Frappe',
  'Matcha Frappe',
  'Strawberry Frappe',
  'Red Velvet Frappe',
  'Ube Taro Frappe',
  'Dark Chocolate Frappe',
  'Mocha Frappe',
  'Mocha Latte Frappe',
  'Lotus Biscoff Frappe',
  'Mango Graham Frappe',
  -- Fruit Soda & Lemonade (1.47–1.57)
  'Strawberry Soda',
  'Green Apple Soda',
  'Blue Lemonade Soda',
  'Lychee Soda',
  'Blueberry Soda',
  'Passion Fruit Soda',
  'Lemonade Juice',
  'Lemon Strawberry Juice',
  'Lemon Blueberry Juice',
  'Lemon Passion Fruit Juice',
  'Lemon Yogurt Slush'
);

-- 3b. Kitchen Department: Fryer 1
UPDATE menu_items_base
SET kitchen_department_id = (
  SELECT id FROM kitchen_departments WHERE department_code = 'FRY1'
)
WHERE name IN (
  -- Snacks / Appetizers (2.01–2.03)
  'Nachos',
  'Fries',
  'Calamares',
  -- Pasta & Noodles – Fryer 1 items (2.04–2.07)
  'Spag Solo',
  'Spag & Chicken',
  'Ramyeon Solo',
  'Ramyeon Overload',
  -- Chicken & Rice (2.08–2.11)
  'Chicken Meals',
  'Chicken Platter',
  'Chicken Burger',
  'Silog Meals'
);

-- 3c. Kitchen Department: Fryer 2
UPDATE menu_items_base
SET kitchen_department_id = (
  SELECT id FROM kitchen_departments WHERE department_code = 'FRY2'
)
WHERE name IN (
  -- Samyang (3.01–3.03)
  'Samyang Carbonara Solo',
  'Samyang Carbonara Overload',
  'Samyang Carbonara & Chicken',
  -- Tteokbokki (3.04–3.05)
  'Tteokbokki Solo',
  'Tteokbokki Overload',
  -- Sandwiches & Japanese (3.06–3.11)
  'Siomai',
  'Clubhouse',
  'Footlong',
  'Spam Musubi',
  'Sushi',
  'Caesar Salad'
);

-- 3d. Kitchen Department: Pastries
UPDATE menu_items_base
SET kitchen_department_id = (
  SELECT id FROM kitchen_departments WHERE department_code = 'PAST'
)
WHERE name IN (
  'Waffles'
);

-- ── 4. Recreate menu_items view to expose kitchen_department_id and
--       a convenience kitchen_department text column ─────────────────────────

-- Drop existing triggers that reference the view first
DROP TRIGGER IF EXISTS menu_items_insert_trigger ON menu_items;
DROP TRIGGER IF EXISTS menu_items_update_trigger ON menu_items;
DROP TRIGGER IF EXISTS menu_items_delete_trigger ON menu_items;

DROP VIEW IF EXISTS menu_items CASCADE;

CREATE VIEW menu_items AS
SELECT
  mb.id,
  mb.name,
  mb.category,
  mb.base_price AS price,
  mb.base_price,
  mb.image_url,
  mb.description,
  mb.available,
  mb.has_variants,
  mb.is_sold_out,
  mb.kitchen_department_id,
  kd.department_name AS kitchen_department,
  mb.created_at,
  mb.updated_at
FROM menu_items_base mb
LEFT JOIN kitchen_departments kd ON mb.kitchen_department_id = kd.id;

COMMENT ON VIEW menu_items IS
  'Updatable view on menu_items_base. Exposes kitchen_department_id (FK) and '
  'kitchen_department (text name) for order-slip routing.';

-- ── 5. Recreate INSTEAD OF triggers ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION menu_items_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO menu_items_base (
    id, name, category, base_price, image_url, description,
    available, has_variants, is_sold_out, kitchen_department_id,
    created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.name,
    NEW.category,
    COALESCE(NEW.base_price, NEW.price),
    NEW.image_url,
    NEW.description,
    NEW.available,
    NEW.has_variants,
    NEW.is_sold_out,
    NEW.kitchen_department_id,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION menu_items_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE menu_items_base
  SET
    name                  = NEW.name,
    category              = NEW.category,
    base_price            = COALESCE(NEW.base_price, NEW.price),
    image_url             = NEW.image_url,
    description           = NEW.description,
    available             = NEW.available,
    has_variants          = NEW.has_variants,
    is_sold_out           = NEW.is_sold_out,
    kitchen_department_id = NEW.kitchen_department_id,
    updated_at            = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION menu_items_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM menu_items_base WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menu_items_insert_trigger
  INSTEAD OF INSERT ON menu_items
  FOR EACH ROW EXECUTE FUNCTION menu_items_insert();

CREATE TRIGGER menu_items_update_trigger
  INSTEAD OF UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION menu_items_update();

CREATE TRIGGER menu_items_delete_trigger
  INSTEAD OF DELETE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION menu_items_delete();

COMMENT ON TRIGGER menu_items_insert_trigger ON menu_items IS
  'Makes menu_items view insertable by redirecting to menu_items_base table';
COMMENT ON TRIGGER menu_items_update_trigger ON menu_items IS
  'Makes menu_items view updatable by redirecting to menu_items_base table';
COMMENT ON TRIGGER menu_items_delete_trigger ON menu_items IS
  'Makes menu_items view deletable by redirecting to menu_items_base table';

-- ── 6. Verify: warn if any available item is still unassigned ─────────────────

DO $$
DECLARE
  unassigned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unassigned_count
  FROM menu_items_base
  WHERE kitchen_department_id IS NULL AND available = TRUE;

  IF unassigned_count > 0 THEN
    RAISE WARNING '⚠ % available menu item(s) have no kitchen department assigned.', unassigned_count;
  ELSE
    RAISE NOTICE '✓ Migration 134 complete: all available menu items have a kitchen department.';
  END IF;
END
$$;
