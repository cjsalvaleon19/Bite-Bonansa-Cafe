# URGENT: Apply Migrations 045 and 046 to Fix Critical Errors

## Critical Issues Fixed

✅ **EOD Report failing to fetch orders** - Missing `variant_details` column  
✅ **POS checkout failing with duplicate key error** - Invalid UNIQUE constraint on `order_number`

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, DATE(created_at))
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

## What These Migrations Fix

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
2. Added composite unique index on `(order_number, DATE(created_at))`
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

You can also run them via command line:

```bash
# Using psql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/045_add_variant_details_to_order_items.sql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/046_fix_duplicate_order_number_constraint.sql

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
- [ ] EOD Report tested - working without errors
- [ ] Order placement tested - working without errors
- [ ] Order number reset tested (wait for next day)
- [ ] Code deployed to production

**Priority**: URGENT - Apply immediately to restore EOD Report and POS functionality
