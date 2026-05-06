-- Migration 119: Backfill journal_entries for existing orders, RR approvals, and RR payments
-- ─────────────────────────────────────────────────────────────────────────────
-- CONTEXT:
--   Migration 118 added the cashier INSERT policy and fixed admin recursion so that
--   journal entries can now be created.  However all orders completed BEFORE that
--   migration was applied have no journal entries, and the Journal Entries tab shows
--   "No journal entries found" indefinitely.
--
--   This migration is fully idempotent:
--     • Re-applies the RLS fixes from 118 (so running 119 alone is sufficient even
--       if 118 was never run).
--     • Back-fills one journal entry per completed order (Sales).
--     • Back-fills one journal entry per approved/paid receiving report (Purchases).
--     • Back-fills one journal entry per RR payment (RR Payment).
--   Each INSERT uses NOT EXISTS so re-running never creates duplicates.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Re-ensure SECURITY DEFINER helper (idempotent) ────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
  RETURNS TEXT
  LANGUAGE SQL
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ── 2. Re-ensure journal_entries RLS policies (idempotent) ───────────────────
DROP POLICY IF EXISTS "journal_entries_admin_all"      ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_select_all"     ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_cashier_insert" ON journal_entries;

CREATE POLICY "journal_entries_admin_all"
  ON journal_entries FOR ALL TO authenticated
  USING      (public.get_auth_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_auth_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "journal_entries_select_all"
  ON journal_entries FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "journal_entries_cashier_insert"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.get_auth_user_role() IN ('cashier', 'admin', 'superadmin'));

-- ── 3. Back-fill Sales journal entries from completed orders ─────────────────
--   Logic mirrors insertSalesJournalEntry() in pages/cashier/orders-queue.js:
--     • Points portion  → Debit "Accounts Payable"  / Credit "Sales Revenue"
--     • Cash/GCash portion → Debit "Cash on Hand" or "Cash in Bank" / Credit "Sales Revenue"
--   We insert the cash/GCash row for every delivered order, plus a points row when
--   points_used > 0 and the payment_method contains 'points'.

-- Cash / GCash portion (one row per completed order)
INSERT INTO journal_entries (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  (o.created_at AT TIME ZONE 'UTC')::date                                    AS date,
  'Sale: ' || COALESCE(o.order_number, o.id::text)                           AS description,
  CASE
    WHEN LOWER(COALESCE(o.payment_method, 'cash')) LIKE '%gcash%' THEN 'Cash in Bank'
    ELSE 'Cash on Hand'
  END                                                                         AS debit_account,
  'Sales Revenue'                                                             AS credit_account,
  ROUND(
    (
      COALESCE(o.total_amount::numeric, 0)
      - CASE
          WHEN LOWER(COALESCE(o.payment_method, '')) LIKE '%points%'
          THEN COALESCE(o.points_used::numeric, 0)
          ELSE 0
        END
    ) * 100
  ) / 100                                                                     AS amount,
  'order'                                                                     AS reference_type,
  COALESCE(o.order_number, o.id::text)                                       AS reference,
  COALESCE(NULLIF(o.customer_name, ''), 'Walk-in')                           AS name
FROM orders o
WHERE o.status = 'order_delivered'
  AND COALESCE(o.total_amount::numeric, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference = COALESCE(o.order_number, o.id::text)
      AND je.debit_account <> 'Accounts Payable'   -- avoid matching the points row
  );

-- Points portion (one row per order that used loyalty points)
INSERT INTO journal_entries (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  (o.created_at AT TIME ZONE 'UTC')::date                                    AS date,
  'Sale: ' || COALESCE(o.order_number, o.id::text)                           AS description,
  'Accounts Payable'                                                          AS debit_account,
  'Sales Revenue'                                                             AS credit_account,
  ROUND(COALESCE(o.points_used::numeric, 0) * 100) / 100                    AS amount,
  'order'                                                                     AS reference_type,
  COALESCE(o.order_number, o.id::text)                                       AS reference,
  COALESCE(NULLIF(o.customer_name, ''), 'Walk-in')                           AS name
FROM orders o
WHERE o.status = 'order_delivered'
  AND LOWER(COALESCE(o.payment_method, '')) LIKE '%points%'
  AND COALESCE(o.points_used::numeric, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference = COALESCE(o.order_number, o.id::text)
      AND je.debit_account = 'Accounts Payable'
  );

-- ── 4. Back-fill RR Approval journal entries ──────────────────────────────────
--   Logic mirrors approveRR() in pages/admin/index.js:
--     Debit "Inventory" / Credit "Accounts Payable"
INSERT INTO journal_entries (date, description, debit_account, credit_account, amount, reference_id, reference_type, name)
SELECT
  rr.date::date                                                               AS date,
  'RR Approval: ' || rr.rr_number                                            AS description,
  'Inventory'                                                                 AS debit_account,
  'Accounts Payable'                                                          AS credit_account,
  ROUND(COALESCE(rr.total_landed_cost::numeric, 0) * 100) / 100              AS amount,
  rr.id                                                                       AS reference_id,
  'receiving_report'                                                          AS reference_type,
  COALESCE(v.name, '')                                                        AS name
FROM receiving_reports rr
LEFT JOIN vendors v ON v.id = rr.vendor_id
WHERE rr.status IN ('approved', 'paid')
  AND COALESCE(rr.total_landed_cost::numeric, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'receiving_report'
      AND je.reference_id = rr.id
  );

-- ── 5. Back-fill RR Payment journal entries ───────────────────────────────────
--   Logic mirrors payRR() in pages/admin/index.js:
--     Debit "Accounts Payable" / Credit "Cash on Hand" | "Cash in Bank" | "Owner's Draw"
INSERT INTO journal_entries (date, description, debit_account, credit_account, amount, reference_id, reference_type, name)
SELECT
  p.payment_date::date                                                                                AS date,
  'RR Payment: ' || rr.rr_number || ' (' || REPLACE(p.payment_mode, '_', ' ') || ')'               AS description,
  'Accounts Payable'                                                                                  AS debit_account,
  CASE p.payment_mode
    WHEN 'cash_in_bank' THEN 'Cash in Bank'
    WHEN 'credit_card'  THEN 'Owner''s Draw'
    ELSE                     'Cash on Hand'
  END                                                                                                 AS credit_account,
  ROUND(p.amount::numeric * 100) / 100                                                               AS amount,
  p.receiving_report_id                                                                               AS reference_id,
  'rr_payment'                                                                                        AS reference_type,
  COALESCE(v.name, '')                                                                                AS name
FROM rr_payments p
JOIN receiving_reports rr ON rr.id = p.receiving_report_id
LEFT JOIN vendors v ON v.id = rr.vendor_id
WHERE NOT EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.reference_type = 'rr_payment'
    AND je.reference_id = p.receiving_report_id
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 119: Journal entries back-filled for existing orders, RR approvals, and RR payments.';
END $$;
