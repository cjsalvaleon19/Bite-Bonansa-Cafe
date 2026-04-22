-- ============================================================================
-- Menu Item Variants Schema
-- Allows items to have subcategories (varieties, add-ons, sizes, etc.)
-- ============================================================================

-- 1. Base menu items table - store only the parent item
-- For example: "Fries" is the base item, not each flavor variant
CREATE TABLE IF NOT EXISTS menu_items_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  description TEXT,
  available BOOLEAN DEFAULT true,
  has_variants BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Variant types table - defines types of variations (size, flavor, add-ons, etc.)
CREATE TABLE IF NOT EXISTS menu_item_variant_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items_base(id) ON DELETE CASCADE,
  variant_type_name VARCHAR(100) NOT NULL, -- e.g., 'Flavor', 'Size', 'Add-ons', 'Variety'
  is_required BOOLEAN DEFAULT true, -- Must customer select this variant type?
  allow_multiple BOOLEAN DEFAULT false, -- Can customer select multiple options?
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Variant options table - specific options for each variant type
CREATE TABLE IF NOT EXISTS menu_item_variant_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_type_id UUID NOT NULL REFERENCES menu_item_variant_types(id) ON DELETE CASCADE,
  option_name VARCHAR(255) NOT NULL, -- e.g., 'Cheese', 'Meaty Sauce', 'Large', 'Small'
  price_modifier DECIMAL(10,2) DEFAULT 0, -- Additional cost (can be 0 for same price)
  available BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_variant_types_menu_item ON menu_item_variant_types(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_variant_options_type ON menu_item_variant_options(variant_type_id);

-- Enable RLS
ALTER TABLE menu_items_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_variant_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_variant_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies - anyone can view available items
CREATE POLICY "Anyone can view available menu items" ON menu_items_base
  FOR SELECT USING (available = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage menu items" ON menu_items_base
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "Anyone can view variant types" ON menu_item_variant_types
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage variant types" ON menu_item_variant_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "Anyone can view variant options" ON menu_item_variant_options
  FOR SELECT USING (available = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage variant options" ON menu_item_variant_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- ============================================================================
-- Example: Migrate existing menu items to use variants
-- ============================================================================

-- Example 1: Fries with flavor variants
/*
INSERT INTO menu_items_base (name, category, base_price, has_variants, description)
VALUES ('Fries', 'Appetizers', 89.00, true, 'Crispy fries with your choice of flavor');

-- Get the ID of the newly created Fries item
WITH fries_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Fries' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple)
SELECT id, 'Flavor', true, false FROM fries_item;

-- Add flavor options
WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fries' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier)
SELECT id, 'Cheese', 0 FROM flavor_type
UNION ALL
SELECT id, 'Meaty Sauce', 0 FROM flavor_type
UNION ALL
SELECT id, 'Sour Cream', 0 FROM flavor_type
UNION ALL
SELECT id, 'Barbecue', 0 FROM flavor_type;
*/

-- Example 2: Chicken Meals with flavor variants
/*
INSERT INTO menu_items_base (name, category, base_price, has_variants, description)
VALUES ('Chicken Meal', 'Chicken', 79.00, true, 'Delicious chicken with your choice of flavor');

WITH chicken_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Chicken Meal' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple)
SELECT id, 'Flavor', true, false FROM chicken_item;

WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Chicken Meal' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier)
SELECT id, 'Barbecue', 0 FROM flavor_type
UNION ALL
SELECT id, 'Buffalo Wings', 0 FROM flavor_type
UNION ALL
SELECT id, 'Honey Butter', 0 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Sour', 0 FROM flavor_type
UNION ALL
SELECT id, 'Sweet & Spicy', 0 FROM flavor_type
UNION ALL
SELECT id, 'Soy Garlic', 0 FROM flavor_type
UNION ALL
SELECT id, 'Teriyaki', 0 FROM flavor_type;
*/

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE menu_items_base IS 'Base menu items without individual variants. Items with variants should have has_variants=true';
COMMENT ON TABLE menu_item_variant_types IS 'Types of variants for menu items (e.g., Size, Flavor, Add-ons)';
COMMENT ON TABLE menu_item_variant_options IS 'Specific options available for each variant type';
COMMENT ON COLUMN menu_item_variant_types.is_required IS 'Whether customer must select this variant type before adding to cart';
COMMENT ON COLUMN menu_item_variant_types.allow_multiple IS 'Whether customer can select multiple options from this variant type';
COMMENT ON COLUMN menu_item_variant_options.price_modifier IS 'Additional cost for this option (0 if same price as base)';
