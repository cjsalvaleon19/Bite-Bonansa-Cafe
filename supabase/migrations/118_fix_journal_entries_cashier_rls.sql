-- Migration 118: Fix journal_entries RLS so both admin and cashier can INSERT
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEMS FIXED:
--
--   1. ADMIN INSERT SILENT FAILURE
--      journal_entries_admin_all FOR ALL uses:
--        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (...))
--      This subquery hits the `users` table, which (if users has RLS) can chain into
--      the profiles RLS infinite-recursion loop → INSERT returns HTTP 500 silently.
--      Fix: replace the subquery with the SECURITY DEFINER helper get_auth_user_role().
--
--   2. CASHIER INSERT ALWAYS BLOCKED
--      The cashier role is not 'admin' or 'superadmin', so the journal_entries_admin_all
--      WITH CHECK always rejects cashier INSERTs (e.g. insertSalesJournalEntry from the
--      Orders Queue page). The error is caught and swallowed, so no sales entries are
--      ever written to the table.
--      Fix: add a dedicated journal_entries_cashier_insert policy.
--
--   Both issues mean the journal_entries table stays empty even after orders are
--   completed and RRs are approved, causing the Journal Entries tab to show
--   "No journal entries found" indefinitely.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Ensure SECURITY DEFINER helper exists (idempotent) ────────────────────
--    Reads the current user's role from public.users while bypassing RLS,
--    which breaks the recursion chain: journal policy → users → profiles → profiles.
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
  RETURNS TEXT
  LANGUAGE SQL
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ── 2. Rebuild journal_entries policies ──────────────────────────────────────

DROP POLICY IF EXISTS "journal_entries_admin_all"      ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_select_all"     ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_cashier_insert" ON journal_entries;

-- Admin / superadmin: full access, non-recursive check
CREATE POLICY "journal_entries_admin_all"
  ON journal_entries FOR ALL TO authenticated
  USING      (public.get_auth_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_auth_user_role() IN ('admin', 'superadmin'));

-- Any authenticated user can read journal entries
CREATE POLICY "journal_entries_select_all"
  ON journal_entries FOR SELECT TO authenticated
  USING (true);

-- Cashier can INSERT sales journal entries (created on order completion)
CREATE POLICY "journal_entries_cashier_insert"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.get_auth_user_role() IN ('cashier', 'admin', 'superadmin'));

-- Reload PostgREST schema cache so new policies are immediately visible
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE 'Migration 118: journal_entries RLS fixed — admin INSERT no longer recursive; cashier INSERT now allowed.'; END $$;
