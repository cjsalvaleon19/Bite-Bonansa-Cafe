# 🚨 CORRECTED FIX: Duplicate Order Number Constraint Error

## Issue with Previous Script

The SQL script in `IMMEDIATE_FIX_DUPLICATE_ORDER_NUMBER.md` had a **syntax error** on line 97:
```
RAISE NOTICE '✓ Created composite unique index for daily order number resets';
```

**Problem:** `RAISE NOTICE` statements can only be used inside PL/pgSQL blocks (`DO $$` blocks, functions, procedures). This standalone statement caused a syntax error.

## ✅ CORRECTED SQL SCRIPT

### Option 1: Run the SQL File (Recommended)

The corrected SQL script is available at:
```
FIX_ORDER_NUMBER_CONSTRAINT_NOW.sql
```

Open your **Supabase SQL Editor** and paste the entire contents of this file, then run it.

### Option 2: Copy and Paste This Script

```sql
-- ============================================================================
-- CORRECTED FIX: Remove Global UNIQUE Constraint on order_number
-- This version has the syntax error fixed
-- ============================================================================

-- Step 1: Drop the problematic global unique constraint
DO $$
DECLARE
  constraint_exists BOOLEAN;
  constraint_name TEXT;
BEGIN
  -- Check if constraint exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'orders' 
      AND c.contype = 'u'
      AND a.attname = 'order_number'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    -- Get the constraint name
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'orders' 
      AND c.contype = 'u'
      AND a.attname = 'order_number'
    LIMIT 1;
    
    -- Drop the constraint
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE '✓ Dropped global unique constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'ℹ No global unique constraint found on order_number';
  END IF;
END $$;

-- Step 2: Create composite unique index (per-day uniqueness)
-- This allows order numbers to reset daily while preventing duplicates on same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;

-- Step 3: Verify the fix
DO $$
DECLARE
  old_constraint_exists BOOLEAN;
  new_index_exists BOOLEAN;
BEGIN
  -- Check if old constraint is gone
  SELECT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'orders' 
      AND c.contype = 'u'
      AND a.attname = 'order_number'
  ) INTO old_constraint_exists;
  
  -- Check if new index exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND indexname = 'idx_orders_order_number_date_unique'
  ) INTO new_index_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  IF NOT old_constraint_exists AND new_index_exists THEN
    RAISE NOTICE '✓✓✓ SUCCESS: Order number constraint fix completed! ✓✓✓';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ Global UNIQUE constraint removed';
    RAISE NOTICE '✓ Composite unique index created (per-day uniqueness)';
    RAISE NOTICE '';
    RAISE NOTICE 'Order numbers can now reset daily without errors.';
    RAISE NOTICE 'The duplicate key error should be resolved.';
  ELSE
    RAISE WARNING '⚠ Fix may not be complete:';
    IF old_constraint_exists THEN
      RAISE WARNING '  - Old constraint still exists - try running again';
    END IF;
    IF NOT new_index_exists THEN
      RAISE WARNING '  - New index was not created - check permissions';
    END IF;
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
```

## Expected Output

After running the corrected script, you should see:

```
NOTICE: ✓ Dropped global unique constraint: orders_order_number_key
NOTICE: 
NOTICE: ════════════════════════════════════════════════════════════
NOTICE: ✓✓✓ SUCCESS: Order number constraint fix completed! ✓✓✓
NOTICE: ════════════════════════════════════════════════════════════
NOTICE: ✓ Global UNIQUE constraint removed
NOTICE: ✓ Composite unique index created (per-day uniqueness)
NOTICE: 
NOTICE: Order numbers can now reset daily without errors.
NOTICE: The duplicate key error should be resolved.
NOTICE: ════════════════════════════════════════════════════════════
```

## Verification Queries

After running the script, verify the fix with these queries:

### Query 1: Check old constraint is gone (should return NO ROWS)
```sql
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'orders' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%order_number%';
```

**Expected Result:** ✅ NO ROWS (constraint removed successfully)

### Query 2: Check new index exists (should return 1 ROW)
```sql
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'orders' 
  AND indexname = 'idx_orders_order_number_date_unique';
```

**Expected Result:** ✅ 1 ROW showing the composite index

## What Changed

### Before (❌ Broken)
- Global UNIQUE constraint: `orders_order_number_key`
- Order #001 can only exist once across ALL days
- Creating order #001 tomorrow → DUPLICATE KEY ERROR

### After (✅ Fixed)
- Composite unique index: `idx_orders_order_number_date_unique`
- Order #001 can exist once PER DAY
- Creating order #001 tomorrow → SUCCESS

## Test the Fix

1. **Place an order** in the customer portal
2. **Check browser console** - should NOT see duplicate key error
3. **Verify order is created** successfully
4. ✅ The 409 error should be gone!

## Troubleshooting

### If you still see `orders_order_number_key` after running the script:

The constraint might be part of a composite primary key or have dependencies. Try this alternative approach:

```sql
-- Force drop the constraint by name
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key CASCADE;

-- Then create the index
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;
```

### If the index creation fails:

Check for existing duplicate order numbers on the same day:

```sql
-- Find duplicate order numbers on the same day
SELECT 
  order_number,
  created_at::date as order_date,
  COUNT(*) as count
FROM orders
WHERE order_number IS NOT NULL
GROUP BY order_number, created_at::date
HAVING COUNT(*) > 1;
```

If duplicates exist, you'll need to clean them up before creating the unique index.

## Next Steps

1. ✅ Run the corrected SQL script
2. ✅ Verify with the verification queries
3. ✅ Test order placement
4. ✅ Monitor for any errors
5. 📝 Mark migration 046 as applied in your deployment notes

---

**Time to Fix:** ~1 minute  
**Downtime:** None  
**Priority:** 🚨 CRITICAL
