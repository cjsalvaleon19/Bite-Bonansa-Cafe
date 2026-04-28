-- ============================================================================
-- Migration: 025_cleanup_duplicate_categories
-- Description: Remove duplicate and non-standard categories from categories table
-- Created: 2026-04-28
--
-- This migration fixes databases where migration 024 was run with the old code
-- that extracted all categories from menu_items_base (including duplicates and
-- subcategories like Beverages, Salads, Breakfast & Snacks, etc.)
--
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- Delete all non-standard categories
-- This removes duplicates and subcategories that shouldn't appear as main tabs
DELETE FROM categories 
WHERE name NOT IN (
  'Snacks & Bites',
  'Noodles',
  'Chicken',
  'Rice & More',
  'Milktea Series',
  'Hot/iced Drinks',
  'Frappe Series',
  'Fruit Soda & Lemonade'
);

-- Ensure the 8 standard categories exist with correct sort order
INSERT INTO categories (name, sort_order)
VALUES 
  ('Snacks & Bites', 1),
  ('Noodles', 2),
  ('Chicken', 3),
  ('Rice & More', 4),
  ('Milktea Series', 5),
  ('Hot/iced Drinks', 6),
  ('Frappe Series', 7),
  ('Fruit Soda & Lemonade', 8)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order;

-- Verify the fix
DO $$
DECLARE
  category_count INT;
BEGIN
  SELECT COUNT(*) INTO category_count FROM categories;
  IF category_count != 8 THEN
    RAISE WARNING 'Expected 8 categories, found %', category_count;
  ELSE
    RAISE NOTICE 'Categories table successfully cleaned up: 8 standard categories';
  END IF;
END $$;

COMMENT ON TABLE categories IS 'Menu categories - only the 8 standard main categories';
