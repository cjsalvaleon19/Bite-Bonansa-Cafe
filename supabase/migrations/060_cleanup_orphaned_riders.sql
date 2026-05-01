-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 060: Clean Up Orphaned Rider Records
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Fix FK constraint violations caused by orphaned riders
--
-- Problem: The riders table contains records where user_id references users
--          that no longer exist. This causes FK violations when trying to
--          assign these riders to orders.
--
-- Root Cause: Users can be deleted from users table (account deletion, admin
--             cleanup, etc.) but their rider records remain, creating orphans.
--
-- Solution: 
--   1. Identify and report orphaned riders
--   2. Archive orphaned data (for potential recovery)
--   3. Delete orphaned riders
--   4. Add constraint to prevent future orphans (ON DELETE CASCADE)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_orphaned_count INTEGER;
  v_orphaned_riders RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 060: Cleaning Up Orphaned Rider Records';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Step 1: Identify orphaned riders (riders with user_id not in users table)
  SELECT COUNT(*) INTO v_orphaned_count
  FROM riders r
  WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = r.user_id
  );

  RAISE NOTICE 'Found % orphaned rider record(s)', v_orphaned_count;
  
  IF v_orphaned_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Orphaned riders details:';
    
    FOR v_orphaned_riders IN 
      SELECT r.id, r.user_id, r.cellphone_number, r.vehicle_type, r.created_at
      FROM riders r
      WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = r.user_id
      )
      ORDER BY r.created_at DESC
    LOOP
      RAISE NOTICE '  - Rider ID: %, User ID: %, Vehicle: %, Created: %', 
        v_orphaned_riders.id,
        v_orphaned_riders.user_id,
        v_orphaned_riders.vehicle_type,
        v_orphaned_riders.created_at;
    END LOOP;
    
    -- Step 2: Create archive table if it doesn't exist (for data recovery)
    CREATE TABLE IF NOT EXISTS riders_archived (
      archived_at TIMESTAMPTZ DEFAULT NOW(),
      reason TEXT,
      LIKE riders INCLUDING ALL
    );
    
    RAISE NOTICE '';
    RAISE NOTICE 'Archiving orphaned riders to riders_archived table...';
    
    -- Step 3: Archive orphaned riders before deletion
    INSERT INTO riders_archived (reason, id, user_id, driver_id, vehicle_type, vehicle_plate, 
                                 cellphone_number, emergency_contact, emergency_phone,
                                 is_available, total_earnings, deliveries_completed,
                                 created_at, updated_at)
    SELECT 'orphaned_user_deleted',
           r.id, r.user_id, r.driver_id, r.vehicle_type, r.vehicle_plate,
           r.cellphone_number, r.emergency_contact, r.emergency_phone,
           r.is_available, r.total_earnings, r.deliveries_completed,
           r.created_at, r.updated_at
    FROM riders r
    WHERE NOT EXISTS (
      SELECT 1 FROM users u WHERE u.id = r.user_id
    );
    
    RAISE NOTICE 'Archived % rider record(s)', v_orphaned_count;
    
    -- Step 4: Delete orphaned riders
    DELETE FROM riders r
    WHERE NOT EXISTS (
      SELECT 1 FROM users u WHERE u.id = r.user_id
    );
    
    RAISE NOTICE 'Deleted % orphaned rider record(s)', v_orphaned_count;
  ELSE
    RAISE NOTICE 'No orphaned riders found - database is clean!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '────────────────────────────────────────────────────────────';
  RAISE NOTICE 'Step 2: Adding CASCADE constraint to prevent future orphans';
  RAISE NOTICE '────────────────────────────────────────────────────────────';
  
  -- Step 5: Drop existing FK constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'riders' 
    AND constraint_name = 'riders_user_id_fkey'
  ) THEN
    RAISE NOTICE 'Dropping existing riders_user_id_fkey constraint...';
    ALTER TABLE riders DROP CONSTRAINT riders_user_id_fkey;
    RAISE NOTICE '✓ Constraint dropped';
  END IF;
  
  -- Step 6: Add new FK constraint with ON DELETE CASCADE
  -- This ensures that when a user is deleted, their rider record is also deleted
  -- preventing orphaned riders in the future
  RAISE NOTICE 'Adding new FK constraint with ON DELETE CASCADE...';
  ALTER TABLE riders 
    ADD CONSTRAINT riders_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;  -- Automatically delete rider when user is deleted
  
  RAISE NOTICE '✓ New constraint added with CASCADE delete';
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 060: COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  ✓ Orphaned riders cleaned: %', v_orphaned_count;
  RAISE NOTICE '  ✓ Records archived to: riders_archived table';
  RAISE NOTICE '  ✓ CASCADE constraint added to prevent future orphans';
  RAISE NOTICE '';
  RAISE NOTICE 'Next time a user is deleted, their rider record will be';
  RAISE NOTICE 'automatically deleted as well, maintaining data integrity.';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
