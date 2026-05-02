-- ============================================
-- Migration 063: Fix orders.rider_id FK to SET NULL on DELETE
-- ============================================
-- 
-- Purpose: Update orders_rider_id_fkey constraint to use ON DELETE SET NULL
-- instead of NO ACTION. When a user (rider) is deleted, their assigned orders
-- should have rider_id set to NULL rather than blocking the deletion.
--
-- This is safer than CASCADE (which would delete orders) - we want to preserve
-- order history even when riders are removed from the system.
-- ============================================

-- Step 1: Log start of migration
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration 063: Fix orders.rider_id FK';
  RAISE NOTICE 'Started at: %', now();
  RAISE NOTICE '===========================================';
END $$;

-- Step 2: Check current constraint
DO $$
DECLARE
  v_current_delete_action TEXT;
BEGIN
  SELECT 
    CASE pg_con.confdeltype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
    END INTO v_current_delete_action
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN pg_constraint pg_con
    ON tc.constraint_name = pg_con.conname
  WHERE tc.constraint_name = 'orders_rider_id_fkey'
    AND tc.table_name = 'orders';
  
  RAISE NOTICE 'Current orders.rider_id FK delete action: %', 
    COALESCE(v_current_delete_action, 'NOT FOUND');
END $$;

-- Step 3: Drop the old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_rider_id_fkey'
      AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_rider_id_fkey;
    RAISE NOTICE 'Dropped existing orders_rider_id_fkey constraint';
  ELSE
    RAISE NOTICE 'No existing orders_rider_id_fkey constraint found';
  END IF;
END $$;

-- Step 4: Recreate constraint with ON DELETE SET NULL
ALTER TABLE orders
ADD CONSTRAINT orders_rider_id_fkey
FOREIGN KEY (rider_id)
REFERENCES users(id)
ON DELETE SET NULL;

-- Step 5: Verify the new constraint
DO $$
DECLARE
  v_new_delete_action TEXT;
BEGIN
  SELECT 
    CASE pg_con.confdeltype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
    END INTO v_new_delete_action
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN pg_constraint pg_con
    ON tc.constraint_name = pg_con.conname
  WHERE tc.constraint_name = 'orders_rider_id_fkey'
    AND tc.table_name = 'orders';
  
  IF v_new_delete_action = 'SET NULL' THEN
    RAISE NOTICE 'SUCCESS: orders.rider_id FK now has ON DELETE SET NULL';
  ELSE
    RAISE WARNING 'UNEXPECTED: orders.rider_id FK delete action is: %', 
      v_new_delete_action;
  END IF;
END $$;

-- Step 6: Log completion
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration 063 completed at: %', now();
  RAISE NOTICE '===========================================';
END $$;
