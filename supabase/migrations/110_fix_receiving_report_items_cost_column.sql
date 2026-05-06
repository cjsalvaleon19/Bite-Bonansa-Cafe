-- ─── Migration 110: Fix cost_per_unit/cost column mismatch in receiving_report_items ─
-- PROBLEM:
--   Some production instances have a column named "cost_per_unit" (NOT NULL,
--   no default) in the receiving_report_items table.  The current application
--   inserts rows using the column name "cost" instead, so "cost_per_unit" is
--   never populated and the NOT-NULL constraint raises:
--     null value in column "cost_per_unit" of relation "receiving_report_items"
--     violates not-null constraint
--
-- FIX (same idempotent pattern as migrations 108 and 109):
--   1. If "cost_per_unit" exists AND "cost" does NOT exist:
--        Rename "cost_per_unit" → "cost" so the app's insert payload matches.
--        Note: the generated column total_landed_cost = (qty * cost) + freight_allocated
--        will continue to work because it references the now-correctly-named column.
--   2. If BOTH "cost_per_unit" AND "cost" exist:
--        Backfill "cost_per_unit" from "cost" where null, drop the NOT-NULL
--        constraint on "cost_per_unit", and set its default to 0 so future
--        inserts that only supply "cost" succeed.
--   3. If only "cost" exists: nothing to do.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_has_cost_per_unit BOOLEAN;
  v_has_cost          BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'cost_per_unit'
  ) INTO v_has_cost_per_unit;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'cost'
  ) INTO v_has_cost;

  -- Case 1: only "cost_per_unit" exists → rename to "cost"
  IF v_has_cost_per_unit AND NOT v_has_cost THEN
    ALTER TABLE receiving_report_items
      RENAME COLUMN cost_per_unit TO cost;

    -- Ensure cost has a sensible default
    ALTER TABLE receiving_report_items
      ALTER COLUMN cost SET DEFAULT 0;

    RAISE NOTICE 'Migration 110: renamed cost_per_unit → cost';

  -- Case 2: both columns exist → relax NOT NULL on "cost_per_unit"
  ELSIF v_has_cost_per_unit AND v_has_cost THEN
    -- Backfill cost_per_unit from cost where null
    UPDATE receiving_report_items
       SET cost_per_unit = cost
     WHERE cost_per_unit IS NULL AND cost IS NOT NULL;

    ALTER TABLE receiving_report_items
      ALTER COLUMN cost_per_unit DROP NOT NULL;

    ALTER TABLE receiving_report_items
      ALTER COLUMN cost_per_unit SET DEFAULT 0;

    RAISE NOTICE 'Migration 110: relaxed NOT NULL on cost_per_unit, backfilled from cost';

  ELSE
    RAISE NOTICE 'Migration 110: no cost_per_unit column found, nothing to do';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
