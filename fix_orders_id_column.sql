-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Orders Table ID Column - Ensure Auto-Generation Works
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration fixes the "null value in column 'id' violates not-null constraint" error
-- by ensuring the orders table has a proper UUID id column with auto-generation.
-- ═══════════════════════════════════════════════════════════════════════════

-- First, check if the orders table exists and what type the id column is
DO $$
DECLARE
  id_type TEXT;
  has_default BOOLEAN;
BEGIN
  -- Get the current id column type
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'id';
  
  -- Check if id has a default value
  SELECT column_default IS NOT NULL INTO has_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'id';
  
  RAISE NOTICE 'Current orders.id type: %, has_default: %', id_type, has_default;
  
  -- If the id column is TEXT instead of UUID, we need to convert it
  -- This is a complex operation that should be done carefully
  IF id_type = 'text' OR id_type = 'character varying' THEN
    RAISE NOTICE 'WARNING: orders.id is TEXT type. This requires manual conversion to UUID.';
    RAISE NOTICE 'For now, we will add a default value for TEXT type.';
    
    -- For TEXT type, we can set a default using gen_random_uuid()::text
    -- But first, drop the constraint if it exists
    EXECUTE 'ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT gen_random_uuid()::text';
    RAISE NOTICE 'Set default for TEXT id column to gen_random_uuid()::text';
    
  ELSIF id_type = 'uuid' THEN
    -- For UUID type, ensure the default is set
    IF NOT has_default THEN
      EXECUTE 'ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT gen_random_uuid()';
      RAISE NOTICE 'Set default for UUID id column to gen_random_uuid()';
    ELSE
      RAISE NOTICE 'UUID id column already has a default value';
    END IF;
    
  ELSE
    RAISE NOTICE 'Unknown id type: %. Manual intervention required.', id_type;
  END IF;
  
END $$;

-- Ensure the id column is NOT NULL
ALTER TABLE public.orders
  ALTER COLUMN id SET NOT NULL;

-- Ensure the id column is the primary key
DO $$
BEGIN
  -- Check if primary key constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.orders ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added primary key constraint to orders.id';
  ELSE
    RAISE NOTICE 'Primary key constraint already exists on orders.id';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification
-- ═══════════════════════════════════════════════════════════════════════════

-- Display the current schema for the orders table id column
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name = 'id';

-- Display all constraints on the orders table
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE con.contype::text
  END AS constraint_type_desc
FROM pg_constraint con
WHERE con.conrelid = 'public.orders'::regclass
  AND con.contype IN ('p', 'u');
