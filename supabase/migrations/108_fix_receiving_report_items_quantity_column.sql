-- ─── Migration 108: Fix quantity/qty column mismatch in receiving_report_items ─
-- PROBLEM:
--   Some production instances have a column named "quantity" (NOT NULL, no
--   default) in the receiving_report_items table.  The current application
--   inserts rows using the column "qty" instead, so "quantity" is never
--   populated and the NOT-NULL constraint raises:
--     null value in column "quantity" of relation "receiving_report_items"
--     violates not-null constraint
--
-- FIX:
--   1. If "quantity" exists AND "qty" does NOT exist:
--        Rename "quantity" → "qty" so the app's insert payload matches.
--   2. If BOTH "quantity" AND "qty" exist:
--        Add a default of 0 to "quantity" and drop its NOT-NULL constraint
--        so future inserts that omit it succeed.
--   3. If only "qty" exists: nothing to do.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_has_quantity BOOLEAN;
  v_has_qty      BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'quantity'
  ) INTO v_has_quantity;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'qty'
  ) INTO v_has_qty;

  -- Case 1: only "quantity" exists → rename it to "qty"
  IF v_has_quantity AND NOT v_has_qty THEN
    ALTER TABLE receiving_report_items
      RENAME COLUMN quantity TO qty;

    -- Ensure qty has a sensible default so it can never be null
    ALTER TABLE receiving_report_items
      ALTER COLUMN qty SET DEFAULT 0;

    RAISE NOTICE 'Migration 108: renamed quantity → qty';

  -- Case 2: both columns exist → relax the NOT-NULL on "quantity" so inserts
  --         that only supply "qty" do not fail
  ELSIF v_has_quantity AND v_has_qty THEN
    -- Backfill quantity from qty where quantity is null
    UPDATE receiving_report_items
       SET quantity = qty
     WHERE quantity IS NULL;

    ALTER TABLE receiving_report_items
      ALTER COLUMN quantity DROP NOT NULL;

    ALTER TABLE receiving_report_items
      ALTER COLUMN quantity SET DEFAULT 0;

    RAISE NOTICE 'Migration 108: relaxed NOT NULL on quantity, backfilled from qty';

  ELSE
    RAISE NOTICE 'Migration 108: no quantity column found, nothing to do';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
