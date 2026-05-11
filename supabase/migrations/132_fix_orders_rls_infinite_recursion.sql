-- ============================================================================
-- Migration 132: Fix orders RLS infinite recursion — cashier can't see orders
-- ============================================================================
-- PROBLEM:
--   Customer-placed orders (status 'pending') never appear in the cashier's
--   "Pending Online Orders" tab.  The cashier dashboard query returns 0 rows.
--
--   Root cause: the original RLS policies on the orders table (from
--   database_schema.sql) use a raw `EXISTS (SELECT 1 FROM users WHERE ...)` sub-
--   query.  When the users table itself has RLS, that sub-query triggers a chain:
--
--     orders SELECT policy → SELECT FROM users
--       → users RLS           → SELECT FROM profiles
--         → profiles RLS      → SELECT FROM profiles  ← INFINITE RECURSION
--
--   The same issue was documented and fixed for journal_entries, rr_payments and
--   price_costing_headers in migrations 116/117 using the SECURITY DEFINER
--   helper function public.get_auth_user_role().  The orders table (and several
--   other tables) were inadvertently skipped in those migrations.
--
-- FIX:
--   Re-create all staff-facing RLS policies that reference the users table to
--   use public.get_auth_user_role() instead.  The function is SECURITY DEFINER
--   so it reads from users while bypassing RLS, breaking the recursive chain.
-- ============================================================================

-- ── 0. Ensure the SECURITY DEFINER helper exists ─────────────────────────────
-- (already created by migrations 116/117, re-created here for safety in case
--  this migration is applied to a fresh DB that skipped those migrations)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
  RETURNS TEXT
  LANGUAGE SQL
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ── 1. orders ─────────────────────────────────────────────────────────────────
-- Drop the broken staff policies; customer-only policies are fine as-is.

DROP POLICY IF EXISTS "Staff can view all orders"   ON orders;
DROP POLICY IF EXISTS "Staff can update orders"     ON orders;

CREATE POLICY "Staff can view all orders" ON orders
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier', 'rider')
  );

CREATE POLICY "Staff can update orders" ON orders
  FOR UPDATE USING (
    public.get_auth_user_role() IN ('admin', 'cashier', 'rider')
  );

-- ── 2. customer_reviews ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view all reviews"      ON customer_reviews;
DROP POLICY IF EXISTS "Staff can update review status"  ON customer_reviews;

CREATE POLICY "Staff can view all reviews" ON customer_reviews
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

CREATE POLICY "Staff can update review status" ON customer_reviews
  FOR UPDATE USING (
    public.get_auth_user_role() = 'admin'
  );

-- ── 3. loyalty_transactions ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view all transactions" ON loyalty_transactions;

CREATE POLICY "Staff can view all transactions" ON loyalty_transactions
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

-- ── 4. riders ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view all rider profiles" ON riders;
DROP POLICY IF EXISTS "Admin can manage riders"           ON riders;

CREATE POLICY "Staff can view all rider profiles" ON riders
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

CREATE POLICY "Admin can manage riders" ON riders
  FOR ALL USING (
    public.get_auth_user_role() = 'admin'
  );

-- ── 5. deliveries ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view all deliveries" ON deliveries;
DROP POLICY IF EXISTS "Staff can manage deliveries"   ON deliveries;

CREATE POLICY "Staff can view all deliveries" ON deliveries
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

CREATE POLICY "Staff can manage deliveries" ON deliveries
  FOR ALL USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

-- ── 6. delivery_reports ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view all reports"       ON delivery_reports;
DROP POLICY IF EXISTS "Cashier can update report status" ON delivery_reports;

CREATE POLICY "Staff can view all reports" ON delivery_reports
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

CREATE POLICY "Cashier can update report status" ON delivery_reports
  FOR UPDATE USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

-- ── 7. cash_drawer_transactions ───────────────────────────────────────────────
-- Migration 020 created policies using EXISTS (SELECT 1 FROM users …) — fix them.

DROP POLICY IF EXISTS "Cashiers can view their own transactions" ON cash_drawer_transactions;
DROP POLICY IF EXISTS "Admin can view all cash transactions"     ON cash_drawer_transactions;

CREATE POLICY "Cashiers can view their own transactions" ON cash_drawer_transactions
  FOR SELECT USING (
    cashier_id = auth.uid()
    OR public.get_auth_user_role() = 'admin'
  );

CREATE POLICY "Admin can view all cash transactions" ON cash_drawer_transactions
  FOR SELECT USING (
    public.get_auth_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Cashiers can create transactions" ON cash_drawer_transactions;

CREATE POLICY "Cashiers can create transactions" ON cash_drawer_transactions
  FOR INSERT WITH CHECK (
    cashier_id = auth.uid()
    AND public.get_auth_user_role() IN ('cashier', 'admin')
  );

-- ── 8. chart_of_accounts ─────────────────────────────────────────────────────
-- Migration 020 created these using EXISTS (SELECT 1 FROM users …) — fix them.

DROP POLICY IF EXISTS "Anyone can view active accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "Admin can manage accounts"       ON chart_of_accounts;

CREATE POLICY "Anyone can view active accounts" ON chart_of_accounts
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

CREATE POLICY "Admin can manage accounts" ON chart_of_accounts
  FOR ALL USING (
    public.get_auth_user_role() = 'admin'
  );

-- ── 9. kitchen_departments ────────────────────────────────────────────────────
-- Migration 020 created these using EXISTS (SELECT 1 FROM users …) — fix them.

DROP POLICY IF EXISTS "Staff can view kitchen departments"    ON kitchen_departments;
DROP POLICY IF EXISTS "Admin can manage kitchen departments"  ON kitchen_departments;

CREATE POLICY "Staff can view kitchen departments" ON kitchen_departments
  FOR SELECT USING (
    public.get_auth_user_role() IN ('admin', 'cashier')
  );

CREATE POLICY "Admin can manage kitchen departments" ON kitchen_departments
  FOR ALL USING (
    public.get_auth_user_role() = 'admin'
  );

DO $$ BEGIN
  RAISE NOTICE 'Migration 132: fixed RLS infinite-recursion on orders, customer_reviews, loyalty_transactions, riders, deliveries, delivery_reports, cash_drawer_transactions, chart_of_accounts, kitchen_departments.';
  RAISE NOTICE 'Cashiers can now see customer-placed orders in Pending Online Orders.';
END $$;
