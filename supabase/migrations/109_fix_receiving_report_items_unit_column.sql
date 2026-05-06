-- ─── Migration 109: Fix unit/uom column mismatch in receiving_report_items ────
-- PROBLEM:
--   Some production instances have a column named "unit" (NOT NULL, no default)
--   in the receiving_report_items table.  The current application inserts rows
--   using the column "uom" instead, so "unit" is never populated and the
--   NOT-NULL constraint raises:
--     null value in column "unit" of relation "receiving_report_items"
--     violates not-null constraint
--
-- FIX:
--   1. If "unit" exists AND "uom" does NOT exist:
--        Rename "unit" → "uom" so the app's insert payload matches.
--   2. If BOTH "unit" AND "uom" exist:
--        Backfill "unit" from "uom" where "unit" is null, drop the NOT-NULL
--        constraint on "unit", and set its default to '' so future inserts
--        that only supply "uom" succeed.
--   3. If only "uom" exists: nothing to do.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_has_unit BOOLEAN;
  v_has_uom  BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'unit'
  ) INTO v_has_unit;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'uom'
  ) INTO v_has_uom;

  -- Case 1: only "unit" exists → rename it to "uom"
  IF v_has_unit AND NOT v_has_uom THEN
    ALTER TABLE receiving_report_items
      RENAME COLUMN unit TO uom;

    -- Ensure uom has a sensible default so it can never be null
    ALTER TABLE receiving_report_items
      ALTER COLUMN uom SET DEFAULT 'pcs';

    RAISE NOTICE 'Migration 109: renamed unit → uom';

  -- Case 2: both columns exist → relax the NOT-NULL on "unit" so inserts
  --         that only supply "uom" do not fail
  ELSIF v_has_unit AND v_has_uom THEN
    -- Backfill unit from uom where unit is null
    UPDATE receiving_report_items
       SET unit = uom
     WHERE unit IS NULL AND uom IS NOT NULL;

    ALTER TABLE receiving_report_items
      ALTER COLUMN unit DROP NOT NULL;

    ALTER TABLE receiving_report_items
      ALTER COLUMN unit SET DEFAULT '';

    RAISE NOTICE 'Migration 109: relaxed NOT NULL on unit, backfilled from uom';

  ELSE
    RAISE NOTICE 'Migration 109: no unit column found, nothing to do';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
