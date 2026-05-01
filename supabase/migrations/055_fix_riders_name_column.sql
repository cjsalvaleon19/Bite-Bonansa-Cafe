-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 055: Fix Riders Table "name" Column Issue
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem: The riders table in production has a "name" column with NOT NULL
-- constraint that isn't defined in the migration files. This causes profile
-- saves to fail with "null value in column name violates not-null constraint"
--
-- Solution: Check if the "name" column exists. If it does, either:
-- 1. Drop it if it's not being used (preferred - matches migration schema)
-- 2. Make it nullable if it contains data
-- 
-- The riders table should only store rider-specific info. Name comes from
-- the users table via the user_id foreign key.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Fixing riders table name column...';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Check if riders table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'riders'
  ) THEN
    RAISE NOTICE '→ riders table exists, checking for name column...';
    
    -- Check if name column exists
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'riders' 
      AND column_name = 'name'
    ) THEN
      RAISE NOTICE '✗ name column found (not in migration schema)';
      
      -- Check if column has data
      DECLARE
        has_data BOOLEAN;
      BEGIN
        SELECT EXISTS(SELECT 1 FROM riders WHERE name IS NOT NULL) INTO has_data;
        
        IF has_data THEN
          RAISE NOTICE '  Column contains data, making it nullable...';
          -- Remove NOT NULL constraint
          ALTER TABLE riders ALTER COLUMN name DROP NOT NULL;
          RAISE NOTICE '✓ Removed NOT NULL constraint from name column';
          RAISE NOTICE '  NOTE: Consider migrating name data to users.full_name';
        ELSE
          RAISE NOTICE '  Column is empty, dropping it...';
          ALTER TABLE riders DROP COLUMN name;
          RAISE NOTICE '✓ Dropped name column (use users.full_name instead)';
        END IF;
      END;
    ELSE
      RAISE NOTICE '✓ name column does not exist (schema is correct)';
    END IF;
    
  ELSE
    RAISE NOTICE '→ riders table does not exist yet';
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 055 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'What this migration does:';
  RAISE NOTICE '  - Checks if riders table has unexpected "name" column';
  RAISE NOTICE '  - Drops column if empty, makes nullable if has data';
  RAISE NOTICE '  - Ensures schema matches migration files';
  RAISE NOTICE '';
  RAISE NOTICE 'Schema note:';
  RAISE NOTICE '  - Rider names should come from users.full_name via user_id FK';
  RAISE NOTICE '  - The riders table stores only rider-specific information';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
