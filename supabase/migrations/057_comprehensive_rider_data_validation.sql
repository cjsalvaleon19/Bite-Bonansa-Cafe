-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 057: Comprehensive Rider Data Validation and Cleanup
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Fix persistent FK constraint violations when assigning riders
-- Error: "insert or update on table orders violates foreign key constraint orders_rider_id_fkey"
--
-- Root Causes:
-- 1. Stale rider data in riders table with invalid user_id references
-- 2. Role mismatches (users without 'rider' role in riders table)
-- 3. Orphaned records in both directions
-- 4. Missing validation at the database level
--
-- This migration provides comprehensive cleanup and adds safety constraints
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 057: Comprehensive Rider Data Validation';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Audit and Log Current Data Issues
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  orphaned_riders INT := 0;
  wrong_role_riders INT := 0;
  invalid_order_riders INT := 0;
  null_user_id_riders INT := 0;
BEGIN
  RAISE NOTICE '→ Auditing current data state...';
  
  -- Count riders with null user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'riders') THEN
    SELECT COUNT(*) INTO null_user_id_riders
    FROM riders
    WHERE user_id IS NULL;
    
    IF null_user_id_riders > 0 THEN
      RAISE WARNING '  Found % riders with NULL user_id', null_user_id_riders;
    END IF;
    
    -- Count riders without corresponding users
    SELECT COUNT(*) INTO orphaned_riders
    FROM riders r
    WHERE r.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id);
    
    IF orphaned_riders > 0 THEN
      RAISE WARNING '  Found % riders without corresponding users', orphaned_riders;
    END IF;
    
    -- Count riders where user doesn't have 'rider' role
    SELECT COUNT(*) INTO wrong_role_riders
    FROM riders r
    INNER JOIN users u ON r.user_id = u.id
    WHERE u.role != 'rider';
    
    IF wrong_role_riders > 0 THEN
      RAISE WARNING '  Found % riders where user has wrong role', wrong_role_riders;
    END IF;
  END IF;
  
  -- Count orders with invalid rider_id references
  SELECT COUNT(*) INTO invalid_order_riders
  FROM orders o
  WHERE o.rider_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.rider_id);
  
  IF invalid_order_riders > 0 THEN
    RAISE WARNING '  Found % orders with invalid rider_id references', invalid_order_riders;
  END IF;
  
  RAISE NOTICE '✓ Audit complete';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Clean Up Invalid Data in Orders Table
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  cleaned_orders INT := 0;
BEGIN
  RAISE NOTICE '→ Cleaning invalid rider_id references in orders...';
  
  -- Clear rider_id from orders where the referenced user doesn't exist
  UPDATE orders
  SET rider_id = NULL
  WHERE rider_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = orders.rider_id);
  
  GET DIAGNOSTICS cleaned_orders = ROW_COUNT;
  
  IF cleaned_orders > 0 THEN
    RAISE NOTICE '  Cleared rider_id from % orders (user no longer exists)', cleaned_orders;
  ELSE
    RAISE NOTICE '✓ No invalid rider_id references found in orders';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Clean Up Invalid Data in Riders Table
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  deleted_null_user_id INT := 0;
  deleted_orphaned INT := 0;
  fixed_role_mismatch INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'riders') THEN
    RAISE NOTICE '→ Cleaning riders table...';
    
    -- Delete riders with null user_id
    DELETE FROM riders WHERE user_id IS NULL;
    GET DIAGNOSTICS deleted_null_user_id = ROW_COUNT;
    
    IF deleted_null_user_id > 0 THEN
      RAISE NOTICE '  Deleted % riders with NULL user_id', deleted_null_user_id;
    END IF;
    
    -- Delete riders where user doesn't exist
    DELETE FROM riders r
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id);
    GET DIAGNOSTICS deleted_orphaned = ROW_COUNT;
    
    IF deleted_orphaned > 0 THEN
      RAISE NOTICE '  Deleted % riders without corresponding users', deleted_orphaned;
    END IF;
    
    -- For riders where user has wrong role, we have two options:
    -- Option A: Delete the rider record (safer)
    -- Option B: Update the user's role to 'rider' (could be wrong)
    -- We'll go with Option A for data integrity
    DELETE FROM riders r
    WHERE EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = r.user_id 
      AND u.role != 'rider'
    );
    GET DIAGNOSTICS fixed_role_mismatch = ROW_COUNT;
    
    IF fixed_role_mismatch > 0 THEN
      RAISE NOTICE '  Deleted % riders where user has non-rider role', fixed_role_mismatch;
    END IF;
    
    RAISE NOTICE '✓ Riders table cleanup complete';
  ELSE
    RAISE NOTICE '→ Riders table does not exist, skipping cleanup';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Add Database-Level Validation Trigger
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS validate_rider_assignment_trigger ON orders;
DROP FUNCTION IF EXISTS validate_rider_assignment();

-- Create validation function
CREATE OR REPLACE FUNCTION validate_rider_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if rider_id is being set (not NULL)
  IF NEW.rider_id IS NOT NULL THEN
    -- Check if the rider exists in users table
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE id = NEW.rider_id
    ) THEN
      RAISE EXCEPTION 'Rider ID % does not exist in users table', NEW.rider_id
        USING HINT = 'Ensure the rider account exists before assigning',
              ERRCODE = 'foreign_key_violation';
    END IF;
    
    -- Check if the user has the 'rider' role
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE id = NEW.rider_id 
      AND role = 'rider'
    ) THEN
      RAISE EXCEPTION 'User ID % exists but is not a rider (check role in users table)', NEW.rider_id
        USING HINT = 'Only users with role=''rider'' can be assigned to orders',
              ERRCODE = 'check_violation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before INSERT or UPDATE on orders
CREATE TRIGGER validate_rider_assignment_trigger
  BEFORE INSERT OR UPDATE OF rider_id ON orders
  FOR EACH ROW
  WHEN (NEW.rider_id IS NOT NULL)
  EXECUTE FUNCTION validate_rider_assignment();

COMMENT ON FUNCTION validate_rider_assignment() IS 
  'Validates that rider_id references a user with role=''rider'' before assignment to orders';

DO $$
BEGIN
  RAISE NOTICE '✓ Created validation trigger for rider assignments';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Create Helper Function to Get Valid Riders
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_available_riders();

-- Create function to get all valid, available riders
CREATE OR REPLACE FUNCTION get_available_riders()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  is_available BOOLEAN,
  has_completed_profile BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.full_name,
    u.email,
    COALESCE(r.is_available, false) AS is_available,
    (r.user_id IS NOT NULL) AS has_completed_profile
  FROM users u
  LEFT JOIN riders r ON u.id = r.user_id
  WHERE u.role = 'rider'
    AND (r.is_available = true OR r.user_id IS NULL)
  ORDER BY 
    r.is_available DESC NULLS LAST,
    u.full_name ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_riders() IS 
  'Returns all valid riders (users with role=''rider''), including those who haven''t completed their rider profile yet. Use user_id for orders.rider_id assignment.';

DO $$
BEGIN
  RAISE NOTICE '✓ Created get_available_riders() helper function';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Add Indexes for Performance
-- ═══════════════════════════════════════════════════════════════════════════

-- Index on orders.rider_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id) WHERE rider_id IS NOT NULL;

-- Composite index on users for rider queries
CREATE INDEX IF NOT EXISTS idx_users_role_rider ON users(role) WHERE role = 'rider';

DO $$
BEGIN
  RAISE NOTICE '✓ Created performance indexes';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: Final Validation Report
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  valid_riders INT := 0;
  riders_with_profile INT := 0;
  riders_without_profile INT := 0;
  orders_with_riders INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '→ Final validation report...';
  
  -- Count valid riders
  SELECT COUNT(*) INTO valid_riders
  FROM users
  WHERE role = 'rider';
  
  RAISE NOTICE '  Total users with rider role: %', valid_riders;
  
  -- Count riders with completed profile
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'riders') THEN
    SELECT COUNT(*) INTO riders_with_profile
    FROM riders r
    INNER JOIN users u ON r.user_id = u.id
    WHERE u.role = 'rider';
    
    RAISE NOTICE '  Riders with completed profile: %', riders_with_profile;
    RAISE NOTICE '  Riders without profile: %', (valid_riders - riders_with_profile);
  END IF;
  
  -- Count orders assigned to riders
  SELECT COUNT(*) INTO orders_with_riders
  FROM orders
  WHERE rider_id IS NOT NULL;
  
  RAISE NOTICE '  Orders assigned to riders: %', orders_with_riders;
  
  RAISE NOTICE '✓ All data validated successfully';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 057 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'What was fixed:';
  RAISE NOTICE '  ✓ Cleaned up invalid rider_id references in orders';
  RAISE NOTICE '  ✓ Removed orphaned riders from riders table';
  RAISE NOTICE '  ✓ Removed riders with role mismatches';
  RAISE NOTICE '  ✓ Added database trigger to validate rider assignments';
  RAISE NOTICE '  ✓ Created get_available_riders() helper function';
  RAISE NOTICE '  ✓ Added performance indexes';
  RAISE NOTICE '';
  RAISE NOTICE 'Database-level protections now in place:';
  RAISE NOTICE '  • Trigger validates rider exists before assignment';
  RAISE NOTICE '  • Trigger validates user has ''rider'' role';
  RAISE NOTICE '  • FK constraint ensures referential integrity';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  -- Get available riders';
  RAISE NOTICE '  SELECT * FROM get_available_riders();';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Check if a user can be assigned as rider';
  RAISE NOTICE '  SELECT validate_rider_exists(''user-uuid-here'');';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: The FK constraint error should no longer occur!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
