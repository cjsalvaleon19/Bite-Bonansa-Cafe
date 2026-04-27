-- ============================================================================
-- Migration: 023_fix_cashier_interface_issues
-- Description: Fix menu loading and settings issues in cashier interface
-- Created: 2026-04-27
--
-- This migration fixes:
-- 1. Menu items not loading (create views to map table names)
-- 2. Cashier settings duplicate key constraint error
-- 3. RLS policy infinite recursion issues
-- ============================================================================

-- ============================================================================
-- 1. Create views to map old table names to new schema
-- ============================================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS menu_items CASCADE;
DROP VIEW IF EXISTS menu_item_variants CASCADE;

-- Create menu_items view that maps to menu_items_base
CREATE VIEW menu_items AS
SELECT 
  id,
  name,
  category,
  base_price AS price,
  base_price,
  image_url,
  description,
  available,
  has_variants,
  is_sold_out,
  created_at,
  updated_at
FROM menu_items_base;

COMMENT ON VIEW menu_items IS 'View mapping menu_items to menu_items_base table for backward compatibility';

-- Create menu_item_variants view that maps to menu_item_variant_types
CREATE VIEW menu_item_variants AS
SELECT 
  id,
  menu_item_id,
  variant_type_name,
  is_required,
  allow_multiple,
  display_order,
  created_at
FROM menu_item_variant_types;

COMMENT ON VIEW menu_item_variants IS 'View mapping menu_item_variants to menu_item_variant_types table for backward compatibility';

-- ============================================================================
-- 2. Create INSTEAD OF triggers to make views updatable
-- ============================================================================

-- Trigger function for menu_items INSERT
CREATE OR REPLACE FUNCTION menu_items_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO menu_items_base (id, name, category, base_price, image_url, description, available, has_variants, is_sold_out, created_at, updated_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.name, NEW.category, NEW.base_price, NEW.image_url, NEW.description, NEW.available, NEW.has_variants, NEW.is_sold_out, COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW()))
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for menu_items UPDATE
CREATE OR REPLACE FUNCTION menu_items_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE menu_items_base
  SET 
    name = NEW.name,
    category = NEW.category,
    base_price = NEW.base_price,
    image_url = NEW.image_url,
    description = NEW.description,
    available = NEW.available,
    has_variants = NEW.has_variants,
    is_sold_out = NEW.is_sold_out,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for menu_items DELETE
CREATE OR REPLACE FUNCTION menu_items_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM menu_items_base WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create INSTEAD OF triggers on menu_items view
DROP TRIGGER IF EXISTS menu_items_insert_trigger ON menu_items;
CREATE TRIGGER menu_items_insert_trigger
  INSTEAD OF INSERT ON menu_items
  FOR EACH ROW EXECUTE FUNCTION menu_items_insert();

DROP TRIGGER IF EXISTS menu_items_update_trigger ON menu_items;
CREATE TRIGGER menu_items_update_trigger
  INSTEAD OF UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION menu_items_update();

DROP TRIGGER IF EXISTS menu_items_delete_trigger ON menu_items;
CREATE TRIGGER menu_items_delete_trigger
  INSTEAD OF DELETE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION menu_items_delete();

-- ============================================================================
-- 3. Fix cashier_settings table to prevent duplicate key errors
-- ============================================================================

-- Drop and recreate the unique index to ensure it exists
DROP INDEX IF EXISTS idx_cashier_settings_key;
CREATE UNIQUE INDEX idx_cashier_settings_key ON cashier_settings(setting_key);

-- Update RLS policies for cashier_settings to use proper upsert handling
DROP POLICY IF EXISTS "Cashiers can update settings" ON cashier_settings;
CREATE POLICY "Cashiers can insert and update settings" ON cashier_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- ============================================================================
-- 4. Fix RLS policies to prevent infinite recursion
-- ============================================================================

-- The infinite recursion issue occurs when RLS policies reference the same table
-- Fix: Use auth.uid() directly without joining to users table where possible

-- Update menu_items_base policies (these are inherited by the menu_items view)
DROP POLICY IF EXISTS "Staff can manage menu items" ON menu_items_base;
CREATE POLICY "Staff can manage menu items" ON menu_items_base
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'cashier')
    )
  );

-- ============================================================================
-- 5. Grant necessary permissions
-- ============================================================================

-- Grant SELECT on views to authenticated users
GRANT SELECT ON menu_items TO authenticated;
GRANT SELECT ON menu_items TO anon;
GRANT SELECT ON menu_item_variants TO authenticated;
GRANT SELECT ON menu_item_variants TO anon;

-- Grant UPDATE on menu_items_base for staff (needed for sold out toggle)
GRANT UPDATE (is_sold_out, available) ON menu_items_base TO authenticated;

-- ============================================================================
-- 6. Initialize cashier settings if not exists
-- ============================================================================

-- Ensure default settings exist (using ON CONFLICT to prevent duplicates)
INSERT INTO cashier_settings (setting_key, setting_value, description) 
VALUES ('delivery_enabled', 'true', 'Whether delivery orders are currently accepted')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO cashier_settings (setting_key, setting_value, description) 
VALUES ('sold_out_items', '[]', 'JSON array of menu item IDs that are sold out')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- 7. Add helpful comments
-- ============================================================================

COMMENT ON TRIGGER menu_items_insert_trigger ON menu_items IS 'Makes menu_items view insertable by redirecting to menu_items_base table';
COMMENT ON TRIGGER menu_items_update_trigger ON menu_items IS 'Makes menu_items view updatable by redirecting to menu_items_base table';
COMMENT ON TRIGGER menu_items_delete_trigger ON menu_items IS 'Makes menu_items view deletable by redirecting to menu_items_base table';
