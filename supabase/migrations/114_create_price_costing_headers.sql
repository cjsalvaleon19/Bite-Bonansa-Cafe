-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 114: Create price_costing_headers + add costing_header_id to items
--
-- Supports requirement: 1 Menu item = multiple inventory items.
-- price_costing_headers  → one row per menu item (header-level data)
-- price_costing_items    → one row per inventory ingredient line (kept as-is
--                          for backward compat with fetchInventory sold mapping)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create headers table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_costing_headers (
  id                         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_name             VARCHAR(255)  NOT NULL,
  menu_category              VARCHAR(255),
  labor_cost                 DECIMAL(10,4) NOT NULL DEFAULT 0,
  overhead_cost              DECIMAL(10,4) NOT NULL DEFAULT 0,
  wastage_pct                DECIMAL(8,4)  NOT NULL DEFAULT 0,
  wastage_amount             DECIMAL(10,4) NOT NULL DEFAULT 0,
  contingency_pct            DECIMAL(8,4)  NOT NULL DEFAULT 0,
  contingency_amount         DECIMAL(10,4) NOT NULL DEFAULT 0,
  total_estimated_cogs       DECIMAL(10,4) NOT NULL DEFAULT 0,
  contribution_margin_pct    DECIMAL(8,4)  NOT NULL DEFAULT 0,
  contribution_margin_amount DECIMAL(10,4) NOT NULL DEFAULT 0,
  selling_price              DECIMAL(10,4) NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE price_costing_headers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_costing_headers_admin_all" ON price_costing_headers;
CREATE POLICY "price_costing_headers_admin_all"
  ON price_costing_headers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 3. Migrate existing price_costing_items → one header per unique menu_item_name
INSERT INTO price_costing_headers (
  menu_item_name,
  labor_cost,
  overhead_cost,
  wastage_pct,
  contingency_pct,
  contribution_margin_pct,
  total_estimated_cogs,
  selling_price,
  created_at
)
SELECT DISTINCT ON (menu_item_name)
  menu_item_name,
  COALESCE(labor_cost, 0),
  COALESCE(overhead_cost, 0),
  COALESCE(wastage_pct, 0),
  COALESCE(contingency_pct, 0),
  COALESCE(contribution_margin_pct, 0),
  COALESCE(total_cogs, 0),
  COALESCE(selling_price, 0),
  created_at
FROM price_costing_items
WHERE menu_item_name IS NOT NULL AND menu_item_name <> ''
ORDER BY menu_item_name, created_at;

-- 4. Add costing_header_id FK to price_costing_items ─────────────────────────
ALTER TABLE price_costing_items
  ADD COLUMN IF NOT EXISTS costing_header_id UUID REFERENCES price_costing_headers(id) ON DELETE CASCADE;

-- 5. Backfill costing_header_id for existing rows ────────────────────────────
UPDATE price_costing_items pci
SET costing_header_id = h.id
FROM price_costing_headers h
WHERE pci.menu_item_name = h.menu_item_name
  AND pci.costing_header_id IS NULL;

-- 6. Add cost_per_unit alias column (same value as cost, for clarity) ─────────
-- The existing 'cost' column stores cost-per-unit; we keep it as-is.
-- New inserts via the frontend will write to 'cost' (cost_per_unit semantics).
