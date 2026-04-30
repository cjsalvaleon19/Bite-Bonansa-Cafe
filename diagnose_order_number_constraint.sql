-- ============================================================================
-- DIAGNOSTIC SCRIPT: Check Order Number Constraint Status
-- Run this in Supabase SQL Editor to diagnose the duplicate key error
-- ============================================================================

DO $$
DECLARE
  has_global_constraint BOOLEAN;
  has_composite_index BOOLEAN;
  constraint_name TEXT;
  constraint_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNOSTIC: Order Number Constraint Status';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Check for global unique constraint on order_number
  SELECT 
    EXISTS (
      SELECT 1 
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE t.relname = 'orders' 
        AND c.contype = 'u'
        AND a.attname = 'order_number'
    ),
    (
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE t.relname = 'orders' 
        AND c.contype = 'u'
        AND a.attname = 'order_number'
      LIMIT 1
    )
  INTO has_global_constraint, constraint_name;
  
  -- Check for composite unique index
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND indexname = 'idx_orders_order_number_date_unique'
  ) INTO has_composite_index;
  
  -- Count total unique constraints on order_number
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'orders' 
    AND c.contype = 'u'
    AND a.attname = 'order_number';
  
  -- Report findings
  RAISE NOTICE '1. GLOBAL UNIQUE CONSTRAINT on order_number:';
  IF has_global_constraint THEN
    RAISE NOTICE '   ❌ FOUND: % (THIS IS THE PROBLEM!)', constraint_name;
    RAISE NOTICE '   → This constraint prevents daily order number resets';
    RAISE NOTICE '   → Causes: "duplicate key value violates unique constraint"';
  ELSE
    RAISE NOTICE '   ✓ NOT FOUND (Good - constraint should not exist)';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '2. COMPOSITE UNIQUE INDEX (order_number + date):';
  IF has_composite_index THEN
    RAISE NOTICE '   ✓ FOUND: idx_orders_order_number_date_unique (Correct!)';
    RAISE NOTICE '   → Allows daily order number resets';
    RAISE NOTICE '   → Prevents duplicates within same day';
  ELSE
    RAISE NOTICE '   ❌ NOT FOUND (Missing - index should exist)';
    RAISE NOTICE '   → This index is needed for daily resets to work';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNOSIS RESULT:';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  IF has_global_constraint AND NOT has_composite_index THEN
    RAISE NOTICE '❌ STATUS: BROKEN - Migration 046 has NOT been applied';
    RAISE NOTICE '';
    RAISE NOTICE 'ACTION REQUIRED:';
    RAISE NOTICE '1. The global unique constraint exists (causes errors)';
    RAISE NOTICE '2. The composite index is missing (needed for daily resets)';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '→ Apply the fix from IMMEDIATE_FIX_DUPLICATE_ORDER_NUMBER.md';
    RAISE NOTICE '→ Or run migration: 046_fix_duplicate_order_number_constraint.sql';
    
  ELSIF NOT has_global_constraint AND has_composite_index THEN
    RAISE NOTICE '✓✓✓ STATUS: FIXED - Migration 046 has been applied correctly';
    RAISE NOTICE '';
    RAISE NOTICE 'Your database is configured correctly for daily order resets.';
    RAISE NOTICE 'If you still see errors, check:';
    RAISE NOTICE '1. Application cache (try restarting the app)';
    RAISE NOTICE '2. Browser cache (hard refresh: Ctrl+Shift+R)';
    RAISE NOTICE '3. Check exact error message in browser console';
    
  ELSIF has_global_constraint AND has_composite_index THEN
    RAISE WARNING '⚠ STATUS: PARTIAL - Both constraint and index exist';
    RAISE NOTICE '';
    RAISE NOTICE 'This is unusual. The global constraint should be removed.';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '→ Run the fix again to remove the global constraint';
    
  ELSE
    RAISE WARNING '⚠ STATUS: INCOMPLETE - Neither constraint nor index found';
    RAISE NOTICE '';
    RAISE NOTICE 'No uniqueness constraint on order_number at all.';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '→ Apply migration 046 to create the composite index';
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Show all unique constraints on orders table for reference
SELECT 
  c.conname as constraint_name,
  string_agg(a.attname, ', ') as columns,
  c.contype as type
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
WHERE t.relname = 'orders' 
  AND c.contype = 'u'
GROUP BY c.conname, c.contype;

-- Show relevant indexes on orders table
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'orders' 
  AND (indexname LIKE '%order_number%' OR indexname LIKE '%date%')
ORDER BY indexname;
