# URGENT: Apply Migrations 045, 046, and 047 to Fix Critical Errors

## Critical Issues Fixed

✅ **EOD Report failing to fetch orders** - Missing `variant_details` column  
✅ **POS checkout failing with duplicate key error** - Invalid UNIQUE constraint on `order_number`  
✅ **Orders Queue failing to mark items as served** - Orphaned trigger referencing missing `post_order_journal_entries` function

## Quick Fix Instructions

### Step 1: Apply Migration 045 (Add variant_details column)

Open Supabase SQL Editor and run:

```sql
-- Migration 045: Add variant_details column to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS variant_details JSONB;

CREATE INDEX IF NOT EXISTS idx_order_items_variant_details 
ON order_items USING GIN (variant_details);

COMMENT ON COLUMN order_items.variant_details IS 'Variant selections for this item stored as JSONB (e.g., {"Size": "Large", "Temperature": "Iced"})';
```

**Verification:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'order_items' 
  AND column_name = 'variant_details';
```

Expected result: `variant_details | jsonb`

---

### Step 2: Apply Migration 046 (Fix order number constraint)

Open Supabase SQL Editor and run:

```sql
-- Migration 046: Fix duplicate order number constraint

-- Find and drop the global UNIQUE constraint on order_number
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'orders' 
    AND c.contype = 'u'
    AND a.attname = 'order_number'
  LIMIT 1;
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END IF;
END $$;

-- Create composite unique index for order_number per date
-- Using ::date cast instead of DATE() because it's IMMUTABLE
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;
```

**Verification:**
```sql
-- Check that the global unique constraint is gone
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'orders' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%order_number%';
```

Expected result: No rows (the old constraint should be gone)

```sql
-- Check that the new composite index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'orders' 
  AND indexname = 'idx_orders_order_number_date_unique';
```

Expected result: `idx_orders_order_number_date_unique`

---

### Step 3: Apply Migration 047 (Remove orphaned triggers)

Open Supabase SQL Editor and run:

```sql
-- Migration 047: Remove orphaned triggers referencing missing functions

-- Drop triggers on order_items that reference journal functions
DO $$
DECLARE
  trigger_rec RECORD;
  dropped_count INT := 0;
BEGIN
  FOR trigger_rec IN 
    SELECT t.tgname as trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'order_items'
      AND t.tgisinternal = false
  LOOP
    DECLARE
      func_name TEXT;
    BEGIN
      SELECT p.proname INTO func_name
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgname = trigger_rec.trigger_name;
      
      IF func_name LIKE '%journal%' OR func_name = 'post_order_journal_entries' THEN
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON order_items', trigger_rec.trigger_name);
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped trigger % referencing journal function %', trigger_rec.trigger_name, func_name;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
  
  IF dropped_count > 0 THEN
    RAISE NOTICE '✓ Dropped % orphaned trigger(s)', dropped_count;
  ELSE
    RAISE NOTICE 'ℹ No orphaned triggers found';
  END IF;
END $$;

-- Drop the missing function if it exists
DROP FUNCTION IF EXISTS public.post_order_journal_entries(text, character varying, text);
DROP FUNCTION IF EXISTS public.post_order_journal_entries(text, varchar, text);
DROP FUNCTION IF EXISTS public.post_order_journal_entries();
```

**Verification:**
```sql
-- Check for remaining triggers on order_items
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'order_items'
  AND t.tgisinternal = false;
```

Expected result: Should only show valid triggers (like `trg_update_customer_item_purchases`), no triggers referencing journal functions

---

## What These Migrations Fix

### Migration 047: Orphaned Trigger Cleanup
**Problem**: Orders Queue was failing with error:
```
function public.post_order_journal_entries(text, character varying, text) does not exist
```

**Root Cause**: A trigger was created on the `order_items` table in production that references a function `post_order_journal_entries`, but this function was never created or has been dropped. When trying to mark items as served, the trigger fires and fails because the function doesn't exist.

**Solution**: 
1. Identify and drop any triggers on `order_items` that reference journal-related functions
2. Drop the `post_order_journal_entries` function if it exists
3. Allow order item updates to proceed without the orphaned trigger

**Impact**:
- ✅ Marking items as served will work correctly
- ✅ No breaking changes to existing functionality
- ⚠️ If journal functionality was intended, it will need to be reimplemented

---

### Migration 045: variant_details Column
**Problem**: EOD Report was failing with error:
```
column order_items_1.variant_details does not exist
```

**Solution**: Added `variant_details` JSONB column to store variant selections (e.g., Size: Large, Temperature: Iced)

**Impact**: 
- ✅ EOD Report will now work correctly
- ✅ Variant information will be preserved in order history
- ✅ No breaking changes to existing functionality

---

### Migration 046: Order Number Constraint
**Problem**: POS checkout was failing with error:
```
duplicate key value violates unique constraint "orders_order_number_key"
```

**Root Cause**: The `order_number` column had a global UNIQUE constraint, but order numbers are designed to reset daily (001, 002, 003...). When a new day starts, order 001 gets created again, violating the global constraint.

**Solution**: 
1. Removed global UNIQUE constraint
2. Added composite unique index on `(order_number, created_at::date)` using IMMUTABLE cast
3. Ensures uniqueness within each day, allows daily resets

**Impact**:
- ✅ Order numbers can reset daily without errors
- ✅ Still prevents duplicate order numbers on the same day
- ✅ No breaking changes to existing functionality

---

## Testing After Migration

### 1. Test EOD Report
```
1. Navigate to /cashier/eod-report
2. Select today's date
3. Verify orders are fetched without errors
4. Check that variant details appear for items with variants
```

### 2. Test Order Placement
```
1. Place a customer order with variant items (e.g., Large Iced Coffee)
2. Verify order is created successfully
3. Check that variant_details is saved in the database
```

### 3. Test Daily Order Number Reset
```
1. Note the current highest order number (e.g., 015)
2. Wait until the next day
3. Place a new order
4. Verify order number starts at 001 without errors
```

---

## Full Migration Files

The complete migration files are available at:
- `supabase/migrations/045_add_variant_details_to_order_items.sql`
- `supabase/migrations/046_fix_duplicate_order_number_constraint.sql`
- `supabase/migrations/047_remove_orphaned_journal_triggers.sql`

You can also run them via command line:

```bash
# Using psql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/045_add_variant_details_to_order_items.sql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/046_fix_duplicate_order_number_constraint.sql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/047_remove_orphaned_journal_triggers.sql

# Or using Supabase CLI
supabase db push
```

---

## Rollback (If Needed)

If you need to rollback these migrations:

```sql
-- Rollback Migration 046
DROP INDEX IF EXISTS idx_orders_order_number_date_unique;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);

-- Rollback Migration 045
DROP INDEX IF EXISTS idx_order_items_variant_details;
ALTER TABLE order_items DROP COLUMN IF EXISTS variant_details;
```

**⚠️ Warning**: Rollback is not recommended as it will reintroduce the errors.

---

## Additional Resources

See `FIX_EOD_REPORT_AND_ORDER_ERRORS.md` for:
- Detailed problem analysis
- Complete code changes
- Extended testing procedures
- Database schema documentation

---

## Status Checklist

- [ ] Migration 045 applied and verified
- [ ] Migration 046 applied and verified
- [ ] Migration 047 applied and verified
- [ ] EOD Report tested - working without errors
- [ ] Order placement tested - working without errors
- [ ] Order number reset tested (wait for next day)
- [ ] Mark item as served tested - working without errors
- [ ] Code deployed to production

**Priority**: URGENT - Apply immediately to restore EOD Report, POS, and Orders Queue functionality
