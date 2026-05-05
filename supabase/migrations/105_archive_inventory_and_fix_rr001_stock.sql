-- ─── Migration 105: Archive flag for inventory + re-process RR-260000001 ──────
-- CHANGES:
--   1. Add `is_archived` BOOLEAN column to admin_inventory_items so items that
--      are no longer in use can be hidden without being deleted (preserving FK
--      references in price_costing_items and receiving_report_items).
--
--   2. Re-process stock for RR-260000001: reset inventory_update_applied = FALSE
--      then immediately re-apply the weighted-average stock update so the
--      quantities are reflected in Inventory Report.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add is_archived column ─────────────────────────────────────────────────
ALTER TABLE admin_inventory_items
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Re-process inventory for RR-260000001 ─────────────────────────────────
DO $$
DECLARE
  v_rr_id  UUID;
  v_item   RECORD;
  v_cur_stock  NUMERIC;
  v_cur_cost   NUMERIC;
  v_new_stock  NUMERIC;
  v_avg_cost   NUMERIC;
BEGIN
  -- Find the RR
  SELECT id INTO v_rr_id
    FROM receiving_reports
   WHERE rr_number = 'RR-260000001'
   LIMIT 1;

  IF v_rr_id IS NULL THEN
    RAISE NOTICE 'Migration 105: RR-260000001 not found — skipping stock fix.';
    RETURN;
  END IF;

  -- Reset the guard flag so the loop below re-processes it
  UPDATE receiving_reports
     SET inventory_update_applied = FALSE
   WHERE id = v_rr_id;

  -- Apply stock for each line item
  FOR v_item IN
    SELECT ri.inventory_item_id,
           ri.qty,
           ri.cost,
           ri.inventory_name
      FROM receiving_report_items ri
     WHERE ri.receiving_report_id = v_rr_id
  LOOP
    -- Resolve inventory_item_id by name if FK is missing
    IF v_item.inventory_item_id IS NULL THEN
      SELECT id INTO v_item.inventory_item_id
        FROM admin_inventory_items
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_item.inventory_name))
       LIMIT 1;

      IF v_item.inventory_item_id IS NOT NULL THEN
        UPDATE receiving_report_items
           SET inventory_item_id = v_item.inventory_item_id
         WHERE receiving_report_id = v_rr_id
           AND inventory_name = v_item.inventory_name
           AND inventory_item_id IS NULL;
      END IF;
    END IF;

    IF v_item.inventory_item_id IS NULL THEN
      RAISE NOTICE 'Migration 105: no inventory match for item "%" in RR-260000001 — skipped.', v_item.inventory_name;
      CONTINUE;
    END IF;

    SELECT current_stock, cost_per_unit
      INTO v_cur_stock, v_cur_cost
      FROM admin_inventory_items
     WHERE id = v_item.inventory_item_id;

    v_cur_stock := COALESCE(v_cur_stock, 0);
    v_cur_cost  := COALESCE(v_cur_cost,  0);
    v_new_stock := v_cur_stock + COALESCE(v_item.qty, 0);

    IF v_new_stock > 0 THEN
      v_avg_cost := (v_cur_stock * v_cur_cost
                     + COALESCE(v_item.qty, 0) * COALESCE(v_item.cost, 0))
                    / v_new_stock;
    ELSE
      v_avg_cost := COALESCE(v_item.cost, 0);
    END IF;

    UPDATE admin_inventory_items
       SET current_stock = v_new_stock,
           cost_per_unit = ROUND(v_avg_cost::NUMERIC, 2)
     WHERE id = v_item.inventory_item_id;

    RAISE NOTICE 'Migration 105: updated stock for item % → new stock = %', v_item.inventory_item_id, v_new_stock;
  END LOOP;

  -- Mark as processed
  UPDATE receiving_reports
     SET inventory_update_applied = TRUE
   WHERE id = v_rr_id;

  RAISE NOTICE 'Migration 105: RR-260000001 stock re-applied successfully.';
END $$;

-- ── 3. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
