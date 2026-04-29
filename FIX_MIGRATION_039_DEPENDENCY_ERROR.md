# Fix for Migration 039 Dependency Error

## Problem

When running migration 039, the following error occurred:

```
ERROR: 2BP01: cannot drop function generate_order_number() because other objects depend on it
DETAIL: trigger set_order_number on table orders depends on function generate_order_number()
HINT: Use DROP ... CASCADE to drop the dependent objects too.
```

## Root Cause

The legacy `generate_order_number()` function (without "daily") had a trigger dependency that prevented it from being dropped. The migration was attempting to drop the function directly without first removing the dependent trigger.

## Solution

Updated migration 039 to:

1. **Drop dependent triggers first** - Before dropping the function, the migration now identifies and drops any triggers on the `orders` table that depend on the legacy function:
   - `set_order_number` (legacy trigger)
   - `trg_generate_order_number` (if exists)
   - `trg_set_order_number` (will be recreated)

2. **Drop the function with CASCADE** - Added `CASCADE` option to ensure any remaining dependent objects are dropped along with the function

3. **Recreate the correct trigger** - After cleanup, the migration recreates the proper `trg_set_order_number` trigger that uses:
   - Trigger function: `set_order_number()` (returns TRIGGER type)
   - Helper function: `generate_daily_order_number()` (returns VARCHAR(3))

## Changes Made

### File: `supabase/migrations/039_drop_legacy_generate_order_number.sql`

#### Before:
```sql
DROP FUNCTION IF EXISTS generate_order_number();
```

#### After:
```sql
-- Drop any triggers that depend on the legacy function first
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN 
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'orders'
      AND trigger_name IN ('set_order_number', 'trg_generate_order_number', 'trg_set_order_number')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON orders', trigger_rec.trigger_name);
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
  END LOOP;
END $$;

-- Drop the legacy function with CASCADE
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;

-- Recreate the correct trigger
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION set_order_number();
```

## How It Works

1. **Trigger Cleanup**: The migration queries `information_schema.triggers` to find all triggers on the `orders` table with legacy names
2. **Safe Dropping**: Each found trigger is dropped using `DROP TRIGGER IF EXISTS`
3. **Function Cleanup**: The legacy `generate_order_number()` function is dropped with `CASCADE` to handle any remaining dependencies
4. **Trigger Recreation**: The correct `trg_set_order_number` trigger is recreated, ensuring proper function reference

## Testing

Run the test script to verify the migration:

```sql
-- In Supabase SQL Editor
\i supabase/migrations/test_migration_039.sql
```

The test verifies:
- ✓ Legacy `generate_order_number()` function is dropped
- ✓ Current `generate_daily_order_number()` function exists
- ✓ Function returns VARCHAR type
- ✓ `order_number` column is VARCHAR(3)
- ✓ `set_order_number()` trigger function exists
- ✓ Trigger is configured correctly
- ✓ No legacy triggers remain
- ✓ Order creation works without errors

## Impact

- **Before**: Migration would fail with dependency error
- **After**: Migration runs successfully, cleaning up legacy functions and triggers
- **Result**: Order number generation works correctly with 3-digit format (000-999)

## Related Migrations

- Migration 017: Created original 4-digit order number system
- Migration 035: Updated to 3-digit order number system
- Migration 038: Fixed trigger function type issues
- Migration 039: Removes legacy function (this fix)

## Notes

- The migration is idempotent - it can be run multiple times safely
- All legacy triggers are removed before recreating the correct one
- The `CASCADE` option ensures all dependencies are handled
- The correct two-function architecture is maintained:
  - `generate_daily_order_number()` - generates the number
  - `set_order_number()` - trigger function that applies it
