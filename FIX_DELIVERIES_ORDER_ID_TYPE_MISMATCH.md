# Fix: Deliveries Table order_id Type Mismatch

## Problem

Error encountered:
```
Failed to run sql query: ERROR: 42703: column "user_id" does not exist
```

## Root Cause

Migration 050 (create_rider_portal_tables.sql) incorrectly defined the `deliveries.order_id` column as `UUID` type:

```sql
order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE
```

However, the `orders.id` column is actually `TEXT` type (as confirmed in migration 049 and throughout the codebase). This type mismatch causes:

1. **Foreign key constraint errors** when the migration runs
2. **PostgREST relationship resolution issues** when queries try to join deliveries with orders
3. **Cryptic error messages** that may reference "user_id" or other columns due to SQL parser confusion

## Solution

### 1. Fixed Migration 050

Updated line 45 to use TEXT type:

```sql
order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE
```

This ensures new installations create the table with the correct type.

### 2. Created Migration 051

For existing databases that may have been created with the wrong type, migration 051:

- Drops the existing FK constraint on `order_id`
- Converts `order_id` from UUID to TEXT type
- Re-creates the FK constraint with correct types

## How to Apply

### For New Installations

Simply run all migrations in order. Migration 050 now creates the table with correct types.

### For Existing Installations

1. **Backup your database first!**

2. Run migration 051:
   ```bash
   psql $DATABASE_URL -f supabase/migrations/051_fix_deliveries_rider_reference.sql
   ```

3. Verify the fix:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'deliveries' AND column_name = 'order_id';
   ```

   Should return:
   ```
   column_name | data_type
   -----------+-----------
   order_id    | text
   ```

## Table Schema Reference

After this fix, the deliveries table has these key foreign keys:

- `order_id TEXT` → references `orders(id)` which is TEXT type
- `rider_id UUID` → references `users(id)` which is UUID type

The riders table has:
- `user_id UUID` → references `users(id)` which is UUID type

## Testing

After applying the fix, test that:

1. Deliveries can be created with valid order_id values
2. Queries like `.select('*, orders(...)')` work on deliveries table
3. Triggers on deliveries table execute without errors
4. Rider dashboard and deliveries pages load correctly

## Related Memories

- **deliveries table order_id type**: deliveries table must use TEXT type for order_id column to match orders.id which is TEXT, not UUID
- **orders table id column type**: The orders table uses TEXT type for the id column (not UUID), so foreign key references must use TEXT type to match

## Files Changed

- `supabase/migrations/050_create_rider_portal_tables.sql` - Fixed order_id type definition
- `supabase/migrations/051_fix_deliveries_rider_reference.sql` - Migration to fix existing databases
- `FIX_DELIVERIES_ORDER_ID_TYPE_MISMATCH.md` - This documentation
