-- Migration 115: Add entry_number and name columns to journal_entries
-- PURPOSE:
--   Support Manual Entry feature:
--   - entry_number: stores the auto-generated ME-YY####### identifier
--   - name: stores vendor/customer name associated with the entry
--   - reference: alternate column name alias (journal_entries already has reference_id)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS entry_number TEXT,
  ADD COLUMN IF NOT EXISTS name         TEXT,
  ADD COLUMN IF NOT EXISTS reference    TEXT;

-- Index for fast lookup by entry_number (used by sequence generation)
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_number
  ON journal_entries (entry_number);

-- Index for date-range queries used by Journal Entries tab
CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries (date);

-- Index for reference_type filter
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_type
  ON journal_entries (reference_type);

DO $$ BEGIN RAISE NOTICE 'Migration 115: Added entry_number, name, reference columns to journal_entries'; END $$;
