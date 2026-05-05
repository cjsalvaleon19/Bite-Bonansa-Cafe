-- ─── Migration 111: Backfill total_landed_cost on receiving_report_items and receiving_reports ─
-- PROBLEM:
--   On production instances where the receiving_report_items table was created
--   before migration 101, total_landed_cost is a plain DECIMAL column (DEFAULT 0)
--   rather than a GENERATED ALWAYS column.  The application's saveRR() function
--   never included total_landed_cost in the INSERT payload, so all existing rows
--   have total_landed_cost = 0.  As a result:
--     1. The Edit dialog shows TLC = ₱0.00 for every line item.
--     2. The RR list shows Total Landed Cost = ₱0.00 for every report.
--
-- FIX:
--   1. If total_landed_cost on receiving_report_items is a plain column (not
--      GENERATED ALWAYS), backfill it as (qty * cost) + freight_allocated.
--      If it is already a generated column, PostgreSQL auto-computes it and no
--      UPDATE is needed (attempting to UPDATE a generated column would error).
--   2. Recompute receiving_reports.total_landed_cost as the sum of per-item
--      (qty * cost) + freight_allocated for every report.  This is always a
--      plain column so we can always UPDATE it.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_is_generated BOOLEAN;
BEGIN
  -- Check whether total_landed_cost is a GENERATED ALWAYS column
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'total_landed_cost'
       AND is_generated = 'ALWAYS'
  ) INTO v_is_generated;

  IF v_is_generated THEN
    RAISE NOTICE 'Migration 111: receiving_report_items.total_landed_cost is a generated column — DB computes it automatically, no UPDATE needed.';
  ELSE
    -- Plain column: backfill from qty * cost + freight_allocated
    UPDATE receiving_report_items
       SET total_landed_cost = (qty * cost) + freight_allocated;

    RAISE NOTICE 'Migration 111: backfilled total_landed_cost on receiving_report_items (plain column).';
  END IF;
END $$;

-- Always recompute the header-level total_landed_cost on receiving_reports
-- (this is always a plain column regardless of how items were created).
UPDATE receiving_reports rr
   SET total_landed_cost = (
     SELECT COALESCE(SUM((ri.qty * ri.cost) + ri.freight_allocated), 0)
       FROM receiving_report_items ri
      WHERE ri.receiving_report_id = rr.id
   );

RAISE NOTICE 'Migration 111: recomputed total_landed_cost on receiving_reports from line items.';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
