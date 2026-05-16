-- ============================================================================
-- Migration: 159_add_mineral_water_to_others
-- Description: Add "Mineral Water" under "Others" with price ₱20.00
-- Created: 2026-05-16
-- ============================================================================

-- Keep existing record aligned if it already exists
UPDATE menu_items_base
SET
  base_price = 20.00,
  has_variants = false,
  available = true,
  updated_at = NOW()
WHERE name = 'Mineral Water'
  AND category = 'Others';

-- Insert item when missing
INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
SELECT 'Mineral Water', 'Others', 20.00, false, true
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items_base
  WHERE name = 'Mineral Water'
    AND category = 'Others'
);

-- Assign to Drinks kitchen department
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM kitchen_departments
    WHERE department_code = 'DRNK'
  ) THEN
    RAISE EXCEPTION 'kitchen_departments entry with department_code=DRNK is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM menu_items_base
    WHERE name = 'Mineral Water'
      AND category = 'Others'
  ) THEN
    RAISE EXCEPTION 'menu item Mineral Water in Others was not created';
  END IF;

  UPDATE menu_items_base
  SET kitchen_department_id = (
    SELECT id
    FROM kitchen_departments
    WHERE department_code = 'DRNK'
  )
  WHERE name = 'Mineral Water'
    AND category = 'Others';
END $$;
