-- ─── Migration 102: Journal Entries and RR Payments tables ─────────────────
-- PURPOSE:
--   1. Create `journal_entries` table to record double-entry bookkeeping entries
--      (e.g., Debit Inventory / Credit AP on RR approval;
--            Debit AP / Credit Cash in Bank or Owner's Draw on RR payment).
--   2. Create `rr_payments` table to record payment details for approved RRs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. journal_entries ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE          NOT NULL DEFAULT CURRENT_DATE,
  description      TEXT          NOT NULL DEFAULT '',
  debit_account    VARCHAR(100)  NOT NULL,
  credit_account   VARCHAR(100)  NOT NULL,
  amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_id     UUID,
  reference_type   VARCHAR(50),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_entries_admin_all"   ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_select_all"  ON journal_entries;

CREATE POLICY "journal_entries_admin_all"
  ON journal_entries FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "journal_entries_select_all"
  ON journal_entries FOR SELECT TO authenticated
  USING (true);

-- ── 2. rr_payments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rr_payments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_report_id UUID          NOT NULL REFERENCES receiving_reports(id) ON DELETE CASCADE,
  payment_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  amount              DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- mode: cash_on_hand | cash_in_bank | credit_card
  payment_mode        VARCHAR(30)   NOT NULL DEFAULT 'cash_on_hand'
                        CHECK (payment_mode IN ('cash_on_hand', 'cash_in_bank', 'credit_card')),
  reference_number    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE rr_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rr_payments_admin_all"   ON rr_payments;
DROP POLICY IF EXISTS "rr_payments_select_all"  ON rr_payments;

CREATE POLICY "rr_payments_admin_all"
  ON rr_payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "rr_payments_select_all"
  ON rr_payments FOR SELECT TO authenticated
  USING (true);

-- ── 3. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
