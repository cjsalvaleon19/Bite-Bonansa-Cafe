# 🚨 IMMEDIATE FIX: Duplicate Order Number Error

## Error You're Seeing

```
Failed to load resource: the server responded with a status of 409 ()
Failed to place order: Error: duplicate key value violates unique constraint "orders_order_number_key"
```

## What's Happening

The `orders` table has a **global UNIQUE constraint** on the `order_number` column. This is causing errors because:

1. Order numbers are designed to reset daily (001, 002, 003...)
2. When a new day starts and order 001 gets created again, it violates the global constraint
3. The constraint name is `orders_order_number_key`

## The Fix (3 Steps)

### Step 1: Check Current Database State

Open your **Supabase SQL Editor** and run this diagnostic query:

```sql
-- Check if the problematic constraint exists
SELECT 
  c.conname as constraint_name,
  a.attname as column_name,
  c.contype as constraint_type
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
WHERE t.relname = 'orders' 
  AND c.contype = 'u'
  AND a.attname = 'order_number';
```

**Expected Result:**
- If you see `orders_order_number_key` → The problematic constraint exists (proceed to Step 2)
- If you see no rows → The constraint was already removed (check Step 3)

---

### Step 2: Apply the Fix

Copy and paste this **complete SQL script** into your Supabase SQL Editor and run it:

```sql
-- ============================================================================
-- URGENT FIX: Remove Global UNIQUE Constraint on order_number
-- ============================================================================

BEGIN;

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

RAISE NOTICE '✓ Created composite unique index for daily order number resets';

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

COMMIT;
```

---

### Step 3: Verify the Fix

Run these verification queries to confirm the fix worked:

```sql
-- Query 1: Check that old constraint is gone (should return NO ROWS)
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'orders' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%order_number%';

-- Query 2: Check that new index exists (should return 1 ROW)
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'orders' 
  AND indexname = 'idx_orders_order_number_date_unique';
```

**Expected Results:**
- Query 1: **NO ROWS** (old constraint is gone) ✅
- Query 2: **1 ROW** showing the new composite index ✅

---

## Test the Fix

After applying the fix:

1. **Test Order Placement:**
   - Navigate to your customer order page (e.g., `/customer/order`)
   - Add items to cart
   - Click "Place Order"
   - ✅ Order should be created successfully

2. **Check Browser Console:**
   - Press F12 to open Developer Tools
   - Go to Console tab
   - ❌ Should NOT see: `duplicate key value violates unique constraint "orders_order_number_key"`
   - ✅ Should see: Order created successfully

---

## What This Fix Does

### Before (❌ Broken)
```
orders table:
- order_number column with UNIQUE constraint
- order 001 can only exist ONCE across ALL days
- When order 001 is created tomorrow → DUPLICATE KEY ERROR
```

### After (✅ Fixed)
```
orders table:
- order_number with composite unique index (order_number, date)
- order 001 can exist ONCE PER DAY
- When order 001 is created tomorrow → SUCCESS (different date)
```

---

## Why This Happened

The migration file `046_fix_duplicate_order_number_constraint.sql` exists in your repository but **has not been applied to your production database yet**. This is a common scenario when:

1. Code is deployed but migrations are not auto-applied
2. Migrations need to be manually run in Supabase
3. Local development and production databases are out of sync

---

## Next Steps After Fix

1. ✅ Apply this SQL fix immediately (takes ~5 seconds)
2. ✅ Test order placement to confirm it works
3. 📝 Document that migration 046 has been applied manually
4. 🔄 Consider setting up automatic migration deployment

---

## If Error Persists

If you still see the error after applying the fix:

### Check 1: Verify the fix was applied
```sql
-- Should return NO ROWS
SELECT * FROM pg_constraint 
WHERE conname = 'orders_order_number_key';

-- Should return 1 ROW
SELECT * FROM pg_indexes 
WHERE indexname = 'idx_orders_order_number_date_unique';
```

### Check 2: Check for other constraints
```sql
-- List ALL unique constraints on orders table
SELECT 
  c.conname as constraint_name,
  array_agg(a.attname) as columns
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
WHERE t.relname = 'orders' 
  AND c.contype = 'u'
GROUP BY c.conname;
```

### Check 3: Restart Application
Sometimes cached constraints in the application need a restart:
```bash
# If using Vercel/similar
Redeploy the application

# If using local server
Restart your Next.js server
```

---

## Technical Details

- **Migration File:** `supabase/migrations/046_fix_duplicate_order_number_constraint.sql`
- **Constraint Removed:** `orders_order_number_key` (global UNIQUE on order_number)
- **Index Created:** `idx_orders_order_number_date_unique` (composite UNIQUE on order_number + date)
- **Date Cast:** Uses `created_at::date` (IMMUTABLE) instead of `DATE()` function (STABLE)

---

## Related Documentation

- `URGENT_FIX_DUPLICATE_ORDER_NUMBER_ERROR.md` - Detailed explanation
- `APPLY_MIGRATIONS_045_046_NOW.md` - Migration instructions
- `FIX_MIGRATION_046_IMMUTABLE_ERROR.md` - Technical details

---

## Support

If you continue to experience issues:

1. Check the browser console for exact error messages
2. Check Supabase logs for database errors
3. Verify the queries in Step 3 show the expected results
4. Try placing an order and note the exact error

---

**Status:** 🚨 CRITICAL FIX - Apply immediately to restore order functionality

**Time to Fix:** ~2 minutes

**Downtime:** None (fix is applied while system is running)
