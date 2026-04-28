-- ============================================================================
-- Migration: 024_create_categories_table
-- Description: Create categories table with only the 8 standard menu categories
-- Created: 2026-04-28
-- Updated: 2026-04-28 - Fixed to only include 8 standard categories
--
-- This migration creates:
-- 1. categories table with id, name, and sort_order
-- 2. Seeds ONLY the 8 standard categories (prevents duplicate/subcategory tabs)
-- 3. RLS policies for categories table
-- 4. Cleans up any non-standard categories that might exist
-- ============================================================================

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on sort_order for efficient ordering
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies - anyone can view categories
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can manage categories" ON categories;
CREATE POLICY "Staff can manage categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Clean up any non-standard categories that might exist
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

-- Seed only the 8 standard categories (not all categories from menu_items_base)
-- This prevents showing duplicate/subcategory tabs in the UI
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
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE categories IS 'Menu categories for organizing menu items';
COMMENT ON COLUMN categories.name IS 'Category name (e.g., Snacks & Bites, Noodles, etc.)';
COMMENT ON COLUMN categories.sort_order IS 'Display order for categories (lower numbers appear first)';
