-- ═══════════════════════════════════════════════════════════════════════════
-- Fix Script: Sync Rider User from auth.users to public.users
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO USE: Copy and paste this ENTIRE script into Supabase SQL Editor and run
-- This will fix the FK constraint violation issue
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_auth_id UUID;
  v_public_id UUID;
  v_auth_email TEXT;
  v_needs_fix BOOLEAN := FALSE;
  v_rows_deleted INT := 0;
BEGIN
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'FIX: Syncing Rider User from auth.users to public.users';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 1: Get the correct ID from auth.users
  -- ═══════════════════════════════════════════════════════════════════════
  RAISE NOTICE 'STEP 1: Getting user ID from auth.users...';
  
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
  
  RAISE NOTICE '';
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 2: Delete existing record if ID mismatch (to fix data corruption)
  -- ═══════════════════════════════════════════════════════════════════════
  IF v_public_id IS NOT NULL AND v_public_id != v_auth_id THEN
    RAISE NOTICE 'STEP 2: Deleting incorrect user record (ID mismatch)...';
    
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
    RAISE NOTICE 'STEP 2: No ID mismatch to clean up';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Insert/Update user in public.users with correct data
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Verify the fix
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
  '=== VERIFICATION: Fix Results ===' AS verification_step,
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Final summary
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'FIX COMPLETE';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '';
  RAISE NOTICE '1. ✓ User now exists in public.users with correct ID and role=''rider''';
  RAISE NOTICE '';
  RAISE NOTICE '2. RIDER MUST complete their profile:';
  RAISE NOTICE '   → Login as johndave0991@bitebonansacafe.com';
  RAISE NOTICE '   → Navigate to /rider/profile';
  RAISE NOTICE '   → Fill in vehicle details and save';
  RAISE NOTICE '   → This creates the required record in the riders table';
  RAISE NOTICE '';
  RAISE NOTICE '3. After profile completion, rider will appear in cashier''s rider list';
  RAISE NOTICE '';
  RAISE NOTICE '4. Test rider assignment from cashier orders queue';
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
END $$;
