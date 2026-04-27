-- ============================================================================
-- Cashier Interface Database Tables
-- Creates all necessary tables for the complete cashier portal functionality
-- ============================================================================

-- 1. Ensure cash_drawer_transactions table exists with all required fields
-- Drop table if it exists to ensure clean recreation with correct schema
DROP TABLE IF EXISTS cash_drawer_transactions CASCADE;

CREATE TABLE cash_drawer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('cash-in', 'cash-out', 'pay-bill', 'pay-expense', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  
  -- For pay-expense
  payee_name VARCHAR(255),
  purpose TEXT,
  category VARCHAR(100), -- Links to chart of accounts
  
  -- For adjustments
  reference_number VARCHAR(100), -- Order or receipt number
  adjustment_reason VARCHAR(255), -- 'canceled_order', 'double_posting', 'payment_correction', 'other'
  admin_verified BOOLEAN DEFAULT FALSE,
  admin_user_id UUID REFERENCES users(id),
  
  -- For pay-bill
  bill_id UUID, -- Reference to bills table if exists
  bill_type VARCHAR(50), -- 'payroll', 'utilities', 'receiving_report', 'other'
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_cashier ON cash_drawer_transactions(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_date ON cash_drawer_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_type ON cash_drawer_transactions(transaction_type);

COMMENT ON TABLE cash_drawer_transactions IS 'Tracks all cash drawer transactions for reconciliation';

-- 2. Create chart of accounts for expense categorization
-- Drop table if it exists to ensure clean recreation with correct schema
DROP TABLE IF EXISTS chart_of_accounts CASCADE;

CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(20) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_active ON chart_of_accounts(is_active);

COMMENT ON TABLE chart_of_accounts IS 'Chart of accounts for expense and revenue categorization';

-- 3. Create kitchen departments table
-- Drop table if it exists to ensure clean recreation with correct schema
DROP TABLE IF EXISTS kitchen_departments CASCADE;

CREATE TABLE kitchen_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name VARCHAR(100) NOT NULL UNIQUE,
  department_code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE kitchen_departments IS 'Kitchen departments for order slip routing';

-- 4. Add kitchen_department to menu_items if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'kitchen_department_id'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN kitchen_department_id UUID REFERENCES kitchen_departments(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_menu_items_kitchen_dept ON menu_items(kitchen_department_id);

COMMENT ON COLUMN menu_items.kitchen_department_id IS 'Kitchen department responsible for preparing this item';

-- 5. Enable RLS on new tables
ALTER TABLE cash_drawer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_departments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for cash_drawer_transactions
DROP POLICY IF EXISTS "Cashiers can view their own transactions" ON cash_drawer_transactions;
CREATE POLICY "Cashiers can view their own transactions" ON cash_drawer_transactions
  FOR SELECT USING (
    cashier_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin')
    )
  );

DROP POLICY IF EXISTS "Cashiers can create transactions" ON cash_drawer_transactions;
CREATE POLICY "Cashiers can create transactions" ON cash_drawer_transactions
  FOR INSERT WITH CHECK (
    cashier_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('cashier', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admin can view all cash transactions" ON cash_drawer_transactions;
CREATE POLICY "Admin can view all cash transactions" ON cash_drawer_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 7. RLS Policies for chart_of_accounts
DROP POLICY IF EXISTS "Anyone can view active accounts" ON chart_of_accounts;
CREATE POLICY "Anyone can view active accounts" ON chart_of_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Admin can manage accounts" ON chart_of_accounts;
CREATE POLICY "Admin can manage accounts" ON chart_of_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 8. RLS Policies for kitchen_departments
DROP POLICY IF EXISTS "Staff can view kitchen departments" ON kitchen_departments;
CREATE POLICY "Staff can view kitchen departments" ON kitchen_departments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Admin can manage kitchen departments" ON kitchen_departments;
CREATE POLICY "Admin can manage kitchen departments" ON kitchen_departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 9. Insert default kitchen departments
INSERT INTO kitchen_departments (department_name, department_code, description) VALUES
  ('Fryer 1', 'FRY1', 'First frying station'),
  ('Fryer 2', 'FRY2', 'Second frying station'),
  ('Pastries', 'PAST', 'Pastries and baked goods'),
  ('Drinks', 'DRNK', 'Beverages and drinks')
ON CONFLICT (department_code) DO NOTHING;

-- 10. Insert default chart of accounts for expenses
INSERT INTO chart_of_accounts (account_code, account_name, account_type, description) VALUES
  ('5000', 'Operating Expenses', 'expense', 'Main operating expenses category'),
  ('5100', 'Payroll Expenses', 'expense', 'Employee salaries and wages'),
  ('5200', 'Utilities', 'expense', 'Electricity, water, internet, etc.'),
  ('5300', 'Supplies', 'expense', 'Office and kitchen supplies'),
  ('5400', 'Maintenance & Repairs', 'expense', 'Equipment and facility maintenance'),
  ('5500', 'Marketing & Advertising', 'expense', 'Promotional expenses'),
  ('5600', 'Professional Fees', 'expense', 'Legal, accounting, consulting'),
  ('5700', 'Transportation', 'expense', 'Delivery and transportation costs'),
  ('5800', 'Miscellaneous', 'expense', 'Other operating expenses'),
  ('5900', 'Food & Ingredients', 'expense', 'Raw materials and ingredients')
ON CONFLICT (account_code) DO NOTHING;

COMMENT ON TABLE cash_drawer_transactions IS 'Comprehensive cash drawer transaction tracking';
COMMENT ON TABLE chart_of_accounts IS 'Accounting structure for expense categorization';
COMMENT ON TABLE kitchen_departments IS 'Kitchen stations for order routing';
