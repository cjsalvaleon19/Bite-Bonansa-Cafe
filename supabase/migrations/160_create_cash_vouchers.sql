-- Migration 160: Create cash voucher tables for daily cashier cash-audit recognition

CREATE TABLE IF NOT EXISTS cash_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_number TEXT UNIQUE NOT NULL,
  audit_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved')),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_voucher_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_voucher_id UUID NOT NULL REFERENCES cash_vouchers(id) ON DELETE CASCADE,
  cash_drawer_transaction_id UUID REFERENCES cash_drawer_transactions(id) ON DELETE SET NULL,
  line_order INT NOT NULL DEFAULT 1,
  line_date DATE NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  account_title TEXT,
  entry_type TEXT NOT NULL DEFAULT 'debit' CHECK (entry_type IN ('debit', 'credit')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_vouchers_audit_date ON cash_vouchers(audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_vouchers_cv_number ON cash_vouchers(cv_number);
CREATE INDEX IF NOT EXISTS idx_cash_voucher_items_voucher ON cash_voucher_items(cash_voucher_id, line_order);

ALTER TABLE cash_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_voucher_items ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cash_vouchers' AND policyname = 'cash_vouchers_admin_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY cash_vouchers_admin_all ON cash_vouchers
        FOR ALL
        USING (get_auth_user_role() IN ('admin', 'superadmin'))
        WITH CHECK (get_auth_user_role() IN ('admin', 'superadmin'))
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cash_voucher_items' AND policyname = 'cash_voucher_items_admin_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY cash_voucher_items_admin_all ON cash_voucher_items
        FOR ALL
        USING (get_auth_user_role() IN ('admin', 'superadmin'))
        WITH CHECK (get_auth_user_role() IN ('admin', 'superadmin'))
    $sql$;
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION generate_cash_voucher_number()
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
  v_prefix := 'CV# ' || v_yy;

  SELECT cv_number INTO v_last
  FROM cash_vouchers
  WHERE cv_number LIKE v_prefix || '%'
  ORDER BY cv_number DESC
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
