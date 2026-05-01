# Fix: customer_id NOT NULL Constraint Error

## Problem

```
ERROR: 23502: null value in column "customer_id" of relation "users" violates not-null constraint
DETAIL: Failing row contains (6656bb60-1bf9-4ff0-9def-0ff014a6d352, johndave0991@bitebonansacafe.com, John Dave Salvaleon, null, null, rider, null, 2026-05-01 02:43:15.197838, 2026-05-01 16:19:32.160633).
```

## Root Cause

The `customer_id` column in the `public.users` table has a NOT NULL constraint, but this column should only be populated for users with `role='customer'`. Users with other roles (rider, cashier, admin) don't need a customer_id.

## Solution

Make the `customer_id` column nullable in the users table.

## How to Fix

### Option 1: Run Migration (Recommended for production)

Run migration 061:
```bash
# Apply via Supabase CLI
supabase db push

# Or run the migration file directly in Supabase SQL Editor
# File: supabase/migrations/061_make_customer_id_nullable.sql
```

### Option 2: Quick Fix (Immediate fix in Supabase SQL Editor)

Run the immediate fix SQL:
```sql
-- File: FIX_CUSTOMER_ID_NOT_NULL.sql
ALTER TABLE public.users 
  ALTER COLUMN customer_id DROP NOT NULL;
```

## Verification

After applying the fix, verify:

```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'customer_id';
```

Expected result:
- `is_nullable`: `YES`

## Design Note

The application code (login.js) already correctly handles this:
- Lines 76-79: Only sets `customer_id` when `userRole === 'customer'`
- Riders, cashiers, and admins are created without customer_id

The database constraint just needed to match this design.

## Files Changed

- **Migration**: `supabase/migrations/061_make_customer_id_nullable.sql`
- **Immediate Fix**: `FIX_CUSTOMER_ID_NOT_NULL.sql`
- **Documentation**: This file

## Related

- The `customer_id` column was likely added with a NOT NULL constraint by mistake in an earlier schema setup
- This fix allows the proper separation of concerns between different user roles
