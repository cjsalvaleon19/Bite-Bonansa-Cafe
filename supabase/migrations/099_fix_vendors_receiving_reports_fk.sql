-- ─── Migration 099: Fix vendors / receiving_reports FK ───────────────────────
-- PROBLEM:
--   PostgREST returns 400 "Could not find a relationship between
--   'receiving_reports' and 'vendors' in the schema cache" because migration
--   097 was never applied to the production database.  The vendors table,
--   receiving_reports.vendor_id foreign key, and related objects are all
--   missing.
--
-- SOLUTION:
--   Re-apply every object from migration 097 that is required for the
--   receiving-report feature (vendors, receiving_reports, receiving_report_items,
--   generate_rr_number function, RLS policies) using IF NOT EXISTS / DO NOTHING
--   guards so the script is fully idempotent.
--   Finally, notify PostgREST to reload its schema cache so the FK is visible
--   immediately without restarting the service.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. vendors ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  address        TEXT,
  contact_number VARCHAR(50),
  tin            VARCHAR(50),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_admin_all"  ON vendors;
DROP POLICY IF EXISTS "vendors_select_all" ON vendors;

CREATE POLICY "vendors_admin_all"
  ON vendors FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "vendors_select_all"
  ON vendors FOR SELECT TO authenticated
  USING (true);

-- ── 2. receiving_reports ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receiving_reports (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  rr_number         VARCHAR(20)   UNIQUE NOT NULL,
  vendor_id         UUID          REFERENCES vendors(id) ON DELETE SET NULL,
  date              DATE          NOT NULL DEFAULT CURRENT_DATE,
  terms             INTEGER,
  freight_in        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_landed_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','paid')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- If the table already existed without the vendor_id column, add it now.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'receiving_reports' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE receiving_reports
      ADD COLUMN vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- If the column exists but the FK constraint is still missing, add it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_name       = 'receiving_reports'
       AND tc.constraint_type  = 'FOREIGN KEY'
       AND kcu.column_name     = 'vendor_id'
  ) THEN
    ALTER TABLE receiving_reports
      ADD CONSTRAINT receiving_reports_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE receiving_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receiving_reports_admin_all"  ON receiving_reports;
DROP POLICY IF EXISTS "receiving_reports_select_all" ON receiving_reports;

CREATE POLICY "receiving_reports_admin_all"
  ON receiving_reports FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "receiving_reports_select_all"
  ON receiving_reports FOR SELECT TO authenticated
  USING (true);

-- ── 3. receiving_report_items ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receiving_report_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_report_id   UUID          NOT NULL REFERENCES receiving_reports(id) ON DELETE CASCADE,
  inventory_item_id     UUID          REFERENCES admin_inventory_items(id) ON DELETE SET NULL,
  inventory_name        VARCHAR(255)  NOT NULL,
  inventory_code        VARCHAR(20),
  uom                   VARCHAR(50)   NOT NULL DEFAULT 'pcs',
  qty                   DECIMAL(10,3) NOT NULL DEFAULT 0,
  cost                  DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost            DECIMAL(10,2) GENERATED ALWAYS AS (qty * cost) STORED,
  freight_allocated     DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_landed_cost     DECIMAL(10,2) GENERATED ALWAYS AS ((qty * cost) + freight_allocated) STORED,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE receiving_report_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receiving_report_items_admin_all"  ON receiving_report_items;
DROP POLICY IF EXISTS "receiving_report_items_select_all" ON receiving_report_items;

CREATE POLICY "receiving_report_items_admin_all"
  ON receiving_report_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "receiving_report_items_select_all"
  ON receiving_report_items FOR SELECT TO authenticated
  USING (true);

-- ── 4. RR Number Generator ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_rr_number() RETURNS VARCHAR AS $$
DECLARE
  v_year CHAR(2);
  v_seq  BIGINT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(rr_number FROM 4) AS BIGINT)), 0) + 1
    INTO v_seq
    FROM receiving_reports
   WHERE rr_number LIKE 'RR-' || v_year || '%';
  RETURN 'RR-' || v_year || LPAD(v_seq::TEXT, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- ── 5. Reload PostgREST schema cache ─────────────────────────────────────────
-- This makes the new FK visible to PostgREST immediately without a restart.
NOTIFY pgrst, 'reload schema';
