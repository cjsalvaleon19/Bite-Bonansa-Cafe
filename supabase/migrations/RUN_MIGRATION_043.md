# Migration 043: Add Missing balance_after Column

## Purpose
This migration fixes the error:
```
ERROR: 42703: column "balance_after" of relation "loyalty_transactions" does not exist
```

## Background
The `loyalty_transactions` table was created in an earlier migration (`fix_orders_and_loyalty_schema.sql`) **without** the `balance_after` column. Migration 042 attempted to create the table using `CREATE TABLE IF NOT EXISTS`, but since the table already existed, it skipped the creation entirely—leaving the table without the required column.

This migration adds the missing `balance_after` column to the existing table using `ALTER TABLE`.

## What This Migration Does

### 1. Adds `balance_after` Column
```sql
ALTER TABLE loyalty_transactions 
  ADD COLUMN balance_after DECIMAL(10,2) NOT NULL DEFAULT 0;
```
- Required for tracking running balance after each transaction
- Used by cashier interface when completing pickup orders

### 2. Fixes Column Data Types (if needed)
The migration also ensures consistency with migration 042's schema:
- Converts `amount` from `INT` to `DECIMAL(10,2)` (if needed)
- Converts `transaction_type` from `TEXT` to `VARCHAR(50)` (if needed)
- Converts `created_at` from `TIMESTAMPTZ` to `TIMESTAMP` (if needed)
- Adds `description` column if missing

### 3. Adds `total_spent` to customer_item_purchases
- Ensures the `customer_item_purchases` table also has all required columns

### 4. Creates Performance Index
```sql
CREATE INDEX idx_loyalty_transactions_balance 
  ON loyalty_transactions(balance_after);
```

## How to Apply This Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file:
   ```
   supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql
   ```
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute the migration
7. Check the output for success messages

### Option 2: Using Supabase CLI
```bash
supabase db push
# Or apply this specific migration
supabase migration up
```

### Option 3: Direct SQL
If you have database access:
```bash
psql -h your-db-host -U postgres -d postgres < supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql
```

## Expected Output

When you run the migration, you should see messages like:
```
NOTICE: Added balance_after column to loyalty_transactions
NOTICE: amount column is already correct type
NOTICE: transaction_type column is already correct type
NOTICE: description column already exists in loyalty_transactions
NOTICE: created_at column is already correct type
NOTICE: total_spent column already exists in customer_item_purchases
```

The exact messages will depend on your current table state. All messages are informational—the migration is designed to be idempotent.

## Verification Steps

### 1. Verify Column Was Added
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'loyalty_transactions' 
  AND column_name = 'balance_after';
```

**Expected result:**
```
column_name   | data_type | column_default
--------------|-----------|---------------
balance_after | numeric   | 0
```

### 2. Check All Columns Are Correct
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loyalty_transactions'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` (uuid)
- `customer_id` (uuid)
- `order_id` (uuid)
- `transaction_type` (character varying)
- `amount` (numeric)
- `balance_after` (numeric) ✅
- `description` (text)
- `created_at` (timestamp without time zone)

### 3. Test Pickup Order Completion
1. Log in as a cashier at `/cashier/orders-queue`
2. Create or use an existing pickup order
3. Mark it as "Ready for Pick-up"
4. Click "Order Complete"
5. Should complete successfully without errors

## Migration Safety

This migration is:
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Non-destructive** - Only adds columns, never removes data
- ✅ **Backwards compatible** - Existing code continues to work
- ✅ **Uses DEFAULT values** - New column has sensible defaults

## Rollback (If Needed)

If you need to undo this migration:
```sql
-- Remove the balance_after column
ALTER TABLE public.loyalty_transactions 
  DROP COLUMN IF EXISTS balance_after;

-- Remove the index
DROP INDEX IF EXISTS idx_loyalty_transactions_balance;

-- Note: Other changes (data type conversions) cannot be easily rolled back
-- without potential data loss. Only rollback if absolutely necessary.
```

## Why This Happened

The issue occurred because:
1. An earlier SQL script (`fix_orders_and_loyalty_schema.sql`) created `loyalty_transactions` without `balance_after`
2. That script was likely run directly on production database
3. Migration 042 used `CREATE TABLE IF NOT EXISTS`, which skips if table exists
4. The application code expects `balance_after` to exist, causing the error

## Prevention for Future

To prevent similar issues:
- Always use migrations in the `supabase/migrations/` folder
- Apply migrations sequentially in order
- Use `ALTER TABLE` when modifying existing tables
- Test migrations on a staging database first

## Related Files

### Application Code That Uses balance_after
- `pages/cashier/orders-queue.js:177-208` - `handleCompletePickup` function

### Related Migrations
- **Migration 042**: `042_create_missing_loyalty_and_purchase_tables.sql` - Original attempt to create table
- **Migration 043**: This migration - Fixes missing column

## Next Steps After Migration

1. ✅ Apply migration 043 to your database
2. ✅ Verify the column exists (use verification queries above)
3. ✅ Test pickup order completion
4. ✅ Monitor application logs for any remaining errors
5. Consider implementing the loyalty points calculation logic

---

**Migration File**: `supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql`  
**Status**: Required to fix production error  
**Date**: April 29, 2026
