-- Migration 127:
-- 1) Keep order journal entries complete and consistent:
--    - Revenue line(s)
--    - COGS line
--    - Rewards line (only when customer_id exists and earnings_amount > 0)
-- 2) Ensure credit-card sales debit "Owner's Capital" (not cash accounts)
-- 3) Ensure journal entry contact/name is never blank for order entries
-- 4) Backfill existing records to the same rules

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
  -- Only fire on transition TO order_delivered
  IF NEW.status <> 'order_delivered' THEN RETURN NEW; END IF;
  IF OLD.status  = 'order_delivered' THEN RETURN NEW; END IF;

  v_ref     := COALESCE(NEW.order_number, NEW.id::text);
  v_date    := COALESCE((NEW.completed_at)::date, CURRENT_DATE);
  v_total   := ROUND(COALESCE(NEW.total_amount::numeric, 0) * 100) / 100;
  v_points  := ROUND(COALESCE(NEW.points_used::numeric,  0) * 100) / 100;
  v_name    := COALESCE(NULLIF(TRIM(NEW.customer_name), ''), 'Walk-in');
  v_payment := LOWER(COALESCE(NEW.payment_method, 'cash'));

  -- Revenue lines (idempotent: any Revenue credit for this order)
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'order'
      AND reference::text = v_ref
      AND credit_account = 'Revenue'
  ) THEN
    -- Points-used portion
    IF v_payment LIKE '%points%' AND v_points > 0 THEN
      INSERT INTO journal_entries
        (date, description, debit_account, credit_account, amount, reference_type, reference, name)
      VALUES
        (v_date, 'Sale: ' || v_ref, 'Accounts Payable', 'Revenue',
         v_points, 'order', v_ref, v_name);
    END IF;

    -- Cash / bank / credit-card portion
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

  -- Rewards earned (situational: only when order has customer_id)
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

  -- COGS line (variant-aware; prefers Size candidate, then other non-addon candidates, then base)
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'order'
      AND reference::text = v_ref
      AND debit_account = 'Cost of Goods Sold'
  ) THEN
    SELECT ROUND(
             COALESCE(
               SUM((oi.quantity::numeric) * COALESCE(item_cost.raw_material_cost, 0)),
               0
             ) * 100
           ) / 100
      INTO v_cogs
      FROM order_items oi
      LEFT JOIN LATERAL (
        SELECT ROUND(COALESCE(SUM(pci2.qty::numeric * pci2.cost::numeric), 0) * 100) / 100 AS raw_material_cost
        FROM (
          SELECT pch_inner.id
          FROM price_costing_headers pch_inner
          LEFT JOIN LATERAL (
            SELECT
              oi.name || ' - ' || kv.value AS candidate_name,
              CASE
                WHEN LOWER(kv.key) = 'size' THEN 1
                ELSE 2
              END AS priority
            FROM jsonb_each_text(COALESCE(oi.variant_details, '{}'::jsonb)) kv
            WHERE LOWER(kv.key) = 'size'
               OR LOWER(kv.key) NOT IN ('addon', 'addons')
          ) cand ON pch_inner.menu_item_name = cand.candidate_name
          WHERE pch_inner.menu_item_name = oi.name
             OR cand.candidate_name IS NOT NULL
          ORDER BY COALESCE(cand.priority, 3), LENGTH(pch_inner.menu_item_name) DESC
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

DROP TRIGGER IF EXISTS trg_create_order_journal_entries ON orders;
CREATE TRIGGER trg_create_order_journal_entries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_journal_entries();

-- Ensure credit-card order sales debit to Owner's Capital
UPDATE journal_entries je
SET debit_account = 'Owner''s Capital'
FROM orders o
WHERE je.reference_type = 'order'
  AND je.credit_account = 'Revenue'
  AND je.debit_account IN ('Cash on Hand', 'Cash in Bank')
  AND (je.reference::text = COALESCE(o.order_number, o.id::text) OR je.reference::text = o.id::text)
  AND (
    LOWER(COALESCE(o.payment_method, '')) LIKE '%credit%'
    OR LOWER(COALESCE(o.payment_method, '')) LIKE '%card%'
  );

-- Ensure order entry contact/name is not blank
UPDATE journal_entries je
SET name = COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in')
FROM orders o
WHERE je.reference_type = 'order'
  AND (je.reference::text = COALESCE(o.order_number, o.id::text) OR je.reference::text = o.id::text)
  AND COALESCE(TRIM(je.name), '') = '';

-- Backfill missing rewards entries for delivered/completed orders with customer_id
INSERT INTO journal_entries
  (date, description, debit_account, credit_account, amount, reference_type, reference, name)
SELECT
  COALESCE((o.completed_at)::date, (o.created_at)::date, CURRENT_DATE),
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

-- Backfill missing COGS entries
WITH order_scope AS (
  SELECT
    o.id::text AS order_id_text,
    COALESCE(o.order_number, o.id::text) AS order_ref,
    COALESCE((o.completed_at)::date, (o.created_at)::date, CURRENT_DATE) AS je_date,
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
    ROUND(
      COALESCE(
        SUM((oi.quantity::numeric) * COALESCE(item_cost.raw_material_cost, 0)),
        0
      ) * 100
    ) / 100 AS cogs_amount
  FROM order_scope os
  JOIN order_items oi ON oi.order_id = os.order_id_text
  LEFT JOIN LATERAL (
    SELECT ROUND(COALESCE(SUM(pci2.qty::numeric * pci2.cost::numeric), 0) * 100) / 100 AS raw_material_cost
    FROM (
      SELECT pch_inner.id
      FROM price_costing_headers pch_inner
      LEFT JOIN LATERAL (
        SELECT
          oi.name || ' - ' || kv.value AS candidate_name,
          CASE
            WHEN LOWER(kv.key) = 'size' THEN 1
            ELSE 2
          END AS priority
        FROM jsonb_each_text(COALESCE(oi.variant_details, '{}'::jsonb)) kv
        WHERE LOWER(kv.key) = 'size'
           OR LOWER(kv.key) NOT IN ('addon', 'addons')
      ) cand ON pch_inner.menu_item_name = cand.candidate_name
      WHERE pch_inner.menu_item_name = oi.name
         OR cand.candidate_name IS NOT NULL
      ORDER BY COALESCE(cand.priority, 3), LENGTH(pch_inner.menu_item_name) DESC
      LIMIT 1
    ) best_h
    JOIN price_costing_items pci2 ON pci2.costing_header_id = best_h.id
  ) item_cost ON TRUE
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

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 127: order journal rules enforced (Owner''s Capital, non-blank contact, rewards/customer_id, size-aware COGS) with backfills.';
END $$;
