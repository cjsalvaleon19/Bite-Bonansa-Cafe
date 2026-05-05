-- ─── Migration 097: Admin Interface Tables ────────────────────────────────────
-- Creates admin_inventory_items, price_costing_items, vendors,
-- receiving_reports, and receiving_report_items with RLS policies.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ── admin_inventory_items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_inventory_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255)  NOT NULL,
  code            VARCHAR(20)   UNIQUE NOT NULL,
  department      VARCHAR(20)   NOT NULL CHECK (department IN ('DKS','PTS','FRD','OVH')),
  uom             VARCHAR(50)   NOT NULL DEFAULT 'pcs',
  cost_per_unit   DECIMAL(10,2) NOT NULL DEFAULT 0,
  current_stock   DECIMAL(10,3) NOT NULL DEFAULT 0,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_inventory_items_admin_all"   ON admin_inventory_items;
DROP POLICY IF EXISTS "admin_inventory_items_select_all"  ON admin_inventory_items;

CREATE POLICY "admin_inventory_items_admin_all"
  ON admin_inventory_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "admin_inventory_items_select_all"
  ON admin_inventory_items
  FOR SELECT
  TO authenticated
  USING (true);

-- ── price_costing_items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_costing_items (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_name          VARCHAR(255)  NOT NULL,
  inventory_item_id       UUID          REFERENCES admin_inventory_items(id) ON DELETE SET NULL,
  uom                     VARCHAR(50)   NOT NULL DEFAULT 'pcs',
  qty                     DECIMAL(10,3) NOT NULL DEFAULT 0,
  cost                    DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost              DECIMAL(10,2) GENERATED ALWAYS AS (qty * cost) STORED,
  total_cogs              DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_cost              DECIMAL(10,2) NOT NULL DEFAULT 0,
  overhead_cost           DECIMAL(10,2) NOT NULL DEFAULT 0,
  wastage_pct             DECIMAL(5,2)  NOT NULL DEFAULT 0,
  contingency_pct         DECIMAL(5,2)  NOT NULL DEFAULT 0,
  contribution_margin_pct DECIMAL(5,2)  NOT NULL DEFAULT 0,
  selling_price           DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE price_costing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_costing_items_admin_all"   ON price_costing_items;
DROP POLICY IF EXISTS "price_costing_items_select_all"  ON price_costing_items;

CREATE POLICY "price_costing_items_admin_all"
  ON price_costing_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "price_costing_items_select_all"
  ON price_costing_items
  FOR SELECT
  TO authenticated
  USING (true);

-- ── vendors ───────────────────────────────────────────────────────────────────
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

DROP POLICY IF EXISTS "vendors_admin_all"   ON vendors;
DROP POLICY IF EXISTS "vendors_select_all"  ON vendors;

CREATE POLICY "vendors_admin_all"
  ON vendors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "vendors_select_all"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (true);

-- ── receiving_reports ─────────────────────────────────────────────────────────
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

ALTER TABLE receiving_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receiving_reports_admin_all"   ON receiving_reports;
DROP POLICY IF EXISTS "receiving_reports_select_all"  ON receiving_reports;

CREATE POLICY "receiving_reports_admin_all"
  ON receiving_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "receiving_reports_select_all"
  ON receiving_reports
  FOR SELECT
  TO authenticated
  USING (true);

-- ── receiving_report_items ────────────────────────────────────────────────────
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

DROP POLICY IF EXISTS "receiving_report_items_admin_all"   ON receiving_report_items;
DROP POLICY IF EXISTS "receiving_report_items_select_all"  ON receiving_report_items;

CREATE POLICY "receiving_report_items_admin_all"
  ON receiving_report_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "receiving_report_items_select_all"
  ON receiving_report_items
  FOR SELECT
  TO authenticated
  USING (true);

-- ── RR Number Generator ───────────────────────────────────────────────────────
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
