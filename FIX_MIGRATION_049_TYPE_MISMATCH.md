# Fix: Migration 049 Foreign Key Type Mismatch

## Problem

When running migration 049, the following error occurred:

```
ERROR:  42804: foreign key constraint "cash_drawer_transactions_reference_order_id_fkey" cannot be implemented
DETAIL:  Key columns "reference_order_id" and "id" are of incompatible types: uuid and text.
```

## Root Cause

The migration file originally defined `reference_order_id` as UUID type:

```sql
ALTER TABLE cash_drawer_transactions 
ADD COLUMN IF NOT EXISTS reference_order_id UUID REFERENCES orders(id);
```

However, the `orders` table's `id` column is actually of type TEXT (not UUID) in the database. This caused a type mismatch when trying to create the foreign key constraint.

## Solution

Changed the `reference_order_id` column type from UUID to TEXT to match the actual `orders.id` column type:

```sql
ALTER TABLE cash_drawer_transactions 
ADD COLUMN IF NOT EXISTS reference_order_id TEXT REFERENCES orders(id);
```

## Files Changed

1. **supabase/migrations/049_add_payment_adjustment_type.sql**
   - Changed `reference_order_id` from UUID to TEXT type
   - Added note about using TEXT type to match orders.id

2. **supabase/migrations/RUN_MIGRATION_049.md**
   - Updated documentation to reflect TEXT type
   - Updated verification queries to expect TEXT type

3. **GCASH_SALES_AUDIT_IMPLEMENTATION.md**
   - Updated column type documentation from UUID to TEXT
   - Added note about matching orders.id column type

## Important Note for Future Migrations

**The `orders` table uses TEXT type for the `id` column**, not UUID. Any foreign key references to `orders(id)` must use TEXT type to avoid this error.

## How to Apply the Fix

If you already ran the failing migration, you'll need to:

1. Drop the column if it was partially created:
   ```sql
   ALTER TABLE cash_drawer_transactions DROP COLUMN IF EXISTS reference_order_id;
   ```

2. Run the updated migration:
   - Use Supabase Dashboard SQL Editor
   - Copy contents of `supabase/migrations/049_add_payment_adjustment_type.sql`
   - Execute the SQL

3. Verify:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'cash_drawer_transactions' 
   AND column_name = 'reference_order_id';
   
   -- Should return: reference_order_id | text
   ```

## Status

✅ **Fixed** - Migration 049 now uses TEXT type for `reference_order_id` to match the `orders.id` column type.

---

**Date Fixed**: April 30, 2026  
**Issue**: Foreign key type mismatch  
**Resolution**: Changed column type from UUID to TEXT
