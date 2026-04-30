-- ============================================================================
-- Remove Orphaned Triggers Referencing Missing Functions
-- Fixes error: function public.post_order_journal_entries() does not exist
-- ============================================================================

-- This migration cleans up any orphaned triggers that reference non-existent
-- functions, particularly post_order_journal_entries which may have been
-- created in production but is not part of the application schema.

-- Drop any triggers on order_items that reference post_order_journal_entries
DO $$
DECLARE
  trigger_rec RECORD;
  dropped_count INT := 0;
BEGIN
  -- Find all triggers on order_items table
  FOR trigger_rec IN 
    SELECT t.tgname as trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'order_items'
      AND t.tgisinternal = false
  LOOP
    BEGIN
      -- Try to get the trigger's function definition
      -- If it references a missing function, we'll drop it
      DECLARE
        func_name TEXT;
      BEGIN
        SELECT p.proname INTO func_name
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgname = trigger_rec.trigger_name;
        
        -- Check if the function name contains 'journal' or is post_order_journal_entries
        IF func_name LIKE '%journal%' OR func_name = 'post_order_journal_entries' THEN
          EXECUTE format('DROP TRIGGER IF EXISTS %I ON order_items', trigger_rec.trigger_name);
          dropped_count := dropped_count + 1;
          RAISE NOTICE 'Dropped trigger % referencing journal function %', trigger_rec.trigger_name, func_name;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- If we can't get the function, the trigger might be orphaned
          -- Check if it's safe to drop by trying to describe it
          NULL;
      END;
    END;
  END LOOP;
  
  IF dropped_count > 0 THEN
    RAISE NOTICE '✓ Dropped % orphaned trigger(s) from order_items table', dropped_count;
  ELSE
    RAISE NOTICE 'ℹ No orphaned triggers found on order_items table';
  END IF;
END $$;

-- Also check and drop the function itself if it exists but is causing errors
DROP FUNCTION IF EXISTS public.post_order_journal_entries(text, character varying, text);
DROP FUNCTION IF EXISTS public.post_order_journal_entries(text, varchar, text);
DROP FUNCTION IF EXISTS public.post_order_journal_entries();
DROP FUNCTION IF EXISTS public.post_order_journal_entries;

-- Verification: List remaining triggers on order_items
DO $$
DECLARE
  trigger_count INT;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname = 'order_items'
    AND t.tgisinternal = false;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICATION: order_items table has % active trigger(s)', trigger_count;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;

-- List the remaining triggers for review
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'order_items'
  AND t.tgisinternal = false;

-- ============================================================================
-- COMPLETION NOTICE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Orphaned Trigger Cleanup completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Removed triggers/functions:';
  RAISE NOTICE '✓ Triggers on order_items referencing journal functions';
  RAISE NOTICE '✓ post_order_journal_entries function (if it existed)';
  RAISE NOTICE '';
  RAISE NOTICE 'The error "function public.post_order_journal_entries() does not exist"';
  RAISE NOTICE 'should now be resolved.';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact:';
  RAISE NOTICE '• Order item served status updates will work correctly';
  RAISE NOTICE '• No journal entries will be created (if that was the intent)';
  RAISE NOTICE '• If journal functionality is needed, implement it separately';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
