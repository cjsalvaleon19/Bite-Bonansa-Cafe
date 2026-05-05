-- ─── Migration 100: Fix receiving_reports missing columns ───────────────────
-- PROBLEM:
--   The receiving_reports table was created in production without the full
--   column set defined in migration 097.  The query
--     .from('receiving_reports').select('*, vendor:vendors(name)').order('date', ...)
--   fails with "column receiving_reports.date does not exist" because the table
--   exists but the date (and several other) columns are absent.
--
--   Migration 099 fixed vendor_id / FK but could not add the other columns
--   because they were not covered by its DO $$ blocks.
--
-- SOLUTION:
--   Add each missing column individually using DO $$ IF NOT EXISTS guards so
--   the script is fully idempotent — safe to run even if some columns already
--   exist.  Then reload the PostgREST schema cache so the changes are visible
--   immediately.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- rr_number (unique identifier for each Receiving Report)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'rr_number'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN rr_number VARCHAR(20) DEFAULT '' NOT NULL;
    -- Backfill any existing rows with a placeholder value so the NOT NULL
    -- constraint is satisfied; real values will be generated on next insert.
    UPDATE receiving_reports SET rr_number = 'RR-LEGACY-' || id::TEXT WHERE rr_number = '';
    -- Add the UNIQUE constraint separately (after backfill) so it succeeds.
    ALTER TABLE receiving_reports ADD CONSTRAINT receiving_reports_rr_number_key UNIQUE (rr_number);
  END IF;

  -- date (the date the goods were received)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'date'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  -- terms (payment terms in days)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'terms'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN terms INTEGER;
  END IF;

  -- freight_in (freight cost added to landed cost)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'freight_in'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN freight_in DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- total_landed_cost
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'total_landed_cost'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN total_landed_cost DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- status (draft / approved / paid)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'status'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','approved','paid'));
  END IF;

  -- updated_at (needed for audit trail)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Reload PostgREST schema cache so all new columns and the vendor FK are
-- visible to the REST API immediately (no service restart needed).
NOTIFY pgrst, 'reload schema';
