-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnostic Script: Order Number VARCHAR(3) Issue
-- ═══════════════════════════════════════════════════════════════════════════
-- This script diagnoses the "value too long for type character varying(3)" error
-- Run this in Supabase SQL Editor to understand the current state
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Check the current column definition for order_number
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name = 'order_number';

-- 2. Check if the generate_daily_order_number function exists and its return type
SELECT 
  routine_name,
  data_type,
  character_maximum_length as return_length
FROM information_schema.routines
WHERE routine_name = 'generate_daily_order_number';

-- 3. Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_set_order_number';

-- 4. Check existing order_number values and their lengths
SELECT 
  order_number,
  LENGTH(order_number) as length,
  created_at
FROM orders
WHERE order_number IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if there are any order_numbers longer than 3 characters
SELECT 
  COUNT(*) as orders_with_long_numbers,
  MAX(LENGTH(order_number)) as max_length
FROM orders
WHERE LENGTH(order_number) > 3;

-- 6. Test the function manually
SELECT generate_daily_order_number() as test_order_number,
       LENGTH(generate_daily_order_number()) as test_length;

-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC RESULTS INTERPRETATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Expected results if migration 035 was applied correctly:
-- 1. order_number column should be VARCHAR(3)
-- 2. generate_daily_order_number() should return VARCHAR(3)
-- 3. trg_set_order_number trigger should exist
-- 4. All existing order_numbers should be 3 characters or less
-- 5. Function test should return a 3-character string like '000', '001', etc.
--
-- If any of these don't match, the migration wasn't fully applied.
-- ═══════════════════════════════════════════════════════════════════════════
