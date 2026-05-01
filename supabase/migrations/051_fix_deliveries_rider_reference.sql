-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 051: Fix Deliveries Table order_id Type Mismatch
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem: Migration 050 incorrectly defined deliveries.order_id as UUID type,
-- but orders.id is TEXT type. This causes FK constraint errors and potential
-- "column does not exist" errors when PostgreSQL tries to resolve relationships.
-- 
-- Solution: Alter deliveries.order_id to TEXT type to match orders.id
-- ═══════════════════════════════════════════════════════════════════════════

-- Fix deliveries.order_id type mismatch
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Fixing deliveries.order_id type mismatch...';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Check if deliveries table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'deliveries'
  ) THEN
    -- Drop existing FK constraint if it exists
    IF EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name LIKE 'deliveries_order_id%'
      AND table_name = 'deliveries'
      AND constraint_type = 'FOREIGN KEY'
    ) THEN
      EXECUTE (
        SELECT 'ALTER TABLE deliveries DROP CONSTRAINT ' || constraint_name || ';'
        FROM information_schema.table_constraints
        WHERE constraint_name LIKE 'deliveries_order_id%'
        AND table_name = 'deliveries'
        AND constraint_type = 'FOREIGN KEY'
        LIMIT 1
      );
      RAISE NOTICE '✓ Dropped existing FK constraint on order_id';
    END IF;
    
    -- Alter column type from UUID to TEXT
    ALTER TABLE deliveries 
    ALTER COLUMN order_id TYPE TEXT USING order_id::TEXT;
    
    RAISE NOTICE '✓ Changed deliveries.order_id type to TEXT';
    
    -- Re-add FK constraint with correct type
    ALTER TABLE deliveries
    ADD CONSTRAINT deliveries_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✓ Re-added FK constraint: deliveries.order_id -> orders.id';
  ELSE
    -- Table doesn't exist - this migration will be a no-op
    -- Migration 050 will create the table with correct type
    RAISE NOTICE '→ deliveries table does not exist, skipping (migration 050 will create it correctly)';
  END IF;
  
  RAISE NOTICE 'Fix completed successfully';
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
  RAISE NOTICE 'Migration 051 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed type mismatch:';
  RAISE NOTICE '  deliveries.order_id: UUID -> TEXT';
  RAISE NOTICE '  Now correctly references orders.id (TEXT type)';
  RAISE NOTICE '';
  RAISE NOTICE 'Table relationships:';
  RAISE NOTICE '  deliveries.order_id -> orders.id (TEXT)';
  RAISE NOTICE '  deliveries.rider_id -> users.id (UUID)';
  RAISE NOTICE '  riders.user_id -> users.id (UUID)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
