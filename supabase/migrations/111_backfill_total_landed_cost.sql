-- ─── Migration 111: Backfill total_landed_cost on receiving_report_items and receiving_reports ─
-- PROBLEM:
--   On some production instances the receiving_report_items table was created
--   without the total_landed_cost column entirely (migration 101 only adds it
--   when the table is created fresh; it cannot add a GENERATED ALWAYS column to
--   an already-existing table).  Other instances have it as a plain DECIMAL
--   DEFAULT 0 (never backfilled) or as a GENERATED ALWAYS column.
--   In all non-generated cases the Edit dialog shows TLC = ₱0.00 and the RR
--   list shows Total Landed Cost = ₱0.00.
--
-- FIX (three cases for receiving_report_items):
--   Case A — column missing entirely:
--     ADD COLUMN total_landed_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
--     then backfill as (qty * cost) + freight_allocated.
--   Case B — column exists as a plain DECIMAL (value = 0, never backfilled):
--     UPDATE to backfill as (qty * cost) + freight_allocated.
--   Case C — column is GENERATED ALWAYS:
--     Do nothing (PostgreSQL auto-computes it).
--
--   Always recompute receiving_reports.total_landed_cost from line items
--   (it is always a plain column).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_exists   BOOLEAN;
  v_is_generated BOOLEAN;
BEGIN
  -- Does the column exist at all?
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'total_landed_cost'
  ) INTO v_col_exists;

  IF NOT v_col_exists THEN
    -- Case A: column is absent — add it as a plain column then backfill
    ALTER TABLE receiving_report_items
      ADD COLUMN total_landed_cost DECIMAL(10,2) NOT NULL DEFAULT 0;

    UPDATE receiving_report_items
       SET total_landed_cost = (qty * cost) + freight_allocated;

    RAISE NOTICE 'Migration 111: added and backfilled total_landed_cost on receiving_report_items (column was missing).';
  ELSE
    -- Column exists — check whether it is GENERATED ALWAYS
    SELECT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'receiving_report_items'
         AND column_name  = 'total_landed_cost'
         AND is_generated = 'ALWAYS'
    ) INTO v_is_generated;

    IF v_is_generated THEN
      -- Case C: generated column — nothing to do
      RAISE NOTICE 'Migration 111: receiving_report_items.total_landed_cost is a generated column — DB computes it automatically, no UPDATE needed.';
    ELSE
      -- Case B: plain column — backfill
      UPDATE receiving_report_items
         SET total_landed_cost = (qty * cost) + freight_allocated;

      RAISE NOTICE 'Migration 111: backfilled total_landed_cost on receiving_report_items (plain column).';
    END IF;
  END IF;

  -- Always recompute the header-level total_landed_cost on receiving_reports
  -- (this is always a plain column regardless of how items were created).
  UPDATE receiving_reports rr
     SET total_landed_cost = (
       SELECT COALESCE(SUM((ri.qty * ri.cost) + ri.freight_allocated), 0)
         FROM receiving_report_items ri
        WHERE ri.receiving_report_id = rr.id
     );

  RAISE NOTICE 'Migration 111: recomputed total_landed_cost on receiving_reports from line items.';
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
