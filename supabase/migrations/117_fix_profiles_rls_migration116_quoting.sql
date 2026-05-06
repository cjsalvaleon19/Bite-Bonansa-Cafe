-- Migration 117: Re-apply migration 116 with correct dollar-quote delimiters
-- PURPOSE:
--   Migration 116 failed with:
--     "syntax error at or near CREATE (line 62)"
--   Because the EXECUTE $$ ... $$ inside the DO $$ ... $$ block used the same
--   delimiter ($$), causing the inner $$ to close the outer DO block prematurely.
--
--   This migration re-applies everything from migration 116 using $policy$ as
--   the inner delimiter to avoid the conflict.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. SECURITY DEFINER helper ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
  RETURNS TEXT
  LANGUAGE SQL
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ── 2. Fix public.profiles policies ─────────────────────────────────────────
-- Use $policy$ as inner delimiter (not $$) to avoid conflict with the outer DO $$

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    FOR pol IN
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;

    -- Ensure RLS is enabled
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';

    -- Non-recursive: each user sees / manages only their own profile row.
    -- Admin access uses the SECURITY DEFINER function — no self-reference.
    EXECUTE $policy$
      CREATE POLICY "profiles_select_own_or_admin"
        ON public.profiles FOR SELECT
        USING (
          auth.uid() = id
          OR public.get_auth_user_role() IN ('admin', 'superadmin')
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "profiles_insert_own"
        ON public.profiles FOR INSERT
        WITH CHECK (auth.uid() = id)
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "profiles_update_own_or_admin"
        ON public.profiles FOR UPDATE
        USING (
          auth.uid() = id
          OR public.get_auth_user_role() IN ('admin', 'superadmin')
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "profiles_delete_admin"
        ON public.profiles FOR DELETE
        USING (
          public.get_auth_user_role() IN ('admin', 'superadmin')
        )
    $policy$;

    RAISE NOTICE 'Migration 117: profiles RLS policies replaced (non-recursive).';
  ELSE
    RAISE NOTICE 'Migration 117: public.profiles table not found — skipping profiles policies.';
  END IF;
END $$;

-- ── 3. Rewrite journal_entries policies ──────────────────────────────────────

DROP POLICY IF EXISTS "journal_entries_admin_all"  ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_select_all" ON journal_entries;

CREATE POLICY "journal_entries_admin_all"
  ON journal_entries FOR ALL TO authenticated
  USING      (public.get_auth_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_auth_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "journal_entries_select_all"
  ON journal_entries FOR SELECT TO authenticated
  USING (true);

-- ── 4. Rewrite rr_payments policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "rr_payments_admin_all"  ON rr_payments;
DROP POLICY IF EXISTS "rr_payments_select_all" ON rr_payments;

CREATE POLICY "rr_payments_admin_all"
  ON rr_payments FOR ALL TO authenticated
  USING      (public.get_auth_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_auth_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "rr_payments_select_all"
  ON rr_payments FOR SELECT TO authenticated
  USING (true);

-- ── 5. Rewrite price_costing_headers policies ────────────────────────────────

DROP POLICY IF EXISTS "price_costing_headers_admin_all" ON price_costing_headers;

CREATE POLICY "price_costing_headers_admin_all"
  ON price_costing_headers FOR ALL TO authenticated
  USING      (public.get_auth_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_auth_user_role() IN ('admin', 'superadmin'));

DO $$ BEGIN RAISE NOTICE 'Migration 117: profiles infinite recursion fixed; journal_entries, rr_payments, price_costing_headers policies updated.'; END $$;
