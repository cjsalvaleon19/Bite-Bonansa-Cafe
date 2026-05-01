-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 053: Fix Riders Table Schema
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem: If riders table exists without user_id column (from partial migration
-- or manual table creation), migration 050 will fail with "column user_id does not exist"
-- because CREATE TABLE IF NOT EXISTS skips table creation but subsequent commands
-- expect the user_id column to exist.
--
-- Solution: Check if riders table exists and ensure it has the correct schema.
-- If it exists without user_id, add the column. If it doesn't exist, create it.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Fixing riders table schema...';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Check if riders table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'riders'
  ) THEN
    RAISE NOTICE '→ riders table exists, checking schema...';
    
    -- Check if user_id column exists
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'riders' 
      AND column_name = 'user_id'
    ) THEN
      RAISE NOTICE '✗ user_id column missing, adding it now...';
      
      -- Add user_id column
      ALTER TABLE riders 
      ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE;
      
      RAISE NOTICE '✓ Added user_id column to riders table';
      
      -- Create index on user_id if it doesn't exist
      CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);
      RAISE NOTICE '✓ Created index on user_id';
    ELSE
      RAISE NOTICE '✓ user_id column already exists';
    END IF;
    
    -- Ensure other critical columns exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'driver_id'
    ) THEN
      ALTER TABLE riders ADD COLUMN driver_id VARCHAR(50) UNIQUE NOT NULL;
      RAISE NOTICE '✓ Added driver_id column';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'total_earnings'
    ) THEN
      ALTER TABLE riders ADD COLUMN total_earnings DECIMAL(10,2) DEFAULT 0;
      RAISE NOTICE '✓ Added total_earnings column';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'deliveries_completed'
    ) THEN
      ALTER TABLE riders ADD COLUMN deliveries_completed INT DEFAULT 0;
      RAISE NOTICE '✓ Added deliveries_completed column';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'is_available'
    ) THEN
      ALTER TABLE riders ADD COLUMN is_available BOOLEAN DEFAULT true;
      RAISE NOTICE '✓ Added is_available column';
    END IF;
    
  ELSE
    RAISE NOTICE '→ riders table does not exist, will be created by migration 050';
  END IF;
  
  RAISE NOTICE 'Schema validation completed';
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
  RAISE NOTICE 'Migration 053 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'What this migration does:';
  RAISE NOTICE '  - Checks if riders table exists';
  RAISE NOTICE '  - Adds user_id column if missing';
  RAISE NOTICE '  - Ensures other critical columns exist';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  - If riders table did not exist, run migration 050';
  RAISE NOTICE '  - If riders table was fixed, migration 050 should now succeed';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
