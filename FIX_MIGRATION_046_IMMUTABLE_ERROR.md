# Migration 046 - IMMUTABLE Function Error Fix

## Problem

When trying to run migration `046_fix_duplicate_order_number_constraint.sql`, you may encounter this error:

```
Error: Failed to run sql query: ERROR: 42P17: functions in index expression must be marked IMMUTABLE
```

## Root Cause

PostgreSQL requires that functions used in index expressions must be marked as `IMMUTABLE`. This means they must always return the same output for the same input, regardless of database state or time.

The original migration used:
```sql
CREATE UNIQUE INDEX idx_orders_order_number_date_unique
ON orders (order_number, DATE(created_at))
WHERE order_number IS NOT NULL;
```

The `DATE()` function is marked as `STABLE`, not `IMMUTABLE`, because:
- It can be affected by timezone settings
- It depends on the current database session's timezone
- For the same timestamp input, it might return different dates in different timezones

## Solution

Replace `DATE(created_at)` with `created_at::date` (cast operation):

```sql
CREATE UNIQUE INDEX idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;
```

### Why This Works

The cast operation `::date` is considered `IMMUTABLE` in PostgreSQL because:
- It performs a simple type conversion
- It always produces the same output for the same input
- It doesn't depend on session settings (when operating on timestamp columns)

### Technical Details

**VOLATILE vs STABLE vs IMMUTABLE:**

- **VOLATILE**: Can return different results for the same input (e.g., `random()`, `now()`)
- **STABLE**: Returns the same result within a single query, but can change between queries (e.g., `DATE()` with timezone dependency)
- **IMMUTABLE**: Always returns the same result for the same input, forever (e.g., `::date` cast, arithmetic operations)

Only `IMMUTABLE` functions can be used in index expressions because indexes need to be deterministic and reliable.

## Applied Fix

The migration has been updated to use `created_at::date` instead of `DATE(created_at)`.

**Before:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, DATE(created_at))
WHERE order_number IS NOT NULL;
```

**After:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;
```

## Impact

This change:
- ✅ Resolves the "functions must be marked IMMUTABLE" error
- ✅ Achieves the same functional result (uniqueness per day)
- ✅ Works reliably across different timezone settings
- ✅ Is more performant (cast is simpler than function call)

## Verification

After applying the migration, verify the index was created:

```sql
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'orders' 
  AND indexname = 'idx_orders_order_number_date_unique';
```

Expected output:
```
indexname                             | indexdef
--------------------------------------+------------------------------------------------------------
idx_orders_order_number_date_unique   | CREATE UNIQUE INDEX ... ON orders (order_number, (created_at::date)) WHERE ...
```

## Related PostgreSQL Documentation

- [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
- [Function Volatility Categories](https://www.postgresql.org/docs/current/xfunc-volatility.html)
- [Index Expressions](https://www.postgresql.org/docs/current/indexes-expressional.html)

## Alternative Solutions Considered

### 1. Create IMMUTABLE Wrapper Function

```sql
CREATE OR REPLACE FUNCTION immutable_date(timestamp with time zone)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT $1::date;
$$;

CREATE UNIQUE INDEX idx_orders_order_number_date_unique
ON orders (order_number, immutable_date(created_at))
WHERE order_number IS NOT NULL;
```

**Rejected because:** More complex, requires managing an extra database object

### 2. Use Date Column Instead

Add a separate `order_date DATE` column populated by a trigger.

**Rejected because:** Unnecessary schema change, adds complexity

### 3. Direct Cast (Selected Solution)

Use `created_at::date` cast directly in the index.

**Selected because:** Simple, performant, achieves the goal with minimal code

## Testing

Test that the index works correctly:

```sql
-- Insert first order today
INSERT INTO orders (order_number, created_at) 
VALUES ('001', NOW());

-- This should succeed (different order number, same day)
INSERT INTO orders (order_number, created_at) 
VALUES ('002', NOW());

-- This should fail (duplicate order number on same day)
INSERT INTO orders (order_number, created_at) 
VALUES ('001', NOW());
-- Expected: ERROR: duplicate key value violates unique constraint

-- This should succeed (same order number, different day)
INSERT INTO orders (order_number, created_at) 
VALUES ('001', NOW() - INTERVAL '1 day');
```

## Rollback

If needed, drop the index:

```sql
DROP INDEX IF EXISTS idx_orders_order_number_date_unique;
```

Then recreate with the original approach or alternative.
