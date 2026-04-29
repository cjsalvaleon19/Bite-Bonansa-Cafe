# Database Schema Fix - Complete Summary

## The Problem

You're experiencing this error when trying to complete pickup orders:
```
ERROR: 42703: column "balance_after" of relation "loyalty_transactions" does not exist
```

This happens because the `loyalty_transactions` table in your database is missing the `balance_after` column that the application code expects.

## Why This Happened

1. The `loyalty_transactions` table was created earlier (possibly from `fix_orders_and_loyalty_schema.sql`) **without** the `balance_after` column
2. Migration 042 tried to create the table with `CREATE TABLE IF NOT EXISTS`
3. Since the table already existed, the migration skipped creating it
4. Result: Table exists but is missing required columns

## The Fix: Apply Both Migrations

You need to run **TWO** migrations in sequence:

### 1. Migration 042 (Creates Tables)
**File**: `supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`

Creates three tables if they don't exist:
- `loyalty_transactions` (with balance_after)
- `customer_item_purchases` (with FK to menu_items)
- `customer_reviews` (for future use)

### 2. Migration 043 (Fixes Existing Tables)
**File**: `supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql`

Adds missing columns to existing tables:
- Adds `balance_after` to `loyalty_transactions`
- Fixes data types (INT → DECIMAL, TEXT → VARCHAR)
- Adds `total_spent` to `customer_item_purchases`

## Quick Fix (5-7 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in left sidebar

### Step 2: Run Migration 042
1. Copy entire contents of `supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`
2. Paste into SQL Editor
3. Click **Run**
4. Wait for success message

### Step 3: Run Migration 043
1. **Open a NEW query**
2. Copy entire contents of `supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Look for NOTICE messages like:
   - "Added balance_after column to loyalty_transactions"
   - "Converted amount column from INT to DECIMAL(10,2)"

### Step 4: Verify the Fix
Run this query:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loyalty_transactions' 
  AND column_name = 'balance_after';
```

**Expected**: 1 row showing `balance_after | numeric`

## Test the Fix

### Test 1: Pickup Order Completion
1. Go to `/cashier/orders-queue`
2. Find a pickup order in "Ready for Pick-up" status
3. Click "Order Complete"
4. Should succeed without errors ✅

### Test 2: Customer Dashboard
1. Go to `/customer/dashboard`
2. Dashboard should load without errors
3. Purchase history section displays correctly ✅

## What Gets Fixed

| Error | Before | After |
|-------|--------|-------|
| Pickup order completion | ❌ "column balance_after does not exist" | ✅ Works |
| Customer dashboard | ❌ "Could not find relationship" | ✅ Works |
| Purchase history | ❌ 400 error | ✅ Displays |

## Database Changes

### loyalty_transactions Table
```sql
-- Before (incomplete)
id UUID
customer_id UUID
order_id UUID
amount INT              -- Wrong type
transaction_type TEXT   -- Wrong type
created_at TIMESTAMPTZ
-- Missing: balance_after, description

-- After (complete)
id UUID
customer_id UUID
order_id UUID
transaction_type VARCHAR(50)  -- ✅ Fixed
amount DECIMAL(10,2)          -- ✅ Fixed
balance_after DECIMAL(10,2)   -- ✅ Added
description TEXT              -- ✅ Added
created_at TIMESTAMP          -- ✅ Fixed
```

### customer_item_purchases Table
```sql
-- Now has proper foreign key to menu_items
menu_item_id UUID REFERENCES menu_items(id)  -- ✅ Enables nested queries
total_spent DECIMAL(10,2)                     -- ✅ Added if missing
```

## Safety Features

Both migrations are:
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Non-destructive** - Only adds, never removes
- ✅ **Smart** - Check before modifying
- ✅ **Reversible** - Can be rolled back if needed

## Rollback (Emergency Only)

If you need to undo (not recommended):
```sql
-- Remove added column
ALTER TABLE loyalty_transactions DROP COLUMN IF EXISTS balance_after;

-- Revert to INT (will lose decimal precision!)
ALTER TABLE loyalty_transactions ALTER COLUMN amount TYPE INT;

-- Drop all tables (DANGER: loses all data!)
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS customer_item_purchases CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
```

## Detailed Documentation

- **Quick Start**: `APPLY_MIGRATION_042_NOW.md`
- **Migration 042 Guide**: `supabase/migrations/RUN_MIGRATION_042.md`
- **Migration 043 Guide**: `supabase/migrations/RUN_MIGRATION_043.md`
- **Complete Fix Doc**: `FIX_SERVER_RESPONSE_ERRORS.md`

## FAQ

**Q: Do I need to run both migrations?**  
A: Yes. 042 creates tables, 043 fixes existing ones. Both are needed to handle all scenarios.

**Q: What if I've already run 042?**  
A: Run 043 now. It will add the missing columns.

**Q: Will this delete any data?**  
A: No. Both migrations only add, never delete.

**Q: Can I run them again if something fails?**  
A: Yes. Both are idempotent and safe to rerun.

**Q: What if the tables don't exist at all?**  
A: Migration 042 will create them. Migration 043 will skip (nothing to fix).

**Q: How long will this take?**  
A: 5-7 minutes total. The migrations run in seconds, most time is copy/paste.

## Support

Still seeing errors after applying both migrations?

1. **Verify both ran successfully** - Check for success/NOTICE messages
2. **Check column exists** - Run verification query above
3. **Clear browser cache** - Reload application pages
4. **Check Supabase logs** - Database → Logs section
5. **Verify RLS is enabled** - Should show in table settings

---

**Status**: 🔴 **URGENT - APPLY BOTH MIGRATIONS NOW**  
**Time Required**: 5-7 minutes  
**Risk Level**: Low (safe, reversible)  
**Impact**: Fixes critical production errors  

**Files**:
- `supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`
- `supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql`
