-- Migration 129: Add-on COGS recognition in order journal entries
--
-- Problem: Add-on variants (e.g. "Coffee Jelly") stored in order_items.variant_details
--   under a key whose normalised form is "addons" (e.g. "Add Ons", "Add-ons")
--   were never costed because the previous trigger excluded addon keys when
--   building variant-name candidates and never tried to look them up separately.
--
-- Solution:
--   1. A single generic price_costing_header named "Coffee Jelly" (without a
--      parent-item suffix) is the source of truth for an add-on's raw material cost.
--   2. The COGS calculation now sums:
--        • base item raw-material cost  (same logic as migration 127)
--        • Σ raw-material cost per add-on option found in variant_details
--   Both parts are multiplied by order_item.quantity.
--
-- The add-on key detection normalises the variant_details key by stripping
-- spaces and hyphens then checking for "addon" or "addons":
--   "Add Ons" → "addons" ✓
--   "Add-ons" → "addons" ✓
--   "Addons"  → "addons" ✓
--
-- The base-item variant exclusion is also updated to use the same normalisation
-- so that "Add Ons" (the current standardised name, which LOWER() = "add ons")
-- is correctly excluded from base-item variant candidates too.

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

  -- Revenue lines (idempotent)
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

  -- Rewards earned
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

  -- COGS line: base item cost + add-on costs, both multiplied by quantity
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

        -- ── Base item cost (size-aware, addon keys excluded) ─────────────────
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
              -- exclude add-on keys (normalise: strip spaces and hyphens)
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

        -- ── Add-on costs from variant_details ────────────────────────────────
        -- Add-on keys: normalise key → strip spaces & hyphens → "addons"
        -- Values are comma-separated option names (e.g. "Coffee Jelly, Pearls")
        -- Each option is matched against price_costing_headers.menu_item_name
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_order_journal_entries skipped for %: % (%)', v_ref, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Re-create trigger (unchanged)
DROP TRIGGER IF EXISTS trg_create_order_journal_entries ON orders;
CREATE TRIGGER trg_create_order_journal_entries
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_journal_entries();

-- ── Backfill: insert COGS entries for orders that have none yet ───────────────
-- (uses the same enhanced formula so new costing for add-ons is included)
WITH order_scope AS (
  SELECT
    o.id::text                                                         AS order_id_text,
    COALESCE(o.order_number, o.id::text)                               AS order_ref,
    COALESCE((o.completed_at)::date, (o.created_at)::date, CURRENT_DATE) AS je_date,
    COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-in')             AS contact_name
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
  -- Base cost sub-query
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
  -- Add-on cost sub-query
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

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 129: COGS trigger updated to include add-on costing. '
               'Add-on keys normalised via strip-spaces/hyphens. '
               'Backfill inserted for orders missing COGS entries.';
END $$;
