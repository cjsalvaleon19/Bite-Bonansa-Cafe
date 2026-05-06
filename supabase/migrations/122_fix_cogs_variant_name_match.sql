-- Migration 122: Fix COGS lookup to match variant-combined item names
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM:
--   Migration 121 looked up price_costing_headers using an exact match:
--     WHERE pch.menu_item_name = oi.name
--
--   This fails when the costing header includes a size suffix, e.g.:
--     price_costing_headers.menu_item_name = 'Brown Sugar Milktea - 16oz'
--     order_items.name                     = 'Brown Sugar Milktea'
--
--   The size variant is stored in order_items.variant_details (JSONB), e.g.:
--     { "Size": "16oz" }
--
--   Because no match was found, COGS amount = 0 and no entry was inserted.
--
-- FIX:
--   For each order item, try two candidate costing header names:
--     1. Variant-combined: oi.name || ' - ' || <size_value>
--        (for every non-addon key in variant_details)
--     2. Base name fallback: oi.name
--   Pick the most specific match (longest menu_item_name) via ORDER BY … LIMIT 1.
--
--   Changes:
--     1. Replace create_order_journal_entries() with the variant-aware version.
--     2. Re-run backfill for orders that still have no COGS entry.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Replace trigger function (variant-aware COGS lookup) ──────────────────
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
    -- Calculate raw-material COGS.
    -- For each order item, find its costing header by trying:
    --   1. oi.name + ' - ' + <non-addon variant value>  (e.g. 'Brown Sugar Milktea - 16oz')
    --   2. oi.name exactly                              (e.g. 'Brown Sugar Milktea')
    -- If both exist, prefer the more specific (longer) name.
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
        -- Pick the best-matching costing header (most specific first)
        SELECT ROUND(
                 COALESCE(SUM(pci2.qty::numeric * pci2.cost::numeric), 0) * 100
               ) / 100 AS raw_material_cost
        FROM (
          SELECT pch_inner.id
          FROM price_costing_headers pch_inner
          WHERE
            -- Exact base-name match
            pch_inner.menu_item_name = oi.name
            -- OR variant-combined match (name + ' - ' + size/non-addon option value)
            OR (
              oi.variant_details IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM jsonb_each_text(oi.variant_details) kv
                WHERE lower(kv.key) NOT IN ('addon', 'addons')
                  AND pch_inner.menu_item_name = oi.name || ' - ' || kv.value
              )
            )
          -- Prefer the longer (more specific) name so variant-combined wins over base name
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
  -- Never block the order update; log a warning instead
  RAISE WARNING 'create_order_journal_entries skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Trigger is already attached; re-create to pick up the updated function.
DROP TRIGGER IF EXISTS trg_create_order_journal_entries ON orders;
CREATE TRIGGER trg_create_order_journal_entries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_journal_entries();


-- ── 2. Backfill: insert missing COGS for orders that already have sales entries ─
--   Uses the same variant-aware lookup: tries 'name - variant_value' first,
--   then falls back to the base name.
WITH sales_orders AS (
  -- One representative row per order reference that still has no COGS entry
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
                -- Variant-aware costing lookup (same logic as trigger above)
                SELECT ROUND(COALESCE(SUM(pci2.qty::numeric * pci2.cost::numeric), 0) * 100) / 100
                FROM (
                  SELECT pch_inner.id
                  FROM price_costing_headers pch_inner
                  WHERE pch_inner.menu_item_name = oi.name
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
              ),
              0
            )
        ),
        0
      ) * 100
    ) / 100 AS cogs_amount
  FROM sales_orders so
  JOIN orders      o  ON COALESCE(o.order_number, o.id::text) = so.reference
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
  RAISE NOTICE 'Migration 122: COGS trigger updated with variant-aware name matching; missing COGS entries backfilled.';
END $$;
