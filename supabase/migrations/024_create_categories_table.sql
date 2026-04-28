-- ============================================================================
-- Migration: 024_create_categories_table
-- Description: Create categories table to properly organize menu items
-- Created: 2026-04-28
--
-- This migration creates:
-- 1. categories table with id, name, and sort_order
-- 2. Seeds all existing categories from menu_items_base
-- 3. RLS policies for categories table
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

-- Seed categories from existing menu items
-- Extract unique categories and insert them with sort_order
INSERT INTO categories (name, sort_order)
SELECT DISTINCT 
  category,
  CASE category
    WHEN 'Snacks & Bites' THEN 1
    WHEN 'Noodles' THEN 2
    WHEN 'Chicken' THEN 3
    WHEN 'Rice & More' THEN 4
    WHEN 'Milktea Series' THEN 5
    WHEN 'Hot/iced Drinks' THEN 6
    WHEN 'Frappe Series' THEN 7
    WHEN 'Fruit Soda & Lemonade' THEN 8
    ELSE 99
  END as sort_order
FROM menu_items_base
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE categories IS 'Menu categories for organizing menu items';
COMMENT ON COLUMN categories.name IS 'Category name (e.g., Snacks & Bites, Noodles, etc.)';
COMMENT ON COLUMN categories.sort_order IS 'Display order for categories (lower numbers appear first)';
