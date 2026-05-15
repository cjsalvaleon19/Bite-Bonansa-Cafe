-- Migration 156: Order journal entries – Revenue = Subtotal, Delivery Fee → Delivery Income
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- Changes:
--   1. Revenue credit now uses `subtotal` (item total, pre-delivery-fee) instead of
--      `total_amount`.  VAT is currently 0, so total_amount = subtotal + delivery_fee.
--   2. When an order has a delivery_fee > 0, a separate journal entry is inserted:
--        Dr. Cash on Hand / Cash in Bank   →   Cr. Delivery Income   (delivery_fee)
--   3. The trigger idempotency guard is updated so it correctly skips only when
--      both the Revenue and Delivery Income entries already exist.
--   4. Backfill: existing Revenue entries whose amount > the order subtotal are
--      corrected, and missing Delivery Income entries are inserted.
-- ─────────────────────────────────────────────────────────────────────────────────────────

-- ── 1. Rebuild the trigger function ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_order_journal_entries()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ref          TEXT;
  v_date         DATE;
  v_subtotal     NUMERIC;
  v_delivery_fee NUMERIC;
  v_points       NUMERIC;
  v_cash_amt     NUMERIC;
  v_debit_acct   TEXT;
  v_name         TEXT;
  v_payment      TEXT;
  v_cogs         NUMERIC;
  v_earned       NUMERIC;
BEGIN
  -- Only fire on the transition TO a completed order status.
  IF NEW.status NOT IN ('order_delivered', 'completed') THEN RETURN NEW; END IF;
  IF OLD.status IN ('order_delivered', 'completed')     THEN RETURN NEW; END IF;

  v_ref          := COALESCE(NEW.order_number, NEW.id::text);
  -- Use delivered_at as fallback for delivery orders where completed_at is not set.
  v_date         := COALESCE(NEW.completed_at, NEW.delivered_at,
                             CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date;
  -- Revenue = subtotal (item total, excluding delivery fee and VAT).
  v_subtotal     := ROUND(COALESCE(NEW.subtotal::numeric, 0) * 100) / 100;
  v_delivery_fee := ROUND(COALESCE(NEW.delivery_fee::numeric, 0) * 100) / 100;
  v_points       := ROUND(COALESCE(NEW.points_used::numeric, 0) * 100) / 100;
  v_name         := COALESCE(NULLIF(TRIM(NEW.customer_name), ''), 'Walk-in');
  v_payment      := LOWER(COALESCE(NEW.payment_method, 'cash'));

  -- Determine debit account from payment method.
  v_debit_acct := CASE
    WHEN v_payment LIKE '%credit%' OR v_payment LIKE '%card%' THEN 'Owner''s Capital'
    WHEN v_payment LIKE '%gcash%'  OR v_payment LIKE '%bank%'  THEN 'Cash in Bank'
    ELSE 'Cash on Hand'
  END;

  -- ── Revenue lines (Dr. Cash/Bank → Cr. Revenue = subtotal) ───────────────────
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'order'
        AND reference::text = v_ref
        AND credit_account  = 'Revenue'
    ) THEN
      -- Points portion → Dr. Accounts Payable / Cr. Revenue
      IF v_payment LIKE '%points%' AND v_points > 0 THEN
        INSERT INTO journal_entries
          (date, description, debit_account, credit_account, amount, reference_type, reference, name)
        VALUES
          (v_date, 'Sale: ' || v_ref, 'Accounts Payable', 'Revenue',
           v_points, 'order', v_ref, v_name);
      END IF;

      -- Cash / GCash / credit-card portion → Dr. Cash/Bank / Cr. Revenue
      v_cash_amt := v_subtotal - CASE WHEN v_payment LIKE '%points%' THEN v_points ELSE 0 END;
      IF v_cash_amt > 0 THEN
        INSERT INTO journal_entries
          (date, description, debit_account, credit_account, amount, reference_type, reference, name)
        VALUES
          (v_date, 'Sale: ' || v_ref, v_debit_acct, 'Revenue',
           v_cash_amt, 'order', v_ref, v_name);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_order_journal_entries revenue skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  END;

  -- ── Delivery Income (Dr. Cash/Bank → Cr. Delivery Income = delivery_fee) ─────
  BEGIN
    IF v_delivery_fee > 0 AND NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'order'
        AND reference::text = v_ref
        AND credit_account  = 'Delivery Income'
    ) THEN
      INSERT INTO journal_entries
        (date, description, debit_account, credit_account, amount, reference_type, reference, name)
      VALUES
        (v_date, 'Delivery Fee: ' || v_ref, v_debit_acct, 'Delivery Income',
         v_delivery_fee, 'order', v_ref, v_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_order_journal_entries delivery income skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  END;

  -- ── Rewards earned (unchanged) ────────────────────────────────────────────────
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'order'
        AND reference::text = v_ref
        AND debit_account   = 'Rewards'
    ) THEN
      v_earned := ROUND(COALESCE(NEW.earnings_amount::numeric, 0) * 100) / 100;
      IF NEW.customer_id IS NOT NULL AND v_earned > 0 THEN
        INSERT INTO journal_entries
          (date, description, debit_account, credit_account, amount, reference_type, reference, name)
        VALUES
          (v_date, 'Loyalty Points Earned: ' || v_ref, 'Rewards', 'Accounts Payable - Rewards',
           v_earned, 'order', v_ref, v_name);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_order_journal_entries rewards skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  END;

  -- ── COGS line (unchanged) ─────────────────────────────────────────────────────
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'order'
        AND reference::text = v_ref
        AND debit_account   = 'Cost of Goods Sold'
    ) THEN
      SELECT ROUND(COALESCE(SUM(item_total), 0) * 100) / 100
        INTO v_cogs
        FROM (
          SELECT
            oi.quantity::numeric * (
              COALESCE(base_cost.raw_material_cost, 0) +
              COALESCE(addon_cost.addon_total,       0)
            ) AS item_total
          FROM order_items oi

          LEFT JOIN LATERAL (
            SELECT ROUND(COALESCE(SUM(pci2.qty::numeric * pci2.cost::numeric), 0) * 100) / 100
                     AS raw_material_cost
            FROM (
              SELECT pch_inner.id
              FROM price_costing_headers pch_inner
              LEFT JOIN LATERAL (
                SELECT
                  oi.name || ' - ' || kv.value AS candidate_name,
                  CASE WHEN LOWER(kv.key) = 'size' THEN 1 ELSE 2 END AS priority
                FROM jsonb_each_text(COALESCE(oi.variant_details, '{}'::jsonb)) kv
                WHERE LOWER(REPLACE(REPLACE(kv.key, '-', ''), ' ', ''))
                      NOT IN ('addon', 'addons')
              ) cand ON pch_inner.menu_item_name = cand.candidate_name
              WHERE pch_inner.menu_item_name = oi.name
                 OR cand.candidate_name IS NOT NULL
              ORDER BY COALESCE(cand.priority, 3), LENGTH(pch_inner.menu_item_name) DESC
              LIMIT 1
            ) best_h
            JOIN price_costing_items pci2 ON pci2.costing_header_id = best_h.id
          ) base_cost ON TRUE

          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(addon_raw), 0) AS addon_total
            FROM (
              SELECT
                COALESCE(
                  (
                    SELECT ROUND(COALESCE(SUM(pci3.qty::numeric * pci3.cost::numeric), 0) * 100) / 100
                    FROM price_costing_headers pch3
                    JOIN price_costing_items pci3 ON pci3.costing_header_id = pch3.id
                    WHERE pch3.menu_item_name = TRIM(addon_val.addon_name)
                    LIMIT 1
                  ),
                  0
                ) AS addon_raw
              FROM (
                SELECT TRIM(unnest(string_to_array(kv.value, ','))) AS addon_name
                FROM jsonb_each_text(COALESCE(oi.variant_details, '{}'::jsonb)) kv
                WHERE LOWER(REPLACE(REPLACE(kv.key, '-', ''), ' ', ''))
                      IN ('addon', 'addons')
              ) addon_val
              WHERE TRIM(addon_val.addon_name) <> ''
            ) addon_sums
          ) addon_cost ON TRUE

          WHERE oi.order_id = NEW.id::text
        ) order_item_costs;

      IF v_cogs > 0 THEN
        INSERT INTO journal_entries
          (date, description, debit_account, credit_account, amount, reference_type, reference, name)
        VALUES
          (v_date, 'COGS: ' || v_ref, 'Cost of Goods Sold', 'Inventory',
           v_cogs, 'order', v_ref, v_name);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_order_journal_entries COGS skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_order_journal_entries ON orders;
CREATE TRIGGER trg_create_order_journal_entries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_journal_entries();


-- ── 2. Backfill: correct existing Revenue entries that used total_amount ──────────────────
-- For orders where subtotal < the recorded revenue amount, update the Revenue entry
-- to use subtotal instead.  Only touch the cash/bank/capital debit lines (not points lines).
UPDATE journal_entries je
SET amount = ROUND(COALESCE(o.subtotal::numeric, 0) * 100) / 100
FROM orders o
WHERE je.reference_type = 'order'
  AND je.reference::text = COALESCE(o.order_number, o.id::text)
  AND je.credit_account  = 'Revenue'
  AND je.debit_account  IN ('Cash on Hand', 'Cash in Bank', 'Owner''s Capital')
  AND o.status IN ('order_delivered', 'completed')
  -- Only update rows where the recorded amount doesn't match subtotal
  -- (i.e. it was previously recorded as total_amount which includes delivery_fee).
  AND ROUND(COALESCE(o.subtotal::numeric, 0) * 100) / 100 <> je.amount
  AND COALESCE(o.delivery_fee::numeric, 0) > 0;


-- ── 3. Backfill: insert missing Delivery Income entries ───────────────────────────────────
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  COALESCE(o.completed_at, o.delivered_at, o.created_at)::date,
  'Delivery Fee: ' || COALESCE(o.order_number, o.id::text),
  CASE
    WHEN LOWER(COALESCE(o.payment_method, '')) LIKE '%credit%'
      OR LOWER(COALESCE(o.payment_method, '')) LIKE '%card%'
      THEN 'Owner''s Capital'
    WHEN LOWER(COALESCE(o.payment_method, '')) LIKE '%gcash%'
      OR LOWER(COALESCE(o.payment_method, '')) LIKE '%bank%'
      THEN 'Cash in Bank'
    ELSE 'Cash on Hand'
  END,
  'Delivery Income',
  ROUND(COALESCE(o.delivery_fee::numeric, 0) * 100) / 100,
  'order',
  COALESCE(o.order_number, o.id::text),
  COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in')
FROM orders o
WHERE o.status IN ('order_delivered', 'completed')
  AND ROUND(COALESCE(o.delivery_fee::numeric, 0) * 100) / 100 > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference::text = COALESCE(o.order_number, o.id::text)
      AND je.credit_account  = 'Delivery Income'
  );


-- ── 4. Reload PostgREST schema cache ─────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 156: Revenue = subtotal; Delivery Income entries added.';
END $$;
