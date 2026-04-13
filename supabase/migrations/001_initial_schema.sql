-- Kitchen Departments
CREATE TABLE IF NOT EXISTS kitchen_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  printer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  department_id UUID REFERENCES kitchen_departments(id),
  status TEXT DEFAULT 'available' CHECK (status IN ('available','out_of_stock','hidden')),
  image_url TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Item Ingredients (raw materials per serving)
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  raw_material_id UUID,
  material_name TEXT NOT NULL,
  quantity NUMERIC(10,4) NOT NULL,
  unit TEXT NOT NULL,
  cost_per_unit NUMERIC(10,4) NOT NULL,
  total_cost NUMERIC(10,4) GENERATED ALWAYS AS (quantity * cost_per_unit) STORED
);

-- Menu Item Labor
CREATE TABLE IF NOT EXISTS menu_item_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  description TEXT,
  hours NUMERIC(10,4) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,4) GENERATED ALWAYS AS (hours * hourly_rate) STORED
);

-- Menu Item Overhead
CREATE TABLE IF NOT EXISTS menu_item_overhead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  description TEXT,
  overhead_type TEXT DEFAULT 'fixed' CHECK (overhead_type IN ('fixed','percentage')),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Raw Materials Inventory
CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity_on_hand NUMERIC(10,4) DEFAULT 0,
  cost_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(10,4) DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw Material Cost History (average cost method)
CREATE TABLE IF NOT EXISTS raw_material_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES raw_materials(id) ON DELETE CASCADE,
  old_cost NUMERIC(10,4),
  new_cost NUMERIC(10,4),
  average_cost NUMERIC(10,4),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery Settings
CREATE TABLE IF NOT EXISTS delivery_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

-- Customers (Loyalty)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  points_balance NUMERIC(10,2) DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points Transactions
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT REFERENCES customers(customer_id),
  amount NUMERIC(10,2) NOT NULL,
  type TEXT CHECK (type IN ('earn','redeem')),
  description TEXT,
  order_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT,
  customer_name TEXT DEFAULT 'Walk-in',
  order_type TEXT DEFAULT 'dine_in' CHECK (order_type IN ('dine_in','pickup','delivery')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','completed','cancelled')),
  subtotal NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  points_redeemed NUMERIC(10,2) DEFAULT 0,
  cash_amount NUMERIC(10,2) DEFAULT 0,
  gcash_amount NUMERIC(10,2) DEFAULT 0,
  change_amount NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  menu_item_name TEXT NOT NULL,
  department_id UUID REFERENCES kitchen_departments(id),
  department_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  special_instructions TEXT
);

-- Receipt Customer Details
CREATE TABLE IF NOT EXISTS receipt_customer_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  receipt_number TEXT UNIQUE NOT NULL,
  customer_name TEXT DEFAULT 'Walk-in',
  customer_id TEXT,
  address TEXT,
  tin TEXT,
  business_style TEXT,
  qr_code_data TEXT,
  printed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('sale','cogs','labor','overhead','expense')),
  amount NUMERIC(10,2) NOT NULL,
  order_id UUID,
  item_id UUID,
  description TEXT,
  category TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Reviews
CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipt_customer_details(id),
  receipt_number TEXT,
  customer_name TEXT,
  customer_id TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  recommended BOOLEAN,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID
);

-- Review Helpful Votes
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES customer_reviews(id) ON DELETE CASCADE,
  voter_id TEXT,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, voter_id)
);

-- Seed kitchen departments
INSERT INTO kitchen_departments (name) VALUES
  ('Fryer 1'),
  ('Fryer 2'),
  ('Drinks'),
  ('Pastries')
ON CONFLICT DO NOTHING;

-- Seed delivery settings
INSERT INTO delivery_settings (id, enabled) VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;
