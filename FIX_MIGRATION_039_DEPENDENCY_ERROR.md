# Fix for Migration 039 - Dependency Error

## Error Message
```
Failed to run sql query: ERROR:  2BP01: cannot drop function generate_order_number() because other objects depend on it
DETAIL:  trigger set_order_number on table orders depends on function generate_order_number()
HINT:  Use DROP ... CASCADE to drop the dependent objects too.
```

## Root Cause

The error occurs because PostgreSQL cannot drop a function when other database objects (triggers in this case) depend on it. The migration attempted to drop `generate_order_number()` directly, but a trigger named `set_order_number` was still using it.

### Historical Context

1. **Migration 017**: Created the original `generate_daily_order_number()` function returning VARCHAR(4)
2. **Migration 035**: Updated to VARCHAR(3) format and created `trg_set_order_number` trigger
3. **Production Environment**: Appears to have an older trigger named `set_order_number` (without the "trg_" prefix) that still references the legacy `generate_order_number()` function

## Solution

The fix involves dropping **both** possible trigger names before dropping the legacy function:

```sql
-- Drop both possible trigger names (with and without 'trg_' prefix)
DROP TRIGGER IF EXISTS set_order_number ON orders;
DROP TRIGGER IF EXISTS trg_set_order_number ON orders;

-- Now safe to drop the legacy function
DROP FUNCTION IF EXISTS generate_order_number();
```

## Why Not Use CASCADE?

While the error hints to use `DROP ... CASCADE`, this is **not recommended** because:

1. **Loss of Control**: CASCADE drops dependent objects without explicit confirmation
2. **Accidental Deletions**: Could drop objects we want to keep
3. **Best Practice**: Explicitly drop dependencies first, then the function

## Proper Dependency Chain

The correct order of operations is:

1. **Drop dependent triggers** → Removes the dependency
2. **Drop legacy function** → Now safe since nothing depends on it  
3. **Verify correct functions exist** → Ensure migration 035 ran properly
4. **Recreate trigger** → Using the correct function chain

## Updated Migration 039

The corrected migration now:

1. Drops `set_order_number` trigger (production name)
2. Drops `trg_set_order_number` trigger (standardized name)
3. Drops `generate_order_number()` legacy function
4. Verifies `generate_daily_order_number()` exists (VARCHAR(3))
5. Verifies `set_order_number()` trigger function exists
6. Recreates `trg_set_order_number` trigger with correct function

## Testing

After running the migration, verify:

```sql
-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'orders';

-- Should only show: trg_set_order_number

-- Check functions
SELECT proname, pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname LIKE '%order_number%';

-- Should show:
-- generate_daily_order_number | character varying(3)
-- set_order_number | trigger

-- Test order creation
INSERT INTO orders (customer_id, total, status) 
VALUES ('some-uuid', 100.00, 'pending');

-- Should auto-generate 3-digit order_number (000-999)
```

## Key Takeaways

1. **Always drop dependencies first** before dropping database objects
2. **Check for naming variations** in production vs. development environments
3. **Avoid CASCADE** unless you fully understand what will be deleted
4. **Use IF EXISTS** for safe, idempotent migrations
5. **Verify after migration** that the correct objects exist

## Related Files

- `supabase/migrations/039_drop_legacy_generate_order_number.sql` - The corrected migration
- `supabase/migrations/035_update_order_number_to_3digit.sql` - Defines current 3-digit system
- `supabase/migrations/017_order_number_4digit_daily.sql` - Original 4-digit system
