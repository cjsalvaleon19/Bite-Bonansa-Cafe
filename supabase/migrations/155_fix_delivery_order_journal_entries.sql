-- Migration 155: Fix missing journal entries for delivery orders
-- ─────────────────────────────────────────────────────────────────────────────
-- Two root causes discovered for ORD-260514-023 (and all delivery orders):
--
-- 1. SINGLE EXCEPTION BLOCK: The trigger uses one BEGIN-EXCEPTION block.
--    In PL/pgSQL, a caught exception rolls back ALL DML inside that block.
--    If the COGS SELECT query throws any error, the Revenue entry already
--    INSERTed inside the same block is also rolled back — leaving the order
--    with zero journal entries, silently.
--    FIX: Give Revenue, Rewards, and COGS each their own BEGIN-EXCEPTION sub-
--    block so a failure in one section never discards entries from another.
--
-- 2. completed_at IS NULL FOR DELIVERY ORDERS: When the rider marks a delivery
--    complete, the orders table is updated with only:
--      status = 'order_delivered', delivered_at = <timestamp>
--    completed_at is never set. The trigger used COALESCE(completed_at, CURRENT_DATE)
--    for the journal entry date. With completed_at = NULL, every delivery order
--    journal entry is dated to today's UTC date, which is wrong for entries
--    created close to midnight or on past deliveries, and causes them to
--    disappear from admin date-range filters.
--    FIX: Add delivered_at as a fallback:
--      COALESCE(completed_at, delivered_at, CURRENT_DATE)::date
--
-- Additional data fix:
--    Backfill completed_at = delivered_at for delivery orders where
--    completed_at IS NULL, so existing entries get the correct date.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Backfill completed_at for delivery orders that are missing it ──────────
UPDATE orders
SET completed_at = delivered_at
WHERE status = 'order_delivered'
  AND completed_at IS NULL
  AND delivered_at IS NOT NULL;

-- ── 2. Rebuild the trigger with independent exception blocks + delivered_at ───
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
  -- Only fire on the transition TO a completed order status.
  IF NEW.status NOT IN ('order_delivered', 'completed') THEN RETURN NEW; END IF;
  IF OLD.status IN ('order_delivered', 'completed') THEN RETURN NEW; END IF;

  v_ref     := COALESCE(NEW.order_number, NEW.id::text);
  -- Use delivered_at as fallback for delivery orders where completed_at is not set.
  v_date    := COALESCE(NEW.completed_at, NEW.delivered_at, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date;
  v_total   := ROUND(COALESCE(NEW.total_amount::numeric, 0) * 100) / 100;
  v_points  := ROUND(COALESCE(NEW.points_used::numeric,  0) * 100) / 100;
  v_name    := COALESCE(NULLIF(TRIM(NEW.customer_name), ''), 'Walk-in');
  v_payment := LOWER(COALESCE(NEW.payment_method, 'cash'));

  -- ── Revenue lines (independent block so COGS failure cannot discard this) ──
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'order'
        AND reference::text = v_ref
        AND credit_account = 'Revenue'
    ) THEN
      IF v_payment LIKE '%points%' AND v_points > 0 THEN
        INSERT INTO journal_entries
          (date, description, debit_account, credit_account, amount, reference_type, reference, name)
        VALUES
          (v_date, 'Sale: ' || v_ref, 'Accounts Payable', 'Revenue',
           v_points, 'order', v_ref, v_name);
      END IF;

      v_cash_amt := v_total - CASE WHEN v_payment LIKE '%points%' THEN v_points ELSE 0 END;
      IF v_cash_amt > 0 THEN
        v_debit_acct := CASE
          WHEN v_payment LIKE '%credit%' OR v_payment LIKE '%card%' THEN 'Owner''s Capital'
          WHEN v_payment LIKE '%gcash%' OR v_payment LIKE '%bank%' THEN 'Cash in Bank'
          ELSE 'Cash on Hand'
        END;
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

  -- ── Rewards earned (independent block) ────────────────────────────────────
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'order'
        AND reference::text = v_ref
        AND debit_account = 'Rewards'
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

  -- ── COGS line (independent block: failure here does not undo Revenue) ──────
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'order'
        AND reference::text = v_ref
        AND debit_account = 'Cost of Goods Sold'
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

-- ── 3. Backfill missing revenue rows for delivery and completed orders ────────
-- Uses COALESCE(completed_at, delivered_at, created_at) for correct date.
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  COALESCE(o.completed_at, o.delivered_at, o.created_at)::date,
  'Sale: ' || COALESCE(o.order_number, o.id::text),
  CASE
    WHEN LOWER(COALESCE(o.payment_method, '')) LIKE '%credit%'
      OR LOWER(COALESCE(o.payment_method, '')) LIKE '%card%'
      THEN 'Owner''s Capital'
    WHEN LOWER(COALESCE(o.payment_method, '')) LIKE '%gcash%'
      OR LOWER(COALESCE(o.payment_method, '')) LIKE '%bank%'
      THEN 'Cash in Bank'
    ELSE 'Cash on Hand'
  END,
  'Revenue',
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
WHERE o.status IN ('order_delivered', 'completed')
  AND ROUND(
    (
      COALESCE(o.total_amount::numeric, 0)
      - CASE
          WHEN LOWER(COALESCE(o.payment_method, '')) LIKE '%points%'
            THEN COALESCE(o.points_used::numeric, 0)
          ELSE 0
        END
    ) * 100
  ) / 100 > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference::text = COALESCE(o.order_number, o.id::text)
      AND je.credit_account = 'Revenue'
      AND je.debit_account IN ('Cash on Hand', 'Cash in Bank', 'Owner''s Capital')
  );

-- Backfill missing points-used revenue rows.
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  COALESCE(o.completed_at, o.delivered_at, o.created_at)::date,
  'Sale: ' || COALESCE(o.order_number, o.id::text),
  'Accounts Payable',
  'Revenue',
  ROUND(COALESCE(o.points_used::numeric, 0) * 100) / 100,
  'order',
  COALESCE(o.order_number, o.id::text),
  COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in')
FROM orders o
WHERE o.status IN ('order_delivered', 'completed')
  AND LOWER(COALESCE(o.payment_method, '')) LIKE '%points%'
  AND COALESCE(o.points_used::numeric, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference::text = COALESCE(o.order_number, o.id::text)
      AND je.debit_account = 'Accounts Payable'
      AND je.credit_account = 'Revenue'
  );

-- Backfill missing rewards entries.
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  COALESCE(o.completed_at, o.delivered_at, o.created_at)::date,
  'Loyalty Points Earned: ' || COALESCE(o.order_number, o.id::text),
  'Rewards',
  'Accounts Payable - Rewards',
  ROUND(COALESCE(o.earnings_amount::numeric, 0) * 100) / 100,
  'order',
  COALESCE(o.order_number, o.id::text),
  COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in')
FROM orders o
WHERE o.status IN ('order_delivered', 'completed')
  AND o.customer_id IS NOT NULL
  AND COALESCE(o.earnings_amount::numeric, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'order'
      AND je.reference::text = COALESCE(o.order_number, o.id::text)
      AND je.debit_account = 'Rewards'
  );

-- Backfill missing COGS entries.
WITH order_scope AS (
  SELECT
    o.id::text AS order_id_text,
    COALESCE(o.order_number, o.id::text) AS order_ref,
    COALESCE(o.completed_at, o.delivered_at, o.created_at)::date AS je_date,
    COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in') AS contact_name
  FROM orders o
  WHERE o.status IN ('order_delivered', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.reference_type = 'order'
        AND je.reference::text = COALESCE(o.order_number, o.id::text)
        AND je.debit_account = 'Cost of Goods Sold'
    )
),
cogs_amounts AS (
  SELECT
    os.je_date,
    os.order_ref,
    os.contact_name,
    ROUND(COALESCE(SUM(
      oi.quantity::numeric * (
        COALESCE(base_cost.raw_material_cost, 0) +
        COALESCE(addon_cost.addon_total, 0)
      )
    ), 0) * 100) / 100 AS cogs_amount
  FROM order_scope os
  JOIN order_items oi ON oi.order_id = os.order_id_text
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
  GROUP BY os.je_date, os.order_ref, os.contact_name
)
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  je_date,
  'COGS: ' || order_ref,
  'Cost of Goods Sold',
  'Inventory',
  cogs_amount,
  'order',
  order_ref,
  contact_name
FROM cogs_amounts
WHERE cogs_amount > 0;

-- ── 4. Fix dates on existing journal entries that used CURRENT_DATE (UTC) ──────
-- For delivery orders where completed_at was missing, the trigger previously
-- wrote CURRENT_DATE (UTC server time) as the journal entry date. Now that
-- completed_at has been backfilled from delivered_at (step 1 above), we can
-- correct those journal dates that do not match the order's actual completion date.
UPDATE journal_entries je
SET date = COALESCE(o.completed_at, o.delivered_at, o.created_at)::date
FROM orders o
WHERE je.reference_type = 'order'
  AND je.reference::text = COALESCE(o.order_number, o.id::text)
  AND je.date <> COALESCE(o.completed_at, o.delivered_at, o.created_at)::date
  AND o.status IN ('order_delivered', 'completed')
  AND o.delivered_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 155: delivery order journal entry date and exception-safety fixes applied.';
END $$;
