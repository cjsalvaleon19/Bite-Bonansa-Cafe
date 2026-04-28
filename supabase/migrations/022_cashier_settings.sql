-- ============================================================================
-- Cashier Settings Table
-- Stores cashier-configurable settings like delivery availability and sold-out items
-- ============================================================================

-- Create cashier_settings table
CREATE TABLE IF NOT EXISTS cashier_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashier_settings_key ON cashier_settings(setting_key);

COMMENT ON TABLE cashier_settings IS 'Stores cashier-configurable application settings';

-- Enable RLS
ALTER TABLE cashier_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Cashiers can view settings" ON cashier_settings;
CREATE POLICY "Cashiers can view settings" ON cashier_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Cashiers can update settings" ON cashier_settings;
CREATE POLICY "Cashiers can update settings" ON cashier_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Insert default settings
INSERT INTO cashier_settings (setting_key, setting_value, description) VALUES
  ('delivery_enabled', 'true', 'Whether delivery orders are currently accepted'),
  ('sold_out_items', '[]', 'JSON array of menu item IDs that are sold out')
ON CONFLICT (setting_key) DO NOTHING;

-- Add is_sold_out column to menu_items_base if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items_base' AND column_name = 'is_sold_out'
  ) THEN
    ALTER TABLE menu_items_base ADD COLUMN is_sold_out BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN menu_items_base.is_sold_out IS 'Indicates if item is temporarily sold out';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_menu_items_base_sold_out ON menu_items_base(is_sold_out);
