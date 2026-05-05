-- ============================================================================
-- Cash Audit Table
-- Stores daily cash denomination counts and audit results for each cashier.
-- Resets daily (one record per cashier per date).
-- Once submitted (is_submitted = true), the record is read-only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date DATE NOT NULL,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Philippine currency denomination counts
  denom_1000 INTEGER NOT NULL DEFAULT 0,  -- ₱1,000 bills
  denom_500  INTEGER NOT NULL DEFAULT 0,  -- ₱500 bills
  denom_200  INTEGER NOT NULL DEFAULT 0,  -- ₱200 bills
  denom_100  INTEGER NOT NULL DEFAULT 0,  -- ₱100 bills
  denom_50   INTEGER NOT NULL DEFAULT 0,  -- ₱50 bills
  denom_20   INTEGER NOT NULL DEFAULT 0,  -- ₱20 bills/coins
  denom_10   INTEGER NOT NULL DEFAULT 0,  -- ₱10 coins
  denom_5    INTEGER NOT NULL DEFAULT 0,  -- ₱5 coins
  denom_1    INTEGER NOT NULL DEFAULT 0,  -- ₱1 coins
  denom_050  INTEGER NOT NULL DEFAULT 0,  -- ₱0.50 coins
  denom_025  INTEGER NOT NULL DEFAULT 0,  -- ₱0.25 coins

  -- Totals snapshot at audit time
  denomination_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_in_total      DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_sales_total   DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_out_total     DECIMAL(10,2) NOT NULL DEFAULT 0,
  adjustment_total   DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_on_hand       DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Positive = overage, negative = shortage
  overage_shortage   DECIMAL(10,2) NOT NULL DEFAULT 0,

  notes TEXT,

  is_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One audit per cashier per day
  UNIQUE (audit_date, cashier_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_audits_cashier_date ON cash_audits(cashier_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_audits_date ON cash_audits(audit_date DESC);

COMMENT ON TABLE cash_audits IS 'Daily cash denomination audit records per cashier';

-- Enable RLS
ALTER TABLE cash_audits ENABLE ROW LEVEL SECURITY;

-- Cashiers can manage their own audits
DROP POLICY IF EXISTS "Cashiers can view own audits" ON cash_audits;
CREATE POLICY "Cashiers can view own audits" ON cash_audits
  FOR SELECT USING (
    cashier_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Cashiers can insert own audits" ON cash_audits;
CREATE POLICY "Cashiers can insert own audits" ON cash_audits
  FOR INSERT WITH CHECK (
    cashier_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('cashier', 'admin')
    )
  );

DROP POLICY IF EXISTS "Cashiers can update unsubmitted own audits" ON cash_audits;
CREATE POLICY "Cashiers can update unsubmitted own audits" ON cash_audits
  FOR UPDATE USING (
    cashier_id = auth.uid() AND is_submitted = FALSE
  );

DROP POLICY IF EXISTS "Admin can manage all audits" ON cash_audits;
CREATE POLICY "Admin can manage all audits" ON cash_audits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
