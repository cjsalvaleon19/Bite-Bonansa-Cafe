-- ═══════════════════════════════════════════════════════════════════════════
-- Fix Script: Sync Rider User from auth.users to public.users
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Ensure johndave0991@bitebonansacafe.com exists in public.users
--          with the correct ID from auth.users and role='rider'
-- ═══════════════════════════════════════════════════════════════════════════

\echo '═══════════════════════════════════════════════════════════════════════════'
\echo 'FIX: Syncing Rider User from auth.users to public.users'
\echo '═══════════════════════════════════════════════════════════════════════════'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Get the correct ID from auth.users
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 1: Getting user ID from auth.users...'
DO $$
DECLARE
  v_auth_id UUID;
  v_public_id UUID;
  v_auth_email TEXT;
  v_needs_fix BOOLEAN := FALSE;
BEGIN
  -- Get auth.users record
  SELECT id, email INTO v_auth_id, v_auth_email
  FROM auth.users
  WHERE email = 'johndave0991@bitebonansacafe.com';
  
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'FATAL: User johndave0991@bitebonansacafe.com not found in auth.users. User needs to sign up first.';
  END IF;
  
  RAISE NOTICE 'Found in auth.users: id=%, email=%', v_auth_id, v_auth_email;
  
  -- Check if exists in public.users
  SELECT id INTO v_public_id
  FROM public.users
  WHERE email = 'johndave0991@bitebonansacafe.com';
  
  IF v_public_id IS NULL THEN
    RAISE NOTICE 'User NOT found in public.users - will create';
    v_needs_fix := TRUE;
  ELSIF v_public_id != v_auth_id THEN
    RAISE NOTICE 'ID MISMATCH found:';
    RAISE NOTICE '  auth.users.id:   %', v_auth_id;
    RAISE NOTICE '  public.users.id: %', v_public_id;
    RAISE NOTICE 'Will delete and recreate with correct ID';
    v_needs_fix := TRUE;
  ELSE
    RAISE NOTICE 'User exists in public.users with correct ID: %', v_public_id;
  END IF;
  
  IF NOT v_needs_fix THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓ User exists with correct ID - checking role...';
  END IF;
END $$;

\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Delete existing record if ID mismatch (to fix data corruption)
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 2: Checking for ID mismatch and cleaning up if needed...'
DO $$
DECLARE
  v_auth_id UUID;
  v_public_id UUID;
  v_rows_deleted INT := 0;
BEGIN
  -- Get both IDs
  SELECT a.id, p.id INTO v_auth_id, v_public_id
  FROM auth.users a
  LEFT JOIN public.users p ON p.email = a.email
  WHERE a.email = 'johndave0991@bitebonansacafe.com';
  
  -- If IDs don't match, delete the wrong record
  IF v_public_id IS NOT NULL AND v_public_id != v_auth_id THEN
    RAISE NOTICE 'Deleting incorrect user record (ID mismatch)...';
    
    -- First, clean up any riders table references
    DELETE FROM riders WHERE user_id = v_public_id;
    GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
    IF v_rows_deleted > 0 THEN
      RAISE NOTICE 'Deleted % rider record(s) with wrong user_id', v_rows_deleted;
    END IF;
    
    -- Delete the incorrect user record
    DELETE FROM public.users WHERE id = v_public_id;
    RAISE NOTICE 'Deleted incorrect user record from public.users';
  ELSE
    RAISE NOTICE 'No ID mismatch to clean up';
  END IF;
END $$;

\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Insert/Update user in public.users with correct data
-- ═══════════════════════════════════════════════════════════════════════════
\echo 'STEP 3: Creating/updating user in public.users...'
INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
SELECT 
  a.id,
  a.email,
  COALESCE(a.raw_user_meta_data->>'full_name', 'John Dave Salvaleon') AS full_name,
  'rider' AS role,
  a.created_at,
  NOW() AS updated_at
FROM auth.users a
WHERE a.email = 'johndave0991@bitebonansacafe.com'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, users.full_name, 'John Dave Salvaleon'),
  role = 'rider',  -- Force role to 'rider'
  updated_at = NOW();

\echo ''
\echo '✓ User record created/updated in public.users'

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Verify the fix
-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo 'STEP 4: Verifying the fix...'
\echo '------------------------------------------------------------------------'
SELECT 
  a.id AS auth_id,
  p.id AS public_id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN a.id = p.id AND p.role = 'rider' THEN '✓ FIXED - Ready for rider assignment'
    WHEN a.id = p.id AND p.role != 'rider' THEN '⚠ ID correct but role wrong'
    WHEN a.id != p.id THEN '✗ ID still mismatched'
    ELSE '? Unknown status'
  END AS status
FROM auth.users a
JOIN public.users p ON a.email = p.email
WHERE a.email = 'johndave0991@bitebonansacafe.com';

\echo ''
\echo '═══════════════════════════════════════════════════════════════════════════'
\echo 'FIX COMPLETE'
\echo '═══════════════════════════════════════════════════════════════════════════'
\echo ''
\echo 'NEXT STEPS:'
\echo ''
\echo '1. ✓ User now exists in public.users with correct ID and role=''rider'''
\echo ''
\echo '2. RIDER MUST complete their profile:'
\echo '   → Login as johndave0991@bitebonansacafe.com'
\echo '   → Navigate to /rider/profile'
\echo '   → Fill in vehicle details and save'
\echo '   → This creates the required record in the riders table'
\echo ''
\echo '3. After profile completion, rider will appear in the cashier''s rider list'
\echo ''
\echo '4. Test rider assignment from cashier orders queue'
\echo ''
\echo '═══════════════════════════════════════════════════════════════════════════'
