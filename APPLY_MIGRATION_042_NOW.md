# URGENT: Apply Migration 042 to Fix Production Errors

## Quick Action Required

Your application is experiencing these errors:
- ❌ Customer Dashboard: "Could not find a relationship between 'customer_item_purchases' and 'menu_items'"
- ❌ Orders Queue: "column 'balance_after' does not exist"

**These errors occur because required database tables are missing.**

## Fix in 3 Steps (5 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration
1. Open this file in your repository:
   ```
   supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql
   ```
2. Copy the **entire contents** of the file
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl/Cmd + Enter)
5. Wait for "Success. No rows returned" message

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
- **Migration SQL**: `supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`
- **Full Guide**: `supabase/migrations/RUN_MIGRATION_042.md`
- **Fix Summary**: `FIX_SERVER_RESPONSE_ERRORS.md`

## Rollback (If Needed)

If something goes wrong, run this to undo:
```sql
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
