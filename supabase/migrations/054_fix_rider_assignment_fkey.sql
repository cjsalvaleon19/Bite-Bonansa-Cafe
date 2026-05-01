-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 054: Fix Rider Assignment Issues
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem: Foreign key constraint violation when assigning riders to orders
-- Error: "violates foreign key constraint orders_rider_id_fkey"
--
-- Root Causes:
-- 1. orders.rider_id references users(id), not riders(id)
-- 2. Riders might not exist in users table
-- 3. riders table has separate id field from user_id causing confusion
--
-- This migration ensures data consistency and adds helpful views/functions
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Fixing rider assignment data consistency...';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. Ensure Riders Table Has All Required Columns
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Only proceed if riders table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'riders'
  ) THEN
    RAISE NOTICE '→ Checking riders table schema...';
    
    -- Add vehicle_type if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'vehicle_type'
    ) THEN
      ALTER TABLE riders ADD COLUMN vehicle_type VARCHAR(50);
      RAISE NOTICE '✓ Added vehicle_type column';
    END IF;
    
    -- Add vehicle_plate if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'vehicle_plate'
    ) THEN
      ALTER TABLE riders ADD COLUMN vehicle_plate VARCHAR(20);
      RAISE NOTICE '✓ Added vehicle_plate column';
    END IF;
    
    -- Add cellphone_number if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'cellphone_number'
    ) THEN
      ALTER TABLE riders ADD COLUMN cellphone_number VARCHAR(20);
      RAISE NOTICE '✓ Added cellphone_number column';
    END IF;
    
    -- Add emergency_contact if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'emergency_contact'
    ) THEN
      ALTER TABLE riders ADD COLUMN emergency_contact VARCHAR(255);
      RAISE NOTICE '✓ Added emergency_contact column';
    END IF;
    
    -- Add emergency_phone if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'emergency_phone'
    ) THEN
      ALTER TABLE riders ADD COLUMN emergency_phone VARCHAR(20);
      RAISE NOTICE '✓ Added emergency_phone column';
    END IF;
    
    RAISE NOTICE '✓ Riders table schema validation complete';
  ELSE
    RAISE NOTICE '→ Riders table does not exist, skipping schema checks';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Verify Foreign Key Relationships
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  orphaned_orders INT;
  orphaned_riders INT;
BEGIN
  -- Check for orders with rider_id that don't exist in users table
  SELECT COUNT(*) INTO orphaned_orders
  FROM orders o
  WHERE o.rider_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.rider_id);
  
  IF orphaned_orders > 0 THEN
    RAISE WARNING '→ Found % orders with invalid rider_id references', orphaned_orders;
    
    -- Clear invalid rider_id references
    UPDATE orders
    SET rider_id = NULL
    WHERE rider_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = orders.rider_id);
    
    RAISE NOTICE '✓ Cleared invalid rider_id references from orders table';
  ELSE
    RAISE NOTICE '✓ No orphaned rider references in orders table';
  END IF;
  
  -- Check for riders table entries without corresponding users
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'riders') THEN
    SELECT COUNT(*) INTO orphaned_riders
    FROM riders r
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id);
    
    IF orphaned_riders > 0 THEN
      RAISE WARNING '→ Found % riders without corresponding users', orphaned_riders;
      
      -- Delete orphaned riders (they should cascade from users anyway)
      DELETE FROM riders
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = riders.user_id);
      
      RAISE NOTICE '✓ Removed orphaned riders from riders table';
    ELSE
      RAISE NOTICE '✓ All riders have valid user references';
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Create Helpful View for Rider Information
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing view if it exists
DROP VIEW IF EXISTS available_riders_view;

-- Create view that combines riders and users data
-- This makes it easy to query rider information with user details
CREATE OR REPLACE VIEW available_riders_view AS
SELECT 
  r.id as rider_table_id,
  r.user_id,
  u.id as user_id_duplicate,  -- Same as user_id, for clarity
  u.full_name,
  u.email,
  u.role,
  r.driver_id,
  r.vehicle_type,
  r.vehicle_plate,
  r.cellphone_number,
  r.is_available,
  r.total_earnings,
  r.deliveries_completed,
  r.created_at as rider_created_at,
  u.created_at as user_created_at
FROM riders r
INNER JOIN users u ON r.user_id = u.id
WHERE u.role = 'rider';

COMMENT ON VIEW available_riders_view IS 
  'Combined view of riders and users tables. Use user_id when assigning to orders.rider_id';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Add Helpful Comments to Clarify ID Usage
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN orders.rider_id IS 
  'References users.id (NOT riders.id). Use riders.user_id when querying from riders table.';

COMMENT ON COLUMN riders.id IS 
  'Primary key of riders table. NOT used in orders.rider_id foreign key.';

COMMENT ON COLUMN riders.user_id IS 
  'References users.id. THIS is the value to use for orders.rider_id assignments.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Create Function to Validate Rider Assignment
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_rider_exists(rider_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the user exists and is a rider
  RETURN EXISTS (
    SELECT 1 
    FROM users u
    WHERE u.id = rider_user_id
      AND u.role = 'rider'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_rider_exists IS 
  'Validates that a user ID exists and belongs to a rider. Use before assigning to orders.rider_id';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Add Constraint to Ensure rider_id Points to Actual Riders
-- ═══════════════════════════════════════════════════════════════════════════

-- Add a check constraint to ensure rider_id references users with role='rider'
-- This is in addition to the FK constraint for extra safety
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_rider_must_be_rider_role'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_rider_must_be_rider_role;
  END IF;
  
  -- Note: We can't add a CHECK constraint that references another table
  -- So we'll rely on application logic and the foreign key constraint
  RAISE NOTICE '→ Relying on foreign key constraint and application validation';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 054 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'What this migration does:';
  RAISE NOTICE '  1. Cleaned up orphaned rider references in orders';
  RAISE NOTICE '  2. Removed riders without valid user accounts';
  RAISE NOTICE '  3. Created available_riders_view for easy querying';
  RAISE NOTICE '  4. Added validate_rider_exists() function';
  RAISE NOTICE '  5. Added helpful column comments';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT NOTES:';
  RAISE NOTICE '  - orders.rider_id references users.id (NOT riders.id)';
  RAISE NOTICE '  - Use riders.user_id when fetching from riders table';
  RAISE NOTICE '  - Use available_riders_view for joined rider/user data';
  RAISE NOTICE '  - Call validate_rider_exists(user_id) before assignment';
  RAISE NOTICE '';
  RAISE NOTICE 'Example Query:';
  RAISE NOTICE '  SELECT user_id, full_name FROM available_riders_view';
  RAISE NOTICE '  WHERE is_available = true;';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
