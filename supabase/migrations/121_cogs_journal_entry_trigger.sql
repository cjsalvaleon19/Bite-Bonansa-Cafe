-- Migration 121: COGS journal entries for completed orders
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM:
--   When an order is completed, only the sales revenue lines are being written
--   to journal_entries (Dr. Cash on Hand / Cr. Sales Revenue added by migration
--   120).  There is no corresponding COGS recognition entry.
--
--   Accounting rule: every sale must have a matching COGS entry:
--     Dr. Cost of Goods Sold  (raw-material cost of all items sold)
--     Cr. Inventory
--
--   The amount to recognise is the current raw-material cost stored in
--   price_costing_items at the time the order is delivered, which reflects
--   the latest cost per the inventory movement.  Calculation:
--     per order item → SUM(price_costing_items.qty × price_costing_items.cost)
--                      for the matching price_costing_headers row
--                      × order_item.quantity
--     total COGS = sum across all order items
--
-- FIX:
--   1. Replace the trigger function create_order_journal_entries() to also
--      insert a COGS line when the raw-material cost is > 0.
--   2. Backfill COGS entries for every completed order that already has a
--      sales journal entry but is still missing its COGS line.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Replace trigger function (adds COGS logic) ─────────────────────────────
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
  ) THEN
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
  END IF;

  -- ── COGS line (idempotent check) ──────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'order'
      AND reference       = v_ref
      AND debit_account   = 'Cost of Goods Sold'
  ) THEN
    -- Calculate raw-material COGS from price_costing_items × order_items.quantity
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
      -- join price_costing_headers by item name
      LEFT JOIN LATERAL (
        SELECT ROUND(
                 COALESCE(SUM(pci.qty::numeric * pci.cost::numeric), 0) * 100
               ) / 100 AS raw_material_cost
        FROM price_costing_headers pch
        JOIN price_costing_items   pci ON pci.costing_header_id = pch.id
        WHERE pch.menu_item_name = oi.name
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
  -- Never block the order update; log a warning instead
  RAISE WARNING 'create_order_journal_entries skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Trigger is already attached from migration 120; no need to recreate.
-- But re-drop/create to ensure it uses the new function definition.
DROP TRIGGER IF EXISTS trg_create_order_journal_entries ON orders;
CREATE TRIGGER trg_create_order_journal_entries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_journal_entries();


-- ── 2. Backfill COGS for completed orders with sales entries but no COGS ──────
--   For each order that already has a sales journal entry (reference_type='order'
--   with a Cash/GCash debit) but is missing a COGS entry, calculate the raw-
--   material cost from price_costing_items and insert the COGS line.
WITH sales_orders AS (
  -- One representative sales row per order reference (no COGS entry yet)
  SELECT DISTINCT ON (je.reference)
    je.date,
    je.reference,
    je.name
  FROM journal_entries je
  WHERE je.reference_type = 'order'
    AND je.debit_account IN ('Cash on Hand', 'Cash in Bank', 'Accounts Payable')
    AND NOT EXISTS (
      SELECT 1 FROM journal_entries je2
      WHERE je2.reference_type = 'order'
        AND je2.reference       = je.reference
        AND je2.debit_account   = 'Cost of Goods Sold'
    )
  ORDER BY je.reference, je.date
),
cogs_amounts AS (
  SELECT
    so.date,
    so.reference,
    so.name,
    ROUND(
      COALESCE(
        SUM(
          oi.quantity::numeric
          * COALESCE(
              (
                SELECT ROUND(COALESCE(SUM(pci.qty::numeric * pci.cost::numeric), 0) * 100) / 100
                FROM price_costing_headers pch
                JOIN price_costing_items   pci ON pci.costing_header_id = pch.id
                WHERE pch.menu_item_name = oi.name
              ),
              0
            )
        ),
        0
      ) * 100
    ) / 100 AS cogs_amount
  FROM sales_orders so
  JOIN orders     o  ON COALESCE(o.order_number, o.id::text) = so.reference
  JOIN order_items oi ON oi.order_id = o.id::text
  GROUP BY so.date, so.reference, so.name
)
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  date,
  'COGS: ' || reference,
  'Cost of Goods Sold',
  'Inventory',
  cogs_amount,
  'order',
  reference,
  name
FROM cogs_amounts
WHERE cogs_amount > 0;


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 121: COGS journal entry trigger updated; missing COGS entries backfilled.';
END $$;
