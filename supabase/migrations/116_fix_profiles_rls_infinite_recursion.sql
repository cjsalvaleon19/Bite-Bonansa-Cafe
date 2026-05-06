-- Migration 116: Fix infinite recursion in profiles RLS policy
-- PURPOSE:
--   The journal_entries table returns HTTP 500 with error:
--     "infinite recursion detected in policy for relation 'profiles'"
--
--   Root cause chain:
--     journal_entries policy  →  SELECT FROM users
--       → users RLS           →  SELECT FROM profiles
--         → profiles RLS      →  SELECT FROM profiles  ← INFINITE RECURSION
--
--   Fix:
--     1. Create a SECURITY DEFINER function get_auth_user_role() that reads
--        from public.users bypassing RLS — breaks the chain permanently.
--     2. Drop all RLS policies on public.profiles and recreate them without
--        any subquery back into profiles or users (use auth.uid() = id only).
--     3. Recreate journal_entries and rr_payments admin policies to use the
--        SECURITY DEFINER function instead of a raw users subquery.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. SECURITY DEFINER helper ───────────────────────────────────────────────
-- Returns the role of the currently authenticated user from public.users.
-- SECURITY DEFINER + SET search_path = public means this function runs with
-- the definer's privileges and bypasses RLS on the users table, stopping the
-- recursive chain dead.

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
-- Drop every existing policy on profiles (they may differ per project).
-- We use a DO block so this is safe even if profiles has zero policies.

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
    EXECUTE $$
      CREATE POLICY "profiles_select_own_or_admin"
        ON public.profiles FOR SELECT
        USING (
          auth.uid() = id
          OR public.get_auth_user_role() IN ('admin', 'superadmin')
        )
    $$;

    EXECUTE $$
      CREATE POLICY "profiles_insert_own"
        ON public.profiles FOR INSERT
        WITH CHECK (auth.uid() = id)
    $$;

    EXECUTE $$
      CREATE POLICY "profiles_update_own_or_admin"
        ON public.profiles FOR UPDATE
        USING (
          auth.uid() = id
          OR public.get_auth_user_role() IN ('admin', 'superadmin')
        )
    $$;

    EXECUTE $$
      CREATE POLICY "profiles_delete_admin"
        ON public.profiles FOR DELETE
        USING (
          public.get_auth_user_role() IN ('admin', 'superadmin')
        )
    $$;

    RAISE NOTICE 'Migration 116: profiles RLS policies replaced (non-recursive).';
  ELSE
    RAISE NOTICE 'Migration 116: public.profiles table not found — skipping profiles policies.';
  END IF;
END $$;

-- ── 3. Rewrite journal_entries policies ──────────────────────────────────────
-- Replace the admin policy that subqueries users directly with one that
-- calls the SECURITY DEFINER function instead.

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

DO $$ BEGIN RAISE NOTICE 'Migration 116: profiles infinite recursion fixed; journal_entries, rr_payments, price_costing_headers policies updated.'; END $$;
