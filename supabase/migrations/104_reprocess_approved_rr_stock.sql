-- ─── Migration 104: Re-process stock for approved RRs ────────────────────────
-- Context
--   Migration 103 failed in production (DO block crashed with ERROR 42703 because
--   receiving_report_items.receiving_report_id did not exist at the time).
--   Supabase runs each migration in a transaction, so the ENTIRE migration rolled
--   back — including the ALTER TABLE that was meant to add inventory_update_applied
--   to receiving_reports.
--
--   As a result:
--     • inventory_update_applied column was never created.
--     • approveRR() in the frontend silently failed when it tried to SET
--       inventory_update_applied = true (PostgREST returned an error that was not
--       being checked), leaving RRs stuck in "draft" status even though the admin
--       thought they were approved.
--     • Inventory Report's "Purchases" column showed 0 because no RR was ever
--       set to status = 'approved'.
--
--   Migration 103 (now fixed) adds the missing columns and guards.
--   THIS migration (104) re-processes any approved/paid RRs that still have
--   inventory_update_applied = FALSE — i.e. those whose stock was never applied.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Guarantee inventory_update_applied column exists ─────────────────────
ALTER TABLE receiving_reports
  ADD COLUMN IF NOT EXISTS inventory_update_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Guarantee receiving_report_id exists on line-items table ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name  = 'receiving_report_items'
       AND column_name = 'receiving_report_id'
  ) THEN
    ALTER TABLE receiving_report_items
      ADD COLUMN receiving_report_id UUID
        REFERENCES receiving_reports(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added missing receiving_report_id column to receiving_report_items.';
  END IF;
END $$;

-- ── 3. Re-apply stock for approved/paid RRs that were never processed ────────
DO $$
DECLARE
  v_rr   RECORD;
  v_item RECORD;
  v_current_stock  NUMERIC;
  v_current_cost   NUMERIC;
  v_new_stock      NUMERIC;
  v_avg_cost       NUMERIC;
  v_processed_count INT := 0;
BEGIN
  -- Skip entirely when there are no unprocessed approved RRs.
  FOR v_rr IN
    SELECT id, rr_number
      FROM receiving_reports
     WHERE status IN ('approved', 'paid')
       AND inventory_update_applied = FALSE
  LOOP
    FOR v_item IN
      SELECT ri.inventory_item_id,
             ri.qty,
             ri.cost
        FROM receiving_report_items ri
       WHERE ri.receiving_report_id = v_rr.id
         AND ri.inventory_item_id   IS NOT NULL
    LOOP
      SELECT current_stock, cost_per_unit
        INTO v_current_stock, v_current_cost
        FROM admin_inventory_items
       WHERE id = v_item.inventory_item_id;

      v_current_stock := COALESCE(v_current_stock, 0);
      v_current_cost  := COALESCE(v_current_cost,  0);
      v_new_stock     := v_current_stock + COALESCE(v_item.qty, 0);

      -- Weighted-average cost (same formula used by approveRR in the frontend)
      IF v_new_stock > 0 THEN
        v_avg_cost := (v_current_stock * v_current_cost
                       + COALESCE(v_item.qty, 0) * COALESCE(v_item.cost, 0))
                      / v_new_stock;
      ELSE
        v_avg_cost := COALESCE(v_item.cost, 0);
      END IF;

      UPDATE admin_inventory_items
         SET current_stock = v_new_stock,
             cost_per_unit = ROUND(v_avg_cost::NUMERIC, 2)
       WHERE id = v_item.inventory_item_id;
    END LOOP;

    -- Mark as processed so it is never double-counted.
    UPDATE receiving_reports
       SET inventory_update_applied = TRUE
     WHERE id = v_rr.id;

    v_processed_count := v_processed_count + 1;
    RAISE NOTICE 'Processed stock for RR %', v_rr.rr_number;
  END LOOP;

  IF v_processed_count = 0 THEN
    RAISE NOTICE 'Migration 104: no unprocessed approved RRs found — nothing to do.';
  ELSE
    RAISE NOTICE 'Migration 104: applied stock for % receiving report(s).', v_processed_count;
  END IF;
END $$;
