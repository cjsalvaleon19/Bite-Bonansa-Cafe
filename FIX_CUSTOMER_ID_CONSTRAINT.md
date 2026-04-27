# Fix: Foreign Key Constraint Error on Orders

## Problem

When placing an order, the application throws the following error:

```
Failed to place order: Error: insert or update on table "orders" violates foreign key constraint "orders_customer_id_fkey"
```

## Root Cause

The `orders` table has a foreign key constraint `orders_customer_id_fkey` that requires `customer_id` to reference an existing record in `public.users(id)`. However:

1. Users authenticate via Supabase Auth, creating records in `auth.users`
2. No corresponding record exists in `public.users` table
3. Order insertion fails because the foreign key constraint cannot be satisfied

## Solution

Make the `customer_id` column **nullable** in the `orders` table. This allows:
- Guest orders (users not logged in)
- Orders before user profile is created in `public.users`
- Graceful handling of authentication edge cases

## How to Apply the Fix

### Step 1: Run the SQL Migration

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `fix_customer_id_nullable.sql`
4. Click **Run** to execute the migration

### Step 2: Reload Schema Cache

**CRITICAL:** After running the migration:

1. Go to **Project Settings** → **API**
2. Click the **Reload schema** button
3. Wait for the schema cache to refresh

Without this step, the REST API won't recognize the schema changes!

### Step 3: Test Order Placement

Try placing an order again. The error should be resolved.

## What the Migration Does

The SQL migration performs these operations:

1. **Drops the existing foreign key constraint** `orders_customer_id_fkey`
2. **Makes `customer_id` nullable** by removing the NOT NULL constraint
3. **Re-adds the foreign key constraint** with `ON DELETE SET NULL` (allows NULL values)
4. **Adds an index** on `customer_id` for better query performance

## Code Changes (Optional)

The order placement code in `app/customer/order/page.tsx` already handles nullable `customer_id`:

```typescript
customer_id: user?.id,  // Will be undefined/null if user is not logged in
```

This is the correct pattern and doesn't need to be changed.

## Alternative Solution (Not Recommended)

Instead of making `customer_id` nullable, you could create a trigger that automatically inserts records into `public.users` when a user signs up via Supabase Auth. However, this is more complex and error-prone.

## Verification

After applying the fix, verify it worked:

```sql
-- Check that customer_id is now nullable
SELECT 
  column_name, 
  is_nullable, 
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders' 
  AND column_name = 'customer_id';

-- Expected result: is_nullable = 'YES'
```

## Related Files

- `fix_customer_id_nullable.sql` - SQL migration to fix the issue
- `app/customer/order/page.tsx` - Order placement code (lines 313-332)
- `fix_orders_and_loyalty_schema.sql` - Previous orders table schema migration

## Important Notes

⚠️ **Schema Cache Reload Required**
After running ANY SQL migration directly in Supabase SQL Editor, you MUST reload the schema cache or the REST API won't see your changes.

✅ **Safe Migration**
This migration is safe to run on production databases. It preserves all existing data and only modifies the constraint, allowing more flexibility.

🔒 **Data Integrity**
The foreign key constraint is still enforced when `customer_id` is not NULL. This maintains referential integrity while allowing NULL values.
