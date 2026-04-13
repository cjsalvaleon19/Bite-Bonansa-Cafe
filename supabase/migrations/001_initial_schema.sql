-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Kitchen Departments
CREATE TABLE IF NOT EXISTS kitchen_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO kitchen_departments (name) VALUES
  ('Fryer 1'), ('Fryer 2'), ('Drinks'), ('Pastries')
ON CONFLICT (name) DO NOTHING;

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  department VARCHAR(100) NOT NULL,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','out_of_stock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Item Ingredients (Raw Materials per item)
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  raw_material_id UUID,
  raw_material_name VARCHAR(255),
  quantity_per_serving NUMERIC(10,4) NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  cost_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Item Labor
CREATE TABLE IF NOT EXISTS menu_item_labor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  hours_needed NUMERIC(10,4) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Item Overhead
CREATE TABLE IF NOT EXISTS menu_item_overhead (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  overhead_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  overhead_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (overhead_type IN ('fixed','percentage')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw Materials
CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50),
  quantity_on_hand NUMERIC(12,4) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(12,4) NOT NULL DEFAULT 0,
  supplier VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw Material Cost History
CREATE TABLE IF NOT EXISTS raw_material_cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  old_cost NUMERIC(10,4) NOT NULL,
  new_cost NUMERIC(10,4) NOT NULL,
  average_cost NUMERIC(10,4) NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery Settings
CREATE TABLE IF NOT EXISTS delivery_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

INSERT INTO delivery_settings (enabled) VALUES (TRUE)
ON CONFLICT DO NOTHING;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id VARCHAR(20) NOT NULL UNIQUE,
  user_id UUID,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  points_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Points Transactions
CREATE TABLE IF NOT EXISTS customer_points_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('earn','redeem')),
  amount NUMERIC(12,2) NOT NULL,
  order_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id VARCHAR(20),
  order_type VARCHAR(20) NOT NULL DEFAULT 'cashier' CHECK (order_type IN ('online','cashier')),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','gcash','points','hybrid')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  points_used NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  department_receipts_printed JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  menu_item_name VARCHAR(255),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  department VARCHAR(100),
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('sale','cogs','expense')),
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_id UUID,
  item_id UUID,
  category VARCHAR(100),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (role management)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','cashier','admin','rider')),
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role','customer'), NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_customer_points_customer_id ON customer_points_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_status ON menu_items(status);
CREATE INDEX IF NOT EXISTS idx_menu_items_department ON menu_items(department);
