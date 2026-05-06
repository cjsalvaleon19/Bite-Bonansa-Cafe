-- Migration 124: Create bills and bill_items tables
-- Bills are used for recognition of expenses, costs, and other payables.

-- Bills header table
CREATE TABLE IF NOT EXISTS bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_number TEXT UNIQUE NOT NULL,
  contact TEXT,
  contact_id UUID,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  status TEXT DEFAULT 'draft',
  total_debit NUMERIC(12,2) DEFAULT 0,
  total_credit NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill line items table
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT,
  account_title TEXT,
  debit_amount NUMERIC(12,2) DEFAULT 0,
  credit_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin/superadmin access using the existing SECURITY DEFINER helper)
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bills' AND policyname = 'bills_admin_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY bills_admin_all ON bills
        FOR ALL
        USING (get_auth_user_role() IN ('admin', 'superadmin'))
        WITH CHECK (get_auth_user_role() IN ('admin', 'superadmin'))
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bill_items' AND policyname = 'bill_items_admin_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY bill_items_admin_all ON bill_items
        FOR ALL
        USING (get_auth_user_role() IN ('admin', 'superadmin'))
        WITH CHECK (get_auth_user_role() IN ('admin', 'superadmin'))
    $sql$;
  END IF;
END
$policy$;

-- Helper function to generate bill number in format Bill#-YY######
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_yy TEXT;
  v_prefix TEXT;
  v_last_seq INT := 0;
  v_last TEXT;
BEGIN
  v_yy := TO_CHAR(NOW(), 'YY');
  v_prefix := 'Bill#-' || v_yy;

  SELECT bill_number INTO v_last
  FROM bills
  WHERE bill_number LIKE v_prefix || '%'
  ORDER BY bill_number DESC
  LIMIT 1;

  IF v_last IS NOT NULL THEN
    BEGIN
      v_last_seq := CAST(SUBSTRING(v_last FROM LENGTH(v_prefix) + 1) AS INT);
    EXCEPTION WHEN OTHERS THEN
      v_last_seq := 0;
    END;
  END IF;

  RETURN v_prefix || LPAD(CAST(v_last_seq + 1 AS TEXT), 6, '0');
END;
$$;
