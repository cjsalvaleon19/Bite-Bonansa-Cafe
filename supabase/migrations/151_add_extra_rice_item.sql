-- ============================================================================
-- Migration: 151_add_extra_rice_item
-- Description: Add "Extra Rice" under "Rice & More" with price ₱15.00
-- Created: 2026-05-13
-- ============================================================================

-- Keep existing record aligned if it already exists
UPDATE menu_items_base
SET
  base_price = 15.00,
  has_variants = false,
  available = true,
  updated_at = NOW()
WHERE name = 'Extra Rice'
  AND category = 'Rice & More';

-- Insert item when missing
INSERT INTO menu_items_base (name, category, base_price, has_variants, available)
SELECT 'Extra Rice', 'Rice & More', 15.00, false, true
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_items_base
  WHERE name = 'Extra Rice'
    AND category = 'Rice & More'
);

-- Assign to Fryer 1 kitchen department (same lane as Silog Meals)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM kitchen_departments
    WHERE department_code = 'FRY1'
  ) THEN
    RAISE EXCEPTION 'kitchen_departments entry with department_code=FRY1 is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM menu_items_base
    WHERE name = 'Extra Rice'
      AND category = 'Rice & More'
  ) THEN
    RAISE EXCEPTION 'menu item Extra Rice in Rice & More was not created';
  END IF;
END $$;

UPDATE menu_items_base
SET kitchen_department_id = (
  SELECT id
  FROM kitchen_departments
  WHERE department_code = 'FRY1'
)
WHERE name = 'Extra Rice'
  AND category = 'Rice & More';
