-- ─── Migration 106: Force-delete RR-260000001 and its journal entries ──────────
-- PURPOSE:
--   RR-260000001 (Dreambake Baking Supplies, 2026-05-05) was marked as "paid"
--   but has NO line items and was never applied to Inventory.  This migration:
--     1. Deletes all journal_entries that reference this RR (the payment entry).
--     2. Deletes the receiving_reports row for RR-260000001.
--        Because receiving_report_items and rr_payments are defined with
--        ON DELETE CASCADE, those child rows are removed automatically.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_rr_id UUID;
  v_je_count  INT;
  v_pay_count INT;
BEGIN
  -- 1. Resolve the RR id
  SELECT id INTO v_rr_id
    FROM receiving_reports
   WHERE rr_number = 'RR-260000001'
   LIMIT 1;

  IF v_rr_id IS NULL THEN
    RAISE NOTICE 'Migration 106: RR-260000001 not found — nothing to delete.';
    RETURN;
  END IF;

  RAISE NOTICE 'Migration 106: found RR-260000001 with id = %', v_rr_id;

  -- 2. Delete journal entries linked to this RR
  --    NOTE: the actual column is named "reference" (not "reference_id")
  DELETE FROM journal_entries
   WHERE reference::text = v_rr_id::text;

  GET DIAGNOSTICS v_je_count = ROW_COUNT;
  RAISE NOTICE 'Migration 106: deleted % journal_entr(y/ies) for RR-260000001', v_je_count;

  -- 3. Delete rr_payments linked to this RR (also handled by CASCADE, but be explicit)
  DELETE FROM rr_payments
   WHERE receiving_report_id = v_rr_id;

  GET DIAGNOSTICS v_pay_count = ROW_COUNT;
  RAISE NOTICE 'Migration 106: deleted % rr_payment row(s) for RR-260000001', v_pay_count;

  -- 4. Delete the receiving report itself
  --    (cascades to receiving_report_items automatically)
  DELETE FROM receiving_reports
   WHERE id = v_rr_id;

  RAISE NOTICE 'Migration 106: RR-260000001 deleted successfully.';
END $$;

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
