# URGENT: Apply Migrations 042 & 043 to Fix Production Errors

## Quick Action Required

Your application is experiencing these errors:
- ❌ Customer Dashboard: "Could not find a relationship between 'customer_item_purchases' and 'menu_items'"
- ❌ Orders Queue: "column 'balance_after' does not exist"

**These errors occur because required database tables are missing or incomplete.**

## ⚠️ Important: Apply BOTH Migrations

You need to apply **TWO** migrations in sequence:
1. **Migration 042** - Creates missing tables (if they don't exist)
2. **Migration 043** - Adds missing columns to existing tables

## Fix in 4 Steps (7 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run Migration 042
1. Open this file in your repository:
   ```
   supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql
   ```
2. Copy the **entire contents** of the file
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl/Cmd + Enter)
5. Wait for "Success" message (may say "No rows returned")

### Step 2b: Run Migration 043
1. **In a NEW query**, open this file:
   ```
   supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql
   ```
2. Copy the **entire contents** of the file
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl/Cmd + Enter)
5. Look for NOTICE messages like "Added balance_after column"

### Step 3: Verify the Fix
Run this query in the SQL Editor:
```sql
SELECT 'loyalty_transactions' as table_name, 
       COUNT(*) as columns
FROM information_schema.columns 
WHERE table_name = 'loyalty_transactions'
UNION ALL
SELECT 'customer_item_purchases', COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'customer_item_purchases';
```

**Expected Result**:
```
table_name                  | columns
----------------------------|--------
loyalty_transactions        | 8
customer_item_purchases     | 6
```

If you see this, the migration was successful! ✅

## Test the Fix

### Test 1: Customer Dashboard
1. Visit: `/customer/dashboard`
2. Log in as any customer
3. Should load without errors
4. Check browser console (F12) - no errors

### Test 2: Pickup Orders
1. Visit: `/cashier/orders-queue`
2. Mark a pickup order as ready
3. Click "Order Complete"
4. Should work without errors

## What This Migration Does

Creates three missing database tables:

| Table | Purpose | Fixes |
|-------|---------|-------|
| `loyalty_transactions` | Track customer points | ✅ "balance_after" column error |
| `customer_item_purchases` | Track purchase history | ✅ Schema cache relationship error |
| `customer_reviews` | Customer feedback | Future feature |

## Detailed Documentation

For more information, see:
- **Migration 042 SQL**: `supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`
- **Migration 042 Guide**: `supabase/migrations/RUN_MIGRATION_042.md`
- **Migration 043 SQL**: `supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql`
- **Migration 043 Guide**: `supabase/migrations/RUN_MIGRATION_043.md`
- **Fix Summary**: `FIX_SERVER_RESPONSE_ERRORS.md`

## Why Two Migrations?

**Scenario**: If `loyalty_transactions` table already exists in your database (from an earlier manual script), Migration 042 will skip creating it because it uses `CREATE TABLE IF NOT EXISTS`. However, the existing table is missing the `balance_after` column. That's why Migration 043 is needed—it adds the missing column to the existing table.

**Both migrations are idempotent** - safe to run even if tables/columns already exist.

## Rollback (If Needed)

If something goes wrong, run this to undo:
```sql
-- Rollback migration 043
ALTER TABLE public.loyalty_transactions DROP COLUMN IF EXISTS balance_after;

-- Rollback migration 042
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS customer_item_purchases CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
```

## Support

Issues after migration? Check:
1. Migration ran without errors
2. All 3 tables exist (verify query above)
3. RLS is enabled: `ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;`

---

**Status**: 🔴 **URGENT - APPLY NOW**  
**Estimated Time**: 5 minutes  
**Difficulty**: Easy (copy & paste)  
**Risk**: Low (idempotent, can be rolled back)
