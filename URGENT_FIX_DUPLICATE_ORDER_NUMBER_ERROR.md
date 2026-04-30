# URGENT FIX: Duplicate Order Number Constraint Error

## Problem

**Error Message:**
```
duplicate key value violates unique constraint "orders_order_number_key"
```

**Impact:** 
- ❌ POS checkout is failing
- ❌ Cannot create new orders
- ❌ Business operations are blocked

## Root Cause

The `orders` table has a global UNIQUE constraint on the `order_number` column. However, order numbers are designed to reset daily (001, 002, 003...). When a new day starts and the system tries to create order 001 again, it violates this global constraint.

## Immediate Fix

Run this SQL script in your Supabase SQL Editor **RIGHT NOW**:

```sql
-- ============================================================================
-- URGENT FIX: Remove Global UNIQUE Constraint on order_number
-- ============================================================================

-- Step 1: Drop the problematic global unique constraint
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the constraint name
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'orders' 
    AND c.contype = 'u'
    AND a.attname = 'order_number'
    AND array_length(c.conkey, 1) = 1  -- Only single-column constraint
  LIMIT 1;
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE '✓ Dropped global unique constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'ℹ No global unique constraint found on order_number';
  END IF;
END $$;

-- Step 2: Create composite unique index for order_number per date
-- This allows daily resets while preventing duplicates on the same day
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
      AND array_length(c.conkey, 1) = 1
  ) INTO old_constraint_exists;
  
  -- Check if new index exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND indexname = 'idx_orders_order_number_date_unique'
  ) INTO new_index_exists;
  
  IF NOT old_constraint_exists AND new_index_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ SUCCESS: Order number constraint fix completed!';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ Global UNIQUE constraint removed';
    RAISE NOTICE '✓ Composite unique index created (per-day uniqueness)';
    RAISE NOTICE '';
    RAISE NOTICE 'Order numbers can now reset daily without errors.';
    RAISE NOTICE 'POS checkout should work correctly now.';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
  ELSE
    RAISE WARNING '⚠ Fix may not be complete:';
    IF old_constraint_exists THEN
      RAISE WARNING '  - Old constraint still exists';
    END IF;
    IF NOT new_index_exists THEN
      RAISE WARNING '  - New index was not created';
    END IF;
  END IF;
END $$;
```

## Verification

After running the fix, verify it worked:

```sql
-- Should return NO ROWS (old constraint is gone)
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'orders' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%order_number%';

-- Should return 1 ROW (new index exists)
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'orders' 
  AND indexname = 'idx_orders_order_number_date_unique';
```

## Test the Fix

Try creating an order in the POS system:

1. Navigate to `/cashier/pos`
2. Add items to cart
3. Click "Process Payment"
4. Verify order is created successfully without constraint error

## What Changed

### Before (❌ Broken)
- Global UNIQUE constraint on `order_number`
- Order 001 can only exist once across all days
- Daily reset causes duplicate key errors

### After (✅ Fixed)
- Composite unique index on `(order_number, created_at::date)`
- Order 001 can exist once per day
- Daily resets work correctly

## Technical Details

The fix:
1. Removes the global `orders_order_number_key` UNIQUE constraint
2. Creates a composite unique index on `(order_number, date)`
3. Uses `created_at::date` cast (IMMUTABLE) instead of `DATE()` function (STABLE)
4. Ensures order numbers are unique within each day only

This allows the order numbering system to:
- Start at 001 each day
- Increment throughout the day (001, 002, 003...)
- Reset to 001 the next day
- Prevent duplicate order numbers on the same day

## Related Files

This fix is based on migration:
- `supabase/migrations/046_fix_duplicate_order_number_constraint.sql`

Full documentation:
- `APPLY_MIGRATIONS_045_046_NOW.md`
- `FIX_MIGRATION_046_IMMUTABLE_ERROR.md`

## If Error Persists

If you still see the error after applying this fix:

1. **Check constraint name:** The constraint might have a different name
   ```sql
   -- List all UNIQUE constraints on orders table
   SELECT 
     c.conname as constraint_name,
     a.attname as column_name
   FROM pg_constraint c
   JOIN pg_class t ON c.conrelid = t.oid
   JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
   WHERE t.relname = 'orders' 
     AND c.contype = 'u';
   ```

2. **Manually drop constraint:** If you find a constraint on `order_number`:
   ```sql
   ALTER TABLE orders DROP CONSTRAINT IF EXISTS <constraint_name>;
   ```

3. **Check application code:** Ensure your code isn't trying to enforce uniqueness

## Rollback (Not Recommended)

If you absolutely need to rollback:

```sql
DROP INDEX IF EXISTS idx_orders_order_number_date_unique;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
```

**⚠️ Warning:** This will reintroduce the duplicate key error!

## Prevention

To prevent this in the future:
- Always test migrations in staging before production
- Use the composite unique index pattern for date-based resets
- Avoid global UNIQUE constraints on columns that reset periodically

## Status

- [ ] SQL fix applied to production database
- [ ] Verification queries run successfully
- [ ] POS checkout tested and working
- [ ] Error monitoring confirms no more constraint violations

---

**Priority:** 🚨 CRITICAL - Apply immediately to restore POS functionality
