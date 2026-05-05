-- ─── Migration 103: Backfill inventory_item_id + guard against double stock ──
-- PURPOSE:
--   1. Backfill `receiving_report_items.inventory_item_id` for rows where it is
--      NULL, by matching `inventory_name` (case-insensitive) against
--      `admin_inventory_items.name`.  This fixes the Inventory "Purchases"
--      column, which is computed from `inventory_item_id`, and also makes the
--      Edit RR dialog show items correctly via the FK join.
--
--   2. Add `inventory_update_applied` boolean to `receiving_reports` so that
--      the JS `approveRR` function can mark a report as "stock already updated"
--      and avoid double-counting on subsequent re-opens or re-runs.
--
--   3. For all approved/paid RRs that have NOT yet been marked as applied,
--      update `admin_inventory_items.current_stock` and `cost_per_unit` (using
--      the weighted-average cost method) for every linked item.  After updating,
--      set `inventory_update_applied = true` on the RR row.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1a. Ensure receiving_report_id column exists (may be absent on older tables) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items'
       AND column_name = 'receiving_report_id'
  ) THEN
    -- Add as nullable first (can't add NOT NULL without a default when rows may exist)
    ALTER TABLE receiving_report_items
      ADD COLUMN receiving_report_id UUID
        REFERENCES receiving_reports(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 1b. Ensure inventory_item_id column exists (may be absent on older tables) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items'
       AND column_name = 'inventory_item_id'
  ) THEN
    ALTER TABLE receiving_report_items
      ADD COLUMN inventory_item_id UUID
        REFERENCES admin_inventory_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 1d. Ensure inventory_name column exists (may be absent on older tables) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items'
       AND column_name = 'inventory_name'
  ) THEN
    ALTER TABLE receiving_report_items
      ADD COLUMN inventory_name TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- ── 1e. Backfill inventory_item_id by name ───────────────────────────────────
UPDATE receiving_report_items ri
SET    inventory_item_id = inv.id
FROM   admin_inventory_items inv
WHERE  ri.inventory_item_id IS NULL
  AND  LOWER(TRIM(ri.inventory_name)) != ''
  AND  LOWER(TRIM(ri.inventory_name)) = LOWER(TRIM(inv.name));

-- ── 2. Add guard column to receiving_reports ─────────────────────────────────
ALTER TABLE receiving_reports
  ADD COLUMN IF NOT EXISTS inventory_update_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. Apply stock updates for approved/paid RRs not yet processed ───────────
DO $$
DECLARE
  v_rr           RECORD;
  v_item         RECORD;
  v_cur_stock    DECIMAL(12,3);
  v_cur_cost     DECIMAL(12,2);
  v_new_qty      DECIMAL(12,3);
  v_new_cost     DECIMAL(12,2);
  v_total_stock  DECIMAL(12,3);
  v_avg_cost     DECIMAL(12,2);
BEGIN
  -- Skip entirely if the receiving_report_items table is missing the FK column
  -- (can happen when the table was created by an older schema before migration 097/099)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items'
       AND column_name = 'receiving_report_id'
  ) THEN
    RAISE NOTICE 'Skipping stock backfill: receiving_report_items.receiving_report_id does not exist yet.';
    RETURN;
  END IF;

  FOR v_rr IN
    SELECT id FROM receiving_reports
     WHERE status IN ('approved','paid')
       AND inventory_update_applied = FALSE
  LOOP
    FOR v_item IN
      SELECT inventory_item_id, qty, cost
        FROM receiving_report_items
       WHERE receiving_report_id = v_rr.id
         AND inventory_item_id IS NOT NULL
    LOOP
      SELECT current_stock, cost_per_unit
        INTO v_cur_stock, v_cur_cost
        FROM admin_inventory_items
       WHERE id = v_item.inventory_item_id;

      v_cur_stock  := COALESCE(v_cur_stock, 0);
      v_cur_cost   := COALESCE(v_cur_cost, 0);
      v_new_qty    := COALESCE(v_item.qty, 0);
      v_new_cost   := COALESCE(v_item.cost, 0);
      v_total_stock := v_cur_stock + v_new_qty;

      IF v_total_stock > 0 THEN
        v_avg_cost := ROUND(
          (v_cur_stock * v_cur_cost + v_new_qty * v_new_cost) / v_total_stock,
          2
        );
      ELSE
        v_avg_cost := v_new_cost;
      END IF;

      UPDATE admin_inventory_items
         SET current_stock  = v_total_stock,
             cost_per_unit  = v_avg_cost
       WHERE id = v_item.inventory_item_id;
    END LOOP;

    UPDATE receiving_reports
       SET inventory_update_applied = TRUE
     WHERE id = v_rr.id;
  END LOOP;
END $$;

-- ── 4. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
