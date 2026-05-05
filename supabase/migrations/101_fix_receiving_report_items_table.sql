-- ─── Migration 101: Ensure receiving_report_items table is fully created ─────
-- PROBLEM:
--   If receiving_report_items was created before migration 099 fixed the FK on
--   receiving_reports, the table may exist with incorrect column types or be
--   missing the total_landed_cost generated column.  This migration is fully
--   idempotent and ensures the table exists with all required columns.
--
-- NOTE on total_landed_cost:
--   The column is GENERATED ALWAYS AS ((qty * cost) + freight_allocated) STORED.
--   PostgreSQL does not allow adding a GENERATED ALWAYS column to an existing
--   table via ALTER TABLE.  Therefore we:
--     1. Create the table if it does not exist (including the generated column).
--     2. If the table already exists, add any missing plain columns only.
--        The generated column cannot be retrofitted; if it is missing the
--        application calculates total_landed_cost client-side instead.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create table with full structure if it does not already exist
CREATE TABLE IF NOT EXISTS receiving_report_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_report_id   UUID          NOT NULL REFERENCES receiving_reports(id) ON DELETE CASCADE,
  inventory_item_id     UUID          REFERENCES admin_inventory_items(id) ON DELETE SET NULL,
  inventory_name        TEXT          NOT NULL DEFAULT '',
  inventory_code        TEXT,
  uom                   VARCHAR(20)   NOT NULL DEFAULT 'pcs',
  qty                   DECIMAL(10,3) NOT NULL DEFAULT 0,
  cost                  DECIMAL(10,2) NOT NULL DEFAULT 0,
  freight_allocated     DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_landed_cost     DECIMAL(10,2) GENERATED ALWAYS AS ((qty * cost) + freight_allocated) STORED,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. Add any missing columns to an existing table (plain columns only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items' AND column_name = 'inventory_name'
  ) THEN
    ALTER TABLE receiving_report_items ADD COLUMN inventory_name TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items' AND column_name = 'inventory_code'
  ) THEN
    ALTER TABLE receiving_report_items ADD COLUMN inventory_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items' AND column_name = 'uom'
  ) THEN
    ALTER TABLE receiving_report_items ADD COLUMN uom VARCHAR(20) NOT NULL DEFAULT 'pcs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items' AND column_name = 'qty'
  ) THEN
    ALTER TABLE receiving_report_items ADD COLUMN qty DECIMAL(10,3) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items' AND column_name = 'cost'
  ) THEN
    ALTER TABLE receiving_report_items ADD COLUMN cost DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_report_items' AND column_name = 'freight_allocated'
  ) THEN
    ALTER TABLE receiving_report_items ADD COLUMN freight_allocated DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Enable RLS if not already enabled
ALTER TABLE receiving_report_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (idempotent)
DROP POLICY IF EXISTS "receiving_report_items_admin_all"  ON receiving_report_items;
DROP POLICY IF EXISTS "receiving_report_items_select_all" ON receiving_report_items;

CREATE POLICY "receiving_report_items_admin_all"
  ON receiving_report_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "receiving_report_items_select_all"
  ON receiving_report_items FOR SELECT TO authenticated
  USING (true);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
