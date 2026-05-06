-- Migration 123: Rename Sales Revenue → Revenue, add Points Earned entry, add min_stock
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add min_stock column to admin_inventory_items (for Low Stock threshold)
ALTER TABLE admin_inventory_items
  ADD COLUMN IF NOT EXISTS min_stock DECIMAL(10,3) NOT NULL DEFAULT 0;

-- 2. Update the trigger function to:
--    a) Use 'Revenue' instead of 'Sales Revenue'
--    b) Also insert Points Earned entry (Dr. Rewards / Cr. Accounts Payable - Rewards)
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
  v_cogs       NUMERIC;
  v_earned     NUMERIC;
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

  -- ── Revenue lines (idempotent check) ─────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'order'
      AND reference       = v_ref
      AND debit_account  <> 'Accounts Payable'
      AND debit_account  <> 'Cost of Goods Sold'
      AND debit_account  <> 'Rewards'
  ) THEN
    -- Points portion → Debit Accounts Payable / Credit Revenue
    IF v_payment LIKE '%points%' AND v_points > 0 THEN
      INSERT INTO journal_entries
        (date, description, debit_account, credit_account, amount, reference_type, reference, name)
      VALUES
        (v_date, 'Sale: ' || v_ref, 'Accounts Payable', 'Revenue',
         v_points, 'order', v_ref, v_name);
    END IF;

    -- Cash / GCash portion → Debit Cash on Hand or Cash in Bank / Credit Revenue
    v_cash_amt := v_total - CASE WHEN v_payment LIKE '%points%' THEN v_points ELSE 0 END;
    IF v_cash_amt > 0 THEN
      v_debit_acct := CASE WHEN v_payment LIKE '%gcash%' THEN 'Cash in Bank' ELSE 'Cash on Hand' END;
      INSERT INTO journal_entries
        (date, description, debit_account, credit_account, amount, reference_type, reference, name)
      VALUES
        (v_date, 'Sale: ' || v_ref, v_debit_acct, 'Revenue',
         v_cash_amt, 'order', v_ref, v_name);
    END IF;
  END IF;

  -- ── Points Earned line (idempotent check) ─────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'order'
      AND reference       = v_ref
      AND debit_account   = 'Rewards'
  ) THEN
    v_earned := ROUND(COALESCE(NEW.earnings_amount::numeric, 0) * 100) / 100;
    IF v_earned > 0 THEN
      INSERT INTO journal_entries
        (date, description, debit_account, credit_account, amount, reference_type, reference, name)
      VALUES
        (v_date, 'Loyalty Points Earned: ' || v_ref, 'Rewards', 'Accounts Payable - Rewards',
         v_earned, 'order', v_ref, v_name);
    END IF;
  END IF;

  -- ── COGS line (idempotent check) ──────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'order'
      AND reference       = v_ref
      AND debit_account   = 'Cost of Goods Sold'
  ) THEN
    SELECT ROUND(
             COALESCE(
               SUM(
                 (oi.quantity::numeric)
                 * COALESCE(item_cost.raw_material_cost, 0)
               ),
               0
             ) * 100
           ) / 100
      INTO v_cogs
      FROM order_items oi
      LEFT JOIN LATERAL (
        SELECT ROUND(
                 COALESCE(SUM(pci2.qty::numeric * pci2.cost::numeric), 0) * 100
               ) / 100 AS raw_material_cost
        FROM (
          SELECT pch_inner.id
          FROM price_costing_headers pch_inner
          WHERE
            pch_inner.menu_item_name = oi.name
            OR (
              oi.variant_details IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM jsonb_each_text(oi.variant_details) kv
                WHERE lower(kv.key) NOT IN ('addon', 'addons')
                  AND pch_inner.menu_item_name = oi.name || ' - ' || kv.value
              )
            )
          ORDER BY length(pch_inner.menu_item_name) DESC
          LIMIT 1
        ) best_h
        JOIN price_costing_items pci2 ON pci2.costing_header_id = best_h.id
      ) item_cost ON TRUE
     WHERE oi.order_id = NEW.id::text;

    IF v_cogs > 0 THEN
      INSERT INTO journal_entries
        (date, description, debit_account, credit_account, amount, reference_type, reference, name)
      VALUES
        (v_date, 'COGS: ' || v_ref, 'Cost of Goods Sold', 'Inventory',
         v_cogs, 'order', v_ref, v_name);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_order_journal_entries skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Re-create trigger to pick up updated function
DROP TRIGGER IF EXISTS trg_create_order_journal_entries ON orders;
CREATE TRIGGER trg_create_order_journal_entries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_journal_entries();

-- 3. Update existing 'Sales Revenue' entries to 'Revenue'
UPDATE journal_entries
SET credit_account = 'Revenue'
WHERE credit_account = 'Sales Revenue';

-- 4. Update existing 'Accounts Payable' loyalty-points-earned entries
--    to 'Accounts Payable - Rewards'
UPDATE journal_entries
SET credit_account = 'Accounts Payable - Rewards'
WHERE debit_account = 'Rewards'
  AND credit_account = 'Accounts Payable';

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 123: Revenue renamed, Points Earned entry added, min_stock column added.';
END $$;
