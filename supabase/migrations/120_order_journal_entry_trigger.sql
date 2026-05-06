-- Migration 120: Database trigger for automatic sales journal entries + backfill
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM:
--   insertSalesJournalEntry() in pages/cashier/orders-queue.js silently swallows
--   all INSERT errors via a try/catch.  When the cashier RLS policy is missing
--   (or migrations 118/119 have not yet been applied to production) the journal
--   entry is never written.  Orders such as #ORD-260506-001 therefore never
--   appear in the Journal Entries tab even after the admin page was given a
--   real-time subscription (migration released alongside this one).
--
-- FIX (three layers):
--   1. Re-ensure the SECURITY DEFINER helper and all journal_entries RLS
--      policies (fully idempotent – safe to run multiple times).
--   2. Create a SECURITY DEFINER trigger function that fires AFTER UPDATE on
--      orders when status transitions to 'order_delivered'.  Because the
--      trigger runs inside the database with elevated privileges it cannot be
--      blocked by RLS, and it fires regardless of which client (Orders Queue,
--      POS, Rider app, etc.) completes the order.
--   3. Backfill journal entries for every completed order that still has none.
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

-- Admin / superadmin: full access, non-recursive check
CREATE POLICY "journal_entries_admin_all"
  ON journal_entries FOR ALL TO authenticated
  USING      (public.get_auth_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_auth_user_role() IN ('admin', 'superadmin'));

-- Any authenticated user can read
CREATE POLICY "journal_entries_select_all"
  ON journal_entries FOR SELECT TO authenticated
  USING (true);

-- Cashier (and admin) can INSERT sales journal entries
CREATE POLICY "journal_entries_cashier_insert"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.get_auth_user_role() IN ('cashier', 'admin', 'superadmin'));


-- ── 3. Trigger function ───────────────────────────────────────────────────────
--   Fires AFTER UPDATE on orders FOR EACH ROW.
--   Creates the standard double-entry lines (cash/GCash + optional points)
--   whenever an order transitions to status = 'order_delivered'.
--   Uses SECURITY DEFINER so it bypasses RLS and can always INSERT.
--   Wrapped in EXCEPTION so it never blocks the order update.

CREATE OR REPLACE FUNCTION public.create_order_journal_entries()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ref        TEXT;
  v_date       DATE;
  v_total      NUMERIC;
  v_points     NUMERIC;
  v_cash_amt   NUMERIC;
  v_debit_acct TEXT;
  v_name       TEXT;
  v_payment    TEXT;
BEGIN
  -- Only fire on the transition TO order_delivered
  IF NEW.status <> 'order_delivered' THEN RETURN NEW; END IF;
  IF OLD.status  = 'order_delivered' THEN RETURN NEW; END IF;

  v_ref     := COALESCE(NEW.order_number, NEW.id::text);
  v_date    := COALESCE((NEW.completed_at)::date, CURRENT_DATE);
  v_total   := ROUND(COALESCE(NEW.total_amount::numeric, 0) * 100) / 100;
  v_points  := ROUND(COALESCE(NEW.points_used::numeric,  0) * 100) / 100;
  v_name    := COALESCE(NULLIF(TRIM(NEW.customer_name), ''), 'Walk-in');
  v_payment := LOWER(COALESCE(NEW.payment_method, 'cash'));

  -- Idempotent: skip if a cash/gcash journal entry already exists for this order
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'order'
      AND reference       = v_ref
      AND debit_account  <> 'Accounts Payable'
  ) THEN RETURN NEW; END IF;

  -- Points portion → Debit Accounts Payable / Credit Sales Revenue
  IF v_payment LIKE '%points%' AND v_points > 0 THEN
    INSERT INTO journal_entries
      (date, description, debit_account, credit_account, amount, reference_type, reference, name)
    VALUES
      (v_date, 'Sale: ' || v_ref, 'Accounts Payable', 'Sales Revenue',
       v_points, 'order', v_ref, v_name);
  END IF;

  -- Cash / GCash portion → Debit Cash on Hand or Cash in Bank / Credit Sales Revenue
  v_cash_amt := v_total - CASE WHEN v_payment LIKE '%points%' THEN v_points ELSE 0 END;
  IF v_cash_amt > 0 THEN
    v_debit_acct := CASE WHEN v_payment LIKE '%gcash%' THEN 'Cash in Bank' ELSE 'Cash on Hand' END;
    INSERT INTO journal_entries
      (date, description, debit_account, credit_account, amount, reference_type, reference, name)
    VALUES
      (v_date, 'Sale: ' || v_ref, v_debit_acct, 'Sales Revenue',
       v_cash_amt, 'order', v_ref, v_name);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the order update; log a warning instead
  RAISE WARNING 'create_order_journal_entries skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_create_order_journal_entries ON orders;
CREATE TRIGGER trg_create_order_journal_entries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_journal_entries();


-- ── 4. Backfill: cash/GCash rows for completed orders with no journal entry ───
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  COALESCE(o.completed_at, o.created_at AT TIME ZONE 'UTC')::date,
  'Sale: ' || COALESCE(o.order_number, o.id::text),
  CASE
    WHEN LOWER(COALESCE(o.payment_method, 'cash')) LIKE '%gcash%' THEN 'Cash in Bank'
    ELSE 'Cash on Hand'
  END,
  'Sales Revenue',
  ROUND(
    (
      COALESCE(o.total_amount::numeric, 0)
      - CASE
          WHEN LOWER(COALESCE(o.payment_method, '')) LIKE '%points%'
          THEN COALESCE(o.points_used::numeric, 0)
          ELSE 0
        END
    ) * 100
  ) / 100,
  'order',
  COALESCE(o.order_number, o.id::text),
  COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in')
FROM orders o
WHERE o.status = 'order_delivered'
  AND COALESCE(o.total_amount::numeric, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference       = COALESCE(o.order_number, o.id::text)
      AND je.debit_account  <> 'Accounts Payable'
  );

-- ── 5. Backfill: points rows for orders that used loyalty points ──────────────
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  COALESCE(o.completed_at, o.created_at AT TIME ZONE 'UTC')::date,
  'Sale: ' || COALESCE(o.order_number, o.id::text),
  'Accounts Payable',
  'Sales Revenue',
  ROUND(COALESCE(o.points_used::numeric, 0) * 100) / 100,
  'order',
  COALESCE(o.order_number, o.id::text),
  COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in')
FROM orders o
WHERE o.status = 'order_delivered'
  AND LOWER(COALESCE(o.payment_method, '')) LIKE '%points%'
  AND COALESCE(o.points_used::numeric, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference       = COALESCE(o.order_number, o.id::text)
      AND je.debit_account   = 'Accounts Payable'
  );


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 120: order journal entry trigger created; missing entries backfilled.';
END $$;
