-- ─── Migration 113: Ensure total_landed_cost on receiving_report_items is GENERATED ALWAYS ─
-- PROBLEM:
--   On some production instances migration 111 left total_landed_cost as a plain
--   DECIMAL column (DEFAULT 0).  New rows inserted without an explicit value for
--   total_landed_cost therefore get 0, which makes Avg Cost/Unit = ₱0.00 in the
--   Inventory report even when qty and cost are correctly stored.
--
-- FIX:
--   • If total_landed_cost is already GENERATED ALWAYS → nothing to do.
--   • If total_landed_cost is a plain column → drop it and re-add it as
--     GENERATED ALWAYS AS ((qty * cost) + freight_allocated) STORED so that
--     PostgreSQL auto-computes it for every existing and future row.
--   • If total_landed_cost is missing entirely → add it as GENERATED ALWAYS.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_exists   BOOLEAN;
  v_is_generated BOOLEAN;
BEGIN
  -- Is the column present at all?
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'receiving_report_items'
       AND column_name  = 'total_landed_cost'
  ) INTO v_col_exists;

  IF v_col_exists THEN
    -- Is it GENERATED ALWAYS?
    SELECT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'receiving_report_items'
         AND column_name  = 'total_landed_cost'
         AND is_generated = 'ALWAYS'
    ) INTO v_is_generated;

    IF v_is_generated THEN
      RAISE NOTICE 'Migration 113: total_landed_cost is already GENERATED ALWAYS — no change needed.';
    ELSE
      -- Plain column: drop then re-add as generated so all rows (old and new)
      -- are automatically computed from qty * cost + freight_allocated.
      ALTER TABLE receiving_report_items DROP COLUMN total_landed_cost;
      ALTER TABLE receiving_report_items
        ADD COLUMN total_landed_cost DECIMAL(10,2)
          GENERATED ALWAYS AS ((qty * cost) + freight_allocated) STORED;
      RAISE NOTICE 'Migration 113: converted total_landed_cost from plain to GENERATED ALWAYS column.';
    END IF;
  ELSE
    -- Column is absent: add as GENERATED ALWAYS
    ALTER TABLE receiving_report_items
      ADD COLUMN total_landed_cost DECIMAL(10,2)
        GENERATED ALWAYS AS ((qty * cost) + freight_allocated) STORED;
    RAISE NOTICE 'Migration 113: added total_landed_cost as GENERATED ALWAYS column.';
  END IF;

  -- Also recompute the header-level total_landed_cost on receiving_reports
  -- (always a plain column) so that the RR list totals stay in sync.
  UPDATE receiving_reports rr
     SET total_landed_cost = (
       SELECT COALESCE(SUM((ri.qty * ri.cost) + ri.freight_allocated), 0)
         FROM receiving_report_items ri
        WHERE ri.receiving_report_id = rr.id
     );
  RAISE NOTICE 'Migration 113: refreshed receiving_reports.total_landed_cost from line items.';
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
