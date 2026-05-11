-- Migration 137: add editable reference number to receiving_reports
--
-- Supports admin requirement to store a supplier/document reference number
-- directly on the Receiving Report record.

ALTER TABLE receiving_reports
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 137: receiving_reports.reference_number added.';
END $$;
