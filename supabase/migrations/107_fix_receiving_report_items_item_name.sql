-- ─── Migration 107: Fix item_name column in receiving_report_items ────────────
-- PROBLEM:
--   Some production instances have a column named "item_name" (NOT NULL, no
--   default) in the receiving_report_items table.  The current application
--   inserts rows using the column "inventory_name" instead, so "item_name" is
--   never populated and the NOT-NULL constraint raises:
--     null value in column "item_name" of relation "receiving_report_items"
--     violates not-null constraint
--
-- FIX:
--   1. If "item_name" exists AND "inventory_name" does NOT exist:
--        Rename "item_name" → "inventory_name" so the app's insert payload
--        matches the column name.
--   2. If BOTH "item_name" AND "inventory_name" exist:
--        Backfill "inventory_name" from "item_name" for any rows where
--        "inventory_name" is empty, then drop the NOT-NULL constraint on
--        "item_name" (set default to '') so future inserts that omit it succeed.
--   3. If only "inventory_name" exists: nothing to do.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_has_item_name      BOOLEAN;
  v_has_inventory_name BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'item_name'
  ) INTO v_has_item_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'inventory_name'
  ) INTO v_has_inventory_name;

  -- Case 1: only item_name exists → rename it to inventory_name
  IF v_has_item_name AND NOT v_has_inventory_name THEN
    ALTER TABLE receiving_report_items
      RENAME COLUMN item_name TO inventory_name;

    -- Ensure inventory_name has a sensible default so it can never be null
    ALTER TABLE receiving_report_items
      ALTER COLUMN inventory_name SET DEFAULT '';

    RAISE NOTICE 'Migration 107: renamed item_name → inventory_name';

  -- Case 2: both columns exist → backfill then relax the constraint on item_name
  ELSIF v_has_item_name AND v_has_inventory_name THEN
    -- Backfill inventory_name from item_name where inventory_name is blank
    UPDATE receiving_report_items
       SET inventory_name = item_name
     WHERE (inventory_name IS NULL OR inventory_name = '')
       AND item_name IS NOT NULL
       AND item_name <> '';

    -- Remove NOT-NULL and add a default so future inserts that omit item_name succeed
    ALTER TABLE receiving_report_items
      ALTER COLUMN item_name DROP NOT NULL;

    ALTER TABLE receiving_report_items
      ALTER COLUMN item_name SET DEFAULT '';

    RAISE NOTICE 'Migration 107: relaxed NOT NULL on item_name, backfilled inventory_name';

  ELSE
    RAISE NOTICE 'Migration 107: no item_name column found, nothing to do';
  END IF;
END $$;

-- Ensure inventory_name always has a default '' so it never blocks inserts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'inventory_name'
  ) THEN
    ALTER TABLE receiving_report_items
      ALTER COLUMN inventory_name SET DEFAULT '';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
